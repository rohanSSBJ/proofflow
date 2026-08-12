import express, { type Router } from 'express';
import { z } from 'zod';
import { getAuth, requireAuth, requireOrganization, requireRoles } from '../../http/auth.js';
import { prisma } from '../../platform/db.js';
import { evidenceObjectKey, headEvidenceObject, presignEvidenceDownload, presignEvidenceUpload, storageUrlTtlSeconds } from '../../platform/storage.js';

const router: Router = express.Router();
const requirementSchema = z.object({ label: z.string().trim().min(2).max(200), description: z.string().trim().max(2000).optional(), mandatory: z.boolean().default(true), minItems: z.coerce.number().int().positive().max(20).default(1) });
const evidenceSchema = z.object({ originalName: z.string().trim().min(1).max(255), contentType: z.string().regex(/^[\w.-]+\/[\w.+-]+$/).max(120), byteSize: z.coerce.number().int().positive().max(25 * 1024 * 1024), checksum: z.string().trim().max(128).optional() });
const submissionSchema = z.object({ notes: z.string().trim().max(4000).optional(), items: z.array(z.object({ evidenceFileId: z.string().cuid(), requirementId: z.string().cuid().optional() })).min(1).max(100) });
const reviewSchema = z.object({ decision: z.enum(['APPROVED', 'REJECTED']), reason: z.string().trim().max(2000).optional() });

type ScopedAuth = { userId: string; organizationId: string; role: string };

function authFor(request: express.Request) {
  return getAuth(request) as ScopedAuth;
}

function param(request: express.Request, name: string) {
  const value = request.params[name];
  return Array.isArray(value) ? value[0] : value ?? '';
}

async function taskFor(request: express.Request) {
  const auth = authFor(request);
  return prisma.task.findFirst({ where: { id: param(request, 'taskId'), projectId: param(request, 'projectId'), organizationId: auth.organizationId }, include: { assignments: { select: { userId: true } } } });
}

function canWork(task: { assignments: { userId: string }[] }, auth: ScopedAuth) {
  return auth.role === 'ADMIN' || auth.role === 'MANAGER' || task.assignments.some((assignment) => assignment.userId === auth.userId);
}

router.get('/projects/:projectId/tasks/:taskId/evidence-requirements', requireAuth, requireOrganization, async (request, response) => {
  const task = await taskFor(request);
  if (!task) {
    response.status(404).json({ error: { code: 'TASK_NOT_FOUND', message: 'The task was not found in this project.' } });
    return;
  }
  const requirements = await prisma.evidenceRequirement.findMany({ where: { taskId: task.id }, orderBy: { createdAt: 'asc' } });
  response.json({ requirements });
});

router.post('/projects/:projectId/tasks/:taskId/evidence-requirements', requireAuth, requireOrganization, requireRoles('ADMIN', 'MANAGER'), async (request, response) => {
  const auth = authFor(request);
  const task = await taskFor(request);
  if (!task) {
    response.status(404).json({ error: { code: 'TASK_NOT_FOUND', message: 'The task was not found in this project.' } });
    return;
  }
  const input = requirementSchema.parse(request.body);
  const requirement = await prisma.$transaction(async (tx) => {
    const created = await tx.evidenceRequirement.create({ data: { ...input, organizationId: auth.organizationId, taskId: task.id } });
    await tx.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, entityType: 'EvidenceRequirement', entityId: created.id, action: 'EVIDENCE_REQUIREMENT_CREATED', metadata: { label: created.label, mandatory: created.mandatory, minItems: created.minItems } } });
    return created;
  });
  response.status(201).json({ requirement });
});

router.post('/projects/:projectId/tasks/:taskId/evidence', requireAuth, requireOrganization, async (request, response) => {
  const auth = authFor(request);
  const task = await taskFor(request);
  if (!task) {
    response.status(404).json({ error: { code: 'TASK_NOT_FOUND', message: 'The task was not found in this project.' } });
    return;
  }
  if (!canWork(task, auth)) {
    response.status(403).json({ error: { code: 'TASK_NOT_ASSIGNED', message: 'Evidence can only be added by an assigned contributor or manager.' } });
    return;
  }
  const input = evidenceSchema.parse(request.body);
  const objectKey = evidenceObjectKey({ organizationId: auth.organizationId, taskId: task.id, originalName: input.originalName });
  const uploadUrl = await presignEvidenceUpload({ objectKey, contentType: input.contentType });
  const evidence = await prisma.$transaction(async (tx) => {
    const created = await tx.evidenceFile.create({ data: { ...input, objectKey, organizationId: auth.organizationId, taskId: task.id, uploadedById: auth.userId } });
    await tx.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, entityType: 'EvidenceFile', entityId: created.id, action: 'EVIDENCE_METADATA_CREATED', metadata: { taskId: task.id, originalName: created.originalName, contentType: created.contentType, byteSize: created.byteSize } } });
    return created;
  });
  response.status(201).json({ evidence, upload: { method: 'PUT', url: uploadUrl, headers: { 'Content-Type': input.contentType, 'x-amz-server-side-encryption': 'AES256' }, expiresInSeconds: storageUrlTtlSeconds() } });
});

