"use client";

import { useCallback, useRef, useState } from "react";
import { CheckCircle2, Code2, FileCode2, Upload, XCircle, AlertTriangle } from "lucide-react";

import { analyzeCustomHookSource } from "@/lib/custom-hook";
import { CUSTOM_HOOK_TEMPLATE } from "@/lib/hook-template";
import { cn } from "@/lib/utils";

type Props = {
  source: string;
  fileName: string;
  onChange: (patch: { source: string; fileName: string }) => void;
};

export function CustomHookEditor({ source, fileName, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const analysis = analyzeCustomHookSource(source);
  const lines = source ? source.split("\n") : [""];

  const loadFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".sol")) return;
      const text = await file.text();
      onChange({ source: text, fileName: file.name });
    },
    [onChange],
  );

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-base-blue/20 bg-base-blue/[0.06] px-4 py-3">
        <p className="text-sm text-zinc-200">Bring your own Uniswap v4 hook</p>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Paste or upload your <code className="text-zinc-400">.sol</code> file. Hookit compiles,
          mines a CREATE2 salt, and deploys from your wallet when you launch (server forge create
          is the fallback).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onChange({ source: CUSTOM_HOOK_TEMPLATE, fileName: "MyCustomHook.sol" })}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.07]"
        >
          <FileCode2 className="h-3.5 w-3.5" />
          Load starter template
        </button>
        {source && (
          <button
            type="button"
            onClick={() => onChange({ source: "", fileName: "" })}
            className="rounded-lg px-3 py-1.5 text-xs text-zinc-500 transition hover:text-zinc-300"
          >
            Clear
          </button>
        )}
        {fileName && (
          <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/40 px-2.5 py-1 font-mono text-[11px] text-zinc-400">
            <Code2 className="h-3 w-3" />
            {fileName}
          </span>
        )}
      </div>

      <div
        className={cn(
          "relative overflow-hidden rounded-xl border transition",
          dragOver ? "border-base-blue/50 ring-2 ring-base-blue/20" : "border-white/[0.08]",
          !analysis.valid && source ? "border-amber-500/30" : "",
          analysis.valid && source ? "border-emerald-500/25" : "",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) void loadFile(file);
        }}
      >
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-black/60 px-3 py-2">
          <span className="text-[11px] font-medium tracking-wide text-zinc-500 uppercase">
            Solidity
          </span>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
          >
            <Upload className="h-3 w-3" />
            Upload .sol
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".sol"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void loadFile(file);
            }}
          />
        </div>

        <div className="grid max-h-[360px] grid-cols-[auto_1fr] overflow-auto bg-[#0a0a0c] font-mono text-[12px] leading-5">
          <div
            aria-hidden
            className="select-none border-r border-white/[0.06] bg-black/40 px-3 py-3 text-right text-zinc-600"
          >
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <textarea
            value={source}
            onChange={(e) => onChange({ source: e.target.value, fileName: "" })}
            spellCheck={false}
            placeholder="// Paste your Uniswap v4 hook here…"
            className="min-h-[280px] w-full resize-y border-0 bg-transparent px-3 py-3 text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:ring-0"
          />
        </div>

        {dragOver && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-base-blue/10 backdrop-blur-[1px]">
            <p className="rounded-lg border border-base-blue/30 bg-black/80 px-4 py-2 text-sm text-zinc-200">
              Drop your .sol file
            </p>
          </div>
        )}
      </div>

      {source && (
        <div className="space-y-2 rounded-xl border border-white/[0.06] bg-black/30 px-3 py-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500">
            <span>{analysis.lineCount} lines</span>
            {analysis.contractName && (
              <span>
                Contract{" "}
                <span className="font-mono text-zinc-300">{analysis.contractName}</span>
              </span>
            )}
          </div>

          {analysis.errors.map((msg) => (
            <p key={msg} className="flex items-start gap-2 text-xs text-red-300/90">
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {msg}
            </p>
          ))}
          {analysis.warnings.map((msg) => (
            <p key={msg} className="flex items-start gap-2 text-xs text-amber-200/80">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {msg}
            </p>
          ))}
          {analysis.valid && (
            <p className="flex items-center gap-2 text-xs text-emerald-400/90">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Hook source looks valid — ready to deploy at launch
            </p>
          )}
        </div>
      )}
    </div>
  );
}
