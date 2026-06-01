const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, dialog } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');

let mainWindow;
let serverProcesses = {};
let agentProcess = null;
let tray = null;

// Determine which build to load
const useWebBuild = process.argv.includes('--web');
const buildDir = useWebBuild ? path.join(__dirname, '..', 'build-web') : path.join(__dirname, '..', 'build');
const isWebMode = useWebBuild || !fs.existsSync(path.join(__dirname, '..', 'build', 'index.html'));

function getLoadPath() {
  if (isWebMode && fs.existsSync(path.join(buildDir, 'index.html'))) {
    return path.join(buildDir, 'index.html');
  }
  return path.join(__dirname, '..', 'build', 'index.html');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 700,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f0f0f',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
  });

  mainWindow.loadFile(getLoadPath());

  if (isWebMode) {
    mainWindow.on('page-title-updated', (e) => e.preventDefault());
  }
}

app.whenReady().then(() => {
  createWindow();
  tryStartAgent();
});

app.on('window-all-closed', () => {
  for (const id in serverProcesses) {
    serverProcesses[id].kill();
  }
  if (agentProcess) { agentProcess.kill(); agentProcess = null; }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ---- AGENT MANAGEMENT ----

const AGENT_DIR = path.join(__dirname, '..', 'agent');

function tryStartAgent() {
  const agentMain = path.join(AGENT_DIR, 'index.js');
  const agentExe = path.join(AGENT_DIR, 'mineserver-agent.exe');
  const agentToRun = fs.existsSync(agentExe) ? agentExe : agentMain;

  if (!fs.existsSync(agentToRun)) {
    if (!fs.existsSync(agentMain)) return; // No agent installed
  }

  if (agentProcess) return; // Already running

  try {
    if (agentToRun.endsWith('.exe')) {
      agentProcess = spawn(agentToRun, [], { cwd: AGENT_DIR, stdio: 'ignore', detached: false });
    } else {
      const nodePath = process.execPath; // Use Electron's Node
      agentProcess = spawn(nodePath, [agentMain], { cwd: AGENT_DIR, stdio: 'ignore', detached: false });
    }

    agentProcess.on('exit', (code) => {
      console.log('Agent exited with code:', code);
      agentProcess = null;
    });

    console.log('Agent started');
  } catch (e) {
    console.error('Failed to start agent:', e.message);
  }
}

function stopAgent() {
  if (agentProcess) {
    agentProcess.kill();
    agentProcess = null;
    console.log('Agent stopped');
  }
}

function restartAgent() {
  stopAgent();
  setTimeout(() => tryStartAgent(), 1000);
}

// IPC handlers for agent management
ipcMain.handle('agent-start', () => {
  tryStartAgent();
  return { running: !!agentProcess };
});

ipcMain.handle('agent-stop', () => {
  stopAgent();
  return { running: false };
});

ipcMain.handle('agent-status', () => {
  return {
    running: !!agentProcess,
    agentDirExists: fs.existsSync(AGENT_DIR),
  };
});

ipcMain.handle('agent-path', () => {
  return AGENT_DIR;
});

// ---- AUTO-UPDATER ----

const https = require('https');
const UPDATER_URL = 'https://api.github.com/repos/YOUR_USER/mineserver/releases/latest';
const APP_VERSION = '1.0.0';

ipcMain.handle('check-for-updates', async () => {
  return new Promise((resolve) => {
    https.get(UPDATER_URL, {
      headers: { 'User-Agent': 'MineServer', 'Accept': 'application/json' }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const release = JSON.parse(body);
          const latest = release.tag_name.replace(/^v/, '');
          resolve({
            hasUpdate: latest !== APP_VERSION,
            currentVersion: APP_VERSION,
            latestVersion: latest,
            url: release.html_url,
          });
        } catch (e) {
          resolve({ hasUpdate: false, currentVersion: APP_VERSION, error: e.message });
        }
      });
    }).on('error', (e) => {
      resolve({ hasUpdate: false, currentVersion: APP_VERSION, error: e.message });
    });
  });
});

// ---- ORIGINAL IPC ----

ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('get-app-path', () => {
  return app.getAppPath();
});

ipcMain.handle('get-servers-path', () => {
  const serversPath = path.join(app.getPath('userData'), 'servers');
  if (!fs.existsSync(serversPath)) fs.mkdirSync(serversPath, { recursive: true });
  return serversPath;
});

ipcMain.handle('ensure-dir', (event, dirPath) => {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
});