router.get('/projects/:projectId/tasks/:taskId/evidence/:evidenceId/download-url', requireAuth, requireOrganization, async (request, response) => {
  const auth = authFor(request);
  const task = await taskFor(request);
  if (!task) {
    response.status(404).json({ error: { code: 'TASK_NOT_FOUND', message: 'The task was not found in this project.' } });
    return;
  }
  if (!canWork(task, auth) && auth.role !== 'AUDITOR') {
    response.status(403).json({ error: { code: 'EVIDENCE_FORBIDDEN', message: 'You cannot access evidence for this task.' } });
    return;
  }
  const evidence = await prisma.evidenceFile.findFirst({ where: { id: param(request, 'evidenceId'), taskId: task.id, organizationId: auth.organizationId } });
  if (!evidence) {
    response.status(404).json({ error: { code: 'EVIDENCE_NOT_FOUND', message: 'The evidence file was not found for this task.' } });
    return;
  }
  try {
    await headEvidenceObject(evidence.objectKey);
  } catch {
    response.status(409).json({ error: { code: 'EVIDENCE_NOT_UPLOADED', message: 'The evidence upload has not completed.' } });
    return;
  }
  const downloadUrl = await presignEvidenceDownload(evidence.objectKey);
  response.json({ download: { method: 'GET', url: downloadUrl, expiresInSeconds: storageUrlTtlSeconds() }, evidence });
});

router.post('/projects/:projectId/tasks/:taskId/submissions', requireAuth, requireOrganization, async (request, response) => {
  const auth = authFor(request);
  const task = await taskFor(request);
  if (!task) {
    response.status(404).json({ error: { code: 'TASK_NOT_FOUND', message: 'The task was not found in this project.' } });
    return;
  }
  if (!canWork(task, auth)) {
    response.status(403).json({ error: { code: 'TASK_NOT_ASSIGNED', message: 'Only an assigned contributor or manager can submit evidence.' } });
    return;
  }
  if (task.status !== 'IN_PROGRESS' && task.status !== 'REJECTED') {
    response.status(409).json({ error: { code: 'INVALID_SUBMISSION_STATE', message: 'Evidence can only be submitted for in-progress or rejected tasks.' } });
    return;
  }
  const input = submissionSchema.parse(request.body);
  const fileIds = input.items.map((item) => item.evidenceFileId);
  if (new Set(fileIds).size !== fileIds.length) {
    response.status(400).json({ error: { code: 'DUPLICATE_EVIDENCE', message: 'An evidence file may only appear once in a submission.' } });
    return;
  }
  const [files, requirements] = await Promise.all([
    prisma.evidenceFile.findMany({ where: { id: { in: fileIds }, taskId: task.id, organizationId: auth.organizationId }, select: { id: true } }),
    prisma.evidenceRequirement.findMany({ where: { taskId: task.id, organizationId: auth.organizationId } })
  ]);
  if (files.length !== fileIds.length) {
    response.status(404).json({ error: { code: 'EVIDENCE_NOT_FOUND', message: 'Every evidence file must belong to this task and organization.' } });
    return;
  }
  const evidenceFiles = await prisma.evidenceFile.findMany({ where: { id: { in: fileIds }, taskId: task.id, organizationId: auth.organizationId } });
  try {
    const objects = await Promise.all(evidenceFiles.map((file) => headEvidenceObject(file.objectKey)));
    const mismatched = evidenceFiles.find((file, index) => objects[index].ContentLength !== file.byteSize || (objects[index].ContentType && objects[index].ContentType !== file.contentType));
    if (mismatched) {
      response.status(409).json({ error: { code: 'EVIDENCE_METADATA_MISMATCH', message: 'The uploaded object does not match the declared evidence metadata.' } });
      return;
    }
  } catch {
    response.status(409).json({ error: { code: 'EVIDENCE_NOT_UPLOADED', message: 'Every evidence file must be uploaded before submission.' } });
    return;
  }
  const requirementIds = new Set(requirements.map((requirement) => requirement.id));
  if (input.items.some((item) => item.requirementId && !requirementIds.has(item.requirementId))) {
    response.status(404).json({ error: { code: 'REQUIREMENT_NOT_FOUND', message: 'Every requirement must belong to this task.' } });
    return;
  }
  for (const requirement of requirements.filter((item) => item.mandatory)) {
    const count = input.items.filter((item) => item.requirementId === requirement.id).length;
    if (count < requirement.minItems) {
      response.status(400).json({ error: { code: 'MANDATORY_EVIDENCE_MISSING', message: `Requirement '${requirement.label}' needs at least ${requirement.minItems} evidence item(s).` } });
      return;
    }
  }
  const latest = await prisma.submission.findFirst({ where: { taskId: task.id }, orderBy: { revision: 'desc' }, select: { revision: true } });
  const submission = await prisma.$transaction(async (tx) => {
    const created = await tx.submission.create({ data: { organizationId: auth.organizationId, taskId: task.id, revision: (latest?.revision ?? 0) + 1, notes: input.notes, submittedById: auth.userId, items: { create: input.items.map((item) => ({ evidenceFileId: item.evidenceFileId, requirementId: item.requirementId })) } } });
    const changed = await tx.task.updateMany({ where: { id: task.id, version: task.version }, data: { status: 'EVIDENCE_SUBMITTED', version: { increment: 1 } } });
    if (changed.count !== 1) throw new Error('TASK_VERSION_CONFLICT');
    await tx.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, entityType: 'Submission', entityId: created.id, action: 'EVIDENCE_SUBMITTED', metadata: { taskId: task.id, revision: created.revision } } });
    return created;
  });
  response.status(201).json({ submission });
});

