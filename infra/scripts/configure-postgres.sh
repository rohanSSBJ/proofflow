#!/usr/bin/env bash
set -euo pipefail

db_name="proofflow"
db_role="proofflow_app"
db_password="$(openssl rand -hex 32)"

if sudo -u postgres psql -Atqc "SELECT 1 FROM pg_roles WHERE rolname='${db_role}'" | grep -q '^1$'; then
  sudo -u postgres psql \
    -c "ALTER ROLE ${db_role} PASSWORD '${db_password}';" >/dev/null
else
  sudo -u postgres psql \
    -c "CREATE ROLE ${db_role} LOGIN PASSWORD '${db_password}';" >/dev/null
fi

if ! sudo -u postgres psql -Atqc "SELECT 1 FROM pg_database WHERE datname='${db_name}'" | grep -q '^1$'; then
  sudo -u postgres createdb --owner="${db_role}" "${db_name}"
fi

sudo -u postgres psql --dbname="${db_name}" \
  -c "GRANT ALL ON SCHEMA public TO ${db_role};" >/dev/null

connection_string="postgresql://${db_role}:${db_password}@127.0.0.1:5432/${db_name}?schema=public"
printf '%s\n' \
  'NODE_ENV=production' \
  'PORT=3000' \
  'APP_ORIGIN=http://localhost' \
  "DATABASE_URL=${connection_string}" \
  | sudo tee /srv/proofflow/shared/api.env >/dev/null

sudo chown root:root /srv/proofflow/shared/api.env
sudo chmod 600 /srv/proofflow/shared/api.env

echo "PostgreSQL configured for ${db_name}"
