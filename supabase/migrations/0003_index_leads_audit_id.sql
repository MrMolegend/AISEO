-- ═══════════════════════════════════════════════════════════════════════════
-- Cover the leads → audits foreign key with an index
--
-- Raised by the Supabase performance advisor (0001_unindexed_foreign_keys) and
-- kept because it is a genuine defect rather than a lint preference.
--
-- public.leads.audit_id references public.audits(id) ON DELETE SET NULL. Postgres
-- does not index the referencing side of a foreign key automatically, so every
-- delete or key-update on an audit must scan the whole of `leads` to find rows
-- pointing at it. That is invisible while leads is empty and becomes a table
-- scan per deletion once it is not — and audit deletion is exactly the support
-- operation someone reaches for during an incident, when a slow query is least
-- welcome.
--
-- The index also serves the natural read: "which enquiries came from this
-- audit", which is the only way a lead is ever looked up by anything other than
-- time.
-- ═══════════════════════════════════════════════════════════════════════════

create index if not exists leads_audit_id_idx
  on public.leads (audit_id)
  where audit_id is not null;

-- Partial, because a lead submitted from the landing page rather than from a
-- report carries no audit_id, and those rows are never the target of this
-- lookup. Excluding them keeps the index proportional to the rows it can serve.
