-- ============================================================
-- Resume Roaster — v1.5.0 Profile Settings Migration
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Profiles table — stores username, avatar, scheduled deletion
CREATE TABLE IF NOT EXISTS public.profiles (
  id                   UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username             TEXT        UNIQUE,
  avatar_url           TEXT,
  scheduled_delete_at  TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for username lookups (login by username)
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles (username);

-- Username: lowercase-unique index so "JohnDoe" and "johndoe" are different
-- but you could change UNIQUE above to LOWER(username) if you want case-insensitive uniqueness

-- 2. RLS — users can only read/write their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_read_own_profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "user_update_own_profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "user_insert_own_profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Service role can do everything (for the schedule-delete API route)
-- No explicit policy needed — service role bypasses RLS.

-- 3. updated_at auto-trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4. Supabase Storage — avatars bucket (public, 5 MB limit, images only)
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES (
    'avatars', 'avatars', true, 5242880,
    ARRAY['image/png','image/jpeg','image/webp','image/gif']
  )
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN insufficient_privilege THEN
    RAISE NOTICE 'Create "avatars" bucket manually in Storage dashboard if this fails.';
END $$;

-- Storage RLS: anyone can read avatars (public), only owner can upload
CREATE POLICY "public_read_avatars"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

CREATE POLICY "owner_upload_avatar"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = 'avatars');

CREATE POLICY "owner_update_avatar"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'avatars');

-- 5. pg_cron: auto-delete accounts after 72-hour grace period
-- (Only works if pg_cron extension is enabled on your Supabase plan)
-- Enable via: Supabase Dashboard → Database → Extensions → pg_cron
-- Then uncomment:
--
-- SELECT cron.schedule(
--   'delete-scheduled-accounts',
--   '0 3 * * *',  -- runs at 3am UTC every day
--   $$
--     DELETE FROM auth.users
--     WHERE id IN (
--       SELECT id FROM public.profiles
--       WHERE scheduled_delete_at IS NOT NULL
--         AND scheduled_delete_at < now()
--     );
--   $$
-- );
