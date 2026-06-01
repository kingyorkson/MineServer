import React, { useState, useEffect } from 'react';
import Login from './components/Login';
import ServerList from './components/ServerList';
import ServerCreator from './components/ServerCreator';
import ServerDashboard from './components/ServerDashboard';
import { getCurrentUser, signIn, signUp, signOut, signInLocal, signUpLocal, signInWithDiscord,
  UserData, updateUserTheme, storeAccount, switchToAccount, getSessionTokens } from './services/supabase';

type Page = 'login' | 'servers' | 'creator' | 'dashboard';

export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [page, setPage] = useState<Page>('login');
  const [loading, setLoading] = useState(true);
  const [selectedServerId, setSelectedServerId] = useState<string | null>(null);
  const [themeBg, setThemeBg] = useState('');

  useEffect(() => {
    init();
  }, []);

  useEffect(() => {
    if (user) {
      applyTheme(user.theme, user.custom_color);
    }
  }, [user]);

  async function init() {
    try {
      const stored = localStorage.getItem('mineserver_user');
      if (stored) {
        const parsed = JSON.parse(stored);
        setUser(parsed);
        setPage('servers');
      }
      const u = await getCurrentUser();
      if (u) {
        setUser(u);
        localStorage.setItem('mineserver_user', JSON.stringify(u));
        setPage('servers');
      }
    } catch (err) {
      console.error('Init error:', err);
    } finally {
      setLoading(false);
    }
  }

  function applyTheme(theme: string, customColor: string) {
    const root = document.documentElement;
    if (theme === 'gold') {
      root.style.setProperty('--bg-primary', '#0f0f0f');
      root.style.setProperty('--bg-secondary', '#1a1a1a');
      root.style.setProperty('--accent', '#f59e0b');
      root.style.setProperty('--accent-hover', '#d97706');
      root.style.setProperty('--accent-glow', 'rgba(245, 158, 11, 0.3)');
      setThemeBg('linear-gradient(135deg, #0f0f0f, #1a1a1a)');
    } else if (theme === 'custom' && customColor) {
      root.style.setProperty('--accent', customColor);
      root.style.setProperty('--accent-hover', customColor + 'cc');
      root.style.setProperty('--accent-glow', customColor + '44');
      setThemeBg('');
    } else {
      root.style.setProperty('--bg-primary', '#0f0f0f');
      root.style.setProperty('--bg-secondary', '#1a1a2e');
      root.style.setProperty('--accent', '#4f46e5');
      root.style.setProperty('--accent-hover', '#6366f1');
      root.style.setProperty('--accent-glow', 'rgba(79, 70, 229, 0.3)');
      setThemeBg('');
    }
  }

  async function storeAccountTokens(u: UserData) {
    const tokens = await getSessionTokens();
    if (tokens) {
      storeAccount({ id: u.id, username: u.username, ...tokens });
    }
    localStorage.setItem('mineserver_user', JSON.stringify(u));
  }

  async function handleLogin(email: string, password: string) {
    const data = await signIn(email, password);
    const u = await getCurrentUser();
    if (u) {
      setUser(u);
      await storeAccountTokens(u);
      setPage('servers');
    }
    return data;
  }

  async function handleDiscordLogin() {
    await signInWithDiscord();
    const u = await getCurrentUser();
    if (u) {
      setUser(u);
      await storeAccountTokens(u);
      setPage('servers');
    }
  }

  async function handleLocalLogin(username: string, password: string) {
    await signInLocal(username, password);
    const u = await getCurrentUser();
    if (u) {
      setUser(u);
      await storeAccountTokens(u);
      setPage('servers');
    }
  }

  async function handleLocalSignUp(username: string, password: string) {
    await signUpLocal(username, password);
    const u = await getCurrentUser();
    if (u) {
      setUser(u);
      await storeAccountTokens(u);
      setPage('servers');
    }
  }

  async function handleSignUp(email: string, password: string, username: string) {
    await signUp(email, password, username);
  }

  async function handleLogout() {
    await signOut();
    localStorage.removeItem('mineserver_user');
    setUser(null);
    setPage('login');
  }

  async function handleAccountSwitch(account: any) {
    try {
      await switchToAccount(account);
      const u = await getCurrentUser();
      if (u) {
        setUser(u);
        localStorage.setItem('mineserver_user', JSON.stringify(u));
        setPage('servers');
      }
    } catch (err: any) {
      console.error('Account switch failed:', err);
      const accounts = (await import('./services/supabase')).getStoredAccounts();
      const filtered = accounts.filter(a => a.id !== account.id);
      localStorage.setItem('mineserver_accounts', JSON.stringify(filtered));
    }
  }

  async function handleAddAccount() {
    try {
      await handleDiscordLogin();
    } catch (err: any) {
      console.error('Add account failed:', err);
    }
  }

  async function handleThemeChange(theme: string, customColor: string) {
    if (!user) return;
    await updateUserTheme(user.id, theme, customColor);
    const updated = { ...user, theme, custom_color: customColor };
    setUser(updated);
    localStorage.setItem('mineserver_user', JSON.stringify(updated));
    applyTheme(theme, customColor);
  }

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f' }}>
        <div className="spinner" style={{ width: 40, height: 40 }} />
      </div>
    );
  }

  if (page === 'login' || !user) {
    return     <Login onLogin={handleLogin} onSignUp={handleSignUp} onDiscordLogin={handleDiscordLogin}
      onLocalLogin={handleLocalLogin} onLocalSignUp={handleLocalSignUp} />;
  }

  if (page === 'creator') {
    return (
      <ServerCreator
        user={user}
        onBack={() => setPage('servers')}
        onCreated={(serverId) => {
          setSelectedServerId(serverId);
          setPage('dashboard');
        }}
      />
    );
  }

  if (page === 'dashboard' && selectedServerId) {
    return (
      <ServerDashboard
        user={user}
        serverId={selectedServerId}
        onBack={() => { setPage('servers'); setSelectedServerId(null); }}
        onLogout={handleLogout}
        onThemeChange={handleThemeChange}
      />
    );
  }

  return (
    <ServerList
      user={user}
      onSelectServer={(id) => { setSelectedServerId(id); setPage('dashboard'); }}
      onCreateNew={() => setPage('creator')}
      onLogout={handleLogout}
      onThemeChange={handleThemeChange}
      onAccountSwitch={handleAccountSwitch}
      onAddAccount={handleAddAccount}
    />
  );
}
