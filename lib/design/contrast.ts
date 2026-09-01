/**
 * Contrast, computed from the tokens themselves.
 *
 * The design brief requires every colour to meet WCAG contrast. That is easy to
 * assert and hard to keep true: a palette drifts one token at a time, each
 * change looks fine in the browser the author happens to be using, and the
 * regression surfaces months later as an accessibility failure on a page nobody
 * touched. So the palette is checked arithmetically, from the same oklch values
 * the stylesheet ships, by tests/unit/design-tokens.test.ts.
 *
 * This is deliberately not a colour library. It does one conversion — oklch to
 * linear sRGB — and one calculation, because those are the only two things the
 * check needs and a dependency here would be a dependency in the bundle.
 */

export interface Oklch {
  /** 0–1, not the percentage form. */
  l: number;
  c: number;
  /** Degrees. */
  h: number;
  alpha: number;
}

/**
 * Parses `oklch(62% 0.19 267)` and `oklch(0.62 0.19 267 / 0.5)`.
 *
 * Returns null rather than throwing, so a token using a colour form this does
 * not understand is reported as unchecked rather than crashing the suite — and
 * the test asserts that nothing is unchecked, which catches it either way.
 */
export function parseOklch(value: string): Oklch | null {
  const match =
    /^oklch\(\s*([^\s]+)\s+([^\s]+)\s+([^\s/)]+)\s*(?:\/\s*([^\s)]+)\s*)?\)$/i.exec(
      value.trim(),
    );
  if (!match) return null;

  const [, rawL, rawC, rawH, rawAlpha] = match;
  const l = rawL!.endsWith('%') ? Number(rawL!.slice(0, -1)) / 100 : Number(rawL);
  const c = Number(rawC);
  const h = rawH!.endsWith('deg') ? Number(rawH!.slice(0, -3)) : Number(rawH);
  const alpha = rawAlpha
    ? rawAlpha.endsWith('%')
      ? Number(rawAlpha.slice(0, -1)) / 100
      : Number(rawAlpha)
    : 1;

  if (![l, c, h, alpha].every(Number.isFinite)) return null;
  return { l, c, h, alpha };
}

/** Linear-light sRGB, clamped to gamut — which is what a screen actually shows. */
export function oklchToLinearSrgb(color: Oklch): [number, number, number] {
  const hRad = (color.h * Math.PI) / 180;
  const a = color.c * Math.cos(hRad);
  const b = color.c * Math.sin(hRad);

  const lCone = (color.l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mCone = (color.l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sCone = (color.l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  const clamp = (value: number) => Math.min(1, Math.max(0, value));

  return [
    clamp(4.0767416621 * lCone - 3.3077115913 * mCone + 0.2309699292 * sCone),
    clamp(-1.2684380046 * lCone + 2.6097574011 * mCone - 0.3413193965 * sCone),
    clamp(-0.0041960863 * lCone - 0.7034186147 * mCone + 1.707614701 * sCone),
  ];
}

/** WCAG relative luminance. Takes linear-light components, as the spec does. */
export function relativeLuminance(color: Oklch): number {
  const [r, g, b] = oklchToLinearSrgb(color);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * WCAG 2.x contrast ratio, 1–21.
 *
 * Alpha is not composited: every pair this checks is an opaque token on an
 * opaque token, and pretending to handle translucency would give a number that
 * looks authoritative and is not.
 */
export function contrastRatio(foreground: Oklch, background: Oklch): number {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Contrast thresholds, named for what they apply to rather than their number. */
export const CONTRAST = {
  /** Body text and anything below 18.66px regular / 14px bold. */
  bodyText: 4.5,
  /** Large text: 24px regular or 18.66px bold and above. */
  largeText: 3,
  /** Borders, focus rings, icons and other non-text indicators (WCAG 1.4.11). */
  nonText: 3,
} as const;
