-- Initial Schema for Football Auction

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'player')) DEFAULT 'player',
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone."
  ON public.profiles FOR SELECT
  USING ( true );

CREATE POLICY "Users can update own profile."
  ON public.profiles FOR UPDATE
  USING ( auth.uid() = id )
  WITH CHECK ( auth.uid() = id );

CREATE POLICY "Admins have full access on profiles"
  ON public.profiles FOR ALL
  USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' )
  WITH CHECK ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' );

-- Traits table
CREATE TABLE public.traits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.traits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Traits are viewable by everyone"
  ON public.traits FOR SELECT
  USING (true);

CREATE POLICY "Admins have full access on traits"
  ON public.traits FOR ALL
  USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' )
  WITH CHECK ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' );

-- Player Details table
CREATE TABLE public.players (
  id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  primary_position TEXT NOT NULL,
  secondary_positions TEXT[] DEFAULT '{}',
  specialties TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'available' CHECK (status IN ('available', 'drafted')),
  team_id UUID -- Added later
);

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players are viewable by everyone."
  ON public.players FOR SELECT
  USING ( true );

CREATE POLICY "Players can update own details."
  ON public.players FOR UPDATE
  USING ( auth.uid() = id )
  WITH CHECK ( auth.uid() = id );

CREATE POLICY "Admins have full access on players"
  ON public.players FOR ALL
  USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' )
  WITH CHECK ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' );

-- Teams table
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  manager_id UUID REFERENCES public.profiles(id) NOT NULL,
  budget NUMERIC DEFAULT 1000.00,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teams are viewable by everyone."
  ON public.teams FOR SELECT
  USING ( true );

CREATE POLICY "Admins have full access on teams"
  ON public.teams FOR ALL
  USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' )
  WITH CHECK ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' );

-- Auctions table
CREATE TABLE public.auctions (
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

CREATE POLICY "Auctions are viewable by everyone."
  ON public.auctions FOR SELECT
  USING ( true );

CREATE POLICY "Admins have full access on auctions"
  ON public.auctions FOR ALL
  USING ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' )
  WITH CHECK ( (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' );

-- Function to handle new user registration and create profile
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

-- Trigger for new user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