router.get('/reviews/queue', requireAuth, requireOrganization, requireRoles('ADMIN', 'MANAGER', 'AUDITOR'), async (request, response) => {
  const auth = authFor(request);
  const submissions = await prisma.submission.findMany({ where: { organizationId: auth.organizationId, status: 'SUBMITTED' }, orderBy: { submittedAt: 'asc' }, include: { task: { select: { id: true, title: true, projectId: true, dueDate: true } }, submittedBy: { select: { id: true, displayName: true, email: true } }, items: { include: { evidenceFile: true, requirement: true } } } });
  response.json({ submissions });
});

router.post('/submissions/:submissionId/reviews', requireAuth, requireOrganization, requireRoles('ADMIN', 'MANAGER', 'AUDITOR'), async (request, response) => {
  const auth = authFor(request);
  const input = reviewSchema.parse(request.body);
  const submission = await prisma.submission.findFirst({ where: { id: param(request, 'submissionId'), organizationId: auth.organizationId }, include: { task: true } });
  if (!submission) {
    response.status(404).json({ error: { code: 'SUBMISSION_NOT_FOUND', message: 'The submission was not found in this organization.' } });
    return;
  }
  if (submission.status !== 'SUBMITTED') {
    response.status(409).json({ error: { code: 'SUBMISSION_ALREADY_DECIDED', message: 'This submission already has a decision.' } });
    return;
  }
  if (input.decision === 'REJECTED' && !input.reason) {
    response.status(400).json({ error: { code: 'REJECTION_REASON_REQUIRED', message: 'A rejection must include an actionable reason.' } });
    return;
  }
  if (submission.submittedById === auth.userId) {
    response.status(409).json({ error: { code: 'SELF_REVIEW_FORBIDDEN', message: 'The submitter cannot review their own evidence.' } });
    return;
  }
  const result = await prisma.$transaction(async (tx) => {
    const review = await tx.evidenceReview.create({ data: { organizationId: auth.organizationId, submissionId: submission.id, reviewerId: auth.userId, decision: input.decision, reason: input.reason } });
    const submissionStatus = input.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    const taskStatus = input.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';
    await tx.submission.update({ where: { id: submission.id }, data: { status: submissionStatus } });
    await tx.task.update({ where: { id: submission.taskId }, data: { status: taskStatus, version: { increment: 1 } } });
    await tx.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, entityType: 'EvidenceReview', entityId: review.id, action: input.decision === 'APPROVED' ? 'EVIDENCE_APPROVED' : 'EVIDENCE_REJECTED', metadata: { submissionId: submission.id, reason: input.reason ?? null } } });
    return review;
  });
  response.status(201).json({ review: result, submissionStatus: input.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED' });
});

router.post('/submissions/:submissionId/verify', requireAuth, requireOrganization, requireRoles('ADMIN', 'AUDITOR'), async (request, response) => {
  const auth = authFor(request);
  const submission = await prisma.submission.findFirst({ where: { id: param(request, 'submissionId'), organizationId: auth.organizationId }, include: { task: true } });
  if (!submission) {
    response.status(404).json({ error: { code: 'SUBMISSION_NOT_FOUND', message: 'The submission was not found in this organization.' } });
    return;
  }
  if (submission.status !== 'APPROVED' || submission.task.status !== 'APPROVED') {
    response.status(409).json({ error: { code: 'SUBMISSION_NOT_APPROVED', message: 'Only an approved submission can be verified.' } });
    return;
  }
  const verified = await prisma.$transaction(async (tx) => {
    const updated = await tx.submission.update({ where: { id: submission.id }, data: { status: 'VERIFIED' } });
    await tx.task.update({ where: { id: submission.taskId }, data: { status: 'VERIFIED', version: { increment: 1 } } });
    await tx.auditLog.create({ data: { organizationId: auth.organizationId, actorUserId: auth.userId, entityType: 'Submission', entityId: submission.id, action: 'EVIDENCE_VERIFIED', metadata: { taskId: submission.taskId, revision: submission.revision } } });
    return updated;
  });
  response.json({ submission: verified });
});

export { router as evidenceRouter };
