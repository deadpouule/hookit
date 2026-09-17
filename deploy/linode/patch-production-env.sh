#!/usr/bin/env bash
# Patch /opt/hookit/.env with current deploy/ink/addresses.json + keeper key from PRIVATE_KEY.
# Run on Linode as root: bash /opt/hookit/deploy/linode/patch-production-env.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${HOOKIT_ENV:-${ROOT}/.env}"
MANIFEST="${ROOT}/deploy/ink/addresses.json"

if [[ ! -f "${MANIFEST}" ]]; then
  echo "Missing ${MANIFEST}" >&2
  exit 1
fi
if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Missing ${ENV_FILE}" >&2
  exit 1
fi

NATIVE_TOKEN="$(jq -r '.nativeToken.address' "${MANIFEST}")"
DIST="$(jq -r '.contracts.ProtocolRevenueDistributor' "${MANIFEST}")"
BUYBACK="$(jq -r '.contracts.HkitBuyback' "${MANIFEST}")"
ARB="$(jq -r '.contracts.MultiPairArbExecutor' "${MANIFEST}")"
FACTORY="$(jq -r '.contracts.LaunchFactory' "${MANIFEST}")"
BONDING="$(jq -r '.contracts.BondingLaunchFactory' "${MANIFEST}")"
ROUTER="$(jq -r '.contracts.HookitSwapRouter' "${MANIFEST}")"
AGGREGATOR="$(jq -r '.contracts.BalancedAggregator' "${MANIFEST}")"
START_BLOCK="$(jq -r '.indexer.startBlock // .deployBlock' "${MANIFEST}")"

upsert() {
  local key="$1" val="$2"
  if grep -q "^${key}=" "${ENV_FILE}"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "${ENV_FILE}"
  else
    echo "${key}=${val}" >> "${ENV_FILE}"
  fi
}

upsert NATIVE_TOKEN "${NATIVE_TOKEN}"
upsert PROTOCOL_DISTRIBUTOR "${DIST}"
upsert HKIT_BUYBACK "${BUYBACK}"
upsert MULTI_PAIR_ARB_EXECUTOR "${ARB}"
upsert LAUNCH_FACTORY "${FACTORY}"
upsert BONDING_FACTORY "${BONDING}"
upsert HOOKIT_SWAP_ROUTER "${ROUTER}"
upsert BALANCED_AGGREGATOR "${AGGREGATOR}"
upsert INDEXER_START_BLOCK "${START_BLOCK}"

# shellcheck disable=SC1090
set -a
source "${ENV_FILE}"
set +a
if [[ -z "${FEE_KEEPER_PRIVATE_KEY:-}" && -n "${PRIVATE_KEY:-}" ]]; then
  upsert FEE_KEEPER_PRIVATE_KEY "${PRIVATE_KEY}"
fi

# Validate keeper key format (systemd runs as hookit — key must be readable).
# shellcheck disable=SC1090
set -a
source "${ENV_FILE}"
set +a
KEY_RAW="${FEE_KEEPER_PRIVATE_KEY:-${PRIVATE_KEY:-}}"
KEY_RAW="${KEY_RAW//\"/}"
KEY_RAW="${KEY_RAW//\'/}"
if [[ -n "${KEY_RAW}" ]]; then
  if [[ ! "${KEY_RAW}" =~ ^(0x)?[0-9a-fA-F]{64}$ ]]; then
    echo "[patch] WARN: FEE_KEEPER_PRIVATE_KEY looks invalid (need 64 hex chars). Oracle keeper will simulate only." >&2
  else
    upsert FEE_KEEPER_PRIVATE_KEY "${KEY_RAW}"
  fi
else
  echo "[patch] WARN: no FEE_KEEPER_PRIVATE_KEY or PRIVATE_KEY — add one for live oracle/fee txs" >&2
fi

chmod 600 "${ENV_FILE}"
chown hookit:hookit "${ENV_FILE}" 2>/dev/null || true

echo "[patch] updated ${ENV_FILE}"
echo "[patch] NATIVE_TOKEN=${NATIVE_TOKEN}"
echo "[patch] PROTOCOL_DISTRIBUTOR=${DIST}"
echo "[patch] HKIT_BUYBACK=${BUYBACK}"
if command -v systemctl >/dev/null 2>&1; then
  systemctl restart hookit-indexer 2>/dev/null || true
  systemctl daemon-reload 2>/dev/null || true
  echo "[patch] restart timers: systemctl restart hookit-oracle-keeper hookit-fee-keeper (or wait for timers)"
fi
