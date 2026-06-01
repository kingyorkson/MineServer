import React, { useState, useEffect } from 'react';
import { UserData, ServerData, getServers, getReceivedAccessCards, setPremium,
  updateUsername, getStoredAccounts, storeAccount, removeStoredAccount,
  getActiveAccountIndex, setActiveAccountIndex, switchToAccount, getSessionTokens,
  transferServers, deleteMyAccount, findUserByUsername } from '../services/supabase';
import * as backend from '../services/backend';

interface Props {
  user: UserData;
  onSelectServer: (id: string) => void;
  onCreateNew: () => void;
  onLogout: () => void;
  onThemeChange: (theme: string, customColor: string) => void;
  onAccountSwitch: (account: any) => Promise<void>;
  onAddAccount: () => Promise<void>;
}

export default function ServerList({ user, onSelectServer, onCreateNew, onLogout, onThemeChange, onAccountSwitch, onAddAccount }: Props) {
  const [servers, setServers] = useState<ServerData[]>([]);
  const [sharedServers, setSharedServers] = useState<any[]>([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showThemeModal, setShowThemeModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeCode, setUpgradeCode] = useState('');
  const [upgradeError, setUpgradeError] = useState('');
  const [upgradeStage, setUpgradeStage] = useState<'browser' | 'code' | 'done'>('browser');
  const [themeTab, setThemeTab] = useState<'themes' | 'custom'>('themes');
  const [customColor, setCustomColor] = useState(user.custom_color || '#4f46e5');
  const [showAccounts, setShowAccounts] = useState(false);
  const [showAccountInfo, setShowAccountInfo] = useState(false);
  const [accountTab, setAccountTab] = useState<'general' | 'danger'>('general');
  const [newUsername, setNewUsername] = useState(user.username);
  const [accountError, setAccountError] = useState('');
  const [accountSuccess, setAccountSuccess] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [serversToDelete, setServersToDelete] = useState<string[]>([]);
  const [transferUsername, setTransferUsername] = useState('');
  const [transferTarget, setTransferTarget] = useState<string | null>(null);
  const [deleteStep, setDeleteStep] = useState<'confirm' | 'transfer' | 'done'>('confirm');
  const [storedAccounts, setStoredAccounts] = useState<any[]>([]);

  useEffect(() => { loadServers(); loadShared(); setStoredAccounts(getStoredAccounts()); }, []);

  async function loadServers() {
    try { const data = await getServers(user.id); setServers(data); } catch (err) { console.error(err); }
  }

  async function loadShared() {
    try { const data = await getReceivedAccessCards(user.id); setSharedServers(data); } catch (err) { console.error(err); }
  }

  function getDaysLeft(expiresAt: string): number {
    const diff = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  function getServerIcon(loader: string): string {
    const icons: Record<string, string> = { vanilla: '🌿', forge: '⚒️', fabric: '🔧', quilt: '🧵', neoforge: '🔥', bedrock: '🪨' };
    return icons[loader] || '📦';
  }

  function applyTheme(theme: string) {
    onThemeChange(theme, customColor);
    setShowThemeModal(false);
  }

  async function handleUpgradeOpen() {
    setUpgradeStage('browser');
    setUpgradeError('');
    setShowUpgradeModal(true);
    try {
      if (backend.isElectron()) {
        await (window as any).electronAPI.openOAuthWindow('https://linktr.ee/KingsMineServerUpgrade');
      } else {
        window.open('https://linktr.ee/KingsMineServerUpgrade', '_blank');
      }
    } catch (err: any) {}
  }

  function handleUpgradeContinue() {
    if (upgradeCode.trim().length < 10) { setUpgradeError('Please enter the full code from the website'); return; }
    setUpgradeError('');
    setUpgradeStage('done');
  }

  async function handleUpgradeApply() {
    try { await setPremium(user.id, true); setUpgradeError(''); setShowUpgradeModal(false); window.location.reload(); } catch (err: any) { setUpgradeError(err.message); }
  }

  async function handleUsernameSave() {
    setAccountError('');
    if (!newUsername.trim()) { setAccountError('Username cannot be empty'); return; }
    try { await updateUsername(user.id, newUsername.trim()); setAccountSuccess('Username updated!'); setTimeout(() => setAccountSuccess(''), 2000); } catch (err: any) { setAccountError(err.message); }
  }

  async function handleAccountClick() {
    setShowUserMenu(false);
    setAccountTab('general');
    setNewUsername(user.username);
    setAccountError('');
    setAccountSuccess('');
    setDeleteStep('confirm');
    setDeleteConfirm('');
    setServersToDelete([]);
    setTransferUsername('');
    setTransferTarget(null);
    setShowAccountInfo(true);
  }

  async function handleSwitchAccount(account: any) {
    setShowAccounts(false);
    await onAccountSwitch(account);
  }

  async function handleDeleteStart() {
    setAccountError('');
    if (servers.length > 0) {
      setDeleteStep('transfer');
    } else {
      await performDelete();
    }
  }

  async function handleTransferSearch() {
    setAccountError('');
    if (!transferUsername.trim()) { setAccountError('Enter a username'); return; }
    const found = await findUserByUsername(transferUsername.trim());
    if (!found) { setAccountError('Cannot find user on MineServer'); return; }
    setTransferTarget(found.id);
  }

  async function handleTransferAndDelete() {
    setAccountError('');
    try {
      if (serversToDelete.length > 0 && transferTarget) {
        await transferServers(serversToDelete, transferTarget);
      }
      await performDelete();
    } catch (err: any) { setAccountError(err.message); }
  }

  async function handleDeleteServersAndGo() {
    setAccountError('');
    try {
      await performDelete();
    } catch (err: any) { setAccountError(err.message); }
  }

  async function performDelete() {
    try {
      await deleteMyAccount(user.id);
      removeStoredAccount(user.id);
      setShowAccountInfo(false);
      onLogout();
    } catch (err: any) { setAccountError(err.message); }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <div className="titlebar">
          <div className="titlebar-title">
            <span style={{ color: '#f59e0b' }}>◆</span> MineServer
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {user.premium ? (
              <span className="crown-badge">👑 Premium</span>
            ) : (
              <button className="btn btn-sm btn-outline" onClick={handleUpgradeOpen}
                style={{ fontSize: 12, padding: '4px 12px' }}>⬆️ Upgrade</button>
            )}
            <div style={{ position: 'relative' }}>
              <button className="btn btn-sm btn-outline" onClick={() => setShowAccounts(!showAccounts)}
                style={{ fontSize: 12, padding: '4px 10px' }}>👥</button>
              {showAccounts && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 8,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: 4, minWidth: 180, zIndex: 100, boxShadow: '0 8px 30px rgba(0,0,0,0.4)'
                }}>
                  {storedAccounts.map((a, i) => (
                    <div key={a.id} onClick={() => handleSwitchAccount(a)}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 4, fontSize: 13, color: a.id === user.id ? 'var(--accent)' : 'var(--text-primary)', background: a.id === user.id ? 'var(--accent-glow)' : 'transparent' }}>
                      {a.username} {a.id === user.id ? '(current)' : ''}
                    </div>
                  ))}
                  <div style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 4 }}>
                    <div onClick={() => { setShowAccounts(false); onAddAccount(); }}
                      style={{ padding: '8px 12px', cursor: 'pointer', borderRadius: 4, fontSize: 13, color: 'var(--accent)' }}>
                      + Add Account
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div style={{ position: 'relative', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
              onClick={() => setShowUserMenu(!showUserMenu)}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', background: 'var(--accent)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'white'
              }}>
                {user.username.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{user.username}</span>
              {showUserMenu && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 8,
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 8, padding: 4, minWidth: 160, zIndex: 100, boxShadow: '0 8px 30px rgba(0,0,0,0.4)'
                }}>
                  <button onClick={handleAccountClick}
                    style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}>
                    👤 Account Info
                  </button>
                  <button onClick={() => { setShowUserMenu(false); setShowThemeModal(true); }}
                    style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}>
                    🎨 Theme
                  </button>
                  <button onClick={() => { setShowUserMenu(false); onLogout(); }}
                    style={{ display: 'block', width: '100%', padding: '8px 12px', border: 'none', background: 'transparent', color: 'var(--danger)', cursor: 'pointer', textAlign: 'left', fontSize: 13 }}>
                    🚪 Log Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

      <div className="app-layout">
        <div className="sidebar">
          <div className="sidebar-header">
            <h2>My Servers</h2>
            <p>{servers.length} server{servers.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="sidebar-list">
            {servers.map(s => (
              <div key={s.id} className="sidebar-item" onClick={() => onSelectServer(s.id)}>
                <div className="sidebar-item-icon">{getServerIcon(s.loader)}</div>
                <div className="sidebar-item-info">
                  <div className="sidebar-item-name">{s.name}</div>
                  <div className="sidebar-item-status">{s.domain}.mineserver.me</div>
                </div>
              </div>
            ))}
          </div>
          <button className="sidebar-new-btn" onClick={onCreateNew}>+ New Server</button>

          {sharedServers.length > 0 && (
            <>
              <div className="sidebar-header" style={{ marginTop: 16 }}>
                <h2>Other Servers</h2>
              </div>
              <div className="sidebar-list">
                {sharedServers.map((s: any) => (
                  <div key={s.id} className="sidebar-item" style={{ cursor: 'default' }}>
                    <div className="sidebar-item-info">
                      <div className="sidebar-item-name">{s.server_name}</div>
                      <div className="sidebar-item-status">Owner: {s.owner_username}</div>
                      <div className="sidebar-item-status">{s.server_domain}.mineserver.me</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="main-content">
          <div className="flex-between mb-4">
            <h1 className="page-title" style={{ marginBottom: 0 }}>Your Servers</h1>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={onCreateNew}>+ New Server</button>
            </div>
          </div>

          {servers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">📦</div>
              <div className="empty-state-text">No servers yet</div>
              <div className="empty-state-sub">Create your first Minecraft server to get started</div>
              <button className="btn btn-primary mt-4" onClick={onCreateNew}>Create Your First Server</button>
            </div>
          ) : (
            <div className="server-grid">
              {servers.map(s => {
                const daysLeft = getDaysLeft(s.expires_at);
                return (
                  <div key={s.id} className="server-card" onClick={() => onSelectServer(s.id)}>
                    <div className="server-card-banner">
                      {getServerIcon(s.loader)}
                    </div>
                    <div className="server-card-name">{s.name}</div>
                    <div className="server-card-domain">{s.domain}.mineserver.me</div>
                    <div className="server-card-footer mt-2">
                      <div>
                        <span className={`badge ${s.status === 'running' ? 'badge-success' : 'badge-info'}`}>
                          {s.status === 'running' ? '● Running' : '○ Stopped'}
                        </span>
                      </div>
                      <div className={`server-card-expires ${daysLeft <= 1 ? 'danger' : daysLeft <= 3 ? 'warning' : ''}`}>
                        {daysLeft}d remaining
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="create-server-card" onClick={onCreateNew}>
                <div className="create-server-card-icon">+</div>
                <div style={{ fontSize: 16, fontWeight: 600 }}>New Server</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Create a new Minecraft server</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {showThemeModal && (
        <div className="modal-overlay" onClick={() => setShowThemeModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">🎨 Customize Theme</h2>

            <div className="tabs">
              <button className={`tab ${themeTab === 'themes' ? 'active' : ''}`} onClick={() => setThemeTab('themes')}>
                Presets
              </button>
              <button className={`tab ${themeTab === 'custom' ? 'active' : ''}`} onClick={() => setThemeTab('custom')}>
                Custom Color
              </button>
            </div>

            {themeTab === 'themes' && (
              <div className="grid-2">
                <div className={`theme-option ${user.theme === 'default' ? 'selected' : ''}`} onClick={() => applyTheme('default')}>
                  <div className="theme-preview" style={{ background: 'linear-gradient(135deg, #0f0f0f, #1a1a2e)' }} />
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Default</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Dark purple</div>
                </div>
                <div className={`theme-option ${user.theme === 'gold' ? 'selected' : ''}`} onClick={() => applyTheme('gold')}>
                  <div className="theme-preview" style={{ background: 'linear-gradient(135deg, #0f0f0f, #1a1a1a)' }} />
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Gold</div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Golden accent</div>
                </div>
              </div>
            )}

            {themeTab === 'custom' && (
              <div>
                <div className="input-group">
                  <label>Accent Color</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input type="color" value={customColor} onChange={(e) => setCustomColor(e.target.value)}
                      style={{ width: 50, height: 40, border: 'none', borderRadius: 6, cursor: 'pointer', background: 'transparent' }} />
                    <input className="input" value={customColor} onChange={(e) => setCustomColor(e.target.value)}
                      placeholder="#4f46e5" style={{ fontFamily: 'monospace' }} />
                  </div>
                </div>
                <button className="btn btn-primary" onClick={() => applyTheme('custom')}>Apply Custom Color</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showAccountInfo && (
        <div className="modal-overlay" onClick={() => setShowAccountInfo(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 460 }}>
            <h2 className="modal-title">👤 Account Info</h2>
            {accountError && <div className="login-error">{accountError}</div>}
            {accountSuccess && <div className="toast toast-success">{accountSuccess}</div>}

            <div className="tabs">
              <button className={`tab ${accountTab === 'general' ? 'active' : ''}`} onClick={() => setAccountTab('general')}>General</button>
              <button className={`tab ${accountTab === 'danger' ? 'active' : ''}`} onClick={() => setAccountTab('danger')}>Danger Zone</button>
            </div>

            {accountTab === 'general' && (
              <div>
                <div className="input-group">
                  <label>Username</label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="input" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} style={{ flex: 1 }} />
                    <button className="btn btn-primary" onClick={handleUsernameSave}>Save</button>
                  </div>
                </div>
                <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
                  <button className="btn btn-outline" onClick={() => { setShowAccountInfo(false); onLogout(); }} style={{ width: '100%' }}>
                    🚪 Log Out
                  </button>
                </div>
              </div>
            )}

            {accountTab === 'danger' && (
              <div>
                {deleteStep === 'confirm' && (
                  <div>
                    <p className="text-secondary mb-4">Permanently delete your account and all associated data. This cannot be undone.</p>
                    <div className="input-group">
                      <label>Type your current username <strong>{user.username}</strong> to confirm</label>
                      <input className="input" value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="Enter your username" />
                    </div>
                    <button className="btn btn-danger" onClick={handleDeleteStart} disabled={deleteConfirm !== user.username} style={{ width: '100%' }}>
                      Delete My Account
                    </button>
                  </div>
                )}

                {deleteStep === 'transfer' && (
                  <div>
                    <p className="text-secondary mb-2">You own {servers.length} server{servers.length > 1 ? 's' : ''}. Choose what to do:</p>
                    <div style={{ marginBottom: 12 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>Transfer servers to another user:</p>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input className="input" value={transferUsername} onChange={(e) => setTransferUsername(e.target.value)}
                          placeholder="Enter recipient username" style={{ flex: 1 }} />
                        <button className="btn btn-primary btn-sm" onClick={handleTransferSearch}>Find</button>
                      </div>
                      {transferTarget && <p style={{ fontSize: 12, color: 'var(--success)', marginTop: 4 }}>✓ User found</p>}
                    </div>
                    <div style={{ maxHeight: 150, overflowY: 'auto', marginBottom: 12 }}>
                      {servers.map(s => (
                        <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13, cursor: 'pointer' }}>
                          <input type="checkbox" checked={serversToDelete.includes(s.id)}
                            onChange={() => setServersToDelete(prev => prev.includes(s.id) ? prev.filter(id => id !== s.id) : [...prev, s.id])} />
                          {s.name}
                        </label>
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-danger" onClick={handleDeleteServersAndGo} style={{ flex: 1 }}>
                        Delete All Servers & Delete Account
                      </button>
                      <button className="btn btn-primary" onClick={handleTransferAndDelete} disabled={!transferTarget || serversToDelete.length === 0} style={{ flex: 1 }}>
                        Transfer Selected & Delete Account
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {showUpgradeModal && (
        <div className="modal-overlay" onClick={() => setShowUpgradeModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 440 }}>
            <h2 className="modal-title">⬆️ Upgrade to Premium</h2>

            {upgradeStage === 'browser' && (
              <div>
                <p className="text-secondary" style={{ textAlign: 'center', marginBottom: 16 }}>
                  A browser window was opened. Visit the link, get the code, then close the browser to continue.
                </p>
                <button className="login-btn" onClick={() => setUpgradeStage('code')}>
                  Close browser to continue
                </button>
              </div>
            )}

            {upgradeStage === 'code' && (
              <div>
                {upgradeError && <div className="login-error">{upgradeError}</div>}
                <div className="input-group">
                  <label>Enter the code from the website</label>
                  <input className="input" value={upgradeCode} onChange={(e) => setUpgradeCode(e.target.value)}
                    placeholder="Paste your code here" />
                </div>
                <button className="login-btn" onClick={handleUpgradeContinue}>Next</button>
              </div>
            )}

            {upgradeStage === 'done' && (
              <div>
                <p style={{ textAlign: 'center', marginBottom: 16 }}>Premium unlocked! Click apply to activate.</p>
                <button className="login-btn" onClick={handleUpgradeApply}>Apply Premium</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
