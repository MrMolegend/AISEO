/**
 * The token wallet boundary.
 *
 * Two implementations sit behind this: Supabase, which delegates every mutation
 * to a locking database function, and an in-memory driver for tests and for
 * local work without credentials. The interface is written so that the memory
 * driver cannot accidentally be more permissive than the real one — every
 * operation takes an idempotency key, because the real one requires it.
 *
 * Note what is absent: there is no `setBalance`. A balance is only ever the
 * result of an operation with a reason attached, which is what makes the ledger
 * a complete account of how it got there.
 */

export const TRANSACTION_TYPES = [
  'admin_grant',
  'welcome_credit',
  'reservation',
  'debit',
  'refund',
  'purchase',
  'adjustment',
] as const;

export type TransactionType = (typeof TRANSACTION_TYPES)[number];

/** Types that add spendable tokens. Only these may be passed to grant(). */
export const CREDITING_TYPES = [
  'admin_grant',
  'welcome_credit',
  'purchase',
  'adjustment',
] as const;

export type CreditingType = (typeof CREDITING_TYPES)[number];

export interface WalletBalance {
  /** Spendable now. */
  available: number;
  /** Held against jobs that are still running. */
  reserved: number;
}

export interface LedgerEntry {
  id: string;
  jobId: string | null;
  type: TransactionType;
  /** Signed change to the available balance. */
  amount: number;
  /** Available balance immediately after this entry. */
  balanceAfter: number;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface MutationResult extends WalletBalance {
  ledgerId: string | null;
  /**
   * True when this call matched an earlier one and changed nothing.
   *
   * Surfaced rather than hidden because the caller often wants to behave
   * differently: a replayed reservation means "this submission is already in
   * flight", not "your tokens were taken again".
   */
  replayed: boolean;
}

export interface TokenWallet {
  readonly name: string;

  /** Creates the profile and wallet if absent, applying any one-time welcome credit. */
  bootstrap(
    userId: string,
    options: { displayName?: string | null; welcomeTokens: number },
  ): Promise<WalletBalance>;

  getBalance(userId: string): Promise<WalletBalance>;

  /** Moves tokens from available to reserved. Refuses rather than overdrawing. */
  reserve(input: {
    userId: string;
    jobId: string;
    amount: number;
    idempotencyKey: string;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<MutationResult>;

  /** Turns an outstanding hold into a spend. */
  finalize(input: {
    userId: string;
    jobId: string;
    idempotencyKey: string;
  }): Promise<MutationResult>;

  /** Returns an outstanding hold to the spendable balance. */
  refund(input: {
    userId: string;
    jobId: string;
    idempotencyKey: string;
    reason: string;
  }): Promise<MutationResult>;

  /** Adds tokens outside a job: an operator grant, or a future purchase. */
  grant(input: {
    userId: string;
    amount: number;
    type: CreditingType;
    idempotencyKey: string;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<MutationResult>;

  history(userId: string, limit?: number): Promise<LedgerEntry[]>;
}
