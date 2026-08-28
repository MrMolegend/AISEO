import {
  type SourceCategory,
  type GeographicRelevance,
  isAuthoritative,
} from '@/schemas/market-entry/evidence';

/**
 * What kind of source is this, and is it about the right country?
 *
 * Both questions are answered from the URL and the page's own words rather than
 * asked of the model, for the same reason the query plan is built in code: a
 * classification the model produces is a classification it can be talked out of
 * by the page it is classifying. A government domain is a government domain
 * whatever the page says about itself.
 *
 * The classifier is deliberately conservative. Anything it cannot place lands
 * in `other`, which does not count toward the source threshold and cannot carry
 * a regulatory claim. Over-classifying a blog as a regulator is a far worse
 * failure than under-classifying a regulator as `other`, because one produces a
 * confident wrong answer and the other produces a visible gap.
 */

/** Second-level government and academic labels, as used under a ccTLD. */
const GOVERNMENT_LABELS = new Set([
  'gov',
  'gouv',
  'govt',
  'gob',
  'go',
  'admin',
  'bund',
  'overheid',
]);

const REGULATOR_HINTS = [
  'regulator',
  'authority',
  'agency',
  'commission',
  'inspectorate',
  'standards',
  'fsa',
  'fda',
  'moccae',
  'municipality',
];

/*
 * Note what is absent: 'import'.
 *
 * It was here, and it was wrong. "import" appears in the path of almost any
 * trade content — a statistics office publishing import figures, a directory of
 * importers, a ministry's food-import registration page — so it classified
 * three different kinds of source as customs authorities. A hint has to be
 * distinctive of the thing it identifies, not merely adjacent to it.
 */
const CUSTOMS_HINTS = ['customs', 'tariff', 'douane', 'zoll', 'aduana'];

/*
 * Short hints are dangerous here in a way that is easy to miss.
 *
 * This list used to contain 'ons' and 'stat', matched as substrings. 'ons'
 * matched maldonsalt.example and kibsons.example, so two consumer brands were
 * classified as national statistics offices — which is not a cosmetic error,
 * because a statistical source is authoritative and may carry a market-size
 * claim on its own. Every hint below is long enough to be distinctive.
 */
const STATISTICAL_HINTS = [
  'statistic',
  'statistics',
  'census',
  'fcsc',
  'eurostat',
  'insee',
];

const CHAMBER_HINTS = ['chamber', 'chambre', 'kamer', 'cci', 'handelskammer'];

const TRADE_ASSOCIATION_HINTS = [
  'association',
  'federation',
  'council',
  'institute',
  'society',
  'guild',
  'board',
  'tradeassoc',
];

const INDUSTRY_PUBLICATION_HINTS = [
  'trade',
  'industry',
  'grocer',
  'foodservice',
  'packaging',
  'logistics',
  'retailweek',
  'speciality',
  'specialty',
];

const NEWS_HINTS = [
  'news',
  'times',
  'herald',
  'gazette',
  'journal',
  'reuters',
  'bloomberg',
  'guardian',
  'national',
];

const RETAILER_HINTS = [
  'shop',
  'store',
  'grocery',
  'grocer',
  'market',
  'carrefour',
  'spinneys',
  'waitrose',
  'sainsbury',
  'tesco',
  'kibsons',
];

const DIRECTORY_HINTS = [
  'directory',
  'listing',
  'yellowpages',
  'importers',
  'exporters',
  'suppliers',
  'b2b',
];

function hostLabels(hostname: string): string[] {
  return hostname.toLowerCase().replace(/\.$/, '').split('.');
}

function matchesAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

/**
 * Classifies a source from its URL and, where available, its title.
 *
 * Order matters and is not alphabetical: government first, because a customs
 * authority is also a government department and should be recorded as the more
 * specific of the two; retailers and companies last, because almost any word
 * can appear in a company's domain.
 */
