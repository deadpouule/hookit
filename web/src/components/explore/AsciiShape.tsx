"use client";

import { useEffect, useMemo, useRef } from "react";

import type { HookTheme, MasterHookId } from "@/lib/master-hooks";

const RAMP = ".:-=+*#%@";

const SHAPES: Record<MasterHookId, string[]> = {
  "anti-snipe": [
    "      ################      ",
    "    ####################    ",
    "   ######################   ",
    "  ########################  ",
    "  ########################  ",
    "  ########################  ",
    "  ########################  ",
    "   ######################   ",
    "    ####################    ",
    "     ##################     ",
    "      ################      ",
    "       ##############       ",
    "        ############        ",
    "         ##########         ",
    "          ########          ",
    "           ######           ",
    "            ####            ",
    "             ##             ",
  ],
  "backed-floor": [
    "        ##############        ",
    "      ##################      ",
    "     ##                ##     ",
    "     ##   ##########   ##     ",
    "     ##   ##      ##   ##     ",
    "     ##   ##########   ##     ",
    "     ##                ##     ",
    "      ##################      ",
    "     ####################     ",
    "    ######################    ",
    "   ########################   ",
    "  ##########################  ",
  ],
  "anti-mev": [
    "         ########         ",
    "      ##############      ",
    "    ####          ####    ",
    "   ##                ##   ",
    "  ##     ##    ##     ##  ",
    "  ##      ##  ##      ##  ",
    "  ##       ####       ##  ",
    "  ##      ##  ##      ##  ",
    "  ##     ##    ##     ##  ",
    "   ##                ##   ",
    "    ####          ####    ",
    "      ##############      ",
    "         ########         ",
  ],
  "max-tx": [
    "  ##########################  ",
    "  ##                      ##  ",
    "  ##   ################   ##  ",
    "  ##                      ##  ",
    "  ##########################  ",
    "            ####              ",
    "            ####              ",
    "         ##########           ",
    "        ############          ",
    "       ##############         ",
  ],
  "max-wallet": [
    "    ########################  ",
    "   ##                    ##   ",
    "   ########################## ",
    "   ##                    ##   ",
    "   ##            ####    ##   ",
    "   ##            ####    ##   ",
    "   ##                    ##   ",
    "   ########################   ",
  ],
  "dynamic-fees": [
    " ##                      ##   ",
    "  ##        ##          ##    ",
    "   ##      ####        ##     ",
    "    ##    ##  ##      ##      ",
    "     ##  ##    ##    ##       ",
    "      ####      ##  ##        ",
    "       ##        ####         ",
    "      ##          ##          ",
    "     ##            ##         ",
    "    ##              ##        ",
  ],
  "buyback-vesting": [
    "  ##########################  ",
    "   ########################   ",
    "    ##                  ##    ",
    "     ##                ##     ",
    "      ##              ##      ",
    "       ##            ##       ",
    "        ##############        ",
    "       ##            ##       ",
    "      ##              ##      ",
    "     ##                ##     ",
    "    ##                  ##    ",
    "   ########################   ",
    "  ##########################  ",
  ],
  "auto-burn": [
    "             ##             ",
    "            ####            ",
    "           ######           ",
    "          ###  ###          ",
    "         ####  ####         ",
    "        #####  #####        ",
    "       ### ##  ## ###       ",
    "      ####      ######      ",
    "     #####      #######     ",
    "    ######      ########    ",
    "   ########    ##########   ",
    "  ########################  ",
    "   ######################   ",
    "    ####################    ",
    "     ##################     ",
  ],
  "lp-donate": [
    "       ########             ",
    "     ############           ",
    "    ###        ###          ",
    "   ##            ##  ####   ",
    "   ##            #########  ",
    "    ###        ############ ",
    "     ############        ## ",
    "       ########          ## ",
    "          ###            ## ",
    "           ###        ###   ",
    "            ############    ",
    "              ########      ",
  ],
};

function sampleField(nx: number, ny: number, t: number, speed: number) {
  const s = t * speed;
  const cx = 0.48 + 0.26 * Math.sin(s * 1.15);
  const cy = 0.42 + 0.24 * Math.cos(s * 0.92);
  const blob = Math.exp(-(Math.hypot(nx - cx, ny - cy) ** 2) * 5.4);
  const cx2 = 0.52 + 0.22 * Math.cos(s * 0.78);
  const cy2 = 0.58 + 0.2 * Math.sin(s * 1.05);
  const blob2 = Math.exp(-(Math.hypot(nx - cx2, ny - cy2) ** 2) * 7.2);
  const band = 0.5 + 0.5 * Math.sin(nx * 5.4 + ny * 3.6 - s * 3.2);
  const breathe = 0.58 + 0.42 * Math.sin(s * 1.25);
  return Math.min(1, Math.max(0, (blob * 0.82 + blob2 * 0.55 + band * 0.28) * breathe));
}

function renderFrame(mask: boolean[][], t: number, speed: number) {
  const rows = mask.length;
  const cols = mask[0]?.length ?? 0;
  const last = RAMP.length - 1;
  const out: string[] = [];

  for (let y = 0; y < rows; y++) {
    let line = "";
    for (let x = 0; x < cols; x++) {
      if (!mask[y][x]) {
        line += " ";
        continue;
      }
      const value = sampleField(x / cols, y / rows, t, speed);
      line += RAMP[Math.min(last, Math.floor(value * last))];
    }
    out.push(line);
  }

  return out.join("\n");
}

export function AsciiShape({
  hookId,
  theme,
  isHovered,
}: {
  hookId: MasterHookId;
  theme: HookTheme;
  isHovered: boolean;
}) {
  const template = useMemo(() => SHAPES[hookId], [hookId]);
  const mask = useMemo(
    () =>
      template.map((row) => {
        const width = Math.max(...template.map((line) => line.length));
        return Array.from(row.padEnd(width, " "), (char) => char !== " ");
      }),
    [template],
  );
  const preRef = useRef<HTMLPreElement>(null);
  const hoverRef = useRef(isHovered);
  hoverRef.current = isHovered;

  useEffect(() => {
    const node = preRef.current;
    if (!node) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    node.textContent = renderFrame(mask, 0, 1);
    if (reduce) return;

    let frame = 0;
    const tick = (now: number) => {
      const speed = hoverRef.current ? 3.4 : 1.55;
      node.textContent = renderFrame(mask, now / 1000, speed);
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [mask]);

  return (
    <pre
      ref={preRef}
      className={`ascii-shape ascii-shape--${theme}${isHovered ? " ascii-shape--hot" : ""}`}
      aria-hidden
    >
      {template.join("\n")}
    </pre>
  );
}
