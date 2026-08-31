"use client";

import { useMemo, type ReactNode } from "react";
import { formatUnits, zeroAddress, type Address } from "viem";
import { useReadContract } from "wagmi";

import { MasterHookAsciiIcon } from "@/components/home/market/MasterHookAsciiIcon";
import { MasterHookGlyph } from "@/components/home/market/CategoryGlyphs";
import { HookInlineAction } from "@/components/token/HookInlineActions";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { unpackLaunchBitmask } from "@/lib/bitmask";
import { getLaunchFactoryAddress, STABLE_QUOTE_ADDRESS } from "@/lib/contracts/config";
import { erc20Abi } from "@/lib/contracts/erc20-abi";
import { holderAirdropVaultAbi } from "@/lib/contracts/holder-airdrop-vault-abi";
import { launchFactoryAbi } from "@/lib/contracts/launch-factory-abi";
import { masterLaunchHookAbi } from "@/lib/contracts/master-launch-hook-abi";
import { floorVaultAbi } from "@/lib/contracts/swap-abi";
import {
  buildModulesSummarySentence,
  isModuleEnabled,
  moduleTooltipText,
} from "@/lib/launch-module-summary";
import { MASTER_HOOKS, type HookTheme, type MasterHookId } from "@/lib/master-hooks";
import { poolQuoteLabel } from "@/lib/payment-assets";
import { TOTAL_SUPPLY } from "@/lib/token-live";
import type { LaunchModules, TokenPool } from "@/lib/types";
import { cn } from "@/lib/utils";

const LAUNCH_SUPPLY_WEI = BigInt(TOTAL_SUPPLY) * 10n ** 18n;
const AIRDROP_EPOCH_SEC = 15 * 60;

function ModuleTip({ tip, children }: { tip: string; children: ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex cursor-help">{children}</span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        sideOffset={8}
        showArrow={false}
        className="max-w-[260px] border border-border bg-popover px-2.5 py-1.5 text-left text-[11px] leading-snug text-popover-foreground shadow-lg"
      >
        {tip}
      </TooltipContent>
    </Tooltip>
  );
}

function quoteDecimals(quote: Address): number {
  if (quote === zeroAddress) return 18;
  if (quote.toLowerCase() === STABLE_QUOTE_ADDRESS.toLowerCase()) return 6;
  return 18;
}

function resolveModules(pool: TokenPool): { modules: LaunchModules; hookTaxBps: number } | null {
  if (pool.modules) {
    return { modules: pool.modules, hookTaxBps: pool.hookTaxBps ?? 0 };
  }
  if (pool.bitmask) {
    try {
      return unpackLaunchBitmask(BigInt(pool.bitmask));
    } catch {
      return null;
    }
  }
  return null;
}

type LiveBits = {
  floorPriceHuman: number | null;
  floorReserveHuman: number | null;
  airdropPendingHuman: number | null;
  airdropSecondsLeft: number | null;
  burnedPct: number | null;
  quoteLabel: string;
};

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "Ready";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

function ModuleMeter({
  label,
  pct,
  theme,
  showValue = true,
}: {
  label: string;
  pct: number;
  theme: HookTheme;
  showValue?: boolean;
}) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="token-hooks-meter">
      <div className="token-hooks-meter-head">
        <span className="token-hooks-meter-label">{label}</span>
        {showValue ? <span className="token-hooks-meter-value">{Math.round(clamped)}%</span> : null}
      </div>
      <div className="token-hooks-meter-track" aria-hidden>
        <span
          className={cn("token-hooks-meter-fill", `token-hooks-meter-fill--${theme}`)}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

function ModuleVisualBar({
  id,
  modules,
  pool,
  live,
  theme,
}: {
  id: MasterHookId;
  modules: LaunchModules;
  pool: TokenPool;
  live: LiveBits;
  theme: HookTheme;
}) {
  switch (id) {
    case "anti-snipe": {
      if (!pool.launchedAt || modules.antiSnipeDuration <= 0) return null;
      const endsAt = pool.launchedAt + modules.antiSnipeDuration;
      const left = endsAt - Math.floor(Date.now() / 1000);
      if (left <= 0) return null;
      const elapsedPct =
        ((modules.antiSnipeDuration - left) / modules.antiSnipeDuration) * 100;
      return (
        <ModuleMeter
          label={`${left}s left · ${modules.antiSnipeInitialTax}% tax`}
          pct={elapsedPct}
          theme={theme}
        />
      );
    }
    case "auto-burn": {
      const pct = live.burnedPct ?? 0;
      return (
        <ModuleMeter
          label={`${pct.toFixed(2)}% of supply burned`}
          pct={pct}
          theme={theme}
        />
      );
    }
    case "holder-airdrop": {
      const left = live.airdropSecondsLeft;
      if (left == null) return null;
      const ready = left <= 0;
      const pct = ready ? 100 : ((AIRDROP_EPOCH_SEC - left) / AIRDROP_EPOCH_SEC) * 100;
      const pot =
        live.airdropPendingHuman != null
          ? `${live.airdropPendingHuman.toLocaleString(undefined, { maximumFractionDigits: 4 })} ${live.quoteLabel}`
          : "—";
      return (
        <ModuleMeter
          label={ready ? `Pot ${pot} · ready to drop` : `Pot ${pot} · ${formatCountdown(left)}`}
          pct={pct}
          theme={theme}
          showValue={!ready}
        />
      );
    }
    default:
      return null;
  }
}

