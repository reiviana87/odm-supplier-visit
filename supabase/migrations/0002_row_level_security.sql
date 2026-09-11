-- ─────────────────────────────────────────────────────────────────────────────
-- 0002_row_level_security.sql
-- ODM Supplier Visit — EBARA Global Sourcing Office
--
-- PHASE 1 BASELINE. This is deliberately the simplest rule set that is still
-- safe, not the final permission model.
--
--   select          any authenticated user
--   insert          any authenticated user
--   update          any authenticated user
--   delete          the row's created_by, or a profile with role admin/manager
--
-- README §13/§18 — the four roles (admin · manager · editor · viewer) exist in
-- the schema and in Settings, but the MVP does not enforce them beyond the
-- delete guard above. Per-report membership rules (only the members of a report
-- may read or edit it, viewers are read-only, in_review/final/archived reports
-- lock against editing) land in a later phase as a replacement for these
-- policies — they are not layered on top of them.
--
-- Anonymous users get nothing: every policy below is restricted to the
-- `authenticated` role, and RLS with no matching policy denies by default.
-- ─────────────────────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper — the caller's role
--
-- SECURITY DEFINER because the policies on public.profiles would otherwise
-- recurse: reading a profile to decide whether a profile may be read.
-- STABLE because it is called once per row and the answer cannot change inside
-- a statement. The explicit search_path stops a caller-controlled search_path
-- from resolving `profiles` to some other table inside a definer context.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.auth_role()
returns public.user_role
language sql
stable
security definer
set search_path = public
as $$
  select p.role
  from public.profiles p
  where p.id = auth.uid();
$$;

comment on function public.auth_role() is
  'The user_role of the current user, or null when unauthenticated or when no '
  'profile row exists yet. Used by the delete policies in this migration.';

revoke execute on function public.auth_role() from public, anon;
grant execute on function public.auth_role() to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Policies
--
-- The same four policies apply to all 17 tables, so they are generated in a
-- loop rather than written out 68 times. Writing them uniformly is the point:
-- there is no per-table nuance in Phase 1, and pretending otherwise by hand-
-- writing near-identical blocks would hide that fact. Each table is dropped
-- first so this migration can be re-run.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  t text;
  tables constant text[] := array[
    'profiles',
    'suppliers',
    'supplier_contacts',
    'supplier_certificates',
    'supplier_files',
    'reports',
    'report_members',
    'report_sections',
    'report_observations',
    'report_target_products',
    'report_product_rows',
    'report_images',
    'report_files',
    'report_ai_generations',
    'report_exports',
    'report_templates',
    'template_placeholders'
  ];
begin
  foreach t in array tables loop
    execute format('alter table public.%I enable row level security', t);

    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);

    -- Read: any signed-in member of the sourcing office.
    execute format($p$
      create policy %I on public.%I
        for select to authenticated
        using (true)
    $p$, t || '_select', t);

    -- Create.
    execute format($p$
      create policy %I on public.%I
        for insert to authenticated
        with check (true)
    $p$, t || '_insert', t);

    -- Update.
    execute format($p$
      create policy %I on public.%I
        for update to authenticated
        using (true)
        with check (true)
    $p$, t || '_update', t);

    -- Delete: the author of the row, or an admin/manager.
    execute format($p$
      create policy %I on public.%I
        for delete to authenticated
        using (
          created_by = auth.uid()
          or public.auth_role() in ('admin', 'manager')
        )
    $p$, t || '_delete', t);
  end loop;
end;
$$;

-- profiles has no created_by of its own for the first user in a project (the
-- column is null), so that row can only be deleted by an admin or a manager.
-- This is intentional: a profile is deleted by cascade from auth.users, not
-- from the application.

-- ─────────────────────────────────────────────────────────────────────────────
-- Storage
--
-- [INFERRED] The handoff does not specify storage rules. The three buckets
-- created in 0001 are private, so without policies every upload and every
-- signed-URL read fails. They follow exactly the same Phase 1 baseline as the
-- tables above; storage.objects.owner is the uploader, standing in for
-- created_by.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists "odm objects select"  on storage.objects;
drop policy if exists "odm objects insert"  on storage.objects;
drop policy if exists "odm objects update"  on storage.objects;
drop policy if exists "odm objects delete"  on storage.objects;

create policy "odm objects select" on storage.objects
  for select to authenticated
  using (bucket_id in ('report-images', 'report-files', 'supplier-files'));

create policy "odm objects insert" on storage.objects
  for insert to authenticated
  with check (bucket_id in ('report-images', 'report-files', 'supplier-files'));

create policy "odm objects update" on storage.objects
  for update to authenticated
  using (bucket_id in ('report-images', 'report-files', 'supplier-files'))
  with check (bucket_id in ('report-images', 'report-files', 'supplier-files'));

create policy "odm objects delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('report-images', 'report-files', 'supplier-files')
    and (owner = auth.uid() or public.auth_role() in ('admin', 'manager'))
  );
