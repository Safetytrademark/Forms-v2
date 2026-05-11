-- ═══════════════════════════════════════════════════════════════════════════
-- TRADEMARK SAFETY — Supabase Schema
-- Run this entire file in: Supabase Dashboard → SQL Editor → New Query → Run
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Helper: check if current user is admin (bypasses RLS safely) ─────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT role = 'admin' FROM profiles WHERE id = auth.uid()),
    false
  );
$$;

-- ── PROFILES (extends auth.users) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT        NOT NULL DEFAULT '',
  role        TEXT        NOT NULL DEFAULT 'foreman' CHECK (role IN ('admin', 'foreman')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: own read"        ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles: own update"      ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles: admin all"       ON public.profiles FOR ALL USING (public.is_admin());

-- Auto-create profile row when a new auth user is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'role', 'foreman')
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── PROJECTS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.projects (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL UNIQUE,
  status     TEXT        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects: foreman sees assigned" ON public.projects FOR SELECT USING (
  public.is_admin() OR
  EXISTS (SELECT 1 FROM foreman_projects WHERE project_id = id AND foreman_id = auth.uid())
);
CREATE POLICY "projects: admin all" ON public.projects FOR ALL USING (public.is_admin());

-- ── FOREMAN ↔ PROJECT assignments ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.foreman_projects (
  foreman_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  PRIMARY KEY (foreman_id, project_id)
);

ALTER TABLE public.foreman_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fp: foreman reads own"  ON public.foreman_projects FOR SELECT USING (foreman_id = auth.uid() OR public.is_admin());
CREATE POLICY "fp: admin all"          ON public.foreman_projects FOR ALL   USING (public.is_admin());

-- ── DOCUMENTS (change orders, drawings, etc.) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documents (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  type          TEXT        NOT NULL DEFAULT 'general' CHECK (type IN ('change_order', 'drawing', 'general')),
  file_name     TEXT,
  file_url      TEXT,
  uploaded_by   UUID        REFERENCES public.profiles(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "docs: foreman sees project docs" ON public.documents FOR SELECT USING (
  public.is_admin() OR
  EXISTS (SELECT 1 FROM foreman_projects WHERE project_id = documents.project_id AND foreman_id = auth.uid())
);
CREATE POLICY "docs: admin all" ON public.documents FOR ALL USING (public.is_admin());

-- ── SUBMISSIONS log ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.submissions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  foreman_id      UUID        REFERENCES public.profiles(id),
  project_name    TEXT,
  submission_type TEXT,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sub: foreman insert own" ON public.submissions FOR INSERT WITH CHECK (foreman_id = auth.uid());
CREATE POLICY "sub: foreman reads own"  ON public.submissions FOR SELECT USING (foreman_id = auth.uid() OR public.is_admin());

-- ═══════════════════════════════════════════════════════════════════════════
-- AFTER RUNNING THIS SCHEMA:
--
-- 1. Go to Storage → Create bucket:
--    Name: "project-documents"  |  Public: YES
--
-- 2. Go to Authentication → Settings:
--    → Disable "Confirm email" (so accounts work instantly)
--    → Disable "Enable email signup" (only admins create accounts)
--
-- 3. Create YOUR admin account:
--    → Authentication → Users → Add user
--    → Enter your email + password
--    → After creating, run this SQL to make yourself admin:
--       UPDATE profiles SET role = 'admin', full_name = 'Your Name' WHERE id = '<your-user-id>';
--       (Find your user id in Authentication → Users)
-- ═══════════════════════════════════════════════════════════════════════════
