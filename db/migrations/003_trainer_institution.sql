-- 003_trainer_institution.sql
-- Adds an "institution" field to trainers. The public verification page shows
-- this as the certificate's "Issued by" (the institution of the trainer who
-- signed it). Run this in the Supabase SQL Editor.

alter table public.trainers
  add column if not exists institution text;

-- Optional: backfill existing trainers with a default issuing institution.
-- update public.trainers set institution = 'Pimofy Training Institute'
--   where institution is null;
