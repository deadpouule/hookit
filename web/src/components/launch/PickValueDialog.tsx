"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function parseTypedNumber(raw: string): number | null {
  const cleaned = raw.replace(",", ".").replace(/[^\d.]/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n)) return null;
  return n;
}

function snapToStep(value: number, step: number): number {
  if (step <= 0) return value;
  const scaled = Math.round(value / step) * step;
  const decimals = String(step).includes(".") ? (String(step).split(".")[1]?.length ?? 0) : 0;
  return Number(scaled.toFixed(decimals));
}

export function PickValueDialog({
  open,
  onOpenChange,
  title,
  value,
  min,
  max,
  step = 1,
  suffix = "",
  onCommit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix?: string;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    if (open) setDraft(String(value));
  }, [open, value]);

  const commit = () => {
    const parsed = parseTypedNumber(draft);
    if (parsed == null) {
      onOpenChange(false);
      return;
    }
    const next = snapToStep(Math.min(max, Math.max(min, parsed)), step);
    onCommit(next);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[20rem] gap-3 p-4 sm:max-w-[20rem]" showCloseButton>
        <DialogHeader>
          <DialogTitle className="text-sm">{title}</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2">
          <input
            autoFocus
            className="field-input font-mono text-base md:text-sm"
            inputMode="decimal"
            pattern="^[0-9]*[.,]?[0-9]*$"
            autoComplete="off"
            value={draft}
            onChange={(e) => setDraft(e.target.value.replace(/[^\d.,]/g, ""))}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
            }}
          />
          {suffix ? <span className="shrink-0 text-sm font-medium text-zinc-400">{suffix}</span> : null}
        </div>
        <DialogFooter className="mx-0 mb-0 rounded-none border-0 bg-transparent p-0">
          <Button type="button" onClick={commit} className="w-full">
            Set
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
