-- CertForge — add a per-template certificate title.
-- A single dedicated title stored on the template. It supplies the value for
-- the "certificate_title" placeholder at generation time (and in preview), so
-- the printed title matches exactly what the user types once per template.
-- Idempotent + safe to re-run.

alter table templates add column if not exists certificate_title text;
