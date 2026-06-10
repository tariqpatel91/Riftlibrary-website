-- ============================================================
-- RiftLibrary — Supabase setup
-- ============================================================
-- Paste this entire file into the Supabase SQL Editor and run it.
-- (Dashboard → SQL Editor → New Query → paste → Run.)
--
-- It creates the public_decks and team_decks tables with Row Level
-- Security so:
--   • Anyone (even logged-out visitors) can read public_decks,
--     but only the deck's author can insert / edit / delete their row.
--   • Only members of a team can read its team_decks, and only the
--     deck's author can insert / edit / delete their row.
--   • The existing private "decks" table (one row per personal deck)
--     is already user-scoped by user_id; nothing changes there.
--
-- Re-running is safe — every statement is idempotent.

-- ── PROFILES ────────────────────────────────────────────────
-- One row per user. Every profile gets a unique, auto-assigned numeric
-- user_number (a stable site-wide id) and a globally-unique display_name
-- (compared case-insensitively). The display name defaults to whatever name
-- the user signed in with (Google / X / Discord / email) and can be changed
-- at most once every 3 months — enforced by the trigger below so it can't be
-- bypassed from the client.
create table if not exists public.profiles (
  id                       uuid primary key references auth.users(id) on delete cascade,
  user_number              bigint generated always as identity,
  display_name             text not null,
  display_name_changed_at  timestamptz default now(),
  created_at               timestamptz default now()
);

-- Unique numeric id + case-insensitive unique display name
create unique index if not exists profiles_user_number_key
  on public.profiles(user_number);
create unique index if not exists profiles_display_name_lower_key
  on public.profiles(lower(display_name));

alter table public.profiles enable row level security;

-- Anyone can read profiles (so deck authors / names show for everyone).
drop policy if exists "profiles_select_anyone" on public.profiles;
create policy "profiles_select_anyone"
  on public.profiles for select using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update using (auth.uid() = id);

-- Enforce the "change display name once every 3 months" rule. Runs before any
-- update; only fires when the display_name actually changes.
create or replace function public.enforce_display_name_cooldown()
returns trigger language plpgsql as $$
begin
  if new.display_name is distinct from old.display_name then
    if old.display_name_changed_at is not null
       and old.display_name_changed_at > now() - interval '3 months' then
      raise exception 'display_name_cooldown: you can only change your display name once every 3 months';
    end if;
    new.display_name_changed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists trg_display_name_cooldown on public.profiles;
create trigger trg_display_name_cooldown
  before update on public.profiles
  for each row execute function public.enforce_display_name_cooldown();

-- ── PUBLIC DECKS ────────────────────────────────────────────
create table if not exists public.public_decks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete cascade,
  local_deck_id   text,
  name            text not null,
  legend          text,
  legend_img      text,
  format          text,
  domains         jsonb default '[]'::jsonb,
  cards           jsonb default '[]'::jsonb,
  card_count      integer default 0,
  author          text,
  description     text,
  created_at      timestamptz default now()
);

alter table public.public_decks enable row level security;

drop policy if exists "public_decks_select_anyone" on public.public_decks;
create policy "public_decks_select_anyone"
  on public.public_decks for select using (true);

drop policy if exists "public_decks_insert_own" on public.public_decks;
create policy "public_decks_insert_own"
  on public.public_decks for insert with check (auth.uid() = user_id);

drop policy if exists "public_decks_update_own" on public.public_decks;
create policy "public_decks_update_own"
  on public.public_decks for update using (auth.uid() = user_id);

drop policy if exists "public_decks_delete_own" on public.public_decks;
create policy "public_decks_delete_own"
  on public.public_decks for delete using (auth.uid() = user_id);

-- ── TOURNAMENT DECKS ────────────────────────────────────────
-- A curated, site-wide showcase. Anyone (even logged-out) can read; only the
-- admins listed below can insert / update / delete. To grant another admin,
-- add their email to BOTH this policy list AND the ADMIN_EMAILS array in
-- riftlibrary.js. Emails are compared lower-cased.
create table if not exists public.tournament_decks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references auth.users(id) on delete set null,
  name            text not null,
  legend          text,
  legend_img      text,
  format          text,
  domains         jsonb default '[]'::jsonb,
  cards           jsonb default '[]'::jsonb,
  card_count      integer default 0,
  author          text,
  description     text,
  event_name      text,
  placement       text,
  player          text,
  event_date      date,
  created_at      timestamptz default now()
);

alter table public.tournament_decks enable row level security;

