# Hookit smoke tests

## On-chain

```bash
cd web
npm run smoke:onchain
```

Uses Ink RPC + factory + quoter + indexer. No wallet needed.

Optional (test key only — never a hot wallet):

```bash
SMOKE_PRIVATE_KEY=0x... npm run smoke:onchain
```

## UI (Playwright)

```bash
cd web
npx playwright install chromium   # once
npm run smoke:ui                  # https://www.hookit.fun by default
SMOKE_BASE_URL=http://localhost:3000 npm run smoke:ui
npm run smoke:ui:headed           # watch the browser
```

Wallet connect / real swaps: run headed, connect MetaMask yourself when the Connect modal appears. Automated signing is intentionally not included.

## Both

```bash
npm run smoke
```
