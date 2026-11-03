// Colour parsing for the gradient rule: any colour literal to a hue in degrees.

export type Hue = { hue: number; saturated: boolean };

function rgbToHue(r: number, g: number, b: number): Hue {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return { hue: 0, saturated: false };
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  const l = (max + min) / 2;
  const s = d / (1 - Math.abs(2 * l - 1));
  return { hue: h, saturated: s >= 0.15 };
}

function oklchToRgb(l: number, c: number, hDeg: number): [number, number, number] {
  const h = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(h);
  const b = c * Math.sin(h);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const lin = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ];
  const enc = (x: number) => {
    const v = Math.min(1, Math.max(0, x));
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
  };
  return [enc(lin[0]!), enc(lin[1]!), enc(lin[2]!)];
}

/** Hue of a hex, rgb(), hsl() or oklch() colour literal, or null when it is not one. */
export function hueOf(value: string): Hue | null {
  const v = value.trim();
  let m = /^#([0-9a-f]{3,8})$/i.exec(v);
  if (m) {
    let hex = m[1]!;
    if (hex.length === 3 || hex.length === 4) hex = [...hex].map((c) => c + c).join("");
    if (hex.length !== 6 && hex.length !== 8) return null;
    return rgbToHue(parseInt(hex.slice(0, 2), 16) / 255, parseInt(hex.slice(2, 4), 16) / 255, parseInt(hex.slice(4, 6), 16) / 255);
  }
  const nums = (s: string) => (s.match(/-?\d*\.?\d+%?/g) ?? []).map((n) => (n.endsWith("%") ? Number(n.slice(0, -1)) / 100 : Number(n)));
  m = /^rgba?\(([^)]*)\)$/i.exec(v);
  if (m) {
    const raw = m[1]!.match(/-?\d*\.?\d+%?/g) ?? [];
    if (raw.length < 3) return null;
    const ch = raw.slice(0, 3).map((n) => (n.endsWith("%") ? (Number(n.slice(0, -1)) / 100) : Number(n) / 255));
    return rgbToHue(ch[0]!, ch[1]!, ch[2]!);
  }
  m = /^hsla?\(([^)]*)\)$/i.exec(v);
  if (m) {
    const [h, s, l] = nums(m[1]!);
    if (h === undefined || s === undefined) return null;
    return { hue: ((h % 360) + 360) % 360, saturated: s >= 0.15 && (l ?? 0.5) > 0.02 };
  }
  m = /^oklch\(([^)]*)\)$/i.exec(v);
  if (m) {
    const parts = m[1]!.split("/")[0]!.trim().split(/[\s,]+/);
    const l = parts[0]!.endsWith("%") ? Number(parts[0]!.slice(0, -1)) / 100 : Number(parts[0]);
    const c = Number(parts[1]);
    const h = Number(parts[2]!.replace("deg", ""));
    if ([l, c, h].some(Number.isNaN)) return null;
    const [r, g, b] = oklchToRgb(l, c, h);
    return rgbToHue(r, g, b);
  }
  return null;
}

/** Every colour literal in a piece of text (hex, rgb, hsl, oklch). */
export const COLOR_LITERAL = /#[0-9a-fA-F]{3,8}\b|(?:rgba?|hsla?|oklch)\([^)]*\)/g;
