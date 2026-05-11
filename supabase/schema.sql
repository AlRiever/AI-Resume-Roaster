-- =============================================================
-- Resume Roaster — Supabase schema (v1.2)
-- Run once in Supabase SQL Editor. Idempotent.
-- =============================================================

create extension if not exists "uuid-ossp";

create table if not exists public.roasts (
  id              uuid primary key default uuid_generate_v4(),
  session_id      text not null,
  file_path       text not null,
  file_name       text not null,
  file_type       text not null check (file_type in ('application/pdf', 'image/png')),
  target_company  text,
  tier            text not null default 'free' check (tier in ('free', 'plus', 'premium')),
  status          text not null default 'pending'
                  check (status in ('pending', 'processing', 'completed', 'failed')),
  result          jsonb,
  error_message   text,
  parsed_text     text,
  created_at      timestamptz not null default now(),
  completed_at    timestamptz
);

create index if not exists idx_roasts_session_created
  on public.roasts (session_id, created_at desc);

create index if not exists idx_roasts_status
  on public.roasts (status) where status in ('pending', 'processing');

alter table public.roasts enable row level security;

drop policy if exists "anon can insert roasts"     on public.roasts;
drop policy if exists "anon can read own session"  on public.roasts;

create policy "anon can insert roasts"
  on public.roasts for insert to anon with check (true);

create policy "anon can read own session"
  on public.roasts for select to anon
  using (session_id = current_setting('request.headers', true)::json->>'x-session-id');

drop policy if exists "anon can upload to own folder"   on storage.objects;
drop policy if exists "anon can read own folder"        on storage.objects;

create policy "anon can upload to own folder"
  on storage.objects for insert to anon
  with check (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = current_setting('request.headers', true)::json->>'x-session-id'
  );

create policy "anon can read own folder"
  on storage.objects for select to anon
  using (
    bucket_id = 'resumes'
    and (storage.foldername(name))[1] = current_setting('request.headers', true)::json->>'x-session-id'
  );
