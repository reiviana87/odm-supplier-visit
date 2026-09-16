-- ─────────────────────────────────────────────────────────────────────────────
-- 0003_phase2_schema.sql
-- ODM Supplier Visit — EBARA Global Sourcing Office
--
-- Phase 2 makes the supplier and report workflow real. This migration carries
-- the schema the Phase 2 data layer is written against:
--
--   1. the commercial / capability block the supplier form now collects;
--   2. the §5 Target Products row, which grew from "model + description" into
--      the five-column table the editor renders;
--   3. optimistic concurrency on report_sections (Phase 2 §18);
--   4. the audit and soft-delete columns (§31, §33);
--   5. the indexes the list screens sort and filter on (§32).
--
-- It also carries the fixes found while auditing 0001 against what the app
-- actually does. 0001 and 0002 are applied history and are never edited; every
-- correction lands here. What the audit found is recorded inline, including
-- the two things that turned out to be right already, so the next reader does
-- not have to check them again.
--
-- Every statement is guarded (`if not exists`, `drop … if exists`, or an
-- explicit existence test) so the migration can be re-run without damage.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. suppliers — the commercial and capability block (Phase 2 §4)
--
-- All text, for the same reason 0001 kept `employees` and `factory_size_m2` as
-- text: these arrive on a sheet filled in by the supplier, and normalising them
-- would discard what was actually declared.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.suppliers
  add column if not exists chinese_name            text,
  add column if not exists supplier_code           text,
  add column if not exists annual_revenue          text,
  add column if not exists ownership_type          text,
  add column if not exists main_markets            text,
  add column if not exists main_products           text,
  add column if not exists production_capabilities text,
  add column if not exists updated_by              uuid,
  add column if not exists archived_at             timestamptz;

-- Added separately so the FK is named predictably and the statement stays
-- re-runnable; `add column` cannot express `add constraint if not exists`.
do $do$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'suppliers_updated_by_fkey'
      and conrelid = 'public.suppliers'::regclass
  ) then
    alter table public.suppliers
      add constraint suppliers_updated_by_fkey
      foreign key (updated_by) references public.profiles (id) on delete set null;
  end if;
end;
$do$;

comment on column public.suppliers.chinese_name is
  'The name the supplier trades under domestically (中文名). Kept next to the '
  'legal name because e-mail, WeChat and every Chinese certificate use it, and '
  'searching for a supplier by its Latin name alone regularly fails.';

comment on column public.suppliers.supplier_code is
  'EBARA''s own reference for this supplier. Optional — a prospect has none '
  'until it is registered — and unique once set, which is why the constraint '
  'is a partial unique index rather than a column-level UNIQUE.';

comment on column public.suppliers.annual_revenue is
  'Declared turnover as received, e.g. "CNY 7.53 billion (2025)". Text, not a '
  'number: the currency, the year and the basis are part of the statement and '
  'a bare numeric would silently drop all three.';

comment on column public.suppliers.ownership_type is
  'Public (listed) / Private / Joint venture / State-owned … Free text rather '
  'than an enum: the set is not closed and a value we cannot spell must still '
  'be recordable.';

comment on column public.suppliers.main_markets is
  'Where the supplier already sells, e.g. "Europe, North America, Japan". '
  'Read during qualification to judge which certifications they really hold.';

comment on column public.suppliers.main_products is
  'Prose description of the product range. Distinct from product_categories, '
  'which is the short tag list the supplier list filters on.';

comment on column public.suppliers.production_capabilities is
  'Prose — casting, machining, winding, assembly, in-house test benches. What '
  'the supplier can do, as opposed to production_capacity, which is how much.';

comment on column public.suppliers.updated_by is
  'Who last changed the master record. README §8.3 makes the supplier row the '
  'single live truth for every report snapshot, so a change to it has to be '
  'attributable. Null when the writer had no profile (a service-role import).';

