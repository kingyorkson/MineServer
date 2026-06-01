import React, { useState } from 'react';

interface Props {
  onLogin: (email: string, password: string) => Promise<any>;
  onSignUp: (email: string, password: string, username: string) => Promise<void>;
  onDiscordLogin: () => Promise<void>;
  onLocalLogin: (username: string, password: string) => Promise<void>;
  onLocalSignUp: (username: string, password: string) => Promise<void>;
}

export default function Login({ onLogin, onSignUp, onDiscordLogin, onLocalLogin, onLocalSignUp }: Props) {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showLocal, setShowLocal] = useState(false);
  const [localTab, setLocalTab] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  async function handleDiscordSignIn() {
    setError('');
    setLoading(true);
    try {
      await onDiscordLogin();
    } catch (err: any) {
      setError(err.message || 'Sign in failed. Try the Local Account option instead.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLocalSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!username.trim()) { setError('Username is required'); return; }
    if (!password.trim()) { setError('Password is required'); return; }

    if (localTab === 'register') {
      if (password.length < 4) { setError('Password must be at least 4 characters'); return; }
      if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    }

    setLoading(true);
    try {
      if (localTab === 'login') {
        await onLocalLogin(username.trim(), password);
      } else {
        await onLocalSignUp(username.trim(), password);
      }
      setShowLocal(false);
    } catch (err: any) {
      setError(err.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-bg-effects" />
      <div className="login-container">
        <div className="login-box">
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 8, color: '#f59e0b' }}>◆</div>
            <h1 className="login-title">MineServer</h1>
            <p className="login-subtitle">Manage your Minecraft servers</p>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button className="login-btn" onClick={handleDiscordSignIn} disabled={loading}
            style={{
              background: '#5865f2', display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 10, fontSize: 16
            }}>
            <svg width="20" height="20" viewBox="0 0 127 96" fill="white">
              <path d="M107.7 8.07A105.15 105.15 0 0 0 81.47 0a72.06 72.06 0 0 0-3.36 6.83 97.68 97.68 0 0 0-29.11 0A72.06 72.06 0 0 0 45.64 0a105.89 105.89 0 0 0-26.25 8.09C2.79 32.65-1.71 56.6.54 80.21a105.73 105.73 0 0 0 32.17 16.15 77.49 77.49 0 0 0 6.89-11.23 68.82 68.82 0 0 1-10.85-5.18c.91-.66 1.8-1.34 2.66-2.01a75.14 75.14 0 0 0 64.32 0c.87.67 1.76 1.35 2.66 2.01a68.82 68.82 0 0 1-10.85 5.18 77.49 77.49 0 0 0 6.89 11.23 105.73 105.73 0 0 0 32.17-16.15c2.64-27.09-4.42-50.97-18.72-72.14ZM42.61 65.69c-3.54 0-6.42-3.25-6.42-7.22s2.86-7.22 6.42-7.22c3.57 0 6.44 3.25 6.44 7.22s-2.86 7.22-6.44 7.22Zm40.3 0c-3.53 0-6.42-3.25-6.42-7.22s2.86-7.22 6.42-7.22c3.57 0 6.44 3.25 6.44 7.22s-2.86 7.22-6.44 7.22Z"/>
            </svg>
            {loading ? 'Opening Discord...' : 'Sign in with Discord'}
          </button>

          {loading && (
            <div style={{ textAlign: 'center', marginTop: 16 }}>
              <p className="text-secondary" style={{ fontSize: 12 }}>
                A browser window will open for Discord sign in...
              </p>
            </div>
          )}

          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <button className="btn btn-outline" onClick={() => { setShowLocal(true); setError(''); setLocalTab('login'); setUsername(''); setPassword(''); setConfirmPassword(''); }}
              style={{ fontSize: 14, padding: '10px 24px', width: '100%' }}>
              Load Local Account
            </button>
          </div>
        </div>
      </div>

      {showLocal && (
        <div className="modal-overlay" onClick={() => setShowLocal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ width: 420 }}>
            <h2 className="modal-title" style={{ textAlign: 'center' }}>
              {localTab === 'login' ? 'Sign In' : 'Create Account'}
            </h2>

            <div className="login-tabs">
              <button className={`login-tab ${localTab === 'login' ? 'active' : ''}`} onClick={() => { setLocalTab('login'); setError(''); }}>
                Login
              </button>
              <button className={`login-tab ${localTab === 'register' ? 'active' : ''}`} onClick={() => { setLocalTab('register'); setError(''); }}>
                Register
              </button>
            </div>

            {error && <div className="login-error">{error}</div>}

            <form onSubmit={handleLocalSubmit}>
              <div className="input-group">
                <label>Username</label>
                <input className="input" type="text" value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter your username" autoFocus />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input className="input" type="password" value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password" />
              </div>
              {localTab === 'register' && (
                <div className="input-group">
                  <label>Confirm Password</label>
                  <input className="input" type="password" value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password" />
                </div>
              )}
              <button className="login-btn" type="submit" disabled={loading}>
                {loading ? 'Please wait...' : localTab === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
