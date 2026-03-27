# CLAUDE.md — DOA Operations Hub

## Project Overview

DOA Operations Hub is a Next.js 16 / React 19 web application for EASA Part 21J aerospace engineering teams. It manages projects, tasks, documents, clients, and aircraft under a Design Organisation Approval workflow. The backend is Supabase (PostgreSQL with pgvector, Auth, and Storage). Most pages currently display mock data; the primary near-term work is replacing `MOCK_` arrays with live Supabase queries using the types in `types/database.ts`.

---

## Key Conventions

- **TypeScript**: strict mode is enabled. Do not use `any` — use proper types from `types/database.ts` or derive them with `Pick`, `Omit`, or `Partial`.
- **Tailwind CSS v4**: utility-first styling. Do not add custom CSS files unless absolutely necessary. Use the design tokens already configured in the Tailwind config.
- **shadcn/ui**: use existing components from `components/ui/`. Add new shadcn components with `npx shadcn@latest add <component>`. Do not hand-roll UI primitives that shadcn already provides.
- **Zustand**: client-side global state lives in `store/`. Create separate slices per domain. Do not use React Context for shared state.
- **Supabase SSR auth**: always use `lib/supabase/server.ts` in Server Components and Route Handlers. Use `lib/supabase/client.ts` in Client Components (`"use client"`). Never import the server client from a client component.

---

## Important Paths

| Path | Purpose |
|---|---|
| `app/` | Next.js App Router pages and layouts |
| `components/ui/` | shadcn/ui primitives |
| `lib/supabase/server.ts` | Supabase client for Server Components |
| `lib/supabase/client.ts` | Supabase client for Client Components |
| `store/` | Zustand stores |
| `types/database.ts` | Auto-generated Supabase TypeScript types — source of truth for all DB types |
| `supabase/migrations/` | SQL migration files |

---

## Supabase

- **Project ID**: `gterzsoapepzozgqbljk`
- **Project name**: `Certification_Data_base`
- **All tables are prefixed `doa_new_`**: `doa_new_projects`, `doa_new_tasks`, `doa_new_documents`, `doa_new_clients`, `doa_new_aircraft`, `doa_new_profiles`, `doa_new_project_members`, `doa_new_vector_documents`.
- **Always import row types from `types/database.ts`** when writing Supabase queries. Do not define inline ad-hoc interfaces for database rows.
- Storage bucket: `doa-project-docs` (must be created manually in the dashboard).

---

## Current State: Mock Data

Most pages use hardcoded mock data. The pattern is:

- Mock arrays are defined **inline at the top of each page file**, named with the `MOCK_` prefix (e.g. `MOCK_PROJECTS`, `MOCK_TASKS`, `MOCK_CLIENTS`).
- When replacing mock data with real Supabase queries, remove the `MOCK_` array and replace it with a server-side fetch using the Supabase server client, typed against `types/database.ts`.
- Be aware of the language mismatch bug: mock arrays use Spanish strings for enum-like fields; the database enums use English values (see Known Bugs below).

---

## Auth

- Login/logout is functional via Supabase Auth (email + password).
- The auth callback route is at `app/auth/callback/`.
- Middleware protects most routes. Exception: `/tools` and `/databases` are currently NOT protected — this is a known bug.
- In Server Components, check session with:
  ```ts
  import { createClient } from "@/lib/supabase/server";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  ```

---

## Deployment

```bash
./deploy.sh
```

This script commits pending changes and deploys to the VPS at `145.223.116.37:3010` via Docker. Do not push directly to the server in any other way.

---

## DO NOT

- **Do not modify the existing migration file** (`001_initial_schema.sql`). If schema changes are needed, create a new numbered migration file (e.g. `002_add_column.sql`) and apply it via the Supabase SQL editor or CLI.
- **Do not commit `.env` or `.env.local` files**. They are gitignored; keep them that way.
- **Do not use table names without the `doa_new_` prefix** in any Supabase query.
- **Do not import `lib/supabase/server.ts` from a Client Component**.

---

## Empty Placeholder Directories

These directories exist as placeholders for Phase 2 features. Do not delete them, but do not add placeholder files either — they are intentionally empty:

- `components/ai/` — AI chat / RAG UI components
- `components/forms/` — reusable form components (React Hook Form + Zod)
- `components/project/` — project-specific UI components
- `lib/openrouter/` — OpenRouter API client and embedding utilities
- `services/` — server-side service functions (business logic layer)
- `hooks/` — custom React hooks

---

## Known Bugs to Fix

1. **`/tools` and `/databases` not protected by auth middleware**: Add these routes to the middleware matcher so unauthenticated users are redirected to `/auth/login`.

2. **`/projects/[id]` ignores the route parameter**: The page always renders the same mock project. Fix by reading `params.id` and fetching the correct row from `doa_new_projects`.

3. **Mock data uses Spanish strings vs English database enums**: `MOCK_` arrays use values like `"En progreso"` and `"Alta"` where the DB enums expect `"in_progress"` and `"high"`. When connecting pages to Supabase, ensure all status/priority values match the English enum values defined in `types/database.ts`.
