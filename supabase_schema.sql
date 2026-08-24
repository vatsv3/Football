-- Initial Schema & Policies for Football Auction

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. PROFILES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'player')) DEFAULT 'player',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_policy"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "profiles_insert_policy"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "profiles_update_policy"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK (auth.uid() = id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "profiles_delete_policy"
  ON public.profiles FOR DELETE
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');


-- ============================================
-- 2. TRAITS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.traits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.traits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "traits_select_policy"
  ON public.traits FOR SELECT
  USING (true);

CREATE POLICY "traits_insert_policy"
  ON public.traits FOR INSERT
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "traits_update_policy"
  ON public.traits FOR UPDATE
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "traits_delete_policy"
  ON public.traits FOR DELETE
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');


-- ============================================
-- 3. PLAYERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.players (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  primary_position TEXT NOT NULL,
  secondary_positions TEXT[] DEFAULT '{}',
  specialties TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'drafted')),
  team_id UUID
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "players_select_policy"
  ON public.players FOR SELECT
  USING (true);

CREATE POLICY "players_insert_policy"
  ON public.players FOR INSERT
  WITH CHECK (auth.uid() = id OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

CREATE POLICY "players_update_policy"
  ON public.players FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "players_delete_policy"
  ON public.players FOR DELETE
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');


-- ============================================
-- 4. TEAMS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  manager_id UUID REFERENCES public.profiles(id) NOT NULL,
  budget NUMERIC DEFAULT 1000.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "teams_select_policy"
  ON public.teams FOR SELECT
  USING (true);

CREATE POLICY "teams_insert_policy"
  ON public.teams FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "teams_update_policy"
  ON public.teams FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "teams_delete_policy"
  ON public.teams FOR DELETE
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');


-- ============================================
-- 5. AUCTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.auctions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES public.players(id) NOT NULL UNIQUE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'live', 'completed')),
  base_price NUMERIC NOT NULL DEFAULT 10.00,
  current_bid NUMERIC DEFAULT 0,
  highest_bidder_id UUID REFERENCES public.teams(id),
  timer_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.auctions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auctions_select_policy"
  ON public.auctions FOR SELECT
  USING (true);

CREATE POLICY "auctions_insert_policy"
  ON public.auctions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "auctions_update_policy"
  ON public.auctions FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "auctions_delete_policy"
  ON public.auctions FOR DELETE
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');


-- ============================================
-- 6. TRANSFERS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.transfers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  player_id UUID REFERENCES public.players(id) NOT NULL,
  from_team_id UUID REFERENCES public.teams(id) NOT NULL,
  to_team_id UUID REFERENCES public.teams(id) NOT NULL,
  amount NUMERIC NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.transfers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "transfers_select_policy"
  ON public.transfers FOR SELECT
  USING (true);

CREATE POLICY "transfers_insert_policy"
  ON public.transfers FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "transfers_update_policy"
  ON public.transfers FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "transfers_delete_policy"
  ON public.transfers FOR DELETE
  USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');


-- ============================================
-- TRIGGER: AUTH USER CREATION -> PROFILE CREATION
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (new.id, new.raw_user_meta_data->>'username', COALESCE(new.raw_user_meta_data->>'role', 'player'));
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
