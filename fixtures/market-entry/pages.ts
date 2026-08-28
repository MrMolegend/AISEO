/**
 * Page bodies for the sources the illustrative case retrieves directly.
 *
 * Two of them fail on purpose.
 *
 * That is the point of the fixture, not an oversight. Direct retrieval is
 * best-effort enrichment: a page that refuses us must be recorded and skipped
 * while the report carries on. A fixture where every fetch succeeds would let
 * that path rot untested, and the first time anyone noticed would be a customer
 * losing a paid report because one ministry's website was slow. So the fixture
 * run always has a robots refusal and an unreachable host in it, and the
 * example dossier really does show two blocked sources in its coverage panel.
 */

export type FixturePage =
  | { kind: 'ok'; contentType: string; body: string }
  | { kind: 'fail'; reason: 'robots-disallowed' | 'unreachable' | 'blocked-by-site' };

const page = (title: string, headings: string[], paragraphs: string[]): FixturePage => ({
  kind: 'ok',
  contentType: 'text/html; charset=utf-8',
  body: [
    '<!doctype html><html lang="en"><head>',
    `<title>${title}</title>`,
    '</head><body><main>',
    ...headings.map((heading) => `<h2>${heading}</h2>`),
    ...paragraphs.map((paragraph) => `<p>${paragraph}</p>`),
    '</main></body></html>',
  ].join(''),
});

export const FIXTURE_PAGES: Readonly<Record<string, FixturePage>> = {
  'https://moccae.gov.example/services/food-import-registration': page(
    'Food import registration — Ministry of Climate Change and Environment',
    ['Who may register', 'What a registration requires', 'Processing time'],
    [
      'Registration is submitted by a food establishment licensed in the United Arab Emirates. A producer outside the country cannot register a product in its own name; the registration is held by the importer.',
      'A complete submission includes the product specification, the full ingredient declaration, the shelf-life basis, and label artwork showing the required particulars in Arabic and English.',
      'Applications are assessed within twenty working days of a complete submission. Incomplete submissions are returned and restart the assessment period.',
    ],
  ),

  'https://dm.gov.example/food-safety/labelling-requirements': page(
    'Food labelling requirements — Dubai Municipality Food Safety Department',
    ['Mandatory particulars', 'Language', 'Stickering'],
    [
      'Every retail food label must show the product name, the ingredient list in descending order of weight, the net content, the country of origin, the production and expiry dates, and the name and address of the importer.',
      'Mandatory particulars must appear in Arabic. English may appear alongside Arabic but does not replace it.',
      'Where artwork has not been reprinted, compliant stickers may be applied to stock before it is released from the port, provided no mandatory particular of the original label is obscured.',
    ],
  ),

  'https://customs.gov.example/tariff/chapter-25-salt': page(
    'Tariff schedule chapter 25 — salt',
    ['Scope of chapter 25', 'Applicable rate'],
    [
      'Chapter 25 covers salt, including table salt and denatured salt, whether or not in aqueous solution or containing added anti-caking or free-flowing agents.',
      'The GCC common external tariff rate applied to this chapter is five percent of the customs value, subject to the standard exemptions.',
    ],
  ),

  'https://gulfoodtrade.example/guides/routes-to-market-uae': page(
    'Routes to market for imported food in the UAE',
    ['Distributor-led entry', 'Direct retail supply', 'Choosing between them'],
    [
      'The common route for a first-time exporter is an appointed distributor who already holds importer licensing and can carry the registration on the exporter’s behalf. This removes the need to establish a local entity.',
      'Supplying a retailer directly requires the exporter or a nominated agent to hold the import registration, and retailers rarely take on that administration for a single small line.',
      'The trade-off is control against speed. A distributor reaches shelf faster and owns the relationship; direct supply preserves margin and pricing control but requires local presence.',
    ],
  ),

  'https://gulfoodtrade.example/guides/appointing-a-distributor': page(
    'Appointing a UAE distributor',
    ['Commercial agency registration', 'Trial arrangements'],
    [
      'A registered commercial agency creates significant protections for the appointed agent, including exclusivity and difficulty of termination. Registration is a deliberate commitment rather than an administrative step.',
      'Many exporters begin with an unregistered distribution agreement covering a defined territory and a fixed trial period, converting to a longer arrangement only after the first orders have been delivered and paid.',
    ],
  ),

  'https://fcsc.gov.example/publications/food-import-statistics-2025': page(
    'Food and beverage import statistics 2025',
    ['Headline figures', 'Category breakdown'],
    [
      'Total food and beverage imports reached AED 62.4 billion in 2024, an increase of 6.1 percent on the previous year.',
      'Prepared foods, sauces and condiments together accounted for AED 3.8 billion, of which the majority entered through Jebel Ali port.',
    ],
  ),

  'https://carrefouruae.example/c/grocery/cooking-essentials/salt': page(
    'Salt — Carrefour UAE',
    ['Cooking essentials', 'Speciality salts'],
    [
      'Everyday table and rock salts are listed from AED 4 for a 750g pack.',
      'Imported speciality flake salts in the range are listed between AED 28 and AED 65 depending on pack size and origin.',
    ],
  ),

  /*
   * Refuses us by robots.txt. A perfectly ordinary thing for a chamber of
   * commerce site to do, and not a reason anyone's report should fail.
   */
  'https://dubaichamber.example/insights/retail-buyer-listing-process': {
    kind: 'fail',
    reason: 'robots-disallowed',
  },

  /* Times out. The excerpt from the index is still usable as a weak signal. */
  'https://speciality-food-mena.example/reports/premium-pantry-price-architecture': {
    kind: 'fail',
    reason: 'unreachable',
  },
};

/** URLs the fixture will serve, in the order retrieval should prefer them. */
export const FIXTURE_PAGE_URLS: readonly string[] = Object.keys(FIXTURE_PAGES);
