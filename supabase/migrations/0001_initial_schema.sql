-- ─────────────────────────────────────────────────────────────────────────────
-- 0001_initial_schema.sql
-- ODM Supplier Visit — EBARA Global Sourcing Office
--
-- The complete Phase 1 schema: supplier master data, visit reports and their
-- sections, photographs, files, AI generations, DOCX exports and templates.
--
-- Structure mirrors design-handoff/README.md:
--   §6.2  the 13 report sections and the derived completion percentage
--   §8.1  the EBARA supplier data sheet, in the Excel's own column order
--   §8.3  live supplier master data vs. the frozen report snapshot
--   §10   photo regions, captions, caption source and confidence
--   §16   DOCX templates, placeholders and the three image regions
--
-- Row level security is enabled separately in 0002_row_level_security.sql.
-- Every table in this file is created WITHOUT policies and is therefore
-- unreachable until 0002 has run. Run both migrations, in order.
-- ─────────────────────────────────────────────────────────────────────────────

-- gen_random_uuid() is part of core PostgreSQL from 13 onwards; Supabase
-- projects are 15+, so no extension is required.

-- ─────────────────────────────────────────────────────────────────────────────
-- Enumerated types
-- ─────────────────────────────────────────────────────────────────────────────

create type public.report_status as enum ('draft', 'in_review', 'final', 'archived');

create type public.supplier_status as enum ('prospect', 'under_qualification', 'approved', 'on_hold');

create type public.data_sheet_state as enum ('received', 'partial', 'pending');

create type public.certificate_status as enum ('valid', 'not_evidenced', 'declared', 'expired');

create type public.user_role as enum ('admin', 'manager', 'editor', 'viewer');

create type public.image_region as enum ('MAIN_PRODUCT_IMAGES', 'PARTNER_IMAGES', 'APPENDIX_IMAGES');

create type public.caption_source as enum ('user', 'ai');

comment on type public.image_region is
  'README §10/§16. Export geometry per region is fixed: MAIN_PRODUCT_IMAGES and '
  'PARTNER_IMAGES render 2 columns at 7.0 cm, APPENDIX_IMAGES 2 columns at 6.5 cm '
  'with a caption row under each image row.';

-- ─────────────────────────────────────────────────────────────────────────────
-- Shared trigger function — updated_at
-- One function, attached to every table at the bottom of this file.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

comment on function public.set_updated_at() is
  'BEFORE UPDATE trigger: stamps updated_at. Attached to every table in this schema.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. profiles
-- One row per authenticated user. Created automatically by handle_new_user().
-- ─────────────────────────────────────────────────────────────────────────────

create table public.profiles (
  -- The only table whose id is NOT generated: it IS the auth.users id.
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text        not null default '',
  email       text        not null default '',
  job_title   text,
  department  text,
  initials    text,
  role        public.user_role not null default 'viewer',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null
);

comment on table public.profiles is
  'Application profile for an auth.users row. README §18 Settings › Members/Roles.';
comment on column public.profiles.role is
  'README §13/§18 — four fixed roles, no custom permission sets in the MVP. '
  'Phase 1 uses the role only as an RLS delete guard (see 0002).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. suppliers — the master record (README §8.1)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.suppliers (
  id                  uuid primary key default gen_random_uuid(),

  -- ── The EBARA supplier data sheet, in the Excel's own column order ────────
  legal_name          text        not null,                 -- Company name
  established_year    text,                                  -- Established year
  company_capital     text,                                  -- Company capital
  employees           text,                                  -- Number of employees
  factory_size_m2     text,                                  -- Factory size (m²)
  certifications      text,                                  -- Certification (ISO etc.)
  production_capacity text,                                  -- Production capacity (units/year)
  president_name      text,                                  -- Company president name
  website_url         text,                                  -- Company website URL
  country             text        not null,                  -- Country
  region              text,                                  -- Region / Province / State
  city                text,                                  -- City
  address             text,                                  -- Address (street / plot)
  tel                 text,                                  -- Tel (start with +)
  contact_name        text,                                  -- Person in charge (Sales)
  contact_title       text,                                  -- Title (job position)
  contact_wechat      text,                                  -- WeChat
  contact_email       text,                                  -- Email
  track_record_ebara  text,                                  -- Track record EBARA group

  -- ── Derived / application columns (README §8.1 "Derived/app fields") ──────
  -- Short display name used in tables and headers, e.g. "HEBEI HUATONG".
  short_name          text        not null,
  status              public.supplier_status  not null default 'prospect',
  data_sheet_state    public.data_sheet_state not null default 'pending',
  product_categories  text,
  internal_notes      text,
  last_visit_date     date,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references public.profiles (id) on delete set null
);

