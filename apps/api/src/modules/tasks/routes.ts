import express, { type Router } from 'express';
import { z } from 'zod';
import { getAuth, requireAuth, requireOrganization, requireRoles } from '../../http/auth.js';
import { prisma } from '../../platform/db.js';

const router: Router = express.Router();
const createMilestoneSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(4000).optional(),
  dueDate: z.coerce.date().optional()
});
const createTaskSchema = z.object({
  title: z.string().trim().min(2).max(240),
  description: z.string().trim().max(8000).optional(),
  milestoneId: z.string().cuid().optional(),
  dueDate: z.coerce.date().optional(),
  weight: z.coerce.number().int().positive().max(1000).default(1)
});
const transitionSchema = z.object({
  to: z.enum(['DRAFT', 'ASSIGNED', 'IN_PROGRESS', 'EVIDENCE_SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'VERIFIED', 'REJECTED', 'CANCELLED', 'REOPENED']),
  reason: z.string().trim().min(5).max(1000).optional()
});
const dependencySchema = z.object({ predecessorId: z.string().cuid() });
const assignmentSchema = z.object({ userId: z.string().cuid() });

type ScopedAuth = { userId: string; organizationId: string; role: string };

function scopedAuth(request: express.Request) {
  return getAuth(request) as ScopedAuth;
}

function serializeTask<T>(task: T) {
  return task;
}

function routeParam(request: express.Request, name: string) {
  const value = request.params[name];
  return Array.isArray(value) ? value[0] : value ?? '';
}

async function projectFor(request: express.Request) {
  const auth = scopedAuth(request);
  return prisma.project.findFirst({ where: { id: routeParam(request, 'projectId'), organizationId: auth.organizationId } });
}

const transitionMap: Record<string, string[]> = {
  DRAFT: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['CANCELLED'],
  REJECTED: ['IN_PROGRESS', 'CANCELLED'],
  VERIFIED: ['REOPENED']
};

router.get('/projects/:projectId/tasks', requireAuth, requireOrganization, async (request, response) => {
  const auth = scopedAuth(request);
  const project = await projectFor(request);
  if (!project) {
    response.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'The project was not found in this organization.' } });
    return;
  }
  const tasks = await prisma.task.findMany({
    where: {
      organizationId: auth.organizationId,
      projectId: project.id,
      ...(auth.role === 'CONTRIBUTOR' ? { assignments: { some: { userId: auth.userId } } } : {})
    },
    orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    include: { assignments: { select: { userId: true, user: { select: { id: true, displayName: true, email: true } } } }, milestone: { select: { id: true, name: true } } }
  });
  response.json({ tasks: tasks.map(serializeTask) });
});

router.post('/projects/:projectId/milestones', requireAuth, requireOrganization, requireRoles('ADMIN', 'MANAGER'), async (request, response) => {
  const auth = scopedAuth(request);
  const project = await projectFor(request);
  if (!project) {
    response.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'The project was not found in this organization.' } });
    return;
  }
  const input = createMilestoneSchema.parse(request.body);
  const milestone = await prisma.$transaction(async (tx) => {
    const created = await tx.milestone.create({ data: { ...input, organizationId: auth.organizationId, projectId: project.id } });
    await tx.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, entityType: 'Milestone', entityId: created.id, action: 'MILESTONE_CREATED', metadata: { name: created.name } } });
    return created;
  });
  response.status(201).json({ milestone });
});

