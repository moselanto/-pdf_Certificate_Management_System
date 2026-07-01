-- 012_course_unit_sections.sql
-- Optional section/group heading for a course unit (e.g. "Theory", "Practical").
-- Consecutive units that share a section render together under a bold
-- sub-heading on the certificate back page. Nullable & additive: existing flat
-- course lists keep working unchanged, and reads tolerate the column being
-- absent. Safe to run more than once.
alter table course_units add column if not exists section text;
