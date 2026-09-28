-- ─────────────────────────────────────────────────────────────────────────────
-- 0006 — image dimensions, and the transcript text a report is analysed from
--
-- Additive only. Nothing here rewrites applied history: 0001..0005 stay exactly
-- as they were applied, and every statement below is safe to run twice.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Image dimensions ─────────────────────────────────────────────────────────
-- The DOCX export prints appendix photographs at a fixed 6.5 cm height and has
-- to know the aspect ratio to size the box. Reading it back out of the stored
-- bytes at export time would mean decoding every image on a serverless request;
-- the browser already knows both numbers at upload, so it sends them.
--
-- Nullable on purpose: a row written before this migration, or by a client that
-- could not decode the file, is still a usable photograph. The exporter falls
-- back to 4:3 rather than refusing.

alter table public.report_images
  add column if not exists width  integer check (width  is null or width  > 0),
  add column if not exists height integer check (height is null or height > 0);

comment on column public.report_images.width is
  'Natural pixel width, measured in the browser at upload. Null when unknown; '
  'the DOCX exporter then assumes 4:3 (src/lib/reports/appendix-layout.ts).';
comment on column public.report_images.height is
  'Natural pixel height. See width.';

-- ── Transcript text ──────────────────────────────────────────────────────────
-- README §11: a Plaud transcript enters the report either as pasted text or as
-- an uploaded .txt/.md, and the assistant analyses the extracted text rather
-- than the original file. 0001 gave report_files the file metadata but nowhere
-- to put the text, so analysis would have had to re-download and re-parse the
-- object on every run — and pasted text has no object at all.
--
-- `storage_path` is NOT NULL in 0001, which assumed every source is a file.
-- Pasted text is a legitimate source with no file behind it, so the column is
-- relaxed and the pair is constrained instead: a row must carry text, or an
-- object, or both, but never neither.

alter table public.report_files
  add column if not exists content text not null default '';

alter table public.report_files
  alter column storage_path drop not null;

do $do$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'report_files_has_source'
  ) then
    alter table public.report_files
      add constraint report_files_has_source
      check (content <> '' or storage_path is not null);
  end if;
end
$do$;

comment on column public.report_files.content is
  'The extracted plain text the assistant analyses, for kind = transcript. '
  'Empty for a binary source. The original file, when there is one, stays in '
  'the report-files bucket and is referenced by storage_path.';

-- Finding a report's transcript is the only query this table gets.
create index if not exists report_files_report_kind_idx
  on public.report_files (report_id, kind, created_at desc);

-- ── Export bookkeeping ───────────────────────────────────────────────────────
-- report_exports already records that an export happened. The download needs to
-- know what the file was called, so the same report re-downloads under the same
-- name rather than a freshly derived one that may have drifted.

alter table public.report_exports
  add column if not exists file_name text not null default '';

comment on column public.report_exports.file_name is
  'The generated filename, e.g. GSO-2608001x00_TESK_Visit_Report.docx.';

-- ── Storage policies for the private buckets ─────────────────────────────────
-- 0001 created report-images, report-files and supplier-files with public=false,
-- and 0004 set the table policies. These are the object-level policies: without
-- them an authenticated user can reach any object in the bucket regardless of
-- which report it belongs to.
--
-- The path convention the application writes is `<report_id>/<uuid>.<ext>`, so
-- the first path segment is the report id and membership can be decided from it.

do $do$
begin
  -- Read: any signed-in user may read an object belonging to a report they can
  -- see. Report visibility is already decided by the reports policies, so this
  -- defers to them rather than restating the rule.
  drop policy if exists report_images_objects_select on storage.objects;
  create policy report_images_objects_select on storage.objects
    for select to authenticated
    using (
      bucket_id in ('report-images', 'report-files')
      and exists (
        select 1 from public.reports r
        where r.id::text = split_part(name, '/', 1)
      )
    );

  -- Write: editor and above, same as the report rows themselves.
  drop policy if exists report_images_objects_insert on storage.objects;
  create policy report_images_objects_insert on storage.objects
    for insert to authenticated
    with check (
      bucket_id in ('report-images', 'report-files')
      and public.auth_role() in ('admin', 'manager', 'editor')
      and exists (
        select 1 from public.reports r
        where r.id::text = split_part(name, '/', 1)
      )
    );

  drop policy if exists report_images_objects_update on storage.objects;
  create policy report_images_objects_update on storage.objects
    for update to authenticated
    using (
      bucket_id in ('report-images', 'report-files')
      and public.auth_role() in ('admin', 'manager', 'editor')
    );

  -- Delete: a photograph is genuinely removable, unlike a report, so editors
  -- may delete the object they just uploaded. The row is deleted alongside it.
  drop policy if exists report_images_objects_delete on storage.objects;
  create policy report_images_objects_delete on storage.objects
    for delete to authenticated
    using (
      bucket_id in ('report-images', 'report-files')
      and public.auth_role() in ('admin', 'manager', 'editor')
    );

  -- Supplier files follow the supplier tables: read for everyone signed in,
  -- write for editor and above.
  drop policy if exists supplier_files_objects_select on storage.objects;
  create policy supplier_files_objects_select on storage.objects
    for select to authenticated
    using (bucket_id = 'supplier-files');

  drop policy if exists supplier_files_objects_write on storage.objects;
  create policy supplier_files_objects_write on storage.objects
    for insert to authenticated
    with check (
      bucket_id = 'supplier-files'
      and public.auth_role() in ('admin', 'manager', 'editor')
    );
end
$do$;

-- Anonymous users get nothing from any bucket. The buckets are private, so
-- there is no public URL either; the application issues signed URLs instead.
revoke all on storage.objects from anon;