ipcMain.handle('read-file', (event, filePath) => {
  if (fs.existsSync(filePath)) return fs.readFileSync(filePath, 'utf-8');
  return null;
});

ipcMain.handle('write-file', (event, filePath, content) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  return true;
});

ipcMain.handle('delete-file', (event, filePath) => {
  if (fs.existsSync(filePath)) {
    fs.rmSync(filePath, { recursive: true, force: true });
    return true;
  }
  return false;
});

ipcMain.handle('list-files', (event, dirPath) => {
  if (fs.existsSync(dirPath)) return fs.readdirSync(dirPath);
  return [];
});

ipcMain.handle('copy-dir', (event, src, dest) => {
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.cpSync(srcPath, destPath, { recursive: true });
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
  return true;
});

ipcMain.handle('zip-dir', (event, sourceDir, outputPath) => {
  const archiver = require('archiver');
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', { zlib: { level: 9 } });
    output.on('close', () => resolve(true));
    archive.on('error', (err) => reject(err));
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
});

ipcMain.handle('unzip-file', (event, zipPath, outputDir) => {
  const extract = require('extract-zip');
  return extract(zipPath, { dir: outputDir });
});

ipcMain.handle('start-server', async (event, serverId, serverPath, javaPath, jarFile, minRam, maxRam) => {
  if (serverProcesses[serverId]) {
    return { error: 'Server already running' };
  }

  const javaCmd = javaPath || 'java';
  const jar = jarFile || 'server.jar';
  const min = minRam || '1G';
  const max = maxRam || '2G';

  const args = [
    `-Xms${min}`, `-Xmx${max}`,
    '-jar', jar,
    'nogui'
  ];

  try {
    serverProcesses[serverId] = spawn(javaCmd, args, {
      cwd: serverPath,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const proc = serverProcesses[serverId];

    proc.stdout.on('data', (data) => {
      if (mainWindow) mainWindow.webContents.send('server-console', serverId, data.toString());
    });

    proc.stderr.on('data', (data) => {
      if (mainWindow) mainWindow.webContents.send('server-console', serverId, data.toString());
    });

    proc.on('close', (code) => {
      delete serverProcesses[serverId];
      if (mainWindow) mainWindow.webContents.send('server-stopped', serverId, code);
    });

    return { success: true, pid: proc.pid };
  } catch (err) {
    return { error: err.message };
  }
});

ipcMain.handle('stop-server', (event, serverId) => {
  if (serverProcesses[serverId]) {
    serverProcesses[serverId].stdin.write('stop\n');
    setTimeout(() => {
      if (serverProcesses[serverId]) {
        serverProcesses[serverId].kill('SIGKILL');
        delete serverProcesses[serverId];
      }
    }, 10000);
    return { success: true };
  }
  return { error: 'Server not running' };
});

ipcMain.handle('send-command', (event, serverId, command) => {
  if (serverProcesses[serverId]) {
    serverProcesses[serverId].stdin.write(command + '\n');
    return { success: true };
  }
  return { error: 'Server not running' };
});

ipcMain.handle('server-status', (event, serverId) => {
  return { running: !!serverProcesses[serverId] };
});

ipcMain.handle('write-server-properties', async (event, serverPath, properties) => {
  const propsPath = path.join(serverPath, 'server.properties');
  let content = '';
  for (const [key, value] of Object.entries(properties)) {
    content += `${key}=${value}\n`;
  }
  fs.writeFileSync(propsPath, content, 'utf-8');
  return true;
});

ipcMain.handle('read-server-properties', async (event, serverPath) => {
  const propsPath = path.join(serverPath, 'server.properties');
  if (!fs.existsSync(propsPath)) return {};
  const content = fs.readFileSync(propsPath, 'utf-8');
  const props = {};
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const eqIdx = trimmed.indexOf('=');
      props[trimmed.substring(0, eqIdx)] = trimmed.substring(eqIdx + 1);
    }
  }
  return props;
});

ipcMain.handle('get-server-files', async (event, serverPath, subDir) => {
  const target = subDir ? path.join(serverPath, subDir) : serverPath;
  if (!fs.existsSync(target)) return [];
  const entries = fs.readdirSync(target, { withFileTypes: true });
  return entries.map(e => ({
    name: e.name,
    isDirectory: e.isDirectory(),
    path: path.join(target, e.name),
    size: e.isDirectory() ? 0 : fs.statSync(path.join(target, e.name)).size,
  }));
});

