"use client";

import { useEffect, useState } from "react";

import { toast } from "@/lib/toast";

export type PriceAlertKind = "limit" | "stop";

export type PriceAlert = {
  id: string;
  token: string;
  ticker: string;
  kind: PriceAlertKind;
  /** Target spot in ETH per token */
  targetEth: number;
  createdAt: number;
  fired?: boolean;
};

const STORAGE_KEY = "hookit.priceAlerts.v1";

function readAll(): PriceAlert[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PriceAlert[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(alerts: PriceAlert[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(alerts));
}

export function listAlertsForToken(token: string): PriceAlert[] {
  const t = token.toLowerCase();
  return readAll().filter((a) => a.token === t && !a.fired);
}

export function addPriceAlert(input: Omit<PriceAlert, "id" | "createdAt" | "fired">) {
  const alerts = readAll();
  const next: PriceAlert = {
    ...input,
    token: input.token.toLowerCase(),
    id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    createdAt: Date.now(),
  };
  alerts.push(next);
  writeAll(alerts);
  return next;
}

export function removePriceAlert(id: string) {
  writeAll(readAll().filter((a) => a.id !== id));
}

/** Watch spot and fire toasts when limit/stop thresholds cross. */
export function usePriceAlertWatcher(token: string | undefined, spotEth: number | undefined) {
  useEffect(() => {
    if (!token || !spotEth || spotEth <= 0) return;
    const t = token.toLowerCase();
    const alerts = readAll();
    let changed = false;
    for (const alert of alerts) {
      if (alert.token !== t || alert.fired) continue;
      const hit =
        alert.kind === "limit"
          ? spotEth >= alert.targetEth
          : spotEth <= alert.targetEth;
      if (!hit) continue;
      alert.fired = true;
      changed = true;
      toast.success(
        `${alert.kind === "limit" ? "Limit" : "Stop"} hit · $${alert.ticker}`,
        `Spot ${spotEth.toExponential(3)} ETH crossed ${alert.targetEth.toExponential(3)}`,
      );
    }
    if (changed) writeAll(alerts);
  }, [token, spotEth]);
}

export function useTokenAlerts(token: string | undefined) {
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  useEffect(() => {
    if (!token) {
      setAlerts([]);
      return;
    }
    setAlerts(listAlertsForToken(token));
  }, [token]);

  return {
    alerts,
    refresh: () => setAlerts(token ? listAlertsForToken(token) : []),
    add: (kind: PriceAlertKind, targetEth: number, ticker: string) => {
      if (!token || !(targetEth > 0)) return;
      addPriceAlert({ token, ticker, kind, targetEth });
      setAlerts(listAlertsForToken(token));
      toast.info(`${kind === "limit" ? "Limit" : "Stop"} alert set`, `${targetEth.toExponential(4)} ETH`);
    },
    remove: (id: string) => {
      removePriceAlert(id);
      setAlerts(token ? listAlertsForToken(token) : []);
    },
  };
}
