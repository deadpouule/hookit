# hookit web

Next.js App Router UI for [hookit.fun](https://www.hookit.fun) — marketplace, launch wizard, token desk, and `/docs`.

## Scripts

```bash
npm install
npm run dev          # http://localhost:3000
npm run test:unit
npm run lint
npm run build
```

## Env

Copy `../.env.example` / `web/.env.local`. On Ink the UI hardcodes the live factories in `src/lib/contracts/config.ts` so a stale Vercel `NEXT_PUBLIC_LAUNCH_FACTORY` cannot silently launch onto an old vault.

Useful keys:

| Key | Role |
| --- | --- |
| `NEXT_PUBLIC_HOOKIT_CHAIN` | `ink` (prod) or `baseSepolia` |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Wallet connect |
| `INDEXER_URL` | House indexer, proxied at `/api/indexer/*` |

## Routes

| Path | Page |
| --- | --- |
| `/` | Marketplace |
| `/explore` | Hook catalog |
| `/launch` | Master / Classic picker |
| `/launch/custom` | Master wizard |
| `/launch/classic` | Bonding rail |
| `/token/[id]` | Token desk |
| `/docs` | Protocol docs (schemas, flywheel, formulas) |
| `/stats` | Protocol stats |
| `/terms` `/privacy` | Legal |

Stack: Next 16, Tailwind v4, wagmi / viem / RainbowKit, lightweight-charts, Framer Motion.