comment on column public.suppliers.archived_at is
  'SOFT-DELETE MARKER (Phase 2 §33). Set when the supplier is archived; the '
  'pickers and the default list filter on `archived_at is null`. A supplier '
  'that has been visited cannot be hard-deleted at all: reports.supplier_id is '
  'ON DELETE RESTRICT, so the row is protected by the database and not merely '
  'by convention. Archiving is the reversible act — clear this column to undo.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. supplier_certificates — the reviewer's note
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.supplier_certificates
  add column if not exists notes text;

comment on column public.supplier_certificates.notes is
  'Why a certificate is in the state it is in — "copy seen on site, not '
  'released", "scope covers Plant 2 only", "renewal in progress". README §1.7 '
  'shows the status as a badge; without this column the reason behind the '
  'badge lives only in someone''s memory.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. report_target_products — §5 grew from two columns into six
--
-- 0001 modelled a target product as model + description. The approved §5 table
-- has name, model, application, expected market, technical requirements and
-- comments, and `description` is exactly the free-note column now called
-- `comments`.
--
-- RENAME rather than add-copy-drop: the data travels with the column, so there
-- is no window in which a copy could half-succeed and no possibility of losing
-- a row. It also keeps 0001's `not null default ''`, which is the shape the new
-- column needs anyway.
-- ─────────────────────────────────────────────────────────────────────────────

do $do$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'report_target_products'
      and column_name  = 'description'
  ) then
    alter table public.report_target_products rename column description to comments;
  end if;
end;
$do$;

alter table public.report_target_products
  add column if not exists name                   text not null default '',
  add column if not exists application            text not null default '',
  add column if not exists expected_market        text not null default '',
  add column if not exists technical_requirements text not null default '',
  add column if not exists comments               text not null default '';

comment on column public.report_target_products.name is
  'What the product is called, e.g. "RHW-2 submersible pump cable". The §5 '
  'table leads with the name; `model` is the family or drawing number under it.';

comment on column public.report_target_products.application is
  'Where the part is used — the duty it has to perform. Drives which of the '
  'supplier''s lines is relevant.';

comment on column public.report_target_products.expected_market is
  'The market the part is intended for, e.g. "North America (UL)". It decides '
  'which approvals the supplier must already hold, so it is a field of its own '
  'rather than a sentence buried in the comments.';

comment on column public.report_target_products.technical_requirements is
  'Standards, ratings and tolerances the part has to meet. Separated from the '
  'comments so a requirement is never mistaken for an impression.';

comment on column public.report_target_products.comments is
  'Free notes carried into §5. This is 0001''s `description` column, renamed: '
  'the data is the same free text, and the new name stops it being read as a '
  'specification now that the specification has columns of its own.';


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. report_sections — optimistic concurrency (Phase 2 §18)
--
-- Two people editing one report is the normal case on a visit: one types in the
-- editor, one dictates into Visit Mode. Autosave patches sections
-- independently, so without a version the later write silently erases the
-- earlier one.
--
-- The contract is:
--     update public.report_sections
--        set body = $3
--      where id = $1 and version = $2;
-- Zero rows updated means someone else saved first — the caller reports
-- `stale` and reloads, and nothing is overwritten.
--
-- ONE AMBIGUITY THE CALLER HAS TO RESOLVE, stated here because it cannot be
-- seen from either migration alone: 0004 gives report_sections a row-
-- independent UPDATE policy (`auth_role() in ('editor','manager','admin')`).
-- A viewer's update therefore also affects zero rows, and RLS raises nothing —
-- a filtered row and a refused row look identical from the client. Zero rows
-- alone does not mean `stale`. Before reporting it, re-read the row: if it
-- still carries the version that was sent, nobody saved first and the answer
-- is `forbidden`, not `stale`. Telling a read-only user to "reload before
-- saving" would send them round a loop that cannot end.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.report_sections
  add column if not exists version    integer not null default 1,
  add column if not exists updated_by uuid;

