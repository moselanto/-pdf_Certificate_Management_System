-- 007_org_logo_and_aspect.sql
-- Logo follow-ups (#2):
--   1. organizations.logo_path — an org-level default logo. A template with a
--      placed "logo" field but NO template-specific logo_path falls back to the
--      org's logo, so a single upload can brand every template at once.
--      (The schema already had an unused organizations.logo_url column; we add a
--      storage-PATH column to mirror templates.logo_path and keep signing logic
--      identical. logo_url is left in place untouched for backwards compat.)
--   2. placeholders.lock_aspect — when true, image/logo/signature placeholders
--      preserve the image's intrinsic aspect ratio inside the box (contain),
--      instead of stretching to fill width x height. Defaults false so existing
--      placeholders render exactly as before.
-- Run this in the Supabase SQL Editor.

alter table public.organizations
  add column if not exists logo_path text;

alter table public.placeholders
  add column if not exists lock_aspect boolean not null default false;
