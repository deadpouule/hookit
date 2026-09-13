#!/usr/bin/env bash
# Install HTST holder sync keeper (systemd timer + run script).
# Run on Linode as root after git pull:
#   sudo bash /opt/hookit/deploy/linode/hkt-sync/install.sh
set -euo pipefail

HOOKIT_DIR="${HOOKIT_DIR:-/opt/hookit}"
HOOKIT_USER="${HOOKIT_USER:-hookit}"

if [[ "${EUID:-$(id -u)}" -ne 0 ]]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

if [[ ! -f "${HOOKIT_DIR}/indexer/scripts/hkt-holder-sync-keeper.ts" ]]; then
  echo "Missing ${HOOKIT_DIR}/indexer/scripts/hkt-holder-sync-keeper.ts — git pull first" >&2
  exit 1
fi

chmod +x "${HOOKIT_DIR}/deploy/linode/hkt-sync/run.sh"
chown "${HOOKIT_USER}:${HOOKIT_USER}" "${HOOKIT_DIR}/deploy/linode/hkt-sync/run.sh"

install -m 644 "${HOOKIT_DIR}/deploy/linode/systemd/hookit-hkt-sync-keeper.service" /etc/systemd/system/
install -m 644 "${HOOKIT_DIR}/deploy/linode/systemd/hookit-hkt-sync-keeper.timer" /etc/systemd/system/

systemctl daemon-reload
systemctl enable --now hookit-hkt-sync-keeper.timer

echo "[hkt-sync] installed — timer active"
echo "  test: sudo -u ${HOOKIT_USER} ${HOOKIT_DIR}/deploy/linode/hkt-sync/run.sh"
echo "  logs: journalctl -u hookit-hkt-sync-keeper -f"
