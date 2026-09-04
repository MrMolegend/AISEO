-- ═══════════════════════════════════════════════════════════════════════════
-- ALT SIGNAL: the outreach studio
--
-- NOT YET APPLIED to the live project. Ships with the ALT SIGNAL pivot and is
-- applied at deploy time, in order, after 0021. Apply as `outreach_studio`.
--
-- Drafts are proposals for human review, and the schema encodes the
-- boundaries: a draft carries the evidence references it was built from,
-- approval is a recorded human act, copying is audited, and NOTHING here
-- can send — there is no recipient column, no delivery state, no queue.
-- Every edit becomes a version row, so review always sees what changed.
--
-- Suppression is absolute: an entry here blocks generation for its target
-- across every campaign, which is what a do-not-contact list means.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists public.outreach_drafts (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references public.lead_accounts(id) on delete cascade,
  contact_id    uuid references public.lead_contacts(id) on delete set null,
  created_by    uuid references auth.users(id) on delete set null,

  channel       text not null,
  language      text not null default 'en',
  body          text not null,
  -- The claims and proof points the body was assembled from, by reference.
  evidence_refs jsonb not null default '[]',

  status        text not null default 'draft',
  approved_by   uuid references auth.users(id) on delete set null,
  approved_at   timestamptz,
  -- The audit half of copy/export: when a person last took the text out.
  last_copied_at timestamptz,

  version       integer not null default 1,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint outreach_drafts_channel check (
    channel in (
      'intro_request', 'linkedin_note', 'linkedin_message', 'email_short',
      'email_detailed', 'whatsapp', 'call_opener', 'voicemail',
      'meeting_request', 'followup_1', 'followup_2', 'reengagement'
    )
  ),
  constraint outreach_drafts_language check (language in ('en', 'ar')),
  constraint outreach_drafts_status check (status in ('draft', 'approved', 'rejected')),
  constraint outreach_drafts_body_len check (char_length(body) between 1 and 4000),
  -- Approval is a person: an approved row must name who and when.
  constraint outreach_drafts_approval_pair check (
    (status <> 'approved') or (approved_by is not null and approved_at is not null)
  )
);

create index if not exists outreach_drafts_account_idx
  on public.outreach_drafts (account_id, created_at desc);
create index if not exists outreach_drafts_status_idx
  on public.outreach_drafts (status, updated_at desc);

create trigger outreach_drafts_touch_updated_at
  before update on public.outreach_drafts
  for each row execute function public.rs_touch_updated_at();

alter table public.outreach_drafts enable row level security;
revoke all on public.outreach_drafts from anon, authenticated, public;
revoke all on public.outreach_drafts from service_role;
grant select, insert, update on public.outreach_drafts to service_role;


create table if not exists public.outreach_draft_versions (
  id         uuid primary key default gen_random_uuid(),
  draft_id   uuid not null references public.outreach_drafts(id) on delete cascade,
  version    integer not null,
  body       text not null,
  edited_by  uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint outreach_versions_body_len check (char_length(body) between 1 and 4000),
  constraint outreach_versions_unique unique (draft_id, version)
);

alter table public.outreach_draft_versions enable row level security;
revoke all on public.outreach_draft_versions from anon, authenticated, public;
revoke all on public.outreach_draft_versions from service_role;
grant select, insert on public.outreach_draft_versions to service_role;


create table if not exists public.suppression_entries (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null,
  -- What is suppressed: an account id, a contact id, or a normalised
  -- channel value a person asked never to be contacted on.
  value      text not null,
  reason     text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint suppression_kind check (kind in ('account', 'contact', 'channel_value')),
  constraint suppression_value_len check (char_length(value) between 1 and 300),
  constraint suppression_reason_len check (char_length(reason) <= 500),
  constraint suppression_unique unique (kind, value)
);

alter table public.suppression_entries enable row level security;
revoke all on public.suppression_entries from anon, authenticated, public;
revoke all on public.suppression_entries from service_role;
grant select, insert, delete on public.suppression_entries to service_role;


-- ═══════════════════════════════════════════════════════════════════════════
-- down
--
-- Not executed.
--
--   drop table if exists public.suppression_entries;
--   drop table if exists public.outreach_draft_versions;
--   drop trigger if exists outreach_drafts_touch_updated_at on public.outreach_drafts;
--   drop table if exists public.outreach_drafts;
-- ═══════════════════════════════════════════════════════════════════════════
