/**
 * The illustrative case every fixture is built around.
 *
 * One fictional business, one real-shaped market-entry question, used in four
 * places: the example dossier on the marketing site, the homepage report
 * preview, the end-to-end tests, and the screenshot QA set. Keeping them all on
 * one case is deliberate — the example a visitor reads is produced by the same
 * code path a customer's report is, so a rendering bug cannot hide in the demo.
 *
 * Everything here is invented. The business does not exist, the sources are on
 * reserved demonstration domains that cannot resolve, and every surface that
 * renders it says so. See `ILLUSTRATIVE_NOTICE`.
 */

import type { MarketEntryInput } from '@/schemas/market-entry/input';
import { MARKET_ENTRY_PACKAGE_ID } from '@/config/report';

export const ILLUSTRATIVE_NOTICE =
  'Illustrative example. This business is fictional and these sources are demonstration addresses — no real market assessment is shown here.';

/**
 * The four-stage intake, in its **already-validated** form.
 *
 * Money is in integer minor units here — `currentPrice: 890` is €8.90 — because
 * this is what `marketEntryInputSchema` produces, not what a form posts. Do not
 * feed this object back through the schema: the money transform would multiply
 * by a hundred a second time and quietly turn €8.90 into €89. Use
 * `EXAMPLE_SUBMISSION` below for anything that exercises the submission path.
 */
export const EXAMPLE_INPUT: MarketEntryInput = {
  packageId: MARKET_ENTRY_PACKAGE_ID,

  // Stage 1 — the offer
  businessName: 'Ardmore Sea Salt',
  productName: 'Hand-harvested flake sea salt',
  offerDescription:
    'We hand-harvest flake sea salt from the Atlantic coast of County Waterford and pack it in 100g ceramic jars and 1kg catering pouches. It is unrefined, has no anti-caking agents, and is sold as a finishing salt to delicatessens, hotel kitchens and gift retailers.',
  category: 'Speciality food — condiments and seasonings',
  originCountry: 'IE',
  businessStatus: 'trading',
  supplyArrangements:
    'We harvest and pack in Waterford. One pallet-scale courier handles UK and EU shipments; we have never shipped outside the EU.',
  productCharacteristics:
    'Ambient, non-perishable, 3-year shelf life. Glass and ceramic packaging is heavy for its value. No allergens.',

  // Stage 2 — the target market
  targetCountry: 'AE',
  targetRegion: 'Dubai',
  routeToMarket: 'distributor',
  intendedCustomer: 'retailer',
  customerDescription:
    'Premium grocery halls and hotel procurement teams. The buyer we imagine is a speciality-food category manager at a Dubai grocery chain, or an executive chef sourcing finishing ingredients for a hotel restaurant group.',
  marketReason:
    'Two Dubai hotel groups bought from us at a London trade show and asked whether we had a distributor in the UAE. We do not, and we do not know whether the interest is representative.',

  // Stage 3 — commercial context
  currency: 'EUR',
  currentPrice: 890,
  unitCost: 310,
  targetPrice: 1200,
  launchBudget: 1500000,
  minimumOrderQuantity: 240,
  productionCapacity:
    'About 900kg a month at current staffing; we could reach 1,400kg with a second harvesting frame.',
  launchTimeframe: 'six-to-twelve-months',

  // Stage 4 — objectives and constraints
  primaryObjective:
    'Decide whether to commit to a UAE distributor agreement this year, or spend the same budget deepening our UK wholesale accounts instead.',
  biggestConcern:
    'That import registration and Arabic labelling cost more than the whole first year of orders is worth, and that we discover it after signing.',
  knownCompetitors: ['Maldon Salt', 'Halen Môn', 'Fleur de Sel de Guérande'],
  existingContacts:
    'Informal contact with a procurement manager at one Dubai hotel group. No distributor relationship.',
  knownRegulations:
    'We know food products need registration before import but not what that involves for salt specifically.',
  additionalContext:
    'We are a four-person business. Neither founder has exported outside the EU before.',
  keyQuestion:
    'Is there a realistic route to shelf in Dubai for a producer of our size, and what would it actually cost to get there?',
};

/** Shown wherever the example needs a one-line description. */
export const EXAMPLE_SUMMARY =
  'A four-person Irish sea-salt producer deciding whether to commit to a UAE distributor agreement.';

/**
 * The same case as a browser would post it.
 *
 * Decimal strings, because that is what a person types into a price field, and
 * the schema's job is to turn "8.90" into 890 exactly once. Used by the tests
 * that exercise submission and validation rather than rendering.
 */
export const EXAMPLE_SUBMISSION: Record<string, unknown> = {
  ...EXAMPLE_INPUT,
  currentPrice: '8.90',
  unitCost: '3.10',
  targetPrice: '12.00',
  launchBudget: '15000',
};
