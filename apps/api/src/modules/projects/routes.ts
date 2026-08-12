import express, { type Router } from 'express';
import { z } from 'zod';
import { getAuth, requireAuth, requireOrganization, requireRoles } from '../../http/auth.js';
import { prisma } from '../../platform/db.js';

const router: Router = express.Router();
const createProjectSchema = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(64),
  description: z.string().trim().max(4000).optional(),
  currency: z.string().trim().length(3).default('INR'),
  budgetMinor: z.coerce.bigint().nonnegative().optional(),
  dueDate: z.coerce.date().optional()
});

function serializeProject(project: { budgetMinor: bigint | null } & Record<string, unknown>) {
  return { ...project, budgetMinor: project.budgetMinor === null ? null : project.budgetMinor.toString() };
}

router.get('/', requireAuth, requireOrganization, async (request, response) => {
  const auth = getAuth(request) as { organizationId?: string } | undefined;
  const projects = await prisma.project.findMany({
    where: { organizationId: auth?.organizationId },
    orderBy: { createdAt: 'desc' },
    select: { id: true, organizationId: true, name: true, slug: true, description: true, currency: true, budgetMinor: true, dueDate: true, createdAt: true, updatedAt: true }
  });
  response.json({ projects: projects.map(serializeProject) });
});

router.post('/', requireAuth, requireOrganization, requireRoles('ADMIN', 'MANAGER'), async (request, response) => {
  const auth = getAuth(request) as { userId: string; organizationId?: string };
  const input = createProjectSchema.parse(request.body);
  if (!auth.organizationId) {
    response.status(400).json({ error: { code: 'ORGANIZATION_CONTEXT_REQUIRED', message: 'An organization context is required.' } });
    return;
  }
  try {
    const project = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({ data: { ...input, organizationId: auth.organizationId! } });
      await tx.projectMember.create({ data: { projectId: created.id, userId: auth.userId } });
      await tx.auditLog.create({
        data: {
          organizationId: auth.organizationId!,
          actorUserId: auth.userId,
          entityType: 'Project',
          entityId: created.id,
          action: 'PROJECT_CREATED',
          metadata: { name: created.name, slug: created.slug }
        }
      });
      return created;
    });
    response.status(201).json({ project: serializeProject(project) });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      response.status(409).json({ error: { code: 'PROJECT_SLUG_EXISTS', message: 'A project with this slug already exists in the organization.' } });
      return;
    }
    throw error;
  }
});

export { router as projectRouter };
