-- 006_template_logo.sql
-- Adds a "logo_path" to templates. A template can carry ONE logo image
-- (e.g. the issuing institution's logo). When the designer places a "logo"
-- placeholder, the render engine draws this stored logo into that box on every
-- certificate generated from the template. Run this in the Supabase SQL Editor.

alter table public.templates
  add column if not exists logo_path text;
