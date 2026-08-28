"use client";

import type { PointerEvent } from "react";

import { formatCompactUsd } from "@/lib/format";
import {
  metricValue,
  type ChartMetric,
  type SeriesPoint,
} from "@/lib/protocol-stats";

const W = 920;
const AREA_H = 320;
const BAR_H = 280;
const PAD = { top: 18, right: 72, bottom: 32, left: 56 };

const CHART_BLUE = "#38bdf8";
const CHART_ORANGE = "#f97316";

function xAt(i: number, n: number) {
  return PAD.left + (i / Math.max(n - 1, 1)) * (W - PAD.left - PAD.right);
}

function yAt(value: number, min: number, max: number, height: number) {
  const span = Math.max(max - min, 0.001);
  return PAD.top + (1 - (value - min) / span) * (height - PAD.top - PAD.bottom);
}

function catmull(
  series: SeriesPoint[],
  min: number,
  max: number,
  height: number,
  metric: ChartMetric,
) {
  const pts = series.map((point, i) => ({
    x: xAt(i, series.length),
    y: yAt(metricValue(point, metric), min, max, height),
  }));
  if (pts.length === 0) return "";
  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return d;
}

function pointerIndex(event: PointerEvent<SVGSVGElement>, n: number) {
  const box = event.currentTarget.getBoundingClientRect();
  const x = ((event.clientX - box.left) / box.width) * W;
  const inner = W - PAD.left - PAD.right;
  return Math.min(n - 1, Math.max(0, Math.round(((x - PAD.left) / inner) * (n - 1))));
}

function yTicks(min: number, max: number) {
  return [max, min + (max - min) * 0.66, min + (max - min) * 0.33, min];
}

function axisLabels(series: SeriesPoint[]) {
  if (series.length === 0) return [];
  if (series.length < 5) {
    return series.map((point, i) => ({ i, label: point.label }));
  }
  const step = Math.max(1, Math.floor((series.length - 1) / 6));
  const indices = new Set<number>([0, series.length - 1]);
  for (let i = step; i < series.length - 1; i += step) {
    indices.add(i);
  }
  return [...indices]
    .sort((a, b) => a - b)
    .map((i) => ({ i, label: series[i]!.label }));
}

export function StatsAreaChart({
  series,
  active,
  metric,
  onHover,
}: {
  series: SeriesPoint[];
  active: number;
  metric: ChartMetric;
  onHover: (index: number) => void;
}) {
  const values = series.map((p) => metricValue(p, metric));
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  const line = catmull(series, min, max, AREA_H, metric);
  const x0 = xAt(0, series.length).toFixed(1);
  const xN = xAt(series.length - 1, series.length).toFixed(1);
  const base = (AREA_H - PAD.bottom).toFixed(1);
  const area = `${line} L ${xN} ${base} L ${x0} ${base} Z`;
  const point = series[active] ?? series[0];
  const value = metricValue(point ?? series[0]!, metric);
  const px = xAt(active, series.length);
  const py = yAt(value, min, max, AREA_H);
  const endValue = metricValue(series[series.length - 1] ?? series[0]!, metric);
  const endX = xAt(series.length - 1, series.length);
  const endY = yAt(endValue, min, max, AREA_H);
  const gradientId = `stats-area-fill-${metric}`;

  return (
    <svg
      className="stats-chart"
      viewBox={`0 0 ${W} ${AREA_H}`}
      role="img"
      aria-label="Cumulative protocol chart"
      onPointerMove={(event) => onHover(pointerIndex(event, series.length))}
      onPointerLeave={() => onHover(series.length - 1)}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CHART_BLUE} stopOpacity="0.38" />
          <stop offset="100%" stopColor={CHART_BLUE} stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks(min, max).map((tick) => {
        const y = yAt(tick, min, max, AREA_H);
        return (
          <g key={tick}>
            <text x={4} y={y + 3} className="stats-axis">
              {formatCompactUsd(tick)}
            </text>
          </g>
        );
      })}
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} className="stats-line stats-line-blue" />
      <line x1={px} x2={px} y1={PAD.top} y2={AREA_H - PAD.bottom} className="stats-cross" />
      <circle cx={px} cy={py} r="4" className="stats-dot stats-dot-blue" />
      {active === series.length - 1 ? (
        <g className="stats-end-label">
          <rect
            x={endX + 6}
            y={endY - 11}
            width={64}
            height={18}
            rx={4}
            className="stats-end-label-bg"
          />
          <text x={endX + 10} y={endY + 2} className="stats-end-label-text">
            {formatCompactUsd(endValue)}
          </text>
        </g>
      ) : null}
      {axisLabels(series).map(({ i, label }) => (
        <text key={`${label}-${i}`} x={xAt(i, series.length)} y={AREA_H - 8} className="stats-axis stats-axis-x">
          {label}
        </text>
      ))}
    </svg>
  );
}

export function StatsBarChart({
  series,
  active,
  onHover,
}: {
  series: SeriesPoint[];
  active: number;
  onHover: (index: number) => void;
}) {
  const max = Math.max(...series.flatMap((p) => [p.buybackUsd, p.burnUsd]), 1);
  const min = 0;
  const inner = W - PAD.left - PAD.right;
  const slot = inner / Math.max(series.length, 1);
  const barW = Math.max(2, Math.min(12, slot * 0.32));
  const avg = series.reduce((sum, p) => sum + p.buybackUsd, 0) / Math.max(series.length, 1);
  const avgY = yAt(avg, min, max, BAR_H);
  const step = series.length > 40 ? 14 : series.length > 16 ? 4 : 1;

  return (
    <svg
      className="stats-chart stats-bars"
      viewBox={`0 0 ${W} ${BAR_H}`}
      role="img"
      aria-label="Daily HOOK buyback and burn"
      onPointerMove={(event) => onHover(pointerIndex(event, series.length))}
      onPointerLeave={() => onHover(series.length - 1)}
    >
      {yTicks(min, max).map((tick) => (
        <text key={tick} x={4} y={yAt(tick, min, max, BAR_H) + 3} className="stats-axis">
          {formatCompactUsd(tick)}
        </text>
      ))}
      <line x1={PAD.left} x2={W - PAD.right} y1={avgY} y2={avgY} className="stats-avg" />
      <text x={W - PAD.right + 4} y={avgY + 3} className="stats-avg-label">
        avg/day {formatCompactUsd(avg)}
      </text>
      {series.map((point, i) => {
        const cx = PAD.left + slot * i + slot / 2;
        const buyH = (point.buybackUsd / max) * (BAR_H - PAD.top - PAD.bottom);
        const burnH = (point.burnUsd / max) * (BAR_H - PAD.top - PAD.bottom);
        const base = BAR_H - PAD.bottom;
        const lit = i === active;
        return (
          <g key={`${point.label}-${i}`} opacity={lit ? 1 : 0.72}>
            <rect
              x={cx - barW - 1}
              y={base - buyH}
              width={barW}
              height={buyH}
              rx="1.5"
              className="stats-bar-buy"
            />
            <rect
              x={cx + 1}
              y={base - burnH}
              width={barW}
              height={burnH}
              rx="1.5"
              className="stats-bar-burn"
            />
          </g>
        );
      })}
      {series.map((point, i) =>
        i % step === 0 || i === series.length - 1 ? (
          <text key={`x-${i}`} x={PAD.left + slot * i + slot / 2} y={BAR_H - 8} className="stats-axis stats-axis-x">
            {point.label}
          </text>
        ) : null,
      )}
    </svg>
  );
}
