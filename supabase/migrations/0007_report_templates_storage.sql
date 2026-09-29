-- ─────────────────────────────────────────────────────────────────────────────
-- 0007 — the corporate Word template becomes a real, stored file
--
-- Additive only. Nothing here rewrites applied history: 0001..0006 stay exactly
-- as they were applied, and every statement below is safe to run twice.
--
-- 0001 created `report_templates` but no bucket to put the .docx in, so the
-- Report Templates screen had nowhere to upload to and the exporter had no
-- shell to clone. This migration gives the table its bucket, its object-level
-- policies, and one column for the geometry read out of the file at upload.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── The bucket ───────────────────────────────────────────────────────────────
-- Private, exactly like the three 0001 creates: a corporate template carries the
-- company letterhead and signature image, so it is never publicly addressable.
-- The application reads it server-side and issues signed URLs for downloads.
-- Guarded so re-running this migration on a provisioned project is harmless.

insert into storage.buckets (id, name, public)
values ('report-templates', 'report-templates', false)
on conflict (id) do nothing;

-- ── Object-level policies ────────────────────────────────────────────────────
-- Same shape as the report-images policies in 0006: read for anyone signed in,
-- write for a role that is allowed to manage templates.
--
-- Writes are manager/admin rather than editor+ on purpose, and this is the one
-- place these policies deliberately differ from 0006. 0004 already decided that
-- `report_templates` ROWS are manager+ ("changing the active template silently
-- changes the layout of every report exported afterwards, which is not an
-- editor-level act"), and src/lib/auth/roles.ts describes canManage() as
-- "manage templates". A storage policy looser than the row policy would only
-- let an editor write objects that can never get a row — orphans nobody sees.
--
-- Read stays open to every signed-in user because the export modal and the
-- Templates screen both have to show and download the active version.

do $do$
begin
  drop policy if exists report_templates_objects_select on storage.objects;
  create policy report_templates_objects_select on storage.objects
    for select to authenticated
    using (bucket_id = 'report-templates');

  drop policy if exists report_templates_objects_insert on storage.objects;
  create policy report_templates_objects_insert on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'report-templates'
      and public.auth_role() in ('admin', 'manager')
    );

  drop policy if exists report_templates_objects_update on storage.objects;
  create policy report_templates_objects_update on storage.objects
    for update to authenticated
    using (
      bucket_id = 'report-templates'
      and public.auth_role() in ('admin', 'manager')
    );

  -- A superseded version is genuinely removable, unlike a report: deleting the
  -- row and deleting the object happen together in deleteTemplate().
  drop policy if exists report_templates_objects_delete on storage.objects;
  create policy report_templates_objects_delete on storage.objects
    for delete to authenticated
    using (
      bucket_id = 'report-templates'
      and public.auth_role() in ('admin', 'manager')
    );
end
$do$;

-- ── Measured page geometry ───────────────────────────────────────────────────
-- The Templates screen shows the template's page size, margins, text box,
-- appendix column count and body font. Those facts live in the .docx, so they
-- are read once when the file is uploaded and stored here rather than re-parsed
-- (unzip + inflate word/document.xml) on every page load.
--
-- Keys written by uploadTemplate() in src/lib/data/template-actions.ts, all
-- optional — an unparseable template is still a usable template, and stores {}:
--   pageWidthCm, pageHeightCm          w:pgSz, twips / 567
--   orientation                        "portrait" | "landscape"
--   marginTopCm, marginRightCm,
--   marginBottomCm, marginLeftCm       w:pgMar, twips / 567
--   textWidthCm, textHeightCm          page minus its margins
--   appendixColumns                    w:gridCol count of the appendix table
--   bodyFont, bodyFontSizePt           the font and size most runs use

alter table public.report_templates
  add column if not exists page_geometry jsonb not null default '{}'::jsonb;

comment on column public.report_templates.page_geometry is
  'Page geometry measured from the uploaded .docx at upload time: page size, '
  'margins, text box, appendix column count and body font, in centimetres and '
  'points. Empty object when the file could not be measured — see '
  'src/lib/data/template-actions.ts for the exact keys.';

-- ── Placeholder rows ─────────────────────────────────────────────────────────
-- Checked: 0001 seeds no `report_templates` rows, and neither does 0003..0006 —
-- the three versions the screen used to list are TypeScript fixtures in
-- src/lib/mock-data/templates.ts, not database rows. This delete is therefore a
-- no-op on a project that only ever ran the migrations, and is kept for the
-- projects where placeholder rows were inserted by hand while the screen was
-- mock.
--
-- `storage_path is null` is the safe predicate: a row with no object behind it
-- cannot be exported from and cannot be downloaded, so it is a placeholder by
-- definition. uploadTemplate() puts the object in the bucket BEFORE inserting
-- the row, so a real template never exists in this state, not even briefly —
-- which is what makes the predicate safe to run against live data.

delete from public.report_templates
where storage_path is null;
