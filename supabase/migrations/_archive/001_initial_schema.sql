-- ============================================================
-- DOA Operations Hub — Initial Schema
-- Project: Design Organization Approval (Production)
-- Table prefix: doa_new_
-- Supabase project: Certification_Data_base
-- Date: 2026-03-22
-- ============================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
  CREATE TYPE doa_user_role AS ENUM ('engineer', 'team_lead', 'head_of_design', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE doa_project_status AS ENUM ('active', 'review', 'approved', 'paused', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE doa_classification AS ENUM ('minor', 'major', 'repair');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE doa_doc_status AS ENUM ('vigente', 'obsoleto', 'pendiente', 'na');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE doa_task_status AS ENUM ('todo', 'in_progress', 'blocked', 'done');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE doa_task_priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- TABLES
-- ============================================================

-- 1. Profiles (extends auth.users)
CREATE TABLE IF NOT EXISTS doa_new_profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   text,
  role        doa_user_role NOT NULL DEFAULT 'engineer',
  avatar_url  text,
  department  text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2. Aircraft
CREATE TABLE IF NOT EXISTS doa_new_aircraft (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  model        text NOT NULL,
  variant      text,
  manufacturer text NOT NULL,
  tcds_ref     text,
  mtow_kg      numeric,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- 3. Clients
CREATE TABLE IF NOT EXISTS doa_new_clients (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  legal_name  text NOT NULL,
  country     text,
  vat_number  text,
  contacts    jsonb NOT NULL DEFAULT '[]',
  fleet       jsonb NOT NULL DEFAULT '[]',
  notes       text,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 4. Projects
CREATE TABLE IF NOT EXISTS doa_new_projects (
  id                  uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  code                text UNIQUE NOT NULL,
  name                text NOT NULL,
  description         text,
  client_id           uuid REFERENCES doa_new_clients(id) ON DELETE SET NULL,
  aircraft_id         uuid REFERENCES doa_new_aircraft(id) ON DELETE SET NULL,
  status              doa_project_status NOT NULL DEFAULT 'active',
  classification      doa_classification,
  cert_basis          text[] NOT NULL DEFAULT '{}',
  lead_engineer_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tl_id               uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  estimated_delivery  date,
  docs_complete_pct   integer NOT NULL DEFAULT 0 CHECK (docs_complete_pct BETWEEN 0 AND 100),
  priority            text NOT NULL DEFAULT 'normal',
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- 5. Project Members
CREATE TABLE IF NOT EXISTS doa_new_project_members (
  project_id  uuid NOT NULL REFERENCES doa_new_projects(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'engineer',
  PRIMARY KEY (project_id, user_id)
);

-- 6. Documents
CREATE TABLE IF NOT EXISTS doa_new_documents (
  id           uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id   uuid NOT NULL REFERENCES doa_new_projects(id) ON DELETE CASCADE,
  folder_path  text NOT NULL DEFAULT '01. Input Data',
  name         text NOT NULL,
  edition      text NOT NULL DEFAULT 'Ed01',
  status       doa_doc_status NOT NULL DEFAULT 'pendiente',
  file_url     text,
  storage_path text,
  author_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 7. Tasks
CREATE TABLE IF NOT EXISTS doa_new_tasks (
  id               uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id       uuid NOT NULL REFERENCES doa_new_projects(id) ON DELETE CASCADE,
  title            text NOT NULL,
  description      text,
  assignee_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  priority         doa_task_priority NOT NULL DEFAULT 'medium',
  due_date         date,
  status           doa_task_status NOT NULL DEFAULT 'todo',
  estimated_hours  numeric,
  actual_hours     numeric,
  completed_at     timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- 8. Vector Documents (RAG)
CREATE TABLE IF NOT EXISTS doa_new_vector_documents (
  id          uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  corpus      text NOT NULL,
  title       text NOT NULL,
  content     text NOT NULL,
  embedding   vector(1536),
  source_url  text,
  metadata    jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================

-- Vector similarity search (HNSW — best for Supabase)
CREATE INDEX IF NOT EXISTS doa_new_vector_documents_embedding_idx
  ON doa_new_vector_documents
  USING hnsw (embedding vector_cosine_ops);

-- Projects
CREATE INDEX IF NOT EXISTS doa_new_projects_status_idx ON doa_new_projects(status);
CREATE INDEX IF NOT EXISTS doa_new_projects_client_idx ON doa_new_projects(client_id);
CREATE INDEX IF NOT EXISTS doa_new_projects_lead_idx ON doa_new_projects(lead_engineer_id);
CREATE INDEX IF NOT EXISTS doa_new_projects_tl_idx ON doa_new_projects(tl_id);

-- Tasks
CREATE INDEX IF NOT EXISTS doa_new_tasks_project_idx ON doa_new_tasks(project_id);
CREATE INDEX IF NOT EXISTS doa_new_tasks_assignee_idx ON doa_new_tasks(assignee_id);
CREATE INDEX IF NOT EXISTS doa_new_tasks_status_idx ON doa_new_tasks(status);

-- Documents
CREATE INDEX IF NOT EXISTS doa_new_documents_project_idx ON doa_new_documents(project_id);
CREATE INDEX IF NOT EXISTS doa_new_documents_folder_idx ON doa_new_documents(project_id, folder_path);

-- ============================================================
-- TRIGGERS — updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION doa_new_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER doa_new_clients_updated_at
  BEFORE UPDATE ON doa_new_clients
  FOR EACH ROW EXECUTE FUNCTION doa_new_set_updated_at();

CREATE OR REPLACE TRIGGER doa_new_projects_updated_at
  BEFORE UPDATE ON doa_new_projects
  FOR EACH ROW EXECUTE FUNCTION doa_new_set_updated_at();

CREATE OR REPLACE TRIGGER doa_new_documents_updated_at
  BEFORE UPDATE ON doa_new_documents
  FOR EACH ROW EXECUTE FUNCTION doa_new_set_updated_at();

CREATE OR REPLACE TRIGGER doa_new_tasks_updated_at
  BEFORE UPDATE ON doa_new_tasks
  FOR EACH ROW EXECUTE FUNCTION doa_new_set_updated_at();

CREATE OR REPLACE TRIGGER doa_new_profiles_updated_at
  BEFORE UPDATE ON doa_new_profiles
  FOR EACH ROW EXECUTE FUNCTION doa_new_set_updated_at();

-- ============================================================
-- TRIGGER — Auto-create profile on new user
-- ============================================================

CREATE OR REPLACE FUNCTION doa_new_handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO doa_new_profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'engineer'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS doa_new_on_auth_user_created ON auth.users;
CREATE TRIGGER doa_new_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION doa_new_handle_new_user();

-- ============================================================
-- ROLE HELPER FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION doa_new_current_user_role()
RETURNS doa_user_role AS $$
  SELECT role FROM doa_new_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE doa_new_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE doa_new_aircraft ENABLE ROW LEVEL SECURITY;
ALTER TABLE doa_new_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE doa_new_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE doa_new_project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE doa_new_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE doa_new_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE doa_new_vector_documents ENABLE ROW LEVEL SECURITY;

-- doa_new_profiles
CREATE POLICY "profiles_select_own" ON doa_new_profiles
  FOR SELECT USING (id = auth.uid() OR doa_new_current_user_role() IN ('head_of_design', 'admin'));

CREATE POLICY "profiles_update_own" ON doa_new_profiles
  FOR UPDATE USING (id = auth.uid());

-- doa_new_aircraft
CREATE POLICY "aircraft_select_authenticated" ON doa_new_aircraft
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "aircraft_insert_admin" ON doa_new_aircraft
  FOR INSERT WITH CHECK (doa_new_current_user_role() = 'admin');

CREATE POLICY "aircraft_update_admin" ON doa_new_aircraft
  FOR UPDATE USING (doa_new_current_user_role() = 'admin');

-- doa_new_clients
CREATE POLICY "clients_select_authenticated" ON doa_new_clients
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "clients_insert_manager" ON doa_new_clients
  FOR INSERT WITH CHECK (doa_new_current_user_role() IN ('team_lead', 'head_of_design', 'admin'));

CREATE POLICY "clients_update_manager" ON doa_new_clients
  FOR UPDATE USING (doa_new_current_user_role() IN ('team_lead', 'head_of_design', 'admin'));

-- doa_new_projects
CREATE POLICY "projects_select_authenticated" ON doa_new_projects
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "projects_insert_manager" ON doa_new_projects
  FOR INSERT WITH CHECK (doa_new_current_user_role() IN ('team_lead', 'head_of_design', 'admin'));

CREATE POLICY "projects_update_manager" ON doa_new_projects
  FOR UPDATE USING (doa_new_current_user_role() IN ('team_lead', 'head_of_design', 'admin'));

-- doa_new_project_members
CREATE POLICY "members_select_authenticated" ON doa_new_project_members
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "members_insert_manager" ON doa_new_project_members
  FOR INSERT WITH CHECK (doa_new_current_user_role() IN ('team_lead', 'head_of_design', 'admin'));

CREATE POLICY "members_delete_manager" ON doa_new_project_members
  FOR DELETE USING (doa_new_current_user_role() IN ('team_lead', 'head_of_design', 'admin'));

-- doa_new_documents
CREATE POLICY "documents_select_authenticated" ON doa_new_documents
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "documents_insert_authenticated" ON doa_new_documents
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "documents_update_authenticated" ON doa_new_documents
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- doa_new_tasks
CREATE POLICY "tasks_select_authenticated" ON doa_new_tasks
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "tasks_insert_authenticated" ON doa_new_tasks
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "tasks_update_authenticated" ON doa_new_tasks
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- doa_new_vector_documents
CREATE POLICY "vector_docs_select_authenticated" ON doa_new_vector_documents
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "vector_docs_insert_admin" ON doa_new_vector_documents
  FOR INSERT WITH CHECK (doa_new_current_user_role() IN ('head_of_design', 'admin'));

-- ============================================================
-- PGVECTOR SEARCH FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION doa_new_match_documents(
  query_embedding   vector(1536),
  corpus_filter     text[],
  match_count       int DEFAULT 8,
  similarity_threshold float DEFAULT 0.75
)
RETURNS TABLE (
  id          uuid,
  corpus      text,
  title       text,
  content     text,
  source_url  text,
  similarity  float
)
LANGUAGE sql STABLE AS $$
  SELECT
    id, corpus, title, content, source_url,
    1 - (embedding <=> query_embedding) AS similarity
  FROM doa_new_vector_documents
  WHERE corpus = ANY(corpus_filter)
    AND 1 - (embedding <=> query_embedding) > similarity_threshold
  ORDER BY embedding <=> query_embedding
  LIMIT match_count;
$$;

-- ============================================================
-- STORAGE BUCKET (run separately if needed)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('doa-project-docs', 'doa-project-docs', false)
-- ON CONFLICT DO NOTHING;
