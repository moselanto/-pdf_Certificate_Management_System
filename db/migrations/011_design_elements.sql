-- 011_design_elements.sql
-- "From scratch" certificate builder (blank-canvas designer).
--
-- Adds support for templates that have NO uploaded PDF background and are
-- instead built from static design elements (fixed text, straight lines, and
-- rectangles/borders) drawn directly on a blank page. Dynamic placeholders
-- (recipient name, course, date, QR) still render on top of these elements.
--
-- Design goals:
--   * Keep the existing PDF-upload flow fully intact (front_pdf_path stays
--     nullable-compatible; existing rows are untouched).
--   * Store the design as JSONB on the template so the engine can render it
--     without a background PDF.
--   * Record the blank page size so the editor and engine agree on dimensions.
--
-- Coordinates in design_elements use a TOP-LEFT origin (matching the browser
-- editor); the render engine converts to pdf-lib's bottom-left origin.
--
-- Run this in the Supabase SQL Editor AFTER migrations 001-010.

-- Mark whether a template is built from scratch vs. from an uploaded PDF.
alter table public.templates
  add column if not exists is_from_scratch boolean not null default false;

-- The static artwork (array of design elements) for from-scratch templates.
-- Shape (per element), all coordinates in points, top-left origin:
--   { "id": text, "page": "front"|"back", "kind": "text"|"line"|"rect",
--     "x": num, "y": num, "z": num?,
--     -- text:
--     "text": str, "fontSize": num, "fontFamily": str, "color": "#hex",
--     "align": "left"|"center"|"right", "width": num?, "lineGap": num?,
--     -- line:
--     "x2": num, "y2": num, "thickness": num, "color": "#hex",
--     -- rect:
--     "width": num, "height": num, "strokeColor": "#hex"?, "strokeWidth": num?,
--     "fillColor": "#hex"?, "cornerRadius": num? }
alter table public.templates
  add column if not exists design_elements jsonb not null default '[]'::jsonb;

-- Blank page size (points) for from-scratch templates. NULL for PDF templates,
-- where the page size comes from the uploaded PDF.
--   { "width": num, "height": num }
alter table public.templates
  add column if not exists blank_page_size jsonb;

-- Note: no RLS changes needed. These are new columns on public.templates,
-- which already enforces org-scoped RLS from the earlier migrations.
