#!/usr/bin/env bash
# Linode 1 GB — indexer-only bootstrap (no Foundry, no Next.js).
# Run as root after cloning repo to /opt/hookit.
set -euo pipefail

HOOKIT_USER="${HOOKIT_USER:-hookit}"
HOOKIT_DIR="${HOOKIT_DIR:-/opt/hookit}"
DATA_DIR="${DATA_DIR:-/var/lib/hookit-indexer}"
NODE_MAJOR="${NODE_MAJOR:-22}"
SWAP_MB="${SWAP_MB:-512}"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root (sudo ./bootstrap.sh)" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "[hookit-indexer] packages…"
apt-get update -qq
apt-get install -y -qq \
  ca-certificates curl git jq ufw nginx certbot python3-certbot-nginx

echo "[hookit-indexer] Node.js ${NODE_MAJOR}…"
need_node=false
if ! command -v node >/dev/null 2>&1; then
  need_node=true
elif [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt "${NODE_MAJOR}" ]]; then
  need_node=true
fi
if [[ "${need_node}" == true ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
fi

echo "[hookit-indexer] user ${HOOKIT_USER}…"
if ! id "${HOOKIT_USER}" &>/dev/null; then
  useradd --system --create-home --home-dir "/home/${HOOKIT_USER}" --shell /bin/bash "${HOOKIT_USER}"
fi

mkdir -p "${HOOKIT_DIR}" "${DATA_DIR}" /var/www/certbot
chown -R "${HOOKIT_USER}:${HOOKIT_USER}" "${DATA_DIR}"

if [[ ! -f /swapfile ]] && [[ "${SWAP_MB}" -gt 0 ]]; then
  echo "[hookit-indexer] ${SWAP_MB} MB swap (1 GB RAM safety net)…"
  fallocate -l "${SWAP_MB}M" /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

echo "[hookit-indexer] firewall…"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable || true

echo "[hookit-indexer] systemd…"
install -m 644 "${HOOKIT_DIR}/deploy/linode/systemd/hookit-indexer.service" /etc/systemd/system/hookit-indexer.service
systemctl daemon-reload

cat <<EOF

Indexer-only bootstrap done.

Next:
  1. chown -R ${HOOKIT_USER}:${HOOKIT_USER} ${HOOKIT_DIR}
  2. cp ${HOOKIT_DIR}/deploy/linode/indexer-only/env.example ${HOOKIT_DIR}/.env
     chmod 600 ${HOOKIT_DIR}/.env && chown ${HOOKIT_USER}:${HOOKIT_USER} ${HOOKIT_DIR}/.env
     nano ${HOOKIT_DIR}/.env
  3. sudo -u ${HOOKIT_USER} ${HOOKIT_DIR}/deploy/linode/indexer-only/deploy.sh
  4. systemctl enable --now hookit-indexer
  5. nginx + certbot — see deploy/linode/indexer-only/README.md

EOF
