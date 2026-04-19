/**
 * ============================================================================
 * LiteLLM client (Fase 6 — AMS self-hosted gateway)
 * ============================================================================
 *
 * Unifica todo el acceso a LLM y embeddings detras de LiteLLM
 * (http://ams-litellm:4000 dentro de la red docker `ams_internal`).
 *
 * LiteLLM es OpenAI-compatible, asi que seguimos usando el SDK `openai`
 * cambiando solo `baseURL` y `apiKey`. El SDK original con baseURL de
 * OpenRouter queda retirado (ver PHASE-6-MIGRATION-PLAN.md).
 *
 * Auth: todos los requests salientes llevan `Authorization: Bearer
 * ${LITELLM_MASTER_KEY}`. La master key viene del Docker secret
 * `litellm_master_key`, la carga `nextjs/entrypoint.sh` en runtime.
 *
 * Alias de modelo registrados en `litellm/config.yaml`:
 *   - llm-default             -> LocalAI (primary, llama-3.2 u otro cargado)
 *   - llm-cloud-gpt5-mini     -> OpenAI gpt-5-mini (fallback cloud)
 *   - embedding-default       -> LocalAI (futuro; dim depende del modelo)
 *   - embedding-cloud-3-large -> OpenAI text-embedding-3-large (3072 dim)
 *
 * Usado por:
 *   - app/api/tools/chat/route.ts
 *   - app/api/consultas/[id]/preliminary-scope/{chat,analyze}/route.ts
 *   - app/api/consultas/[id]/modification-description/analyze/route.ts
 *   - app/api/consultas/[id]/compliance-documents/suggest/route.ts
 *   - app/api/consultas/[id]/change-classification/{analyze,chat,generate-email}/route.ts
 *   - lib/rag/embed.ts
 *   - lib/rag/precedentes.ts#reindexPrecedente
 */

import 'server-only'
import OpenAI from 'openai'

let _client: OpenAI | null = null

/**
 * Devuelve un cliente OpenAI SDK apuntado a LiteLLM.
 * Singleton por proceso; reutiliza el pool httpx keep-alive.
 *
 * @throws Error si falta LITELLM_MASTER_KEY en el entorno.
 */
export function getLiteLLM(): OpenAI {
  if (_client) return _client

  const apiKey = process.env.LITELLM_MASTER_KEY
  const rawBase = process.env.LITELLM_BASE_URL || 'http://ams-litellm:4000/v1'
  // Tolerar LITELLM_BASE_URL configurada sin /v1 (p.ej. compose: http://ams-litellm:4000).
  const baseURL = rawBase.replace(/\/+$/, '').endsWith('/v1')
    ? rawBase
    : `${rawBase.replace(/\/+$/, '')}/v1`

  if (!apiKey) {
    throw new Error(
      'Falta LITELLM_MASTER_KEY en el entorno. ' +
        'En AMS llega via Docker secret `litellm_master_key` + nextjs/entrypoint.sh.',
    )
  }

  _client = new OpenAI({ apiKey, baseURL })
  return _client
}

// -----------------------------------------------------------------------------
// Alias de modelos (unica fuente de verdad para call sites).
// -----------------------------------------------------------------------------

/** Chat/completion default -> LocalAI (fallback automatico a cloud gpt-5-mini). */
export const MODEL_LLM_DEFAULT = 'llm-default'

/** Chat/completion forzado a cloud (gpt-5-mini). Usar cuando LocalAI no basta. */
export const MODEL_LLM_CLOUD_MINI = 'llm-cloud-gpt5-mini'

/** Embeddings cloud (text-embedding-3-large, 3072 dim). */
export const MODEL_EMBEDDING_CLOUD = 'embedding-cloud-3-large'

/** Embeddings locales (LocalAI; dim variable segun modelo cargado). */
export const MODEL_EMBEDDING_LOCAL = 'embedding-default'

/** Alias retrocompatibles con PHASE-6-MIGRATION-PLAN.md. */
export const DEFAULT_CHAT_MODEL = MODEL_LLM_DEFAULT
export const DEFAULT_EMBED_MODEL = MODEL_EMBEDDING_CLOUD

/**
 * Export del cliente como `litellmClient` para call sites que prefieran la
 * forma `import { litellmClient }` en lugar de la factory `getLiteLLM()`.
 * Ambas formas son equivalentes; la factory es preferible porque difiere la
 * validacion de env var al primer uso (no al import).
 */
export const litellmClient: OpenAI = new Proxy({} as OpenAI, {
  get(_target, prop) {
    const real = getLiteLLM()
    // @ts-expect-error — proxy pass-through al SDK real.
    return real[prop]
  },
})
