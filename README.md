# DOA Operations Hub

**Design Organization Approval (DOA) Operations Hub** is an internal web application for aerospace engineering teams operating under EASA Part 21J. It centralises project tracking, document management, task coordination, client/aircraft data, and engineering tooling for Design Organisation Approval workflows.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16, App Router, TypeScript (strict) |
| UI | React 19, Tailwind CSS v4, shadcn/ui |
| State | Zustand |
| Backend / Auth | Supabase (PostgreSQL + Storage + Auth) |
| AI / Embeddings | OpenRouter (planned — Phase 2) |
| Containerisation | Docker + Docker Compose |
| Deployment | VPS at 145.223.116.37:3010 |

---

## Prerequisites

- Node.js 20 or later
- Docker and Docker Compose
- A Supabase account with a project configured

---

## Environment Variables

Create a `.env.local` file at the project root (never commit this file):

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-id>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

The production project ID is `gterzsoapepzozgqbljk` (Supabase project: `Certification_Data_base`).

---

## Local Development Setup

```bash
# 1. Install dependencies
npm install

# 2. Create environment file and fill in the values shown above
cp .env.example .env.local

# 3. Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

---

## Supabase Setup

1. Create (or use) your Supabase project. The production project ID is `gterzsoapepzozgqbljk`.
2. Apply the initial database migration:
   - Open the Supabase SQL editor for your project.
   - Run the full contents of `supabase/migrations/001_initial_schema.sql`.
3. Create the storage bucket for project documents **manually** in the Supabase dashboard:
   - Bucket name: `doa-project-docs`
   - Set visibility to private; RLS policies will control access.

---

## Route Map

| Route | Purpose |
|---|---|
| `/` | Landing / redirect to dashboard |
| `/auth/login` | Login page (Supabase email + password) |
| `/auth/callback` | OAuth / magic-link callback handler |
| `/dashboard` | Overview: KPI cards, recent activity, quick links |
| `/projects` | Project list with status filters |
| `/projects/[id]` | Project detail: tasks, documents, members, timeline |
| `/clients` | Client list with contact info |
| `/aircraft` | Aircraft register (type, registration, MTOW, etc.) |
| `/documents` | Document library with upload and version tracking |
| `/tasks` | Task board / list across all projects |
| `/tools` | Engineering utilities (calculations, references) |
| `/databases` | Internal reference databases |
| `/profile` | User profile and settings |

---

## Feature Status

| Feature | Status | Notes |
|---|---|---|
| Authentication (login / logout) | Live | Supabase Auth |
| Dashboard KPI cards | Mock | Hardcoded values |
| Project list | Mock | `MOCK_PROJECTS` array defined inline in page file |
| Project detail | Mock | Always renders same mock project regardless of `[id]` |
| Client list | Mock | `MOCK_CLIENTS` array defined inline in page file |
| Aircraft register | Mock | `MOCK_AIRCRAFT` array defined inline in page file |
| Document library | Mock | `MOCK_DOCUMENTS` array defined inline in page file |
| Task board | Mock | `MOCK_TASKS` array defined inline in page file |
| Tools page | Live (UI only) | No backend integration; not protected by auth |
| Databases page | Live (UI only) | No backend integration; not protected by auth |
| AI / RAG search | Phase 2 | Placeholder at `lib/openrouter/` |
| Outlook / calendar | Phase 2 | Microsoft Graph deferred |
| DnD kanban | Phase 2 | `dnd-kit` installed but not wired up |
| Non-conformity form | Phase 2 | Not started |

---

## Deployment

The application is deployed via Docker to a VPS.

**Server:** `145.223.116.37:3010`

```bash
# Deploy from local machine
./deploy.sh
```

`deploy.sh` commits any pending changes and triggers a Docker build and restart on the VPS. Review the script before running in a clean state.

Docker files:
- `Dockerfile` — multi-stage Next.js build
- `docker-compose.yml` — service definition with port mapping and environment injection

---

## Database Schema Summary

All tables use the prefix `doa_new_`. The schema is defined in `supabase/migrations/001_initial_schema.sql`.

### Tables

| Table | Description |
|---|---|
| `doa_new_profiles` | Extended user profiles linked to Supabase Auth |
| `doa_new_clients` | Client organisations |
| `doa_new_aircraft` | Aircraft entries (type, registration, MTOW) |
| `doa_new_projects` | Engineering change projects |
| `doa_new_project_members` | Many-to-many: projects x profiles with roles |
| `doa_new_documents` | Documents with storage references and versioning |
| `doa_new_tasks` | Tasks linked to projects and assignees |
| `doa_new_vector_documents` | Chunked text embeddings for RAG (pgvector) |

### Enums

Six custom PostgreSQL enums are defined with the `doa_` prefix (e.g. `doa_project_status`, `doa_task_priority`). All enum values are in English. The corresponding TypeScript types are generated in `types/database.ts`.

### Extensions

- `pgvector` is enabled. The `doa_new_vector_documents` table stores `vector(1536)` embeddings with an HNSW index. As of the last schema update, 0 documents are indexed.
- A helper function `doa_new_match_documents()` is available for similarity search queries.

### Row-Level Security

RLS is enabled on all tables. Policies are defined in the migration. The helper function `doa_new_current_user_role()` is used across policies to resolve the authenticated user's role.

---

## Known Issues / Bugs

1. **Missing auth middleware on `/tools` and `/databases`**: These routes are not protected by the authentication middleware. Unauthenticated users can access them directly by navigating to the URL.

2. **Project detail route ignores the `[id]` parameter**: The `/projects/[id]` page does not fetch project data by ID. It always renders the same hardcoded mock project regardless of which ID appears in the URL.

3. **Mock data uses Spanish strings; database enums use English**: Several `MOCK_` arrays in page files use Spanish labels for status and priority fields (e.g. `"En progreso"`, `"Alta"`). The actual database enums use English values (e.g. `"in_progress"`, `"high"`). This mismatch will cause mapping errors when pages are connected to real Supabase data.

---

## Phase 2 Roadmap

- **AI / RAG**: Connect OpenRouter (text-embedding-3-small + claude-3.5-sonnet) to index project documents and power semantic search. Placeholder directories at `lib/openrouter/` and `components/ai/`.
- **Outlook / Microsoft Graph**: Calendar integration for project deadlines and meeting scheduling.
- **DnD Kanban**: Drag-and-drop task board using `dnd-kit` (already installed as a dependency).
- **Non-conformity form**: Structured form for logging and tracking non-conformities under EASA Part 21J.
