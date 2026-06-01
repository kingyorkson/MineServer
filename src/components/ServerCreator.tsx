import React, { useState } from 'react';
import { UserData, createServer } from '../services/supabase';
import { JAVA_LOADERS, BEDROCK_VERSIONS, getVersionsForLoader } from '../services/versions';

interface Props {
  user: UserData;
  onBack: () => void;
  onCreated: (serverId: string) => void;
}

interface WhitelistUser {
  username: string;
  permission: 'member' | 'operator';
}

export default function ServerCreator({ user, onBack, onCreated }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [description, setDescription] = useState('');
  const [loaderType, setLoaderType] = useState<'java' | 'bedrock' | null>(null);
  const [loaderId, setLoaderId] = useState('');
  const [version, setVersion] = useState('');
  const [versions, setVersions] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [whitelist, setWhitelist] = useState<WhitelistUser[]>([]);
  const [whitelistInput, setWhitelistInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loadingVersions, setLoadingVersions] = useState(false);

  const totalSteps = visibility === 'public' ? 4 : 5;

  async function handleNext() {
    setError('');
    if (step === 0) {
      if (!name.trim()) { setError('Server name is required'); return; }
      if (!domain.trim()) { setError('Domain is required'); return; }
      if (!/^[a-z0-9-]+$/.test(domain)) { setError('Domain must be lowercase alphanumeric and hyphens only'); return; }
      setStep(1);
    } else if (step === 1) {
      if (!loaderType) { setError('Select a type'); return; }
      setVersions([]);
      setVersion('');
      setStep(2);
    } else if (step === 2) {
      if (loaderType === 'java') {
        if (!loaderId) { setError('Select a loader'); return; }
        setLoadingVersions(true);
        try {
          const v = await getVersionsForLoader(loaderId);
          setVersions(v);
          setStep(3);
        } catch (e) {
          setError('Failed to fetch versions');
        } finally {
          setLoadingVersions(false);
        }
      } else {
        setVersions(BEDROCK_VERSIONS);
        setLoaderId('bedrock');
        setStep(3);
      }
    } else if (step === 3) {
      if (!version) { setError('Select a version'); return; }
      setStep(visibility === 'public' ? 4 : 4);
    }
  }

  async function handleFinish() {
    setLoading(true);
    setError('');
    try {
      const maxServers = user.premium ? 10 : 2;
      const { getServers } = await import('../services/supabase');
      const existing = await getServers(user.id);
      if (existing.length >= maxServers) {
        setError(`You can only have ${maxServers} servers on your plan. Upgrade for more.`);
        setLoading(false);
        return;
      }

      const server = await createServer({
        user_id: user.id,
        name: name.trim(),
        description: description.trim(),
        domain: domain.trim().toLowerCase(),
        loader: loaderId,
        version,
        visibility,
        min_ram: '1G',
        max_ram: '2G',
        java_path: 'java',
      });

      const { addWhitelist } = await import('../services/supabase');
      for (const w of whitelist) {
        await addWhitelist(server.id, w.username, w.permission);
      }

      onCreated(server.id);
    } catch (err: any) {
      setError(err.message || 'Failed to create server');
    } finally {
      setLoading(false);
    }
  }

  function addWhitelistUser() {
    if (!whitelistInput.trim()) return;
    setWhitelist([...whitelist, { username: whitelistInput.trim(), permission: 'member' }]);
    setWhitelistInput('');
  }

  function removeWhitelistUser(index: number) {
    setWhitelist(whitelist.filter((_, i) => i !== index));
  }

  function setWhitelistPermission(index: number, permission: 'member' | 'operator') {
    const updated = [...whitelist];
    updated[index].permission = permission;
    setWhitelist(updated);
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="titlebar">
        <div className="titlebar-title">
          <span style={{ color: '#f59e0b' }}>◆</span> MineServer - Create Server
        </div>
        <button className="titlebar-btn" onClick={onBack}>✕</button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: 40 }}>
        <div className="creator-container">
          <h1 className="page-title">Create New Server</h1>

          <div className="creator-step">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div key={i} className={`creator-step-dot ${i === step ? 'active' : i < step ? 'completed' : ''}`}>
                {i < step ? '✓' : i + 1}
              </div>
            ))}
          </div>

          {error && <div className="login-error mb-4">{error}</div>}

          {step === 0 && (
            <div>
              <div className="card">
                <h2 className="card-title">Server Details</h2>
                <div className="input-group">
                  <label>Server Name *</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder="My Awesome Server" />
                </div>
                <div className="input-group">
                  <label>Server Domain *</label>
                  <div style={{ display: 'flex', gap: 0 }}>
                    <input className="input" value={domain} onChange={(e) => setDomain(e.target.value)}
                      placeholder="myawesome" style={{ borderRadius: '8px 0 0 8px' }} />
                    <div style={{
                      background: 'var(--bg-input)', border: '1px solid var(--border)', borderLeft: 'none',
                      borderRadius: '0 8px 8px 0', padding: '10px 14px', color: 'var(--text-secondary)',
                      fontSize: 14, whiteSpace: 'nowrap'
                    }}>.mineserver.me</div>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
                    Your friends will join using: <strong>{domain || '...'}.mineserver.me</strong>
                  </div>
                </div>
                <div className="input-group">
                  <label>Description (optional)</label>
                  <textarea className="input" value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="A cool survival server..." style={{ minHeight: 80, resize: 'vertical' }} />
                </div>
              </div>
              <div className="flex-between">
                <button className="btn btn-outline" onClick={onBack}>Cancel</button>
                <button className="btn btn-primary" onClick={handleNext}>Next</button>
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <div className="card">
                <h2 className="card-title">Select Type</h2>
                <div className="grid-2">
                  <div className={`loader-card ${loaderType === 'java' ? 'selected' : ''}`}
                    onClick={() => setLoaderType('java')}>
                    <div className="loader-card-icon">☕</div>
                    <div className="loader-card-name">Java Edition</div>
                    <div className="loader-card-desc">Supports Vanilla, Forge, Fabric, Quilt, NeoForge</div>
                  </div>
                  <div className={`loader-card ${loaderType === 'bedrock' ? 'selected' : ''}`}
                    onClick={() => setLoaderType('bedrock')}>
                    <div className="loader-card-icon">🪨</div>
                    <div className="loader-card-name">Bedrock Edition</div>
                    <div className="loader-card-desc">All versions available</div>
                  </div>
                </div>
              </div>
              <div className="flex-between">
                <button className="btn btn-outline" onClick={() => setStep(0)}>Back</button>
                <button className="btn btn-primary" onClick={handleNext}>Next</button>
              </div>
            </div>
          )}

          {step === 2 && loaderType === 'java' && (
            <div>
              <div className="card">
                <h2 className="card-title">Select Loader</h2>
                <div className="grid-2">
                  {JAVA_LOADERS.map(l => (
                    <div key={l.id} className={`loader-card ${loaderId === l.id ? 'selected' : ''}`}
                      onClick={() => setLoaderId(l.id)}>
                      <div className="loader-card-name">{l.label}</div>
                      <div className="loader-card-desc">
                        {l.id === 'vanilla' ? 'Original Minecraft experience' :
                         l.id === 'forge' ? 'The classic modding platform' :
                         l.id === 'fabric' ? 'Lightweight modern mod loader' :
                         l.id === 'quilt' ? 'Community-driven mod loader' :
                         'Next-gen Forge fork'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-between">
                <button className="btn btn-outline" onClick={() => setStep(1)}>Back</button>
                <button className="btn btn-primary" onClick={handleNext}>Next</button>
              </div>
            </div>
          )}

          {step === 2 && loaderType === 'bedrock' && (
            <div style={{ textAlign: 'center' }}>
              <p className="text-secondary mb-4">Bedrock Edition selected. Choose your version next.</p>
              <button className="btn btn-primary" onClick={handleNext}>Next</button>
            </div>
          )}

          {step === 3 && (
            <div>
              <div className="card">
                <h2 className="card-title">Select Version</h2>
                {loadingVersions ? (
                  <div className="flex-center" style={{ padding: 40 }}>
                    <div className="spinner" />
                  </div>
                ) : (
                  <div className="input-group">
                    <label>Version</label>
                    <select className="select" value={version} onChange={(e) => setVersion(e.target.value)}
                      style={{ maxHeight: 300 }}>
                      <option value="">Select a version...</option>
                      {versions.map(v => (
                        <option key={v} value={v}>{v}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
              <div className="flex-between">
                <button className="btn btn-outline" onClick={() => setStep(2)}>Back</button>
                <button className="btn btn-primary" onClick={handleNext}>Next</button>
              </div>
            </div>
          )}

          {step === 4 && (() => {
            const vis = visibility;
            const isPublic = vis === 'public';
            return (
              <div>
                <div className="card">
                  <h2 className="card-title">Visibility</h2>
                  {isPublic && <p className="text-secondary mb-4">Choose who can join your server</p>}
                  <div className="grid-2">
                    <div className={`loader-card ${isPublic ? 'selected' : ''}`}
                      onClick={() => setVisibility('public')}>
                      <div className="loader-card-icon">🌍</div>
                      <div className="loader-card-name">Public</div>
                      <div className="loader-card-desc">Anyone with the address can join</div>
                    </div>
                    <div className={`loader-card ${!isPublic ? 'selected' : ''}`}
                      onClick={() => setVisibility('private')}>
                      <div className="loader-card-icon">🔒</div>
                      <div className="loader-card-name">Private</div>
                      <div className="loader-card-desc">Whitelist only</div>
                    </div>
                  </div>
                </div>
                {isPublic ? (
                  <div className="flex-between">
                    <button className="btn btn-outline" onClick={() => setStep(3)}>Back</button>
                    <button className="btn btn-primary" onClick={handleFinish} disabled={loading}>
                      {loading ? 'Creating...' : 'Finish'}
                    </button>
                  </div>
                ) : (
                  <button className="btn btn-primary" onClick={() => setStep(5)}>Next: Add People</button>
                )}
              </div>
            );
          })()}

          {step === 5 && (
            <div>
              <div className="card">
                <h2 className="card-title">Add Whitelisted Players</h2>
                <p className="text-secondary mb-4">Add Minecraft usernames who can join your private server</p>
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <input className="input" value={whitelistInput}
                    onChange={(e) => setWhitelistInput(e.target.value)}
                    placeholder="Minecraft username"
                    onKeyDown={(e) => { if (e.key === 'Enter') addWhitelistUser(); }} />
                  <button className="btn btn-primary" onClick={addWhitelistUser}>Add</button>
                </div>
                {whitelist.length > 0 ? (
                  <div>
                    {whitelist.map((w, i) => (
                      <div key={i} className="whitelist-item">
                        <div className="whitelist-avatar">{w.username.charAt(0).toUpperCase()}</div>
                        <div className="whitelist-info">
                          <div className="whitelist-username">{w.username}</div>
                          <div className="whitelist-permission">{w.permission}</div>
                        </div>
                        <div className="whitelist-actions">
                          <select className="select" value={w.permission}
                            onChange={(e) => setWhitelistPermission(i, e.target.value as any)}
                            style={{ width: 100, padding: '4px 8px', fontSize: 12 }}>
                            <option value="member">Member</option>
                            <option value="operator">Operator</option>
                          </select>
                          <button className="btn btn-danger btn-sm" onClick={() => removeWhitelistUser(i)}>✕</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-secondary" style={{ textAlign: 'center', padding: 20 }}>
                    No players added yet. Add at least one to continue.
                  </p>
                )}
              </div>
              <div className="flex-between">
                <button className="btn btn-outline" onClick={() => setStep(4)}>Back</button>
                <button className="btn btn-primary" onClick={handleFinish} disabled={loading}>
                  {loading ? 'Creating...' : 'Finish'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
