const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getServersPath: () => ipcRenderer.invoke('get-servers-path'),
  ensureDir: (dirPath) => ipcRenderer.invoke('ensure-dir', dirPath),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  deleteFile: (filePath) => ipcRenderer.invoke('delete-file', filePath),
  listFiles: (dirPath) => ipcRenderer.invoke('list-files', dirPath),
  copyDir: (src, dest) => ipcRenderer.invoke('copy-dir', src, dest),
  zipDir: (sourceDir, outputPath) => ipcRenderer.invoke('zip-dir', sourceDir, outputPath),
  unzipFile: (zipPath, outputDir) => ipcRenderer.invoke('unzip-file', zipPath, outputDir),

  startServer: (serverId, serverPath, javaPath, jarFile, minRam, maxRam) =>
    ipcRenderer.invoke('start-server', serverId, serverPath, javaPath, jarFile, minRam, maxRam),
  stopServer: (serverId) => ipcRenderer.invoke('stop-server', serverId),
  sendCommand: (serverId, command) => ipcRenderer.invoke('send-command', serverId, command),
  serverStatus: (serverId) => ipcRenderer.invoke('server-status', serverId),

  readServerProperties: (serverPath) => ipcRenderer.invoke('read-server-properties', serverPath),
  writeServerProperties: (serverPath, properties) => ipcRenderer.invoke('write-server-properties', serverPath, properties),

  getServerFiles: (serverPath, subDir) => ipcRenderer.invoke('get-server-files', serverPath, subDir),
  deleteServerFiles: (serverPath) => ipcRenderer.invoke('delete-server-files', serverPath),

  downloadFile: (url, destPath) => ipcRenderer.invoke('download-file', url, destPath),

  onServerConsole: (callback) => {
    ipcRenderer.on('server-console', (event, serverId, data) => callback(serverId, data));
  },
  onServerStopped: (callback) => {
    ipcRenderer.on('server-stopped', (event, serverId, code) => callback(serverId, code));
  },

  openOAuthWindow: (oauthUrl) => ipcRenderer.invoke('oauth-signin-browser', oauthUrl),
  openOAuthInBrowser: (oauthUrl) => ipcRenderer.invoke('oauth-external-browser', oauthUrl),

  // Agent management
  agentStart: () => ipcRenderer.invoke('agent-start'),
  agentStop: () => ipcRenderer.invoke('agent-stop'),
  agentStatus: () => ipcRenderer.invoke('agent-status'),
  agentPath: () => ipcRenderer.invoke('agent-path'),

  // Updates
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),

  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
});
