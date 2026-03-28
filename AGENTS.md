# AGENTS.md — DOA Operations Hub

## What the App Does

DOA Operations Hub is an internal tool for aerospace engineering teams working under EASA Part 21J Design Organisation Approval. It provides project tracking, task management, document storage, client and aircraft registers, and engineering reference utilities. Authentication is handled by Supabase. Most data pages currently render hardcoded mock arrays; the active development focus is wiring them to real Supabase queries.

---

## Stack Summary

| Concern | Technology |
|---|---|
| Framework | Next.js 16, App Router |
| Language | TypeScript (strict) |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| State | Zustand |
| Backend | Supabase (PostgreSQL, Auth, Storage) |
| Vector search | pgvector (HNSW index, 1536 dimensions) |
| Containerisation | Docker + Docker Compose |

---

## Where to Find Types

All database row types are in `types/database.ts`. This file is generated from the Supabase schema. Always import from here when writing queries — do not define ad-hoc interfaces for database rows.

Example:
```ts
import type { Database } from "@/types/database.ts";
type Project = Database["public"]["Tables"]["doa_new_projects"]["Row"];
```

---

## Supabase Clients

| File | Use when |
|---|---|
| `lib/supabase/server.ts` | Inside Server Components, Route Handlers, or Server Actions |
| `lib/supabase/client.ts` | Inside Client Components (`"use client"`) |

Never import the server client from a client component. The server client uses cookies for SSR session management.

**Project ID**: `gterzsoapepzozgqbljk`
**All tables are prefixed `doa_new_`** — never query a table without this prefix.

---

## Current Mock Data Pattern

Every page that does not yet use Supabase defines its data as a constant array at the top of the file, named with the `MOCK_` prefix:

```ts
// Defined inline at the top of the page file
const MOCK_PROJECTS = [
  { id: "1", name: "...", status: "En progreso", ... },
  ...
];
```

To replace mock data with real data:
1. Remove the `MOCK_` constant.
2. In a Server Component, fetch from Supabase using `lib/supabase/server.ts`.
3. Type the result using `types/database.ts`.
4. Pass data to Client Components via props.
5. Fix the language mismatch: mock arrays use Spanish strings (e.g. `"En progreso"`) but database enums use English (e.g. `"in_progress"`). Map or filter accordingly.

---

## Route Structure

```
app/
  page.tsx                  — root redirect
  auth/
    login/page.tsx          — login form
    callback/route.ts       — Supabase auth callback
  dashboard/page.tsx        — KPI overview
  projects/
    page.tsx                — project list
    [id]/page.tsx           — project detail (currently ignores [id])
  clients/page.tsx          — client list
  aircraft/page.tsx         — aircraft register
  documents/page.tsx        — document library
  tasks/page.tsx            — task board
  tools/page.tsx            — engineering utilities (no auth guard)
  databases/page.tsx        — reference databases (no auth guard)
  profile/page.tsx          — user profile
```

---

## Deployment Command

```bash
./deploy.sh
```

Deploys to `145.223.116.37:3010` via Docker. Do not use any other method to deploy.

---

## What NOT to Do

- **Do not break migrations**: never edit `supabase/migrations/001_initial_schema.sql`. Add new schema changes as a new numbered migration file.
- **Do not commit secrets**: `.env.local` and any file containing `SUPABASE_URL`, `SUPABASE_ANON_KEY`, or `SUPABASE_SERVICE_ROLE_KEY` must never be committed. They are gitignored.
- **Do not use non-`doa_new_`-prefixed table names**: all eight tables in this project use the `doa_new_` prefix. A query against `projects` instead of `doa_new_projects` will fail silently or return wrong data.
- **Do not import the server Supabase client from a client component**: this will break SSR auth and may leak server-side secrets.
- **Do not add mock data to pages that are being connected to Supabase**: remove `MOCK_` arrays entirely when real data is wired in. Do not leave dead mock arrays alongside live queries.
