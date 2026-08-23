-- ═══════════════════════════════════════════════════════════════════════════
-- Cover the cached_from_job_id foreign key
--
-- Applied remotely as `index_research_jobs_cached_from`.
--
-- Raised by the Supabase performance advisor: research_jobs.cached_from_job_id
-- is a foreign key with no covering index, so enforcing the constraint on any
-- delete or update of a referenced job means a sequential scan of the table.
--
-- Partial, because the column is null on every job that ran its own research —
-- which will be the large majority. Indexing those nulls would roughly double
-- the index for no lookup it can serve.
-- ═══════════════════════════════════════════════════════════════════════════

create index if not exists research_jobs_cached_from_idx
  on public.research_jobs (cached_from_job_id)
  where cached_from_job_id is not null;
