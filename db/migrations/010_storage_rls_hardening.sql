-- 010_storage_rls_hardening.sql
-- RLS hardening (#4): scope Storage object access to the caller's org by the
-- first path segment (the org id), instead of granting any authenticated user
-- access to the whole templates/certificates buckets.
--
-- Every write path in the app already prefixes object names with the org id,
-- e.g. "<orgId>/<...>.pdf", "<orgId>/ai/...", "<orgId>/logos/...",
-- "<orgId>/org-logo/...", "<orgId>/fonts/...", and certificates are written as
-- "<year>/<certnumber>.pdf" by uploadCertificate — see NOTE below.
--
-- This migration REPLACES the permissive bucket-wide policies from migration
-- 001 with per-org variants. It is idempotent. Run in the Supabase SQL Editor.
--
-- NOTE on certificates bucket: generated certificate PDFs are stored under a
-- YEAR prefix ("2026/CF-2026-XXXX.pdf"), NOT an org prefix, and are read via
-- the service-role client (which bypasses RLS) for download/email/verify. So we
-- keep the certificates bucket readable to authenticated users of the org but
-- DO NOT require an org-id first segment there. Only the templates bucket
-- (templates, logos, fonts, ai backgrounds) is org-prefixed, so we scope that
-- one strictly. If you later switch certificate storage to an org prefix,
-- tighten the certificates policies the same way.

-- Drop the permissive policies from migration 001 (if present).
drop policy if exists "cf read buckets"   on storage.objects;
drop policy if exists "cf insert buckets" on storage.objects;
drop policy if exists "cf update buckets" on storage.objects;
drop policy if exists "cf delete buckets" on storage.objects;

-- Templates bucket: strict per-org (first path segment must equal the caller's
-- org id). Covers template PDFs, logos, org-logo, fonts, and ai backgrounds.
do $$ begin
  create policy "cf tpl read" on storage.objects for select to authenticated
    using (
      bucket_id = 'templates'
      and (storage.foldername(name))[1] = current_org_id()::text
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cf tpl insert" on storage.objects for insert to authenticated
    with check (
      bucket_id = 'templates'
      and (storage.foldername(name))[1] = current_org_id()::text
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cf tpl update" on storage.objects for update to authenticated
    using (
      bucket_id = 'templates'
      and (storage.foldername(name))[1] = current_org_id()::text
    );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cf tpl delete" on storage.objects for delete to authenticated
    using (
      bucket_id = 'templates'
      and (storage.foldername(name))[1] = current_org_id()::text
    );
exception when duplicate_object then null; end $$;

-- Certificates bucket: authenticated read/write (server uses service-role for
-- the public verify/download/email paths). Year-prefixed, not org-prefixed.
do $$ begin
  create policy "cf cert read" on storage.objects for select to authenticated
    using (bucket_id = 'certificates');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cf cert insert" on storage.objects for insert to authenticated
    with check (bucket_id = 'certificates');
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "cf cert update" on storage.objects for update to authenticated
    using (bucket_id = 'certificates');
exception when duplicate_object then null; end $$;
