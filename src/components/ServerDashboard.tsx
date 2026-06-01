import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserData, ServerData, getServer, updateServer, deleteServer, renewServer,
  getWhitelist, addWhitelist, updateWhitelist, removeWhitelist,
  getBackups, createBackup, deleteBackup, BackupData,
  getMods, addMod, deleteMod, ModData, getModCount,
  checkUserPremium, setPremium } from '../services/supabase';
import * as backend from '../services/backend';
import { JAVA_LOADERS, BEDROCK_VERSIONS, getVersionsForLoader, searchModrinth, searchCurseForge } from '../services/versions';

const NAV_ITEMS = [
  { id: 'startup', label: 'Startup', icon: '▶️' },
  { id: 'properties', label: 'Properties', icon: '⚙️' },
  { id: 'stfs', label: 'STFS', icon: '📁' },
  { id: 'versions', label: 'Versions', icon: '🔄' },
  { id: 'console', label: 'Console', icon: '💻' },
  { id: 'mods', label: 'Mods', icon: '🧩' },
  { id: 'backups', label: 'Backups', icon: '💾' },
  { id: 'access', label: 'Access Cards', icon: '🪪' },
  { id: 'settings', label: 'Settings', icon: '🔧' },
];

interface Props {
  user: UserData;
  serverId: string;
  onBack: () => void;
  onLogout: () => void;
  onThemeChange: (theme: string, customColor: string) => void;
}

export default function ServerDashboard({ user, serverId, onBack, onLogout, onThemeChange }: Props) {
  const [server, setServer] = useState<ServerData | null>(null);
  const [activeNav, setActiveNav] = useState('startup');
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadServer(); }, [serverId]);

  async function loadServer() {
    try {
      const s = await getServer(serverId);
      setServer(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (!server) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)' }}>
        <div className="empty-state">
          <div className="empty-state-icon">⚠️</div>
          <div className="empty-state-text">Server not found</div>
          <button className="btn btn-primary mt-4" onClick={onBack}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div className="titlebar">
          <div className="titlebar-title">
            <span style={{ color: '#f59e0b' }}>◆</span> {server.name}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="badge badge-info">{server.loader} {server.version}</span>
            <span className={`badge ${server.status === 'running' ? 'badge-success' : 'badge-info'}`}>
              {server.status === 'running' ? '● Online' : '○ Offline'}
            </span>
          </div>
        </div>

      <div className="dashboard-layout">
        <div className="dashboard-nav">
          <div className="dashboard-nav-header">
            <h3>{server.name}</h3>
            <p>{server.domain}.mineserver.me</p>
          </div>
          {NAV_ITEMS.map(item => (
            <div key={item.id}
              className={`dashboard-nav-item ${activeNav === item.id ? 'active' : ''}`}
              onClick={() => setActiveNav(item.id)}>
              <span>{item.icon}</span> {item.label}
            </div>
          ))}
          <div className="dashboard-nav-item" onClick={onBack}
            style={{ color: 'var(--accent)', marginTop: 8 }}>
            <span>◀</span> My Servers
          </div>
        </div>

        <div className="dashboard-content">
          {activeNav === 'startup' && <StartupPanel server={server} onServerUpdate={loadServer} />}
          {activeNav === 'properties' && <PropertiesPanel server={server} />}
          {activeNav === 'stfs' && <STFSPanel server={server} />}
          {activeNav === 'versions' && <VersionsPanel server={server} onServerUpdate={loadServer} />}
          {activeNav === 'console' && <ConsolePanel server={server} />}
          {activeNav === 'mods' && <ModsPanel server={server} user={user} />}
          {activeNav === 'backups' && <BackupsPanel server={server} />}
          {activeNav === 'access' && <AccessCardsPanel server={server} user={user} />}
          {activeNav === 'settings' && <SettingsPanel server={server} user={user}
            onServerUpdate={loadServer} onBack={onBack} />}
        </div>
      </div>
    </div>
  );
}

