-- ─────────────────────────────────────────────────────────────────────────────
-- Phase 2.5 — schema verification
--
-- Read-only. Paste into the Supabase SQL Editor AFTER applying 0001..0005 and
-- run it. Every row is one check; read the `status` column.
--
-- This exists because "the CLI printed no error" is not evidence that the
-- schema is right. It asserts the objects the application actually depends on,
-- with the expected values taken from the migrations themselves.
-- ─────────────────────────────────────────────────────────────────────────────

with
-- ── Tables ──────────────────────────────────────────────────────────────────
expected_tables(name) as (
  values ('profiles'),
         ('suppliers'),
         ('supplier_contacts'),
         ('supplier_certificates'),
         ('supplier_files'),
         ('reports'),
         ('report_members'),
         ('report_sections'),
         ('report_observations'),
         ('report_target_products'),
         ('report_product_rows'),
         ('report_images'),
         ('report_files'),
         ('report_ai_generations'),
         ('report_exports'),
         ('report_templates'),
         ('template_placeholders')
),
actual_tables as (
  select table_name::text as name
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
),
table_checks as (
  select
    'table: ' || e.name as check_name,
    'present'           as expected,
    coalesce((select 'present' from actual_tables a where a.name = e.name), 'MISSING') as actual
  from expected_tables e
),

-- ── Enums ───────────────────────────────────────────────────────────────────
expected_enums(name, labels) as (
  values
    ('user_role',          'admin,manager,editor,viewer'),
    ('supplier_status',    null),
    ('data_sheet_state',   null),
    ('certificate_status', null),
    ('report_status',      null),
    ('image_region',       null),
    ('caption_source',     null)
),
enum_checks as (
  select
    'enum: ' || e.name as check_name,
    'present'          as expected,
    coalesce((
      select 'present'
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      where n.nspname = 'public' and t.typname = e.name and t.typtype = 'e'
    ), 'MISSING') as actual
  from expected_enums e
),

-- ── Functions and the creation RPC ──────────────────────────────────────────
expected_functions(name) as (
  values ('auth_role'), ('set_updated_at'), ('handle_new_user'),
         ('bump_report_section_version'), ('supplier_snapshot_jsonb'),
         ('create_report_with_snapshot'), ('refresh_report_snapshot')
),
function_checks as (
  select
    'function: ' || e.name as check_name,
    'present'              as expected,
    coalesce((
      select 'present'
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = e.name
      limit 1
    ), 'MISSING') as actual
  from expected_functions e
),

-- ── Row level security ──────────────────────────────────────────────────────
rls_checks as (
  select
    'RLS enabled: ' || c.relname as check_name,
    'enabled'                    as expected,
    case when c.relrowsecurity then 'enabled' else 'DISABLED' end as actual
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind = 'r'
    and c.relname in (select name from expected_tables)
),
policy_counts as (
  select
    'policies on ' || tablename as check_name,
    '>= 4 (select/insert/update/delete)' as expected,
    case when count(*) >= 4 then count(*)::text || ' policies'
         else 'ONLY ' || count(*)::text end as actual
  from pg_policies
  where schemaname = 'public'
  group by tablename
),

-- ── Triggers the application relies on ──────────────────────────────────────
updated_at_trigger as (
  select
    'set_updated_at trigger count' as check_name,
    '17'                           as expected,
    count(*)::text                 as actual
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and not t.tgisinternal
    and t.tgname = 'set_updated_at'
),
version_trigger as (
  select
    'report_sections version trigger' as check_name,
    'present'                         as expected,
    coalesce((
      select 'present'
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      where c.relname = 'report_sections'
        and not t.tgisinternal
        and t.tgname = 'bump_report_section_version'
    ), 'MISSING') as actual
),

-- ── Columns Phase 2 added, which the data layer writes by name ──────────────
expected_columns(tbl, col) as (
  values
    ('suppliers', 'chinese_name'), ('suppliers', 'supplier_code'),
    ('suppliers', 'annual_revenue'), ('suppliers', 'ownership_type'),
    ('suppliers', 'main_markets'), ('suppliers', 'main_products'),
    ('suppliers', 'production_capabilities'), ('suppliers', 'archived_at'),
    ('suppliers', 'updated_by'),
    ('supplier_certificates', 'notes'),
    ('supplier_contacts', 'is_primary'), ('supplier_contacts', 'sort_order'),
    ('report_sections', 'version'), ('report_sections', 'updated_by'),
    ('reports', 'archived_at'), ('reports', 'updated_by'),
    ('reports', 'company_information'), ('reports', 'snapshot_taken_at'),
    ('report_target_products', 'name'),
    ('report_target_products', 'application'),
    ('report_target_products', 'expected_market'),
    ('report_target_products', 'technical_requirements'),
    ('report_target_products', 'comments')
),
column_checks as (
  select
    'column: ' || e.tbl || '.' || e.col as check_name,
    'present'                           as expected,
    coalesce((
      select 'present'
      from information_schema.columns c
      where c.table_schema = 'public' and c.table_name = e.tbl and c.column_name = e.col
    ), 'MISSING') as actual
  from expected_columns e
),
dropped_column as (
  select
    'column dropped: report_target_products.description' as check_name,
    'absent'                                            as expected,
    coalesce((
      select 'STILL PRESENT'
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'report_target_products'
        and column_name = 'description'
    ), 'absent') as actual
),

-- ── Uniqueness the application depends on ───────────────────────────────────
unique_checks as (
  select 'unique: reports.document_number' as check_name, 'present' as expected,
    coalesce((select 'present' from pg_indexes
      where schemaname='public' and tablename='reports'
        and indexdef ilike '%unique%' and indexdef ilike '%document_number%' limit 1), 'MISSING') as actual
  union all
  select 'partial unique: suppliers.supplier_code', 'present',
    coalesce((select 'present' from pg_indexes
      where schemaname='public' and tablename='suppliers'
        and indexdef ilike '%unique%' and indexdef ilike '%supplier_code%' limit 1), 'MISSING')
  union all
  select 'partial unique: one primary contact per supplier', 'present',
    coalesce((select 'present' from pg_indexes
      where schemaname='public' and tablename='supplier_contacts'
        and indexdef ilike '%unique%' and indexdef ilike '%is_primary%' limit 1), 'MISSING')
),

-- ── Storage ─────────────────────────────────────────────────────────────────
bucket_check as (
  select
    'storage bucket: report-images' as check_name,
    'present'                       as expected,
    coalesce((select 'present' from storage.buckets where id = 'report-images'), 'MISSING') as actual
),

-- ── Index budget (README §32) ───────────────────────────────────────────────
index_count as (
  select
    'indexes on public schema' as check_name,
    '>= 40'                    as expected,
    case when count(*) >= 40 then count(*)::text else 'ONLY ' || count(*)::text end as actual
  from pg_indexes where schemaname = 'public'
),

all_checks as (
  select * from table_checks
  union all select * from enum_checks
  union all select * from function_checks
  union all select * from rls_checks
  union all select * from policy_counts
  union all select * from updated_at_trigger
  union all select * from version_trigger
  union all select * from column_checks
  union all select * from dropped_column
  union all select * from unique_checks
  union all select * from bucket_check
  union all select * from index_count
)
select
  case when actual = expected
         or (expected like '>=%' and actual not like 'ONLY%')
         or (expected like '%select/insert%' and actual not like 'ONLY%')
       then 'PASS' else '*** FAIL ***' end as status,
  check_name,
  expected,
  actual
from all_checks
order by status desc, check_name;