do $do$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'report_sections_updated_by_fkey'
      and conrelid = 'public.report_sections'::regclass
  ) then
    alter table public.report_sections
      add constraint report_sections_updated_by_fkey
      foreign key (updated_by) references public.profiles (id) on delete set null;
  end if;
end;
$do$;

comment on column public.report_sections.version is
  'Optimistic concurrency token. Incremented by the database on every UPDATE '
  '(see bump_report_section_version below), never by the client — a client that '
  'forgets would turn the guard off for everyone without anyone noticing.';

comment on column public.report_sections.updated_by is
  'Who wrote this section last. Shown next to the autosave indicator when the '
  'writer was somebody else, which is how a user finds out a colleague is in '
  'the same report.';

create or replace function public.bump_report_section_version()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Deliberately ignores whatever the client put in new.version: the version
  -- is the database's statement about the row, not the client's.
  new.version := old.version + 1;
  return new;
end;
$$;

comment on function public.bump_report_section_version() is
  'BEFORE UPDATE trigger on report_sections: advances the optimistic '
  'concurrency token. Fires before set_updated_at (BEFORE ROW triggers run in '
  'name order, and "bump…" sorts before "set…"); the two touch different '
  'columns, so the order carries no meaning either way.';

drop trigger if exists bump_report_section_version on public.report_sections;
create trigger bump_report_section_version before update on public.report_sections
  for each row execute function public.bump_report_section_version();


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. reports — audit and soft delete
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.reports
  add column if not exists updated_by  uuid,
  add column if not exists archived_at timestamptz;

do $do$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'reports_updated_by_fkey'
      and conrelid = 'public.reports'::regclass
  ) then
    alter table public.reports
      add constraint reports_updated_by_fkey
      foreign key (updated_by) references public.profiles (id) on delete set null;
  end if;
end;
$do$;

comment on column public.reports.updated_by is
  'Who last touched the report header or any of its sections. The reports list '
  'renders it as "edited by {name} {when}"; `created_by` answers a different '
  'question and cannot stand in for it.';

comment on column public.reports.archived_at is
  'SOFT-DELETE MARKER (Phase 2 §33). A visit report is the record of what was '
  'seen and said on a given date; it is never hard-deleted by the application. '
  '"Delete" in the UI stamps this column and sets status = ''archived'', which '
  'takes the report out of the dashboard and the default list while leaving it '
  'readable and restorable. The DELETE privilege granted to manager/admin in '
  '0004 is an administrative escape hatch (a test row, a GDPR erasure), not '
  'the product''s delete button.';

-- No CHECK couples archived_at to status. The honest reason: the two are set
-- together by the archive action, but an admin correcting one of them alone is
-- a legitimate repair, and a constraint here would turn that repair into an
-- error at exactly the moment someone is trying to fix data. The invariant is
-- stated above and enforced in the data layer, where it can explain itself.


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Indexes (Phase 2 §32)
--
-- Only what 0001 does not already have. Already present and NOT repeated here:
--   reports(status)            reports_status_idx
--   reports(visit_date desc)   reports_visit_date_idx
--   reports(supplier_id)       reports_supplier_id_idx
--   reports(document_number)   reports_document_number_key, from UNIQUE
--   suppliers(status)          suppliers_status_idx
--   suppliers(country, region) suppliers_country_region_idx
-- ─────────────────────────────────────────────────────────────────────────────

-- The supplier list sorts on both names and the picker matches on them.
-- These serve ORDER BY, equality and prefix matching. They do NOT serve the
-- `ilike '%term%'` the search box uses — that needs pg_trgm, which Phase 2
-- does not enable; on a list of this size the sequential scan is not the
-- bottleneck, and enabling an extension is a decision for whoever runs the
-- project, not for a migration.
create index if not exists suppliers_short_name_idx
  on public.suppliers (short_name);

create index if not exists suppliers_legal_name_idx
  on public.suppliers (legal_name);

