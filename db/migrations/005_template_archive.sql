-- 005_template_archive.sql
-- Adds soft-archive support to templates. Archiving hides a template from the
-- active list and the Generate dropdown without deleting it or its certificates
-- (history preserved). Reversible via unarchive. Run in Supabase SQL Editor.

alter table public.templates
  add column if not exists archived_at timestamptz;
