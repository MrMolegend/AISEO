/**
 * The design system, as types.
 *
 * app/globals.css owns the *values*; this file owns the *names* and the
 * mappings that components branch on. The split matters: duplicating an oklch
 * triple here would guarantee drift, but leaving token names as bare strings in
 * fifty components guarantees the other failure — a class referencing a token
 * that quietly does not exist, which renders as "no colour at all" and looks
 * like a layout bug.
 *
 * tests/unit/design-tokens.test.ts reads globals.css and fails if any name
 * declared here is missing from it, so the two cannot separate.
 */

/* ─────────────────────────────── Colour ──────────────────────────────────── */

/**
 * Semantic colour tokens.
 *
 * Named for the role, never the hue, because the two schemes swap which is
 * dark: on the obsidian scheme `ground` is near-black and `leaf` is warm bone,
 * and on the parchment scheme they invert. A component asking for
 * `--color-leaf` gets "the surface a document sits on" in both.
 */
export const COLOR_TOKENS = [
  // Ground and surfaces
  'ground',
  'ground-raised',
  'ground-sunken',
  'leaf',
  'leaf-sunken',

  // Text
  'text',
  'text-muted',
  'text-subtle',
  'text-faint',
  'text-on-leaf',
  'text-on-leaf-muted',
  'text-on-signal',

  // Accents
  'signal',
  'signal-dim',
  'signal-surface',
  'cobalt',
  'cobalt-surface',
  'cobalt-line',
  'copper',
  'copper-surface',
  'copper-line',

  // Cartographic rules
  'rule',
  'rule-strong',
  'rule-faint',

  // Evidence grades
  'grade-verified',
  'grade-provided',
  'grade-modelled',
  'grade-inference',
  'grade-unknown',

  // Verdicts
  'verdict-promising',
  'verdict-conditional',
  'verdict-risk',
  'verdict-insufficient',
] as const;

export type ColorToken = (typeof COLOR_TOKENS)[number];

/** `var(--color-signal)`, checked at compile time. */
export function color(token: ColorToken): string {
  return `var(--color-${token})`;
}

/* ──────────────────────────── Typography ─────────────────────────────────── */

/**
 * Three families, three jobs.
 *
 * Display is the editorial voice and appears at large sizes only — a Scotch
 * serif set at 15px is just a hard-to-read serif. Interface carries everything
 * a person reads to operate the product. Mono carries metadata that must line
 * up in columns: source refs, coordinates, ISO codes, dates, scores.
 */
export const FONT_ROLES = ['display', 'interface', 'mono'] as const;
export type FontRole = (typeof FONT_ROLES)[number];

/**
 * The type scale, in the order it climbs.
 *
 * Deliberately short. A scale with fourteen steps is a scale nobody uses
 * consistently, and the hierarchy this product needs is carried by weight,
 * family and space as much as by size.
 */
export const TYPE_STEPS = [
  'meta', // 11px mono — source markers, coordinates
  'micro', // 12px — table metadata, captions
  'small', // 13px — secondary interface text
  'body', // 15px — the reading size
  'lead', // 18px — section ledes
  'title', // 22px — subsection headings
  'section', // 28px — section headings
  'page', // 40px — page headings
  'hero', // 64px+ — the landing headline, display face only
] as const;

export type TypeStep = (typeof TYPE_STEPS)[number];

/* ───────────────────────── Spacing, radii, borders ───────────────────────── */

/** A 4px base. Every gap in the product is one of these. */
export const SPACE_STEPS = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32] as const;

/**
 * Radii, kept deliberately small.
 *
 * `none` is the default for data panels — the square edge is what stops a page
 * of information reading as a pile of cards. Controls get `control`; nothing in
 * the product is more rounded than that.
 */
export const RADII = {
  none: '0px',
  hair: '2px',
  control: '4px',
  panel: '8px',
  pill: '999px',
} as const;

export type Radius = keyof typeof RADII;

export const BORDER_WIDTHS = {
  hair: '1px',
  /** Section rules and the left edge of an evidence rail. */
  rule: '2px',
  /** The decision panel's leading edge. */
  emphasis: '3px',
} as const;

/* ───────────────────────────── Elevation ─────────────────────────────────── */

