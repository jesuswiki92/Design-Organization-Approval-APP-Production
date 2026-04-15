-- ============================================================================
-- Migration: doa_project_deliveries (Statement of Compliance dispatch records)
-- Date: 2026-04-18
-- Sprint: 3 (close-the-loop)
-- Description:
--   Tracks each dispatch of a Statement of Compliance (SoC) and related
--   deliverables package to the client. Each row represents a single send
--   attempt: it captures the recipient, the signed PDF stored in Supabase
--   Storage, the HMAC delivery_release signature that backs it, the n8n
--   execution that actually sent the email, and whether the client has
--   confirmed reception via the public confirmation link.
--
--   State machine for `dispatch_status`:
--     pendiente -> enviando -> enviado -> confirmado_cliente
--                       \-> fallo (n8n webhook returned non-2xx)
--
--   Populated by:
--     POST /api/proyectos/[id]/preparar-entrega   -> INSERT (pendiente)
--     POST /api/proyectos/[id]/enviar-entrega     -> UPDATE (enviando/enviado/fallo)
--     POST /api/proyectos/[id]/confirmar-entrega  -> UPDATE (confirmado_cliente)
--
--   The confirmation token is a 32-byte base64url random string generated at
--   preparation time. The client email links to
--   /api/proyectos/[id]/confirmar-entrega?token=... which marks the delivery
--   as confirmed and transitions the project to `confirmacion_cliente`.
--
-- TODO(sprint-3): add backfill for legacy projects if any.
-- TODO(sprint-4): per-role RLS (only DOH/DOS can trigger a dispatch).
-- ============================================================================

CREATE TABLE IF NOT EXISTS doa_project_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES doa_proyectos(id) ON DELETE CASCADE,
  validation_id uuid REFERENCES doa_project_validations(id),
  signature_id uuid REFERENCES doa_project_signatures(id),
  sent_by_user_id uuid NOT NULL REFERENCES auth.users(id),
  recipient_email text NOT NULL,
  recipient_name text,
  cc_emails text[],
  subject text NOT NULL,
  body text,
  soc_pdf_storage_path text,
  soc_pdf_sha256 text,
  attachments jsonb DEFAULT '[]'::jsonb,
  n8n_execution_id text,
  dispatch_status text NOT NULL DEFAULT 'pendiente'
    CHECK (dispatch_status IN ('pendiente','enviando','enviado','fallo','confirmado_cliente')),
  dispatched_at timestamptz,
  client_confirmed_at timestamptz,
  client_confirmation_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doa_project_deliveries_proyecto
  ON doa_project_deliveries(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_doa_project_deliveries_proyecto_created
  ON doa_project_deliveries(proyecto_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_doa_project_deliveries_dispatch_status
  ON doa_project_deliveries(dispatch_status);

ALTER TABLE doa_project_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS doa_project_deliveries_select ON doa_project_deliveries;
CREATE POLICY doa_project_deliveries_select ON doa_project_deliveries
  FOR SELECT USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS doa_project_deliveries_service_all ON doa_project_deliveries;
CREATE POLICY doa_project_deliveries_service_all ON doa_project_deliveries
  FOR ALL USING (auth.role() = 'service_role');

-- updated_at trigger (same pattern as doa_project_deliverables)
CREATE OR REPLACE FUNCTION set_doa_project_deliveries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_doa_project_deliveries_updated_at ON doa_project_deliveries;
CREATE TRIGGER trg_doa_project_deliveries_updated_at
  BEFORE UPDATE ON doa_project_deliveries
  FOR EACH ROW EXECUTE FUNCTION set_doa_project_deliveries_updated_at();

COMMENT ON TABLE doa_project_deliveries IS
  'Statement of Compliance dispatch records. One row per send attempt. '
  'Linked to a validation, a delivery_release signature and (optionally) an '
  'n8n execution. Confirmation token is a 32-byte base64url random string.';
