import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://pejspqyupuanndshwoxb.supabase.co';
const supabaseKey = 'sb_publishable_ZFJLxUp0mqVMyAjkhynXTA_Vb8z8mO4';

export const supabase = createClient(supabaseUrl, supabaseKey);

export interface UserData {
  id: string;
  email: string;
  username: string;
  premium: boolean;
  theme: string;
  custom_color: string;
  created_at: string;
}

export interface ServerData {
  id: string;
  user_id: string;
  name: string;
  description: string;
  domain: string;
  loader: string;
  version: string;
  visibility: string;
  status: string;
  created_at: string;
  expires_at: string;
  min_ram: string;
  max_ram: string;
  java_path: string;
}

export interface WhitelistEntry {
  id: string;
  server_id: string;
  username: string;
  permission: string;
  added_at: string;
}

export interface BackupData {
  id: string;
  server_id: string;
  name: string;
  created_at: string;
  size: number;
  url: string;
}

export interface ModData {
  id: string;
  server_id: string;
  name: string;
  source: string;
  url: string;
  filename: string;
  installed_at: string;
}

export async function signInWithMicrosoft() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'azure',
    options: { redirectTo: `https://pejspqyupuanndshwoxb.supabase.co/auth/v1/callback` }
  });
  if (error) throw error;
  return data;
}

export async function signInWithDiscord(): Promise<void> {
  const isElectron = typeof window !== 'undefined' && !!(window as any).electronAPI;

  if (isElectron) {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        skipBrowserRedirect: true,
        redirectTo: 'http://localhost:5342/'
      }
    });
    if (error) throw error;
    if (!data?.url) throw new Error('Failed to get OAuth URL');

    const tokens = await (window as any).electronAPI.openOAuthInBrowser(data.url);
    if (tokens.access_token && tokens.refresh_token) {
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token
      });
      if (sessionError) throw sessionError;
    }
  } else {
    // Web: standard OAuth redirect flow
    const basePath = window.location.hostname.includes('github.io') ? '/mineserver/' : '/';
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'discord',
      options: {
        redirectTo: window.location.origin + basePath
      }
    });
    if (error) throw error;
  }
}

