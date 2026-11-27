-- Name Swipe: run this once in Supabase, under SQL Editor > New query.

create table if not exists profiles (
  id           text primary key,
  display_name text not null
);

create table if not exists names (
  id         text primary key,
  name       text not null,
  gender     text not null,
  origin     text,
  meaning    text,
  tag        text default 'custom',
  created_at timestamptz default now()
);

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

create table if not exists votes (
  profile_id text not null,
  name_id    text not null,
  verdict    text not null check (verdict in ('like','pass','super')),
  updated_at timestamptz default now(),
  primary key (profile_id, name_id)
);

insert into profiles (id, display_name) values ('p1','Sachin'), ('p2','Menz')
  on conflict (id) do nothing;

-- Table privileges. Newer Supabase projects do not grant these automatically,
-- so the anonymous role has to be given access explicitly.
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on table profiles to anon, authenticated;
grant select, insert, update, delete on table names    to anon, authenticated;
grant select, insert, update, delete on table votes    to anon, authenticated;
grant select, insert, update, delete on table settings to anon, authenticated;
grant select, insert, update, delete on table comments to anon, authenticated;
grant usage, select on all sequences in schema public to anon, authenticated;

-- Row level security. This app has no logins, so both phones connect as the
-- anonymous role and need read and write access to these three tables.
alter table profiles enable row level security;
alter table names    enable row level security;
alter table votes    enable row level security;
alter table settings enable row level security;
alter table comments enable row level security;

drop policy if exists open_profiles on profiles;
drop policy if exists open_names    on names;
drop policy if exists open_votes    on votes;
drop policy if exists open_settings on settings;
drop policy if exists open_comments on comments;

create policy open_profiles on profiles for all using (true) with check (true);
create policy open_names    on names    for all using (true) with check (true);
create policy open_votes    on votes    for all using (true) with check (true);
create policy open_settings on settings for all using (true) with check (true);
create policy open_comments on comments for all using (true) with check (true);

-- Live updates. Without this the app falls back to checking every 20 seconds.
alter publication supabase_realtime add table votes;
alter publication supabase_realtime add table names;
alter publication supabase_realtime add table profiles;
alter publication supabase_realtime add table settings;
alter publication supabase_realtime add table comments;
