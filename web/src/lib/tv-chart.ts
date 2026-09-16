/**
 * Shared chart chrome for lightweight-charts (TradingView pro dark theme).
 */

export const TV_CHART_BG = "#060608";
export const TV_CHART_GRID = "rgba(255, 255, 255, 0.045)";
export const TV_CHART_SCALE_TEXT = "#8b8b96";
export const TV_CROSSHAIR = "rgba(255, 255, 255, 0.16)";
export const TV_CROSSHAIR_LABEL = "#1c1c1f";

/** TradingView crypto palette — crisp on OLED dark. */
export const TV_CANDLE_UP = "#2ebd85";
export const TV_CANDLE_DOWN = "#f6465d";
export const TV_VOLUME_UP = "rgba(46, 235, 133, 0.45)";
export const TV_VOLUME_DOWN = "rgba(246, 70, 93, 0.45)";

export function tvAreaGradient(up: boolean): { top: string; bottom: string; line: string } {
  if (up) {
    return {
      line: TV_CANDLE_UP,
      top: "rgba(46, 235, 133, 0.32)",
      bottom: "rgba(46, 235, 133, 0.02)",
    };
  }
  return {
    line: TV_CANDLE_DOWN,
    top: "rgba(246, 70, 93, 0.28)",
    bottom: "rgba(246, 70, 93, 0.02)",
  };
}

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
