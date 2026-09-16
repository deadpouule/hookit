/**
 * Shared chart chrome for lightweight-charts (Defined-style teal/red, subscript prices).
 */

export const TV_CHART_BG = "#050506";
export const TV_CHART_GRID = "#232327";
export const TV_CHART_SCALE_TEXT = "#7f7f88";
/** Same teal / red as Defined.fi (TradingView crypto defaults). */
export const TV_CANDLE_UP = "#26a69a";
export const TV_CANDLE_DOWN = "#ef5350";
export const TV_VOLUME_UP = "rgba(38, 166, 154, 0.55)";
export const TV_VOLUME_DOWN = "rgba(239, 83, 80, 0.55)";

function significant(n: number): string {
  return n.toLocaleString("en-US", { maximumSignificantDigits: 6 });
}

/**
 * Sub-cent prices as `0.0₃85495`: the subscript is the run of zeros after the
 * point, followed by the next `digits + 1` significant digits.
 */
export function formatTvPrice(value: number, digits = 4): string {
  if (!Number.isFinite(value)) return "-";
  if (value === 0) return "0";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 0.001) return sign + significant(abs);
  let zeros = -Math.floor(Math.log10(abs)) - 1;
  let mantissa = Math.round(abs * 10 ** (zeros + 1 + digits));
  if (mantissa >= 10 ** (digits + 1)) {
    zeros -= 1;
    mantissa = Math.round(abs * 10 ** (zeros + 1 + digits));
  }
  if (zeros < 0) return sign + significant(abs);
  const sub = String(zeros)
    .split("")
    .map((d) => "₀₁₂₃₄₅₆₇₈₉"[Number(d)])
    .join("");
  return `${sign}0.0${sub}${mantissa}`;
}
