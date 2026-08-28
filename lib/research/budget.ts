import { SEARCH_BUDGET } from '@/config/report';

export type SearchDepth = 'basic' | 'advanced';

export interface SearchUsage {
  basic: number;
  advanced: number;
  total: number;
}

/**
 * The server-side ceiling on paid search.
 *
 * The plan proposes; this disposes. Every call to the research provider must be
 * preceded by a successful `take()`, so the number of paid requests a job can
 * make is a property of this object rather than an emergent consequence of how
 * the planner happened to compose its queries. That distinction is the whole
 * reason it exists as a class rather than as a `.slice(0, 12)` somewhere: a
 * slice enforces a list length, not a spend, and it silently stops enforcing
 * anything the moment someone adds a second loop.
 *
 * Advanced searches are metered separately because they cost several times a
 * basic one at the provider. A budget that counted only the total would permit
 * twelve advanced searches, which is a different bill entirely.
 *
 * There is no way to reset or extend an instance. One job, one budget.
 */
export class SearchBudget {
  readonly limits: { basic: number; advanced: number; total: number };
  #basic = 0;
  #advanced = 0;

  constructor(
    limits: { basic: number; advanced: number; total: number } = SEARCH_BUDGET,
  ) {
    this.limits = { ...limits };
  }

  /**
   * Claims one search of the given depth.
   *
   * Returns false rather than throwing: exhausting the budget is the expected
   * end of a research pass, not an error. The caller stops asking; it does not
   * catch anything.
   */
  take(depth: SearchDepth): boolean {
    if (this.#basic + this.#advanced >= this.limits.total) return false;
    if (depth === 'advanced') {
      if (this.#advanced >= this.limits.advanced) return false;
      this.#advanced += 1;
      return true;
    }
    if (this.#basic >= this.limits.basic) return false;
    this.#basic += 1;
    return true;
  }

  /** Whether a search of this depth would be permitted, without claiming it. */
  canTake(depth: SearchDepth): boolean {
    if (this.#basic + this.#advanced >= this.limits.total) return false;
    return depth === 'advanced'
      ? this.#advanced < this.limits.advanced
      : this.#basic < this.limits.basic;
  }

  get usage(): SearchUsage {
    return {
      basic: this.#basic,
      advanced: this.#advanced,
      total: this.#basic + this.#advanced,
    };
  }

  get exhausted(): boolean {
    return this.#basic + this.#advanced >= this.limits.total;
  }
}
