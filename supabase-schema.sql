-- Supabase SQL Schema for ShieldHer
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)

-- ═══════════════════════════════════════
-- 1. Profiles Table
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  full_name TEXT,
  avatar_url TEXT,
  ghost_mode BOOLEAN DEFAULT false NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════
-- 2. Uploads Table
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.uploads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'completed', 'flagged')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own uploads"
  ON public.uploads FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own uploads"
  ON public.uploads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own uploads"
  ON public.uploads FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own uploads"
  ON public.uploads FOR DELETE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════
-- 3. Analysis Results Table
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.analysis_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  upload_id UUID REFERENCES public.uploads(id) ON DELETE CASCADE NOT NULL,
  risk_level TEXT DEFAULT 'safe' CHECK (risk_level IN ('safe', 'low', 'medium', 'high', 'critical')) NOT NULL,
  summary TEXT NOT NULL,
  flags JSONB DEFAULT '[]'::jsonb NOT NULL,
  details JSONB DEFAULT '{}'::jsonb NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.analysis_results ENABLE ROW LEVEL SECURITY;

-- Policies (via upload ownership)
CREATE POLICY "Users can view analyses for their uploads"
  ON public.analysis_results FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.uploads
      WHERE uploads.id = analysis_results.upload_id
      AND uploads.user_id = auth.uid()
    )
  );

CREATE POLICY "Service role can insert analyses"
  ON public.analysis_results FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Service role can update analyses"
  ON public.analysis_results FOR UPDATE
  USING (true);

-- ═══════════════════════════════════════
-- 4. Storage Bucket
-- ═══════════════════════════════════════
-- Create the screenshots storage bucket
-- (Run this separately or via Supabase dashboard: Storage > New Bucket)
INSERT INTO storage.buckets (id, name, public)
VALUES ('screenshots', 'screenshots', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Users can upload screenshots"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'screenshots'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can view their screenshots"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'screenshots'
  );

CREATE POLICY "Users can delete their screenshots"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'screenshots'
    AND auth.uid() IS NOT NULL
  );

-- ═══════════════════════════════════════
-- 5. Reports Table (PDF Evidence Reports)
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  upload_id UUID REFERENCES public.uploads(id) ON DELETE CASCADE NOT NULL,
  analysis_id UUID REFERENCES public.analysis_results(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  risk_level TEXT DEFAULT 'safe' CHECK (risk_level IN ('safe', 'low', 'medium', 'high', 'critical')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own reports"
  ON public.reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own reports"
  ON public.reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own reports"
  ON public.reports FOR DELETE
  USING (auth.uid() = user_id);

-- ═══════════════════════════════════════
-- 6. Reports Storage Bucket
-- ═══════════════════════════════════════
INSERT INTO storage.buckets (id, name, public)
VALUES ('reports', 'reports', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for reports bucket
CREATE POLICY "Users can upload reports"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'reports'
    AND auth.uid() IS NOT NULL
  );

CREATE POLICY "Users can view reports"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'reports'
  );

CREATE POLICY "Users can delete their reports"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'reports'
    AND auth.uid() IS NOT NULL
  );

-- ═══════════════════════════════════════
-- 7. Communication Threads & Messages
-- ═══════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.communication_threads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  lawyer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  user_name TEXT NOT NULL,
  lawyer_name TEXT NOT NULL,
  initiated_by_user_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, lawyer_id)
);

CREATE TABLE IF NOT EXISTS public.communication_messages (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID REFERENCES public.communication_threads(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sender_role TEXT CHECK (sender_role IN ('user', 'lawyer')) NOT NULL,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS communication_threads_user_id_idx
  ON public.communication_threads (user_id);
CREATE INDEX IF NOT EXISTS communication_threads_lawyer_id_idx
  ON public.communication_threads (lawyer_id);
CREATE INDEX IF NOT EXISTS communication_threads_updated_at_idx
  ON public.communication_threads (updated_at DESC);

CREATE INDEX IF NOT EXISTS communication_messages_thread_id_idx
  ON public.communication_messages (thread_id, created_at ASC);
CREATE INDEX IF NOT EXISTS communication_messages_unread_idx
  ON public.communication_messages (thread_id, read_at);

CREATE OR REPLACE FUNCTION public.touch_communication_thread()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.communication_threads
  SET updated_at = NEW.created_at
  WHERE id = NEW.thread_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS communication_message_touch_thread ON public.communication_messages;
CREATE TRIGGER communication_message_touch_thread
  AFTER INSERT ON public.communication_messages
  FOR EACH ROW EXECUTE FUNCTION public.touch_communication_thread();

ALTER TABLE public.communication_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communication_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Participants can view their communication threads" ON public.communication_threads;
CREATE POLICY "Participants can view their communication threads"
  ON public.communication_threads FOR SELECT
  USING (auth.uid() = user_id OR auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "Users can create their communication threads" ON public.communication_threads;
CREATE POLICY "Users can create their communication threads"
  ON public.communication_threads FOR INSERT
  WITH CHECK (auth.uid() = user_id OR auth.uid() = lawyer_id);

DROP POLICY IF EXISTS "Participants can view thread messages" ON public.communication_messages;
CREATE POLICY "Participants can view thread messages"
  ON public.communication_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.communication_threads t
      WHERE t.id = communication_messages.thread_id
      AND (t.user_id = auth.uid() OR t.lawyer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants can send thread messages" ON public.communication_messages;
CREATE POLICY "Participants can send thread messages"
  ON public.communication_messages FOR INSERT
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1
      FROM public.communication_threads t
      WHERE t.id = communication_messages.thread_id
      AND (t.user_id = auth.uid() OR t.lawyer_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Participants can mark messages read" ON public.communication_messages;
CREATE POLICY "Participants can mark messages read"
  ON public.communication_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.communication_threads t
      WHERE t.id = communication_messages.thread_id
      AND (t.user_id = auth.uid() OR t.lawyer_id = auth.uid())
    )
  );
