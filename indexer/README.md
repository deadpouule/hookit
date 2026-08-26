# Hookit house indexer (Pons-grade: charts / recent trades / holders)

Backend-only. The Next.js front consumes these HTTP routes — no subgraph required.

## Quick start

```bash
cd indexer
cp .env.example .env   # set LAUNCH_FACTORY (+ optional BONDING_FACTORY)
npm install
npm run serve          # polls chain + serves API on :8787
```

## Env

| Var | Required | Notes |
| --- | --- | --- |
| `LAUNCH_FACTORY` | yes* | Master `LaunchFactory` |
| `BONDING_FACTORY` | no | Classic rail when deployed |
| `HOOKIT_CHAIN` | no | `ink` (default) or `baseSepolia` |
| `INK_RPC_URL` / `BASE_SEPOLIA_RPC_URL` | no | RPC |
| `INDEXER_PORT` | no | default `8787` |
| `INDEXER_POLL_MS` | no | default `12000` |
| `INDEXER_START_BLOCK` | no | 0 = look back ~80k blocks on first run |
| `INDEXER_DATA_DIR` | no | JSON store directory |

\* At least one factory address.

## API (front wires here)

Base URL: `http://127.0.0.1:8787` (or `INDEXER_URL` behind the Next proxy).

```
GET /health
GET /v1/tokens
GET /v1/tokens/:address
GET /v1/tokens/:address/trades?limit=50
GET /v1/tokens/:address/holders?limit=50
GET /v1/tokens/:address/candles?limit=200   # 5m OHLC, Pons-style chart
```

### Example trade

```json
{
  "txHash": "0x…",
  "blockNumber": 123,
  "timestamp": 1710000000,
  "side": "buy",
  "quoteAmount": "100000000000000000",
  "tokenAmount": "…",
  "price": "0.00000014",
  "sqrtPriceX96": "…"
}
```

### Example holder

```json
{ "address": "0x…", "balance": "…", "pct": 12.34 }
```

## Next.js proxy

With the indexer running, the web app exposes the same paths under:

```
/api/indexer/health
/api/indexer/v1/tokens
/api/indexer/v1/tokens/:address
/api/indexer/v1/tokens/:address/trades
/api/indexer/v1/tokens/:address/holders
/api/indexer/v1/tokens/:address/candles
```

Set `INDEXER_URL=http://127.0.0.1:8787` in `web/.env.local`.

## Precision

Intentionally approximate (good enough for launchpad UX): buy/sell side from swap deltas, holders from `Transfer` (includes PoolManager / lockers), candles are 5m buckets. Not Dexscreener-grade.
