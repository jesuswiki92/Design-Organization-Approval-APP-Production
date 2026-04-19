-- Bug 3 fix: thread matching via Outlook conversationId
ALTER TABLE public.ams_consultas_entrantes
  ADD COLUMN IF NOT EXISTS outlook_conversation_id text;

CREATE INDEX IF NOT EXISTS idx_ams_consultas_entrantes_outlook_conversation_id
  ON public.ams_consultas_entrantes (outlook_conversation_id)
  WHERE outlook_conversation_id IS NOT NULL;

COMMENT ON COLUMN public.ams_consultas_entrantes.outlook_conversation_id
  IS 'Microsoft Graph conversationId. Used to match reply emails to existing consulta instead of creating a new row per reply. Populated by n8n workflows pEFW1V46yyLR58c8 and LXrCDXbl3zKUmRRE.';
