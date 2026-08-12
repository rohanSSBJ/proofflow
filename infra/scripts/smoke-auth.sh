#!/usr/bin/env bash
set -euo pipefail
trap 'echo "AUTH_RBAC_SMOKE=failed line=${LINENO}"' ERR

tmpdir="$(mktemp -d)"
trap 'rm -rf "$tmpdir"' EXIT
password='ProofFlow-Smoke-2026-Strong!'
suffix="$(openssl rand -hex 4)"
email1="smoke-admin-${suffix}@example.invalid"
email2="smoke-second-${suffix}@example.invalid"

status="$(curl -sS -o "$tmpdir/register1.json" -w '%{http_code}' -c "$tmpdir/cookies1" -H 'Content-Type: application/json' -d "{\"email\":\"${email1}\",\"password\":\"${password}\",\"displayName\":\"Smoke Admin\",\"organizationName\":\"Smoke Organization One\"}" http://127.0.0.1/api/v1/auth/register)"
if [ "$status" != 201 ]; then jq 'if .error then {error: .error} else {keys: keys} end' "$tmpdir/register1.json"; exit 1; fi
echo "REGISTER_ONE_STATUS=$status"
token1="$(jq -r '.accessToken' "$tmpdir/register1.json")"
org1="$(jq -r '.user.memberships[0].organizationId' "$tmpdir/register1.json")"
test -n "$token1"
test -n "$org1"

status="$(curl -sS -o "$tmpdir/me.json" -w '%{http_code}' -H "Authorization: Bearer ${token1}" http://127.0.0.1/api/v1/auth/me)"
test "$status" = 200
echo "ME_STATUS=$status"

status="$(curl -sS -o "$tmpdir/orgs.json" -w '%{http_code}' -H "Authorization: Bearer ${token1}" http://127.0.0.1/api/v1/organizations)"
test "$status" = 200
echo "ORGANIZATIONS_STATUS=$status"

status="$(curl -sS -o "$tmpdir/project.json" -w '%{http_code}' -H "Authorization: Bearer ${token1}" -H "X-Organization-Id: ${org1}" -H 'Content-Type: application/json' -d '{"name":"Smoke Project","slug":"smoke-project","description":"Temporary auth smoke project"}' http://127.0.0.1/api/v1/projects)"
if [ "$status" != 201 ]; then jq 'if .error then {error: .error} else {keys: keys} end' "$tmpdir/project.json"; exit 1; fi
echo "PROJECT_ONE_STATUS=$status"

status="$(curl -sS -o "$tmpdir/refresh.json" -w '%{http_code}' -b "$tmpdir/cookies1" -c "$tmpdir/cookies1" -X POST http://127.0.0.1/api/v1/auth/refresh)"
test "$status" = 200
echo "REFRESH_STATUS=$status"
token1="$(jq -r '.accessToken' "$tmpdir/refresh.json")"
test -n "$token1"

status="$(curl -sS -o "$tmpdir/register2.json" -w '%{http_code}' -c "$tmpdir/cookies2" -H 'Content-Type: application/json' -d "{\"email\":\"${email2}\",\"password\":\"${password}\",\"displayName\":\"Smoke Second\",\"organizationName\":\"Smoke Organization Two\"}" http://127.0.0.1/api/v1/auth/register)"
test "$status" = 201
echo "REGISTER_TWO_STATUS=$status"
token2="$(jq -r '.accessToken' "$tmpdir/register2.json")"
org2="$(jq -r '.user.memberships[0].organizationId' "$tmpdir/register2.json")"
test -n "$token2"
test -n "$org2"

status="$(curl -sS -o "$tmpdir/cross-tenant.json" -w '%{http_code}' -H "Authorization: Bearer ${token2}" -H "X-Organization-Id: ${org1}" http://127.0.0.1/api/v1/projects)"
test "$status" = 404
echo "CROSS_TENANT_STATUS=$status"

status="$(curl -sS -o "$tmpdir/unauthenticated.json" -w '%{http_code}' http://127.0.0.1/api/v1/projects)"
test "$status" = 401
echo "UNAUTHENTICATED_STATUS=$status"

status="$(curl -sS -o "$tmpdir/project2.json" -w '%{http_code}' -H "Authorization: Bearer ${token2}" -H "X-Organization-Id: ${org2}" -H 'Content-Type: application/json' -d '{"name":"Smoke Project Two","slug":"smoke-project-two"}' http://127.0.0.1/api/v1/projects)"
test "$status" = 201
echo "PROJECT_TWO_STATUS=$status"

echo 'AUTH_RBAC_SMOKE=passed'
echo 'REGISTER=201 ME=200 ORGANIZATIONS=200 PROJECT_CREATE=201 REFRESH=200 CROSS_TENANT=404 UNAUTHENTICATED=401'
