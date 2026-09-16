-- ─────────────────────────────────────────────────────────────────────────────
-- 0004_role_based_rls.sql
-- ODM Supplier Visit — EBARA Global Sourcing Office
--
-- THE PERMISSION MODEL (Phase 2 §30). This replaces the Phase 1 baseline in
-- 0002 outright; nothing from 0002 is layered on top of it.
--
--   viewer            SELECT on everything. No writes anywhere.
--   editor            SELECT + INSERT + UPDATE on suppliers, reports and every
--                     child table of either. No DELETE.
--   manager, admin    all of the above, plus DELETE.
--   admin             additionally: may change any profile's role, and manages
--                     the Word templates.
--   anon              nothing. Every policy below is `to authenticated`, and a
--                     table with RLS on and no matching policy denies.
--
--   profiles          every authenticated user may READ every profile — the
--                     reports list, the members chips and the owner column all
--                     render people by name, so hiding profiles would blank
--                     half the UI. A user may UPDATE only their own row, and
--                     only an admin may change a `role`, including their own.
--
-- Two things 0002 got wrong for Phase 2, fixed here, stated plainly:
--
--   1. `for update … using (true)` on public.profiles let any signed-in user
--      rewrite any other profile — including setting their own role to
--      'admin'. A read-only viewer could promote themselves. That is the
--      reason this migration exists at all, not merely a tidy-up.
--   2. Writes were open to every authenticated user, so the `viewer` role was
--      decorative: it changed nothing about what a user could actually do.
--
-- The policies are written out per table rather than generated in a loop. In
-- 0002 a loop was honest — the rules really were identical. They are not any
-- more, and a loop would now hide four different rule sets behind one array.
-- Policy names are kept identical to 0002's so that dropping them by name both
-- removes the old model and makes this migration re-runnable.
--
-- public.auth_role() is 0002's helper: SECURITY DEFINER (so reading a profile
-- to authorise a profile read cannot recurse), STABLE, with a pinned
-- search_path. It returns null for a user with no profile row, and
-- `null in (…)` is null, which is not true — so an account without a profile
-- gets read access and nothing else.
-- ─────────────────────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.profiles enable row level security;

drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert on public.profiles;
drop policy if exists profiles_update on public.profiles;
drop policy if exists profiles_delete on public.profiles;

create policy profiles_select on public.profiles
  for select to authenticated
  using (true);

-- The normal path is public.handle_new_user(), a SECURITY DEFINER trigger on
-- auth.users which is not subject to RLS. This policy exists only so an admin
-- can repair a missing row by hand; nobody else can mint a profile, which
-- would otherwise be a way to hand a role to an account.
create policy profiles_insert on public.profiles
  for insert to authenticated
  with check (public.auth_role() = 'admin');

-- USING sees the row as it is, WITH CHECK sees it as it would become.
--
-- A non-admin may only reach their own row (USING), and their new row must
-- carry the role they already have (WITH CHECK). public.auth_role() is STABLE
-- and reads the statement's snapshot, so inside this UPDATE it still returns
-- the OLD role — `role = public.auth_role()` therefore means "you did not
-- change your own role", which is exactly the rule.
create policy profiles_update on public.profiles
  for update to authenticated
  using (
    id = auth.uid()
    or public.auth_role() = 'admin'
  )
  with check (
    (
      id = auth.uid()
      or public.auth_role() = 'admin'
    )
    and (
      public.auth_role() = 'admin'
      or role = public.auth_role()
    )
  );

-- A profile is normally removed by cascade from auth.users, not from the
-- application. Admin only — deleting a profile detaches it from every report
-- it authored (created_by is ON DELETE SET NULL), which is not a manager's
-- decision to take.
create policy profiles_delete on public.profiles
  for delete to authenticated
  using (public.auth_role() = 'admin');


-- ─────────────────────────────────────────────────────────────────────────────
-- Supplier master data — suppliers and its children
--   read: everyone · write: editor+ · delete: manager+
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.suppliers enable row level security;

drop policy if exists suppliers_select on public.suppliers;
drop policy if exists suppliers_insert on public.suppliers;
drop policy if exists suppliers_update on public.suppliers;
drop policy if exists suppliers_delete on public.suppliers;

create policy suppliers_select on public.suppliers
  for select to authenticated
  using (true);

create policy suppliers_insert on public.suppliers
  for insert to authenticated
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy suppliers_update on public.suppliers
  for update to authenticated
  using (public.auth_role() in ('editor', 'manager', 'admin'))
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

