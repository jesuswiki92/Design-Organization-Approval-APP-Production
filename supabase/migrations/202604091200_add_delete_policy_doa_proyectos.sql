-- ============================================================================
-- Migration: Add authenticated write policies to doa_proyectos
-- Date: 2026-04-09
-- Description: The original migration (202604051200) only created:
--   - "Allow public read" (SELECT for everyone)
--   - "Allow service role full access" (ALL for service_role)
--
-- This meant authenticated users could read projects but NOT insert,
-- update, or delete them — all write operations were silently blocked
-- by RLS, causing the project delete feature to return 404.
--
-- This migration adds INSERT, UPDATE, and DELETE policies for
-- authenticated users so the app can eventually use the normal
-- user client for writes as well.
--
-- NOTE: The API route currently uses the service-role admin client
-- as an immediate workaround. Once this migration is applied,
-- the route could switch back to the user client if desired.
-- ============================================================================

-- Allow authenticated users to insert projects
CREATE POLICY "Allow authenticated insert"
  ON doa_proyectos
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update projects
CREATE POLICY "Allow authenticated update"
  ON doa_proyectos
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow authenticated users to delete projects
CREATE POLICY "Allow authenticated delete"
  ON doa_proyectos
  FOR DELETE
  TO authenticated
  USING (true);
