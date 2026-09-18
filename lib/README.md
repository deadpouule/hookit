# Foundry dependencies

| Path | Source |
| --- | --- |
| `lib/forge-std` | Git submodule — [foundry-rs/forge-std](https://github.com/foundry-rs/forge-std) |
| `lib/v4-core` | **Vendored** copy of [Uniswap/v4-core](https://github.com/Uniswap/v4-core) (committed in-repo, not a submodule) |

After clone:

```bash
git submodule update --init lib/forge-std
```

Update vendored `v4-core` manually when bumping Uniswap dependencies; run `forge build` and the full test suite afterward.
