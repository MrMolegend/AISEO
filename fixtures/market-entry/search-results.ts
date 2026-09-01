import type { SearchResult } from '@/lib/research/provider';

/**
 * Deterministic search results for the illustrative case.
 *
 * Shaped exactly like a real provider response — title, url, excerpt,
 * publication date, relevance score — so the classifier, the registry, the
 * retrieval pass and the prompt builder all run their real code paths against
 * them. What makes them safe is the addresses: every host is under the reserved
 * `.example` TLD (RFC 2606), which cannot resolve, so a test that accidentally
 * reaches the network fails loudly instead of quietly fetching someone's site.
 *
 * Keyed by the plan area that asks for them, so the fixture provider can answer
 * a real twelve-query plan rather than returning the same rows twelve times —
 * which would make source deduplication look like it worked when it had not
 * been exercised at all.
 */

type Area =
  | 'market-conditions'
  | 'demand'
  | 'competitors'
  | 'substitutes'
  | 'pricing'
  | 'buyers'
  | 'channels'
  | 'partners'
  | 'regulatory'
  | 'barriers'
  | 'approaches'
  | 'key-question';

const result = (
  url: string,
  title: string,
  excerpt: string,
  publishedDate: string | null,
  score: number,
): SearchResult => ({ url, title, excerpt, publishedDate, score });

