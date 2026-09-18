# Security notice — secrets & repository hygiene

## If secrets were committed

The following files must **never** be tracked in Git:

- `.env`, `.env.*` (except `*.example` templates)
- `deploy/linode/indexer-only/env.production`
- `broadcast/` (Foundry deploy logs may contain private keys)

If any real `PRIVATE_KEY`, `FEE_KEEPER_PRIVATE_KEY`, RPC API keys, or Pinata JWTs were pushed:

1. **Rotate immediately** — generate new keys on Ink / Alchemy / DRPC / Pinata and revoke the old ones.
2. **Purge from Git history** (coordinate with all collaborators — force-push required):

```bash
# Install git-filter-repo once: pip install git-filter-repo  OR  brew install git-filter-repo

git filter-repo --invert-paths --path deploy/linode/indexer-only/env.production
git filter-repo --invert-paths --path-glob 'broadcast/**'

# Alternative: BFG Repo-Cleaner
# bfg --delete-files env.production
# bfg --delete-folders broadcast
```

3. **Force-push** the cleaned history and ask everyone to re-clone or reset:

```bash
git push origin --force --all
git push origin --force --tags
```

4. On Linode, recreate `/opt/hookit/.env` from `deploy/linode/indexer-only/env.example` (never from Git).

## Local checklist

```bash
# Nothing sensitive should appear:
git ls-files '*.env' '**/.env*' 'broadcast/'

# Production env on the server only:
cp deploy/linode/indexer-only/env.example /opt/hookit/.env
chmod 600 /opt/hookit/.env
```

## Retired arb keeper

The `hookit-arb-keeper` systemd timer is removed. Disable it on any live Linode:

```bash
sudo systemctl disable --now hookit-arb-keeper.timer hookit-arb-keeper.service
```

Swaps are routed via **BalancedAggregator** (user-initiated), not an internal keeper.
