-- Name Swipe v1.3. Run once in Supabase: SQL Editor > New query > paste > Run.
-- Safe to run even if you have already run MIGRATE-v1.2.sql.

alter table votes drop constraint if exists votes_verdict_check;
alter table votes add constraint votes_verdict_check
  check (verdict in ('like','pass','super'));

create table if not exists settings (
  key   text primary key,
  value text
);

create table if not exists comments (
  id         bigint generated always as identity primary key,
  name_id    text not null,
  profile_id text not null,
  body       text not null,
  created_at timestamptz default now()
);
create index if not exists comments_name_idx on comments (name_id, created_at);

grant select, insert, update, delete on table settings to anon, authenticated;
grant select, insert, update, delete on table comments to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

alter table settings enable row level security;
alter table comments enable row level security;
drop policy if exists open_settings on settings;
drop policy if exists open_comments on comments;
create policy open_settings on settings for all using (true) with check (true);
create policy open_comments on comments for all using (true) with check (true);

do $$ begin alter publication supabase_realtime add table settings; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table comments; exception when duplicate_object then null; end $$;
