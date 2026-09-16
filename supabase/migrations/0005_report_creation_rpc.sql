-- ─────────────────────────────────────────────────────────────────────────────
-- 0005_report_creation_rpc.sql
-- ODM Supplier Visit — EBARA Global Sourcing Office
--
-- Creating a report is four writes that have to succeed or fail together: the
-- report with its frozen supplier snapshot, its attendees, and its thirteen
-- section rows. Done from the client as four round trips, a failure on the
-- third leaves a report with no sections — a draft the editor cannot open and
-- that the user has no way to repair. A function body is one transaction, so
-- this is the whole of it or none of it.
--
-- SECURITY INVOKER throughout: these run as the caller, so the 0004 policies
-- apply exactly as they would to a direct insert. A viewer calling this gets
-- the same refusal from the same rule — the RPC is not a way around RLS.
--
-- ── The error contract ───────────────────────────────────────────────────────
-- src/lib/data/errors.ts maps SQLSTATEs onto DataError codes, so these raise
-- codes the mapper already understands:
--
--   23505  unique_violation       duplicate document number → `conflict`
--                                 Deliberately NOT caught. README §9 validates
--                                 the number on blur, but two people can still
--                                 submit the same one in the same second, and
--                                 the constraint is the only thing that can
--                                 actually decide.
--   23514  check_violation        the supplier is archived   → `invalid`
--   42501  insufficient_privilege RLS refused the write      → `forbidden`
--   P0002  no_data_found          no such supplier / report  → `not_found`
--                                 (toDataError currently falls through to
--                                 `unknown` for P0002; the caller maps it.)
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- The snapshot shape — one definition, two callers
--
-- Both functions below have to produce byte-identical jsonb: a refresh that
-- wrote a different key set from the create would quietly break §2 Company
-- Information for that one report. Written twice, the two would drift the
-- first time a field is added. Written once, they cannot.
--
-- The keys are camelCase because this jsonb IS the `SupplierSnapshot`
-- interface in src/types/domain.ts — the application reads it straight out of
-- reports.company_information without a mapping layer, so the names have to
-- match that interface and not the snake_case of the columns they come from.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.supplier_snapshot_jsonb(
  p_supplier public.suppliers,
  p_taken_at timestamptz
)
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'supplierId',         p_supplier.id,
    -- Formatted through UTC rather than handed to jsonb as a timestamptz: the
    -- snapshot is a stored document and must not read differently depending on
    -- the session TimeZone of whoever happened to write it.
    'takenAt',            to_char(p_taken_at at time zone 'utc',
                                  'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'shortName',          p_supplier.short_name,
    'legalName',          p_supplier.legal_name,
    'establishedYear',    p_supplier.established_year,
    'companyCapital',     p_supplier.company_capital,
    'employees',          p_supplier.employees,
    'factorySizeM2',      p_supplier.factory_size_m2,
    'certifications',     p_supplier.certifications,
    'productionCapacity', p_supplier.production_capacity,
    'presidentName',      p_supplier.president_name,
    'websiteUrl',         p_supplier.website_url,
    'country',            p_supplier.country,
    'region',             p_supplier.region,
    'city',               p_supplier.city,
    'address',            p_supplier.address,
    'tel',                p_supplier.tel,
    'trackRecordEbara',   p_supplier.track_record_ebara
  );
$$;

comment on function public.supplier_snapshot_jsonb(public.suppliers, timestamptz) is
  'The README §8.3 supplier snapshot, in the exact key set of SupplierSnapshot '
  'in src/types/domain.ts. Pure formatting — it reads no tables and enforces no '
  'rules; both of its callers do that before they call it.';

revoke execute on function public.supplier_snapshot_jsonb(public.suppliers, timestamptz)
  from public, anon;
grant execute on function public.supplier_snapshot_jsonb(public.suppliers, timestamptz)
  to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- create_report_with_snapshot — README §9, step 2 of the New Report modal
--
-- Every argument is named in the signature rather than folded into one jsonb
-- payload: the compiler then checks the call site, and adding a field to the
-- report header is a visible change to this contract instead of a new key
-- nobody notices is missing.
--
-- No argument has a default. The caller states every field, including the
-- nulls — "no end time was recorded" and "the caller forgot to pass the end
-- time" must not look the same from here.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.create_report_with_snapshot(
  p_document_number  text,
  p_supplier_id      uuid,
  p_status           public.report_status,
  p_visit_date       date,
  p_period           text,
  p_employee_id      uuid,
  p_owner_id         uuid,
  p_location         text,
  p_start_time       time,
  p_end_time         time,
  p_project          text,
  p_business_unit    text,
  p_product_category text,
  p_members          text[]
)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_supplier  public.suppliers%rowtype;
  v_taken_at  timestamptz := now();
  v_report_id uuid;
  -- The thirteen section ids of README §6.2, in the order the navigator shows
  -- them. They are CHECK-constrained in 0001 and duplicated in SECTION_IDS in
  -- src/types/domain.ts; all three lists say the same thing.
  c_sections  constant text[] := array[
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
  ];
