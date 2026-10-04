create index if not exists idx_lectures_title on lectures using gin (to_tsvector('simple', coalesce(title,'')));
create index if not exists idx_lectures_professor on lectures using gin (to_tsvector('simple', coalesce(professor_name,'')));
create index if not exists idx_students_status on students(status);
create index if not exists idx_access_codes_status on access_codes(status);
