#!/usr/bin/env bash
# First-time Linode setup for Hookit (Ubuntu 22.04/24.04).
# Run as root: curl -fsSL ... | bash   OR   sudo ./bootstrap.sh
set -euo pipefail

HOOKIT_USER="${HOOKIT_USER:-hookit}"
HOOKIT_DIR="${HOOKIT_DIR:-/opt/hookit}"
DATA_DIR="${DATA_DIR:-/var/lib/hookit-indexer}"
NODE_MAJOR="${NODE_MAJOR:-22}"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root (sudo ./bootstrap.sh)" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

echo "[hookit] packages…"
apt-get update -qq
apt-get install -y -qq \
  ca-certificates curl git nginx certbot python3-certbot-nginx \
  build-essential pkg-config libssl-dev jq ufw

echo "[hookit] Node.js ${NODE_MAJOR}…"
if ! command -v node >/dev/null 2>&1 || [[ "$(node -p process.versions.node.split('.')[0])" -lt "$NODE_MAJOR" ]]; then
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
  apt-get install -y -qq nodejs
fi

echo "[hookit] Foundry (forge)…"
if ! command -v forge >/dev/null 2>&1; then
  su - "${SUDO_USER:-root}" -c 'curl -L https://foundry.paradigm.xyz | bash' || true
  # foundryup installs to ~/.foundry — link for all users
  FOUNDRY_BIN="/root/.foundry/bin"
  if [[ -n "${SUDO_USER:-}" && "${SUDO_USER}" != "root" ]]; then
    FOUNDRY_BIN="/home/${SUDO_USER}/.foundry/bin"
  fi
  if [[ -x "${FOUNDRY_BIN}/foundryup" ]]; then
    "${FOUNDRY_BIN}/foundryup"
    ln -sf "${FOUNDRY_BIN}/forge" /usr/local/bin/forge
    ln -sf "${FOUNDRY_BIN}/cast" /usr/local/bin/cast
    ln -sf "${FOUNDRY_BIN}/anvil" /usr/local/bin/anvil
  fi
fi

echo "[hookit] user ${HOOKIT_USER}…"
if ! id "${HOOKIT_USER}" &>/dev/null; then
  useradd --system --create-home --home-dir "/home/${HOOKIT_USER}" --shell /bin/bash "${HOOKIT_USER}"
fi

mkdir -p "${HOOKIT_DIR}" "${DATA_DIR}" /var/www/certbot
chown -R "${HOOKIT_USER}:${HOOKIT_USER}" "${DATA_DIR}"

echo "[hookit] firewall…"
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable || true

echo "[hookit] systemd units…"
install -m 644 "${HOOKIT_DIR}/deploy/linode/systemd/hookit-indexer.service" /etc/systemd/system/hookit-indexer.service 2>/dev/null || \
  echo "  (clone repo to ${HOOKIT_DIR} first, then re-run or copy units manually)"
install -m 644 "${HOOKIT_DIR}/deploy/linode/systemd/hookit-web.service" /etc/systemd/system/hookit-web.service 2>/dev/null || true
systemctl daemon-reload

cat <<EOF

Bootstrap done.

Next steps:
  1. Clone repo → ${HOOKIT_DIR}
     git clone git@github.com:YOUR_ORG/Hookit.git ${HOOKIT_DIR}
     chown -R ${HOOKIT_USER}:${HOOKIT_USER} ${HOOKIT_DIR}

  2. Env file
     cp ${HOOKIT_DIR}/deploy/linode/env.production.example ${HOOKIT_DIR}/.env
     chmod 600 ${HOOKIT_DIR}/.env
     # fill LAUNCH_FACTORY, INDEXER_START_BLOCK, PRIVATE_KEY (hook deploy), WC project id

  3. Install units (if skipped above)
     cp ${HOOKIT_DIR}/deploy/linode/systemd/*.service /etc/systemd/system/
     systemctl daemon-reload

  4. Deploy
     sudo -u ${HOOKIT_USER} ${HOOKIT_DIR}/deploy/linode/deploy.sh

  5. TLS + nginx
     cp ${HOOKIT_DIR}/deploy/linode/nginx/hookit.conf /etc/nginx/sites-available/hookit.conf
     # edit YOUR_DOMAIN
     ln -sf /etc/nginx/sites-available/hookit.conf /etc/nginx/sites-enabled/
     certbot --nginx -d YOUR_DOMAIN
     systemctl enable --now hookit-indexer hookit-web nginx

See deploy/linode/README.md for full checklist.

EOF
