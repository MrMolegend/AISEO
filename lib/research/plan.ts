import { MAX_RESULTS_PER_SEARCH } from '@/config/report';
import { countryName } from '@/config/markets';
import {
  ROUTE_LABEL,
  CUSTOMER_TYPE_LABEL,
  type MarketEntryInput,
} from '@/schemas/market-entry/input';
import type { SearchDepth, SearchBudget } from './budget';

/**
 * The research plan.
 *
 * Built in code from the intake, never by the model. Two reasons, and the
 * second is the important one. Asking the model to propose queries adds a round
 * trip before any research happens — but more than that, it makes the number of
 * paid provider calls a model decision rather than a budget decision, and a
 * model that decides how much money to spend is a model that will eventually
 * decide to spend more.
 *
 * The planner deliberately proposes more queries than the budget can grant.
 * That is not waste: it means the budget is doing real work rather than
 * decorating a list that already fits, and the ordering below is therefore a
 * genuine statement of priority. What survives the cut is what matters most.
 */

/** The ten investigation areas, in the order the brief names them. */
export const INVESTIGATION_AREAS = [
  'market-conditions',
  'demand',
  'competitors',
  'substitutes',
  'pricing',
  'buyers',
  'channels',
  'partners',
  'regulatory',
  'barriers',
  'approaches',
  'key-question',
] as const;

export type InvestigationArea = (typeof INVESTIGATION_AREAS)[number];

export const AREA_LABEL: Record<InvestigationArea, string> = {
  'market-conditions': 'Target-market conditions',
  demand: 'Demand indicators',
  competitors: 'Competitors',
  substitutes: 'Substitute products',
  pricing: 'Pricing and positioning',
  buyers: 'Customer and buyer types',
  channels: 'Distribution channels',
  partners: 'Distributor and retailer categories',
  regulatory: 'Import, licensing and regulation',
  barriers: 'Commercial barriers',
  approaches: 'Market-entry approaches',
  'key-question': 'Your specific question',
};

export interface PlannedQuery {
  area: InvestigationArea;
  depth: SearchDepth;
  text: string;
  maxResults: number;
  /** ISO 3166-1 alpha-2. Advisory at the provider; it weights rather than filters. */
  country: string;
}

/** Collapses whitespace and clips a phrase to something a query can carry. */
function phrase(value: string, words: number): string {
  return value.replace(/\s+/g, ' ').trim().split(' ').slice(0, words).join(' ');
}

/**
 * Proposes the full candidate list, in priority order.
 *
 * Advanced searches go to the three questions where breadth genuinely pays:
 * what the market looks like, what the rules are, and how goods physically
 * reach a buyer. Everything else is a focused follow-up, which is what a basic
 * search is good at.
 */
export function proposeQueries(input: MarketEntryInput): PlannedQuery[] {
  const target = countryName(input.targetCountry);
  const origin = countryName(input.originCountry);
  const region = input.targetRegion;
  const place = region ? `${region} ${target}` : target;
  const category = phrase(input.category, 6);
  const product = phrase(input.productName, 5);
  const buyer = CUSTOMER_TYPE_LABEL[input.intendedCustomer].toLowerCase();
  const route = ROUTE_LABEL[input.routeToMarket].toLowerCase();

  const query = (
    area: InvestigationArea,
    depth: SearchDepth,
    text: string,
    maxResults = MAX_RESULTS_PER_SEARCH,
  ): PlannedQuery => ({
    area,
    depth,
    text: text.replace(/\s+/g, ' ').trim(),
    maxResults,
    country: input.targetCountry,
  });

  const candidates: PlannedQuery[] = [
    // ── Advanced: breadth where it pays ────────────────────────────────────
    query(
      'market-conditions',
      'advanced',
      `${category} market in ${place} — size, demand and imported product landscape`,
    ),
    query(
      'regulatory',
      'advanced',
      `importing ${category} into ${target}: official product registration, labelling requirements, certification and customs duty`,
    ),
    query(
      'channels',
      'advanced',
      `how imported ${category} reaches ${buyer} in ${target}: distributors, importers and routes to market`,
    ),

    // ── Basic: focused follow-ups, in priority order ───────────────────────
    /*
     * One competitors query, seeded by the customer's own list when they gave
     * one. Their names are research seeds rather than limits — the query asks
     * where those brands are sold in the target market, which surfaces the
     * distributors and retailers that carry the category, not just those three
     * companies. Without a seed it asks the general form of the same question.
     */
    query(
      'competitors',
      'basic',
      input.knownCompetitors.length > 0
        ? `${input.knownCompetitors.slice(0, 3).join(' OR ')} sold in ${place}: stockists and distributors`
        : `imported ${category} brands sold in ${place}`,
    ),
    query('substitutes', 'basic', `alternatives to ${product} for ${buyer} in ${target}`),
    query('pricing', 'basic', `${category} retail prices ${place}`),
    query(
      'buyers',
      'basic',
      `${buyer} buying imported ${category} in ${target}: purchasing criteria and listing process`,
    ),
    query(
      'partners',
      'basic',
      `speciality ${category} importers and distributors directory ${target}`,
    ),
    query(
      'demand',
      'basic',
      `consumer demand and trends for premium imported ${category} in ${target}`,
    ),
    query(
      'barriers',
      'basic',
      `barriers and costs for small exporters entering the ${target} ${category} market`,
    ),
    query(
      'approaches',
      'basic',
      `${route} agreements in ${target}: commercial agency rules and how exporters structure entry`,
    ),
    // The customer's own question, asked more or less as they asked it. This
    // is the query most likely to make the report feel written for them.
    query('key-question', 'basic', `${phrase(input.keyQuestion, 18)} ${target}`),
    query(
      'market-conditions',
      'basic',
      `${target} food and consumer goods import statistics and trade data`,
    ),
    query(
      'pricing',
      'basic',
      `${category} wholesale and distributor margins ${target} import`,
    ),
    query(
      'demand',
      'basic',
      `${origin} exporters selling ${category} into ${target} case studies`,
    ),
  ];

  return candidates;
}

/**
 * Grants queries against a budget, in priority order.
 *
 * Returns only what the budget actually permitted, so the caller cannot
 * accidentally issue a search that was never claimed. A candidate whose depth
 * is exhausted is skipped rather than downgraded: an advanced query rewritten
 * as a basic one is a different search, and quietly substituting it would make
 * the plan's stated priorities untrue.
 */
export function grantQueries(
  candidates: readonly PlannedQuery[],
  budget: SearchBudget,
): PlannedQuery[] {
  const granted: PlannedQuery[] = [];
  for (const candidate of candidates) {
    if (budget.exhausted) break;
    if (budget.take(candidate.depth)) granted.push(candidate);
  }
  return granted;
}

/** The plan, as it will actually be executed. */
export function planSearches(
  input: MarketEntryInput,
  budget: SearchBudget,
): PlannedQuery[] {
  return grantQueries(proposeQueries(input), budget);
}
