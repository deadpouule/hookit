# Hookit on Linode (self-hosted)

## Recommended today: indexer only (1 GB) + Vercel web

**→ [deploy/linode/indexer-only/README.md](indexer-only/README.md)** — Nanode 1 GB (~$5/mo), charts/trades API, `INDEXER_URL` on Vercel.

Full stack on one VPS (web + indexer + optional server `forge`) is below if you outgrow Vercel.

---

Production stack on one VPS (all-in-one):

| Process | Port | Role |
| --- | --- | --- |
| **nginx** | 443 | TLS, reverse proxy |
| **hookit-web** | 3000 (local) | Next.js UI + `/api/hooks/deploy` (Foundry) |
| **hookit-indexer** | 8787 (local) | Ink poller + charts/trades API |

The web proxies indexer calls via `INDEXER_URL=http://127.0.0.1:8787` — do not expose 8787 publicly unless you add auth.

## Recommended Linode (pick a tier)

| Tier | RAM | ~Price | Good for |
| --- | --- | --- | --- |
| **Budget** | 2 GB | ~$12/mo | Web + indexer only; custom hooks via **wallet** (no server `forge`) |
| **Standard** | 4 GB | ~$24/mo | Same + **server-side** `/api/hooks/deploy` (`forge build` peaks ~2–3 GB) |
| **Not enough** | 1 GB | ~$5/mo | Indexer **alone** OK; web + indexer together will swap/OOM |

**Cheapest full stack:** Vercel (free/hobby) for the UI + **1 GB Nanode** (~$5/mo) for indexer only. Set `INDEXER_URL=https://indexer.yourdomain.com` on Vercel. Custom Solidity stays wallet-side or local — no `forge` on the VPS.

### 2 GB + server hook deploy (possible, tight)

Add swap so occasional `forge build` does not OOM:

```bash
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Compiles will be slow; do not run multiple hook deploys in parallel.

To **skip server forge entirely** on a 2 GB box, omit `PRIVATE_KEY` in `.env` — the launch UI uses wallet CREATE2 when available, or deploy hooks locally with Foundry.

## Standard Linode (4 GB — server forge comfortable)

- **Ubuntu 24.04 LTS**, 4 GB RAM / 2 vCPU
- Public gel RPC: `https://rpc-gel.inkonchain.com` (no Alchemy bill)

## 1. Bootstrap (once)

```bash
ssh root@YOUR_LINODE_IP

git clone git@github.com:YOUR_ORG/Hookit.git /opt/hookit
cd /opt/hookit
chmod +x deploy/linode/bootstrap.sh deploy/linode/deploy.sh
./deploy/linode/bootstrap.sh

useradd --system hookit 2>/dev/null || true
chown -R hookit:hookit /opt/hookit /var/lib/hookit-indexer
```

## 2. Environment

```bash
cp /opt/hookit/deploy/linode/env.production.example /opt/hookit/.env
chmod 600 /opt/hookit/.env
nano /opt/hookit/.env
```

Required before go-live:

| Variable | Notes |
| --- | --- |
| `LAUNCH_FACTORY` / `NEXT_PUBLIC_LAUNCH_FACTORY` | Ink deploy address |
| `BONDING_FACTORY` / `NEXT_PUBLIC_BONDING_FACTORY` | Classic rail |
| `NEXT_PUBLIC_HOOKIT_SWAP_ROUTER` | Required for swaps on Ink |
| `INDEXER_START_BLOCK` | Factory deploy block (avoid 80k lookback) |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Wallet modal |
| `PRIVATE_KEY` | **Hot wallet** for `/api/hooks/deploy` only — keep minimal Ink ETH |
| `INK_EXPLORER_API_KEY` | Optional verify after hook deploy |

`INDEXER_DATA_DIR=/var/lib/hookit-indexer` persists across redeploys.

## 3. systemd

```bash
cp /opt/hookit/deploy/linode/systemd/*.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable hookit-indexer hookit-web
```

## 4. First deploy

```bash
sudo -u hookit /opt/hookit/deploy/linode/deploy.sh
```

This runs `npm ci`, `forge build`, `next build` (standalone), copies static assets, restarts services.

## 5. nginx + TLS

```bash
cp /opt/hookit/deploy/linode/nginx/hookit.conf /etc/nginx/sites-available/hookit.conf
# Replace YOUR_DOMAIN with your DNS name (e.g. app.hookit.xyz)
nano /etc/nginx/sites-available/hookit.conf
ln -sf /etc/nginx/sites-available/hookit.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d YOUR_DOMAIN -d www.YOUR_DOMAIN
```

Point DNS **A record** → Linode IP.

## 6. Smoke test

```bash
curl -s http://127.0.0.1:8787/health | jq .
curl -sI http://127.0.0.1:3000/ | head -1
curl -sI https://YOUR_DOMAIN/ | head -1
```

From browser:

1. Marketplace loads launches (on-chain + indexer)
2. Token page — chart / trades if indexer synced
3. Launch → Custom Solidity → deploy hook (uses server `PRIVATE_KEY` + `forge`)

## Updates

```bash
cd /opt/hookit
sudo -u hookit git pull
sudo -u hookit ./deploy/linode/deploy.sh
```

## Logs

```bash
journalctl -u hookit-indexer -f
journalctl -u hookit-web -f
```

## Custom hook deploy security

- Use a **dedicated deployer key**, not your main treasury key
- Fund with ~0.05 Ink ETH for CREATE2 deploys
- `forge` + full repo must exist at `HOOKIT_REPO_ROOT` (default `/opt/hookit`)
- Route compiles in `src/generated/` — ephemeral, not committed

To disable server-side hook deploy, omit `PRIVATE_KEY` — UI falls back to wallet CREATE2 when configured.

## Vercel vs Linode

| | Vercel | Linode |
| --- | --- | --- |
| Web UI | ✅ | ✅ |
| Indexer | ❌ (needs separate host) | ✅ same box |
| Custom hook `forge` | ❌ | ✅ |
| `PRIVATE_KEY` on server | ❌ | ✅ (hot wallet) |

You can keep Vercel for static/marketing and point `INDEXER_URL` to Linode — or run everything on Linode.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Indexer `lastPollError` rate limit | Lower `INDEXER_CHUNK`, increase `INDEXER_POLL_MS` |
| `0 tokens` in health | Set `LAUNCH_FACTORY` + reset cursor / correct `INDEXER_START_BLOCK` |
| Hook deploy 503 | Set `PRIVATE_KEY`, run `forge build` manually as `hookit` user |
| 502 on `/api/hooks/deploy` | nginx `proxy_read_timeout` ≥ 200s (included in sample config) |
| Web 404 on assets | Re-run deploy.sh (copies `.next/static` into standalone) |

## Optional: PM2 instead of systemd

If you prefer PM2:

```bash
npm i -g pm2
cd /opt/hookit/indexer && pm2 start npm --name hookit-indexer -- run serve
cd /opt/hookit/web && HOOKIT_REPO_ROOT=/opt/hookit pm2 start .next/standalone/server.js --name hookit-web
pm2 save && pm2 startup
```

systemd is recommended for reboot persistence on Ubuntu.
