import React, { useState } from 'react';

const CUR = "Rs";

function money(n) {
  return CUR + " " + Number(n || 0).toLocaleString("en-PK");
}

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " · " + d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function isThisWeek(d) {
  const now = new Date();
  const diffDays = (now - d) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 7;
}

function isThisMonth(d) {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function AdminDashboard({
  state,
  setState,
  onLogout,
  onMarkPaid,
  onDeleteSale,
  onSyncSettings,
  onWipeAll,
  onExportJson,
  onExportCsv,
  onImportJson,
  setActiveModalSale
}) {
  const [adminTab, setAdminTab] = useState('analytics');

  // Form states for new items & staff
  const [newSetName, setNewSetName] = useState('');
  const [newSetPrice, setNewSetPrice] = useState('');
  const [newMiscName, setNewMiscName] = useState('');
  const [newMiscPrice, setNewMiscPrice] = useState('');
  const [newStaffName, setNewStaffName] = useState('');

  // Search & Filter state for Sales Audit
  const [searchBox, setSearchBox] = useState('');
  const [filterStaff, setFilterStaff] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Calculated Metrics
  const now = new Date();
  const salesList = state.sales || [];
  let sToday = 0, sWeek = 0, sMonth = 0, sTotalAll = 0, totalPendingBal = 0, paidCount = 0;

  const categoryTotals = { Print: 0, Frame: 0, Pictures: 0, '1x1': 0, Set: 0, Item: 0, Custom: 0 };
  const staffPerformance = {};

  salesList.forEach(s => {
    const d = new Date(s.ts);
    const total = Number(s.total || 0);
    const paid = Number(s.paid != null ? s.paid : total);
    const bal = Number(s.balance != null ? s.balance : Math.max(0, total - paid));

    sTotalAll += total;
    totalPendingBal += bal;
    if (bal <= 0) paidCount++;

    if (isSameDay(d, now)) sToday += total;
    if (isThisWeek(d)) sWeek += total;
    if (isThisMonth(d)) sMonth += total;

    // Staff aggregation
    const staffName = s.staff || 'Unknown';
    if (!staffPerformance[staffName]) {
      staffPerformance[staffName] = { revenue: 0, count: 0 };
    }
    staffPerformance[staffName].revenue += total;
    staffPerformance[staffName].count += 1;

    // Category aggregation
    if (s.items && Array.isArray(s.items)) {
      s.items.forEach(it => {
        const cat = it.cat || 'Item';
        const lineTotal = Number(it.price || 0) * Number(it.qty || 1);
        if (categoryTotals[cat] !== undefined) {
          categoryTotals[cat] += lineTotal;
        } else {
          categoryTotals.Custom += lineTotal;
        }
      });
    }
  });

  const totalSalesCount = salesList.length;
  const avgOrderValue = totalSalesCount > 0 ? Math.round(sTotalAll / totalSalesCount) : 0;
  const collectionRate = sTotalAll > 0 ? Math.round(((sTotalAll - totalPendingBal) / sTotalAll) * 100) : 100;

  // Daily revenue bar chart data for past 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayRevenue = salesList
      .filter(s => isSameDay(new Date(s.ts), date))
      .reduce((sum, s) => sum + Number(s.total || 0), 0);
    return { day: dayName, revenue: dayRevenue };
  });

  const maxDayRevenue = Math.max(...last7Days.map(d => d.revenue), 1000);

  // Category Donut Chart Math
  const catColors = {
    Print: '#2563EB',
    Frame: '#059669',
    Pictures: '#D97706',
    '1x1': '#7C3AED',
    Set: '#DB2777',
    Item: '#4B5563',
    Custom: '#2563EB'
  };

  const catEntries = Object.entries(categoryTotals).filter(([, val]) => val > 0);
  const totalCatRevenue = catEntries.reduce((a, [, v]) => a + v, 0) || 1;

  // Filtered Sales for Audit
  const filteredSales = salesList.filter(s => {
    const d = new Date(s.ts);
    if (filterStaff && s.staff !== filterStaff) return false;
    if (filterDay === "today" && !isSameDay(d, now)) return false;
    if (filterDay === "week" && !isThisWeek(d)) return false;
    if (filterDay === "month" && !isThisMonth(d)) return false;
    const bal = s.balance != null ? s.balance : 0;
    if (filterStatus === "balance" && bal <= 0) return false;
    if (filterStatus === "paid" && bal > 0) return false;
    const q = searchBox.toLowerCase().trim();
    if (q && s.id.toLowerCase().indexOf(q) < 0 && (s.customer || "").toLowerCase().indexOf(q) < 0) return false;
    return true;
  });

  const SIZES = ["4x6", "5x7", "6x8", "6x9", "8x10", "8x12", "10x12", "10x15", "12x16", "12x18", "16x20", "20x24", "24x30", "24x30 (large)"];
  const PP = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56];
  const TYPES = [["normal", "Normal EXP"], ["bg", "BG Change"], ["reorder", "Re-order"], ["urgent", "Re-order (Urgent)"]];

  return (
    <div className="admin-dashboard">
      {/* ADMIN HEADER BANNER */}
      <div className="admin-banner card" style={{ padding: '20px 24px', marginBottom: '24px', background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)', color: '#FFFFFF', borderRadius: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ color: '#FFFFFF', margin: 0, padding: 0, background: 'none', border: 'none', fontSize: '22px', fontWeight: 800 }}>
                📊 Executive Admin Dashboard
              </h2>
              <span className="badge" style={{ background: '#2563EB', color: '#FFFFFF', fontWeight: 700 }}>PRO</span>
            </div>
            <div style={{ color: '#94A3B8', fontSize: '13.5px', marginTop: '4px' }}>
              Real-time financial analytics, team leaderboard, and system control center.
            </div>
          </div>
          <button className="btn danger sm" onClick={onLogout} style={{ borderRadius: '8px' }}>
            🔒 Sign Out Admin
          </button>
        </div>
      </div>

      {/* TOP KPI CARDS */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="card stat-kpi" style={{ padding: '18px 20px', borderLeft: '4px solid #2563EB' }}>
          <div className="k" style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Today's Revenue</div>
          <div className="v mono" style={{ fontSize: '24px', fontWeight: 800, color: '#2563EB', marginTop: '4px' }}>{money(sToday)}</div>
          <div style={{ fontSize: '12px', color: '#059669', marginTop: '6px', fontWeight: 600 }}>Live Today</div>
        </div>

        <div className="card stat-kpi" style={{ padding: '18px 20px', borderLeft: '4px solid #059669' }}>
          <div className="k" style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>This Week</div>
          <div className="v mono" style={{ fontSize: '24px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>{money(sWeek)}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>Past 7 days</div>
        </div>

        <div className="card stat-kpi" style={{ padding: '18px 20px', borderLeft: '4px solid #7C3AED' }}>
          <div className="k" style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>This Month</div>
          <div className="v mono" style={{ fontSize: '24px', fontWeight: 800, color: '#7C3AED', marginTop: '4px' }}>{money(sMonth)}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>Current month</div>
        </div>

        <div className="card stat-kpi" style={{ padding: '18px 20px', borderLeft: '4px solid #D97706' }}>
          <div className="k" style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>All Time Sales</div>
          <div className="v mono" style={{ fontSize: '24px', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>{money(sTotalAll)}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>{totalSalesCount} total order(s)</div>
        </div>

        <div className="card stat-kpi" style={{ padding: '18px 20px', borderLeft: '4px solid #DC2626' }}>
          <div className="k" style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Pending Balance</div>
          <div className="v mono" style={{ fontSize: '24px', fontWeight: 800, color: totalPendingBal > 0 ? '#DC2626' : '#059669', marginTop: '4px' }}>
            {money(totalPendingBal)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>Collection rate: {collectionRate}%</div>
        </div>
      </div>

      {/* ADMIN INNER TABS NAVIGATION */}
      <nav className="tabs" style={{ marginBottom: '24px' }}>
        <button className={adminTab === 'analytics' ? 'active' : ''} onClick={() => setAdminTab('analytics')}>📈 Analytics & Graphs</button>
        <button className={adminTab === 'audit' ? 'active' : ''} onClick={() => setAdminTab('audit')}>📋 Sales Audit ({totalSalesCount})</button>
        <button className={adminTab === 'prices' ? 'active' : ''} onClick={() => setAdminTab('prices')}>🏷️ Rate List Editor</button>
        <button className={adminTab === 'team' ? 'active' : ''} onClick={() => setAdminTab('team')}>👥 Team & Staff</button>
        <button className={adminTab === 'system' ? 'active' : ''} onClick={() => setAdminTab('system')}>⚙️ System & Backup</button>
      </nav>

      {/* TAB 1: ANALYTICS & GRAPH DASHBOARD */}
      {adminTab === 'analytics' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
          
          {/* BAR CHART: REVENUE TREND (7 DAYS) */}
          <div className="card">
            <h2>
              <span>📈 7-Day Revenue Trend</span>
              <span className="badge">Daily Total</span>
            </h2>
            <div className="body">
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '180px', paddingTop: '20px', paddingBottom: '10px', gap: '12px', borderBottom: '1px solid var(--line)' }}>
                {last7Days.map((item, i) => {
                  const barHeight = Math.max(12, Math.round((item.revenue / maxDayRevenue) * 140));
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
                      <div className="mono" style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', marginBottom: '6px' }}>
                        {item.revenue > 0 ? money(item.revenue).replace('Rs ', '') : '0'}
                      </div>
                      <div
                        style={{
                          width: '100%',
                          maxWidth: '36px',
                          height: `${barHeight}px`,
                          background: 'linear-gradient(180deg, #2563EB 0%, #3B82F6 100%)',
                          borderRadius: '6px 6px 0 0',
                          transition: 'height 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                        title={`${item.day}: ${money(item.revenue)}`}
                      />
                      <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)', marginTop: '8px' }}>
                        {item.day}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '14px', fontSize: '13px', color: 'var(--muted)' }}>
                <span>Average Daily Revenue:</span>
                <b className="mono" style={{ color: 'var(--ink)' }}>{money(Math.round(sWeek / 7))}</b>
              </div>
            </div>
          </div>

          {/* DONUT CHART: CATEGORY BREAKDOWN */}
          <div className="card">
            <h2>
              <span>🥧 Sales by Product Category</span>
              <span className="badge">Category Share</span>
            </h2>
            <div className="body">
              {!catEntries.length ? (
                <div className="empty-state">No sales category data available.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {catEntries.map(([catName, amount]) => {
                    const percent = Math.round((amount / totalCatRevenue) * 100);
                    const color = catColors[catName] || '#2563EB';
                    return (
                      <div key={catName}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>
                          <span>{catName}</span>
                          <span className="mono">{money(amount)} ({percent}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '10px', background: 'var(--paper)', borderRadius: '6px', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${percent}%`,
                              height: '100%',
                              background: color,
                              borderRadius: '6px',
                              transition: 'width 0.4s ease'
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* TEAM LEADERBOARD & PERFORMANCE */}
          <div className="card">
            <h2>
              <span>🏆 Staff Sales Leaderboard</span>
              <span className="badge">Performance</span>
            </h2>
            <div className="body">
              {!Object.keys(staffPerformance).length ? (
                <div className="empty-state">No staff activity logged yet.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {Object.entries(staffPerformance)
                    .sort(([, a], [, b]) => b.revenue - a.revenue)
                    .map(([name, stats], rank) => (
                      <div key={name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--paper)', borderRadius: '10px', border: '1px solid var(--line)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '50%',
                            background: rank === 0 ? '#FEF3C7' : rank === 1 ? '#E2E8F0' : '#FFEDD5',
                            color: rank === 0 ? '#D97706' : rank === 1 ? '#475569' : '#C2410C',
                            fontWeight: 800,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '13px'
                          }}>
                            {rank + 1}
                          </div>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '14px' }}>{name}</div>
                            <div style={{ fontSize: '12px', color: 'var(--muted)' }}>{stats.count} receipt(s)</div>
                          </div>
                        </div>
                        <div className="mono" style={{ fontSize: '15px', fontWeight: 800, color: 'var(--accent)' }}>
                          {money(stats.revenue)}
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>

          {/* KEY PERFORMANCE METRICS */}
          <div className="card">
            <h2>
              <span>💳 Financial Summary &amp; Collection</span>
              <span className="badge">Overview</span>
            </h2>
            <div className="body stack">
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--paper)', borderRadius: '10px' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Average Order Value (AOV):</span>
                <b className="mono" style={{ color: 'var(--accent)', fontSize: '16px' }}>{money(avgOrderValue)}</b>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--paper)', borderRadius: '10px' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Fully Paid Receipts:</span>
                <b className="mono" style={{ color: '#059669', fontSize: '16px' }}>{paidCount} / {totalSalesCount}</b>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--paper)', borderRadius: '10px' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Pending Balance Collection:</span>
                <b className="mono" style={{ color: totalPendingBal > 0 ? '#DC2626' : '#059669', fontSize: '16px' }}>
                  {money(totalPendingBal)}
                </b>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* TAB 2: SALES AUDIT & RECORDS */}
      {adminTab === 'audit' && (
        <div className="card">
          <h2>Sales Audit &amp; Transaction Journal</h2>
          <div className="body">
            <div className="filters">
              <div style={{ flex: 1 }}>
                <label>Search</label>
                <input
                  className="search"
                  placeholder="Receipt no. or customer name…"
                  value={searchBox}
                  onChange={(e) => setSearchBox(e.target.value)}
                />
              </div>
              <div>
                <label>Staff Filter</label>
                <select value={filterStaff} onChange={(e) => setFilterStaff(e.target.value)}>
                  <option value="">All Team Members</option>
                  {state.staff.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>
              <div>
                <label>Period</label>
                <select value={filterDay} onChange={(e) => setFilterDay(e.target.value)}>
                  <option value="">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>
              <div>
                <label>Status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="">All Statuses</option>
                  <option value="balance">Pending Balance</option>
                  <option value="paid">Fully Paid</option>
                </select>
              </div>
            </div>

            <div className="hint" style={{ marginBottom: '14px' }}>
              {filteredSales.length > 0 && (
                <span>
                  Showing <b>{filteredSales.length}</b> transaction(s) · Total: <b className="mono">{money(filteredSales.reduce((a, s) => a + s.total, 0))}</b>
                </span>
              )}
            </div>

            {!filteredSales.length ? (
              <div className="empty-state">No matching transactions found.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Receipt</th>
                      <th>Date &amp; Time</th>
                      <th>Staff</th>
                      <th>Customer</th>
                      <th className="num">Total</th>
                      <th className="num">Paid</th>
                      <th className="num">Balance</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map(s => {
                      const paid = s.paid != null ? s.paid : s.total;
                      const bal = s.balance != null ? s.balance : 0;
                      return (
                        <tr key={s.id} className="click" onClick={() => setActiveModalSale(s)}>
                          <td className="mono" style={{ fontWeight: 700 }}>{s.id}</td>
                          <td>{fmtDate(s.ts)}</td>
                          <td>{s.staff || '—'}</td>
                          <td>{s.customer || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                          <td className="num mono">{money(s.total)}</td>
                          <td className="num mono">{money(paid)}</td>
                          <td className="num">
                            {bal > 0 ? (
                              <span className="mono" style={{ color: 'var(--danger)', fontWeight: 800 }}>{money(bal)}</span>
                            ) : (
                              <span style={{ color: '#059669', fontWeight: 700 }}>Paid</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              {bal > 0 && (
                                <button
                                  className="btn primary sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMarkPaid(s.id);
                                  }}
                                >
                                  Mark Paid
                                </button>
                              )}
                              <button
                                className="btn danger sm"
                                title="Delete receipt permanently"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDeleteSale && onDeleteSale(s.id);
                                }}
                              >
                                🗑️ Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: RATE LIST EDITOR */}
      {adminTab === 'prices' && (
        <div className="card">
          <h2>Rate List &amp; Service Price Management</h2>
          <div className="body">
            <p className="hint" style={{ marginTop: 0 }}>
              Edit rates below. All updates auto-save instantly to Supabase cloud database and sync to team members.
            </p>

            {/* PRINTS */}
            <div className="subhead">Prints</div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Size</th>
                    {TYPES.map(([k, t]) => <th key={k} className="num">{t}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {SIZES.map(sz => (
                    <tr key={sz}>
                      <td><b>{sz}</b></td>
                      {TYPES.map(([k]) => (
                        <td key={k} className="num">
                          <input
                            type="number"
                            min="0"
                            className="price-in mono"
                            value={(state.prints[sz] && state.prints[sz][k] !== undefined) ? state.prints[sz][k] : ''}
                            onChange={(e) => {
                              const val = e.target.value === '' ? '' : Number(e.target.value) || 0;
                              const nextState = {
                                ...state,
                                prints: {
                                  ...state.prints,
                                  [sz]: { ...(state.prints[sz] || {}), [k]: val }
                                }
                              };
                              setState(nextState);
                              onSyncSettings(nextState);
                            }}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* FRAMES */}
            <div className="subhead">Frames</div>
            <div style={{ overflowX: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Size</th>
                    <th className="num">Frame price</th>
                  </tr>
                </thead>
                <tbody>
                  {SIZES.map(sz => (
                    <tr key={sz}>
                      <td><b>{sz}</b></td>
                      <td className="num">
                        <input
                          type="number"
                          min="0"
                          className="price-in mono"
                          value={state.frames[sz] !== undefined ? state.frames[sz] : ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? '' : Number(e.target.value) || 0;
                            const nextState = {
                              ...state,
                              frames: { ...state.frames, [sz]: val }
                            };
                            setState(nextState);
                            onSyncSettings(nextState);
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: TEAM & STAFF */}
      {adminTab === 'team' && (
        <div className="grid">
          <div className="card">
            <h2>Current Staff Team</h2>
            <div className="body">
              {!state.staff.length ? (
                <div className="empty-state">No staff logged.</div>
              ) : (
                <div>
                  {state.staff.map((n, i) => (
                    <div key={i} className="line">
                      <div className="d">
                        <div className="t">{n}</div>
                      </div>
                      <button
                        className="x"
                        title="Remove"
                        onClick={() => {
                          if (!window.confirm(`Remove ${n}?`)) return;
                          const nextState = {
                            ...state,
                            staff: state.staff.filter((_, idx) => idx !== i)
                          };
                          setState(nextState);
                          onSyncSettings(nextState);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <h2>Add Team Member</h2>
            <div className="body">
              <div className="field">
                <label>Staff Name</label>
                <input
                  placeholder="e.g. Ali"
                  value={newStaffName}
                  onChange={(e) => setNewStaffName(e.target.value)}
                />
              </div>
              <button
                className="btn primary block"
                onClick={() => {
                  const name = newStaffName.trim();
                  if (!name) return;
                  if (!state.staff.includes(name)) {
                    const nextState = { ...state, staff: [...state.staff, name] };
                    setState(nextState);
                    onSyncSettings(nextState);
                  }
                  setNewStaffName('');
                }}
              >
                Add Staff Member
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: SYSTEM & BACKUP */}
      {adminTab === 'system' && (
        <div className="grid">
          <div className="card">
            <h2>Data Backup &amp; Export</h2>
            <div className="body stack">
              <p className="hint" style={{ marginTop: 0 }}>
                Sales and rates are synced to <b>Supabase Cloud Database</b>. You can also download local offline backups.
              </p>
              <button className="btn primary block" onClick={onExportJson}>
                Download Full JSON Backup (.json)
              </button>
              <button className="btn ghost block" onClick={onExportCsv}>
                Download Sales Spreadsheet (.csv)
              </button>
              <div className="divider"></div>
              <label>Restore from JSON Backup</label>
              <input type="file" accept="application/json" onChange={onImportJson} />
            </div>
          </div>

          <div className="card">
            <h2>System Reset</h2>
            <div className="body stack">
              <p className="hint" style={{ marginTop: 0 }}>
                Wipe all transaction records from cloud database and start counter fresh.
              </p>
              <button className="btn danger block" onClick={onWipeAll}>
                Delete All Sales Records
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
