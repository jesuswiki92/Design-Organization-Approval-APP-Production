// Server-side embedding helper for the Next.js app.
// Fase 6: ruta los embeddings por LiteLLM (alias `embedding-cloud-3-large`),
// que a su vez llama a OpenAI text-embedding-3-large (3072 dim). Mantenemos
// la misma dimension que la tabla `proyectos_embeddings` usa (vector(3072))
// para no tener que re-embeder.
//
// Mirrors `scripts/lib/embed.mjs` (node standalone, para scripts de backfill).
// Si uno cambia, actualizar el otro.
import 'server-only'
import { getLiteLLM, MODEL_EMBEDDING_CLOUD } from '@/lib/llm/litellm-client'

const MODEL = MODEL_EMBEDDING_CLOUD

export async function embedText(text: string): Promise<number[]> {
  const trimmed = (text ?? '').trim()
  if (!trimmed) {
    throw new Error('embedText: empty input')
  }
  const client = getLiteLLM()
  const response = await client.embeddings.create({
    model: MODEL,
    input: trimmed,
  })
  const vec = response.data?.[0]?.embedding
  if (!Array.isArray(vec) || vec.length === 0) {
    throw new Error('embedText: API returned no vector')
  }
  return vec
}

export const EMBED_MODEL = MODEL
