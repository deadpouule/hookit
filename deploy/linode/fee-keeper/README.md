# Hookit fee keeper — daily protocol fee routing + TWAP HTST buyback

On the same Linode as the indexer. Permissionless on-chain calls; the keeper wallet only needs gas.

## What it does (every day)

1. Convert every pending Quotrons wStock claim to USDG with a simulation-derived slippage floor.
2. Hold consolidated USDG and ETH in the distributor while `FEE_KEEPER_DISTRIBUTE_REVENUE=false`.
3. Once the official protocol token and buyback sink are ready, route **20% opsTreasury** / **80% buyback**.
4. Optionally execute capped buyback-and-burn slices after that activation.

A separate 15-minute timer calls `syncEthUsdPrice()` on the active Master and Classic factories. On Ink, both
factories use the guarded 30-minute WETH/USDt0 Uniswap v3 TWAP feed at
`0x4b286359a4e5739D414aD00D6A320F93fF2b6092` (pool
`0x356667DA30C89cC36c65D394500424d5Eba8731c`). The feed rejects insufficient pool depth, observations older
than one hour, and spot/TWAP divergence above roughly 3%. The last successful sync remains the factory fallback.
If a sync reverts between simulation and execution, the keeper logs a warning and keeps the stored fallback.
The daily fee keeper does **not** sync the oracle by default (`FEE_KEEPER_SYNC_ORACLE=false`).

## Setup

```bash
# On Linode (as root), after indexer is up:
chmod +x /opt/hookit/deploy/linode/fee-keeper/run.sh
install -m 644 /opt/hookit/deploy/linode/systemd/hookit-fee-keeper.service /etc/systemd/system/
install -m 644 /opt/hookit/deploy/linode/systemd/hookit-fee-keeper.timer /etc/systemd/system/
install -m 644 /opt/hookit/deploy/linode/systemd/hookit-oracle-keeper.service /etc/systemd/system/
install -m 644 /opt/hookit/deploy/linode/systemd/hookit-oracle-keeper.timer /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now hookit-fee-keeper.timer
systemctl enable --now hookit-oracle-keeper.timer
```

Add to `/opt/hookit/.env` (chmod 600):

```bash
# Dedicated wallet recommended (gas only). Falls back to PRIVATE_KEY.
FEE_KEEPER_PRIVATE_KEY=0x...

PROTOCOL_DISTRIBUTOR=0xc724b1dadb0215a601c143fdec53152d8e61867f
HKIT_BUYBACK=0x64ce593c8678512097cd0d53f737c3621fb66e5d

# Keep routing/buyback disabled until the official protocol token is live.
FEE_KEEPER_DISTRIBUTE_REVENUE=false
FEE_KEEPER_BUYBACK=false
FEE_KEEPER_STOCK_SLIPPAGE_BPS=300

# Future buyback slice (default cap: 0.05 ETH/day).
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
journalctl -u hookit-oracle-keeper -n 100 --no-pager
systemctl list-timers hookit-fee-keeper.timer hookit-oracle-keeper.timer
```

## Notes

- Routing fees daily is the important part; buyback can lag via TWAP cap.
- wStock flywheel lands **USDG** at `buybackExecutor` (not ETH). ETH buyback pot only grows from ETH-quoted protocol fees (and HTST creator→buyback path).
- Same flush logic as `script/FlushProtocolFeesInk.s.sol` (forge one-shot).