drop policy if exists "tournament_decks_select_anyone" on public.tournament_decks;
create policy "tournament_decks_select_anyone"
  on public.tournament_decks for select using (true);

drop policy if exists "tournament_decks_insert_admin" on public.tournament_decks;
create policy "tournament_decks_insert_admin"
  on public.tournament_decks for insert
  with check ( lower(auth.jwt() ->> 'email') in ('tariqpatel91@gmail.com') );

drop policy if exists "tournament_decks_update_admin" on public.tournament_decks;
create policy "tournament_decks_update_admin"
  on public.tournament_decks for update
  using ( lower(auth.jwt() ->> 'email') in ('tariqpatel91@gmail.com') );

drop policy if exists "tournament_decks_delete_admin" on public.tournament_decks;
create policy "tournament_decks_delete_admin"
  on public.tournament_decks for delete
  using ( lower(auth.jwt() ->> 'email') in ('tariqpatel91@gmail.com') );

-- ── TEAMS + MEMBERSHIP ──────────────────────────────────────
create table if not exists public.teams (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  img         text,
  cover       text,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz default now()
);

create table if not exists public.team_members (
  team_id     uuid not null references public.teams(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text default 'member',
  joined_at   timestamptz default now(),
  primary key (team_id, user_id)
);

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

drop policy if exists "teams_select_member" on public.teams;
create policy "teams_select_member"
  on public.teams for select using (
    auth.uid() = owner_id
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = teams.id and tm.user_id = auth.uid()
    )
  );

drop policy if exists "teams_insert_own" on public.teams;
create policy "teams_insert_own"
  on public.teams for insert with check (auth.uid() = owner_id);

drop policy if exists "teams_update_owner" on public.teams;
create policy "teams_update_owner"
  on public.teams for update using (auth.uid() = owner_id);

drop policy if exists "teams_delete_owner" on public.teams;
create policy "teams_delete_owner"
  on public.teams for delete using (auth.uid() = owner_id);

drop policy if exists "team_members_select_team" on public.team_members;
create policy "team_members_select_team"
  on public.team_members for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = team_members.team_id and tm.user_id = auth.uid()
    )
  );

drop policy if exists "team_members_insert_owner_or_self" on public.team_members;
create policy "team_members_insert_owner_or_self"
  on public.team_members for insert with check (
    auth.uid() = user_id
    or exists (
      select 1 from public.teams t
      where t.id = team_members.team_id and t.owner_id = auth.uid()
    )
  );

drop policy if exists "team_members_delete_owner_or_self" on public.team_members;
create policy "team_members_delete_owner_or_self"
  on public.team_members for delete using (
    auth.uid() = user_id
    or exists (
      select 1 from public.teams t
      where t.id = team_members.team_id and t.owner_id = auth.uid()
    )
  );

-- ── TEAM DECKS ──────────────────────────────────────────────
create table if not exists public.team_decks (
  id              uuid primary key default gen_random_uuid(),
  team_id         uuid not null references public.teams(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  local_deck_id   text,
  name            text not null,
  legend          text,
  legend_img      text,
  format          text,
  domains         jsonb default '[]'::jsonb,
  cards           jsonb default '[]'::jsonb,
  card_count      integer default 0,
  author          text,
  description     text,
  created_at      timestamptz default now()
);

alter table public.team_decks enable row level security;

drop policy if exists "team_decks_select_member" on public.team_decks;
create policy "team_decks_select_member"
  on public.team_decks for select using (
    auth.uid() = user_id
    or exists (
      select 1 from public.team_members tm
      where tm.team_id = team_decks.team_id and tm.user_id = auth.uid()
    )
  );

drop policy if exists "team_decks_insert_member" on public.team_decks;
create policy "team_decks_insert_member"
  on public.team_decks for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.team_members tm
      where tm.team_id = team_decks.team_id and tm.user_id = auth.uid()
    )
  );

drop policy if exists "team_decks_update_own" on public.team_decks;
create policy "team_decks_update_own"
  on public.team_decks for update using (auth.uid() = user_id);

drop policy if exists "team_decks_delete_own" on public.team_decks;
create policy "team_decks_delete_own"
  on public.team_decks for delete using (auth.uid() = user_id);

-- ── MY EVENTS — notes column ────────────────────────────────
-- Adds a free-text notes field to the existing my_events table so each
-- event in "My Events" can carry deck plans / travel reminders / etc.
-- Safe to run even if the column already exists.
alter table if exists public.my_events
  add column if not exists notes text default '';
