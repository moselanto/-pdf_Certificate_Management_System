-- ============================================================================
-- Migration 002 — QR appearance columns on placeholders
--
-- Adds optional per-placeholder QR color settings so a QR field can be styled
-- (e.g. white modules on a transparent background) for dark certificates.
-- Idempotent; also folded into db/schema.sql for fresh installs.
-- ============================================================================

alter table placeholders
  add column if not exists qr_dark text,         -- hex module color, e.g. #FFFFFF
  add column if not exists qr_light text,         -- hex background color
  add column if not exists qr_transparent boolean not null default false;
