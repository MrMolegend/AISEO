import 'server-only';
import { getEnv, hasSupabase } from '@/lib/env';
import type { AuditStore, LeadStore } from './types';
import { MemoryAuditStore, MemoryLeadStore } from './memory-store';
import { logger } from '@/lib/observability/logger';

export type { AuditRecord, AuditStore, LeadStore, LeadInput } from './types';

let auditStore: AuditStore | null = null;
let leadStore: LeadStore | null = null;

/**
 * Selects the storage driver.
 *
 * The in-memory driver is a development convenience, not a fallback that should
 * ever be reached in production — serverless instances do not share memory, so a
 * polling request would frequently land on a different instance than the one
 * running the audit. If that ever happens in production it is logged as an
 * error, loudly, on every call.
 */
export async function getAuditStore(): Promise<AuditStore> {
  if (auditStore) return auditStore;
  const env = getEnv();

  if (hasSupabase(env)) {
    const { SupabaseAuditStore } = await import('./supabase-store');
    auditStore = new SupabaseAuditStore(
      env.NEXT_PUBLIC_SUPABASE_URL!,
      env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    return auditStore;
  }

  if (env.NODE_ENV === 'production') {
    logger.error('storage.memory_driver_in_production', {
      detail:
        'Supabase is not configured. Audits will not persist and will be invisible to other instances.',
    });
  }

  auditStore = new MemoryAuditStore();
  return auditStore;
}

export async function getLeadStore(): Promise<LeadStore> {
  if (leadStore) return leadStore;
  const env = getEnv();

  if (hasSupabase(env)) {
    const { SupabaseLeadStore } = await import('./supabase-store');
    leadStore = new SupabaseLeadStore(
      env.NEXT_PUBLIC_SUPABASE_URL!,
      env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    return leadStore;
  }

  leadStore = new MemoryLeadStore();
  return leadStore;
}

/** Test-only. */
export function resetStores(): void {
  auditStore = null;
  leadStore = null;
}
