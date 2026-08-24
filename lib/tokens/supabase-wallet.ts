import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/supabase/database.types';
import { PlatformError } from '@/lib/errors';
import { logger } from '@/lib/observability/logger';
import {
  TRANSACTION_TYPES,
  type CreditingType,
  type LedgerEntry,
  type MutationResult,
  type TokenWallet,
  type TransactionType,
  type WalletBalance,
} from './types';

/**
 * Supabase token wallet.
 *
 * Every mutation is one RPC call. That is the whole design: this module cannot
 * do arithmetic on a balance even if someone asked it to, because service_role
 * holds SELECT on token_wallets and nothing else. The read-decide-write race is
 * not guarded against here — it is unrepresentable.
 *
 * The functions raise custom SQLSTATEs, which arrive as `error.code`. They are
 * mapped to the platform taxonomy below so that "not enough tokens" is a typed
 * 402 rather than a 500 with a Postgres message in it.
 */

/** SQLSTATEs raised by the migration's functions. */
const PG_INSUFFICIENT = 'RS001';
const PG_NO_RESERVATION = 'RS002';
const PG_INVALID_AMOUNT = 'RS003';
const PG_LEDGER_IMMUTABLE = 'RS004';

interface PostgrestLikeError {
  code?: string | null;
  message?: string | null;
  details?: string | null;
}

/**
 * Turns a database failure into a typed platform failure.
 *
 * The raw message is kept only as the Error message, which is logged and never
 * rendered — Postgres exception text carries schema detail that has no business
 * reaching a browser.
 */
function mapWalletError(error: PostgrestLikeError, operation: string): PlatformError {
  const code = error.code ?? '';
  const message = error.message ?? 'Unknown wallet error';

  if (code === PG_INSUFFICIENT) {
    return new PlatformError('INSUFFICIENT_TOKENS', message, { context: { operation } });
  }
  if (code === PG_NO_RESERVATION || code === PG_INVALID_AMOUNT) {
    return new PlatformError('WALLET_ERROR', message, { context: { operation, code } });
  }
  if (code === PG_LEDGER_IMMUTABLE) {
    // Only reachable if something tried to edit history, which is a bug worth
    // shouting about rather than a user-facing condition.
    logger.error('wallet.ledger_mutation_attempted', { operation });
    return new PlatformError('WALLET_ERROR', message, { context: { operation, code } });
  }
  return new PlatformError('WALLET_ERROR', message, { context: { operation, code } });
}

function isTransactionType(value: string): value is TransactionType {
  return (TRANSACTION_TYPES as readonly string[]).includes(value);
}

type MutationRow = {
  out_ledger_id: string | null;
  out_available: number;
  out_reserved: number;
  out_replayed: boolean;
};

/**
 * The RPCs return a one-row table, so supabase-js hands back an array.
 *
 * An empty array means the function returned no row, which for these functions
 * should be impossible — treating it as a failure rather than defaulting to a
 * zero balance keeps a silent bug from looking like an empty wallet.
 */
function firstRow(rows: MutationRow[] | null, operation: string): MutationRow {
  const row = rows?.[0];
  if (!row) {
    throw new PlatformError('WALLET_ERROR', `${operation} returned no row`, {
      context: { operation },
    });
  }
  return row;
}

function toResult(row: MutationRow): MutationResult {
  return {
    ledgerId: row.out_ledger_id,
    available: row.out_available,
    reserved: row.out_reserved,
    replayed: row.out_replayed,
  };
}

export class SupabaseTokenWallet implements TokenWallet {
  readonly name = 'supabase';
  private readonly client: SupabaseClient<Database>;

