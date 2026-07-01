-- ============================================================================
-- CertForge — PostgreSQL / Supabase schema
-- Run this in the Supabase SQL editor, then run db/seed.sql for demo data.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Organizations (multi-tenant root). Every row in the system is org-scoped.
-- ---------------------------------------------------------------------------
create table if not exists organizations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  logo_url      text,
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Users & roles. profiles extends Supabase auth.users with org + role.
-- ---------------------------------------------------------------------------
create type user_role as enum ('owner', 'admin', 'editor', 'viewer');

create table if not exists profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  org_id        uuid not null references organizations(id) on delete cascade,
  full_name     text,
  role          user_role not null default 'viewer',
  created_at    timestamptz not null default now()
);
create index if not exists profiles_org_idx on profiles(org_id);

-- ---------------------------------------------------------------------------
-- Certificate templates. Each has a reusable front/back PDF stored in Storage.
-- ---------------------------------------------------------------------------
create table if not exists templates (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  name            text not null,
  front_pdf_path  text not null,          -- storage path of uploaded front PDF
  back_pdf_path   text,                   -- optional back PDF
  page_width      real,                   -- pts, captured on upload for the editor
  page_height     real,
  created_at      timestamptz not null default now()
);
create index if not exists templates_org_idx on templates(org_id);

-- ---------------------------------------------------------------------------
-- Placeholders: editable fields positioned on a template page.
-- Coordinates are stored in PDF points with origin at TOP-LEFT for the editor;
-- the engine converts to pdf-lib's bottom-left origin at render time.
-- ---------------------------------------------------------------------------
create type placeholder_kind as enum ('text', 'date', 'qr', 'image', 'signature');
create type placeholder_page as enum ('front', 'back');

create table if not exists placeholders (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references templates(id) on delete cascade,
  page          placeholder_page not null default 'front',
  kind          placeholder_kind not null default 'text',
  -- field_key maps to a value supplied at generation time, e.g. "recipient_name"
  field_key     text not null,
  label         text not null,
  x             real not null,            -- top-left origin, points
  y             real not null,
  width         real,                     -- for qr/image/wrapped text
  height        real,
  font_size     real not null default 14,
  font_family   text not null default 'Helvetica',
  color         text not null default '#111111',
  align         text not null default 'left',   -- left | center | right
  created_at    timestamptz not null default now()
);
create index if not exists placeholders_template_idx on placeholders(template_id);

-- ---------------------------------------------------------------------------
-- Courses & units. Selecting a course auto-populates the back page units.
-- ---------------------------------------------------------------------------
create table if not exists courses (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  title         text not null,
  description   text,
  created_at    timestamptz not null default now()
);
create index if not exists courses_org_idx on courses(org_id);

create table if not exists course_units (
  id            uuid primary key default gen_random_uuid(),
  course_id     uuid not null references courses(id) on delete cascade,
  sort_order    int not null default 0,
  title         text not null,            -- unit / competency
  created_at    timestamptz not null default now()
);
create index if not exists course_units_course_idx on course_units(course_id);

-- ---------------------------------------------------------------------------
-- Trainers & trainees.
-- ---------------------------------------------------------------------------
create table if not exists trainers (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid not null references organizations(id) on delete cascade,
  name            text not null,
  title           text,
  signature_path  text,                   -- storage path of signature PNG
  created_at      timestamptz not null default now()
);
create index if not exists trainers_org_idx on trainers(org_id);

create table if not exists trainees (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  name          text not null,
  email         text,
  created_at    timestamptz not null default now()
);
create index if not exists trainees_org_idx on trainees(org_id);

-- ---------------------------------------------------------------------------
-- Certificates. The source of truth for verification & history.
-- certificate_number is globally unique and encoded into the QR code.
-- ---------------------------------------------------------------------------
create type certificate_status as enum ('generated', 'emailed', 'revoked');

create table if not exists certificates (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references organizations(id) on delete cascade,
  certificate_number  text not null unique,
  template_id         uuid not null references templates(id),
  course_id           uuid references courses(id),
  trainer_id          uuid references trainers(id),
  trainee_id          uuid references trainees(id),
  recipient_name      text not null,
  issue_date          date not null default current_date,
  -- snapshot of every field value used to render, for faithful reprints
  field_values        jsonb not null default '{}'::jsonb,
  pdf_path            text,               -- storage path of generated PDF
  status              certificate_status not null default 'generated',
  verification_token  text not null default encode(gen_random_bytes(16), 'hex'),
  created_by          uuid references profiles(id),
  created_at          timestamptz not null default now()
);
create index if not exists certificates_org_idx on certificates(org_id);
create index if not exists certificates_number_idx on certificates(certificate_number);

-- ---------------------------------------------------------------------------
-- Audit log. Every meaningful write appends here.
-- ---------------------------------------------------------------------------
create table if not exists audit_logs (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organizations(id) on delete cascade,
  actor_id      uuid references profiles(id),
  action        text not null,            -- e.g. 'certificate.generate'
  entity        text not null,            -- e.g. 'certificate'
  entity_id     uuid,
  metadata      jsonb not null default '{}'::jsonb,
  created_at    timestamptz not null default now()
);
create index if not exists audit_logs_org_idx on audit_logs(org_id);

-- ============================================================================
-- Row-Level Security: tenant isolation. A user only sees their org's rows.
-- ============================================================================
alter table organizations enable row level security;
alter table profiles       enable row level security;
alter table templates      enable row level security;
alter table placeholders   enable row level security;
alter table courses        enable row level security;
alter table course_units   enable row level security;
alter table trainers       enable row level security;
alter table trainees       enable row level security;
alter table certificates   enable row level security;
alter table audit_logs     enable row level security;

-- Helper: current user's org id
create or replace function current_org_id() returns uuid
language sql stable as $$
  select org_id from profiles where id = auth.uid()
$$;

-- Generic org-scoped policy for the standard tables.
create policy org_read   on templates    for select using (org_id = current_org_id());
create policy org_write  on templates    for all    using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy org_read_c on courses      for select using (org_id = current_org_id());
create policy org_write_c on courses     for all    using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy org_read_tr on trainers    for select using (org_id = current_org_id());
create policy org_write_tr on trainers   for all    using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy org_read_te on trainees    for select using (org_id = current_org_id());
create policy org_write_te on trainees   for all    using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy org_read_ce on certificates for select using (org_id = current_org_id());
create policy org_write_ce on certificates for all   using (org_id = current_org_id()) with check (org_id = current_org_id());
create policy org_read_al on audit_logs  for select using (org_id = current_org_id());

-- Placeholders & course_units inherit org via their parent.
create policy ph_all on placeholders for all
  using (template_id in (select id from templates where org_id = current_org_id()))
  with check (template_id in (select id from templates where org_id = current_org_id()));
create policy cu_all on course_units for all
  using (course_id in (select id from courses where org_id = current_org_id()))
  with check (course_id in (select id from courses where org_id = current_org_id()));

-- Profiles: a user can read profiles in their org, edit only their own.
create policy profiles_read on profiles for select using (org_id = current_org_id());
create policy profiles_self on profiles for update using (id = auth.uid());

-- NOTE: the PUBLIC verification page does NOT use a logged-in session.
-- It reads via a server-side route handler using the service-role key,
-- returning only non-sensitive fields. See src/app/api/verify.
