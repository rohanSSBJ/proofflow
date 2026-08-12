#!/usr/bin/env bash
set -euo pipefail

organization_count="$(sudo -u postgres psql -d proofflow -Atqc "SELECT count(*) FROM \"Organization\" WHERE name IN ('Smoke Organization One', 'Smoke Organization Two');")"
user_count="$(sudo -u postgres psql -d proofflow -Atqc "SELECT count(*) FROM \"User\" WHERE email LIKE 'smoke-%@example.invalid';")"
echo "SMOKE_ORGANIZATIONS=${organization_count} SMOKE_USERS=${user_count}"

if [ "${1:-}" != '--delete' ]; then
  echo "Pass --delete to remove only these named smoke-test fixtures."
  exit 0
fi

sudo -u postgres psql -d proofflow -v ON_ERROR_STOP=1 -c "DELETE FROM \"Organization\" WHERE name IN ('Smoke Organization One', 'Smoke Organization Two');" >/dev/null
sudo -u postgres psql -d proofflow -v ON_ERROR_STOP=1 -c "DELETE FROM \"User\" WHERE email LIKE 'smoke-%@example.invalid';" >/dev/null
echo 'SMOKE_FIXTURES_DELETED'