export async function signUpLocal(username: string, password: string) {
  const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}@mineserver.local`;
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username, provider: 'local' } }
  });
  if (error) {
    if (error.message.includes('already registered')) {
      throw new Error('Username already taken');
    }
    throw error;
  }
  return data;
}

export async function signInLocal(username: string, password: string) {
  const email = `${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}@mineserver.local`;
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.message.includes('Invalid login')) {
      throw new Error('Invalid username or password');
    }
    throw error;
  }
  return data;
}

export async function signUp(email: string, password: string, username: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { username } }
  });
  if (error) throw error;
  return data;
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getCurrentUser(): Promise<UserData | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase.from('users').select('*').eq('id', user.id).single();
  return data;
}

export async function updateUserTheme(userId: string, theme: string, customColor: string) {
  const { error } = await supabase.from('users').update({ theme, custom_color: customColor }).eq('id', userId);
  if (error) throw error;
}

export async function setPremium(userId: string, premium: boolean) {
  const { error } = await supabase.from('users').update({ premium }).eq('id', userId);
  if (error) throw error;
}

export async function createServer(server: Omit<ServerData, 'id' | 'created_at' | 'expires_at' | 'status'>) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase.from('servers').insert([
    { ...server, status: 'stopped', expires_at: expiresAt }
  ]).select().single();
  if (error) throw error;

  await supabase.from('server_folders').insert([
    { server_id: data.id, user_id: server.user_id }
  ]);

  return data;
}

export async function getServers(userId: string): Promise<ServerData[]> {
  const { data, error } = await supabase.from('servers').select('*').eq('user_id', userId);
  if (error) throw error;
  return data || [];
}

export async function getServer(serverId: string): Promise<ServerData | null> {
  const { data, error } = await supabase.from('servers').select('*').eq('id', serverId).single();
  if (error) throw error;
  return data;
}

export async function updateServer(serverId: string, updates: Partial<ServerData>) {
  const { error } = await supabase.from('servers').update(updates).eq('id', serverId);
  if (error) throw error;
}

export async function deleteServer(serverId: string) {
  await supabase.from('whitelist').delete().eq('server_id', serverId);
  await supabase.from('backups').delete().eq('server_id', serverId);
  await supabase.from('mods').delete().eq('server_id', serverId);
  await supabase.from('server_folders').delete().eq('server_id', serverId);
  const { error } = await supabase.from('servers').delete().eq('id', serverId);
  if (error) throw error;
}

export async function renewServer(serverId: string) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { error } = await supabase.from('servers').update({ expires_at: expiresAt }).eq('id', serverId);
  if (error) throw error;
}

export async function getWhitelist(serverId: string): Promise<WhitelistEntry[]> {
  const { data, error } = await supabase.from('whitelist').select('*').eq('server_id', serverId);
  if (error) throw error;
  return data || [];
}

export async function addWhitelist(serverId: string, username: string, permission: string = 'member') {
  const { data, error } = await supabase.from('whitelist').insert([
    { server_id: serverId, username, permission }
  ]).select().single();
  if (error) throw error;
  return data;
}

export async function updateWhitelist(id: string, permission: string) {
  const { error } = await supabase.from('whitelist').update({ permission }).eq('id', id);
  if (error) throw error;
}

export async function removeWhitelist(id: string) {
  const { error } = await supabase.from('whitelist').delete().eq('id', id);
  if (error) throw error;
}

export async function checkUserPremium(username: string): Promise<boolean> {
  const { data } = await supabase.from('users').select('premium').eq('username', username).maybeSingle();
  return data?.premium || false;
}

export async function createBackup(serverId: string, name: string, size: number, url: string) {
  const { data, error } = await supabase.from('backups').insert([
    { server_id: serverId, name, size, url }
  ]).select().single();
  if (error) throw error;
  return data;
}

export async function getBackups(serverId: string): Promise<BackupData[]> {
  const { data, error } = await supabase.from('backups').select('*').eq('server_id', serverId).order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function deleteBackup(id: string) {
  const { error } = await supabase.from('backups').delete().eq('id', id);
  if (error) throw error;
}

export async function addMod(serverId: string, name: string, source: string, url: string, filename: string) {
  const { data, error } = await supabase.from('mods').insert([
    { server_id: serverId, name, source, url, filename }
  ]).select().single();
  if (error) throw error;
  return data;
}

export async function getMods(serverId: string): Promise<ModData[]> {
  const { data, error } = await supabase.from('mods').select('*').eq('server_id', serverId);
  if (error) throw error;
  return data || [];
}

export async function deleteMod(id: string) {
  const { error } = await supabase.from('mods').delete().eq('id', id);
  if (error) throw error;
}

export async function getModCount(serverId: string): Promise<number> {
  const { count, error } = await supabase.from('mods').select('*', { count: 'exact', head: true }).eq('server_id', serverId);
  if (error) throw error;
  return count || 0;
}

export interface AccessCardData {
  id: string;
  server_id: string;
  owner_id: string;
  recipient_id: string;
  recipient_username: string;
  created_at: string;
}

export async function getAccessCards(serverId: string): Promise<AccessCardData[]> {
  const { data, error } = await supabase.from('access_cards').select('*').eq('server_id', serverId);
  if (error) throw error;
  return data || [];
}

export async function addAccessCard(serverId: string, ownerId: string, recipientUsername: string, recipientId: string) {
  const { data, error } = await supabase.from('access_cards').insert([
    { server_id: serverId, owner_id: ownerId, recipient_id: recipientId, recipient_username: recipientUsername }
  ]).select().single();
  if (error) throw error;
  return data;
}

export async function removeAccessCard(id: string) {
  const { error } = await supabase.from('access_cards').delete().eq('id', id);
  if (error) throw error;
}

export async function findUserByUsername(username: string): Promise<UserData | null> {
  const { data, error } = await supabase.from('users').select('*').ilike('username', username);
  if (error) throw error;
  return data && data.length > 0 ? data[0] : null;
}

export async function getReceivedAccessCards(userId: string): Promise<(AccessCardData & { server_name: string; server_domain: string; owner_username: string })[]> {
  const cards = await getAccessCardsForRecipient(userId);
  const enriched = await Promise.all(cards.map(async (card) => {
    const serverResult = await supabase.from('servers').select('name, domain').eq('id', card.server_id).single();
    const ownerResult = await supabase.from('users').select('username').eq('id', card.owner_id).single();
    return {
      ...card,
      server_name: serverResult.data?.name || '',
      server_domain: serverResult.data?.domain || '',
      owner_username: ownerResult.data?.username || '',
    };
  }));
  return enriched;
}

export async function getAccessCardsForRecipient(userId: string): Promise<AccessCardData[]> {
  const { data, error } = await supabase.from('access_cards').select('*').eq('recipient_id', userId);
  if (error) throw error;
  return data || [];
}

export async function updateUsername(userId: string, newUsername: string) {
  const { error } = await supabase.from('users').update({ username: newUsername }).eq('id', userId);
  if (error) throw error;
}

export async function transferServers(serverIds: string[], newOwnerId: string) {
  const { error } = await supabase.from('servers').update({ user_id: newOwnerId }).in('id', serverIds);
  if (error) throw error;
}

export async function deleteMyAccount(userId: string) {
  const { error } = await supabase.rpc('delete_my_user');
  if (error) throw error;
}

export interface StoredAccount {
  id: string;
  username: string;
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

export function getStoredAccounts(): StoredAccount[] {
  try {
    const raw = localStorage.getItem('mineserver_accounts');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function storeAccount(account: StoredAccount) {
  const accounts = getStoredAccounts().filter(a => a.id !== account.id);
  accounts.push(account);
  localStorage.setItem('mineserver_accounts', JSON.stringify(accounts));
}

export function removeStoredAccount(userId: string) {
  const accounts = getStoredAccounts().filter(a => a.id !== userId);
  localStorage.setItem('mineserver_accounts', JSON.stringify(accounts));
}

export function getActiveAccountIndex(): number {
  const idx = localStorage.getItem('mineserver_active_account');
  return idx ? parseInt(idx) : -1;
}

export function setActiveAccountIndex(idx: number) {
  localStorage.setItem('mineserver_active_account', idx.toString());
}

export async function switchToAccount(account: StoredAccount) {
  const { error } = await supabase.auth.setSession({
    access_token: account.access_token,
    refresh_token: account.refresh_token
  });
  if (error) throw error;
}

export function getCurrentSession() {
  return supabase.auth.getSession();
}

export async function getSessionTokens() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;
  return {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  };
}
