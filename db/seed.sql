-- Demo data. Run AFTER schema.sql. Replace storage paths with real uploads.
-- Note: profiles link to auth.users; create a user via Supabase Auth first,
-- then insert a matching profile row with that user's id.

insert into organizations (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Pimofy Training Institute')
on conflict do nothing;

insert into templates (id, org_id, name, front_pdf_path, back_pdf_path, page_width, page_height)
values (
  '00000000-0000-0000-0000-0000000000a1',
  '00000000-0000-0000-0000-000000000001',
  'Standard Completion Certificate',
  'demo/front.pdf', 'demo/back.pdf', 842, 595         -- A4 landscape, points
) on conflict do nothing;

insert into courses (id, org_id, title, description)
values (
  '00000000-0000-0000-0000-0000000000c1',
  '00000000-0000-0000-0000-000000000001',
  'Data Operations Fundamentals',
  'Core competencies in data entry, validation, and back-office operations.'
) on conflict do nothing;

insert into course_units (course_id, sort_order, title) values
  ('00000000-0000-0000-0000-0000000000c1', 1, 'Data Entry Accuracy & Speed'),
  ('00000000-0000-0000-0000-0000000000c1', 2, 'Quality Assurance & Validation'),
  ('00000000-0000-0000-0000-0000000000c1', 3, 'Document Classification'),
  ('00000000-0000-0000-0000-0000000000c1', 4, 'Data Privacy & Confidentiality')
on conflict do nothing;

insert into trainers (id, org_id, name, title)
values (
  '00000000-0000-0000-0000-0000000000d1',
  '00000000-0000-0000-0000-000000000001',
  'Peter Wafula', 'Lead Trainer'
) on conflict do nothing;
