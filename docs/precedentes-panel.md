# Precedentes Panel — Operator Runbook

## Overview
The Precedentes Panel surfaces the top-3 most similar past projects for any
active project, powered by vector search over the auto-generated
PROJECT_SUMMARY.md files in `02. Datos DOA/05. Proyectos/00. Proyectos Base/`.

This document explains the one-time setup steps required after the code is
deployed.

## Architecture

```
PROJECT_SUMMARY.md files (filesystem)
          |
          v
scripts/backfill-precedentes.mjs (Node)
          |
          v
Supabase: doa_proyectos_embeddings (pgvector(3072))
          ^
          |
app/api/proyectos/[id]/precedentes (Next.js, requireUserApi)
          ^
          |
app/(dashboard)/engineering/projects/[id]/PrecedentesSection (React)
          ^
          |
      Engineer
```

## One-time setup (in order)

### 1. Provision OPENAI_API_KEY
Add to `01.Desarrollo de App/.env.local`:

    OPENAI_API_KEY=sk-...

Restart the dev server after this.

### 2. Apply the migration
Open the Supabase SQL editor for the project and execute the contents of:

    01.Desarrollo de App/supabase/migrations/202604081200_create_doa_proyectos_embeddings.sql

This creates the `doa_proyectos_embeddings` table, the `match_proyectos_precedentes`
RPC, and the RLS policy. The migration is idempotent — safe to re-run.

### 3. Run the backfill
From `01.Desarrollo de App/`:

    node scripts/backfill-precedentes.mjs

Required env vars: `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
Optional: `PROJECTS_BASE` (defaults to `../02. Datos DOA/05. Proyectos/00. Proyectos Base`).

Expected output:

    [1/26] processing 208_094 -> 12 chunks -> 12 upserts
    [2/26] processing 320388 -> 8 chunks -> 8 upserts
    ...
    Done. Files: 26. Chunks: 240. Errors: 0.

The script is idempotent (upsert by `(project_number, chunk_idx)`).

## Verifying it works

1. Open the active project detail page in the app.
2. Scroll to the "Proyectos similares" section at the bottom.
3. You should see up to 3 cards with classification badges and similarity scores.
4. If you still see "Indice de precedentes no inicializado", one of the 3 setup
   steps above hasn't been completed.

## Known limitations
- Only 26 of 56 projects in `00. Proyectos Base` currently have a
  PROJECT_SUMMARY.md file. The other 30 are silently absent from results.
  A future change (`docx-compliance-matrix-parser`) will index those.
- The classification (Minor/Major) and certification basis are extracted
  best-effort from the markdown summary headings. Some old projects have
  misparsed values (e.g. A3030). Treat the cards as a starting point and
  verify against the source folder.
- Embedding model is `text-embedding-3-large` (3072 dim). Sequential scan
  is used because pgvector ivfflat/hnsw cap at 2000 dim.
- The "Copiar ruta" button puts the absolute Windows path on the clipboard.
  It works in HTTPS contexts and on `localhost`, but not on plain HTTP
  served from a non-localhost host.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "Indice de precedentes no inicializado" | Migration not applied OR backfill not run | Run setup steps 2 and 3 |
| "OPENAI_API_KEY missing" | Env var not provisioned | Setup step 1 |
| All projects empty | Backfill found no PROJECT_SUMMARY.md files | Check `PROJECTS_BASE` env var path |
| Card classification shows "Sin clasificar" | Markdown summary has missing/misparsed field | Manual fix in source PROJECT_SUMMARY.md |
| 401 Unauthorized | Session expired | Refresh / re-login |
