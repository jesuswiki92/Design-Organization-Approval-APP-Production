// Server-side embedding helper for the Next.js app.
// Mirrors scripts/lib/embed.mjs (used by the backfill script). Keep them in sync.
import OpenAI from 'openai';

const MODEL = 'text-embedding-3-large';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

export async function embedText(text: string): Promise<number[]> {
  const trimmed = (text ?? '').trim();
  if (!trimmed) {
    throw new Error('embedText: empty input');
  }
  const c = getClient();
  const response = await c.embeddings.create({
    model: MODEL,
    input: trimmed,
  });
  const vec = response.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length === 0) {
    throw new Error('embedText: API returned no vector');
  }
  return vec;
}

export const EMBED_MODEL = MODEL;
