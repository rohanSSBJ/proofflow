#!/usr/bin/env bash
set -euo pipefail

release_dir="/srv/proofflow/current"
schema_path="${release_dir}/apps/api/prisma/schema.prisma.next"
output_path="/home/ubuntu/0003_invitation_evidence.sql"

cp /home/ubuntu/schema.prisma.next "${schema_path}"
sudo bash -lc "cd ${release_dir}; npm ci >/dev/null; set -a; . /srv/proofflow/shared/api.env; set +a; ./node_modules/.bin/prisma migrate diff --from-url \"\$DATABASE_URL\" --to-schema-datamodel ${schema_path} --script > ${output_path}; npm prune --omit=dev >/dev/null"
sudo chmod 600 "${output_path}"
echo "Generated ${output_path}"
