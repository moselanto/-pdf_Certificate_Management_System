-- 004_course_list_placeholder_kind.sql
-- Adds 'course_list' to the placeholder_kind enum so the designer can save a
-- positioned/sizable course-units box on the back page. Run in Supabase SQL Editor.

alter type placeholder_kind add value if not exists 'course_list';
