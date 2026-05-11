-- =============================================================
-- Migration: v1.3.7 → v1.3.8
-- Reason: tier values changed from 'free'/'pro' to 'free'/'plus'/'premium'
-- =============================================================
--
-- Run this ONCE in your Supabase SQL Editor.
-- Idempotent: safe to run multiple times.
-- =============================================================

-- Drop the old check constraint (name varies — try the standard name first)
alter table public.roasts drop constraint if exists roasts_tier_check;

-- Add the new check constraint with three valid values
alter table public.roasts
  add constraint roasts_tier_check
  check (tier in ('free', 'plus', 'premium'));

-- Migrate any existing 'pro' rows to 'plus' (the closest equivalent)
update public.roasts set tier = 'plus' where tier = 'pro';

-- Sanity check
select tier, count(*) as row_count
from public.roasts
group by tier
order by tier;
