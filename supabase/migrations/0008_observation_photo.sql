-- ─────────────────────────────────────────────────────────────────────────────
-- 0008 — the photograph taken with an observation
--
-- README §17. Visit Mode's observation form has always drawn a "Related photo"
-- beside the text, and nothing was ever related: there was no column, so the
-- thumbnail was whatever the visit had most recently captured, standing there
-- while the form implied it belonged to the observation being written. The
-- block was removed rather than left lying; this puts the real thing behind it.
--
-- One photograph, not many: the observation is a sentence about a thing, and
-- the appendix is where a set of photographs belongs. The row points at an
-- existing `report_images` row rather than storing bytes of its own, so a
-- photograph attached in the field is the same object the appendix prints and
-- the same object the export downloads — captioned once, stored once.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.report_observations
  add column if not exists image_id uuid
    references public.report_images (id) on delete set null;

comment on column public.report_observations.image_id is
  'README §17 — the photograph captured with this observation in the field. '
  'Points at the report''s own report_images row, so the appendix and the '
  'observation show the same object. ON DELETE SET NULL: deleting a photograph '
  'from the appendix must not delete the observation that referred to it.';

-- Answering "which observation is this photograph attached to?" when a
-- photograph is deleted, and "show me the photo" when an observation renders.
create index if not exists report_observations_image_idx
  on public.report_observations (image_id);
