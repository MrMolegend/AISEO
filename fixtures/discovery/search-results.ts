import type { SearchResult } from '@/lib/research/provider';

/**
 * The deterministic discovery world.
 *
 * A small fictional UAE pet-trade landscape, keyed by the discovery
 * pipeline's area strings, so a whole campaign runs end to end in CI and
 * local development with no key, no cost and no network egress. Every
 * company, person and URL here is invented and lives on reserved
 * `.example` domains — except the public-index results, which imitate the
 * shape of indexed profile snippets without being real people.
 *
 * The set is deliberately imperfect: one candidate appears twice under
 * different legal suffixes (deduplication must collapse it), one result is
 * a listicle that must NOT become an account, and one segment yields a
 * candidate with no fit evidence (the quality gate must park it as
 * research_needed).
 */

export const DISCOVERY_FIXTURE_RESULTS: Record<string, SearchResult[]> = {
  // Watchlist checks. One result deliberately fails the honesty guard —
  // it never names the watched subject — so every fixture check exercises
  // the skip path, not only the happy one.
  'discovery:signals:pet oasis': [
    {
      title: 'Pet Oasis opens third Jumeirah store with grand opening event',
      url: 'https://gulftradenews.example/retail/pet-oasis-third-store',
      excerpt:
        'Pet Oasis celebrated the grand opening of its third Jumeirah location on Saturday, expanding its premium pet supplies footprint in Dubai.',
      publishedDate: '2026-08-20',
      score: 0.9,
    },
    {
      title: 'Pet Oasis now stocking new premium cat nutrition range',
      url: 'https://petoasis.example/news/new-range',
      excerpt:
        'Pet Oasis announces a new range of premium cat nutrition products across all stores.',
      publishedDate: '2026-08-28',
      score: 0.85,
    },
    {
      title: 'Dubai retail roundup: openings across the emirate this month',
      url: 'https://gulflifestyle.example/retail-roundup-august',
      excerpt:
        'A busy month for Dubai retail with new cafes, salons and boutiques opening across the emirate.',
      publishedDate: '2026-08-25',
      score: 0.6,
    },
  ],
  'discovery:signals:independent_pet_retail:AE-DU': [
    {
      title: 'New independent pet shop opens in Dubai Marina',
      url: 'https://dubaiyellowpages.example/news/marina-pet-shop-opens',
      excerpt:
        'A new independent pet retailer has opened in Dubai Marina, stocking dog and cat food, accessories and aquatics.',
      publishedDate: '2026-08-30',
      score: 0.88,
    },
    {
      title: 'Riyadh grocery chain adds petcare aisle',
      url: 'https://gulftradenews.example/retail/riyadh-grocery-petcare',
      excerpt:
        'A Riyadh supermarket group is trialling dedicated petcare aisles in three stores.',
      publishedDate: '2026-08-18',
      score: 0.55,
    },
  ],
  'discovery:candidates:independent_pet_retail': [
    {
      title: 'Pet Oasis Trading LLC | Dubai Pet Shops Directory',
      url: 'https://dubaiyellowpages.example/listings/pet-oasis-trading',
      excerpt:
        'Pet Oasis Trading LLC — independent pet shop in Jumeirah, Dubai. Premium dog and cat food, accessories, aquatics. Established 2015.',
      publishedDate: '2026-03-11',
      score: 0.91,
    },
    {
      title: 'Pet Oasis | Premium pet supplies in Jumeirah',
      url: 'https://petoasis.example/about',
      excerpt:
        'We stock premium dog and cat nutrition, toys and grooming supplies across our two Jumeirah stores.',
      publishedDate: null,
      score: 0.89,
    },
    {
      title: 'Whisker & Paw Boutique – Sharjah pet retailer profile',
      url: 'https://gulftradenews.example/retail/whisker-paw-boutique-profile',
      excerpt:
        'Whisker & Paw Boutique has grown from a kiosk to a full-format pet store in Sharjah, focusing on cat products and small animals.',
      publishedDate: '2026-01-22',
      score: 0.84,
    },
    {
      title: 'The 10 best pet shops in Dubai | Gulf Lifestyle Weekly',
      url: 'https://gulflifestyle.example/best-pet-shops-dubai',
      excerpt:
        'Our editors round up the ten best pet shops in Dubai for 2026, from boutiques to warehouse stores.',
      publishedDate: '2026-02-01',
      score: 0.7,
    },
    {
      title: 'Desert Fins Aquatics | Specialist aquatics store, Deira',
      url: 'https://desertfins.example/',
      excerpt:
        'Desert Fins Aquatics is a specialist aquatics retailer in Deira, Dubai: marine and freshwater livestock, tanks and equipment.',
      publishedDate: null,
      score: 0.8,
    },
  ],
  'discovery:candidates:pet_retail_chain': [
    {
      title: 'Paws & Claws Group - UAE retail chains directory',
      url: 'https://uaeretaildirectory.example/chains/paws-claws-group',
      excerpt:
        'Paws & Claws Group operates seven pet stores across Dubai, Abu Dhabi and Sharjah, with an in-house grooming service.',
      publishedDate: '2025-11-08',
      score: 0.9,
    },
    {
      title: 'Pet Oasis Trading | Dubai retailer opens second branch',
      url: 'https://gulftradenews.example/retail/pet-oasis-second-branch',
      excerpt:
        'Independent retailer Pet Oasis Trading has opened its second Jumeirah branch, citing demand for premium cat nutrition.',
      publishedDate: '2026-04-02',
      score: 0.72,
    },
  ],
  'discovery:candidates:veterinary_retail': [
    {
      title: 'Al Reem Veterinary Centre | Abu Dhabi clinic and pet pharmacy',
      url: 'https://alreemvet.example/services',
      excerpt:
        'Al Reem Veterinary Centre runs a small-animal clinic in Abu Dhabi with an attached retail pharmacy and nutrition counter.',
      publishedDate: null,
      score: 0.88,
    },
  ],
  'discovery:candidates:pet_ecommerce': [
    {
      title: 'PetKart Middle East – online pet supplies marketplace',
      url: 'https://petkart.example/about-us',
      excerpt:
        'PetKart Middle East delivers pet food and accessories across the UAE and KSA from its Dubai fulfilment centre.',
      publishedDate: null,
      score: 0.87,
    },
  ],

  /* ── Fit evidence, keyed by normalised account name ─────────────────── */

  'discovery:fit:pet oasis': [
    {
      title: 'Pet Oasis Trading | Brands we carry',
      url: 'https://petoasis.example/brands',
      excerpt:
        'Our shelves carry premium European dog and cat nutrition lines, natural treats and grooming ranges.',
      publishedDate: null,
      score: 0.9,
    },
    {
      title: 'Dubai independent retailers report strong premium pet demand',
      url: 'https://gulftradenews.example/retail/premium-pet-demand-2026',
      excerpt:
        'Independent stores including Pet Oasis Trading report growing demand for premium and veterinary diets in Dubai.',
      publishedDate: '2026-05-14',
      score: 0.78,
    },
  ],
  'discovery:fit:whisker paw boutique': [
    {
      title: 'Whisker & Paw Boutique | Our range',
      url: 'https://whiskerpaw.example/range',
      excerpt:
        'Cat trees, litter systems and a growing small-animal section; nutrition brands are mid-market with a premium corner.',
      publishedDate: null,
      score: 0.85,
    },
  ],
  'discovery:fit:paws claws group': [
    {
      title: 'Paws & Claws Group expands grooming and retail footprint',
      url: 'https://gulftradenews.example/retail/paws-claws-expansion',
      excerpt:
        'The seven-store chain is refitting its Abu Dhabi flagship and consolidating suppliers for food and accessories.',
      publishedDate: '2026-03-30',
      score: 0.83,
    },
    {
      title: 'Paws & Claws Group | Store locations',
      url: 'https://pawsclaws-group.example/stores',
      excerpt:
        'Seven locations across Dubai, Abu Dhabi and Sharjah, open daily. In-store grooming at five branches.',
      publishedDate: null,
      score: 0.8,
    },
  ],
  'discovery:fit:al reem veterinary centre': [
    {
      title: 'Al Reem Veterinary Centre | Nutrition counter',
      url: 'https://alreemvet.example/nutrition',
      excerpt:
        'Our clinic pharmacy stocks therapeutic diets and recommends maintenance nutrition for post-treatment care.',
      publishedDate: null,
      score: 0.86,
    },
  ],
  // PetKart deliberately has no fit results: the gate must park it as
  // research_needed under the standard evidence level.
  'discovery:fit:petkart middle east': [],

  /* ── Decision-maker discovery, keyed by normalised account name ─────── */

  'discovery:contacts:pet oasis': [
    {
      title: 'Fatima Hassan – Purchasing Manager – Pet Oasis Trading | LinkedIn',
      url: 'https://www.linkedin.com/in/fatima-hassan-fixture',
      excerpt:
        'Purchasing Manager at Pet Oasis Trading. Dubai, United Arab Emirates. Retail buying, pet care.',
      publishedDate: null,
      score: 0.9,
    },
    {
      title: 'Omar Al Farsi – Founder – Pet Oasis Trading | LinkedIn',
      url: 'https://www.linkedin.com/in/omar-al-farsi-fixture',
      excerpt: 'Founder of Pet Oasis Trading. Dubai, United Arab Emirates.',
      publishedDate: null,
      score: 0.85,
    },
  ],
  'discovery:contacts:whisker paw boutique': [
    {
      title: 'Whisker & Paw Boutique | About our team',
      url: 'https://whiskerpaw.example/team',
      excerpt:
        'Layla Ibrahim, Store Owner, leads buying and supplier relationships for the boutique.',
      publishedDate: null,
      score: 0.82,
    },
  ],
  'discovery:contacts:paws claws group': [
    {
      title: 'Khalid Mansoor – Head of Retail – Paws & Claws Group | LinkedIn',
      url: 'https://www.linkedin.com/in/khalid-mansoor-fixture',
      excerpt: 'Head of Retail at Paws & Claws Group. Abu Dhabi, United Arab Emirates.',
      publishedDate: null,
      score: 0.88,
    },
  ],
  'discovery:contacts:al reem veterinary centre': [
    {
      title: 'Dr Sara Qassim – Practice Manager – Al Reem Veterinary Centre | LinkedIn',
      url: 'https://www.linkedin.com/in/sara-qassim-fixture',
      excerpt:
        'Practice Manager at Al Reem Veterinary Centre. Abu Dhabi, United Arab Emirates.',
      publishedDate: null,
      score: 0.86,
    },
  ],
  'discovery:contacts:petkart middle east': [],
  'discovery:contacts:desert fins aquatics': [],
  'discovery:fit:desert fins aquatics': [
    {
      title: 'Desert Fins Aquatics | Livestock and dry goods',
      url: 'https://desertfins.example/stock',
      excerpt:
        'Marine and freshwater livestock, plus filtration, lighting and a small dry-goods aisle of foods and treatments.',
      publishedDate: null,
      score: 0.8,
    },
  ],
};
