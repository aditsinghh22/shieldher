-- ═══════════════════════════════════════
-- ShieldHer E2EE Migration
-- Run this in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════

-- 1. Add encryption salt to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS encryption_salt TEXT;

-- 2. Add encrypted fields to analysis_results
ALTER TABLE public.analysis_results
  ADD COLUMN IF NOT EXISTS encrypted_summary TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_flags TEXT,
  ADD COLUMN IF NOT EXISTS encrypted_details TEXT,
  ADD COLUMN IF NOT EXISTS encryption_iv TEXT;

-- 3. Add encrypted file fields to uploads
ALTER TABLE public.uploads
  ADD COLUMN IF NOT EXISTS file_iv TEXT,
  ADD COLUMN IF NOT EXISTS original_type TEXT;

-- 4. Make the summary column nullable (encrypted data uses encrypted_summary instead)
ALTER TABLE public.analysis_results
  ALTER COLUMN summary SET DEFAULT '[encrypted]';

-- 5. Allow users to insert their own analysis results (needed for client-side encrypted inserts)
CREATE POLICY "Users can insert analyses for their uploads"
  ON public.analysis_results FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.uploads
      WHERE uploads.id = analysis_results.upload_id
      AND uploads.user_id = auth.uid()
    )
  );

-- 6. Make storage buckets private (optional — run if you want full privacy)
-- UPDATE storage.buckets SET public = false WHERE id = 'screenshots';
-- UPDATE storage.buckets SET public = false WHERE id = 'reports';
-- NOTE: Making buckets private means you'd need signed URLs to access files.
-- For now, the files are encrypted so even public URLs show unreadable data.