-- Archiving (0003: suppliers.archived_at) is an UPDATE and is therefore open
-- to editors. This DELETE is the rare hard removal of a supplier that was
-- never visited; one that was is blocked outright by reports.supplier_id
-- ON DELETE RESTRICT, whatever role asks.
create policy suppliers_delete on public.suppliers
  for delete to authenticated
  using (public.auth_role() in ('manager', 'admin'));


alter table public.supplier_contacts enable row level security;

drop policy if exists supplier_contacts_select on public.supplier_contacts;
drop policy if exists supplier_contacts_insert on public.supplier_contacts;
drop policy if exists supplier_contacts_update on public.supplier_contacts;
drop policy if exists supplier_contacts_delete on public.supplier_contacts;

create policy supplier_contacts_select on public.supplier_contacts
  for select to authenticated
  using (true);

create policy supplier_contacts_insert on public.supplier_contacts
  for insert to authenticated
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy supplier_contacts_update on public.supplier_contacts
  for update to authenticated
  using (public.auth_role() in ('editor', 'manager', 'admin'))
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy supplier_contacts_delete on public.supplier_contacts
  for delete to authenticated
  using (public.auth_role() in ('manager', 'admin'));


alter table public.supplier_certificates enable row level security;

drop policy if exists supplier_certificates_select on public.supplier_certificates;
drop policy if exists supplier_certificates_insert on public.supplier_certificates;
drop policy if exists supplier_certificates_update on public.supplier_certificates;
drop policy if exists supplier_certificates_delete on public.supplier_certificates;

create policy supplier_certificates_select on public.supplier_certificates
  for select to authenticated
  using (true);

create policy supplier_certificates_insert on public.supplier_certificates
  for insert to authenticated
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy supplier_certificates_update on public.supplier_certificates
  for update to authenticated
  using (public.auth_role() in ('editor', 'manager', 'admin'))
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy supplier_certificates_delete on public.supplier_certificates
  for delete to authenticated
  using (public.auth_role() in ('manager', 'admin'));


alter table public.supplier_files enable row level security;

drop policy if exists supplier_files_select on public.supplier_files;
drop policy if exists supplier_files_insert on public.supplier_files;
drop policy if exists supplier_files_update on public.supplier_files;
drop policy if exists supplier_files_delete on public.supplier_files;

create policy supplier_files_select on public.supplier_files
  for select to authenticated
  using (true);

create policy supplier_files_insert on public.supplier_files
  for insert to authenticated
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy supplier_files_update on public.supplier_files
  for update to authenticated
  using (public.auth_role() in ('editor', 'manager', 'admin'))
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy supplier_files_delete on public.supplier_files
  for delete to authenticated
  using (public.auth_role() in ('manager', 'admin'));


-- ─────────────────────────────────────────────────────────────────────────────
-- Reports and every child table
--   read: everyone · write: editor+ · delete: manager+
--
-- The product's own "delete report" is an archive (0003: reports.archived_at),
-- which is an UPDATE. The DELETE policy on public.reports below exists for
-- administrative removal — a test row, a legal erasure — and is not what the
-- UI calls.
--
-- KNOWN CONSEQUENCE, stated rather than worked around. §30 gives editors no
-- DELETE anywhere, and the row collections inside a report are edited by
-- removing rows: an observation, a target product, a §4 product row, a member
-- chip, a photograph. An editor can add and change those, and a manager has to
-- be the one who removes one. That is what §30 says, so that is what is
-- written here; if the intent was that editors may delete rows they own inside
-- a report they are working on, that is a change to the model and belongs in a
-- later migration, not in a quiet exception buried in one table's policy.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.reports enable row level security;

drop policy if exists reports_select on public.reports;
drop policy if exists reports_insert on public.reports;
drop policy if exists reports_update on public.reports;
drop policy if exists reports_delete on public.reports;

create policy reports_select on public.reports
  for select to authenticated
  using (true);

create policy reports_insert on public.reports
  for insert to authenticated
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy reports_update on public.reports
  for update to authenticated
  using (public.auth_role() in ('editor', 'manager', 'admin'))
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy reports_delete on public.reports
  for delete to authenticated
  using (public.auth_role() in ('manager', 'admin'));


alter table public.report_members enable row level security;

drop policy if exists report_members_select on public.report_members;
drop policy if exists report_members_insert on public.report_members;
drop policy if exists report_members_update on public.report_members;
drop policy if exists report_members_delete on public.report_members;

create policy report_members_select on public.report_members
  for select to authenticated
  using (true);

create policy report_members_insert on public.report_members
  for insert to authenticated
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy report_members_update on public.report_members
  for update to authenticated
  using (public.auth_role() in ('editor', 'manager', 'admin'))
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy report_members_delete on public.report_members
  for delete to authenticated
  using (public.auth_role() in ('manager', 'admin'));


