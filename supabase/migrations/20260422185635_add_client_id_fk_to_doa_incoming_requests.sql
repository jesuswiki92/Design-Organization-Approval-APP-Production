-- Add nullable client_id FK to doa_incoming_requests.
-- Why: canonicalise the relationship between a request and the client that
-- originated it. Today the link is implicit (via sender email or the project
-- spawned from the request). A real FK lets joins be typed and cascades
-- handle client deletion safely.

-- 1) Column.
ALTER TABLE public.doa_incoming_requests
  ADD COLUMN IF NOT EXISTS client_id UUID NULL;

-- 2) Safe backfill — match by email domain, BUT skip well-known generic
--    free-email providers to avoid false positives (e.g. "gmail.com"
--    catch-all rows). Prefers the inbound email's from_addr; falls back to
--    r.sender when no inbound email row exists.
WITH matcher AS (
  SELECT
    r.id AS request_id,
    lower(split_part(COALESCE(e.from_addr, r.sender, ''), '@', 2)) AS domain
  FROM public.doa_incoming_requests r
  LEFT JOIN LATERAL (
    SELECT from_addr
      FROM public.doa_emails
     WHERE incoming_request_id = r.id
       AND direction = 'inbound'
     ORDER BY sent_at NULLS LAST, created_at DESC
     LIMIT 1
  ) e ON TRUE
),
resolved AS (
  SELECT
    m.request_id,
    (SELECT c.id
       FROM public.doa_clients c
      WHERE c.email_domain IS NOT NULL
        AND c.email_domain <> ''
        AND lower(c.email_domain) = m.domain
        -- Skip catch-all free-email provider domains. A corporate client
        -- should never have one of these as their email_domain.
        AND lower(c.email_domain) NOT IN (
          'gmail.com','googlemail.com','yahoo.com','yahoo.es','hotmail.com',
          'hotmail.es','outlook.com','outlook.es','live.com','icloud.com',
          'me.com','aol.com','proton.me','protonmail.com','gmx.com','gmx.es'
        )
      LIMIT 1
    ) AS client_id
  FROM matcher m
)
UPDATE public.doa_incoming_requests r
   SET client_id = s.client_id
  FROM resolved s
 WHERE r.id = s.request_id
   AND s.client_id IS NOT NULL
   AND r.client_id IS NULL;

-- 3) FK constraint (idempotent via DO block).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'doa_incoming_requests_client_id_fkey'
  ) THEN
    ALTER TABLE public.doa_incoming_requests
      ADD CONSTRAINT doa_incoming_requests_client_id_fkey
      FOREIGN KEY (client_id)
      REFERENCES public.doa_clients(id)
      ON DELETE SET NULL;
  END IF;
END$$;

-- 4) Index for lookup "all requests for client X".
CREATE INDEX IF NOT EXISTS idx_doa_incoming_requests_client_id
  ON public.doa_incoming_requests (client_id);

COMMENT ON COLUMN public.doa_incoming_requests.client_id IS
  'Optional FK -> doa_clients.id. May be NULL for requests whose sender cannot be matched to a known client (free-email senders, first-time contacts). Set at intake by n8n when a match is available, or later via the "Assign client" UI.';
