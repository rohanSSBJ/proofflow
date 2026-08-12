import express, { type Router } from 'express';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { getAuth, hashRefreshToken, requireAuth, requireOrganization, requireRoles } from '../../http/auth.js';
import { prisma } from '../../platform/db.js';

const router: Router = express.Router();
const roleSchema = z.object({ role: z.enum(['ADMIN', 'MANAGER', 'CONTRIBUTOR', 'AUDITOR']) });
const invitationSchema = z.object({ email: z.string().email(), role: z.enum(['ADMIN', 'MANAGER', 'CONTRIBUTOR', 'AUDITOR']) });

function routeParam(request: express.Request, name: string) {
  const value = request.params[name];
  return Array.isArray(value) ? value[0] : value ?? '';
}

router.get('/members', requireAuth, requireOrganization, async (request, response) => {
  const auth = getAuth(request);
  const members = auth?.organizationId ? await prisma.organizationMember.findMany({
    where: { organizationId: auth.organizationId },
    orderBy: { createdAt: 'asc' },
    select: { userId: true, role: true, createdAt: true, user: { select: { id: true, email: true, displayName: true } } }
  }) : [];
  response.json({ members });
});

router.get('/invitations', requireAuth, requireOrganization, requireRoles('ADMIN'), async (request, response) => {
  const auth = getAuth(request);
  const invitations = auth?.organizationId ? await prisma.invitation.findMany({
    where: { organizationId: auth.organizationId, acceptedAt: null },
    orderBy: { createdAt: 'desc' },
    select: { id: true, email: true, role: true, expiresAt: true, createdAt: true }
  }) : [];
  response.json({ invitations });
});

router.post('/invitations', requireAuth, requireOrganization, requireRoles('ADMIN'), async (request, response) => {
  const auth = getAuth(request);
  const input = invitationSchema.parse(request.body);
  if (!auth?.organizationId) {
    response.status(400).json({ error: { code: 'ORGANIZATION_CONTEXT_REQUIRED', message: 'An organization context is required.' } });
    return;
  }
  const email = input.email.toLowerCase();
  const existingMember = await prisma.organizationMember.findFirst({ where: { organizationId: auth.organizationId, user: { email } } });
  if (existingMember) {
    response.status(409).json({ error: { code: 'ALREADY_A_MEMBER', message: 'This email already belongs to an organization member.' } });
    return;
  }
  const rawToken = randomBytes(32).toString('base64url');
  const invitation = await prisma.$transaction(async (tx) => {
    await tx.invitation.updateMany({ where: { organizationId: auth.organizationId!, email, acceptedAt: null }, data: { expiresAt: new Date() } });
    const created = await tx.invitation.create({ data: { organizationId: auth.organizationId!, email, role: input.role, tokenHash: hashRefreshToken(rawToken), expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7), invitedByUserId: auth.userId } });
    await tx.auditLog.create({ data: { organizationId: auth.organizationId!, actorUserId: auth.userId, entityType: 'Invitation', entityId: created.id, action: 'INVITATION_CREATED', metadata: { email, role: input.role } } });
    return created;
  });
  response.status(201).json({ invitation: { id: invitation.id, email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt }, invitationToken: rawToken });
});

router.patch('/members/:userId/role', requireAuth, requireOrganization, requireRoles('ADMIN'), async (request, response) => {
  const auth = getAuth(request);
  const targetUserId = routeParam(request, 'userId');
  const input = roleSchema.parse(request.body);
  if (!auth?.organizationId) {
    response.status(400).json({ error: { code: 'ORGANIZATION_CONTEXT_REQUIRED', message: 'An organization context is required.' } });
    return;
  }

  const target = await prisma.organizationMember.findUnique({
    where: { organizationId_userId: { organizationId: auth.organizationId, userId: targetUserId } }
  });
  if (!target) {
    response.status(404).json({ error: { code: 'MEMBER_NOT_FOUND', message: 'The user is not a member of this organization.' } });
    return;
  }
  if (target.role === 'ADMIN' && input.role !== 'ADMIN') {
    const adminCount = await prisma.organizationMember.count({ where: { organizationId: auth.organizationId, role: 'ADMIN' } });
    if (adminCount <= 1) {
      response.status(409).json({ error: { code: 'LAST_ADMIN', message: 'The organization must retain at least one administrator.' } });
      return;
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const member = await tx.organizationMember.update({
      where: { id: target.id },
      data: { role: input.role },
      select: { userId: true, role: true }
    });
    await tx.auditLog.create({
      data: {
        organizationId: auth.organizationId!,
        actorUserId: auth.userId,
        entityType: 'OrganizationMember',
        entityId: target.id,
        action: 'MEMBER_ROLE_CHANGED',
        metadata: { userId: targetUserId, before: target.role, after: input.role }
      }
    });
    return member;
  });

  response.json({ member: updated });
});

export { router as organizationRouter };
