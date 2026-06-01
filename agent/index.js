const { createClient } = require('@supabase/supabase-js');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');

const SUPABASE_URL = 'https://pejspqyupuanndshwoxb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_ZFJLxUp0mqVMyAjkhynXTA_Vb8z8mO4';
const CONFIG_PATH = path.join(os.homedir(), '.mineserver', 'agent-config.json');
const SERVERS_PATH = path.join(os.homedir(), '.mineserver', 'servers');
const HEARTBEAT_INTERVAL = 30000;
const POLL_INTERVAL = 3000;

let supabase;
let agentId = null;
let agentUserId = null;
let serverProcesses = {};
let running = true;
let heartbeatTimer = null;

function log(msg) {
  const ts = new Date().toISOString();
  console.log(`[${ts}] ${msg}`);
}

function errorLog(msg) {
  const ts = new Date().toISOString();
  console.error(`[${ts}] ERROR: ${msg}`);
}

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch (e) {
    errorLog('Failed to load config: ' + e.message);
  }
  return null;
}

function saveConfig(config) {
  try {
    const dir = path.dirname(CONFIG_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (e) {
    errorLog('Failed to save config: ' + e.message);
  }
}

async function authenticate() {
  let config = loadConfig();
  if (config && config.access_token && config.refresh_token) {
    log('Found stored session, attempting restore...');
    const { data, error } = await supabase.auth.setSession({
      access_token: config.access_token,
      refresh_token: config.refresh_token
    });
    if (!error && data?.user) {
      log('Session restored for: ' + data.user.email);
      agentUserId = data.user.id;
      return true;
    }
    log('Stored session expired, need re-auth');
  }

  log('No valid session. Authentication required.');
  log('To authenticate, run: node auth.js');
  log('Or place tokens in: ' + CONFIG_PATH);
  log('Format: { "access_token": "...", "refresh_token": "..." }');
  return false;
}

async function registerAgent() {
  if (!agentUserId) return;
  const machineName = os.hostname();

  const { data: existing } = await supabase
    .from('agents')
    .select('id')
    .eq('user_id', agentUserId)
    .eq('machine_name', machineName);

  if (existing && existing.length > 0) {
    agentId = existing[0].id;
    log('Reconnected to existing agent: ' + agentId);
    await supabase.from('agents').update({
      is_online: true,
      last_heartbeat: new Date().toISOString(),
      version: '1.0.0'
    }).eq('id', agentId);
  } else {
    const { data, error } = await supabase.from('agents').insert({
      user_id: agentUserId,
      machine_name: machineName,
      is_online: true,
      version: '1.0.0'
    }).select().single();

    if (error) {
      errorLog('Failed to register agent: ' + error.message);
      return;
    }
    agentId = data.id;
    log('Registered new agent: ' + agentId);
  }
  startHeartbeat();
}

function startHeartbeat() {
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  heartbeatTimer = setInterval(async () => {
    if (!agentId) return;
    try {
      await supabase.from('agents').update({
        is_online: true,
        last_heartbeat: new Date().toISOString()
      }).eq('id', agentId);
    } catch (e) {
      errorLog('Heartbeat failed: ' + e.message);
    }
  }, HEARTBEAT_INTERVAL);
}

async function pollCommands() {
  if (!agentId) return;
  try {
    const { data, error } = await supabase
      .from('agent_commands')
      .select('*')
      .eq('agent_id', agentId)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      errorLog('Poll commands failed: ' + error.message);
      return;
    }

    for (const command of data) {
      await executeCommand(command);
    }
  } catch (e) {
    errorLog('Poll error: ' + e.message);
  }
}

async function executeCommand(cmd) {
  log('Executing command: ' + cmd.command_type + ' for server ' + cmd.server_id);
  try {
    await supabase.from('agent_commands').update({ status: 'running' }).eq('id', cmd.id);

    switch (cmd.command_type) {
      case 'start_server':
        await startServer(cmd);
        break;
      case 'stop_server':
        await stopServer(cmd);
        break;
      case 'restart_server':
        await stopServer(cmd);
        await startServer(cmd);
        break;
      case 'console_command':
        await sendConsoleCommand(cmd);
        break;
      default:
        await supabase.from('agent_commands').update({
          status: 'failed',
          result: { error: 'Unknown command type: ' + cmd.command_type }
        }).eq('id', cmd.id);
    }

    await supabase.from('agent_commands').update({
      status: 'completed',
      completed_at: new Date().toISOString()
    }).eq('id', cmd.id);

  } catch (e) {
    errorLog('Command execution failed: ' + e.message);
    await supabase.from('agent_commands').update({
      status: 'failed',
      result: { error: e.message }
    }).eq('id', cmd.id);
  }
}

async function startServer(cmd) {
  const serverId = cmd.server_id;
  if (serverProcesses[serverId]) {
    throw new Error('Server already running');
  }

  const payload = cmd.payload || {};
  const serverPath = path.join(SERVERS_PATH, serverId);
  const javaPath = payload.java_path || 'java';
  const jarFile = payload.jar_file || 'server.jar';
  const minRam = payload.min_ram || '1G';
  const maxRam = payload.max_ram || '2G';

  if (!fs.existsSync(serverPath)) {
    fs.mkdirSync(serverPath, { recursive: true });
  }

  const args = [`-Xms${minRam}`, `-Xmx${maxRam}`, '-jar', jarFile, 'nogui'];

  log('Starting server ' + serverId + ' with Java: ' + javaPath + ' args: ' + args.join(' '));

  const proc = spawn(javaPath, args, { cwd: serverPath, stdio: ['pipe', 'pipe', 'pipe'] });
  serverProcesses[serverId] = proc;

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l);
    for (const line of lines) {
      streamConsole(serverId, line);
    }
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(l => l);
    for (const line of lines) {
      streamConsole(serverId, '[ERR] ' + line);
    }
  });

  proc.on('close', (code) => {
    delete serverProcesses[serverId];
    streamConsole(serverId, '[Server closed with code ' + code + ']');
    updateServerStatus(serverId, 'stopped');
    log('Server ' + serverId + ' stopped (code: ' + code + ')');
  });

  updateServerStatus(serverId, 'running');
}

