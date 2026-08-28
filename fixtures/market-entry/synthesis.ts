import type { ModelReport } from '@/schemas/market-entry/report';

/**
 * The synthesis the fixture provider returns for the illustrative case.
 *
 * Written to be a genuinely good report rather than lorem ipsum, because it is
 * the document the example page shows a visitor, the one the screenshot QA is
 * judged against, and the one the end-to-end tests assert the renderer against.
 * A fixture full of "Competitor 1" would make every one of those exercises
 * worthless — you cannot tell whether a layout holds real content by looking at
 * placeholder content.
 *
 * Source refs match the registration order of fixtures/market-entry/search-results.ts.
 * Note that not every claim here reaches `verified`: two sources are blocked in
 * the fixture, and the claims resting on them are demoted to unverified by
 * lib/validation/market-entry.ts. That is deliberate. The example a visitor
 * reads should show the product being honest about a gap, because that is what
 * their own report will do.
 */
export const FIXTURE_SYNTHESIS: ModelReport = {
  executive: {
    summary:
      'There is a real route to shelf in Dubai for a producer of this size, and it runs through a consolidating importer rather than a direct retail relationship. The category exists, the provenance story travels, and the two named competitors are already there — which is evidence of a market rather than a reason to avoid it. The binding constraint is not demand: it is that import registration must be held by a UAE-licensed entity, so the distributor decision comes before the sales decision rather than after it. Registration and Arabic labelling are one-off costs that a portfolio importer spreads across several brands and a single-brand exporter carries alone. On the figures supplied, a first year at trial volumes does not repay that overhead by itself, which makes this a question about the second year.',
    attractiveness: {
      statement:
        'The market is attractive for the product but not yet proven for this business, because every demand signal found is about the category rather than about Irish flake salt specifically.',
      basis: 'inferred',
      confidence: 'medium',
      sources: [],
    },
    strongestOpportunity: {
      statement:
        'Hotel and restaurant procurement is the larger channel by value for finishing salts in the Gulf, and it is the channel where the two hotel groups who approached you already sit.',
      basis: 'sourced',
      confidence: 'medium',
      sources: ['S4', 'S5'],
    },
    largestObstacle: {
      statement:
        'A food product cannot be registered for import by its overseas producer — the registration is held by a UAE-licensed importer — so shelf access depends on a partner being appointed before any order can ship.',
      basis: 'measured',
      confidence: 'high',
      sources: ['S15'],
    },
    recommendedNextDecision:
      'Decide whether to spend the next quarter qualifying two or three consolidating importers, or to defer the UAE entirely and commit the same budget to UK wholesale. Do not decide on the distributor agreement itself yet — that decision is downstream of finding out what a portfolio importer would charge to carry your registration.',
  },

  commercialContext: {
    offerSummary:
      'Hand-harvested flake sea salt from County Waterford, unrefined and without anti-caking agents, sold in 100g ceramic jars and 1kg catering pouches as a finishing salt to delicatessens, hotel kitchens and gift retail.',
    currentSituation:
      'Trading, four people, harvesting and packing in Ireland. Distribution experience is UK and EU only, through a single pallet-scale courier. Neither founder has exported outside the EU.',
    routePreferenceNote:
      'You named distributor or agent as the intended route. The research supports that preference, and for a reason stronger than convenience: it is close to the only route open at your volume.',
    assumptions: [
      'Figures are read as euro at the values entered: €8.90 selling price, €3.10 unit cost, €12.00 target price, €15,000 launch budget.',
      'A 240-unit minimum order quantity is treated as the smallest shipment worth making.',
      'Ambient, three-year shelf life and no allergens are assumed correct, as they change which regulatory routes apply.',
      'No exchange-rate movement is modelled; all comparisons are at today’s stated figures.',
    ],
  },

  marketSignals: {
    demand: [
      {
        statement:
          'Finishing salts are described by category managers as a low-volume, high-margin line that anchors a premium seasoning fixture.',
        basis: 'sourced',
        confidence: 'medium',
        sources: ['S4'],
      },
      {
        statement:
          'Hotel food and beverage procurement teams report increasing use of named-provenance ingredients on menus.',
        basis: 'sourced',
        confidence: 'medium',
        sources: ['S5'],
      },
      {
        statement:
          'Premium and speciality grocery formats have continued to expand across the emirate, with fourteen new stores opened by three operators in the last reported year.',
        basis: 'sourced',
        confidence: 'medium',
        sources: ['S2', 'S3'],
      },
    ],
    growth: [
      {
        statement:
          'Total UAE food and beverage imports rose 6.1% year on year to AED 62.4 billion in 2024.',
        basis: 'measured',
        confidence: 'high',
        sources: ['S1'],
      },
    ],
    customerBehaviour: [
      {
        statement:
          'Most hospitality buying still runs through consolidated distributors rather than direct import, even where the buyer has chosen the brand.',
        basis: 'sourced',
        confidence: 'medium',
        sources: ['S5'],
      },
    ],
    trends: [
      {
        statement:
          'Producers under ten staff most often enter through a consolidating importer carrying several small brands, sharing registration overhead across a portfolio.',
        basis: 'sourced',
        confidence: 'medium',
        sources: ['S20'],
      },
    ],
    size: {
      value: 'AED 3.8 billion (prepared foods, sauces and condiments, 2024)',
      basis: 'measured',
      confidence: 'medium',
      sources: ['S1'],
      note: 'This is the containing category, not finishing salts. No source published a figure for flake or speciality salt specifically, so the addressable market for this product is not established.',
    },
    geographicNote:
      'Every source above is about the UAE, and three are specific to Dubai. Nothing here is extrapolated from a neighbouring market.',
    series: [],
  },

  competitive: {
    entries: [
      {
        id: 'maldon-salt',
        rank: 1,
        name: 'Maldon Salt',
        kind: 'direct',
        whyRelevant:
          'The closest analogue: an English flake sea salt with a provenance story, already distributed across the Gulf. If a buyer already stocks a flake salt, this is most likely the one.',
        productOverlap: {
          statement:
            'Flake sea salt in retail and catering formats — the same product form and the same fixture position.',
          basis: 'sourced',
          confidence: 'high',
          sources: ['S6'],
        },
        customerOverlap: {
          statement:
            'Sold through appointed Gulf distributors into premium grocery and hospitality supply, which is the channel you are considering.',
          basis: 'sourced',
          confidence: 'high',
          sources: ['S6'],
        },
        marketPresence: {
          statement:
            'Lists appointed distributors covering the Gulf region on its own stockist pages.',
          basis: 'sourced',
          confidence: 'medium',
          sources: ['S6'],
        },
        positioning:
          'Heritage English flake salt, widely recognised by chefs, positioned as the default premium finishing salt rather than as a discovery.',
        pricing: {
          value: null,
          basis: 'unavailable',
          confidence: 'low',
          sources: [],
          note: 'No source stated a UAE shelf price for this brand specifically. The category range at Carrefour is a proxy, not this brand’s price.',
        },
        strengths: [
          {
            statement:
              'Established distributor relationships across the Gulf, so a buyer can order it without any new registration work.',
            basis: 'sourced',
            confidence: 'medium',
            sources: ['S6'],
          },
        ],
        gaps: [
          {
            statement:
              'Ubiquity is itself a weakness in a fixture that is trying to look curated; a buyer building a speciality range has a reason to want something that is not already everywhere.',
            basis: 'inferred',
            confidence: 'low',
            sources: [],
          },
        ],
        confidence: 'medium',
        unknowns: ['Shelf price', 'Distributor terms', 'Rate of sale'],
      },
      {
        id: 'halen-mon',
        rank: 2,
        name: 'Halen Môn',
        kind: 'direct',
        whyRelevant:
          'A Welsh sea salt of comparable scale and positioning that has already solved the problem you are looking at — it reaches the Gulf through a regional speciality importer.',
        productOverlap: {
          statement:
            'Sea salt in retail and trade formats, sold on origin and hand-harvesting, which is the same claim you make.',
          basis: 'sourced',
          confidence: 'high',
          sources: ['S7'],
        },
        customerOverlap: {
          statement:
            'Gulf distribution handled through a regional speciality food importer rather than direct retail supply.',
          basis: 'sourced',
          confidence: 'high',
          sources: ['S7'],
        },
        marketPresence: {
          statement: 'States export to more than thirty markets including the Gulf.',
          basis: 'sourced',
          confidence: 'medium',
          sources: ['S7'],
        },
        positioning:
          'Small-producer provenance with a protected-origin story, sold as a considered purchase rather than a staple.',
        pricing: {
          value: null,
          basis: 'unavailable',
          confidence: 'low',
          sources: [],
          note: 'Not published for this market.',
        },
        strengths: [
          {
            statement:
              'Demonstrates that a producer of roughly your size can reach this market through a speciality importer — the route is proven, not theoretical.',
            basis: 'sourced',
            confidence: 'medium',
            sources: ['S7'],
          },
        ],
        gaps: [
          {
            statement:
              'Occupies the same provenance argument you would make, so a buyer already stocking it may see no reason for a second one.',
            basis: 'inferred',
            confidence: 'medium',
            sources: [],
          },
        ],
        confidence: 'medium',
        unknowns: ['Which importer', 'Listing breadth', 'Shelf price'],
      },
      {
        id: 'retailer-speciality-range',
        rank: 3,
        name: 'Spinneys speciality pantry range',
        kind: 'substitute',
        whyRelevant:
          'The shelf you would be listed on already carries flake, rock and speciality salts from European and regional producers. The relevant competition is often the incumbent facing, not a brand.',
        productOverlap: {
          statement:
            'The pantry range includes flake sea salts alongside rock salts and seasoning blends.',
          basis: 'sourced',
          confidence: 'medium',
          sources: ['S8'],
        },
        customerOverlap: {
          statement:
            'Premium grocery shoppers in Dubai — the same buyer your retail pack is aimed at.',
          basis: 'inferred',
          confidence: 'medium',
          sources: ['S8'],
        },
        marketPresence: {
          statement: 'A standing category in a national premium grocery chain.',
          basis: 'sourced',
          confidence: 'medium',
          sources: ['S8'],
        },
        positioning:
          'A curated fixture rather than a single brand — entry means displacing a facing, not creating one.',
        pricing: {
          value: 'AED 28–65 for imported speciality flake salt retail packs',
          basis: 'measured',
          confidence: 'medium',
          sources: ['S10'],
          note: 'Range observed across a competing retailer’s speciality salt listings, not this chain’s.',
        },
        strengths: [
          {
            statement:
              'The category is already established, so no buyer education is needed to explain what a finishing salt is.',
            basis: 'sourced',
            confidence: 'medium',
            sources: ['S8'],
          },
        ],
        gaps: [
          {
            statement:
              'A fixture that is already full is a fixture where a listing decision is a replacement decision.',
            basis: 'inferred',
            confidence: 'medium',
            sources: [],
          },
        ],
        confidence: 'medium',
        unknowns: ['Number of facings', 'Own-label presence', 'Listing fees'],
      },
      {
        id: 'online-grocery-pantry',
        rank: 4,
        name: 'Kibsons pantry seasonings',
        kind: 'adjacent',
        whyRelevant:
          'Online grocery is a lower-barrier first listing than a national chain, and it carries the same product category.',
        productOverlap: {
          statement:
            'Carries flake sea salt and Himalayan pink salt in a pantry seasonings range delivered across the UAE.',
          basis: 'sourced',
          confidence: 'medium',
          sources: ['S9'],
        },
        customerOverlap: {
          statement:
            'Reaches the same premium household buyer without requiring a physical fixture decision.',
          basis: 'inferred',
          confidence: 'low',
          sources: ['S9'],
        },
        marketPresence: {
          statement: 'National delivery coverage within the UAE.',
          basis: 'sourced',
          confidence: 'medium',
          sources: ['S9'],
        },
        positioning:
          'Convenience-led online grocery with a speciality tail — a plausible first listing rather than a destination.',
        pricing: {
          value: null,
          basis: 'unavailable',
          confidence: 'low',
          sources: [],
          note: 'Not established from the sources read.',
        },
        strengths: [
          {
            statement:
              'A route to a first UAE listing that does not require winning shelf space in a national chain.',
            basis: 'inferred',
            confidence: 'low',
            sources: ['S9'],
          },
        ],
        gaps: [
          {
            statement:
              'Still requires the same import registration, so it lowers the commercial barrier without lowering the regulatory one.',
            basis: 'inferred',
            confidence: 'medium',
            sources: ['S15'],
          },
        ],
        confidence: 'low',
        unknowns: ['Terms', 'Category volume', 'Whether they import directly'],
      },
    ],
    coverageNote:
      'Four entries: two direct competitors that are demonstrably present in the market, and two substitutes that represent the shelf itself. No source established rate of sale or shelf price for either named competitor, so relative performance is not assessed.',
  },

  customers: {
    groups: [
      {
        id: 'hotel-procurement',
        name: 'Hotel and restaurant group procurement',
        priority: 'primary',
        description:
          'Executive chefs and procurement managers at hotel groups sourcing finishing ingredients. This is where your existing inbound interest came from, and the sources indicate it is the larger channel by value for this category in the Gulf.',
        motivations: [
          {
            statement:
              'Named provenance on a menu is being used increasingly as a differentiator by hospitality buyers.',
            basis: 'sourced',
            confidence: 'medium',
            sources: ['S5'],
          },
        ],
        purchaseCriteria: [
          {
            statement:
              'Continuity of supply matters more than unit price at these volumes — a finishing salt that runs out mid-service is a menu change.',
            basis: 'inferred',
            confidence: 'medium',
            sources: [],
          },
        ],
        objections: [
          {
            statement:
              'Buying still runs through consolidated distributors even when the buyer has chosen the brand, so a producer without a distributor is difficult to buy from.',
            basis: 'sourced',
            confidence: 'high',
            sources: ['S5'],
          },
        ],
        channels: [
          'Appointed distributor’s hospitality desk',
          'Foodservice trade exhibitions',
          'Chef-led sampling through the distributor',
        ],
        confidence: 'medium',
      },
      {
        id: 'premium-grocery-category',
        name: 'Premium grocery category managers',
        priority: 'secondary',
        description:
          'Category managers at premium grocery chains deciding what occupies a speciality seasoning fixture. Slower to win and more administratively demanding than hospitality, but the channel that builds a brand rather than a supply line.',
        motivations: [
          {
            statement:
              'Speciality formats continue to expand, and a curated fixture needs products that are not already ubiquitous.',
            basis: 'sourced',
            confidence: 'low',
            sources: ['S2'],
          },
        ],
        purchaseCriteria: [
          {
            statement:
              'Listing decisions run from sample submission through registration verification to a trial period.',
            basis: 'sourced',
            confidence: 'low',
            sources: ['S12'],
          },
        ],
        objections: [
          {
            statement:
              'A fixture that is already full makes a listing a replacement decision rather than an addition.',
            basis: 'inferred',
            confidence: 'medium',
            sources: ['S8'],
          },
        ],
        channels: [
          'Distributor’s retail account team',
          'Category review cycles',
          'In-store sampling',
        ],
        confidence: 'low',
      },
    ],
    uncertaintyNote:
      'The listing-process description could not be read directly — the chamber source blocked automated access, so it is carried as an indexed signal only and is labelled accordingly. No individual buyers are named anywhere in this report, and none should be inferred from it.',
  },

  route: {
    options: [
      {
        id: 'local-distributor',
        suitability: 'strong',
        rationale:
          'A UAE-licensed importer can hold the registration your business cannot hold itself, and a consolidating importer spreads that overhead across a portfolio rather than charging it to one brand.',
        requirements: [
          'An importer licensed in the UAE willing to hold the product registration',
          'Arabic and English label artwork meeting the mandatory particulars',
          'A defined trial territory and period before any agency registration',
        ],
        advantages: [
          'Fastest route to a first order',
          'Registration overhead shared rather than borne alone',
          'No local entity required',
        ],
        risks: [
          'Commercial agency registration is difficult to reverse once made',
          'Margin and shelf price move out of your control',
        ],
        evidence: [
          {
            statement:
              'The common route for a first-time exporter is an appointed distributor who already holds importer licensing and can carry the registration.',
            basis: 'measured',
            confidence: 'high',
            sources: ['S13'],
          },
          {
            statement:
              'Producers under ten staff most often enter through a consolidating importer carrying several small brands.',
            basis: 'sourced',
            confidence: 'medium',
            sources: ['S20'],
          },
        ],
      },
      {
        id: 'ecommerce',
        suitability: 'possible',
        rationale:
          'An online grocery listing is a lower commercial barrier than a national chain and reaches the same household buyer, but it does not remove the registration requirement.',
        requirements: [
          'The same import registration held by a licensed entity',
          'Compliant labelling',
        ],
        advantages: [
          'Lower barrier to a first listing',
          'Faster feedback on rate of sale',
        ],
        risks: [
          'Does not build the hospitality channel where your inbound interest came from',
          'Regulatory cost unchanged for a smaller commercial prize',
        ],
        evidence: [
          {
            statement:
              'National online grocery carries the same speciality salt category with UAE-wide delivery.',
            basis: 'sourced',
            confidence: 'medium',
            sources: ['S9'],
          },
        ],
      },
      {
        id: 'retail-partnership',
        suitability: 'weak',
        rationale:
          'Supplying a retailer directly requires you or a nominated agent to hold the import registration, and retailers rarely take that on for a single small line.',
        requirements: ['Registration held by you or a nominated agent', 'Local presence'],
        advantages: ['Margin retained', 'Pricing control'],
        risks: ['Administratively out of reach at your size', 'Slow to a first order'],
        evidence: [
          {
            statement:
              'Retailers rarely take on the registration administration for a single small line.',
            basis: 'measured',
            confidence: 'high',
            sources: ['S13'],
          },
        ],
      },
      {
        id: 'direct-wholesale',
        suitability: 'unsuitable',
        rationale:
          'Direct wholesale into the UAE is not open to an overseas producer without a licensed importer in the chain — the registration cannot be held in your own name.',
        requirements: ['A UAE-licensed entity in the chain regardless'],
        advantages: [],
        risks: ['Not a route that exists at this structure'],
        evidence: [
          {
            statement:
              'A producer outside the country cannot register a product in its own name; the registration is held by the importer.',
            basis: 'measured',
            confidence: 'high',
            sources: ['S15'],
          },
        ],
      },
    ],
    primary: 'local-distributor',
    fallback: 'ecommerce',
    recommendation:
      'Appoint a consolidating speciality importer under an unregistered distribution agreement for a defined trial, and keep commercial agency registration explicitly off the table until a second order has been placed and paid. This fits because the binding constraint is regulatory rather than commercial: you need a licensed entity in the chain before anything can ship, and a portfolio importer is the only version of that which does not put the whole registration cost against your first shipment.',
    firstSteps: [
      'Qualify three consolidating speciality importers and ask each what they charge to carry a registration for a single SKU.',
      'Price Arabic and English artwork origination and a first compliant sticker run before committing to anything.',
      'Confirm with the ministry, or through the importer, whether unrefined flake salt has any product-specific requirement beyond standard food registration.',
      'Agree a trial territory and period in writing, with agency registration expressly excluded.',
    ],
  },

  pricing: {
    researchedBenchmarks: [
      {
        statement:
          'Imported speciality flake salt retail packs are listed between AED 28 and AED 65 at a national grocery chain.',
        basis: 'measured',
        confidence: 'medium',
        sources: ['S10'],
      },
      {
        statement:
          'Imported premium pantry lines commonly sit at a three to four times landed-cost retail multiple, covering distributor margin, retailer margin and listing costs.',
        basis: 'sourced',
        confidence: 'low',
        sources: ['S11'],
      },
    ],
    suggestedPositioning:
      'Your €8.90 ex-works price is compatible with the observed AED 28–65 shelf range only if the chain multiple sits at the lower end of what the trade press describes. At a four times multiple the pack lands above the observed range, which is the number to test with an importer before artwork is commissioned — it is the difference between a listing conversation and a polite no.',
    assumptions: [
      'The retail range observed at one chain is treated as indicative of the category, not of any specific brand.',
      'Landed cost is not modelled: no source established freight, duty handling or distributor margin for this lane.',
      'The five percent tariff is applied to customs value, not to shelf price.',
    ],
    missingData: [
      'Freight cost per pallet on the Ireland to Jebel Ali lane',
      'Distributor margin expectation for a single-SKU speciality line',
      'Retailer listing fees, if any',
      'Cost of Arabic artwork origination and a first sticker run',
    ],
    note: 'The retail multiple above rests on a trade-press page that could not be retrieved directly, so it is carried as an indexed signal and labelled unverified. Do not build a price list on it.',
  },

  regulation: {
    requirements: [
      {
        id: 'food-import-registration',
        area: 'import',
        title: 'Product registration before first import',
        detail:
          'All food products imported for commercial sale must be registered before first import. The submission is made by a food establishment licensed in the UAE — not by the overseas producer — and requires the product specification, the full ingredient declaration, the shelf-life basis and label artwork. A complete submission is assessed within twenty working days; an incomplete one is returned and restarts that period.',
        verifyWith: 'Ministry of Climate Change and Environment',
        evidence: [
          {
            statement:
              'Registration is submitted by a UAE-licensed food establishment and requires specification, ingredient declaration and label artwork in Arabic and English.',
            basis: 'measured',
            confidence: 'high',
            sources: ['S15'],
          },
        ],
        confidence: 'high',
      },
      {
        id: 'arabic-labelling',
        area: 'labelling',
        title: 'Arabic labelling of mandatory particulars',
        detail:
          'Retail labels must show the product name, ingredients in descending order of weight, net content, country of origin, production and expiry dates, and the importer’s name and address. These particulars must appear in Arabic; English may sit alongside but does not substitute for it. Where artwork has not been reprinted, compliant stickers may be applied before release from the port provided no mandatory particular of the original label is obscured.',
        verifyWith: 'Dubai Municipality Food Safety Department',
        evidence: [
          {
            statement:
              'Mandatory particulars must appear in Arabic; English may appear alongside but does not replace it.',
            basis: 'measured',
            confidence: 'high',
            sources: ['S16'],
          },
          {
            statement:
              'Stickering before release from the port is permitted where no mandatory particular is obscured.',
            basis: 'measured',
            confidence: 'high',
            sources: ['S16'],
          },
        ],
        confidence: 'high',
      },
      {
        id: 'tariff-chapter-25',
        area: 'tax-customs',
        title: 'Five percent GCC common external tariff',
        detail:
          'Salt, including table salt and denatured salt, falls in chapter 25 of the tariff schedule. The GCC common external tariff applies five percent of customs value to this chapter, subject to standard exemptions. Customs value is not shelf price, so this is a smaller number than it first appears — but it applies before any of your margin does.',
        verifyWith: 'Federal customs authority, or your appointed importer’s broker',
        evidence: [
          {
            statement:
              'The GCC common external tariff rate applied to chapter 25 is five percent of the customs value.',
            basis: 'measured',
            confidence: 'high',
            sources: ['S17'],
          },
        ],
        confidence: 'high',
      },
    ],
    gaps: [
      'Whether unrefined hand-harvested salt attracts any product-specific requirement beyond standard food registration was not established by any source read.',
      'Halal certification requirements for a single-ingredient mineral product were not addressed by any source found.',
      'No source stated the fee schedule for registration itself.',
    ],
  },

  risks: [
    {
      id: 'agency-lock-in',
      title: 'Commercial agency registration is hard to undo',
      description:
        'A registered commercial agency creates significant protections for the appointed agent, including exclusivity and difficulty of termination. Signing one to secure a first order can cost control of the market for years.',
      probability: 'medium',
      impact: 'high',
      mitigation:
        'Begin with an unregistered distribution agreement covering a defined territory and a fixed trial period. Exclude agency registration expressly in writing rather than leaving it unmentioned.',
      evidence: [
        {
          statement:
            'A registered commercial agency creates significant protections for the appointed agent, including exclusivity and difficulty of termination.',
          basis: 'measured',
          confidence: 'high',
          sources: ['S19'],
        },
      ],
      confidence: 'high',
    },
    {
      id: 'registration-overhead',
      title: 'Fixed entry costs exceed first-year gross margin',
      description:
        'Registration lead time, Arabic artwork origination and a compliant first sticker run are one-off costs that do not scale down with a small first order. At a 240-unit minimum order quantity, the first shipment cannot repay them.',
      probability: 'high',
      impact: 'medium',
      mitigation:
        'Ask each candidate importer what they charge to carry a registration, and treat the answer as the entry price. Decide on the second year, not the first.',
      evidence: [
        {
          statement:
            'First-time exporters commonly underestimate registration lead time, Arabic artwork origination and the cost of a compliant first sticker run.',
          basis: 'sourced',
          confidence: 'medium',
          sources: ['S18'],
        },
      ],
      confidence: 'medium',
    },
    {
      id: 'unrepresentative-interest',
      title: 'Two hotel enquiries are not a demand signal',
      description:
        'The inbound interest that prompted this question came from two buyers at one trade show. Nothing found in this research establishes demand for Irish flake salt specifically, as distinct from the category.',
      probability: 'medium',
      impact: 'high',
      mitigation:
        'Before committing, ask the importer candidates whether they would take the line on their own assessment — a portfolio importer who declines is a stronger signal than two enthusiastic chefs.',
      evidence: [],
      confidence: 'medium',
    },
    {
      id: 'shelf-price-ceiling',
      title: 'Landed cost may push the pack above the observed shelf range',
      description:
        'If the chain multiple sits at the upper end of what the trade press describes, your pack lands above the AED 28–65 range observed in the category, which makes a listing conversation much harder.',
      probability: 'medium',
      impact: 'medium',
      mitigation:
        'Get a landed-cost and shelf-price estimate from an importer before commissioning artwork. It is a cheap question and it is decisive.',
      evidence: [
        {
          statement:
            'Imported speciality flake salt retail packs are listed between AED 28 and AED 65.',
          basis: 'measured',
          confidence: 'medium',
          sources: ['S10'],
        },
      ],
      confidence: 'medium',
    },
    {
      id: 'packaging-weight',
      title: 'Heavy packaging on a low-value unit',
      description:
        'Ceramic jars and glass are heavy relative to the value of the salt inside them, which makes freight a larger share of landed cost on a long lane than it is on your EU routes.',
      probability: 'high',
      impact: 'medium',
      mitigation:
        'Price the catering pouch as the entry format and treat the ceramic jar as a follow-on once volume justifies the freight.',
      evidence: [],
      confidence: 'low',
    },
  ],

  plan: {
    actions: [
      {
        id: 'qualify-importers',
        phase: 'days-1-30',
        title: 'Qualify three consolidating speciality importers',
        detail:
          'Identify importers already carrying several small European food brands and ask each the same three questions: will you hold the registration, what does that cost, and what shelf price would this land at.',
        priority: 'critical',
        owner: 'founder',
        expectedOutcome:
          'Three comparable answers on registration cost and likely shelf price — the two numbers this decision turns on.',
        dependsOn: null,
        reasoning:
          'The route is distributor-led because registration cannot be held by an overseas producer, so partner qualification is the first real step rather than a later one.',
      },
      {
        id: 'price-artwork',
        phase: 'days-1-30',
        title: 'Price Arabic artwork and a first sticker run',
        detail:
          'Get two quotes for Arabic and English artwork origination covering the mandatory particulars, and one for a compliant sticker run at 240 units.',
        priority: 'high',
        owner: 'operations',
        expectedOutcome: 'A firm figure for the largest predictable one-off cost.',
        dependsOn: null,
        reasoning:
          'Labelling is a known, sourced requirement; costing it early turns the biggest stated concern into a number rather than a fear.',
      },
      {
        id: 'confirm-product-rules',
        phase: 'days-1-30',
        title: 'Confirm whether unrefined salt has product-specific requirements',
        detail:
          'Ask the ministry directly, or through a candidate importer, whether hand-harvested unrefined salt attracts any requirement beyond standard food registration.',
        priority: 'high',
        owner: 'external-adviser',
        expectedOutcome:
          'A written answer on the one regulatory gap this research could not close.',
        dependsOn: null,
        reasoning:
          'No source read addressed this. It is named as a gap rather than assumed away, and it is cheap to resolve at source.',
      },
      {
        id: 'shortlist-partner',
        phase: 'days-31-60',
        title: 'Shortlist one importer and agree trial terms',
        detail:
          'Select on portfolio fit and registration cost, and agree a defined territory and a fixed trial period in writing with commercial agency registration expressly excluded.',
        priority: 'critical',
        owner: 'founder',
        expectedOutcome:
          'A signed trial agreement that does not create agency protections.',
        dependsOn: 'qualify-importers',
        reasoning:
          'Agency registration is the highest-impact irreversible risk in this entry; excluding it explicitly is the mitigation.',
      },
      {
        id: 'submit-registration',
        phase: 'days-31-60',
        title: 'Submit the product registration through the importer',
        detail:
          'Provide specification, ingredient declaration, shelf-life basis and final artwork so the importer can submit a complete application first time.',
        priority: 'critical',
        owner: 'operations',
        expectedOutcome:
          'Registration under assessment, with the twenty-working-day clock running from a complete submission.',
        dependsOn: 'shortlist-partner',
        reasoning:
          'An incomplete submission restarts the assessment period, so completeness at first submission is worth more than speed to submit.',
      },
      {
        id: 'sample-hospitality',
        phase: 'days-31-60',
        title: 'Run chef sampling through the importer’s hospitality desk',
        detail:
          'Use the two existing hotel-group contacts as the first sampling targets, but run them through the importer so the buying route is proven at the same time as the product.',
        priority: 'normal',
        owner: 'sales',
        expectedOutcome:
          'Evidence of whether the inbound interest converts when it has to go through a distributor.',
        dependsOn: 'shortlist-partner',
        reasoning:
          'Hospitality buying runs through distributors even when the buyer has chosen the brand, so testing the product without testing the route proves little.',
      },
      {
        id: 'first-shipment',
        phase: 'days-61-90',
        title: 'Ship the first order at minimum viable volume',
        detail:
          'Ship the 240-unit minimum in catering pouch format, keeping the ceramic jar back until freight economics are proven.',
        priority: 'high',
        owner: 'operations',
        expectedOutcome:
          'A landed shipment and a real landed-cost figure rather than an estimate.',
        dependsOn: 'submit-registration',
        reasoning:
          'Heavy packaging on a low-value unit is the freight risk; leading with the lighter format tests the lane at lower cost.',
      },
      {
        id: 'review-decision',
        phase: 'days-61-90',
        title: 'Hold the second-year decision review',
        detail:
          'With real landed cost, a real shelf price and one order of sell-through, decide whether to continue, and only then whether any longer-term agreement is warranted.',
        priority: 'critical',
        owner: 'founder',
        expectedOutcome:
          'A go or no-go on the second year taken against evidence rather than against the trade-show enthusiasm that started this.',
        dependsOn: 'first-shipment',
        reasoning:
          'Fixed entry costs cannot be repaid by a first shipment, so the honest decision point is the second year, and it should be scheduled rather than drifted into.',
      },
    ],
  },

  appendix: {
    limitations: [
      {
        area: 'Product-specific demand',
        detail:
          'Every demand signal found is about the finishing-salt category or about premium imported food generally. No source established demand for Irish flake sea salt specifically, so the report cannot tell you whether your product travels — only that the category exists.',
        howToResolve:
          'A portfolio importer’s own assessment is the cheapest available proxy for this.',
      },
      {
        area: 'Landed cost',
        detail:
          'No source established freight rates on the Ireland to Jebel Ali lane, distributor margin expectations for a single-SKU line, or retailer listing fees. The pricing section therefore models nothing beyond the figures you supplied.',
        howToResolve:
          'A freight quote and an importer margin expectation would close this.',
      },
      {
        area: 'Blocked sources',
        detail:
          'Two sources could not be read directly: a chamber of commerce page on grocery listing processes refused automated access, and a trade-press page on retail price architecture did not respond. Both are cited from index summaries only and the claims resting on them are labelled unverified.',
        howToResolve: 'Both are readable by a person in a browser.',
      },
      {
        area: 'Competitor performance',
        detail:
          'Neither named competitor publishes UAE shelf prices or rate of sale, so their relative performance is not assessed and no market-share figure appears anywhere in this report.',
        howToResolve: null,
      },
      {
        area: 'Regulatory scope',
        detail:
          'This report describes requirements as published by the authorities named. It is research, not legal or regulatory advice, and requirements change. Confirm anything you are about to spend money against with the named authority or a qualified adviser before committing.',
        howToResolve: null,
      },
    ],
    evidenceGaps: [
      'Registration fee schedule',
      'Halal certification requirements for single-ingredient mineral products',
      'Freight cost per pallet, Ireland to Jebel Ali',
      'Distributor margin expectation for a single-SKU speciality line',
      'Retailer listing fees',
    ],
  },
};
