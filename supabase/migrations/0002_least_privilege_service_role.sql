-- ═══════════════════════════════════════════════════════════════════════════
-- Tighten service_role to least privilege
--
-- Why this exists as a second migration rather than an edit to 0001: 0001 has
-- been applied. Editing an applied migration leaves the recorded history and the
-- live database describing different things, which is how a schema drifts
-- silently. Corrections after application go forward, never backward.
--
-- What 0001 got wrong
-- -------------------
-- 0001 revoked privileges from anon and authenticated, and granted service_role
-- the subset the application uses. Verifying the result showed service_role
-- holding ALL privileges anyway:
--
--   DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE
--
-- The grant in 0001 was additive, and this project's default privileges already
-- hand every new public table's full privilege set to service_role. Adding three
-- privileges to a role that already had seven changes nothing. A GRANT cannot
-- express "and nothing else"; only a REVOKE followed by a GRANT can.
--
-- Why the excess matters
-- ----------------------
-- service_role is the identity the web server runs as. It is reachable from
-- request-handling code, which is exactly the code an attacker gets leverage
-- over. DELETE and TRUNCATE on that role mean a query-construction bug or an
-- injected predicate can destroy the audit history; without them the same bug
-- fails with a permission error. The application never deletes a row — audit
-- removal is a support action performed through the dashboard under a
-- privileged connection, not something request-handling code can do.
--
-- Privileges below are traceable to call sites in lib/storage/supabase-store.ts.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── audits ────────────────────────────────────────────────────────────────
-- create() → insert; getByPublicId(), findFreshByUrlHash() → select;
-- setStage(), complete(), fail() → update.
revoke all on public.audits from service_role;
grant select, insert, update on public.audits to service_role;

-- ── leads ─────────────────────────────────────────────────────────────────
-- SupabaseLeadStore.create() inserts and never reads back: the audit lookup it
-- performs first queries public.audits, not this table. No SELECT is granted,
-- so a bug in request-handling code cannot enumerate captured contact details —
-- the most sensitive data the application stores. Reading leads is a dashboard
-- operation under a privileged connection.
revoke all on public.leads from service_role;
grant insert on public.leads to service_role;

-- ── audit_events ──────────────────────────────────────────────────────────
-- Not yet written to by application code. SELECT and INSERT are granted for the
-- table's declared purpose — a per-audit debugging timeline — because a table
-- its only client cannot use is worse than no table. Deliberately no DELETE.
revoke all on public.audit_events from service_role;
grant select, insert on public.audit_events to service_role;

-- ── sequence ──────────────────────────────────────────────────────────────
-- audit_events.id is bigserial. INSERT needs USAGE for nextval(); it does not
-- need SELECT (currval) or UPDATE (setval), so neither is granted.
revoke all on sequence public.audit_events_id_seq from service_role;
grant usage on sequence public.audit_events_id_seq to service_role;

-- Note on future tables: this project's default privileges still grant
-- service_role the full set on newly created public tables. That is left in
-- place deliberately. Tightening it would make every future migration fail with
-- a permission error until it remembered to add its own grants — a loud failure,
-- but a confusing one, and service_role is the trusted server identity. The
-- security-critical half of the defaults, anon and authenticated, was revoked in
-- 0001 and is verified below. New tables should follow the pattern in this file.
