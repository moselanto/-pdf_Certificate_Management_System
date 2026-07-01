-- ============================================================================
-- Migration 001 — auth/RLS + Storage policy fixes
--
-- These corrections were discovered during the first live end-to-end test.
-- They are idempotent (safe to run more than once) and are also folded into
-- db/schema.sql for fresh installs. Run this in the Supabase SQL editor on any
-- project created from the ORIGINAL schema.sql (before these fixes existed).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. current_org_id() must bypass RLS, or it recurses on the profiles table.
--    Without SECURITY DEFINER, every org-scoped policy fails to resolve the
--    user's org and the app reads zero rows ("user has NO profiles row").
-- ----------------------------------------------------------------------------
create or replace function current_org_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select org_id from profiles where id = auth.uid()
$$;

-- ----------------------------------------------------------------------------
-- 2. Let a logged-in user always read their OWN profile row, independent of
--    org resolution. (Multiple SELECT policies are OR'd together.)
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_policies
    where tablename = 'profiles' and policyname = 'profiles_read_self'
  ) then
    create policy profiles_read_self
      on profiles for select
      using (id = auth.uid());
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Storage policies: by default storage.objects denies all access. Allow
--    authenticated users to read/write the app's two buckets.
--
--    NOTE: this grants any authenticated user access to both buckets, which is
--    fine for single-org / pilot use. For strict multi-org isolation, scope by
--    the first path segment (the org id) instead — see the commented variant.
-- ----------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'cf read buckets') then
    create policy "cf read buckets" on storage.objects for select
      to authenticated using (bucket_id in ('templates', 'certificates'));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'cf insert buckets') then
    create policy "cf insert buckets" on storage.objects for insert
      to authenticated with check (bucket_id in ('templates', 'certificates'));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'cf update buckets') then
    create policy "cf update buckets" on storage.objects for update
      to authenticated using (bucket_id in ('templates', 'certificates'));
  end if;
  if not exists (select 1 from pg_policies where tablename = 'objects' and policyname = 'cf delete buckets') then
    create policy "cf delete buckets" on storage.objects for delete
      to authenticated using (bucket_id in ('templates', 'certificates'));
  end if;
end $$;

-- Stricter per-org variant (optional, replaces the inserts above):
--   with check (
--     bucket_id in ('templates','certificates')
--     and (storage.foldername(name))[1] = current_org_id()::text
--   )