/**
 * Two levels, and neither is a glow.
 *
 * On the obsidian scheme a shadow does almost nothing, so separation is carried
 * by rules and by the bone panels themselves. `lift` exists for the two
 * genuinely floating things — the account menu and the source drawer.
 */
export const SHADOWS = ['none', 'panel', 'lift'] as const;
export type Shadow = (typeof SHADOWS)[number];

/* ──────────────────────────────── Motion ─────────────────────────────────── */

/**
 * One curve family, four durations.
 *
 * `route` is the outlier: the origin-to-target line draws over 1.2s because it
 * is telling a short story, not acknowledging a click. Everything else is fast
 * enough to feel like response rather than performance.
 */
export const DURATIONS = {
  instant: '90ms',
  fast: '160ms',
  base: '280ms',
  slow: '520ms',
  route: '1200ms',
} as const;

export const EASINGS = {
  /** Decelerating. Almost everything. */
  out: 'cubic-bezier(0.22, 1, 0.36, 1)',
  /** Symmetric, for things that move between two held states. */
  inOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  /** For a line being drawn. */
  draw: 'cubic-bezier(0.4, 0, 0.2, 1)',
} as const;

export type Duration = keyof typeof DURATIONS;
export type Easing = keyof typeof EASINGS;

/* ──────────────────────────────── Z-index ───────────────────────────────── */

/**
 * A named ladder, because `z-50` scattered across a codebase is how a drawer
 * ends up under a sticky header on one page and over it on another.
 */
export const Z_INDEX = {
  base: 0,
  raised: 10,
  stickyNav: 20,
  header: 30,
  drawer: 40,
  menu: 50,
  skipLink: 60,
} as const;

export type ZLayer = keyof typeof Z_INDEX;

/* ───────────────────────── Container widths ─────────────────────────────── */

/**
 * Four widths, each with a reason.
 *
 * `prose` is a reading measure, not a layout width — it is what keeps a
 * paragraph of synthesis at roughly 68 characters regardless of what column it
 * lands in.
 */
export const CONTAINERS = {
  prose: '68ch',
  narrow: '640px',
  page: '1180px',
  wide: '1440px',
} as const;

export type Container = keyof typeof CONTAINERS;

/* ─────────────────── Mappings the product branches on ───────────────────── */

/**
 * Evidence grade → the token that renders it.
 *
 * Colour is never the only carrier: every grade is rendered with its label as
 * text. The token exists so the label is *also* distinguishable at a glance,
 * not so it can replace the label.
 */
export const EVIDENCE_GRADES = [
  'verified',
  'provided',
  'modelled',
  'inference',
  'unknown',
] as const;

export type EvidenceGrade = (typeof EVIDENCE_GRADES)[number];

export const EVIDENCE_GRADE_TOKEN: Record<EvidenceGrade, ColorToken> = {
  verified: 'grade-verified',
  provided: 'grade-provided',
  modelled: 'grade-modelled',
  inference: 'grade-inference',
  unknown: 'grade-unknown',
};

/** What each grade means, in the words shown to the reader. */
export const EVIDENCE_GRADE_LABEL: Record<EvidenceGrade, string> = {
  verified: 'Verified fact',
  provided: 'You told us',
  modelled: 'Modelled estimate',
  inference: 'Strategic inference',
  unknown: 'Unverified',
};

export const EVIDENCE_GRADE_MEANING: Record<EvidenceGrade, string> = {
  verified: 'Stated by a source we retrieved and read directly.',
  provided: 'Taken from the details you entered, not researched.',
  modelled: 'Calculated from your figures and stated assumptions.',
  inference: 'Our reasoning from the evidence, not stated by any source.',
  unknown: 'We looked and could not establish this from a credible source.',
};

export const VERDICTS = [
  'promising',
  'promising-with-conditions',
  'high-risk',
  'insufficient-evidence',
] as const;

export type Verdict = (typeof VERDICTS)[number];

export const VERDICT_TOKEN: Record<Verdict, ColorToken> = {
  promising: 'verdict-promising',
  'promising-with-conditions': 'verdict-conditional',
  'high-risk': 'verdict-risk',
  'insufficient-evidence': 'verdict-insufficient',
};

export const VERDICT_LABEL: Record<Verdict, string> = {
  promising: 'Promising',
  'promising-with-conditions': 'Promising with conditions',
  'high-risk': 'High risk',
  'insufficient-evidence': 'Insufficient evidence',
};
