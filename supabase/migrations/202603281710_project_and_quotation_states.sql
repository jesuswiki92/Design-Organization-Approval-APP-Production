ALTER TABLE IF EXISTS public.doa_proyectos_generales
  ADD COLUMN IF NOT EXISTS estado_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS estado_updated_by text,
  ADD COLUMN IF NOT EXISTS estado_motivo text;

ALTER TABLE IF EXISTS public.doa_ofertas
  ADD COLUMN IF NOT EXISTS estado_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS estado_updated_by text,
  ADD COLUMN IF NOT EXISTS estado_motivo text;

CREATE TABLE IF NOT EXISTS public.doa_proyectos_estado_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES public.doa_proyectos_generales(id) ON DELETE CASCADE,
  estado_anterior text,
  estado_nuevo text NOT NULL,
  motivo text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text
);

CREATE TABLE IF NOT EXISTS public.doa_ofertas_estado_historial (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  oferta_id uuid NOT NULL REFERENCES public.doa_ofertas(id) ON DELETE CASCADE,
  estado_anterior text,
  estado_nuevo text NOT NULL,
  motivo text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  changed_by text
);

CREATE INDEX IF NOT EXISTS doa_proyectos_estado_historial_proyecto_idx
  ON public.doa_proyectos_estado_historial(proyecto_id, changed_at DESC);

CREATE INDEX IF NOT EXISTS doa_ofertas_estado_historial_oferta_idx
  ON public.doa_ofertas_estado_historial(oferta_id, changed_at DESC);

UPDATE public.doa_proyectos_generales
SET estado_updated_at = COALESCE(estado_updated_at, created_at)
WHERE estado_updated_at IS NULL;

UPDATE public.doa_ofertas
SET estado_updated_at = COALESCE(estado_updated_at, created_at)
WHERE estado_updated_at IS NULL;
