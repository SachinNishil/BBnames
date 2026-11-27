-- Run this in Supabase: SQL Editor > New query > paste > Run.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table profiles to anon, authenticated;
grant select, insert, update, delete on table names    to anon, authenticated;
grant select, insert, update, delete on table votes    to anon, authenticated;