export function classifySource(url: string, title?: string | null): SourceCategory {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'other';
  }

  const labels = hostLabels(parsed.hostname);
  const host = labels.join('.');
  const path = parsed.pathname.toLowerCase();
  // The title is the page's own claim about itself, so it is used only to
  // sharpen a decision the host has already narrowed — never to make one.
  const text = `${host} ${path} ${(title ?? '').toLowerCase()}`;

  const isGovernment =
    labels.some((label) => GOVERNMENT_LABELS.has(label)) ||
    host.endsWith('.mil') ||
    host.endsWith('.int');

  if (isGovernment) {
    if (matchesAny(text, CUSTOMS_HINTS)) return 'customs';
    if (matchesAny(text, STATISTICAL_HINTS)) return 'statistical';
    if (matchesAny(text, REGULATOR_HINTS)) return 'regulator';
    return 'official';
  }

  // A statistics office or a customs authority that does not sit on a
  // government label — common outside Europe — still counts as what it is.
  if (matchesAny(host, STATISTICAL_HINTS)) return 'statistical';
  if (matchesAny(host, CUSTOMS_HINTS)) return 'customs';
  if (matchesAny(host, CHAMBER_HINTS)) return 'chamber';
  if (matchesAny(host, TRADE_ASSOCIATION_HINTS)) return 'trade_association';
  if (matchesAny(host, DIRECTORY_HINTS)) return 'directory';
  if (matchesAny(host, INDUSTRY_PUBLICATION_HINTS)) return 'industry_publication';
  if (matchesAny(host, NEWS_HINTS)) return 'news';
  if (matchesAny(host, RETAILER_HINTS)) return 'retailer';

  // A bare registrable domain with a product path is most likely a company.
  if (labels.length >= 2) return 'company';
  return 'other';
}

/** Publisher, for display and for counting independent sources. */
export function publisherOf(url: string): string | null {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}

/**
 * Is this source about the market being entered?
 *
 * A well-sourced statement about the wrong country is the most plausible-looking
 * mistake this product can make, and the most expensive: a customer reads a
 * confident paragraph about import rules and acts on it, and the rules were
 * Saudi Arabia's. So relevance is recorded per source and rendered, rather than
 * assumed from the query that found it.
 *
 * Judged from the ccTLD, an explicit country segment in the host or path, and
 * the market's own name appearing in the title. Anything else is `unknown`,
 * which the report shows rather than hides.
 */
export function geographicRelevanceOf(input: {
  url: string;
  title?: string | null;
  targetCountry: string;
  targetCountryName: string;
  targetRegion?: string | null;
  originCountry: string;
  originCountryName: string;
}): GeographicRelevance {
  let parsed: URL;
  try {
    parsed = new URL(input.url);
  } catch {
    return 'unknown';
  }

  const labels = hostLabels(parsed.hostname);
  const tld = labels.at(-1) ?? '';
  const haystack =
    `${parsed.hostname} ${parsed.pathname} ${(input.title ?? '').toLowerCase()}`.toLowerCase();

  const target = input.targetCountry.toLowerCase();
  const origin = input.originCountry.toLowerCase();
  const targetName = input.targetCountryName.toLowerCase();
  const originName = input.originCountryName.toLowerCase();
  const region = input.targetRegion?.toLowerCase() ?? null;

  if (region && haystack.includes(region)) return 'target-market';
  if (tld === target || haystack.includes(targetName)) return 'target-market';
  if (tld === origin || haystack.includes(originName)) return 'origin-market';

  // Common multi-country groupings that are useful but are not the market.
  if (/\b(gcc|gulf|mena|eu|europe|asean|nordic)\b/.test(haystack)) return 'target-region';
  if (/\b(global|world|international)\b/.test(haystack)) return 'global';

  // A national TLD that is neither market is explicitly somewhere else, which
  // is worth saying: it is the difference between "we do not know" and "this is
  // about a third country".
  if (tld.length === 2 && tld !== target && tld !== origin) return 'other-market';

  return 'unknown';
}

/** Whether this source may carry a regulatory or market-size claim alone. */
export function canCarrySensitiveClaim(category: SourceCategory): boolean {
  return isAuthoritative(category);
}
