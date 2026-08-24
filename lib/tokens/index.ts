import 'server-only';
import { getEnv, hasSupabase } from '@/lib/env';
import { MemoryTokenWallet } from './memory-wallet';
import type { TokenWallet } from './types';

export type {
  TokenWallet,
  WalletBalance,
  LedgerEntry,
  MutationResult,
  TransactionType,
  CreditingType,
} from './types';
export { TRANSACTION_TYPES, CREDITING_TYPES } from './types';

let cached: TokenWallet | null = null;

/**
 * Resolves the wallet driver.
 *
 * Falls back to the in-memory driver when Supabase is not configured rather
 * than throwing, so a developer with no credentials still gets a working
 * application. The health endpoint reports which driver is live and calls
 * production degraded if it is this one, so the fallback cannot ship silently.
 */
export async function getTokenWallet(): Promise<TokenWallet> {
  if (cached) return cached;

  const env = getEnv();
  if (!hasSupabase(env)) {
    cached = new MemoryTokenWallet();
    return cached;
  }

  // Imported lazily so supabase-js is not loaded in memory mode.
  const { SupabaseTokenWallet } = await import('./supabase-wallet');
  cached = new SupabaseTokenWallet(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  return cached;
}

/** Test-only: clears the memoised driver so env changes take effect. */
export function resetTokenWalletCache(): void {
  cached = null;
}