-- "Recently updated" is the default order of the supplier list.
create index if not exists suppliers_updated_at_idx
  on public.suppliers (updated_at desc);

-- Unique only where a code has actually been assigned: every prospect has a
-- null code, and a plain UNIQUE would still allow those (nulls never collide)
-- but would index every row for nothing. Partial says what is meant.
create unique index if not exists suppliers_supplier_code_key
  on public.suppliers (supplier_code)
  where supplier_code is not null;

-- The dashboard and the reports list both open on "recently updated".
create index if not exists reports_updated_at_idx
  on public.reports (updated_at desc);

-- At most one primary contact per supplier. README §1.8 shows a single sales
-- contact in the header and the supplier row mirrors it into contact_*; two
-- rows claiming to be primary would make that mirror ambiguous and the header
-- would flip between them depending on row order.
--
-- Demote any duplicates first, keeping the one the user ordered first, so the
-- index can be created on data that predates the rule.
update public.supplier_contacts c
   set is_primary = false
 where c.is_primary
   and c.id <> (
     select keep.id
     from public.supplier_contacts keep
     where keep.supplier_id = c.supplier_id
       and keep.is_primary
     order by keep.sort_order, keep.created_at, keep.id
     limit 1
   );

create unique index if not exists supplier_contacts_primary_contact_key
  on public.supplier_contacts (supplier_id)
  where is_primary;

-- 0001's rule is that every foreign key is indexed, because an unindexed FK
-- turns each parent delete into a sequential scan. The three updated_by
-- columns added above are foreign keys and follow the same rule.
create index if not exists suppliers_updated_by_idx
  on public.suppliers (updated_by);

create index if not exists reports_updated_by_idx
  on public.reports (updated_by);

create index if not exists report_sections_updated_by_idx
  on public.report_sections (updated_by);


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. updated_at — audited, not re-created (Phase 2 §31)
--
-- Checked against 0001: public.set_updated_at() is attached BEFORE UPDATE FOR
-- EACH ROW to all seventeen tables — profiles, suppliers, supplier_contacts,
-- supplier_certificates, supplier_files, reports, report_members,
-- report_sections, report_observations, report_target_products,
-- report_product_rows, report_images, report_files, report_ai_generations,
-- report_exports, report_templates, template_placeholders. Every one fires on
-- UPDATE and stamps now() unconditionally, so updated_at cannot be forged or
-- forgotten by a client. Nothing to fix; re-creating the triggers here would
-- only invite the reader to wonder which copy is live.
--
-- This block re-asserts that guarantee instead of assuming it: if a trigger is
-- ever missing, the migration fails loudly rather than leaving a table whose
-- updated_at quietly stops moving.
-- ─────────────────────────────────────────────────────────────────────────────

do $do$
declare
  missing text[];
begin
  select array_agg(t.table_name order by t.table_name)
    into missing
  from (
    select unnest(array[
      'profiles', 'suppliers', 'supplier_contacts', 'supplier_certificates',
      'supplier_files', 'reports', 'report_members', 'report_sections',
      'report_observations', 'report_target_products', 'report_product_rows',
      'report_images', 'report_files', 'report_ai_generations',
      'report_exports', 'report_templates', 'template_placeholders'
    ]) as table_name
  ) t
  where not exists (
    select 1
    from pg_trigger g
    where g.tgrelid = format('public.%I', t.table_name)::regclass
      and not g.tgisinternal
      and g.tgfoid = 'public.set_updated_at()'::regprocedure
      -- pg_trigger.tgtype bits: 1 = FOR EACH ROW, 2 = BEFORE, 16 = ON UPDATE.
      and (g.tgtype & 1) = 1
      and (g.tgtype & 2) = 2
      and (g.tgtype & 16) = 16
  );

  if missing is not null then
    raise exception 'set_updated_at() is not a BEFORE UPDATE row trigger on: %',
      array_to_string(missing, ', ');
  end if;
end;
$do$;
