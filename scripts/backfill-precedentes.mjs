// Backfill: ingest PROJECT_SUMMARY.md files into doa_proyectos_embeddings.
//
// Usage: from `01.Desarrollo de App/`:
//   OPENAI_API_KEY=... SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-precedentes.mjs
// Or set them in .env.local and source them manually before running.
//
// This script is NOT auto-run by the app. It is a one-off / re-runnable
// ingestion. Idempotent on (project_number, chunk_idx).
//
// Optional env:
//   PROJECTS_BASE  — absolute path to the "00. Proyectos Base" folder.
//                    Defaults to "../02. Datos DOA/05. Proyectos/00. Proyectos Base"
//                    resolved relative to the `01.Desarrollo de App/` folder.

import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createClient } from '@supabase/supabase-js';

import { embedText, EMBED_MODEL } from './lib/embed.mjs';

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// scripts/ is inside `01.Desarrollo de App/`, so this resolves to that folder
const APP_DIR = path.resolve(__dirname, '..');

const DEFAULT_PROJECTS_BASE = path.resolve(
  APP_DIR,
  '..',
  '02. Datos DOA',
  '05. Proyectos',
  '00. Proyectos Base'
);

const PROJECTS_BASE = process.env.PROJECTS_BASE
  ? path.resolve(process.env.PROJECTS_BASE)
  : DEFAULT_PROJECTS_BASE;

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const MAX_DEPTH = 3;
const SUMMARY_FILENAME = 'PROJECT_SUMMARY.md';
const TABLE = 'doa_proyectos_embeddings';
const PARAGRAPH_TARGET_CHARS = 1000;

// ---------------------------------------------------------------------------
// Filesystem walk
// ---------------------------------------------------------------------------

async function findSummaries(rootDir, maxDepth) {
  const out = [];
  async function walk(dir, depth) {
    if (depth > maxDepth) return;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch (err) {
      console.warn(`Skipping ${dir}: ${err.message}`);
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full, depth + 1);
      } else if (entry.isFile() && entry.name === SUMMARY_FILENAME) {
        out.push(full);
      }
    }
  }
  await walk(rootDir, 0);
  return out;
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

function extractProjectNumber(parentFolder) {
  // e.g. "208_094 Antenna installation" → "208_094"
  // Allow tokens like "208_094", "IM.A.226-0002", "EASA.IM.A.226-0001".
  const match = parentFolder.match(/^([A-Za-z0-9._-]+)/);
  return match ? match[1] : parentFolder;
}

function extractH1(markdown) {
  const match = markdown.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

function chunkByH2(markdown) {
  // Split on lines that start with "## " (H2). Each chunk includes its heading.
  const lines = markdown.split(/\r?\n/);
  const chunks = [];
  let current = [];
  let inFirstSection = true;

  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      if (current.length > 0) {
        chunks.push(current.join('\n').trim());
      }
      current = [line];
      inFirstSection = false;
    } else {
      // Skip the H1 / preamble before the first H2 unless there are no H2s at all.
      if (inFirstSection && /^#\s+/.test(line)) continue;
      current.push(line);
    }
  }
  if (current.length > 0) {
    const tail = current.join('\n').trim();
    if (tail) chunks.push(tail);
  }
  return chunks.filter((c) => c.length > 0);
}

function chunkByParagraphs(markdown, target = PARAGRAPH_TARGET_CHARS) {
  const paragraphs = markdown
    .split(/\r?\n\r?\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks = [];
  let buf = '';
  for (const p of paragraphs) {
    if (buf.length === 0) {
      buf = p;
    } else if (buf.length + 2 + p.length <= target) {
      buf = `${buf}\n\n${p}`;
    } else {
      chunks.push(buf);
      buf = p;
    }
  }
  if (buf.length > 0) chunks.push(buf);
  return chunks;
}

function chunkMarkdown(markdown) {
  const byH2 = chunkByH2(markdown);
  if (byH2.length >= 2) return byH2;
  return chunkByParagraphs(markdown);
}

function extractMetadataFields(markdown) {
  // Best-effort regex extraction. Returns nulls when not found.
  const find = (label) => {
    const re = new RegExp(`^\\s*[*_-]*\\s*${label}\\s*[:：]\\s*(.+?)\\s*$`, 'im');
    const m = markdown.match(re);
    return m ? m[1].trim() : null;
  };
  return {
    family: find('Family') ?? find('Familia'),
    classification: find('Classification') ?? find('Clasificaci[oó]n'),
    cert_basis: find('Cert(?:ification)? Basis') ?? find('Base de Certificaci[oó]n'),
  };
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

function makeSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error(
      'SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY must be set.'
    );
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function upsertRows(supabase, rows) {
  if (rows.length === 0) return { count: 0 };
  const { error, count } = await supabase
    .from(TABLE)
    .upsert(rows, { onConflict: 'project_number,chunk_idx', count: 'exact' });
  if (error) throw error;
  return { count: count ?? rows.length };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`[backfill-precedentes] embedding model: ${EMBED_MODEL}`);
  console.log(`[backfill-precedentes] projects base:   ${PROJECTS_BASE}`);

  try {
    const s = await stat(PROJECTS_BASE);
    if (!s.isDirectory()) throw new Error('not a directory');
  } catch (err) {
    console.error(`PROJECTS_BASE is not accessible: ${PROJECTS_BASE} (${err.message})`);
    process.exit(1);
  }

  const summaries = await findSummaries(PROJECTS_BASE, MAX_DEPTH);
  if (summaries.length === 0) {
    console.warn('No PROJECT_SUMMARY.md files found. Nothing to do.');
    return;
  }

  const supabase = makeSupabase();

  let totalFiles = 0;
  let totalChunks = 0;
  let totalErrors = 0;

  for (let i = 0; i < summaries.length; i++) {
    const filePath = summaries[i];
    const parentDir = path.dirname(filePath);
    const parentFolder = path.basename(parentDir);
    const projectNumber = extractProjectNumber(parentFolder);

    try {
      const content = await readFile(filePath, 'utf8');
      const projectTitle = extractH1(content);
      const chunks = chunkMarkdown(content);
      if (chunks.length === 0) {
        console.warn(`[${i + 1}/${summaries.length}] ${projectNumber} → 0 chunks (skipping)`);
        continue;
      }

      const metaFields = extractMetadataFields(content);
      const baseMetadata = {
        ...metaFields,
        source_path: parentDir,
        source_file: filePath,
      };

      const rows = [];
      for (let idx = 0; idx < chunks.length; idx++) {
        const chunkText = chunks[idx];
        const embedding = await embedText(chunkText);
        rows.push({
          project_number: projectNumber,
          project_title: projectTitle,
          chunk_idx: idx,
          chunk_text: chunkText,
          embedding,
          metadata: baseMetadata,
        });
      }

      const { count } = await upsertRows(supabase, rows);
      console.log(
        `[${i + 1}/${summaries.length}] ${projectNumber} → ${chunks.length} chunks → ${count} upserts`
      );
      totalFiles += 1;
      totalChunks += chunks.length;
    } catch (err) {
      totalErrors += 1;
      console.error(
        `[${i + 1}/${summaries.length}] ${projectNumber} FAILED: ${err.message ?? err}`
      );
    }
  }

  console.log(`Done. Files: ${totalFiles}. Chunks: ${totalChunks}. Errors: ${totalErrors}.`);
  if (totalErrors > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
