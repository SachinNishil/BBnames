-- Name Swipe v1.2. Run once in Supabase: SQL Editor > New query > paste > Run.

-- 1. Super likes. 'super' counts as a like, and marks the name as starred.
alter table votes drop constraint if exists votes_verdict_check;
alter table votes add constraint votes_verdict_check
  check (verdict in ('like','pass','super'));

-- 2. Shared settings, so the shuffle order is identical on both phones.
create table if not exists settings (
  key   text primary key,
  value text
);

grant select, insert, update, delete on table settings to anon, authenticated;
alter table settings enable row level security;
drop policy if exists open_settings on settings;
create policy open_settings on settings for all using (true) with check (true);

do $$ begin
  alter publication supabase_realtime add table settings;
exception when duplicate_object then null;
end $$;