function StartupPanel({ server, onServerUpdate }: { server: ServerData; onServerUpdate: () => void }) {
  const [status, setStatus] = useState<'stopped' | 'running' | 'starting'>('stopped');
  const [daysLeft, setDaysLeft] = useState(7);

  useEffect(() => {
    const diff = new Date(server.expires_at).getTime() - Date.now();
    setDaysLeft(Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24))));
  }, [server]);

  async function handleStart() {
    setStatus('starting');
    try {
      const sPath = await backend.getServersPath();
      const serverPath = `${sPath}\\${server.id}`;
      await backend.ensureDir(serverPath);
      await backend.startServer(server.id, serverPath, server.java_path || 'java',
        'server.jar', server.min_ram || '1G', server.max_ram || '2G');
      setStatus('running');
      await updateServer(server.id, { status: 'running' });
      onServerUpdate();
    } catch (err) {
      setStatus('stopped');
    }
  }

  async function handleStop() {
    try {
      await backend.stopServer(server.id);
      setStatus('stopped');
      await updateServer(server.id, { status: 'stopped' });
      onServerUpdate();
    } catch (err) {
      console.error(err);
    }
  }

  async function handleRenew() {
    try {
      await renewServer(server.id);
      const diff = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).getTime() - Date.now();
      setDaysLeft(Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24))));
      onServerUpdate();
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div>
      <h1 className="page-title">Server Startup</h1>
      <div className="grid-3 mb-4">
        <div className="card">
          <div className="card-title">Status</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 12, height: 12, borderRadius: '50%',
              background: status === 'running' ? 'var(--success)' : status === 'starting' ? 'var(--warning)' : 'var(--text-secondary)',
              animation: status === 'starting' ? 'pulse 1s infinite' : 'none'
            }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>
              {status === 'running' ? 'Running' : status === 'starting' ? 'Starting...' : 'Stopped'}
            </span>
          </div>
          <div className="flex-gap mt-4">
            {status !== 'running' ? (
              <button className="btn btn-success" onClick={handleStart} disabled={status === 'starting'}>▶ Start</button>
            ) : (
              <button className="btn btn-danger" onClick={handleStop}>■ Stop</button>
            )}
          </div>
        </div>
        <div className="card">
          <div className="card-title">Server Info</div>
          <div style={{ fontSize: 13, lineHeight: 2 }}>
            <div><span className="text-secondary">Loader:</span> {server.loader}</div>
            <div><span className="text-secondary">Version:</span> {server.version}</div>
            <div><span className="text-secondary">Domain:</span> {server.domain}.mineserver.me</div>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Server Timeout</div>
          <div style={{ textAlign: 'center', padding: '12px 0' }}>
            <div style={{ fontSize: 36, fontWeight: 700, color: daysLeft <= 1 ? 'var(--danger)' : daysLeft <= 3 ? 'var(--warning)' : 'var(--text-primary)' }}>
              {daysLeft}
            </div>
            <div className="text-secondary">days remaining</div>
            <button className="btn btn-warning btn-sm mt-4" onClick={handleRenew}>Renew (7 more days)</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PropertiesPanel({ server }: { server: ServerData }) {
  const [properties, setProperties] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { loadProps(); }, []);

  async function loadProps() {
    try {
      const sPath = await backend.getServersPath();
      const serverPath = `${sPath}\\${server.id}`;
      const props = await backend.readServerProperties(serverPath);
      setProperties(Object.keys(props).length > 0 ? props : getDefaultProps());
    } catch (err) {
      setProperties(getDefaultProps());
    } finally {
      setLoading(false);
    }
  }

  function getDefaultProps(): Record<string, string> {
    return {
      'gamemode': 'survival',
      'difficulty': 'easy',
      'max-players': '20',
      'spawn-protection': '16',
      'pvp': 'true',
      'allow-flight': 'false',
      'online-mode': 'true',
      'motd': 'A MineServer',
      'view-distance': '10',
      'server-port': '25565',
      'enable-command-block': 'false',
      'white-list': server.visibility === 'private' ? 'true' : 'false',
      'max-world-size': '29999984',
      'spawn-animals': 'true',
      'spawn-monsters': 'true',
      'spawn-npcs': 'true',
      'enable-query': 'false',
      'enable-rcon': 'false',
      'hardcore': 'false',
      'network-compression-threshold': '256',
    };
  }

  async function handleSave() {
    setSaving(true);
    try {
      const sPath = await backend.getServersPath();
      const serverPath = `${sPath}\\${server.id}`;
      await backend.writeServerProperties(serverPath, properties);
      setToast('Properties saved! Restart server to apply changes.');
    } catch (err: any) {
      setToast('Error: ' + err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setToast(''), 3000);
    }
  }

  function updateProp(key: string, value: string) {
    setProperties({ ...properties, [key]: value });
  }

  if (loading) return <div className="flex-center" style={{ padding: 40 }}><div className="spinner" /></div>;

  return (
    <div>
      <h1 className="page-title">Server Properties</h1>
      {toast && <div className={`toast toast-${toast.includes('Error') ? 'error' : 'success'}`}>{toast}</div>}
      <div className="card">
        <p className="text-secondary mb-4">Server must be stopped to edit properties.</p>
        <div className="properties-grid">
          {Object.entries(properties).map(([key, value]) => (
            <div key={key} className="prop-item">
              <label>{key}</label>
              {['gamemode', 'difficulty'].includes(key) ? (
                <select value={value} onChange={(e) => updateProp(key, e.target.value)}>
                  {key === 'gamemode' ? ['survival', 'creative', 'adventure', 'spectator'].map(o => (
                    <option key={o} value={o}>{o}</option>
                  )) : ['peaceful', 'easy', 'normal', 'hard'].map(o => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              ) : ['pvp', 'allow-flight', 'online-mode', 'enable-command-block', 'white-list',
                    'spawn-animals', 'spawn-monsters', 'spawn-npcs', 'enable-query', 'enable-rcon', 'hardcore'].includes(key) ? (
                <select value={value} onChange={(e) => updateProp(key, e.target.value)}>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : (
                <input value={value} onChange={(e) => updateProp(key, e.target.value)} />
              )}
            </div>
          ))}
        </div>
        <button className="btn btn-primary mt-4" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Properties'}
        </button>
      </div>
    </div>
  );
}

function STFSPanel({ server }: { server: ServerData }) {
  return (
    <div>
      <h1 className="page-title">STFS (SFTP Access)</h1>
      <div className="card">
        <h2 className="card-title">SFTP Connection Details</h2>
        <p className="text-secondary mb-4">Use these details to connect via FileZilla or any SFTP client.</p>
        <div className="stfs-info">
          <div className="stfs-field">
            <label>Host</label>
            <div className="value">{server.domain}.mineserver.me</div>
          </div>
          <div className="stfs-field">
            <label>Port</label>
            <div className="value">2022</div>
          </div>
          <div className="stfs-field">
            <label>Username</label>
            <div className="value">sftp_{server.id.substring(0, 8)}</div>
          </div>
          <div className="stfs-field">
            <label>Password</label>
            <div className="value">••••••••••••</div>
          </div>
        </div>
        <p className="text-secondary" style={{ fontSize: 12 }}>
          Username and password cannot be changed. Use this to upload mods, edit the world, or manage files.
        </p>
      </div>
    </div>
  );
}

function VersionsPanel({ server, onServerUpdate }: { server: ServerData; onServerUpdate: () => void }) {
  const [loaderType, setLoaderType] = useState<'java' | 'bedrock'>(server.loader === 'bedrock' ? 'bedrock' : 'java');
  const [loaderId, setLoaderId] = useState(server.loader === 'bedrock' ? 'bedrock' : server.loader);
  const [version, setVersion] = useState(server.version);
  const [versions, setVersions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  async function loadVersions() {
    setLoading(true);
    try {
      if (loaderType === 'java') {
        const v = await getVersionsForLoader(loaderId);
        setVersions(v);
      } else {
        setVersions(BEDROCK_VERSIONS);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadVersions(); }, [loaderType, loaderId]);

  async function handleInstall() {
    setSaving(true);
    try {
      await updateServer(server.id, { loader: loaderId, version });
      setToast('Version updated! Restart server to apply changes.');
      onServerUpdate();
    } catch (err: any) {
      setToast('Error: ' + err.message);
    } finally {
      setSaving(false);
      setTimeout(() => setToast(''), 3000);
    }
  }

  return (
    <div>
      <h1 className="page-title">Versions</h1>
      {toast && <div className={`toast ${toast.includes('Error') ? 'toast-error' : 'toast-success'}`}>{toast}</div>}
      <div className="card">
        <div className="tabs mb-4">
          <button className={`tab ${loaderType === 'java' ? 'active' : ''}`} onClick={() => setLoaderType('java')}>
            ☕ Java Edition
          </button>
          <button className={`tab ${loaderType === 'bedrock' ? 'active' : ''}`} onClick={() => setLoaderType('bedrock')}>
            🪨 Bedrock Edition
          </button>
        </div>

        {loaderType === 'java' && (
          <div className="input-group">
            <label>Loader</label>
            <select className="select" value={loaderId} onChange={(e) => setLoaderId(e.target.value)}>
              {JAVA_LOADERS.map(l => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          </div>
        )}

        <div className="input-group">
          <label>Version</label>
          <select className="select" value={version} onChange={(e) => setVersion(e.target.value)}
            style={{ maxHeight: 300 }}>
            <option value="">Select version...</option>
            {versions.map(v => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <button className="btn btn-primary" onClick={handleInstall} disabled={saving || !version}>
          {saving ? 'Installing...' : 'Install Version'}
        </button>
      </div>
    </div>
  );
}

function ConsolePanel({ server }: { server: ServerData }) {
  const [logs, setLogs] = useState<string[]>([]);
  const [command, setCommand] = useState('');
  const [connected, setConnected] = useState(false);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubConsole = backend.onServerConsole((serverId: string, data: string) => {
      if (serverId === server.id) {
        setLogs(prev => [...prev, data].slice(-500));
      }
    });

    const unsubStopped = backend.onServerStopped((serverId: string, code: number) => {
      if (serverId === server.id) {
        setLogs(prev => [...prev, `\n[Server closed with code ${code}]`]);
        setConnected(false);
      }
    });

    checkStatus();
    return () => { unsubConsole(); unsubStopped(); };
  }, []);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [logs]);

  async function checkStatus() {
    try {
      const s = await backend.serverStatus(server.id);
      setConnected(s.running);
      if (s.running) setLogs(prev => [...prev, '[Connected to console]\n']);
    } catch (err) {}
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!command.trim()) return;
    try {
      await backend.sendCommand(server.id, command);
      setLogs(prev => [...prev, `> ${command}`]);
      setCommand('');
    } catch (err: any) {
      setLogs(prev => [...prev, `[Error: ${err.message}]`]);
    }
  }

  return (
    <div>
      <h1 className="page-title">Console</h1>
      <div className="card">
        <div className="flex-between mb-4">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: connected ? 'var(--success)' : 'var(--text-secondary)'
            }} />
            <span style={{ fontSize: 13 }}>{connected ? 'Connected' : 'Disconnected'}</span>
          </div>
          <button className="btn btn-outline btn-sm" onClick={() => setLogs([])}>Clear</button>
        </div>
        <div className="console-container">
          <div className="console-output" ref={outputRef}>
            {logs.length === 0 ? (
              <span style={{ color: 'var(--text-secondary)' }}>
                {connected ? 'Waiting for output...' : 'Start the server to see console output'}
              </span>
            ) : logs.map((line, i) => (
              <div key={i}>{line}</div>
            ))}
          </div>
          <form className="console-input-bar" onSubmit={handleSend}>
            <input className="console-input" value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="Enter command..." disabled={!connected} />
            <button className="btn btn-primary btn-sm" type="submit" disabled={!connected}>Send</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function ModsPanel({ server, user }: { server: ServerData; user: UserData }) {
  const [mods, setMods] = useState<ModData[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchSource, setSearchSource] = useState<'modrinth' | 'curseforge' | null>(null);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [toast, setToast] = useState('');

  const isModded = !['vanilla', 'bedrock'].includes(server.loader);

  useEffect(() => { if (isModded) loadMods(); }, []);

  async function loadMods() {
    try {
      const data = await getMods(server.id);
      setMods(data);
    } catch (err) { console.error(err); }
  }

  async function handleSearch(source: 'modrinth' | 'curseforge') {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearchSource(source);
    try {
      let results: any[];
      if (source === 'modrinth') {
        results = await searchModrinth(searchQuery, server.version, server.loader);
      } else {
        results = await searchCurseForge(searchQuery, server.version, server.loader);
      }
      setSearchResults(results);
      setShowSearch(true);
    } catch (err) {
      console.error(err);
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }

  async function handleInstallMod(mod: any, source: string) {
    try {
      const maxMods = user.premium ? 9999 : 20;
      const count = await getModCount(server.id);
      if (count >= maxMods) {
        setToast(`Mod limit reached (${maxMods}). ${user.premium ? '' : 'Upgrade to premium for unlimited.'}`);
        setTimeout(() => setToast(''), 3000);
        return;
      }
      const name = source === 'modrinth' ? mod.title : mod.name;
      const url = source === 'modrinth' ?
        `https://modrinth.com/mod/${mod.project_id}` :
        `https://www.curseforge.com/minecraft/mc-mods/${mod.slug || mod.id}`;
      const filename = `${name.replace(/[^a-zA-Z0-9]/g, '_')}.jar`;

      await addMod(server.id, name, source, url, filename);

      const sPath = await backend.getServersPath();
      const modsDir = `${sPath}\\${server.id}\\mods`;
      await backend.ensureDir(modsDir);
      const modFilePath = `${modsDir}\\${filename}`;

      if (source === 'modrinth' && mod.latest_files?.[0]?.url) {
        await backend.downloadFile(mod.latest_files[0].url, modFilePath);
      }

      setToast(`Installed: ${name}`);
      loadMods();
      setShowSearch(false);
      setTimeout(() => setToast(''), 3000);
    } catch (err: any) {
      setToast('Error: ' + err.message);
      setTimeout(() => setToast(''), 3000);
    }
  }

  async function handleDeleteMod(modId: string) {
    try {
      await deleteMod(modId);
      loadMods();
    } catch (err) { console.error(err); }
  }

  async function handleUploadMod() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.jar';
    input.multiple = true;
    input.onchange = async (e: any) => {
      const files = e.target.files;
      if (!files) return;
      const maxMods = user.premium ? 9999 : 20;
      const count = await getModCount(server.id);
      for (let i = 0; i < files.length; i++) {
        if (count + i >= maxMods) {
          setToast(`Mod limit reached (${maxMods})`);
          setTimeout(() => setToast(''), 3000);
          break;
        }
        const file = files[i];
        const name = file.name.replace('.jar', '');
        await addMod(server.id, name, 'upload', '', file.name);
        const sPath = await backend.getServersPath();
        const modsDir = `${sPath}\\${server.id}\\mods`;
        await backend.ensureDir(modsDir);
      }
      loadMods();
    };
    input.click();
  }

  if (!isModded) {
    return (
      <div>
        <h1 className="page-title">Mods</h1>
        <div className="card">
          <p>Mods are only available for modded Java servers (Forge, Fabric, Quilt, NeoForge).</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Mods</h1>
      {toast && <div className={`toast ${toast.includes('Error') ? 'toast-error' : 'toast-info'}`}>{toast}</div>}

      <div className="mods-search">
        <input className="input" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search mods..." />
        <button className="btn btn-primary" onClick={() => handleSearch('modrinth')} disabled={searching}>
          Modrinth
        </button>
        <button className="btn btn-outline" onClick={() => handleSearch('curseforge')} disabled={searching}>
          CurseForge
        </button>
        <button className="btn btn-success" onClick={handleUploadMod}>📁 Upload .jar</button>
      </div>

      <div className="card">
        <div className="flex-between mb-4">
          <span style={{ fontWeight: 600 }}>Installed Mods ({mods.length})</span>
        </div>
        {mods.length === 0 ? (
          <p className="text-secondary">No mods installed yet. Search or upload mods above.</p>
        ) : (
          <div className="mods-grid">
            {mods.map(mod => (
              <div key={mod.id} className="mod-card">
                <div className="mod-card-icon">🧩</div>
                <div className="mod-card-info">
                  <div className="mod-card-name">{mod.name}</div>
                  <div className="mod-card-source">{mod.source}</div>
                </div>
                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteMod(mod.id)}>✕</button>
              </div>
            ))}
          </div>
        )}
      </div>

      {showSearch && (
        <div className="modal-overlay" onClick={() => setShowSearch(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 600 }}>
            <h2 className="modal-title">Search Results ({searchSource})</h2>
            {searchResults.length === 0 ? (
              <p className="text-secondary">No mods found</p>
            ) : (
              <div className="mods-grid">
                {searchResults.map((mod: any, i: number) => (
                  <div key={mod.project_id || mod.id || i} className="mod-card"
                    onClick={() => handleInstallMod(mod, searchSource!)}>
                    <div className="mod-card-icon">
                      {mod.icon_url ? <img src={mod.icon_url} style={{ width: 40, height: 40, borderRadius: 4 }} alt="" /> : '🧩'}
                    </div>
                    <div className="mod-card-info">
                      <div className="mod-card-name">{mod.title || mod.name}</div>
                      <div className="mod-card-source">{mod.author || mod.authors?.[0]?.name || 'Unknown'}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowSearch(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BackupsPanel({ server }: { server: ServerData }) {
  const [backups, setBackups] = useState<BackupData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');

  useEffect(() => { loadBackups(); }, []);

  async function loadBackups() {
    try {
      const data = await getBackups(server.id);
      setBackups(data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }

  async function handleCreateBackup() {
    setCreating(true);
    try {
      const sPath = await backend.getServersPath();
      const serverPath = `${sPath}\\${server.id}`;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup-${timestamp}`;
      const backupPath = `${sPath}\\backups\\${server.user_id}\\${server.id}\\${backupName}.zip`;
      await backend.ensureDir(`${sPath}\\backups\\${server.user_id}\\${server.id}`);
      await backend.zipDir(serverPath, backupPath);

      const { createBackup: createBackupInSupabase } = await import('../services/supabase');
      await createBackupInSupabase(server.id, backupName, 0, backupPath);
      setToast('Backup created successfully!');
      loadBackups();
      setTimeout(() => setToast(''), 3000);
    } catch (err: any) {
      setToast('Error: ' + err.message);
      setTimeout(() => setToast(''), 3000);
    } finally {
      setCreating(false);
    }
  }

  async function handleRestore(backup: BackupData) {
    if (!confirm('Restore this backup? Current data will be overwritten.')) return;
    try {
      const sPath = await backend.getServersPath();
      const serverPath = `${sPath}\\${server.id}`;
      await backend.deleteServerFiles(serverPath);
      await backend.ensureDir(serverPath);
      await backend.unzipFile(backup.url, serverPath);
      setToast('Backup restored! Restart server to apply.');
      setTimeout(() => setToast(''), 3000);
    } catch (err: any) {
      setToast('Error: ' + err.message);
      setTimeout(() => setToast(''), 3000);
    }
  }

  async function handleDeleteBackup(backupId: string) {
    try {
      await deleteBackup(backupId);
      loadBackups();
    } catch (err) { console.error(err); }
  }

  return (
    <div>
      <h1 className="page-title">Backups</h1>
      {toast && <div className={`toast ${toast.includes('Error') ? 'toast-error' : 'toast-success'}`}>{toast}</div>}
      <div className="card">
        <div className="flex-between mb-4">
          <span style={{ fontWeight: 600 }}>All Backups</span>
          <button className="btn btn-primary" onClick={handleCreateBackup} disabled={creating}>
            {creating ? 'Creating...' : '💾 Create Backup'}
          </button>
        </div>
        {loading ? (
          <div className="flex-center" style={{ padding: 40 }}><div className="spinner" /></div>
        ) : backups.length === 0 ? (
          <p className="text-secondary">No backups yet. Create your first backup.</p>
        ) : (
          backups.map(b => (
            <div key={b.id} className="backup-item">
              <div className="backup-icon">💾</div>
              <div className="backup-info">
                <div className="backup-name">{b.name}</div>
                <div className="backup-date">{new Date(b.created_at).toLocaleString()}</div>
              </div>
              <div className="flex-gap">
                <button className="btn btn-success btn-sm" onClick={() => handleRestore(b)}>Restore</button>
                <button className="btn btn-danger btn-sm" onClick={() => handleDeleteBackup(b.id)}>✕</button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SettingsPanel({ server, user, onServerUpdate, onBack }: {
  server: ServerData; user: UserData; onServerUpdate: () => void; onBack: () => void
}) {
  const [name, setName] = useState(server.name);
  const [description, setDescription] = useState(server.description);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  async function handleSaveDetails() {
    setSaving(true);
    try {
      await updateServer(server.id, { name: name.trim(), description: description.trim() });
      setToast('Server details updated!');
      onServerUpdate();
      setTimeout(() => setToast(''), 3000);
    } catch (err: any) {
      setToast('Error: ' + err.message);
      setTimeout(() => setToast(''), 3000);
    } finally {
      setSaving(false);
    }
  }

  async function handleReinstall() {
    if (!confirm('Reinstall this server? Some files may be deleted. Mods and world data will be kept.')) return;
    try {
      const sPath = await backend.getServersPath();
      const serverPath = `${sPath}\\${server.id}`;
      setToast('Server reinstalled!');
      setTimeout(() => setToast(''), 3000);
    } catch (err: any) {
      setToast('Error: ' + err.message);
      setTimeout(() => setToast(''), 3000);
    }
  }

  async function handleDeleteServer() {
    if (!confirm('⚠️ DANGER: This will permanently delete the server and ALL its data from Supabase!\n\nThis action is NOT reversible.')) return;
    if (!confirm('Are you absolutely sure? Type "yes" to confirm.')) return;
    try {
      const sPath = await backend.getServersPath();
      const serverPath = `${sPath}\\${server.id}`;
      await backend.deleteServerFiles(serverPath);
      const { deleteServer: deleteServerFromDB } = await import('../services/supabase');
      await deleteServerFromDB(server.id);
      onBack();
    } catch (err: any) {
      setToast('Error: ' + err.message);
      setTimeout(() => setToast(''), 3000);
    }
  }

  return (
    <div>
      <h1 className="page-title">Settings</h1>
      {toast && <div className={`toast ${toast.includes('Error') ? 'toast-error' : 'toast-success'}`}>{toast}</div>}

      <div className="card">
        <h2 className="card-title">Server Details</h2>
        <div className="input-group">
          <label>Server Name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="input-group">
          <label>Description (optional)</label>
          <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)}
            style={{ minHeight: 80 }} />
        </div>
        <button className="btn btn-primary" onClick={handleSaveDetails} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="card">
        <h2 className="card-title">Reinstall Server</h2>
        <p className="text-secondary mb-4">Reinstall server files. Mods and world data will be kept.</p>
        <button className="btn btn-warning" onClick={handleReinstall}>Reinstall Server</button>
      </div>

      <div className="danger-zone">
        <h2 className="danger-zone-title">⚠️ Dangerous Zone</h2>
        <p className="text-secondary mb-4">
          Permanently delete this server and ALL its data from Supabase. This is NOT reversible.
        </p>
        <button className="btn btn-danger" onClick={handleDeleteServer}>Delete Server</button>
      </div>
    </div>
  );
}

function AccessCardsPanel({ server, user }: { server: ServerData; user: UserData }) {
  const [cards, setCards] = useState<import('../services/supabase').AccessCardData[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const maxCards = user.premium ? 5 : 1;

  useEffect(() => { loadCards(); }, []);

  async function loadCards() {
    try {
      const { getAccessCards } = await import('../services/supabase');
      const data = await getAccessCards(server.id);
      setCards(data);
    } catch (err: any) {
      console.error(err);
    }
  }

  async function handleAdd() {
    setError('');
    if (!search.trim()) { setError('Enter a username'); return; }
    if (cards.length >= maxCards) { setError(`Max ${maxCards} access card${maxCards > 1 ? 's' : ''} per server`); return; }
    setLoading(true);
    try {
      const { findUserByUsername, addAccessCard } = await import('../services/supabase');
      const found = await findUserByUsername(search.trim());
      if (!found) { setError('Cannot find user on MineServer'); setLoading(false); return; }
      if (found.id === user.id) { setError('Cannot add yourself'); setLoading(false); return; }
      await addAccessCard(server.id, user.id, found.username, found.id);
      setSearch('');
      await loadCards();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRemove(cardId: string) {
    try {
      const { removeAccessCard } = await import('../services/supabase');
      await removeAccessCard(cardId);
      await loadCards();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="page-title">🪪 Access Cards</h1>
      <p className="text-secondary mb-4">Give server access to other MineServer users ({cards.length}/{maxCards} used)</p>
      {error && <div className="login-error">{error}</div>}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input className="input" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Enter Discord or local username" style={{ flex: 1 }}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }} />
        <button className="btn btn-primary" onClick={handleAdd} disabled={loading}>Add</button>
      </div>

      {cards.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">🪪</div>
          <div className="empty-state-text">No access cards</div>
          <div className="empty-state-sub">Add users to give them server access</div>
        </div>
      ) : (
        <div className="card">
          {cards.map(card => (
            <div key={card.id} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 0', borderBottom: '1px solid var(--border)'
            }}>
              <div>
                <div style={{ fontWeight: 600 }}>{card.recipient_username}</div>
                <div className="text-secondary" style={{ fontSize: 12 }}>Added {new Date(card.created_at).toLocaleDateString()}</div>
              </div>
              <button className="btn btn-danger btn-sm" onClick={() => handleRemove(card.id)}>Remove</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