export function ActiveHooksPanel({ pool }: { pool: TokenPool }) {
  const factory = getLaunchFactoryAddress();
  const isMaster = pool.rail === "master" && pool.hookType === "Master" && !pool.hooks.customHook;
  const resolved = useMemo(() => (isMaster ? resolveModules(pool) : null), [isMaster, pool]);

  const token = pool.contractAddress as Address | undefined;
  const quote = (pool.quoteAddress ?? zeroAddress) as Address;
  const quoteLabel = poolQuoteLabel(pool);
  const decimals = quoteDecimals(quote);

  const { data: masterHook } = useReadContract({
    address: factory,
    abi: launchFactoryAbi,
    functionName: "masterHook",
    query: { enabled: !!factory && isMaster },
  });

  const needFloor = Boolean(resolved?.modules.backedFloor);
  const needAirdrop = Boolean(resolved?.modules.holderAirdrop);
  const needBurn = Boolean(resolved?.modules.autoBurn);

  const { data: floorVault } = useReadContract({
    address: masterHook,
    abi: masterLaunchHookAbi,
    functionName: "floorVault",
    query: { enabled: !!masterHook && needFloor },
  });

  const { data: airdropVault } = useReadContract({
    address: masterHook,
    abi: masterLaunchHookAbi,
    functionName: "holderAirdropVault",
    query: { enabled: !!masterHook && needAirdrop },
  });

  const { data: floorPriceX18 } = useReadContract({
    address: floorVault as Address | undefined,
    abi: floorVaultAbi,
    functionName: "floorPriceX18",
    args: token ? [token] : undefined,
    query: { enabled: !!floorVault && !!token && needFloor, refetchInterval: 15_000 },
  });

  const { data: floorReserve } = useReadContract({
    address: floorVault as Address | undefined,
    abi: floorVaultAbi,
    functionName: "reserve",
    args: token ? [token] : undefined,
    query: { enabled: !!floorVault && !!token && needFloor, refetchInterval: 15_000 },
  });

  const { data: airdropReserve } = useReadContract({
    address: airdropVault as Address | undefined,
    abi: holderAirdropVaultAbi,
    functionName: "reserve",
    args: token ? [token] : undefined,
    query: { enabled: !!airdropVault && !!token && needAirdrop, refetchInterval: 12_000 },
  });

  const { data: airdropSeconds } = useReadContract({
    address: airdropVault as Address | undefined,
    abi: holderAirdropVaultAbi,
    functionName: "secondsUntilAirdrop",
    args: token ? [token] : undefined,
    query: { enabled: !!airdropVault && !!token && needAirdrop, refetchInterval: 5_000 },
  });

  const { data: totalSupply } = useReadContract({
    address: token,
    abi: erc20Abi,
    functionName: "totalSupply",
    query: { enabled: !!token && needBurn, refetchInterval: 20_000 },
  });

  if (!isMaster || !resolved) return null;

  const { modules, hookTaxBps } = resolved;
  const enabledHooks = MASTER_HOOKS.filter((hook) => isModuleEnabled(modules, hook.id));
  if (enabledHooks.length === 0 && hookTaxBps <= 0) return null;

  const burnedPct =
    totalSupply !== undefined && LAUNCH_SUPPLY_WEI > 0n
      ? Math.max(
          0,
          Math.min(
            100,
            Number(((LAUNCH_SUPPLY_WEI - (totalSupply as bigint)) * 10_000n) / LAUNCH_SUPPLY_WEI) /
              100,
          ),
        )
      : null;

  const live: LiveBits = {
    floorPriceHuman:
      floorPriceX18 !== undefined ? Number(formatUnits(floorPriceX18 as bigint, 18)) : null,
    floorReserveHuman:
      floorReserve !== undefined ? Number(formatUnits(floorReserve as bigint, decimals)) : null,
    airdropPendingHuman:
      airdropReserve !== undefined
        ? Number(formatUnits(airdropReserve as bigint, decimals))
        : null,
    airdropSecondsLeft: airdropSeconds !== undefined ? Number(airdropSeconds) : null,
    burnedPct,
    quoteLabel,
  };

  const floorReserveWei = (floorReserve as bigint | undefined) ?? BigInt(0);
  const summary = buildModulesSummarySentence(enabledHooks.map((h) => h.id));

  return (
    <section className="token-hooks-panel desk-card">
      <header className="token-hooks-head">
        <span className="token-type-badge token-type-badge--master token-hooks-master-badge">
          <MasterHookGlyph className="token-type-badge-glyph" />
          Master modules
        </span>
        <span className="token-hooks-count">
          {enabledHooks.length} module{enabledHooks.length === 1 ? "" : "s"}
        </span>
      </header>

      {summary ? (
        <p className="token-type-badge token-type-badge--master token-hooks-summary-badge">
          <MasterHookGlyph className="token-type-badge-glyph shrink-0" />
          <span>{summary}</span>
        </p>
      ) : null}

      <ul className="token-hooks-list">
        {enabledHooks.map((hook) => (
          <li key={hook.id} className={cn("token-hooks-row", `token-hooks-row--${hook.theme}`)}>
            <ModuleTip tip={moduleTooltipText(hook.description, hook.id, modules)}>
              <span
                className={cn(
                  "token-hooks-chip orb-hook-desc-badge",
                  `orb-hook-desc-badge--${hook.theme}`,
                )}
              >
                <MasterHookAsciiIcon hookId={hook.id} className="token-hooks-ascii" />
                <span>{hook.title}</span>
              </span>
            </ModuleTip>
            <ModuleVisualBar
              id={hook.id}
              modules={modules}
              pool={pool}
              live={live}
              theme={hook.theme}
            />
            <HookInlineAction
              id={hook.id}
              pool={pool}
              floorVault={floorVault as Address | undefined}
              floorReserveWei={floorReserveWei}
              decimals={decimals}
              floorPriceHuman={live.floorPriceHuman}
              quoteLabel={live.quoteLabel}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
