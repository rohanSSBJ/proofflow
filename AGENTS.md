# ProofFlow Agent Guide

## Purpose

ProofFlow is an evidence-based work, compliance, and audit platform. It combines project management, an evidence repository, and an approval system: a task is not complete merely because a user marks it complete; it becomes verified only after its required evidence is submitted and approved.

Primary users include companies, construction and government-funded projects, colleges, NGOs, procurement teams, ISO/compliance programs, internships, and audit teams.

## Product Model

### Roles

| Role | Responsibilities |
| --- | --- |
| Admin | Manages organization settings, members, and rules. |
| Manager | Creates projects, milestones, tasks, assignments, and budgets. |
| Contributor | Carries out work and submits evidence. |
| Auditor | Reviews evidence and approves or rejects it with reasons. |

### Core evidence workflow

`Assigned -> In Progress -> Evidence Submitted -> Under Review -> Approved / Rejected -> Verified`

A rejection must retain the reviewer’s reason and allow a new evidence submission. Do not overwrite historical submissions, reviews, approvals, or audit records.

Example: for "Install fire extinguishers on Floor 3", required evidence can include an invoice, photograph, and installation certificate. Evidence is submitted by the assigned contributor and verified by an auditor.

## Planned Scope

Build incrementally:

1. Authentication, organizations/workspaces, projects, milestones, and tasks.
2. RBAC, assignments, evidence uploads, evidence review, and approval workflow.
3. Expenses/procurement, notifications, comments, activity timeline, and audit logs.
4. Dashboard analytics, search/filtering, reports, deadline tracking, and a rule engine.
5. Optional realtime updates, email notifications, scheduled deadline jobs, cloud object storage, and production deployment.

Key modules: projects, milestones, tasks/subtasks, task dependencies, task assignments, evidence/documents, evidence reviews, comments, notifications, expenses, audit logs, reports, analytics, and compliance rules.

## Domain & Data Design

Use PostgreSQL with Prisma. Preserve organization tenancy on all organization-owned records and enforce authorization at service boundaries.

```text
User
 └─ OrganizationMember ─ Organization
      ├─ Project
      │   ├─ Milestone ─ Task
      │   │   ├─ TaskAssignment
      │   │   ├─ Evidence ─ EvidenceReview
      │   │   ├─ Comment
      │   │   └─ TaskDependency
      │   ├─ Expense
      │   └─ ProjectMember
      ├─ Notification
      └─ AuditLog
```

Prefer explicit relation tables where membership, assignment, review history, or metadata matters. Use transactions for state changes that create reviews, notifications, audit-log entries, or dependent records. Add indexes for organization/project foreign keys, status, due dates, assignee membership, and commonly filtered evidence/review fields.

The audit log should record actor, organization, entity type/id, action, timestamp, and relevant before/after metadata. Treat uploaded evidence as immutable revisions; store metadata and object-storage keys in PostgreSQL rather than binary files in the database.

## Rule Engine

Rules make ProofFlow more than a standard task board. An admin can define conditions and resulting evidence/approval requirements. Examples:

- Expense greater than INR 50,000: require manager approval, finance approval, invoice, and payment proof.
- Procurement task: require at least three quotations, a purchase invoice, and payment evidence.

Evaluate applicable rules when creating/updating relevant tasks, expenses, or evidence submissions. Persist the rule/version and the generated requirements used for a workflow so later rule edits do not rewrite history.

## Technology & Architecture

- Frontend: React, Tailwind CSS, Axios, React Router; TanStack Query and Recharts are recommended.
- Backend: Node.js, Express, Zod, Prisma ORM, PostgreSQL, JWT access tokens plus refresh tokens, and bcrypt or argon2.
- API style: REST. Validate request data with Zod before controllers/services; keep route handlers thin.

```text
React + Tailwind -> REST API -> Express routes -> Zod -> controllers -> services -> Prisma -> PostgreSQL
```

Use environment variables for every secret and deployment-specific URL. Never hard-code database credentials, JWT secrets, cloud-storage credentials, server IPs, or private-key paths in source code.

## Expected Monorepo Shape

The repository currently has no application source. When scaffolding it, prefer a structure similar to:

```text
apps/
  web/                  # React frontend
  api/                  # Express API and Prisma integration
packages/
  shared/               # shared types, schemas, utilities (optional)
infra/
  nginx/                # production Nginx configuration/templates
docs/
```

Keep frontend and API independently buildable/deployable. Do not import backend-only code into the frontend. Add root scripts for install, development, build, test, lint, database migration, and production start.

## Deployment Context: AWS EC2 + Nginx

Production target is an Ubuntu EC2 instance. Node.js is already installed. Nginx should serve the built React frontend and reverse-proxy `/api/` requests to the locally bound Express API. Bind the API to `127.0.0.1`, not a public interface, unless there is a deliberate reason to expose it.

SSH connection details (operational reference only; do not copy the key into the repository or logs):

```bash
ssh -i "proofflow.pem" ubuntu@ec2-13-218-222-35.compute-1.amazonaws.com
```

SSH access is restricted to the authorized IP. Keep the PEM file private, set restrictive file permissions where applicable, and ensure it is ignored by Git. Never display, commit, upload, or modify private-key contents.

Deployment checklist:

1. Provision PostgreSQL (managed RDS is preferred for production) and configure the production `DATABASE_URL`.
2. Configure API environment variables and run Prisma migrations safely.
3. Build the frontend and API; run the API under a process manager such as systemd or PM2.
4. Configure Nginx to serve the frontend, proxy `/api/` to the local API port, forward standard proxy headers, and support WebSockets if realtime features are enabled.
5. Obtain and renew TLS certificates (for example, Certbot); redirect HTTP to HTTPS.
6. Open only necessary security-group ports: 80/443 publicly and SSH (22) only from the authorized IP. Do not expose the API or database port publicly.
7. Verify health checks, migrations, uploads, refresh-token cookie settings, logs, and restart behavior after reboot.

Use separate `.env` files or a secure secret store per environment; only commit a redacted `.env.example`.

## Engineering Expectations

- Enforce RBAC and organization isolation on every API endpoint; never trust role or organization identifiers supplied by the client.
- Validate uploads by type, size, ownership, and required-evidence rules. Use private object storage with authorized download access in production.
- Use secure refresh-token storage/rotation and secure cookie settings when cookies are used (`HttpOnly`, `Secure`, appropriate `SameSite`).
- Return actionable validation/review errors. Rejected evidence must include the reason.
- Maintain tests for authorization, workflow transitions, rule evaluation, and tenant isolation.
- Avoid destructive schema/data commands in production. Back up PostgreSQL before material migrations.

## Demonstration Scenario

For an "IoT Innovation Lab" project (budget INR 800,000; deadline 31 March 2027), show milestones for requirements, procurement, installation, testing, and final audit. A procurement task can demonstrate three quotations, manager vendor approval, invoice and payment-proof submission, auditor verification, audit history, budget usage, evidence counts, deadlines, and compliance score.
