-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'VERIFIED');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "Invitation" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "OrganizationRole" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "invitedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceRequirement" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "minItems" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EvidenceFile" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "byteSize" INTEGER NOT NULL,
    "checksum" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Submission" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "notes" TEXT,
    "submittedById" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Submission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubmissionEvidence" (
    "submissionId" TEXT NOT NULL,
    "evidenceFileId" TEXT NOT NULL,
    "requirementId" TEXT,

    CONSTRAINT "SubmissionEvidence_pkey" PRIMARY KEY ("submissionId","evidenceFileId")
);

-- CreateTable
CREATE TABLE "EvidenceReview" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "submissionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "decision" "ReviewDecision" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EvidenceReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Invitation_tokenHash_key" ON "Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX "Invitation_organizationId_email_idx" ON "Invitation"("organizationId", "email");

-- CreateIndex
CREATE INDEX "Invitation_expiresAt_idx" ON "Invitation"("expiresAt");

-- CreateIndex
CREATE INDEX "EvidenceRequirement_organizationId_taskId_idx" ON "EvidenceRequirement"("organizationId", "taskId");

-- CreateIndex
CREATE INDEX "EvidenceFile_organizationId_taskId_createdAt_idx" ON "EvidenceFile"("organizationId", "taskId", "createdAt");

-- CreateIndex
CREATE INDEX "Submission_organizationId_status_createdAt_idx" ON "Submission"("organizationId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Submission_taskId_revision_key" ON "Submission"("taskId", "revision");

-- CreateIndex
CREATE INDEX "SubmissionEvidence_requirementId_idx" ON "SubmissionEvidence"("requirementId");

-- CreateIndex
CREATE INDEX "EvidenceReview_organizationId_createdAt_idx" ON "EvidenceReview"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "EvidenceReview_submissionId_createdAt_idx" ON "EvidenceReview"("submissionId", "createdAt");

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invitation" ADD CONSTRAINT "Invitation_invitedByUserId_fkey" FOREIGN KEY ("invitedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRequirement" ADD CONSTRAINT "EvidenceRequirement_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceRequirement" ADD CONSTRAINT "EvidenceRequirement_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFile" ADD CONSTRAINT "EvidenceFile_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFile" ADD CONSTRAINT "EvidenceFile_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceFile" ADD CONSTRAINT "EvidenceFile_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Submission" ADD CONSTRAINT "Submission_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionEvidence" ADD CONSTRAINT "SubmissionEvidence_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionEvidence" ADD CONSTRAINT "SubmissionEvidence_evidenceFileId_fkey" FOREIGN KEY ("evidenceFileId") REFERENCES "EvidenceFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubmissionEvidence" ADD CONSTRAINT "SubmissionEvidence_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "EvidenceRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceReview" ADD CONSTRAINT "EvidenceReview_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceReview" ADD CONSTRAINT "EvidenceReview_submissionId_fkey" FOREIGN KEY ("submissionId") REFERENCES "Submission"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EvidenceReview" ADD CONSTRAINT "EvidenceReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