alter table public.report_sections enable row level security;

drop policy if exists report_sections_select on public.report_sections;
drop policy if exists report_sections_insert on public.report_sections;
drop policy if exists report_sections_update on public.report_sections;
drop policy if exists report_sections_delete on public.report_sections;

create policy report_sections_select on public.report_sections
  for select to authenticated
  using (true);

create policy report_sections_insert on public.report_sections
  for insert to authenticated
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy report_sections_update on public.report_sections
  for update to authenticated
  using (public.auth_role() in ('editor', 'manager', 'admin'))
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy report_sections_delete on public.report_sections
  for delete to authenticated
  using (public.auth_role() in ('manager', 'admin'));


alter table public.report_observations enable row level security;

drop policy if exists report_observations_select on public.report_observations;
drop policy if exists report_observations_insert on public.report_observations;
drop policy if exists report_observations_update on public.report_observations;
drop policy if exists report_observations_delete on public.report_observations;

create policy report_observations_select on public.report_observations
  for select to authenticated
  using (true);

create policy report_observations_insert on public.report_observations
  for insert to authenticated
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy report_observations_update on public.report_observations
  for update to authenticated
  using (public.auth_role() in ('editor', 'manager', 'admin'))
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy report_observations_delete on public.report_observations
  for delete to authenticated
  using (public.auth_role() in ('manager', 'admin'));


alter table public.report_target_products enable row level security;

drop policy if exists report_target_products_select on public.report_target_products;
drop policy if exists report_target_products_insert on public.report_target_products;
drop policy if exists report_target_products_update on public.report_target_products;
drop policy if exists report_target_products_delete on public.report_target_products;

create policy report_target_products_select on public.report_target_products
  for select to authenticated
  using (true);

create policy report_target_products_insert on public.report_target_products
  for insert to authenticated
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy report_target_products_update on public.report_target_products
  for update to authenticated
  using (public.auth_role() in ('editor', 'manager', 'admin'))
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy report_target_products_delete on public.report_target_products
  for delete to authenticated
  using (public.auth_role() in ('manager', 'admin'));


alter table public.report_product_rows enable row level security;

drop policy if exists report_product_rows_select on public.report_product_rows;
drop policy if exists report_product_rows_insert on public.report_product_rows;
drop policy if exists report_product_rows_update on public.report_product_rows;
drop policy if exists report_product_rows_delete on public.report_product_rows;

create policy report_product_rows_select on public.report_product_rows
  for select to authenticated
  using (true);

create policy report_product_rows_insert on public.report_product_rows
  for insert to authenticated
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy report_product_rows_update on public.report_product_rows
  for update to authenticated
  using (public.auth_role() in ('editor', 'manager', 'admin'))
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy report_product_rows_delete on public.report_product_rows
  for delete to authenticated
  using (public.auth_role() in ('manager', 'admin'));


alter table public.report_images enable row level security;

drop policy if exists report_images_select on public.report_images;
drop policy if exists report_images_insert on public.report_images;
drop policy if exists report_images_update on public.report_images;
drop policy if exists report_images_delete on public.report_images;

create policy report_images_select on public.report_images
  for select to authenticated
  using (true);

create policy report_images_insert on public.report_images
  for insert to authenticated
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy report_images_update on public.report_images
  for update to authenticated
  using (public.auth_role() in ('editor', 'manager', 'admin'))
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy report_images_delete on public.report_images
  for delete to authenticated
  using (public.auth_role() in ('manager', 'admin'));


alter table public.report_files enable row level security;

drop policy if exists report_files_select on public.report_files;
drop policy if exists report_files_insert on public.report_files;
drop policy if exists report_files_update on public.report_files;
drop policy if exists report_files_delete on public.report_files;

create policy report_files_select on public.report_files
  for select to authenticated
  using (true);

create policy report_files_insert on public.report_files
  for insert to authenticated
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy report_files_update on public.report_files
  for update to authenticated
  using (public.auth_role() in ('editor', 'manager', 'admin'))
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy report_files_delete on public.report_files
  for delete to authenticated
  using (public.auth_role() in ('manager', 'admin'));


alter table public.report_ai_generations enable row level security;

drop policy if exists report_ai_generations_select on public.report_ai_generations;
drop policy if exists report_ai_generations_insert on public.report_ai_generations;
drop policy if exists report_ai_generations_update on public.report_ai_generations;
drop policy if exists report_ai_generations_delete on public.report_ai_generations;

create policy report_ai_generations_select on public.report_ai_generations
  for select to authenticated
  using (true);