router.post('/projects/:projectId/tasks', requireAuth, requireOrganization, requireRoles('ADMIN', 'MANAGER'), async (request, response) => {
  const auth = scopedAuth(request);
  const project = await projectFor(request);
  if (!project) {
    response.status(404).json({ error: { code: 'PROJECT_NOT_FOUND', message: 'The project was not found in this organization.' } });
    return;
  }
  const input = createTaskSchema.parse(request.body);
  if (input.milestoneId) {
    const milestone = await prisma.milestone.findFirst({ where: { id: input.milestoneId, projectId: project.id, organizationId: auth.organizationId } });
    if (!milestone) {
      response.status(404).json({ error: { code: 'MILESTONE_NOT_FOUND', message: 'The milestone was not found in this project.' } });
      return;
    }
  }
  const task = await prisma.$transaction(async (tx) => {
    const created = await tx.task.create({ data: { ...input, organizationId: auth.organizationId, projectId: project.id } });
    await tx.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, entityType: 'Task', entityId: created.id, action: 'TASK_CREATED', metadata: { title: created.title } } });
    return created;
  });
  response.status(201).json({ task: serializeTask(task) });
});

router.post('/projects/:projectId/tasks/:taskId/assignments', requireAuth, requireOrganization, requireRoles('ADMIN', 'MANAGER'), async (request, response) => {
  const auth = scopedAuth(request);
  const project = await projectFor(request);
  const input = assignmentSchema.parse(request.body);
  const task = project ? await prisma.task.findFirst({ where: { id: routeParam(request, 'taskId'), projectId: project.id, organizationId: auth.organizationId } }) : null;
  if (!project || !task) {
    response.status(404).json({ error: { code: 'TASK_NOT_FOUND', message: 'The task was not found in this project.' } });
    return;
  }
  const member = await prisma.organizationMember.findUnique({ where: { organizationId_userId: { organizationId: auth.organizationId, userId: input.userId } } });
  if (!member) {
    response.status(404).json({ error: { code: 'MEMBER_NOT_FOUND', message: 'The assignee is not a member of this organization.' } });
    return;
  }
  const assignment = await prisma.$transaction(async (tx) => {
    await tx.projectMember.upsert({ where: { projectId_userId: { projectId: project.id, userId: input.userId } }, update: {}, create: { projectId: project.id, userId: input.userId } });
    const created = await tx.taskAssignment.upsert({ where: { taskId_userId: { taskId: task.id, userId: input.userId } }, update: {}, create: { taskId: task.id, userId: input.userId } });
    await tx.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, entityType: 'TaskAssignment', entityId: created.id, action: 'TASK_ASSIGNED', metadata: { taskId: task.id, userId: input.userId } } });
    return created;
  });
  response.status(201).json({ assignment });
});

router.post('/projects/:projectId/tasks/:taskId/dependencies', requireAuth, requireOrganization, requireRoles('ADMIN', 'MANAGER'), async (request, response) => {
  const auth = scopedAuth(request);
  const input = dependencySchema.parse(request.body);
  const project = await projectFor(request);
  const successor = project ? await prisma.task.findFirst({ where: { id: routeParam(request, 'taskId'), projectId: project.id, organizationId: auth.organizationId } }) : null;
  const predecessor = project ? await prisma.task.findFirst({ where: { id: input.predecessorId, projectId: project.id, organizationId: auth.organizationId } }) : null;
  if (!project || !successor || !predecessor) {
    response.status(404).json({ error: { code: 'TASK_NOT_FOUND', message: 'Both dependency tasks must belong to the same project.' } });
    return;
  }
  if (successor.id === predecessor.id) {
    response.status(409).json({ error: { code: 'DEPENDENCY_CYCLE', message: 'A task cannot depend on itself.' } });
    return;
  }
  const dependencies = await prisma.taskDependency.findMany({ where: { predecessor: { projectId: project.id, organizationId: auth.organizationId } }, select: { predecessorId: true, successorId: true } });
  const graph = new Map<string, string[]>();
  for (const dependency of dependencies) graph.set(dependency.predecessorId, [...(graph.get(dependency.predecessorId) ?? []), dependency.successorId]);
  graph.set(predecessor.id, [...(graph.get(predecessor.id) ?? []), successor.id]);
  const stack = [successor.id];
  const visited = new Set<string>();
  while (stack.length) {
    const current = stack.pop()!;
    if (current === predecessor.id) {
      response.status(409).json({ error: { code: 'DEPENDENCY_CYCLE', message: 'This dependency would create a cycle.' } });
      return;
    }
    if (!visited.has(current)) {
      visited.add(current);
      stack.push(...(graph.get(current) ?? []));
    }
  }
  try {
    const dependency = await prisma.$transaction(async (tx) => {
      const created = await tx.taskDependency.create({ data: { predecessorId: predecessor.id, successorId: successor.id } });
      await tx.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, entityType: 'TaskDependency', entityId: created.id, action: 'TASK_DEPENDENCY_CREATED', metadata: { predecessorId: predecessor.id, successorId: successor.id } } });
      return created;
    });
    response.status(201).json({ dependency });
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'P2002') {
      response.status(409).json({ error: { code: 'DEPENDENCY_EXISTS', message: 'This dependency already exists.' } });
      return;
    }
    throw error;
  }
});

