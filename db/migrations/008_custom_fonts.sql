-- 008_custom_fonts.sql
-- Custom font embedding (#3, Phase 5).
--
-- An org can upload TrueType/OpenType fonts (.ttf/.otf) and reference them from
-- a placeholder's font_family. The render engine embeds the stored font via
-- @pdf-lib/fontkit, falling back to the standard fonts when no custom font with
-- that family name exists.
--
-- fonts.family is the human-facing name the designer picks (e.g. "Great Vibes")
-- and must be unique per org so a placeholder's font_family can resolve it.
-- Run this in the Supabase SQL Editor.

create table if not exists public.fonts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.organizations(id) on delete cascade,
  family      text not null,            -- display name, referenced by font_family
  file_path   text not null,            -- storage path of the .ttf/.otf in the templates bucket
  created_at  timestamptz not null default now(),
  unique (org_id, family)
);
create index if not exists fonts_org_idx on public.fonts(org_id);

alter table public.fonts enable row level security;

-- Org-scoped RLS, consistent with the other org tables.
do $$ begin
  create policy fonts_read  on public.fonts for select using (org_id = current_org_id());
exception when duplicate_object then null; end $$;
do $$ begin
  create policy fonts_write on public.fonts for all
    using (org_id = current_org_id()) with check (org_id = current_org_id());
exception when duplicate_object then null; end $$;