ipcMain.handle('delete-server-files', async (event, serverPath) => {
  if (fs.existsSync(serverPath)) {
    fs.rmSync(serverPath, { recursive: true, force: true });
    return true;
  }
  return false;
});

const { net, shell } = require('electron');
const http = require('http');
const { URL } = require('url');

let authWindow = null;
let oauthServer = null;

ipcMain.handle('oauth-signin-browser', async (event, oauthUrl) => {
  return new Promise((resolve, reject) => {
    if (authWindow) { authWindow.close(); }
    authWindow = new BrowserWindow({
      width: 800, height: 700,
      title: 'Discord Sign In',
      show: true,
      webPreferences: { nodeIntegration: false, contextIsolation: true }
    });
    authWindow.loadURL(oauthUrl);

    const checkUrl = (url) => {
      if (!url || url === 'about:blank') return false;
      const accessMatch = url.match(/access_token=([^&]+)/);
      const refreshMatch = url.match(/refresh_token=([^&]+)/);
      if (accessMatch && refreshMatch) {
        resolve({ access_token: accessMatch[1], refresh_token: refreshMatch[1] });
        if (authWindow) { authWindow.close(); authWindow = null; }
        return true;
      }
      if (url.includes('error=')) {
        const errMatch = url.match(/error_description=([^&]+)/);
        if (errMatch) reject(decodeURIComponent(errMatch[1]));
      }
      return false;
    };

    authWindow.webContents.on('will-redirect', (e, url) => checkUrl(url));
    authWindow.webContents.on('will-navigate', (e, url) => checkUrl(url));
    authWindow.webContents.on('did-navigate', (e, url) => checkUrl(url));
    authWindow.webContents.on('did-finish-load', () => {
      checkUrl(authWindow.webContents.getURL());
    });
    authWindow.webContents.on('did-fail-load', (e, errorCode, errorDescription, validatedUrl) => {
      checkUrl(validatedUrl);
    });
    authWindow.on('closed', () => {
      authWindow = null;
      reject(new Error('Sign in window was closed'));
    });
  });
});

ipcMain.handle('oauth-external-browser', async (event, oauthUrl) => {
  return new Promise((resolve, reject) => {
    const port = 5342;

    if (oauthServer) { oauthServer.close(); oauthServer = null; }

    oauthServer = http.createServer((req, res) => {
      const parsedUrl = new URL(req.url, `http://localhost:${port}`);

      if (parsedUrl.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`<!DOCTYPE html>
<html>
<body>
<script>
(function(){
  var hash = window.location.hash.substring(1);
  if (hash && hash.indexOf('access_token=') !== -1) {
    var xhr = new XMLHttpRequest();
    xhr.open('POST', '/token', true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onload = function() {
      document.body.innerHTML = '<h2 style="font-family:sans-serif;text-align:center;padding-top:100px">\\u2705 Authentication complete! You can close this tab.</h2>';
    };
    xhr.send(JSON.stringify({ hash: hash }));
  }
})();
</script>
</body>
</html>`);
        return;
      }

      if (parsedUrl.pathname === '/token') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
          try {
            const { hash } = JSON.parse(body);
            const params = new URLSearchParams(hash);
            const access_token = params.get('access_token');
            const refresh_token = params.get('refresh_token');
            if (access_token && refresh_token) {
              resolve({ access_token, refresh_token });
              res.writeHead(200);
              res.end('ok');
              if (oauthServer) { oauthServer.close(); oauthServer = null; }
            } else {
              res.writeHead(400);
              res.end('missing tokens');
            }
          } catch (e) {
            res.writeHead(400);
            res.end('parse error');
          }
        });
        return;
      }

      res.writeHead(404);
      res.end('not found');
    });

    oauthServer.listen(port, () => {
      shell.openExternal(oauthUrl);
    });

    setTimeout(() => {
      if (oauthServer) { oauthServer.close(); oauthServer = null; }
      reject(new Error('Authentication timed out'));
    }, 300000);
  });
});

ipcMain.handle('download-file', async (event, url, destPath) => {
  return new Promise((resolve, reject) => {
    const dir = path.dirname(destPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const file = fs.createWriteStream(destPath);
    const request = net.request(url);
    request.on('response', (response) => {
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve({ success: true, path: destPath });
      });
    });
    request.on('error', (err) => {
      reject({ error: err.message });
    });
    request.end();
  });
});