export const FIXTURE_RESULTS: Record<Area, SearchResult[]> = {
  'market-conditions': [
    result(
      'https://fcsc.gov.example/publications/food-import-statistics-2025',
      'Food and beverage import statistics 2025 — Federal Competitiveness and Statistics Centre',
      'Total food and beverage imports reached AED 62.4 billion in 2024, an increase of 6.1% on 2023. Prepared foods and condiments accounted for AED 3.8 billion of the total, with the majority entering through Jebel Ali.',
      '2025-03-11',
      0.94,
    ),
    result(
      'https://dubaichamber.example/insights/speciality-food-retail-outlook',
      'Speciality food retail outlook — Dubai Chamber of Commerce',
      'Premium and speciality grocery formats continue to expand across the emirate, with chamber members reporting sustained demand for imported European provenance products among both resident and hospitality buyers.',
      '2025-01-22',
      0.88,
    ),
    result(
      'https://thenationalnews.example/business/uae-gourmet-grocery-expansion',
      'Gourmet grocery chains expand across the UAE',
      'Three premium grocery operators opened a combined 14 stores in Dubai and Abu Dhabi last year, with buyers pointing to demand for single-origin and artisanal ranges.',
      '2024-11-04',
      0.79,
    ),
  ],

  demand: [
    result(
      'https://speciality-food-mena.example/reports/finishing-salts-category',
      'Finishing salts: a small category with disproportionate menu visibility',
      'Category managers interviewed for this report described finishing salts as a low-volume, high-margin line that anchors a premium seasoning fixture. Hotel procurement remains the larger channel by value in the Gulf.',
      '2025-02-18',
      0.86,
    ),
    result(
      'https://dubaichamber.example/insights/hospitality-procurement-trends',
      'Hospitality procurement trends — Dubai Chamber of Commerce',
      'Hotel food and beverage procurement teams report increasing use of named-provenance ingredients on menus, though most buying still runs through consolidated distributors rather than direct import.',
      '2024-09-30',
      0.81,
    ),
  ],

  competitors: [
    result(
      'https://maldonsalt.example/stockists/middle-east',
      'Middle East stockists — Maldon Salt',
      'Maldon Crystal Sea Salt is available across the Gulf through appointed distributors, with listings in premium grocery and hospitality supply.',
      null,
      0.9,
    ),
    result(
      'https://halenmon.example/trade/export-markets',
      'Export markets — Halen Môn',
      'Our sea salt is exported to more than thirty markets. Gulf distribution is handled through a regional speciality food importer.',
      null,
      0.84,
    ),
    result(
      'https://spinneys.example/departments/pantry/salt-and-pepper',
      'Salt and pepper — Spinneys',
      'Our pantry range includes flake sea salts, rock salts and speciality seasoning blends from European and regional producers.',
      null,
      0.77,
    ),
  ],

  substitutes: [
    result(
      'https://kibsons.example/collections/pantry-seasonings',
      'Pantry seasonings — Kibsons',
      'Online grocery range including Himalayan pink salt, flake sea salt and regional seasoning blends, delivered across the UAE.',
      null,
      0.72,
    ),
  ],

  pricing: [
    result(
      'https://carrefouruae.example/c/grocery/cooking-essentials/salt',
      'Salt — Carrefour UAE',
      'Everyday and speciality salt lines. Speciality imported flake salts are typically listed between AED 28 and AED 65 for retail pack sizes.',
      null,
      0.83,
    ),
    result(
      'https://speciality-food-mena.example/reports/premium-pantry-price-architecture',
      'Premium pantry price architecture in Gulf grocery',
      'Imported premium pantry lines commonly sit at a three to four times landed-cost retail multiple, reflecting distributor margin, retailer margin and listing costs.',
      '2024-12-09',
      0.92,
    ),
  ],

  buyers: [
    result(
      'https://dubaichamber.example/insights/retail-buyer-listing-process',
      'How grocery listing decisions are made — Dubai Chamber of Commerce',
      'Category managers described a listing process running from sample submission through registration verification to a trial period, typically over one to two quarters.',
      '2024-08-14',
      0.9,
    ),
  ],

  channels: [
    result(
      'https://gulfoodtrade.example/guides/routes-to-market-uae',
      'Routes to market for imported food in the UAE — Gulf Food Trade Association',
      'Most first-time exporters enter through an appointed distributor holding the import registration, rather than registering as a foreign entity. Direct retail supply is uncommon below significant volume.',
      '2025-01-08',
      0.91,
    ),
  ],

  partners: [
    result(
      'https://uaefoodimporters.example/directory/speciality-food',
      'Speciality food importers directory',
      'Listing of registered food importers and distributors operating in the UAE by category, including chilled, ambient and speciality segments.',
      null,
      0.7,
    ),
  ],

  regulatory: [
    result(
      'https://moccae.gov.example/services/food-import-registration',
      'Food import registration — Ministry of Climate Change and Environment',
      'All food products imported for commercial sale must be registered before first import. Registration is submitted by a licensed importer and requires product specification, ingredient declaration and label artwork in Arabic and English.',
      '2025-04-02',
      0.96,
    ),
    result(
      'https://dm.gov.example/food-safety/labelling-requirements',
      'Food labelling requirements — Dubai Municipality Food Safety Department',
      'Labels must carry the product name, ingredient list, net content, country of origin, production and expiry dates, and the importer name, in Arabic and English. Stickering may be applied prior to release from the port.',
      '2024-10-17',
      0.95,
    ),
    result(
      'https://customs.gov.example/tariff/chapter-25-salt',
      'Tariff schedule chapter 25 — salt; sulphur; earths and stone',
      'The GCC common external tariff applies a five percent duty to most food preparations. Chapter 25 entries cover salt including table salt and denatured salt.',
      '2024-06-01',
      0.93,
    ),
  ],

  barriers: [
    result(
      'https://gulfoodtrade.example/guides/first-shipment-costs',
      'What a first food shipment actually costs — Gulf Food Trade Association',
      'Beyond freight and duty, first-time exporters commonly underestimate registration lead time, Arabic artwork origination and the cost of a compliant first sticker run.',
      '2024-07-23',
      0.87,
    ),
  ],

  approaches: [
    result(
      'https://gulfoodtrade.example/guides/appointing-a-distributor',
      'Appointing a UAE distributor — Gulf Food Trade Association',
      'Commercial agency registration creates strong protections for the appointed agent. Many exporters begin with a non-registered distribution agreement and a defined trial period before committing.',
      '2025-02-05',
      0.92,
    ),
  ],

  'key-question': [
    result(
      'https://speciality-food-mena.example/features/small-producer-entry-routes',
      'How small producers reach Gulf shelves',
      'Producers under ten staff most often enter through a consolidating importer carrying several small brands, sharing registration overhead across a portfolio rather than bearing it alone.',
      '2025-03-28',
      0.89,
    ),
  ],
};

/** Flat list, in registration order, for tests that need the whole set. */
export const ALL_FIXTURE_RESULTS: readonly SearchResult[] =
  Object.values(FIXTURE_RESULTS).flat();
