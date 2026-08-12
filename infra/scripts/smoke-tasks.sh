#!/usr/bin/env bash
set -euo pipefail

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
password='ProofFlow-Task-Smoke-2026!'
suffix="$(openssl rand -hex 4)"
email="task-smoke-${suffix}@example.invalid"
org_id=''

cleanup() {
  if [ -n "$org_id" ]; then
    sudo -u postgres psql -d proofflow -c "DELETE FROM \"Organization\" WHERE id='${org_id}';" >/dev/null || true
  fi
}
trap cleanup EXIT

status="$(curl -sS -o "$tmpdir/register.json" -w '%{http_code}' -c "$tmpdir/cookies" -H 'Content-Type: application/json' -d "{\"email\":\"${email}\",\"password\":\"${password}\",\"displayName\":\"Task Smoke Admin\",\"organizationName\":\"Task Smoke Organization\"}" http://127.0.0.1/api/v1/auth/register)"
test "$status" = 201
token="$(jq -r '.accessToken' "$tmpdir/register.json")"
org_id="$(jq -r '.user.memberships[0].organizationId' "$tmpdir/register.json")"
user_id="$(jq -r '.user.id' "$tmpdir/register.json")"

status="$(curl -sS -o "$tmpdir/project.json" -w '%{http_code}' -H "Authorization: Bearer ${token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d '{"name":"Task Smoke Project","slug":"task-smoke-project"}' http://127.0.0.1/api/v1/projects)"
test "$status" = 201
project_id="$(jq -r '.project.id' "$tmpdir/project.json")"

status="$(curl -sS -o "$tmpdir/milestone.json" -w '%{http_code}' -H "Authorization: Bearer ${token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d '{"name":"Smoke Milestone"}' http://127.0.0.1/api/v1/projects/${project_id}/milestones)"
test "$status" = 201
milestone_id="$(jq -r '.milestone.id' "$tmpdir/milestone.json")"

status="$(curl -sS -o "$tmpdir/task1.json" -w '%{http_code}' -H "Authorization: Bearer ${token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d "{\"title\":\"Install smoke equipment\",\"milestoneId\":\"${milestone_id}\"}" http://127.0.0.1/api/v1/projects/${project_id}/tasks)"
test "$status" = 201
task1_id="$(jq -r '.task.id' "$tmpdir/task1.json")"

status="$(curl -sS -o "$tmpdir/task2.json" -w '%{http_code}' -H "Authorization: Bearer ${token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d '{"title":"Test smoke equipment"}' http://127.0.0.1/api/v1/projects/${project_id}/tasks)"
test "$status" = 201
task2_id="$(jq -r '.task.id' "$tmpdir/task2.json")"

status="$(curl -sS -o "$tmpdir/assignment.json" -w '%{http_code}' -H "Authorization: Bearer ${token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d "{\"userId\":\"${user_id}\"}" http://127.0.0.1/api/v1/projects/${project_id}/tasks/${task1_id}/assignments)"
test "$status" = 201

status="$(curl -sS -o "$tmpdir/assigned.json" -w '%{http_code}' -H "Authorization: Bearer ${token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d '{"to":"ASSIGNED"}' http://127.0.0.1/api/v1/projects/${project_id}/tasks/${task1_id}/transitions)"
test "$status" = 200
status="$(curl -sS -o "$tmpdir/in-progress.json" -w '%{http_code}' -H "Authorization: Bearer ${token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d '{"to":"IN_PROGRESS"}' http://127.0.0.1/api/v1/projects/${project_id}/tasks/${task1_id}/transitions)"
test "$status" = 200

status="$(curl -sS -o "$tmpdir/dependency.json" -w '%{http_code}' -H "Authorization: Bearer ${token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d "{\"predecessorId\":\"${task1_id}\"}" http://127.0.0.1/api/v1/projects/${project_id}/tasks/${task2_id}/dependencies)"
test "$status" = 201
status="$(curl -sS -o "$tmpdir/cycle.json" -w '%{http_code}' -H "Authorization: Bearer ${token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d "{\"predecessorId\":\"${task2_id}\"}" http://127.0.0.1/api/v1/projects/${project_id}/tasks/${task1_id}/dependencies)"
test "$status" = 409

status="$(curl -sS -o "$tmpdir/evidence-block.json" -w '%{http_code}' -H "Authorization: Bearer ${token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d '{"to":"EVIDENCE_SUBMITTED"}' http://127.0.0.1/api/v1/projects/${project_id}/tasks/${task1_id}/transitions)"
test "$status" = 409

status="$(curl -sS -o "$tmpdir/last-admin.json" -w '%{http_code}' -X PATCH -H "Authorization: Bearer ${token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d '{"role":"MANAGER"}' http://127.0.0.1/api/v1/organizations/members/${user_id}/role)"
test "$status" = 409

status="$(curl -sS -o "$tmpdir/tasks.json" -w '%{http_code}' -H "Authorization: Bearer ${token}" -H "X-Organization-Id: ${org_id}" http://127.0.0.1/api/v1/projects/${project_id}/tasks)"
test "$status" = 200

echo 'TASK_FOUNDATION_SMOKE=passed'
echo 'MILESTONE=201 TASKS=201 ASSIGNMENT=201 TRANSITIONS=200/200 DEPENDENCY=201 CYCLE=409 EVIDENCE_BLOCK=409 LAST_ADMIN=409 LIST=200'
