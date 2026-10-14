-- ─────────────────────────────────────────────────────────────────────────────
-- 0009 — the four-word caption
--
-- The appendix prints two photographs per row in a 7 cm cell. A full technical
-- caption — "Hydraulic performance testing bench used for pump flow, head and
-- efficiency verification" — wraps to three lines in that width and pushes the
-- grid about, while the same photograph as a §4.1 figure has the whole column
-- and wants the sentence.
--
-- So the model is asked for both in one call and the author picks. The long one
-- has always had `ai_caption`; this is where the short one waits between being
-- generated in a batch and being chosen. Captioning one photograph at a time
-- needs no column — the choice is offered the moment the reply arrives — but a
-- run over twenty photographs has nowhere to keep it.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.report_images
  add column if not exists ai_short_caption text not null default '';

comment on column public.report_images.ai_short_caption is
  'README §16 — the model''s four-word version, offered beside ai_caption. '
  'Like ai_caption it is a PROPOSAL: it becomes the caption only when the '
  'author picks it, and `caption` remains the only field the report prints.';
