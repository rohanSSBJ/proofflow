import { randomBytes, randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { parse, serialize } from 'cookie';
import type { Request, Response, Router } from 'express';
import express from 'express';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { getAuth, hashRefreshToken, requireAuth } from '../../http/auth.js';
import { prisma } from '../../platform/db.js';
import { accessTokenSecret, env } from '../../platform/env.js';

const router: Router = express.Router();
const refreshCookieName = 'proofflow_refresh';
const refreshLifetimeMs = 1000 * 60 * 60 * 24 * 30;

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12),
  displayName: z.string().trim().min(2).max(120),
  organizationName: z.string().trim().min(2).max(160)
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});
const acceptInvitationSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(12),
  displayName: z.string().trim().min(2).max(120)
});

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'organization';
}

function createAccessToken(userId: string) {
  return jwt.sign({ type: 'access' }, accessTokenSecret(), { subject: userId, expiresIn: '15m' });
}

function setRefreshCookie(response: Response, token: string) {
  response.setHeader('Set-Cookie', serialize(refreshCookieName, token, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: refreshLifetimeMs / 1000
  }));
}

function clearRefreshCookie(response: Response) {
  response.setHeader('Set-Cookie', serialize(refreshCookieName, '', {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/v1/auth',
    maxAge: 0
  }));
}

function refreshTokenFromRequest(request: Request) {
  const header = request.headers.cookie;
  return header ? parse(header)[refreshCookieName] : undefined;
}

async function issueRefreshSession(userId: string, familyId: string = randomUUID()) {
  const token = randomBytes(48).toString('base64url');
  await prisma.refreshSession.create({
    data: {
      userId,
      familyId,
      tokenHash: hashRefreshToken(token),
      expiresAt: new Date(Date.now() + refreshLifetimeMs)
    }
  });
  return { token, familyId };
}

async function responseForUser(response: Response, userId: string, familyId?: string) {
  const session = await issueRefreshSession(userId, familyId);
  setRefreshCookie(response, session.token);
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, displayName: true, memberships: { select: { organizationId: true, role: true, organization: { select: { id: true, name: true, slug: true } } } } }
  });
  return { accessToken: createAccessToken(userId), user };
}

router.post('/register', async (request, response) => {
  const input = registerSchema.parse(request.body);
  const email = input.email.toLowerCase();
  const passwordHash = await bcrypt.hash(input.password, 12);
  const baseSlug = slugify(input.organizationName);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email } });
      if (existing) {
        response.status(409);
        throw new Error('EMAIL_ALREADY_REGISTERED');
      }

      const organization = await tx.organization.create({
        data: { name: input.organizationName, slug: `${baseSlug}-${randomBytes(3).toString('hex')}` }
      });
      const user = await tx.user.create({ data: { email, displayName: input.displayName, passwordHash } });
      await tx.organizationMember.create({ data: { organizationId: organization.id, userId: user.id, role: 'ADMIN' } });
      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          actorUserId: user.id,
          entityType: 'Organization',
          entityId: organization.id,
          action: 'ORGANIZATION_CREATED',
          metadata: { source: 'registration' }
        }
      });
      return user;
    });
    response.status(201).json(await responseForUser(response, result.id));
  } catch (error) {
    if (error instanceof Error && error.message === 'EMAIL_ALREADY_REGISTERED') {
      response.json({ error: { code: 'EMAIL_ALREADY_REGISTERED', message: 'An account with this email already exists.' } });
      return;
    }
    throw error;
  }
});

router.post('/login', async (request, response) => {
  const input = loginSchema.parse(request.body);
  const user = await prisma.user.findUnique({ where: { email: input.email.toLowerCase() } });
  if (!user || !(await bcrypt.compare(input.password, user.passwordHash))) {
    response.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Email or password is incorrect.' } });
    return;
  }
  response.json(await responseForUser(response, user.id));
});

router.post('/accept-invitation', async (request, response) => {
  const input = acceptInvitationSchema.parse(request.body);
  const invitation = await prisma.invitation.findUnique({ where: { tokenHash: hashRefreshToken(input.token) } });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt <= new Date()) {
    response.status(401).json({ error: { code: 'INVALID_INVITATION', message: 'The invitation is invalid, expired, or already accepted.' } });
    return;
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  try {
    const userId = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { email: invitation.email } });
      const user = existing ?? await tx.user.create({ data: { email: invitation.email, displayName: input.displayName, passwordHash } });
      const membership = await tx.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: invitation.organizationId, userId: user.id } } });
      if (membership) throw new Error('ALREADY_A_MEMBER');
      await tx.organizationMember.create({ data: { organizationId: invitation.organizationId, userId: user.id, role: invitation.role } });
      await tx.invitation.update({ where: { id: invitation.id }, data: { acceptedAt: new Date() } });
      await tx.auditLog.create({ data: { organizationId: invitation.organizationId, actorUserId: user.id, entityType: 'Invitation', entityId: invitation.id, action: 'INVITATION_ACCEPTED', metadata: { role: invitation.role, email: invitation.email } } });
      return user.id;
    });
    response.status(201).json(await responseForUser(response, userId));
  } catch (error) {
    if (error instanceof Error && error.message === 'ALREADY_A_MEMBER') {
      response.status(409).json({ error: { code: 'ALREADY_A_MEMBER', message: 'This account is already a member of the organization.' } });
      return;
    }
    throw error;
  }
});

router.post('/refresh', async (request, response) => {
  const token = refreshTokenFromRequest(request);
  if (!token) {
    response.status(401).json({ error: { code: 'REFRESH_REQUIRED', message: 'A refresh session is required.' } });
    return;
  }
  const tokenHash = hashRefreshToken(token);
  const existing = await prisma.refreshSession.findUnique({ where: { tokenHash } });
  if (!existing || existing.expiresAt <= new Date()) {
    clearRefreshCookie(response);
    response.status(401).json({ error: { code: 'INVALID_REFRESH_SESSION', message: 'The refresh session is invalid or expired.' } });
    return;
  }
  if (existing.revokedAt) {
    await prisma.refreshSession.updateMany({ where: { familyId: existing.familyId }, data: { revokedAt: new Date() } });
    clearRefreshCookie(response);
    response.status(401).json({ error: { code: 'REFRESH_REUSE_DETECTED', message: 'The refresh session family was revoked. Sign in again.' } });
    return;
  }

  const replacement = await issueRefreshSession(existing.userId, existing.familyId);
  await prisma.refreshSession.update({ where: { id: existing.id }, data: { revokedAt: new Date(), replacedByTokenHash: hashRefreshToken(replacement.token) } });
  setRefreshCookie(response, replacement.token);
  response.json({ accessToken: createAccessToken(existing.userId) });
});

router.post('/logout', async (request, response) => {
  const token = refreshTokenFromRequest(request);
  if (token) {
    await prisma.refreshSession.updateMany({ where: { tokenHash: hashRefreshToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
  }
  clearRefreshCookie(response);
  response.status(204).send();
});

router.get('/me', requireAuth, async (request, response) => {
  const auth = getAuth(request);
  const user = auth ? await prisma.user.findUnique({
    where: { id: auth.userId },
    select: { id: true, email: true, displayName: true, memberships: { select: { organizationId: true, role: true, organization: { select: { id: true, name: true, slug: true } } } } }
  }) : null;
  if (!user) {
    response.status(401).json({ error: { code: 'USER_NOT_FOUND', message: 'The authenticated user no longer exists.' } });
    return;
  }
  response.json({ user });
});

export { router as authRouter };
