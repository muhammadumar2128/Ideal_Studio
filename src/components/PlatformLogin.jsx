import React, { useState } from 'react';
import logoImg from '../../WhatsApp Image 2026-08-01 at 3.09.30 PM.jpeg';

export default function PlatformLogin({
  isDeviceAuthorized,
  adminPassword,
  terminalKey,
  onLoginSuccess,
  onAdminRemoteLogin,
  onAuthorizeTerminal
}) {
  const [activeTab, setActiveTab] = useState(isDeviceAuthorized ? 'counter' : 'admin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [adminPassInput, setAdminPassInput] = useState('');
  const [authorizeDeviceCheck, setAuthorizeDeviceCheck] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleCounterLogin = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!isDeviceAuthorized) {
      setErrorMsg('🔒 Access Denied: The Counter POS login only works on the Authorized Counter PC. Remote or unauthorized devices cannot log into the counter.');
      return;
    }

    const inputUser = username.trim().toLowerCase();
    const inputPass = password.trim();

    if (inputUser === 'user' && inputPass === 'ideal123') {
      onLoginSuccess();
    } else {
      setErrorMsg('Invalid counter username or password. Please try again.');
    }
  };

  const handleAdminLogin = (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const targetPass = adminPassword || 'irhaali';
    if (adminPassInput === targetPass) {
      if (authorizeDeviceCheck && onAuthorizeTerminal) {
        onAuthorizeTerminal();
      }
      setSuccessMsg('✅ Admin authenticated! Opening Admin Dashboard...');
      setTimeout(() => {
        if (onAdminRemoteLogin) {
          onAdminRemoteLogin('Admin');
        } else {
          onLoginSuccess();
        }
      }, 400);
    } else {
      setErrorMsg('Invalid admin password. Remote access denied.');
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
      <div className="card" style={{ maxWidth: '440px', width: '100%', borderRadius: '20px', boxShadow: 'var(--shadow-lg)', border: isDeviceAuthorized ? '1.5px solid var(--line)' : '2px solid #EF4444', overflow: 'hidden' }}>
        
        {/* TOP STATUS BANNER */}
        <div style={{
          background: isDeviceAuthorized ? 'rgba(16, 185, 129, 0.08)' : '#FEF2F2',
          borderBottom: isDeviceAuthorized ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #FECACA',
          padding: '12px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: '12px',
          fontWeight: 700
        }} id="device-auth-status-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>{isDeviceAuthorized ? '🖥️' : '🔒'}</span>
            <span style={{ color: isDeviceAuthorized ? '#059669' : '#DC2626' }}>
              {isDeviceAuthorized ? 'Authorized Studio Counter PC' : 'Unauthorized Remote Device'}
            </span>
          </div>
          <span className="badge sm" style={{
            background: isDeviceAuthorized ? '#ECFDF5' : '#FEE2E2',
            color: isDeviceAuthorized ? '#059669' : '#DC2626',
            fontWeight: 800
          }}>
            {isDeviceAuthorized ? 'POS Active' : 'Counter Locked'}
          </span>
        </div>

        <div className="body" style={{ padding: '28px 24px', textAlign: 'center' }}>
          <img src={logoImg} alt="Ideal Photo Studio Logo" style={{ height: '64px', width: 'auto', borderRadius: '12px', marginBottom: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
          
          <h2 style={{ fontSize: '22px', fontWeight: 900, margin: '0 0 4px', padding: 0, background: 'none', border: 'none', color: 'var(--ink)' }}>
            Ideal Photo Studio
          </h2>
          <p className="hint" style={{ marginTop: 0, marginBottom: '18px', fontSize: '13px' }}>
            Shop # 45, Post Office Market HIT, Taxila Cantt
          </p>

          {/* SECURITY WARNING FOR UNAUTHORIZED DEVICES */}
          {!isDeviceAuthorized && (
            <div style={{
              background: '#FFF5F5',
              border: '1.5px solid #FEB2B2',
              borderRadius: '12px',
              padding: '14px 16px',
              marginBottom: '20px',
              textAlign: 'left',
              color: '#9B1C1C',
              fontSize: '12.5px',
              lineHeight: 1.5
            }}>
              <div style={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span>🛡️</span>
                <span>POS Access Restricted to Counter PC</span>
              </div>
              <div>
                Staff cannot log into the cashier POS from mobile phones or remote devices. Only the official <strong>Studio Counter PC</strong> can launch the counter.
              </div>
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed #FECACA', color: '#771D1D', fontSize: '12px' }}>
                Studio Admins / Owners can log in remotely using the <strong>Admin Remote Access</strong> portal below.
              </div>
            </div>
          )}

          {/* TAB SELECTOR IF AUTHORIZED */}
          {isDeviceAuthorized ? (
            <div style={{
              display: 'flex',
              background: 'var(--paper-alt, #F3F4F6)',
              borderRadius: '10px',
              padding: '4px',
              marginBottom: '20px',
              gap: '4px'
            }}>
              <button
                type="button"
                onClick={() => { setActiveTab('counter'); setErrorMsg(''); }}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'counter' ? '#FFFFFF' : 'transparent',
                  color: activeTab === 'counter' ? 'var(--ink)' : 'var(--muted)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: activeTab === 'counter' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                🖥️ Counter POS
              </button>
              <button
                type="button"
                onClick={() => { setActiveTab('admin'); setErrorMsg(''); }}
                style={{
                  flex: 1,
                  padding: '8px',
                  borderRadius: '8px',
                  border: 'none',
                  background: activeTab === 'admin' ? '#FFFFFF' : 'transparent',
                  color: activeTab === 'admin' ? 'var(--ink)' : 'var(--muted)',
                  fontWeight: 800,
                  fontSize: '13px',
                  cursor: 'pointer',
                  boxShadow: activeTab === 'admin' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'
                }}
              >
                👑 Admin Access
              </button>
            </div>
          ) : null}

          {errorMsg && (
            <div style={{
              background: 'var(--danger-soft, #FEF2F2)',
              color: 'var(--danger, #DC2626)',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '600',
              marginBottom: '18px',
              textAlign: 'left',
              border: '1px solid #FECACA'
            }}>
              ⚠️ {errorMsg}
            </div>
          )}

          {successMsg && (
            <div style={{
              background: '#ECFDF5',
              color: '#059669',
              padding: '10px 14px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '600',
              marginBottom: '18px',
              textAlign: 'left',
              border: '1px solid #A7F3D0'
            }}>
              {successMsg}
            </div>
          )}

          {/* 1. COUNTER POS LOGIN FORM (ONLY ACCESSIBLE ON AUTH PC) */}
          {isDeviceAuthorized && activeTab === 'counter' && (
            <form onSubmit={handleCounterLogin} style={{ textAlign: 'left' }}>
              <div className="field">
                <label>Counter Username</label>
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
                <label>Counter Password</label>
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

              <button className="btn primary block" type="submit" style={{ marginTop: '20px', height: '48px', fontSize: '15.5px', fontWeight: 800 }}>
                🔓 Log In to Counter POS
              </button>
            </form>
          )}

          {/* 2. ADMIN REMOTE ACCESS PORTAL (AVAILABLE ON ALL DEVICES) */}
          {(!isDeviceAuthorized || activeTab === 'admin') && (
            <form onSubmit={handleAdminLogin} style={{ textAlign: 'left' }}>
              <div style={{ marginBottom: '14px', textAlign: 'center' }}>
                <span className="badge" style={{ background: '#EFF6FF', color: '#2563EB', fontWeight: 800, fontSize: '12px' }}>
                  👑 Admin Remote Access
                </span>
                <p style={{ fontSize: '12px', color: 'var(--muted)', margin: '6px 0 0' }}>
                  {isDeviceAuthorized
                    ? 'Enter Admin Master Password to manage revenue, timesheets & settings.'
                    : 'Log in remotely to view studio analytics, timesheets & hardware power logs.'}
                </p>
              </div>

              <div className="field">
                <label>Admin Password</label>
                <input
                  type="password"
                  placeholder="Enter admin password"
                  value={adminPassInput}
                  onChange={(e) => setAdminPassInput(e.target.value)}
                  required
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck="false"
                  autoFocus={!isDeviceAuthorized}
                />
              </div>

              {!isDeviceAuthorized && onAuthorizeTerminal && (
                <div style={{
                  marginTop: '12px',
                  marginBottom: '16px',
                  padding: '10px 12px',
                  background: 'var(--paper)',
                  border: '1px solid var(--line)',
                  borderRadius: '10px'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12.5px', fontWeight: 700, margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={authorizeDeviceCheck}
                      onChange={(e) => setAuthorizeDeviceCheck(e.target.checked)}
                      style={{ width: '16px', height: '16px' }}
                    />
                    <span>Authorize this computer as Studio Counter PC</span>
                  </label>
                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px', marginLeft: '24px' }}>
                    Check this if you are setting up or replacing the shop counter computer.
                  </div>
                </div>
              )}

              <button
                className="btn primary block"
                type="submit"
                style={{
                  marginTop: '16px',
                  height: '48px',
                  fontSize: '15px',
                  fontWeight: 800,
                  background: '#1E3A8A',
                  borderColor: '#1E3A8A'
                }}
              >
                🔐 Unlock Admin Dashboard
              </button>
            </form>
          )}

          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '24px' }}>
            Powered By Lunar Ai · Anti-Proxy Device Lock Active
          </div>
        </div>
      </div>
    </div>
  );
}
