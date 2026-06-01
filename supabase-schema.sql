-- Supabase SQL Schema for MineServer
-- Run this in the Supabase SQL Editor

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  username TEXT UNIQUE NOT NULL,
  premium BOOLEAN DEFAULT false,
  theme TEXT DEFAULT 'default',
  custom_color TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Servers table
CREATE TABLE IF NOT EXISTS servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  domain TEXT NOT NULL,
  loader TEXT NOT NULL,
  version TEXT NOT NULL,
  visibility TEXT DEFAULT 'public',
  status TEXT DEFAULT 'stopped',
  min_ram TEXT DEFAULT '1G',
  max_ram TEXT DEFAULT '2G',
  java_path TEXT DEFAULT 'java',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Whitelist table
CREATE TABLE IF NOT EXISTS whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  permission TEXT DEFAULT 'member',
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backups table
CREATE TABLE IF NOT EXISTS backups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  size BIGINT DEFAULT 0,
  url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Mods table
CREATE TABLE IF NOT EXISTS mods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  source TEXT DEFAULT '',
  url TEXT DEFAULT '',
  filename TEXT DEFAULT '',
  installed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Server folders (for tracking)
CREATE TABLE IF NOT EXISTS server_folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Access cards (shared server access)
CREATE TABLE IF NOT EXISTS access_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  owner_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_id UUID REFERENCES users(id) ON DELETE CASCADE,
  recipient_username TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE servers ENABLE ROW LEVEL SECURITY;
ALTER TABLE whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE mods ENABLE ROW LEVEL SECURITY;
ALTER TABLE server_folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE access_cards ENABLE ROW LEVEL SECURITY;

-- Create policies for authenticated users
DROP POLICY IF EXISTS "Users can view own data" ON users;
CREATE POLICY "Users can view own data" ON users
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own data" ON users;
CREATE POLICY "Users can insert own data" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own data" ON users;
CREATE POLICY "Users can update own data" ON users
  FOR UPDATE USING (auth.uid() = id);

-- Server policies
DROP POLICY IF EXISTS "Users can view own servers" ON servers;
CREATE POLICY "Users can view own servers" ON servers
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert servers" ON servers;
CREATE POLICY "Users can insert servers" ON servers
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own servers" ON servers;
CREATE POLICY "Users can update own servers" ON servers
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own servers" ON servers;
CREATE POLICY "Users can delete own servers" ON servers
  FOR DELETE USING (auth.uid() = user_id);

-- Whitelist policies
DROP POLICY IF EXISTS "Users can view whitelist" ON whitelist;
CREATE POLICY "Users can view whitelist" ON whitelist
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM servers WHERE servers.id = whitelist.server_id AND servers.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can manage whitelist" ON whitelist;
CREATE POLICY "Users can manage whitelist" ON whitelist
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM servers WHERE servers.id = whitelist.server_id AND servers.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can update whitelist" ON whitelist;
CREATE POLICY "Users can update whitelist" ON whitelist
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM servers WHERE servers.id = whitelist.server_id AND servers.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete whitelist" ON whitelist;
CREATE POLICY "Users can delete whitelist" ON whitelist
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM servers WHERE servers.id = whitelist.server_id AND servers.user_id = auth.uid())
  );

-- Backup policies
DROP POLICY IF EXISTS "Users can view backups" ON backups;
CREATE POLICY "Users can view backups" ON backups
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM servers WHERE servers.id = backups.server_id AND servers.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can create backups" ON backups;
CREATE POLICY "Users can create backups" ON backups
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM servers WHERE servers.id = backups.server_id AND servers.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete backups" ON backups;
CREATE POLICY "Users can delete backups" ON backups
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM servers WHERE servers.id = backups.server_id AND servers.user_id = auth.uid())
  );

-- Mod policies
DROP POLICY IF EXISTS "Users can view mods" ON mods;
CREATE POLICY "Users can view mods" ON mods
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM servers WHERE servers.id = mods.server_id AND servers.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can add mods" ON mods;
CREATE POLICY "Users can add mods" ON mods
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM servers WHERE servers.id = mods.server_id AND servers.user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users can delete mods" ON mods;
CREATE POLICY "Users can delete mods" ON mods
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM servers WHERE servers.id = mods.server_id AND servers.user_id = auth.uid())
  );

