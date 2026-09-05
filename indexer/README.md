# Hookit house indexer (Pons-grade: charts / recent trades / holders)

Backend-only. The Next.js front consumes these HTTP routes — no subgraph required.

## Quick start

```bash
cd indexer
cp .env.example .env   # optional local overrides
# Root .env supplies INK_RPC_URL, LAUNCH_FACTORY, BONDING_FACTORY
npm install
npm run serve          # polls chain + serves API on :8787
# Or from repo root:
# ./scripts/serve-indexer.sh
```

## Env

| Var | Required | Notes |
| --- | --- | --- |
| `LAUNCH_FACTORY` | yes* | Master `LaunchFactory` |
| `BONDING_FACTORY` | no | Classic rail when deployed |
| `INK_RPC_URL` | no | Primary RPC — default `https://rpc-gel.inkonchain.com` |
| `INK_RPC_URL_BACKUP` | no | Fallback RPC — default `https://rpc-qnd.inkonchain.com` |
| `INDEXER_RPC_URLS` | no | Comma-separated list (overrides primary/backup) |
| `HOOKIT_CHAIN` | no | `ink` (default) or `baseSepolia` |
| `POOL_MANAGER` | no | Ink v4 PoolManager default baked in |
| `INDEXER_PORT` | no | default `8787` |
| `INDEXER_POLL_MS` | no | default `12000` |
| `INDEXER_CHUNK` | no | blocks per `getLogs` batch (default `800` on Ink, `2000` on Base Sepolia) |
| `INDEXER_CONFIRMATIONS` | no | reorg safety — index through `latest - N` (default `12`) |
| `INDEXER_START_BLOCK` | no | factory deploy block (recommended prod); else ~80k lookback |
| `INDEXER_DATA_DIR` | no | JSON store v2 directory |
| `INDEXER_EXCLUDE` | no | comma-separated addresses excluded from holder rankings |

\* At least one factory address.

## Store v2

- Trade dedupe via `(txHash, logIndex)`
- Bonding + pool prices normalized to quote-per-token
- `launchIdToToken` cache (no N× contract reads per bonding trade)
- Master `LaunchConfigured` bitmask indexed
- Classic bonding phase / `tokensSold` / graduation fields
- 24h volume / trades / change on token summary
- Batched block timestamps + chunked pool swap filters

## API (front wires here)

Base URL: `http://127.0.0.1:8787` (or `INDEXER_URL` behind the Next proxy).

```
GET /health
GET /v1/tokens
GET /v1/tokens/:address
GET /v1/tokens/:address/trades?limit=50&offset=0
GET /v1/tokens/:address/holders?limit=50
GET /v1/tokens/:address/candles?limit=200   # 5m OHLC
```

`/health` includes RPC lag (`lagBlocks`), last poll error, token count.

### Example trade

```json
{
  "id": "0x…-12",
  "txHash": "0x…",
  "logIndex": 12,
  "blockNumber": 123,
  "timestamp": 1710000000,
  "side": "buy",
  "quoteAmount": "100000000000000000",
  "tokenAmount": "…",
  "price": "0.00000014",
  "sqrtPriceX96": "…",
  "actor": "0x…"
}
```

## Next.js proxy

```
/api/indexer/health
/api/indexer/v1/tokens
/api/indexer/v1/tokens/:address
```

Set `INDEXER_URL=http://127.0.0.1:8787` in `web/.env.local`.

Client: `web/src/lib/indexer-client.ts` (`fetchIndexerTokens`, `fetchIndexerHealth`, …).

## Commands

```bash
npm run serve   # API + poll loop
npm run poll    # poll only
npm run tick    # one indexing pass
npm run typecheck
```