router.post('/projects/:projectId/tasks/:taskId/transitions', requireAuth, requireOrganization, async (request, response) => {
  const auth = scopedAuth(request);
  const input = transitionSchema.parse(request.body);
  const project = await projectFor(request);
  const task = project ? await prisma.task.findFirst({
    where: { id: routeParam(request, 'taskId'), projectId: project.id, organizationId: auth.organizationId },
    select: { id: true, status: true, version: true, assignments: { select: { userId: true } } }
  }) : null;
  if (!project || !task) {
    response.status(404).json({ error: { code: 'TASK_NOT_FOUND', message: 'The task was not found in this project.' } });
    return;
  }
  if (input.to === 'EVIDENCE_SUBMITTED' || input.to === 'UNDER_REVIEW' || input.to === 'APPROVED' || input.to === 'VERIFIED') {
    response.status(409).json({ error: { code: 'EVIDENCE_WORKFLOW_REQUIRED', message: 'Evidence submission and review must be implemented before this transition is available.' } });
    return;
  }
  if (!transitionMap[task.status]?.includes(input.to)) {
    response.status(409).json({ error: { code: 'INVALID_TASK_TRANSITION', message: `Cannot transition a ${task.status} task to ${input.to}.` } });
    return;
  }
  const managerAction = auth.role === 'ADMIN' || auth.role === 'MANAGER';
  const assigned = task.assignments.some((assignment) => assignment.userId === auth.userId);
  if (input.to === 'ASSIGNED' && !managerAction) {
    response.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only managers can assign a task.' } });
    return;
  }
  if (!managerAction && !assigned) {
    response.status(403).json({ error: { code: 'TASK_NOT_ASSIGNED', message: 'You may only transition tasks assigned to you.' } });
    return;
  }
  if ((input.to === 'CANCELLED' || input.to === 'REOPENED') && !input.reason) {
    response.status(400).json({ error: { code: 'REASON_REQUIRED', message: 'A reason is required for cancellation or reopening.' } });
    return;
  }
  if (input.to === 'ASSIGNED' && task.assignments.length === 0) {
    response.status(409).json({ error: { code: 'ASSIGNEE_REQUIRED', message: 'Assign at least one organization member before assigning the task.' } });
    return;
  }
  const updated = await prisma.$transaction(async (tx) => {
    const changed = await tx.task.updateMany({ where: { id: task.id, organizationId: auth.organizationId, version: task.version }, data: { status: input.to, version: { increment: 1 } } });
    if (changed.count !== 1) throw new Error('TASK_VERSION_CONFLICT');
    const current = await tx.task.findUniqueOrThrow({ where: { id: task.id } });
    await tx.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, entityType: 'Task', entityId: task.id, action: 'TASK_TRANSITIONED', metadata: { before: task.status, after: input.to, reason: input.reason ?? null, version: current.version } } });
    return current;
  });
  response.json({ task: serializeTask(updated) });
});

export { router as taskRouter };