-- Folder policies
DROP POLICY IF EXISTS "Users can view folders" ON server_folders;
CREATE POLICY "Users can view folders" ON server_folders
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create folders" ON server_folders;
CREATE POLICY "Users can create folders" ON server_folders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete folders" ON server_folders;
CREATE POLICY "Users can delete folders" ON server_folders
  FOR DELETE USING (auth.uid() = user_id);

-- Access card policies
DROP POLICY IF EXISTS "Users can view own access cards" ON access_cards;
CREATE POLICY "Users can view own access cards" ON access_cards
  FOR SELECT USING (
    auth.uid() = owner_id OR auth.uid() = recipient_id
  );

DROP POLICY IF EXISTS "Users can create access cards" ON access_cards;
CREATE POLICY "Users can create access cards" ON access_cards
  FOR INSERT WITH CHECK (
    auth.uid() = owner_id AND
    (SELECT premium FROM users WHERE id = auth.uid()) = true OR
    (SELECT COUNT(*) FROM access_cards WHERE owner_id = auth.uid() AND server_id = access_cards.server_id) < 1
  );

DROP POLICY IF EXISTS "Users can delete own access cards" ON access_cards;
CREATE POLICY "Users can delete own access cards" ON access_cards
  FOR DELETE USING (auth.uid() = owner_id);

-- Auto-create user profile when someone signs up via Supabase Auth
CREATE OR REPLACE FUNCTION public.create_user_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username, premium, theme, custom_color)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1), 'user_' || substr(NEW.id::text, 1, 8)),
    false,
    'default',
    ''
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.create_user_on_signup();

-- Delete own user account (runs with admin privileges)
CREATE OR REPLACE FUNCTION public.delete_my_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- ========================
-- REMOTE ACCESS RELAY TABLES
-- ========================

-- Agent registration (one per machine)
CREATE TABLE IF NOT EXISTS agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  machine_name TEXT DEFAULT '',
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  is_online BOOLEAN DEFAULT false,
  version TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Commands from UI to agent
CREATE TABLE IF NOT EXISTS agent_commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  command_type TEXT NOT NULL,
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE,
  payload JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',
  result JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Console output streamed from agent
CREATE TABLE IF NOT EXISTS agent_console_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  server_id UUID REFERENCES servers(id) ON DELETE CASCADE NOT NULL,
  line TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_console_logs_server ON agent_console_logs(server_id, created_at DESC);

-- Enable RLS
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_console_logs ENABLE ROW LEVEL SECURITY;

-- Agents: user can see own agents
DROP POLICY IF EXISTS "Users can view own agents" ON agents;
CREATE POLICY "Users can view own agents" ON agents
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert agents" ON agents;
CREATE POLICY "Users can insert agents" ON agents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own agents" ON agents;
CREATE POLICY "Users can update own agents" ON agents
  FOR UPDATE USING (auth.uid() = user_id);

-- Commands: user can see own commands, agent can read assigned
DROP POLICY IF EXISTS "Users can view own commands" ON agent_commands;
CREATE POLICY "Users can view own commands" ON agent_commands
  FOR SELECT USING (
    auth.uid() = user_id OR
    auth.uid() IN (SELECT user_id FROM agents WHERE id = agent_commands.agent_id)
  );

DROP POLICY IF EXISTS "Users can insert commands" ON agent_commands;
CREATE POLICY "Users can insert commands" ON agent_commands
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Agents can update own commands" ON agent_commands;
CREATE POLICY "Agents can update own commands" ON agent_commands
  FOR UPDATE USING (
    auth.uid() IN (SELECT user_id FROM agents WHERE id = agent_commands.agent_id)
  );

-- Console logs: user can view, agent can insert
DROP POLICY IF EXISTS "Users can view console logs" ON agent_console_logs;
CREATE POLICY "Users can view console logs" ON agent_console_logs
  FOR SELECT USING (
    auth.uid() = (SELECT user_id FROM servers WHERE id = agent_console_logs.server_id) OR
    auth.uid() IN (SELECT recipient_id FROM access_cards WHERE server_id = agent_console_logs.server_id)
  );

DROP POLICY IF EXISTS "Agents can insert console logs" ON agent_console_logs;
CREATE POLICY "Agents can insert console logs" ON agent_console_logs
  FOR INSERT WITH CHECK (
    auth.uid() IN (SELECT user_id FROM agents WHERE id = agent_console_logs.agent_id)
  );

-- Create a Supabase Realtime publication for relay tables
DROP PUBLICATION IF EXISTS mineserver_relay;
CREATE PUBLICATION mineserver_relay FOR TABLE agents, agent_commands, agent_console_logs;
