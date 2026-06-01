import { supabase } from './supabase';

type ConsoleCallback = (serverId: string, data: string) => void;
type StoppedCallback = (serverId: string, code: number) => void;

let consoleListeners: ConsoleCallback[] = [];
let stoppedListeners: StoppedCallback[] = [];
let relaySubscriptions: { serverId: string; unsubscribe: () => void }[] = [];

// Auto-detect platform
export function isElectron(): boolean {
  return typeof window !== 'undefined' && !!(window as any).electronAPI;
}

export function getPlatform(): 'electron' | 'web' {
  return isElectron() ? 'electron' : 'web';
}

// ---- RELAY HELPERS ----

let activeAgentId: string | null = null;

export async function findOnlineAgent(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('agents')
    .select('id')
    .eq('user_id', userId)
    .eq('is_online', true)
    .order('last_heartbeat', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id || null;
}

async function createAgentCommand(agentId: string, commandType: string, serverId: string, payload: any = {}) {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new Error('Not authenticated');
  const { error } = await supabase.from('agent_commands').insert({
    agent_id: agentId,
    user_id: user.id,
    command_type: commandType,
    server_id: serverId,
    payload
  });
  if (error) throw error;
}

async function waitForCommandResult(commandId: string, timeoutMs = 30000): Promise<any> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const { data } = await supabase
      .from('agent_commands')
      .select('status, result')
      .eq('id', commandId)
      .single();
    if (!data) break;
    if (data.status === 'completed') return data.result;
    if (data.status === 'failed') throw new Error(data.result?.error || 'Command failed');
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error('Command timed out');
}

function subscribeToConsole(serverId: string) {
  if (!isElectron()) {
    const sub = supabase
      .channel('console-' + serverId)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'agent_console_logs', filter: `server_id=eq.${serverId}` },
        (payload: any) => {
          for (const cb of consoleListeners) {
            cb(serverId, payload.new.line);
          }
        }
      )
      .subscribe();
    relaySubscriptions.push({ serverId, unsubscribe: () => sub.unsubscribe() });
  }
}

// ---- PUBLIC API ----

export async function startServer(
  serverId: string,
  serverPath?: string,
  javaPath?: string,
  jarFile?: string,
  minRam?: string,
  maxRam?: string
): Promise<void> {
  if (isElectron()) {
    const sPath = serverPath || (await (window as any).electronAPI.getServersPath());
    const finalPath = serverPath || `${sPath}\\${serverId}`;
    await (window as any).electronAPI.ensureDir(finalPath);
    await (window as any).electronAPI.startServer(
      serverId, finalPath, javaPath || 'java', jarFile || 'server.jar', minRam || '1G', maxRam || '2G'
    );
  } else {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');
    const agentId = await findOnlineAgent(userId);
    if (!agentId) throw new Error('No online agent found. Start the desktop app first.');
    activeAgentId = agentId;
    const { data, error } = await supabase.from('agent_commands').insert({
      agent_id: agentId,
      user_id: userId,
      command_type: 'start_server',
      server_id: serverId,
      payload: { java_path: javaPath, jar_file: jarFile, min_ram: minRam, max_ram: maxRam }
    }).select().single();
    if (error) throw error;
    subscribeToConsole(serverId);
  }
}

export async function stopServer(serverId: string): Promise<void> {
  if (isElectron()) {
    await (window as any).electronAPI.stopServer(serverId);
  } else {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');
    const agentId = activeAgentId || await findOnlineAgent(userId);
    if (!agentId) throw new Error('No online agent found');
    await createAgentCommand(agentId, 'stop_server', serverId);
  }
}

export async function sendCommand(serverId: string, command: string): Promise<void> {
  if (isElectron()) {
    await (window as any).electronAPI.sendCommand(serverId, command);
  } else {
    const userId = (await supabase.auth.getUser()).data.user?.id;
    if (!userId) throw new Error('Not authenticated');
    const agentId = activeAgentId || await findOnlineAgent(userId);
    if (!agentId) throw new Error('No online agent found');
    await createAgentCommand(agentId, 'console_command', serverId, { command });
  }
}

export async function serverStatus(serverId: string): Promise<{ running: boolean }> {
  if (isElectron()) {
    return (window as any).electronAPI.serverStatus(serverId);
  } else {
    const { data } = await supabase.from('servers').select('status').eq('id', serverId).single();
    return { running: data?.status === 'running' };
  }
}