comment on table public.suppliers is
  'Supplier master data. README §8.1 — the column block above is the Excel data '
  'sheet EBARA sends to every new supplier, kept in the sheet''s own order so an '
  'import maps one-to-one.';
comment on column public.suppliers.employees is
  'Text, not integer: the sheet is filled in by suppliers and arrives as "3,500", '
  '"approx. 400", "3500 (2 plants)". Normalising it would lose what was declared.';
comment on column public.suppliers.factory_size_m2 is
  'Text for the same reason as employees — values arrive as "283,000 m²" or "60,000".';
comment on column public.suppliers.certifications is
  'Free-text list exactly as received, e.g. "ISO9001, ISO14001, CE, CSA, RoHS, UL". '
  'These are DECLARED certifications; evidenced copies live in supplier_certificates.';

-- report_count is NOT a column: it is count(*) over reports for this supplier.
-- Storing it would drift the moment a report is created, deleted or reassigned.

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. supplier_contacts (README §1.8 "02 · Person in Charge (Sales)")
-- ─────────────────────────────────────────────────────────────────────────────

create table public.supplier_contacts (
  id          uuid primary key default gen_random_uuid(),
  supplier_id uuid        not null references public.suppliers (id) on delete cascade,
  name        text        not null,
  role        text        not null default '',
  email       text        not null default '',
  phone       text        not null default '',
  wechat      text        not null default '',
  -- The primary contact mirrors suppliers.contact_* (the data-sheet columns).
  is_primary  boolean     not null default false,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. supplier_certificates (README §1.7 Certificates tab)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.supplier_certificates (
  id              uuid primary key default gen_random_uuid(),
  supplier_id     uuid        not null references public.suppliers (id) on delete cascade,
  name            text        not null,
  number          text,
  issue_date      date,
  expiration_date date,
  status          public.certificate_status not null default 'declared',
  -- Null while only declared on the data sheet; set when a copy is collected.
  file_name       text,
  storage_path    text,
  sort_order      integer     not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.profiles (id) on delete set null
);

comment on column public.supplier_certificates.status is
  'README §1.7 — a supplier that has never been visited lists its declared '
  'certifications with status ''declared'', no dates and no copy collected. '
  '''valid'' means a copy was verified during a visit.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. supplier_files (README §1.7 Files tab)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.supplier_files (
  id           uuid primary key default gen_random_uuid(),
  supplier_id  uuid        not null references public.suppliers (id) on delete cascade,
  kind         text        not null default 'document'
                 check (kind in ('data_sheet', 'certificate', 'catalog', 'document')),
  file_name    text        not null,
  storage_path text        not null,
  mime_type    text,
  size_bytes   bigint,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) on delete set null
);

comment on column public.supplier_files.storage_path is
  'Object path inside the ''supplier-files'' storage bucket.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. reports
-- ─────────────────────────────────────────────────────────────────────────────

create table public.reports (
  id                  uuid primary key default gen_random_uuid(),
  -- README §9 — auto GSO-YYMMNNNx00, editable, validated unique on blur.
  document_number     text        not null unique,
  supplier_id         uuid        not null references public.suppliers (id) on delete restrict,
  status              public.report_status not null default 'draft',
  visit_date          date        not null,
  -- Display period derived from the visit date, e.g. "August 2026".
  period              text        not null default '',
  employee_id         uuid references public.profiles (id) on delete set null,
  owner_id            uuid references public.profiles (id) on delete set null,
  location            text        not null default '',
  start_time          time,
  end_time            time,
  project             text,
  business_unit       text,
  product_category    text,

  -- The supplier snapshot (README §8.3).
  company_information jsonb       not null,
  snapshot_taken_at   timestamptz not null default now(),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references public.profiles (id) on delete set null
);

comment on column public.reports.supplier_id is
  'ON DELETE RESTRICT on purpose: a supplier that has been visited cannot vanish '
  'and take its visit history with it. Archive the supplier instead of deleting it.';

comment on column public.reports.company_information is
  'FROZEN SUPPLIER SNAPSHOT — README §8.3. A copy of the supplier master record '
  'taken when the report was created. §2 Company Information and the DOCX export '
  'read THIS column, never the live suppliers row. A report is a record of what '
  'was true at the visit date and must not mutate when the supplier master '
  'changes afterwards. It is rewritten only when the report author explicitly '
  'runs "Refresh from supplier record" and confirms the diff; snapshot_taken_at '
  'is restamped at the same moment and is shown to the reader as '
  '"Source: Supplier Database · snapshot taken {date}".';

comment on column public.reports.snapshot_taken_at is
  'When company_information was last copied from the supplier master record.';

-- Completion percentage is DERIVED, never stored (README §6.2): passing section
-- predicates ÷ 13, rounded. The dashboard, the reports table and the editor all
-- run the same computation over report_sections / report_images /
-- report_observations / report_target_products. A stored column would go stale
-- on every section patch and produce three different numbers on three screens.

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. report_members (README §9 — "Members", multi-entry chips)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.report_members (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid        not null references public.reports (id) on delete cascade,
  -- Null for an attendee who is not an application user (supplier staff,
  -- an interpreter, a colleague without an account).
  profile_id   uuid references public.profiles (id) on delete set null,
  display_name text        not null,
  sort_order   integer     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) on delete set null
);

-- A given application user appears once per report; free-text attendees are
-- not constrained because two people can share a name.
create unique index report_members_report_profile_key
  on public.report_members (report_id, profile_id)
  where profile_id is not null;

comment on table public.report_members is
  'Who attended the visit. Phase 1 stores attendance only — per-report access '
  'rules (README §13) are a later phase and are not enforced by RLS yet.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. report_sections (README §6.2)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.report_sections (
  id         uuid primary key default gen_random_uuid(),
  report_id  uuid        not null references public.reports (id) on delete cascade,
  -- The 13 section ids of README §6.2, spelled as in the §25 route contract
  -- (/reports/:id/:section) and in src/types/domain.ts SECTION_IDS.
  section_id text        not null check (section_id in (
                'general',
                'purpose',
                'company',
                'overview',
                'products',
                'product-images',
                'target',
                'visit',
                'certificates',
                'partners',
                'partner-images',
                'conclusion',
                'appendix'
              )),
  body       text        not null default '',
  -- README §25 — the §4 product table and the §6 Q&A block are optional and
  -- carry an explicit exclude control. Excluded content is kept, not deleted:
  -- it simply does not reach the DOCX.
  excluded   boolean     not null default false,
  sort_order integer     not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  constraint report_sections_report_section_key unique (report_id, section_id)
);

comment on table public.report_sections is
  'One row per content-bearing section of a report. Each section patches '
  'independently (README §6.3/§7 autosave). No completion column: completion is '
  'computed from the section predicates in README §6.2.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. report_observations (README §6 §6 Visit Relevant Information)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.report_observations (
  id                uuid primary key default gen_random_uuid(),
  report_id         uuid        not null references public.reports (id) on delete cascade,
  category          text        not null default '',
  priority          text        not null default 'Normal'
                      check (priority in ('Normal', 'High', 'Critical')),
  text              text        not null default '',
  -- Set when the observation was accepted from a transcript finding
  -- (README §12). Free text, not an FK: findings live inside the jsonb output
  -- of a report_ai_generations row and have no table of their own.
  source_finding_id text,
  sort_order        integer     not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  created_by        uuid references public.profiles (id) on delete set null
);

comment on column public.report_observations.priority is
  'Plain text with a CHECK rather than an enum: the three values are display '
  'labels and match src/types/domain.ts Observation.priority exactly.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. report_target_products (README §5 Target Products)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.report_target_products (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid        not null references public.reports (id) on delete cascade,
  model       text        not null default '',
  description text        not null default '',
  -- Optional illustration, chosen from the report's own images.
  -- FK added at the bottom of this file: report_images is created later.
  photo_id    uuid,
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 11. report_product_rows (README §4 — the OPTIONAL Main Products table)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.report_product_rows (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid        not null references public.reports (id) on delete cascade,
  type        text        not null default '',
  standard    text        not null default '',
  voltage     text        not null default '',
  description text        not null default '',
  sort_order  integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null
);

comment on table public.report_product_rows is
  'README §6.2 — the §4 product table is optional; §4 completes on its prose '
  'alone. Exclusion from the export is held on report_sections.excluded.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 12. report_images (README §10)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.report_images (
  id             uuid primary key default gen_random_uuid(),
  report_id      uuid        not null references public.reports (id) on delete cascade,
  region         public.image_region not null,
  file_name      text        not null default '',
  storage_path   text,
  mime_type      text,
  size_bytes     bigint,
  -- The caption that will be printed. Empty until a human types one or accepts
  -- the AI draft — README §11: AI output is a proposal until a human accepts it.
  caption        text        not null default '',
  -- The AI's proposal, held separately so accepting is an explicit act and
  -- discarding never destroys what the user wrote.
  ai_caption     text        not null default '',
  caption_source public.caption_source not null default 'user',
  -- Percentage. Below 85 the card renders "AI · 78% · review required".
  confidence     numeric(5, 2) check (confidence >= 0 and confidence <= 100),
  caption_state  text        not null default 'none'
                   check (caption_state in ('none', 'suggested', 'accepted')),
  upload_state   text        not null default 'ready'
                   check (upload_state in ('uploading', 'ready', 'failed')),
  category       text        not null default '',
  -- Print order inside the region; also the appendix page order.
  sort_order     integer     not null,
  captured_at    timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  created_by     uuid references public.profiles (id) on delete set null
);

comment on column public.report_images.sort_order is
  'Order within the region — the appendix print order (README §10).';

-- Deliberately a plain index, NOT unique on (report_id, region, sort_order).
-- Drag-to-reorder rewrites several rows' sort_order in one transaction and
-- inevitably passes through a state where two cards share a position; a unique
-- constraint would abort the reorder mid-flight. Uniqueness of the print order
-- is the application's concern, not the database's.
create index report_images_region_order_idx
  on public.report_images (report_id, region, sort_order);

comment on column public.report_images.storage_path is
  'Object path inside the ''report-images'' bucket. The original is always kept '
  '(README §10) — the export downsizes a copy at the chosen image quality.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 13. report_files (README §12 and the Sources rail: transcript, notes, docs)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.report_files (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid        not null references public.reports (id) on delete cascade,
  kind         text        not null default 'document'
                 check (kind in ('transcript', 'audio', 'note', 'document')),
  file_name    text        not null,
  storage_path text        not null,
  mime_type    text,
  size_bytes   bigint,
  -- Shown in the Sources rail: "Plaud Transcript · 14,206 words · uploaded Aug 12"
  -- and "Document · 42 pages · 18.4 MB". Null when not applicable.
  word_count   integer,
  page_count   integer,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) on delete set null
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 14. report_ai_generations (README §11 — the AI proposal ledger)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.report_ai_generations (
  id          uuid primary key default gen_random_uuid(),
  report_id   uuid        not null references public.reports (id) on delete cascade,
  kind        text        not null check (kind in (
                'improve_text',
                'transcript_analysis',
                'photo_caption',
                'conclusion',
                'assistant_answer'
              )),
  -- Which section the proposal targets, when it targets one.
  section_id  text,
  -- Which image the caption belongs to, for kind = 'photo_caption'.
  image_id    uuid references public.report_images (id) on delete cascade,
  prompt      text,
  -- Free-shaped result: a string for text proposals, an array of findings for
  -- a transcript analysis, the nine headed blocks for a conclusion.
  output      jsonb       not null default '{}'::jsonb,
  confidence  numeric(5, 2) check (confidence >= 0 and confidence <= 100),
  model       text,
  status      text        not null default 'proposed'
                 check (status in ('proposed', 'accepted', 'discarded')),
  accepted_at timestamptz,
  accepted_by uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  created_by  uuid references public.profiles (id) on delete set null
);

comment on table public.report_ai_generations is
  'Every AI proposal, and whether a human accepted it. README §11: "AI output is '
  'a proposal until a human accepts it" — the acceptance is recorded here, never '
  'inferred. Nothing in this table is rendered as report content; accepted text '
  'is written into report_sections / report_observations / report_images.';

-- ─────────────────────────────────────────────────────────────────────────────
-- 15. report_exports (README §15)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.report_exports (
  id                  uuid primary key default gen_random_uuid(),
  report_id           uuid        not null references public.reports (id) on delete cascade,
  -- FK added at the bottom of this file: report_templates is created later.
  template_id         uuid,
  file_name           text        not null,
  storage_path        text,
  image_quality       text        not null default 'original'
                        check (image_quality in ('original', 'optimised')),
  status              text        not null default 'queued'
                        check (status in ('queued', 'processing', 'ready', 'failed')),
  page_count          integer,
  appendix_page_count integer,
  size_bytes          bigint,
  -- Blocking issues the user chose to export anyway (missing captions, empty
  -- conclusion, appendix overflow); restated on the result panel.
  warnings            jsonb       not null default '[]'::jsonb,
  error_message       text,
  completed_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references public.profiles (id) on delete set null
);

comment on table public.report_exports is
  'One row per DOCX generation, kept as the report''s export history (README §15).';

-- ─────────────────────────────────────────────────────────────────────────────
-- 16. report_templates (README §16)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.report_templates (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  version       text        not null,
  file_name     text        not null,
  storage_path  text,
  is_active     boolean     not null default false,
  is_archived   boolean     not null default false,
  change_note   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.profiles (id) on delete set null
);

-- README §16 — "Active template: exactly one".
create unique index report_templates_single_active_idx
  on public.report_templates (is_active)
  where is_active;

-- ─────────────────────────────────────────────────────────────────────────────
-- 17. template_placeholders (README §16 mapping table)
-- ─────────────────────────────────────────────────────────────────────────────

create table public.template_placeholders (
  id           uuid primary key default gen_random_uuid(),
  template_id  uuid        not null references public.report_templates (id) on delete cascade,
  -- e.g. "{{DOCUMENT_NUMBER}}", or a region name for an image loop.
  placeholder  text        not null,
  -- e.g. "Report › document number", "Supplier snapshot › legal name".
  source       text        not null default '',
  sample_value text,
  -- False renders the warning treatment in the mapping table's status column:
  -- present in the template but unmapped, or mapped but absent from the template.
  is_mapped    boolean     not null default false,
  sort_order   integer     not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.profiles (id) on delete set null,
  constraint template_placeholders_template_placeholder_key
    unique (template_id, placeholder)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Forward references
-- These two FKs point at tables created further down the file, so they are
-- attached here rather than inline. Behaviour is identical.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.report_target_products
  add constraint report_target_products_photo_id_fkey
  foreign key (photo_id) references public.report_images (id) on delete set null;

alter table public.report_exports
  add constraint report_exports_template_id_fkey
  foreign key (template_id) references public.report_templates (id) on delete set null;

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- Every foreign key is indexed (PostgreSQL does not do this automatically, and
-- an unindexed FK makes every parent delete a sequential scan), plus the four
-- filter/sort columns the list screens read.
-- ─────────────────────────────────────────────────────────────────────────────

create index profiles_created_by_idx                  on public.profiles (created_by);

create index suppliers_created_by_idx                 on public.suppliers (created_by);
create index suppliers_status_idx                     on public.suppliers (status);
create index suppliers_country_region_idx             on public.suppliers (country, region);

create index supplier_contacts_supplier_id_idx        on public.supplier_contacts (supplier_id);
create index supplier_contacts_created_by_idx         on public.supplier_contacts (created_by);

create index supplier_certificates_supplier_id_idx    on public.supplier_certificates (supplier_id);
create index supplier_certificates_created_by_idx     on public.supplier_certificates (created_by);

create index supplier_files_supplier_id_idx           on public.supplier_files (supplier_id);
create index supplier_files_created_by_idx            on public.supplier_files (created_by);

create index reports_supplier_id_idx                  on public.reports (supplier_id);
create index reports_employee_id_idx                  on public.reports (employee_id);
create index reports_owner_id_idx                     on public.reports (owner_id);
create index reports_created_by_idx                   on public.reports (created_by);
create index reports_status_idx                       on public.reports (status);
create index reports_visit_date_idx                   on public.reports (visit_date desc);

create index report_members_report_id_idx             on public.report_members (report_id);
create index report_members_profile_id_idx            on public.report_members (profile_id);
create index report_members_created_by_idx            on public.report_members (created_by);

-- report_sections(report_id) is already covered by the leading column of the
-- report_sections_report_section_key unique index.
create index report_sections_created_by_idx           on public.report_sections (created_by);

create index report_observations_report_id_idx        on public.report_observations (report_id);
create index report_observations_created_by_idx       on public.report_observations (created_by);

create index report_target_products_report_id_idx     on public.report_target_products (report_id);
create index report_target_products_photo_id_idx      on public.report_target_products (photo_id);
create index report_target_products_created_by_idx    on public.report_target_products (created_by);

create index report_product_rows_report_id_idx        on public.report_product_rows (report_id);
create index report_product_rows_created_by_idx       on public.report_product_rows (created_by);

create index report_images_report_id_idx              on public.report_images (report_id);
create index report_images_created_by_idx             on public.report_images (created_by);

create index report_files_report_id_idx               on public.report_files (report_id);
create index report_files_created_by_idx              on public.report_files (created_by);

create index report_ai_generations_report_id_idx      on public.report_ai_generations (report_id);
create index report_ai_generations_image_id_idx       on public.report_ai_generations (image_id);
create index report_ai_generations_accepted_by_idx    on public.report_ai_generations (accepted_by);
create index report_ai_generations_created_by_idx     on public.report_ai_generations (created_by);

create index report_exports_report_id_idx             on public.report_exports (report_id);
create index report_exports_template_id_idx           on public.report_exports (template_id);
create index report_exports_created_by_idx            on public.report_exports (created_by);

create index report_templates_created_by_idx          on public.report_templates (created_by);

-- template_placeholders(template_id) is already covered by the leading column
-- of the template_placeholders_template_placeholder_key unique index.
create index template_placeholders_created_by_idx     on public.template_placeholders (created_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at triggers — one per table, all running set_updated_at()
-- ─────────────────────────────────────────────────────────────────────────────

create trigger set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.suppliers
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.supplier_contacts
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.supplier_certificates
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.supplier_files
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.reports
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.report_members
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.report_sections
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.report_observations
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.report_target_products
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.report_product_rows
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.report_images
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.report_files
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.report_ai_generations
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.report_exports
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.report_templates
  for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.template_placeholders
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- New user → profile
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.email, ''),
    'viewer'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

comment on function public.handle_new_user() is
  'Creates the public.profiles row for a new auth.users row. Everyone starts as '
  '''viewer'' — an admin promotes them in Settings › Members (README §18). '
  'Signing up must never grant write access by itself.';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage buckets
-- Private buckets: access is granted by the storage policies in 0002.
-- Guarded so re-running this migration on a provisioned project is harmless.
-- ─────────────────────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public)
values
  ('report-images',  'report-images',  false),
  ('report-files',   'report-files',   false),
  ('supplier-files', 'supplier-files', false)
on conflict (id) do nothing;
