# ProofFlow implementation plan

This plan follows `docs/ARCHITECTURE.md` and keeps the first deployment small enough to verify safely.

## Task breakdown

### Phase 0 — deployment foundation

- [x] Create npm-workspace monorepo layout.
- [x] Add Express API with live/ready health endpoints.
- [x] Add React/Vite web shell that checks API health.
- [x] Add Phase 1 Prisma schema for users, organizations, projects, tasks, audit logs, and outbox events.
- [x] Add Nginx and systemd deployment templates.
- [x] Configure private PostgreSQL on EC2 and its protected `DATABASE_URL`.
- [x] Apply the initial Prisma migration and make readiness verify a real database query.
- [x] Configure the production JWT access-token secret; refresh sessions use hashed opaque tokens.
- [x] Deploy and smoke-test the foundation on EC2.

### Phase 1 — trustworthy task foundation

- [x] Add password authentication and rotating refresh sessions.
- [x] Add organization bootstrap, membership roles, organization listing, and active-tenant context.
- [x] Add the initial tenant-scoped project API with admin/manager authorization.
- [x] Add authentication, refresh, RBAC, and tenant-isolation smoke tests.
- [x] Add organization member listing and safe role-management endpoints.
- [x] Add milestone, task, assignment, dependency, and guarded transition APIs.
- [x] Add organization invitations and acceptance flow.
- [ ] Add durable integration tests for policy authorization and tenant isolation.
- [ ] Implement state-machine task transitions with atomic audit events.
- [x] Replace the foundation page with the ported ProofFlow marketing design and role-aware project/task views.

### Phase 2 — proof workflow

- [x] Add evidence requirements and validated evidence metadata records.
- [x] Add private S3 object storage, authorized presigned upload/download flow, and upload metadata verification.
- [ ] Add malware scanning and quarantine-to-accepted promotion.
- [x] Add immutable evidence records and submission revisions.
- [x] Add the initial review, rejection-reason, resubmission, and verification transactions.
- [x] Add the auditor review queue API plus contributor and auditor workflow views.
- [x] Test the complete assigned-to-verified API journey.
- [x] Add an Axios API client, in-memory access tokens, refresh-cookie rotation, active organization context, and TanStack Query server state.
- [x] Add real registration, login, invitation acceptance, member management, project/task planning, S3 evidence upload, submission, review, rejection, and verification screens.

### Phase 3 — operating controls

- [ ] Add comments, notifications, deadline jobs, and transactional outbox worker.
- [ ] Add expenses, quotations, invoices, payment proof, and budgets.
- [ ] Add dashboard metrics with transparent formulas.
- [ ] Add structured logs, metrics, backup verification, and restore runbook.

### Phase 4 — policy and assurance

- [ ] Add versioned rule DSL and deterministic rule evaluation snapshots.
- [ ] Add staged approvals, exceptions, compliance score, and audit reports.

### Phase 5 — hardening and scale

- [ ] Add malware scanning, SSO, optional realtime, and production restore drills.
- [ ] Scale only in response to measured workload or reliability pressure.

## Current release acceptance checks

- API listens on `127.0.0.1:3000`.
- Nginx serves the React build and proxies `/api/`.
- The web page visibly reports API health.
- The PEM file is ignored and is never copied to EC2.
- The initial Prisma migration is applied only after PostgreSQL connectivity is verified.

## Deployment status — 2026-08-13

- Release: `/srv/proofflow/releases/20260813005243`
- Active symlink: `/srv/proofflow/current`
- API service: `proofflow-api.service`, enabled and active under systemd
- Nginx: active and serving the React build on port 80
- PostgreSQL: local PostgreSQL 18, bound to `127.0.0.1:5432`; database and least-privilege application role configured
- Verified: direct API live/readiness checks, `/api` reverse-proxy readiness, web shell HTTP 200, and migration state
- Verified task foundation: milestone/task creation, assignment, guarded transitions, dependency-cycle rejection, evidence-transition blocking, and last-admin protection
- Verified proof workflow: invitation creation and acceptance, mandatory evidence requirements, rejection reason enforcement, revision resubmission, approval, and final verification
- Verified S3 workflow: EC2 IAM-role authentication, private presigned upload/download URLs, object round-trip integrity, size/type validation, and evidence submission gating on uploaded objects
- Verified frontend: ported ProofFlow visual system, real auth/session client, role-aware protected routes, project/task/member workflows, and evidence/review screens; root, login, and deep-link SPA routes return HTTP 200
- Not yet production-ready: TLS/domain, backup/restore validation, S3 CORS/domain configuration, malware scanning, durable browser integration tests, and the Phase 3/4 operating-control modules
- Smoke fixtures were removed after verification; no test users or organizations remain from the smoke runs

## Release database order

For each release that changes Prisma schema or client usage:

1. Install dependencies with `npm ci`.
2. Run `npm run db:generate`.
3. Run `npm run db:migrate` with the protected production environment.
4. Run `npm prune --omit=dev`.
5. Switch the `current` symlink and restart the API.
