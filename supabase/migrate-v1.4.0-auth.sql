-- =============================================================
-- Migration: v1.3.8 → v1.4.0 (auth integration)
-- =============================================================
-- Adds:
--   1. public.profiles  — our user-facing data (username, tier)
--   2. handle_new_user() trigger — auto-creates a profile row
--      whenever Supabase Auth creates an auth.users row, pulling
--      the username out of the signup metadata.
--   3. RLS for profiles — a user can read/update their own row.
--   4. New RLS for roasts — switched from anonymous session-id
--      header lookups to auth.uid(). Anonymous flow is OFF.
--
-- Run ONCE in Supabase SQL Editor. Idempotent.
-- =============================================================

-- ── 1. profiles table ──────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text not null unique,
  tier          text not null default 'free' check (tier in ('free', 'plus', 'premium')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Enforce username format at the DB level too (matches the client regex)
alter table public.profiles
  drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (username ~ '^[a-zA-Z0-9]{3,20}$');

create index if not exists idx_profiles_username on public.profiles (username);

-- updated_at auto-bump
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ── 2. Auto-create profile on signup ───────────────────────────
-- Supabase Auth fires this when a row lands in auth.users.
-- We pull `username` out of raw_user_meta_data — that's the
-- bag we'll fill via supabase.auth.signUp({ options: { data: {...} }}).
--
-- SECURITY DEFINER lets the function write to public.profiles
-- even though the trigger fires under the auth schema's owner.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_username text;
begin
  v_username := nullif(trim(new.raw_user_meta_data ->> 'username'), '');

  -- If signup didn't include a username (e.g. OAuth flow we haven't
  -- built yet), synthesize one from the email's local part. The
  -- check constraint will still validate it.
  if v_username is null then
    v_username := regexp_replace(split_part(new.email, '@', 1), '[^a-zA-Z0-9]', '', 'g');
    -- Pad if too short, truncate if too long
    if length(v_username) < 3 then
      v_username := v_username || substr(replace(new.id::text, '-', ''), 1, 6);
    end if;
    v_username := substr(v_username, 1, 20);
  end if;

  insert into public.profiles (id, username)
  values (new.id, v_username);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── 3. RLS for profiles ────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "users read own profile"   on public.profiles;
drop policy if exists "users update own profile" on public.profiles;
drop policy if exists "users read any username"  on public.profiles;

-- A logged-in user can see their full profile row
create policy "users read own profile"
  on public.profiles for select
  to authenticated
  using (id = auth.uid());

-- A logged-in user can update their own row (but the check
-- constraint + trigger keep the data sane)
create policy "users update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- NOTE: We deliberately do NOT allow public reads of profiles.
-- If you ever want public profile pages, add a narrower policy
-- exposing only (username, tier) — never the id.

-- ── 4. Switch roasts RLS from anonymous to authenticated ──────
-- The session_id column stays (it's still the storage path prefix
-- and a useful audit field), but it now holds auth.uid()::text
-- for logged-in users. Anonymous inserts are blocked.

drop policy if exists "anon can insert roasts"     on public.roasts;
drop policy if exists "anon can read own session"  on public.roasts;
drop policy if exists "users insert own roasts"    on public.roasts;
drop policy if exists "users read own roasts"      on public.roasts;

create policy "users insert own roasts"
  on public.roasts for insert
  to authenticated
  with check (session_id = auth.uid()::text);

create policy "users read own roasts"
  on public.roasts for select
  to authenticated
  using (session_id = auth.uid()::text);

-- Storage policies — same flip from anon→authenticated.
-- The folder structure stays {user_id}/{timestamp}-{filename},
-- so existing rows keep working.

drop policy if exists "anon can upload to own folder"  on storage.objects;
drop policy if exists "anon can read own folder"       on storage.objects;
drop policy if exists "users upload to own folder"     on storage.objects;
drop policy if exists "users read own folder"          on storage.objects;

create policy "users upload to own folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "users read own folder"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── Sanity check ──
select 'profiles' as table_name, count(*) as rows from public.profiles
union all
select 'roasts',                count(*)         from public.roasts;
