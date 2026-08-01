import React, { useState } from 'react';
import { supabase } from '../supabaseClient.js';

export default function AdminLogin({ onLoginSuccess, onClose }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    const inputUser = username.trim().toLowerCase();
    const inputPass = password.trim();

    if (!inputUser || !inputPass) {
      setErrorMsg('Please enter both username and password.');
      return;
    }

    setLoading(true);

    // Convert 'admin' to admin email format for Supabase Auth if needed
    const authEmail = inputUser === 'admin' ? 'admin@idealstudio.com' : (inputUser.includes('@') ? inputUser : `${inputUser}@idealstudio.com`);

    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: authEmail,
          password: inputPass
        });

        if (error) {
          // Master fallback check for admin username & password
          if ((inputUser === 'admin' || inputUser === 'admin@idealstudio.com') && inputPass === '03045225523') {
            onLoginSuccess({ username: 'admin', email: 'admin@idealstudio.com' });
            return;
          }
          setErrorMsg('Invalid admin username or password.');
        } else if (data?.user) {
          onLoginSuccess({ ...data.user, username: 'admin' });
        }
      } catch (err) {
        if ((inputUser === 'admin' || inputUser === 'admin@idealstudio.com') && inputPass === '03045225523') {
          onLoginSuccess({ username: 'admin', email: 'admin@idealstudio.com' });
          return;
        }
        setErrorMsg('Authentication error. Check network or credentials.');
      } finally {
        setLoading(false);
      }
    } else {
      // Local fallback mode
      if ((inputUser === 'admin' || inputUser === 'admin@idealstudio.com') && inputPass === '03045225523') {
        onLoginSuccess({ username: 'admin', email: 'admin@idealstudio.com' });
      } else {
        setErrorMsg('Incorrect admin password.');
      }
      setLoading(false);
    }
  };

  return (
    <div className="overlay show" onClick={(e) => e.target.className?.includes('overlay') && onClose()}>
      <div className="card admin-login-card" style={{ maxWidth: '420px', width: '100%', borderRadius: '16px', boxShadow: 'var(--shadow-lg)' }}>
        <h2>
          <span>🔐 Admin Login</span>
          <button className="x" onClick={onClose}>×</button>
        </h2>
        <div className="body">
          <p className="hint" style={{ marginTop: 0, marginBottom: '16px' }}>
            Enter your admin username and password to access the executive dashboard.
          </p>

          {errorMsg && (
            <div style={{
              background: 'var(--danger-soft)',
              color: 'var(--danger)',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              marginBottom: '14px'
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="field">
              <label>Admin Username</label>
              <input
                type="text"
                placeholder="admin"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoCapitalize="none"
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
              />
            </div>

            <div className="stack" style={{ marginTop: '20px' }}>
              <button className="btn primary block" type="submit" disabled={loading}>
                {loading ? 'Authenticating...' : 'Sign In as Admin'}
              </button>
              <button className="btn ghost block" type="button" onClick={onClose}>
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