async function stopServer(cmd) {
  const serverId = cmd.server_id;
  if (!serverProcesses[serverId]) {
    throw new Error('Server not running');
  }

  log('Stopping server ' + serverId);
  serverProcesses[serverId].stdin.write('stop\n');

  await new Promise((resolve) => {
    setTimeout(() => {
      if (serverProcesses[serverId]) {
        serverProcesses[serverId].kill('SIGKILL');
        delete serverProcesses[serverId];
      }
      resolve();
    }, 10000);
  });

  updateServerStatus(serverId, 'stopped');
}

function sendConsoleCommand(cmd) {
  const serverId = cmd.server_id;
  if (!serverProcesses[serverId]) {
    throw new Error('Server not running');
  }
  const command = cmd.payload?.command || '';
  if (!command) throw new Error('No command provided');
  serverProcesses[serverId].stdin.write(command + '\n');
  streamConsole(serverId, '> ' + command);
}

async function streamConsole(serverId, line) {
  try {
    await supabase.from('agent_console_logs').insert({
      agent_id: agentId,
      server_id: serverId,
      line: line
    });
  } catch (e) {
    // Silently fail for console streaming
  }
}

async function updateServerStatus(serverId, status) {
  try {
    await supabase.from('servers').update({ status }).eq('id', serverId);
  } catch (e) {
    errorLog('Failed to update server status: ' + e.message);
  }
}

async function goOffline() {
  if (agentId) {
    try {
      await supabase.from('agents').update({ is_online: false }).eq('id', agentId);
      log('Agent marked offline');
    } catch (e) {
      errorLog('Failed to go offline: ' + e.message);
    }
  }

  for (const id in serverProcesses) {
    try {
      serverProcesses[id].kill();
      delete serverProcesses[id];
    } catch (e) {}
  }
}

async function main() {
  log('MineServer Agent v1.0.0 starting...');
  log('Machine: ' + os.hostname());

  supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  if (!(await authenticate())) {
    process.exit(1);
  }

  await registerAgent();

  if (!agentId) {
    errorLog('Failed to register agent');
    process.exit(1);
  }

  log('Agent running. Polling for commands...');

  while (running) {
    await pollCommands();
    await new Promise(r => setTimeout(r, POLL_INTERVAL));
  }
}

process.on('SIGINT', async () => {
  log('Shutting down...');
  running = false;
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  await goOffline();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  log('Shutting down...');
  running = false;
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  await goOffline();
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  errorLog('Uncaught exception: ' + err.message);
});

process.on('unhandledRejection', (reason) => {
  errorLog('Unhandled rejection: ' + (reason?.message || reason));
});

main();
