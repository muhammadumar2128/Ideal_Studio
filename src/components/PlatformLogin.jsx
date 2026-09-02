import React, { useState } from 'react';
import logoImg from '../../WhatsApp Image 2026-08-01 at 3.09.30 PM.jpeg';

export default function PlatformLogin({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    setErrorMsg('');

    const inputUser = username.trim().toLowerCase();
    const inputPass = password.trim();

    if (inputUser === 'user' && inputPass === 'ideal123') {
      onLoginSuccess();
    } else {
      setErrorMsg('Invalid username or password. Please try again.');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--paper)',
      padding: '20px'
    }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%', borderRadius: '20px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--line)' }}>
        <div className="body" style={{ padding: '32px 28px', textAlign: 'center' }}>
          <img src={logoImg} alt="Ideal Photo Studio Logo" style={{ height: '64px', width: 'auto', borderRadius: '12px', marginBottom: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
          
          <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 6px', padding: 0, background: 'none', border: 'none', color: 'var(--ink)' }}>
            Ideal Photo Studio
          </h2>
          <p className="hint" style={{ marginTop: 0, marginBottom: '24px' }}>
            Enter platform credentials to access POS counter software.
          </p>

          {errorMsg && (
            <div style={{
              background: 'var(--danger-soft)',
              color: 'var(--danger)',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '13.5px',
              fontWeight: '600',
              marginBottom: '18px',
              textAlign: 'left'
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ textAlign: 'left' }}>
            <div className="field">
              <label>Username</label>
              <input
                type="text"
                placeholder="user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
              />
            </div>

            <div className="field">
              <label>Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck="false"
              />
            </div>

            <button className="btn primary block" type="submit" style={{ marginTop: '20px', height: '48px', fontSize: '15.5px' }}>
              🔓 Log In to Platform
            </button>
          </form>

          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '24px' }}>
            Powered By Lunar Ai
          </div>
        </div>
      </div>
    </div>
  );
}
