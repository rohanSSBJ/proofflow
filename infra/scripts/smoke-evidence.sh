#!/usr/bin/env bash
set -euo pipefail
trap 'echo "EVIDENCE_WORKFLOW_SMOKE=failed line=${LINENO}"' ERR

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
password='ProofFlow-Evidence-Smoke-2026!'
suffix="$(openssl rand -hex 4)"
admin_email="evidence-admin-${suffix}@example.invalid"
contributor_email="evidence-contributor-${suffix}@example.invalid"
org_id=''
contributor_id=''

cleanup() {
  if [ -n "$org_id" ]; then
    sudo -u postgres psql -d proofflow -c "DELETE FROM \"Organization\" WHERE id='${org_id}';" >/dev/null || true
  fi
  sudo -u postgres psql -d proofflow -c "DELETE FROM \"User\" WHERE email IN ('${admin_email}', '${contributor_email}');" >/dev/null || true
}
trap cleanup EXIT

status="$(curl -sS -o "$tmpdir/register.json" -w '%{http_code}' -H 'Content-Type: application/json' -d "{\"email\":\"${admin_email}\",\"password\":\"${password}\",\"displayName\":\"Evidence Admin\",\"organizationName\":\"Evidence Smoke Organization\"}" http://127.0.0.1/api/v1/auth/register)"
test "$status" = 201
admin_token="$(jq -r '.accessToken' "$tmpdir/register.json")"
org_id="$(jq -r '.user.memberships[0].organizationId' "$tmpdir/register.json")"

status="$(curl -sS -o "$tmpdir/invitation.json" -w '%{http_code}' -H "Authorization: Bearer ${admin_token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d "{\"email\":\"${contributor_email}\",\"role\":\"CONTRIBUTOR\"}" http://127.0.0.1/api/v1/organizations/invitations)"
test "$status" = 201
invite_token="$(jq -r '.invitationToken' "$tmpdir/invitation.json")"
test -n "$invite_token"

status="$(curl -sS -o "$tmpdir/invitations.json" -w '%{http_code}' -H "Authorization: Bearer ${admin_token}" -H "X-Organization-Id: ${org_id}" http://127.0.0.1/api/v1/organizations/invitations)"
test "$status" = 200

status="$(curl -sS -o "$tmpdir/accept.json" -w '%{http_code}' -H 'Content-Type: application/json' -d "{\"token\":\"${invite_token}\",\"password\":\"${password}\",\"displayName\":\"Evidence Contributor\"}" http://127.0.0.1/api/v1/auth/accept-invitation)"
test "$status" = 201
contributor_token="$(jq -r '.accessToken' "$tmpdir/accept.json")"
contributor_id="$(jq -r '.user.id' "$tmpdir/accept.json")"

status="$(curl -sS -o "$tmpdir/project.json" -w '%{http_code}' -H "Authorization: Bearer ${admin_token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d '{"name":"Evidence Smoke Project","slug":"evidence-smoke-project"}' http://127.0.0.1/api/v1/projects)"
test "$status" = 201
project_id="$(jq -r '.project.id' "$tmpdir/project.json")"

status="$(curl -sS -o "$tmpdir/task.json" -w '%{http_code}' -H "Authorization: Bearer ${admin_token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d '{"title":"Install evidence smoke item"}' http://127.0.0.1/api/v1/projects/${project_id}/tasks)"
test "$status" = 201
task_id="$(jq -r '.task.id' "$tmpdir/task.json")"

status="$(curl -sS -o "$tmpdir/assignment.json" -w '%{http_code}' -H "Authorization: Bearer ${admin_token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d "{\"userId\":\"${contributor_id}\"}" http://127.0.0.1/api/v1/projects/${project_id}/tasks/${task_id}/assignments)"
test "$status" = 201

status="$(curl -sS -o "$tmpdir/assigned.json" -w '%{http_code}' -H "Authorization: Bearer ${admin_token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d '{"to":"ASSIGNED"}' http://127.0.0.1/api/v1/projects/${project_id}/tasks/${task_id}/transitions)"
test "$status" = 200

status="$(curl -sS -o "$tmpdir/in-progress.json" -w '%{http_code}' -H "Authorization: Bearer ${admin_token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d '{"to":"IN_PROGRESS"}' http://127.0.0.1/api/v1/projects/${project_id}/tasks/${task_id}/transitions)"
test "$status" = 200

status="$(curl -sS -o "$tmpdir/requirement.json" -w '%{http_code}' -H "Authorization: Bearer ${admin_token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d '{"label":"Installation photograph","mandatory":true,"minItems":1}' http://127.0.0.1/api/v1/projects/${project_id}/tasks/${task_id}/evidence-requirements)"
test "$status" = 201
requirement_id="$(jq -r '.requirement.id' "$tmpdir/requirement.json")"

status="$(curl -sS -o "$tmpdir/file1.json" -w '%{http_code}' -H "Authorization: Bearer ${contributor_token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d '{"originalName":"installation-1.jpg","contentType":"image/jpeg","byteSize":1024}' http://127.0.0.1/api/v1/projects/${project_id}/tasks/${task_id}/evidence)"
test "$status" = 201
file1_id="$(jq -r '.evidence.id' "$tmpdir/file1.json")"
file1_upload_url="$(jq -r '.upload.url' "$tmpdir/file1.json")"
head -c 1024 /dev/zero > "$tmpdir/file1.bin"
status="$(curl -sS -o /dev/null -w '%{http_code}' -X PUT -H 'Content-Type: image/jpeg' -H 'x-amz-server-side-encryption: AES256' --upload-file "$tmpdir/file1.bin" "$file1_upload_url")"
test "$status" = 200

status="$(curl -sS -o "$tmpdir/download.json" -w '%{http_code}' -H "Authorization: Bearer ${contributor_token}" -H "X-Organization-Id: ${org_id}" http://127.0.0.1/api/v1/projects/${project_id}/tasks/${task_id}/evidence/${file1_id}/download-url)"
test "$status" = 200
file1_download_url="$(jq -r '.download.url' "$tmpdir/download.json")"
curl -fsS -o "$tmpdir/file1-downloaded.bin" "$file1_download_url"
cmp "$tmpdir/file1.bin" "$tmpdir/file1-downloaded.bin"

status="$(curl -sS -o "$tmpdir/submission1.json" -w '%{http_code}' -H "Authorization: Bearer ${contributor_token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d "{\"notes\":\"First evidence revision\",\"items\":[{\"evidenceFileId\":\"${file1_id}\",\"requirementId\":\"${requirement_id}\"}]}" http://127.0.0.1/api/v1/projects/${project_id}/tasks/${task_id}/submissions)"
test "$status" = 201
submission1_id="$(jq -r '.submission.id' "$tmpdir/submission1.json")"

status="$(curl -sS -o "$tmpdir/queue.json" -w '%{http_code}' -H "Authorization: Bearer ${admin_token}" -H "X-Organization-Id: ${org_id}" http://127.0.0.1/api/v1/reviews/queue)"
test "$status" = 200

status="$(curl -sS -o "$tmpdir/reject-no-reason.json" -w '%{http_code}' -H "Authorization: Bearer ${admin_token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d '{"decision":"REJECTED"}' http://127.0.0.1/api/v1/submissions/${submission1_id}/reviews)"
test "$status" = 400

status="$(curl -sS -o "$tmpdir/reject.json" -w '%{http_code}' -H "Authorization: Bearer ${admin_token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d '{"decision":"REJECTED","reason":"Photograph does not show the required installation context."}' http://127.0.0.1/api/v1/submissions/${submission1_id}/reviews)"
test "$status" = 201

status="$(curl -sS -o "$tmpdir/file2.json" -w '%{http_code}' -H "Authorization: Bearer ${contributor_token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d '{"originalName":"installation-2.jpg","contentType":"image/jpeg","byteSize":2048}' http://127.0.0.1/api/v1/projects/${project_id}/tasks/${task_id}/evidence)"
test "$status" = 201
file2_id="$(jq -r '.evidence.id' "$tmpdir/file2.json")"
file2_upload_url="$(jq -r '.upload.url' "$tmpdir/file2.json")"
head -c 2048 /dev/zero > "$tmpdir/file2.bin"
status="$(curl -sS -o /dev/null -w '%{http_code}' -X PUT -H 'Content-Type: image/jpeg' -H 'x-amz-server-side-encryption: AES256' --upload-file "$tmpdir/file2.bin" "$file2_upload_url")"
test "$status" = 200

status="$(curl -sS -o "$tmpdir/submission2.json" -w '%{http_code}' -H "Authorization: Bearer ${contributor_token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d "{\"notes\":\"Corrected evidence revision\",\"items\":[{\"evidenceFileId\":\"${file2_id}\",\"requirementId\":\"${requirement_id}\"}]}" http://127.0.0.1/api/v1/projects/${project_id}/tasks/${task_id}/submissions)"
test "$status" = 201
submission2_id="$(jq -r '.submission.id' "$tmpdir/submission2.json")"
revision2="$(jq -r '.submission.revision' "$tmpdir/submission2.json")"
test "$revision2" = 2

status="$(curl -sS -o "$tmpdir/approve.json" -w '%{http_code}' -H "Authorization: Bearer ${admin_token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d '{"decision":"APPROVED"}' http://127.0.0.1/api/v1/submissions/${submission2_id}/reviews)"
test "$status" = 201

status="$(curl -sS -o "$tmpdir/verify.json" -w '%{http_code}' -H "Authorization: Bearer ${admin_token}" -H "X-Organization-Id: ${org_id}" -H 'Content-Type: application/json' -d '{}' http://127.0.0.1/api/v1/submissions/${submission2_id}/verify)"
test "$status" = 200

echo 'EVIDENCE_WORKFLOW_SMOKE=passed'
echo 'INVITE=201 ACCEPT=201 REQUIREMENT=201 SUBMIT=201 REVIEW_QUEUE=200 REJECT_REASON=400 REJECT=201 RESUBMIT_REVISION=2 APPROVE=201 VERIFY=200'
