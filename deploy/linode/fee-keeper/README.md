# Hookit fee keeper — daily protocol fee routing + TWAP HTST buyback

On the same Linode as the indexer. Permissionless on-chain calls; the keeper wallet only needs gas.

## What it does (every day)

1. `distribute(ETH)` → **20% opsTreasury** / **80% buybackEth**
2. `distributeToBuyback(wStock)` for each Quotrons stock with pending → USDG → same 20/80
3. `distribute(USDG)` if native USDG pending
4. Optional TWAP: spend up to `FEE_KEEPER_BUYBACK_MAX_WEI` from `buybackEth` via `HkitBuyback.execute` (buy + burn HTST)

## Setup

```bash
# On Linode (as root), after indexer is up:
chmod +x /opt/hookit/deploy/linode/fee-keeper/run.sh
install -m 644 /opt/hookit/deploy/linode/systemd/hookit-fee-keeper.service /etc/systemd/system/
install -m 644 /opt/hookit/deploy/linode/systemd/hookit-fee-keeper.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now hookit-fee-keeper.timer
```

Add to `/opt/hookit/.env` (chmod 600):

```bash
# Dedicated wallet recommended (gas only). Falls back to PRIVATE_KEY.
FEE_KEEPER_PRIVATE_KEY=0x...

PROTOCOL_DISTRIBUTOR=0x4149509d2293a61cb199E17227740eEBFADd30c6
HKIT_BUYBACK=0x3D68Cc2C71f3b146295c8D9C1A82B3591f24fcCB

# TWAP buyback slice (default 0.05 ETH/day). Set false to only route fees.
FEE_KEEPER_BUYBACK=true
FEE_KEEPER_BUYBACK_MAX_WEI=50000000000000000
FEE_KEEPER_BUYBACK_MIN_WEI=1000000000000
```

Fund the keeper address with a little ETH for gas.

## Manual run

```bash
sudo -u hookit /opt/hookit/deploy/linode/fee-keeper/run.sh
# or:
cd /opt/hookit/indexer && npm run fee-keeper
# dry-run:
sudo -u hookit env FEE_KEEPER_DRY_RUN=true /opt/hookit/deploy/linode/fee-keeper/run.sh
```

## Logs

```bash
journalctl -u hookit-fee-keeper -n 100 --no-pager
systemctl list-timers hookit-fee-keeper.timer
```

## Notes

- Routing fees daily is the important part; buyback can lag via TWAP cap.
- wStock flywheel lands **USDG** at `buybackExecutor` (not ETH). ETH buyback pot only grows from ETH-quoted protocol fees (and HTST creator→buyback path).
- Same flush logic as `script/FlushProtocolFeesInk.s.sol` (forge one-shot).
