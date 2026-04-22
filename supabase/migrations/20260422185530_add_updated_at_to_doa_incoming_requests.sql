-- Add updated_at column + trigger to doa_incoming_requests
-- Why: audit & cache-busting; app writes to this table but has no
-- reliable "last touched" timestamp today.

-- 1) Column (NOT NULL with default so all existing rows get a value).
ALTER TABLE public.doa_incoming_requests
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2) Backfill to created_at to keep the first value meaningful (not "today").
UPDATE public.doa_incoming_requests
   SET updated_at = COALESCE(created_at, now())
 WHERE updated_at IS DISTINCT FROM COALESCE(created_at, now());

-- 3) Shared trigger function (idempotent).
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 4) Trigger (drop + recreate to stay idempotent across reruns).
DROP TRIGGER IF EXISTS trg_doa_incoming_requests_set_updated_at
  ON public.doa_incoming_requests;

CREATE TRIGGER trg_doa_incoming_requests_set_updated_at
BEFORE UPDATE ON public.doa_incoming_requests
FOR EACH ROW
EXECUTE FUNCTION public.set_updated_at_timestamp();

COMMENT ON COLUMN public.doa_incoming_requests.updated_at IS
  'Row last-modified timestamp. Maintained by trg_doa_incoming_requests_set_updated_at trigger. Do not write directly from app code.';
