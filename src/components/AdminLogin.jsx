import React, { useState } from 'react';
import { supabase } from '../supabaseClient.js';

export default function AdminLogin({ onLoginSuccess, onClose }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    setLoading(true);

    if (supabase) {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim()
        });

        if (error) {
          // Fallback check for default master password if auth user hasn't been created yet in Supabase
          if (password === '03045225523') {
            onLoginSuccess({ email: email.trim() || 'admin@idealstudio.com' });
            return;
          }
          setErrorMsg(error.message || 'Invalid login credentials.');
        } else if (data?.user) {
          onLoginSuccess(data.user);
        }
      } catch (err) {
        if (password === '03045225523') {
          onLoginSuccess({ email: email.trim() || 'admin@idealstudio.com' });
          return;
        }
        setErrorMsg('Authentication error. Check network or credentials.');
      } finally {
        setLoading(false);
      }
    } else {
      // Local fallback mode using master password
      if (password === '03045225523') {
        onLoginSuccess({ email: email.trim() || 'admin@idealstudio.com' });
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
            Sign in to access business analytics, graphs, and complete administrative controls.
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
              <label>Admin Email</label>
              <input
                type="email"
                placeholder="admin@idealstudio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
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