export async function getServersPath(): Promise<string> {
  if (isElectron()) {
    return (window as any).electronAPI.getServersPath();
  }
  throw new Error('File operations not available in web mode');
}

export async function ensureDir(dirPath: string): Promise<string> {
  if (isElectron()) {
    return (window as any).electronAPI.ensureDir(dirPath);
  }
  throw new Error('File operations not available in web mode');
}

export async function readServerProperties(serverPath: string): Promise<Record<string, string>> {
  if (isElectron()) {
    return (window as any).electronAPI.readServerProperties(serverPath);
  }
  throw new Error('File operations not available in web mode');
}

export async function writeServerProperties(serverPath: string, properties: Record<string, string>): Promise<void> {
  if (isElectron()) {
    return (window as any).electronAPI.writeServerProperties(serverPath, properties);
  }
  throw new Error('File operations not available in web mode');
}

export async function zipDir(sourceDir: string, outputPath: string): Promise<boolean> {
  if (isElectron()) {
    return (window as any).electronAPI.zipDir(sourceDir, outputPath);
  }
  throw new Error('File operations not available in web mode');
}

export async function unzipFile(zipPath: string, outputDir: string): Promise<void> {
  if (isElectron()) {
    return (window as any).electronAPI.unzipFile(zipPath, outputDir);
  }
  throw new Error('File operations not available in web mode');
}

export async function deleteServerFiles(serverPath: string): Promise<boolean> {
  if (isElectron()) {
    return (window as any).electronAPI.deleteServerFiles(serverPath);
  }
  throw new Error('File operations not available in web mode');
}

export async function downloadFile(url: string, destPath: string): Promise<any> {
  if (isElectron()) {
    return (window as any).electronAPI.downloadFile(url, destPath);
  }
  throw new Error('File operations not available in web mode');
}

export async function readFile(filePath: string): Promise<string | null> {
  if (isElectron()) {
    return (window as any).electronAPI.readFile(filePath);
  }
  throw new Error('File operations not available in web mode');
}

export async function writeFile(filePath: string, content: string): Promise<void> {
  if (isElectron()) {
    return (window as any).electronAPI.writeFile(filePath, content);
  }
  throw new Error('File operations not available in web mode');
}

// ---- CONSOLE EVENTS ----

export function onServerConsole(callback: ConsoleCallback): () => void {
  consoleListeners.push(callback);
  if (isElectron()) {
    (window as any).electronAPI.onServerConsole((serverId: string, data: string) => {
      callback(serverId, data);
    });
  }
  return () => {
    consoleListeners = consoleListeners.filter(cb => cb !== callback);
  };
}

export function onServerStopped(callback: StoppedCallback): () => void {
  stoppedListeners.push(callback);
  if (isElectron()) {
    (window as any).electronAPI.onServerStopped((serverId: string, code: number) => {
      callback(serverId, code);
    });
  }
  return () => {
    stoppedListeners = stoppedListeners.filter(cb => cb !== callback);
  };
}

export function cleanupConsoleSubscriptions() {
  for (const sub of relaySubscriptions) {
    sub.unsubscribe();
  }
  relaySubscriptions = [];
}

// ---- AGENT INFO ----

export async function getOnlineAgents(userId: string): Promise<any[]> {
  const { data } = await supabase
    .from('agents')
    .select('id, machine_name, last_heartbeat, version')
    .eq('user_id', userId)
    .eq('is_online', true)
    .order('last_heartbeat', { ascending: false });
  return data || [];
}

// ---- AGENT MANAGEMENT (Electron only) ----

export async function agentStart(): Promise<{ running: boolean }> {
  if (isElectron()) return (window as any).electronAPI.agentStart();
  throw new Error('Agent management requires desktop app');
}

export async function agentStop(): Promise<{ running: boolean }> {
  if (isElectron()) return (window as any).electronAPI.agentStop();
  throw new Error('Agent management requires desktop app');
}

export async function agentStatus(): Promise<{ running: boolean; agentDirExists: boolean }> {
  if (isElectron()) return (window as any).electronAPI.agentStatus();
  return { running: false, agentDirExists: false };
}

export async function checkForUpdates(): Promise<any> {
  if (isElectron()) return (window as any).electronAPI.checkForUpdates();
  return { hasUpdate: false, currentVersion: 'web' };
}
