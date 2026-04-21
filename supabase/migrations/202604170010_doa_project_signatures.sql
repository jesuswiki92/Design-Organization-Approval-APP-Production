-- ============================================================================
-- Migration: doa_project_signatures (non-repudiation signature records)
-- Date: 2026-04-17
-- Sprint: 2 (close-the-loop)
-- Description:
--   Part 21J non-repudiation signatures for project validation, return,
--   delivery release and closure decisions. Each row captures the canonical
--   payload that was signed, a SHA-256 hash of that payload, and an HMAC
--   signature (HMAC-SHA256).
--
-- HMAC algorithm (computed server-side in Node):
--   const canonical = canonicalJSON(payload)  -- sorted keys at every level
--   payload_hash    = crypto.createHash('sha256').update(canonical).digest('hex')
--   hmac_signature  = crypto
--                       .createHmac('sha256', process.env.DOA_SIGNATURE_HMAC_SECRET)
--                       .update(canonical)
--                       .digest('hex')
--   hmac_key_id     = 'v1'  -- rotation id; rotate by introducing v2 etc.
--
-- Payload canonicalization rule:
--   Stable JSON with sorted keys at every object level. Arrays keep their
--   order. Primitives serialize as standard JSON. See lib/signatures/hmac.ts.
--
-- TODO(sprint-3): harden HMAC rotation policy and document key custody.
-- TODO(sprint-4): enforce per-role RLS (only DOH/DOS can sign approvals).
--
--   Populated by POST /api/proyectos/[id]/validar (and later endpoints for
--   delivery release / closure).
-- ============================================================================

CREATE TABLE IF NOT EXISTS doa_project_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  proyecto_id uuid NOT NULL REFERENCES doa_proyectos(id) ON DELETE CASCADE,
  validation_id uuid REFERENCES doa_project_validations(id),
  signer_user_id uuid NOT NULL REFERENCES auth.users(id),
  signer_role text NOT NULL CHECK (signer_role IN ('doh','dos','staff','manager','cvc')),
  signature_type text NOT NULL CHECK (signature_type IN (
    'validation_approval',
    'validation_return',
    'delivery_release',
    'closure'
  )),
  payload_hash text NOT NULL,
  hmac_signature text NOT NULL,
  hmac_key_id text NOT NULL DEFAULT 'v1',
  signed_payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_doa_project_signatures_proyecto
  ON doa_project_signatures(proyecto_id);
CREATE INDEX IF NOT EXISTS idx_doa_project_signatures_validation
  ON doa_project_signatures(validation_id);
CREATE INDEX IF NOT EXISTS idx_doa_project_signatures_signer
  ON doa_project_signatures(signer_user_id);
CREATE INDEX IF NOT EXISTS idx_doa_project_signatures_proyecto_created
  ON doa_project_signatures(proyecto_id, created_at DESC);

ALTER TABLE doa_project_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY doa_project_signatures_select ON doa_project_signatures
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY doa_project_signatures_service_all ON doa_project_signatures
  FOR ALL USING (auth.role() = 'service_role');

COMMENT ON TABLE doa_project_signatures IS
  'Part 21J non-repudiation signatures. HMAC-SHA256 over canonical JSON of the '
  'signed_payload, keyed by DOA_SIGNATURE_HMAC_SECRET. Key rotation via hmac_key_id.';
