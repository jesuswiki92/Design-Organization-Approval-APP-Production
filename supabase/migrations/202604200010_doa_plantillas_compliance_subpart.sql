-- Block 5 / Item D: Add subpart_easa to doa_plantillas_compliance.
--
-- The `planificar` endpoint writes subpart_easa: null to doa_project_deliverables
-- because the catalog table doesn't expose it. We add the column now (nullable)
-- so values can be filled in incrementally. No CHECK constraint — the EASA
-- subparts are a short catalog but we want to allow free text until the
-- mapping is finalized.
alter table public.doa_plantillas_compliance
  add column if not exists subpart_easa text;

comment on column public.doa_plantillas_compliance.subpart_easa is
  'EASA Part 21 Subpart code (e.g. "21.A.239", "21.A.257"). Nullable while mapping is incomplete. Block 5 / Item D.';