begin
  -- 1. The supplier has to exist and be usable, checked before anything is
  --    written. reports.supplier_id would catch a missing id on its own, but
  --    as a foreign key violation the caller cannot tell from a dozen others.
  select * into v_supplier
  from public.suppliers
  where id = p_supplier_id;

  if not found then
    raise exception 'No supplier with id %', p_supplier_id
      using errcode = 'P0002',
            hint = 'The supplier may have been removed since the picker loaded.';
  end if;

  if v_supplier.archived_at is not null then
    raise exception 'Supplier % is archived and cannot take new reports', v_supplier.short_name
      using errcode = '23514',
            hint = 'Restore the supplier first, or pick another one.';
  end if;

  -- 2. The report, carrying the snapshot frozen at this instant (§8.3).
  insert into public.reports (
    document_number, supplier_id, status, visit_date, period,
    employee_id, owner_id, location, start_time, end_time,
    project, business_unit, product_category,
    company_information, snapshot_taken_at,
    created_by, updated_by
  )
  values (
    p_document_number,
    p_supplier_id,
    -- The three NOT NULL columns with a default are coalesced rather than left
    -- to fail: a missing period is a blank field on a form, not a crash.
    coalesce(p_status, 'draft'),
    p_visit_date,
    coalesce(p_period, ''),
    p_employee_id,
    p_owner_id,
    coalesce(p_location, ''),
    p_start_time,
    p_end_time,
    p_project,
    p_business_unit,
    p_product_category,
    public.supplier_snapshot_jsonb(v_supplier, v_taken_at),
    v_taken_at,
    auth.uid(),
    auth.uid()
  )
  returning id into v_report_id;

  -- 3. The attendees, in the order the chips were entered — that order is how
  --    the §1 General Information block prints them. Blank chips are dropped
  --    rather than stored as empty names.
  insert into public.report_members (report_id, display_name, sort_order, created_by)
  select v_report_id, btrim(m.display_name), m.ord - 1, auth.uid()
  from unnest(coalesce(p_members, array[]::text[])) with ordinality as m(display_name, ord)
  where btrim(m.display_name) <> '';

  -- 4. All thirteen sections, empty. They are created up front, not on first
  --    edit: the completion percentage (README §6.2) counts rows, the editor
  --    patches a section by id, and both would have to special-case a report
  --    whose sections do not exist yet.
  insert into public.report_sections (report_id, section_id, body, excluded, sort_order, created_by)
  select v_report_id, s.section_id, '', false, s.ord - 1, auth.uid()
  from unnest(c_sections) with ordinality as s(section_id, ord);

  return v_report_id;
end;
$$;

comment on function public.create_report_with_snapshot(
  text, uuid, public.report_status, date, text, uuid, uuid, text, time, time,
  text, text, text, text[]
) is
  'README §9 — creates a report, freezes the supplier snapshot, records the '
  'attendees and seeds the thirteen empty sections, as one transaction. '
  'Returns the new report id. Raises 23505 on a duplicate document number '
  '(uncaught on purpose), P0002 when the supplier does not exist and 23514 '
  'when it is archived.';

revoke execute on function public.create_report_with_snapshot(
  text, uuid, public.report_status, date, text, uuid, uuid, text, time, time,
  text, text, text, text[]
) from public, anon;
grant execute on function public.create_report_with_snapshot(
  text, uuid, public.report_status, date, text, uuid, uuid, text, time, time,
  text, text, text, text[]
) to authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- refresh_report_snapshot — README §8.3, "Refresh from supplier record"
--
-- THIS MUST NEVER RUN AUTOMATICALLY. It is the one action that is allowed to
-- change what a finished report says about the supplier, and README §8.3 makes
-- it an explicit choice: the user is shown the diff and confirms it before
-- this is called. There is deliberately no trigger on public.suppliers that
-- calls it — a report is the record of what was true at the visit date, and an
-- edit to the master record months later must not rewrite history behind the
-- author's back. If this ever needs to be called from a loop or a job, that is
-- the signal that the requirement has changed, not that the guard is in the
-- way.
--
-- Returns the new snapshot_taken_at so the caller can render the
-- "Source: Supplier Database · snapshot taken {date}" line without re-reading
-- the report.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.refresh_report_snapshot(p_report_id uuid)
returns timestamptz
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_supplier_id uuid;
  v_supplier    public.suppliers%rowtype;
  v_taken_at    timestamptz := now();
begin
  select supplier_id into v_supplier_id
  from public.reports
  where id = p_report_id;

  if not found then
    raise exception 'No report with id %', p_report_id
      using errcode = 'P0002';
  end if;

  select * into v_supplier
  from public.suppliers
  where id = v_supplier_id;

  if not found then
    raise exception 'Report % points at supplier %, which no longer exists',
      p_report_id, v_supplier_id
      using errcode = 'P0002';
  end if;

  -- An archived supplier is NOT refused here, unlike in creation: archiving
  -- means "stop starting new work with this company", and the master record it
  -- leaves behind is still the most accurate description of the company as it
  -- was. Refusing would trap an author who only wants a corrected address.

  update public.reports
     set company_information = public.supplier_snapshot_jsonb(v_supplier, v_taken_at),
         snapshot_taken_at   = v_taken_at,
         updated_by          = auth.uid()
   where id = p_report_id;

  -- The select above succeeded, so the report exists and is readable. Zero
  -- rows updated therefore means the UPDATE policy refused this caller — a
  -- viewer, most likely — and not a missing row.
  if not found then
    raise exception 'Not allowed to refresh the snapshot on report %', p_report_id
      using errcode = '42501';
  end if;

  return v_taken_at;
end;
$$;

comment on function public.refresh_report_snapshot(uuid) is
  'README §8.3 — re-copies the live supplier record into '
  'reports.company_information and restamps snapshot_taken_at. An EXPLICIT, '
  'CONFIRMED user action only: it overwrites what a finished report says about '
  'the supplier, so it must never be called from a trigger, a job or a bulk '
  'update. Returns the new snapshot_taken_at.';

revoke execute on function public.refresh_report_snapshot(uuid) from public, anon;
grant execute on function public.refresh_report_snapshot(uuid) to authenticated;
