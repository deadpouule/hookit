# Hookit indexer — Linode 1 GB (indexer only)

**Stack:** Vercel (web UI) + Linode Nanode 1 GB (~$5/mo) for the house indexer.

The indexer polls Ink via gel RPC and serves charts / trades / holders on `:8787`. Vercel proxies it through `/api/indexer/*` when `INDEXER_URL` points at your Linode.

## Linode spec

| | |
| --- | --- |
| Plan | **Nanode 1 GB** (1 vCPU, 25 GB disk) |
| OS | **Ubuntu 24.04 LTS** |
| Region | Closest to your users (e.g. US East if Vercel is iad1) |

## 1. Create the VPS

1. [Linode](https://cloud.linode.com) → **Create Linode** → Nanode 1 GB → Ubuntu 24.04.
2. Add your SSH key.
3. Note the **public IP**.
4. DNS: **A record** `indexer.yourdomain.com` → Linode IP (needed for TLS before Vercel can reach it).

## 2. Bootstrap (once, as root)

```bash
ssh root@YOUR_LINODE_IP

git clone https://github.com/deadpouule/hookit.git /opt/hookit
cd /opt/hookit
chmod +x deploy/linode/indexer-only/*.sh
./deploy/linode/indexer-only/bootstrap.sh

chown -R hookit:hookit /opt/hookit /var/lib/hookit-indexer
```

Bootstrap installs Node 22, nginx, certbot, creates `hookit` user, enables 512 MB swap (recommended on 1 GB), opens SSH + HTTP/HTTPS.

## 3. Environment

```bash
cp /opt/hookit/deploy/linode/indexer-only/env.example /opt/hookit/.env
chmod 600 /opt/hookit/.env
chown hookit:hookit /opt/hookit/.env
```

Fill in (from your Ink deploy / local `.env`):

| Variable | Example / notes |
| --- | --- |
| `LAUNCH_FACTORY` | Master factory on Ink |
| `BONDING_FACTORY` | Classic rail (optional) |
| `INDEXER_START_BLOCK` | Factory deploy block — **required** in prod (avoids 80k lookback) |
| `INK_RPC_URL` | `https://rpc-gel.inkonchain.com` |

## 4. Deploy indexer

```bash
sudo -u hookit /opt/hookit/deploy/linode/indexer-only/deploy.sh
systemctl enable --now hookit-indexer
```

Smoke test on the box:

```bash
curl -s http://127.0.0.1:8787/health | jq .
# expect: ok: true, tokens >= 0, lagBlocks reasonable
```

## 5. TLS + public URL

```bash
cp /opt/hookit/deploy/linode/indexer-only/nginx-indexer.conf /etc/nginx/sites-available/hookit-indexer.conf
nano /etc/nginx/sites-available/hookit-indexer.conf   # replace YOUR_DOMAIN
ln -sf /etc/nginx/sites-available/hookit-indexer.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
certbot --nginx -d indexer.yourdomain.com
```

Public check:

```bash
curl -s https://indexer.yourdomain.com/health | jq .
```

## 6. Wire Vercel

In **Vercel → Project → Settings → Environment Variables**:

| Name | Value |
| --- | --- |
| `INDEXER_URL` | `https://indexer.yourdomain.com` |

Redeploy Vercel (or push a commit). Token pages should show live charts/trades when the indexer has synced.

Verify from production:

```bash
curl -s https://YOUR_VERCEL_APP/api/indexer/health | jq .
```

## Updates

```bash
cd /opt/hookit
sudo -u hookit git pull
sudo -u hookit ./deploy/linode/indexer-only/deploy.sh
```

## Logs & ops

```bash
journalctl -u hookit-indexer -f
df -h /var/lib/hookit-indexer
free -h
```

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `tokens: 0` | Set `LAUNCH_FACTORY` + correct `INDEXER_START_BLOCK`; check `lastPollError` in `/health` |
| Rate limit / RPC errors | Raise `INDEXER_POLL_MS` to `12000`, keep `INDEXER_CHUNK=800` |
| OOM / swap thrashing | Nanode 1 GB is indexer-only — do **not** run Next.js or `forge` on this box; re-run bootstrap for swap |
| Vercel 503 indexer unreachable | Confirm HTTPS works publicly; `INDEXER_URL` has no trailing slash; firewall allows 443 |
| Slow first sync | Normal from `INDEXER_START_BLOCK` — watch `cursor` in `/health` |

## What stays on Vercel

- Next.js UI, wallet, launch flow
- `/api/indexer/*` proxy (server-side fetch to Linode)

Custom Solidity hook deploy stays **wallet-side** on Vercel — no `forge` on the 1 GB box.
