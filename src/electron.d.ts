interface ElectronAPI {
  getUserDataPath(): Promise<string>;
  getAppPath(): Promise<string>;
  getServersPath(): Promise<string>;
  ensureDir(dirPath: string): Promise<string>;
  readFile(filePath: string): Promise<string | null>;
  writeFile(filePath: string, content: string): Promise<boolean>;
  deleteFile(filePath: string): Promise<boolean>;
  listFiles(dirPath: string): Promise<string[]>;
  copyDir(src: string, dest: string): Promise<boolean>;
  zipDir(sourceDir: string, outputPath: string): Promise<boolean>;
  unzipFile(zipPath: string, outputDir: string): Promise<boolean>;

  startServer(serverId: string, serverPath: string, javaPath: string, jarFile: string, minRam: string, maxRam: string): Promise<{ success?: boolean; error?: string; pid?: number }>;
  stopServer(serverId: string): Promise<{ success?: boolean; error?: string }>;
  sendCommand(serverId: string, command: string): Promise<{ success?: boolean; error?: string }>;
  serverStatus(serverId: string): Promise<{ running: boolean }>;

  readServerProperties(serverPath: string): Promise<Record<string, string>>;
  writeServerProperties(serverPath: string, properties: Record<string, string>): Promise<boolean>;

  getServerFiles(serverPath: string, subDir?: string): Promise<{ name: string; isDirectory: boolean; path: string; size: number }[]>;
  deleteServerFiles(serverPath: string): Promise<boolean>;

  downloadFile(url: string, destPath: string): Promise<{ success: boolean; path: string }>;

  onServerConsole(callback: (serverId: string, data: string) => void): void;
  onServerStopped(callback: (serverId: string, code: number) => void): void;

  openOAuthWindow(oauthUrl: string): Promise<{ access_token: string; refresh_token: string }>;
  openOAuthInBrowser(oauthUrl: string): Promise<{ access_token: string; refresh_token: string }>;

  // Agent management
  agentStart(): Promise<{ running: boolean }>;
  agentStop(): Promise<{ running: boolean }>;
  agentStatus(): Promise<{ running: boolean; agentDirExists: boolean }>;
  agentPath(): Promise<string>;

  // Updates
  checkForUpdates(): Promise<{ hasUpdate: boolean; currentVersion: string; latestVersion?: string; url?: string; error?: string }>;

  minimizeWindow(): void;
  maximizeWindow(): void;
  closeWindow(): void;
}

interface Window {
  electronAPI: ElectronAPI;
}
