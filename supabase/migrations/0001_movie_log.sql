-- Personal Movie Journal: Supabase Free schema.
-- The client only uses the publishable/anon key; RLS is the security boundary.

create extension if not exists pgcrypto;

create table if not exists public.movie_films (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  poster text not null default '',
  release_date text not null default '',
  douban_rating text not null default '',
  synopsis text not null default '',
  director text not null default '',
  cast_names text not null default '',
  genres text not null default '',
  countries text not null default '',
  languages text not null default '',
  runtime_minutes text not null default '',
  source_note text not null default '',
  douban_subject_id text not null default '',
  douban_url text not null default '',
  metadata_fetched_at timestamptz,
  metadata_expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.movie_cinemas (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  address text not null default '',
  source_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, name)
);

create table if not exists public.movie_events (
  id text primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  film_id text not null references public.movie_films(id) on delete cascade,
  watched_date text not null default '',
  watch_group text not null default '',
  status text not null default 'watched' check (status in ('watched', 'planned')),
  my_rating text not null default '',
  short_review text not null default '',
  scene text not null default '',
  date_note text not null default '',
  cinema_id text references public.movie_cinemas(id) on delete set null,
  hall text not null default '',
  seat text not null default '',
  watched_time text not null default '',
  ticket_status text not null default '',
  ticket_source text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists movie_films_owner_idx on public.movie_films(owner_id);
create index if not exists movie_films_title_idx on public.movie_films(owner_id, title);
create index if not exists movie_events_owner_date_idx on public.movie_events(owner_id, watched_date desc);
create index if not exists movie_events_film_idx on public.movie_events(film_id);
create index if not exists movie_events_cinema_idx on public.movie_events(cinema_id);

create or replace function public.set_movie_log_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists movie_films_updated_at on public.movie_films;
create trigger movie_films_updated_at before update on public.movie_films for each row execute function public.set_movie_log_updated_at();
drop trigger if exists movie_cinemas_updated_at on public.movie_cinemas;
create trigger movie_cinemas_updated_at before update on public.movie_cinemas for each row execute function public.set_movie_log_updated_at();
drop trigger if exists movie_events_updated_at on public.movie_events;
create trigger movie_events_updated_at before update on public.movie_events for each row execute function public.set_movie_log_updated_at();

alter table public.movie_films enable row level security;
alter table public.movie_cinemas enable row level security;
alter table public.movie_events enable row level security;

drop policy if exists movie_films_owner_select on public.movie_films;
create policy movie_films_owner_select on public.movie_films for select to authenticated using (owner_id = auth.uid());
drop policy if exists movie_films_owner_insert on public.movie_films;
create policy movie_films_owner_insert on public.movie_films for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists movie_films_owner_update on public.movie_films;
create policy movie_films_owner_update on public.movie_films for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists movie_films_owner_delete on public.movie_films;
create policy movie_films_owner_delete on public.movie_films for delete to authenticated using (owner_id = auth.uid());

drop policy if exists movie_cinemas_owner_select on public.movie_cinemas;
create policy movie_cinemas_owner_select on public.movie_cinemas for select to authenticated using (owner_id = auth.uid());
drop policy if exists movie_cinemas_owner_insert on public.movie_cinemas;
create policy movie_cinemas_owner_insert on public.movie_cinemas for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists movie_cinemas_owner_update on public.movie_cinemas;
create policy movie_cinemas_owner_update on public.movie_cinemas for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists movie_cinemas_owner_delete on public.movie_cinemas;
create policy movie_cinemas_owner_delete on public.movie_cinemas for delete to authenticated using (owner_id = auth.uid());

drop policy if exists movie_events_owner_select on public.movie_events;
create policy movie_events_owner_select on public.movie_events for select to authenticated using (owner_id = auth.uid());
drop policy if exists movie_events_owner_insert on public.movie_events;
create policy movie_events_owner_insert on public.movie_events for insert to authenticated with check (owner_id = auth.uid());
drop policy if exists movie_events_owner_update on public.movie_events;
create policy movie_events_owner_update on public.movie_events for update to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists movie_events_owner_delete on public.movie_events;
create policy movie_events_owner_delete on public.movie_events for delete to authenticated using (owner_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.movie_films to authenticated;
grant select, insert, update, delete on public.movie_cinemas to authenticated;
grant select, insert, update, delete on public.movie_events to authenticated;

-- A deliberately empty public table gives a free external heartbeat a harmless
-- endpoint to touch. It contains no user data and does not permit writes.
create table if not exists public.app_health (
  id boolean primary key default true check (id = true),
  touched_at timestamptz not null default now()
);
insert into public.app_health (id) values (true) on conflict (id) do nothing;
alter table public.app_health enable row level security;
drop policy if exists app_health_public_read on public.app_health;
create policy app_health_public_read on public.app_health for select to anon, authenticated using (true);
grant select on public.app_health to anon, authenticated;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.movie_films;
    alter publication supabase_realtime add table public.movie_cinemas;
    alter publication supabase_realtime add table public.movie_events;
  end if;
exception when duplicate_object then
  null;
end;
$$;
