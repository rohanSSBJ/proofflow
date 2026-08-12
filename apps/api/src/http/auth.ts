import { createHash } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../platform/db.js';
import { accessTokenSecret } from '../platform/env.js';

export type AuthContext = {
  userId: string;
  organizationId?: string;
  role?: string;
};

type AuthenticatedRequest = Request & { auth?: AuthContext };

export function getAuth(request: Request) {
  return (request as AuthenticatedRequest).auth;
}

export function hashRefreshToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

export function requireAuth(request: Request, response: Response, next: NextFunction) {
  const header = request.header('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

  if (!token) {
    response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    return;
  }

  try {
    const payload = jwt.verify(token, accessTokenSecret());
    if (typeof payload === 'string' || payload.type !== 'access' || typeof payload.sub !== 'string') {
      throw new Error('Invalid access token');
    }
    (request as AuthenticatedRequest).auth = { userId: payload.sub };
    next();
  } catch {
    response.status(401).json({ error: { code: 'INVALID_ACCESS_TOKEN', message: 'The access token is invalid or expired.' } });
  }
}

export async function requireOrganization(request: Request, response: Response, next: NextFunction) {
  const auth = getAuth(request);
  if (!auth) {
    response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    return;
  }

  const memberships = await prisma.organizationMember.findMany({
    where: { userId: auth.userId },
    select: { organizationId: true, role: true }
  });
  const requestedOrganizationId = request.header('x-organization-id');
  const membership = requestedOrganizationId
    ? memberships.find((item) => item.organizationId === requestedOrganizationId)
    : memberships.length === 1 ? memberships[0] : undefined;

  if (!membership) {
    response.status(requestedOrganizationId ? 404 : 400).json({
      error: {
        code: requestedOrganizationId ? 'ORGANIZATION_NOT_FOUND' : 'ORGANIZATION_CONTEXT_REQUIRED',
        message: requestedOrganizationId
          ? 'The organization was not found for this user.'
          : 'Provide X-Organization-Id when the user belongs to multiple organizations.'
      }
    });
    return;
  }

  (request as AuthenticatedRequest).auth = { ...auth, organizationId: membership.organizationId, role: membership.role };
  next();
}

export function requireRoles(...roles: string[]) {
  return (request: Request, response: Response, next: NextFunction) => {
    const auth = getAuth(request) as (AuthContext & { role?: string }) | undefined;
    if (!auth || !auth.role || !roles.includes(auth.role)) {
      response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Your role cannot perform this action.' } });
      return;
    }
    next();
  };
}
