#!/usr/bin/env bash
set -euo pipefail

env_file="/srv/proofflow/shared/api.env"
jwt_secret="$(openssl rand -hex 48)"

if sudo grep -q '^JWT_ACCESS_SECRET=' "${env_file}"; then
  sudo sed -i "s#^JWT_ACCESS_SECRET=.*#JWT_ACCESS_SECRET=${jwt_secret}#" "${env_file}"
else
  printf 'JWT_ACCESS_SECRET=%s\n' "${jwt_secret}" | sudo tee -a "${env_file}" >/dev/null
fi

sudo chown root:root "${env_file}"
sudo chmod 600 "${env_file}"
echo 'JWT access secret configured'