-- A viewer cannot ask for a proposal: every generation is a row here, so the
-- insert privilege is what actually gates the AI features (README §11).
create policy report_ai_generations_insert on public.report_ai_generations
  for insert to authenticated
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy report_ai_generations_update on public.report_ai_generations
  for update to authenticated
  using (public.auth_role() in ('editor', 'manager', 'admin'))
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy report_ai_generations_delete on public.report_ai_generations
  for delete to authenticated
  using (public.auth_role() in ('manager', 'admin'));


alter table public.report_exports enable row level security;

drop policy if exists report_exports_select on public.report_exports;
drop policy if exists report_exports_insert on public.report_exports;
drop policy if exists report_exports_update on public.report_exports;
drop policy if exists report_exports_delete on public.report_exports;

create policy report_exports_select on public.report_exports
  for select to authenticated
  using (true);

create policy report_exports_insert on public.report_exports
  for insert to authenticated
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy report_exports_update on public.report_exports
  for update to authenticated
  using (public.auth_role() in ('editor', 'manager', 'admin'))
  with check (public.auth_role() in ('editor', 'manager', 'admin'));

create policy report_exports_delete on public.report_exports
  for delete to authenticated
  using (public.auth_role() in ('manager', 'admin'));


-- ─────────────────────────────────────────────────────────────────────────────
-- Word templates — report_templates and template_placeholders
--
-- [INFERRED] §30 names suppliers, reports and their children, and says nothing
-- about the two template tables. They are not report content: README §16 and
-- §18 put template management in Settings, and src/lib/auth/roles.ts already
-- describes canManage() as "move a report through review, MANAGE TEMPLATES and
-- members". So: everyone reads them — the export modal has to show which
-- template is active — and manager+ writes. Changing the active template
-- silently changes the layout of every report exported afterwards, which is
-- not an editor-level act.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.report_templates enable row level security;

drop policy if exists report_templates_select on public.report_templates;
drop policy if exists report_templates_insert on public.report_templates;
drop policy if exists report_templates_update on public.report_templates;
drop policy if exists report_templates_delete on public.report_templates;

create policy report_templates_select on public.report_templates
  for select to authenticated
  using (true);

create policy report_templates_insert on public.report_templates
  for insert to authenticated
  with check (public.auth_role() in ('manager', 'admin'));

create policy report_templates_update on public.report_templates
  for update to authenticated
  using (public.auth_role() in ('manager', 'admin'))
  with check (public.auth_role() in ('manager', 'admin'));

create policy report_templates_delete on public.report_templates
  for delete to authenticated
  using (public.auth_role() in ('manager', 'admin'));


alter table public.template_placeholders enable row level security;

drop policy if exists template_placeholders_select on public.template_placeholders;
drop policy if exists template_placeholders_insert on public.template_placeholders;
drop policy if exists template_placeholders_update on public.template_placeholders;
drop policy if exists template_placeholders_delete on public.template_placeholders;

create policy template_placeholders_select on public.template_placeholders
  for select to authenticated
  using (true);

create policy template_placeholders_insert on public.template_placeholders
  for insert to authenticated
  with check (public.auth_role() in ('manager', 'admin'));

create policy template_placeholders_update on public.template_placeholders
  for update to authenticated
  using (public.auth_role() in ('manager', 'admin'))
  with check (public.auth_role() in ('manager', 'admin'));

create policy template_placeholders_delete on public.template_placeholders
  for delete to authenticated
  using (public.auth_role() in ('manager', 'admin'));


-- ─────────────────────────────────────────────────────────────────────────────
-- Storage
--
-- The three private buckets follow the same model, or the role would stop at
-- the table boundary: a viewer blocked from inserting a report_images row but
-- free to upload into the bucket is not a viewer. storage.objects.owner is the
-- uploader and stands in for created_by.
--
-- Phase 2 does not build the upload flows, so nothing here is exercised yet —
-- it is aligned now so the gap cannot be inherited by whoever does build them.
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
  with check (
    bucket_id in ('report-images', 'report-files', 'supplier-files')
    and public.auth_role() in ('editor', 'manager', 'admin')
  );

create policy "odm objects update" on storage.objects
  for update to authenticated
  using (
    bucket_id in ('report-images', 'report-files', 'supplier-files')
    and public.auth_role() in ('editor', 'manager', 'admin')
  )
  with check (
    bucket_id in ('report-images', 'report-files', 'supplier-files')
    and public.auth_role() in ('editor', 'manager', 'admin')
  );

-- The uploader may remove their own object — deleting a photo you just
-- uploaded by mistake is part of the upload flow, not an administrative act.
create policy "odm objects delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id in ('report-images', 'report-files', 'supplier-files')
    and (
      owner = auth.uid()
      or public.auth_role() in ('manager', 'admin')
    )
  );