  constructor(url: string, serviceRoleKey: string) {
    this.client = createClient<Database>(url, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async bootstrap(
    userId: string,
    options: { displayName?: string | null; welcomeTokens: number },
  ): Promise<WalletBalance> {
    const { data, error } = await this.client.rpc('rs_bootstrap_account', {
      p_user_id: userId,
      p_display_name: options.displayName ?? undefined,
      p_welcome_tokens: options.welcomeTokens,
      // Keyed on the user, so the welcome credit survives any number of
      // sign-ins without ever applying twice.
      p_idempotency_key: `welcome:${userId}`,
    });

    if (error) throw mapWalletError(error, 'bootstrap');

    const row = data?.[0];
    if (!row) {
      throw new PlatformError('WALLET_ERROR', 'bootstrap returned no row');
    }
    return { available: row.out_available, reserved: row.out_reserved };
  }

  async getBalance(userId: string): Promise<WalletBalance> {
    const { data, error } = await this.client
      .from('token_wallets')
      .select('available_balance, reserved_balance')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw mapWalletError(error, 'getBalance');

    // No wallet row yet is a real state — a user who signed in but has not been
    // bootstrapped — and an empty wallet is the honest answer.
    if (!data) return { available: 0, reserved: 0 };

    return { available: data.available_balance, reserved: data.reserved_balance };
  }

  async reserve(input: {
    userId: string;
    jobId: string;
    amount: number;
    idempotencyKey: string;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<MutationResult> {
    const { data, error } = await this.client.rpc('rs_reserve_tokens', {
      p_user_id: input.userId,
      p_job_id: input.jobId,
      p_amount: input.amount,
      p_idempotency_key: input.idempotencyKey,
      p_description: input.description,
      p_metadata: (input.metadata ?? {}) as never,
    });

    if (error) throw mapWalletError(error, 'reserve');
    return toResult(firstRow(data, 'reserve'));
  }

  async finalize(input: {
    userId: string;
    jobId: string;
    idempotencyKey: string;
  }): Promise<MutationResult> {
    const { data, error } = await this.client.rpc('rs_finalize_tokens', {
      p_user_id: input.userId,
      p_job_id: input.jobId,
      p_idempotency_key: input.idempotencyKey,
    });

    if (error) throw mapWalletError(error, 'finalize');
    return toResult(firstRow(data, 'finalize'));
  }

  async refund(input: {
    userId: string;
    jobId: string;
    idempotencyKey: string;
    reason: string;
  }): Promise<MutationResult> {
    const { data, error } = await this.client.rpc('rs_refund_tokens', {
      p_user_id: input.userId,
      p_job_id: input.jobId,
      p_idempotency_key: input.idempotencyKey,
      p_reason: input.reason,
    });

    if (error) throw mapWalletError(error, 'refund');
    return toResult(firstRow(data, 'refund'));
  }

  async grant(input: {
    userId: string;
    amount: number;
    type: CreditingType;
    idempotencyKey: string;
    description: string;
    metadata?: Record<string, unknown>;
  }): Promise<MutationResult> {
    const { data, error } = await this.client.rpc('rs_grant_tokens', {
      p_user_id: input.userId,
      p_amount: input.amount,
      p_transaction_type: input.type,
      p_idempotency_key: input.idempotencyKey,
      p_description: input.description,
      p_metadata: (input.metadata ?? {}) as never,
    });

    if (error) throw mapWalletError(error, 'grant');
    return toResult(firstRow(data, 'grant'));
  }

  async history(userId: string, limit = 50): Promise<LedgerEntry[]> {
    const { data, error } = await this.client
      .from('token_ledger')
      .select(
        'id, research_job_id, transaction_type, amount, balance_after, description, metadata, created_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(Math.min(limit, 200));

    if (error) throw mapWalletError(error, 'history');

    return (data ?? []).map((row) => ({
      id: row.id,
      jobId: row.research_job_id,
      // A row whose type the application does not recognise is a row written by
      // a newer deployment. Showing it as 'adjustment' is better than crashing
      // the wallet page during a rollout.
      type: isTransactionType(row.transaction_type) ? row.transaction_type : 'adjustment',
      amount: row.amount,
      balanceAfter: row.balance_after,
      description: row.description,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
      createdAt: new Date(row.created_at).toISOString(),
    }));
  }
}
