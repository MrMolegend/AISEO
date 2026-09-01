-- ═══════════════════════════════════════════════════════════════════════════
-- Market-entry source evidence
--
-- APPLIED to the live project as `market_entry_source_evidence`.
-- supabase/database.types.ts has been regenerated from the resulting schema.
--
-- The one schema change the market-entry transformation needs. Everything else
-- it required turned out to be free: research_jobs.package_id is plain text
-- with no CHECK, so 'market-entry' needs no migration; stage is likewise
-- unconstrained; and the new report shape lives in the existing result jsonb
-- under schema_version 2.
--
-- What is not free is research_sources.source_type, which is a closed CHECK
-- listing the seven kinds of source the previous product could find. A
-- market-entry report distinguishes an official ministry from a customs
-- authority from a chamber of commerce, and that distinction is load-bearing:
-- it decides which sources may carry a regulatory or market-size claim.
--
-- Strictly additive:
--
--   · every existing value stays valid, so all 45 rows already in the table
--     remain readable and no row is rewritten;
--   · the five new columns are nullable with no default, so rows written by
--     the previous product are complete as they stand;
--   · nothing is dropped, renamed or backfilled.
--
-- REVERSIBILITY. Rolling back the application alone is already safe — nothing
-- older than this release reads the new columns, and the widened CHECK accepts
-- a strict superset of what the old one did. To reverse the schema itself, the
-- `down` block at the foot of this file drops the five columns and restores the
-- original constraint; it will fail if any row has been written with one of the
-- new source_type values, which is the correct behaviour rather than a bug. In
-- that case, map those rows onto the legacy vocabulary first:
--
--   update public.research_sources
--      set source_type = 'web_page'
--    where source_type not in
--      ('web_page','search_result','sitemap','robots','directory','review_site','social_profile');
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.research_sources
  drop constraint if exists research_sources_type_known;

alter table public.research_sources
  add constraint research_sources_type_known check (
    source_type in (
      -- The previous product's vocabulary, retained verbatim.
      'web_page','search_result','sitemap','robots','directory','review_site','social_profile',
      -- Market-entry source categories.
      'official','regulator','customs','statistical','trade_association','chamber',
      'industry_publication','retailer','news','company','other'
    )
  );

-- How the source was classified, kept alongside source_type rather than
-- replacing it: source_type says what kind of document it is, category says
-- what kind of publisher stands behind it, and only the second decides whether
-- a regulatory claim may rest on it.
alter table public.research_sources
  add column if not exists source_category text;

-- Whether we opened the page ourselves or only saw an index summary of it.
-- The single most important new column: an indexed summary may not support a
-- regulatory, financial or market-size claim on its own.
alter table public.research_sources
  add column if not exists retrieval_mode text;

alter table public.research_sources
  add column if not exists published_at date;

-- Whether the source is about the market being entered. A well-sourced
-- statement about the wrong country is the most plausible-looking mistake this
-- product can make, so relevance is recorded rather than assumed.
alter table public.research_sources
  add column if not exists geographic_relevance text;

alter table public.research_sources
  add column if not exists source_confidence text;

alter table public.research_sources
  drop constraint if exists research_sources_retrieval_mode_known;

alter table public.research_sources
  add constraint research_sources_retrieval_mode_known check (
    retrieval_mode is null or retrieval_mode in ('direct', 'indexed')
  );

-- Serves the report's coverage panel, which counts authoritative and directly
-- retrieved sources per job. Partial: legacy rows have no category and would
-- otherwise take up most of the index while answering none of its questions.
create index if not exists research_sources_job_category_idx
  on public.research_sources (job_id, source_category)
  where source_category is not null;


-- ═══════════════════════════════════════════════════════════════════════════
-- down
--
-- Not executed. Kept here so the reversal is written down rather than
-- reconstructed under pressure. See the note above about mapping rows off the
-- new source_type values first.
--
--   drop index if exists public.research_sources_job_category_idx;
--
--   alter table public.research_sources
--     drop constraint if exists research_sources_retrieval_mode_known;
--
--   alter table public.research_sources
--     drop column if exists source_confidence,
--     drop column if exists geographic_relevance,
--     drop column if exists published_at,
--     drop column if exists retrieval_mode,
--     drop column if exists source_category;
--
--   alter table public.research_sources
--     drop constraint if exists research_sources_type_known;
--
--   alter table public.research_sources
--     add constraint research_sources_type_known check (
--       source_type in
--         ('web_page','search_result','sitemap','robots','directory','review_site','social_profile')
--     );
-- ═══════════════════════════════════════════════════════════════════════════
