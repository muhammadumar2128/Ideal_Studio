import React, { useState } from 'react';

const CUR = "Rs";

function money(n) {
  const num = Number(n || 0);
  if (num < 0) {
    return "- " + CUR + " " + Math.abs(num).toLocaleString("en-PK");
  }
  return CUR + " " + num.toLocaleString("en-PK");
}

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmtMonthKey(monthKey) {
  if (!monthKey) return '';
  const [y, m] = monthKey.split('-');
  const date = new Date(Number(y), Number(m) - 1, 1);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function getSaleTotals(s) {
  const items = s.items || [];
  const grossTotal = items.filter(it => it.cat !== 'Discount' && Number(it.price) > 0).reduce((sum, it) => sum + (Number(it.price) * Number(it.qty || 1)), 0);
  const discItems = items.filter(it => it.cat === 'Discount' || Number(it.price) < 0);
  const discAmt = discItems.reduce((sum, it) => sum + Math.abs(Number(it.price || 0) * Number(it.qty || 1)), 0);

  let realNetTotal = Number(s.total || 0);
  if (discAmt > 0) {
    if (s.total === grossTotal || s.total > (grossTotal - discAmt)) {
      realNetTotal = Math.max(0, grossTotal - discAmt);
    }
  } else if (!s.total && grossTotal > 0) {
    realNetTotal = grossTotal;
  }

  let realPaid = s.paid != null ? Number(s.paid) : realNetTotal;
  if (discAmt > 0 && realPaid === grossTotal) {
    realPaid = realNetTotal;
  }

  const origBal = s.balance != null ? Number(s.balance) : 0;
  const realBalance = origBal > 0 ? Math.max(0, realNetTotal - realPaid) : 0;

  return { grossTotal, discAmt, realNetTotal, realPaid, realBalance };
}

function isYesterday(d) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(d, yesterday);
}

function isThisWeek(d) {
  const now = new Date();
  const diffDays = (now - d) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 7;
}

function isLastWeek(d) {
  const now = new Date();
  const diffDays = (now - d) / (1000 * 60 * 60 * 24);
  return diffDays > 7 && diffDays <= 14;
}

function isThisMonth(d) {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

function isLastMonth(d) {
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return d.getFullYear() === lastMonth.getFullYear() && d.getMonth() === lastMonth.getMonth();
}

export default function AdminDashboard({
  state,
  setState,
  onLogout,
  onMarkPaid,
  onDeleteSale,
  onAddExpense,
  onDeleteExpense,
  onSyncSettings,
  onWipeAll,
  onExportJson,
  onExportCsv,
  onImportJson,
  setActiveModalSale
}) {
  const [adminTab, setAdminTab] = useState('analytics');

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey);

  // Form states for new items, sets, staff, and expenses
  const [newSetName, setNewSetName] = useState('');
  const [newSetPrice, setNewSetPrice] = useState('');
  const [newMiscName, setNewMiscName] = useState('');
  const [newMiscPrice, setNewMiscPrice] = useState('');
  const [newPrintSize, setNewPrintSize] = useState('');
  const [newPhotoCount, setNewPhotoCount] = useState('');
  const [newStaffName, setNewStaffName] = useState('');

  // Expense form state
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('Supplies');
  const [expStaff, setExpStaff] = useState(state.lastStaff || (state.staff[0] || 'Umar'));

  // Search & Filter state for Sales Audit & Expenses
  const [searchBox, setSearchBox] = useState('');
  const [filterStaff, setFilterStaff] = useState('');
  const [filterDay, setFilterDay] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Calculated Metrics
  const salesList = state.sales || [];
  const expensesList = state.expenses || [];

  let sToday = 0, sYesterday = 0, sWeek = 0, sLastWeek = 0, sMonth = 0, sLastMonth = 0, sTotalAll = 0, totalPendingBal = 0, paidCount = 0;
  let expToday = 0, expYesterday = 0, expWeek = 0, expLastWeek = 0, expMonth = 0, expLastMonth = 0, expTotalAll = 0;
  let discToday = 0, discMonth = 0, discTotalAll = 0, discCountAll = 0;

  const categoryTotals = { Print: 0, Frame: 0, Pictures: 0, 'C.T.C': 0, '1x1': 0, Set: 0, Item: 0, Custom: 0 };
  const staffPerformance = {};

  // Extract all available YYYY-MM keys from transactions & expenses
  const availableMonthsSet = new Set([currentMonthKey]);
  salesList.forEach(s => {
    const d = new Date(s.ts);
    availableMonthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  });
  expensesList.forEach(e => {
    const d = new Date(e.ts);
    availableMonthsSet.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  });

  const availableMonths = Array.from(availableMonthsSet).sort().reverse();

  // Sales aggregation
  salesList.forEach(s => {
    const d = new Date(s.ts);
    const total = Number(s.total || 0);
    const paid = Number(s.paid != null ? s.paid : total);
    const bal = Number(s.balance != null ? s.balance : Math.max(0, total - paid));

    // Discount calculation for this sale
    const discItems = (s.items || []).filter(it => it.cat === 'Discount' || Number(it.price) < 0);
    const saleDiscount = discItems.reduce((sum, it) => sum + Math.abs(Number(it.price || 0) * Number(it.qty || 1)), 0);
    if (saleDiscount > 0) {
      discTotalAll += saleDiscount;
      discCountAll += 1;
      if (isSameDay(d, now)) discToday += saleDiscount;
      if (isThisMonth(d)) discMonth += saleDiscount;
    }

    sTotalAll += total;
    totalPendingBal += bal;
    if (bal <= 0) paidCount++;

    if (isSameDay(d, now)) sToday += total;
    if (isYesterday(d)) sYesterday += total;
    if (isThisWeek(d)) sWeek += total;
    if (isLastWeek(d)) sLastWeek += total;
    if (isThisMonth(d)) sMonth += total;
    if (isLastMonth(d)) sLastMonth += total;

    // Staff aggregation
    const staffName = s.staff || 'Unknown';
    if (!staffPerformance[staffName]) {
      staffPerformance[staffName] = { revenue: 0, count: 0, discounts: 0 };
    }
    staffPerformance[staffName].revenue += total;
    staffPerformance[staffName].count += 1;
    if (saleDiscount > 0) {
      staffPerformance[staffName].discounts += saleDiscount;
    }
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

  // Expenses aggregation
  expensesList.forEach(e => {
    const d = new Date(e.ts);
    const amt = Number(e.amount || 0);
    expTotalAll += amt;

    if (isSameDay(d, now)) expToday += amt;
    if (isYesterday(d)) expYesterday += amt;
    if (isThisWeek(d)) expWeek += amt;
    if (isLastWeek(d)) expLastWeek += amt;
    if (isThisMonth(d)) expMonth += amt;
    if (isLastMonth(d)) expLastMonth += amt;
  });

  // Net Income calculations (Sales Revenue - Daily Expenses)
  const netToday = sToday - expToday;
  const netYesterday = sYesterday - expYesterday;
  const netWeek = sWeek - expWeek;
  const netLastWeek = sLastWeek - expLastWeek;
  const netMonth = sMonth - expMonth;
  const netLastMonth = sLastMonth - expLastMonth;
  const netTotalAll = sTotalAll - expTotalAll;

  // Specific Selected Month Inspector Calculations
  const selectedSales = salesList.filter(s => {
    const d = new Date(s.ts);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return ym === selectedMonthKey;
  });

  const selectedExpenses = expensesList.filter(e => {
    const d = new Date(e.ts);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return ym === selectedMonthKey;
  });

  const selGrossSales = selectedSales.reduce((sum, s) => sum + Number(s.total || 0), 0);
  const selExpenses = selectedExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const selNetProfit = selGrossSales - selExpenses;
  const selOrderCount = selectedSales.length;
  const selAvgOrder = selOrderCount > 0 ? Math.round(selGrossSales / selOrderCount) : 0;

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
    const dayExpense = expensesList
      .filter(e => isSameDay(new Date(e.ts), date))
      .reduce((sum, e) => sum + Number(e.amount || 0), 0);
    return { day: dayName, revenue: dayRevenue, expense: dayExpense, net: dayRevenue - dayExpense };
  });

  const maxDayRevenue = Math.max(...last7Days.map(d => d.revenue), 1000);

  // Category Donut Chart Math
  const catColors = {
    Print: '#2563EB',
    Frame: '#059669',
    Pictures: '#D97706',
    'C.T.C': '#0284C7',
    '1x1': '#7C3AED',
    Set: '#DB2777',
    Item: '#4B5563',
    Custom: '#2563EB'
  };

  const catEntries = Object.entries(categoryTotals).filter(([, val]) => val > 0);
  const totalCatRevenue = catEntries.reduce((a, [, v]) => a + v, 0) || 1;

  // Match period helper for tables
  const matchPeriod = (d, filterVal) => {
    if (!filterVal) return true;
    if (filterVal === "today") return isSameDay(d, now);
    if (filterVal === "yesterday") return isYesterday(d);
    if (filterVal === "week") return isThisWeek(d);
    if (filterVal === "last_week") return isLastWeek(d);
    if (filterVal === "month") return isThisMonth(d);
    if (filterVal === "last_month") return isLastMonth(d);
    if (filterVal === "selected_month") {
      const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      return ym === selectedMonthKey;
    }
    return true;
  };

  // Filtered Sales for Audit
  const filteredSales = salesList.filter(s => {
    const d = new Date(s.ts);
    if (filterStaff && s.staff !== filterStaff) return false;
    if (!matchPeriod(d, filterDay)) return false;
    const bal = s.balance != null ? s.balance : 0;
    if (filterStatus === "balance" && bal <= 0) return false;
    if (filterStatus === "paid" && bal > 0) return false;
    const q = searchBox.toLowerCase().trim();
    if (q && s.id.toLowerCase().indexOf(q) < 0 && (s.customer || "").toLowerCase().indexOf(q) < 0) return false;
    return true;
  });

  // Filtered Expenses
  const filteredExpenses = expensesList.filter(e => {
    const d = new Date(e.ts);
    if (filterStaff && e.staff !== filterStaff) return false;
    if (!matchPeriod(d, filterDay)) return false;
    const q = searchBox.toLowerCase().trim();
    if (q && e.title.toLowerCase().indexOf(q) < 0 && (e.category || "").toLowerCase().indexOf(q) < 0) return false;
    return true;
  });

  const printSizes = Object.keys(state.prints || {});
  const TYPES = [["normal", "Normal EXP"], ["bg", "BG Change"], ["reorder", "Re-order"], ["urgent", "Re-order (Urgent)"]];

  const defaultPP = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56];
  const photoCounts = Array.from(new Set([
    ...Object.keys(state.albumExp || {}).map(Number),
    ...Object.keys(state.albumRo || {}).map(Number),
    ...Object.keys(state.ctcExp || {}).map(Number),
    ...Object.keys(state.ctcRo || {}).map(Number),
    ...Object.keys(state.oneByOneExp || {}).map(Number),
    ...Object.keys(state.oneByOneRo || {}).map(Number),
    ...defaultPP
  ])).filter(n => !isNaN(n) && n > 0).sort((a, b) => a - b);

  const handleAddPhotoCount = () => {
    const cnt = Number(newPhotoCount);
    if (!cnt || cnt <= 0) return;
    const nextState = {
      ...state,
      albumExp: { ...state.albumExp, [cnt]: state.albumExp[cnt] ?? 0 },
      albumRo: { ...state.albumRo, [cnt]: state.albumRo[cnt] ?? 0 },
      ctcExp: { ...state.ctcExp, [cnt]: state.ctcExp[cnt] ?? 0 },
      ctcRo: { ...state.ctcRo, [cnt]: state.ctcRo[cnt] ?? 0 },
      oneByOneExp: { ...state.oneByOneExp, [cnt]: state.oneByOneExp[cnt] ?? 0 },
      oneByOneRo: { ...state.oneByOneRo, [cnt]: state.oneByOneRo[cnt] ?? 0 }
    };
    setState(nextState);
    onSyncSettings(nextState);
    setNewPhotoCount('');
  };

  const handleDeletePhotoCount = (cnt) => {
    if (!window.confirm(`Remove photo count option ${cnt}?`)) return;
    const nextState = { ...state };
    ['albumExp', 'albumRo', 'ctcExp', 'ctcRo', 'oneByOneExp', 'oneByOneRo'].forEach(key => {
      if (nextState[key]) {
        const copy = { ...nextState[key] };
        delete copy[cnt];
        nextState[key] = copy;
      }
    });
    setState(nextState);
    onSyncSettings(nextState);
  };

  const updatePhotoRate = (categoryKey, cnt, rawVal) => {
    const val = rawVal === '' ? '' : Number(rawVal) || 0;
    const nextState = {
      ...state,
      [categoryKey]: {
        ...(state[categoryKey] || {}),
        [cnt]: val
      }
    };
    setState(nextState);
    onSyncSettings(nextState);
  };

  // Rate additions
  const handleAddMiscItem = () => {
    const name = newMiscName.trim();
    const price = Number(newMiscPrice) || 0;
    if (!name) return;
    const nextState = {
      ...state,
      misc: [...state.misc, { name, price }]
    };
    setState(nextState);
    onSyncSettings(nextState);
    setNewMiscName('');
    setNewMiscPrice('');
  };

  const handleAddSetItem = () => {
    const name = newSetName.trim();
    const price = Number(newSetPrice) || 0;
    if (!name) return;
    const nextState = {
      ...state,
      sets: [...state.sets, { name, price }]
    };
    setState(nextState);
    onSyncSettings(nextState);
    setNewSetName('');
    setNewSetPrice('');
  };

  const handleAddPrintSize = () => {
    const sz = newPrintSize.trim();
    if (!sz) return;
    if (state.prints[sz]) {
      alert(`Size ${sz} already exists.`);
      return;
    }
    const nextState = {
      ...state,
      prints: { ...state.prints, [sz]: { normal: 0, bg: 0, reorder: 0, urgent: 0 } },
      frames: { ...state.frames, [sz]: 0 }
    };
    setState(nextState);
    onSyncSettings(nextState);
    setNewPrintSize('');
  };

  const submitExpense = (e) => {
    e.preventDefault();
    if (!expTitle.trim() || !expAmount) return;
    onAddExpense({
      title: expTitle,
      amount: expAmount,
      category: expCategory,
      staff: expStaff
    });
    setExpTitle('');
    setExpAmount('');
  };

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
              Real-time sales revenue, expense tracking, net profit, and historical monthly archives.
            </div>
          </div>
          <button className="btn danger sm" onClick={onLogout} style={{ borderRadius: '8px' }}>
            🔒 Sign Out Admin
          </button>
        </div>
      </div>

      {/* TOP FINANCIAL KPI CARDS */}
      <div className="kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        
        {/* TODAY GROSS SALES */}
        <div className="card stat-kpi" style={{ padding: '18px 20px', borderLeft: '4px solid #2563EB' }}>
          <div className="k" style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Today's Gross Sales</div>
          <div className="v mono" style={{ fontSize: '24px', fontWeight: 800, color: '#2563EB', marginTop: '4px' }}>{money(sToday)}</div>
          <div style={{ fontSize: '12px', color: '#059669', marginTop: '6px', fontWeight: 600 }}>Live Receipts Today</div>
        </div>

        {/* TODAY EXPENSES */}
        <div className="card stat-kpi" style={{ padding: '18px 20px', borderLeft: '4px solid #DC2626' }}>
          <div className="k" style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Today's Expenses</div>
          <div className="v mono" style={{ fontSize: '24px', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>{money(expToday)}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>{expensesList.filter(e => isSameDay(new Date(e.ts), now)).length} expense(s) logged</div>
        </div>

        {/* TODAY DISCOUNTS GIVEN */}
        <div className="card stat-kpi" style={{ padding: '18px 20px', borderLeft: '4px solid #D97706' }}>
          <div className="k" style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Today's Discounts</div>
          <div className="v mono" style={{ fontSize: '24px', fontWeight: 800, color: '#D97706', marginTop: '4px' }}>{money(discToday)}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>Discount granted to customers</div>
        </div>

        {/* TODAY NET INCOME / PROFIT */}
        <div className="card stat-kpi" style={{ padding: '18px 20px', borderLeft: `4px solid ${netToday >= 0 ? '#10B981' : '#DC2626'}` }}>
          <div className="k" style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Today's Net Profit</div>
          <div className="v mono" style={{ fontSize: '24px', fontWeight: 800, color: netToday >= 0 ? '#10B981' : '#DC2626', marginTop: '4px' }}>
            {money(netToday)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>Sales minus Expenses</div>
        </div>

        {/* THIS WEEK NET INCOME */}
        <div className="card stat-kpi" style={{ padding: '18px 20px', borderLeft: `4px solid ${netWeek >= 0 ? '#059669' : '#DC2626'}` }}>
          <div className="k" style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Week Net Income</div>
          <div className="v mono" style={{ fontSize: '24px', fontWeight: 800, color: netWeek >= 0 ? '#059669' : '#DC2626', marginTop: '4px' }}>
            {money(netWeek)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>Past 7 days Net Profit</div>
        </div>

        {/* THIS MONTH NET INCOME */}
        <div className="card stat-kpi" style={{ padding: '18px 20px', borderLeft: '4px solid #7C3AED' }}>
          <div className="k" style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Month Net Income</div>
          <div className="v mono" style={{ fontSize: '24px', fontWeight: 800, color: '#7C3AED', marginTop: '4px' }}>{money(netMonth)}</div>
          <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '6px' }}>Sales ({money(sMonth)}) - Exp ({money(expMonth)})</div>
        </div>

      </div>

      {/* ADMIN INNER TABS NAVIGATION */}
      <nav className="tabs" style={{ marginBottom: '24px' }}>
        <button className={adminTab === 'analytics' ? 'active' : ''} onClick={() => setAdminTab('analytics')}>📈 Analytics &amp; Graphs</button>
        <button className={adminTab === 'expenses' ? 'active' : ''} onClick={() => setAdminTab('expenses')}>💸 Daily Expenses &amp; Net Profit</button>
        <button className={adminTab === 'audit' ? 'active' : ''} onClick={() => setAdminTab('audit')}>📋 Sales Audit ({totalSalesCount})</button>
        <button className={adminTab === 'prices' ? 'active' : ''} onClick={() => setAdminTab('prices')}>🏷️ Rate List &amp; Custom Services</button>
        <button className={adminTab === 'team' ? 'active' : ''} onClick={() => setAdminTab('team')}>👥 Team &amp; Staff</button>
        <button className={adminTab === 'system' ? 'active' : ''} onClick={() => setAdminTab('system')}>⚙️ System &amp; Backup</button>
      </nav>

      {/* TAB 1: ANALYTICS & GRAPH DASHBOARD */}
      {adminTab === 'analytics' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
          
          {/* MONTHLY FINANCIAL INSPECTOR (SELECT ANY SPECIFIC MONTH) */}
          <div className="card" style={{ gridColumn: '1 / -1', border: '2px solid var(--accent)' }}>
            <h2>
              <span>📅 Specific Month Financial Inspector</span>
              <span className="badge" style={{ background: '#EFF6FF', color: '#2563EB' }}>Archive &amp; History</span>
            </h2>
            <div className="body">
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px', padding: '16px', background: 'var(--paper)', borderRadius: '12px', border: '1px solid var(--line)' }}>
                <div style={{ flex: 1, minWidth: '220px' }}>
                  <label style={{ fontWeight: 700, fontSize: '13.5px', marginBottom: '6px', display: 'block' }}>
                    Select Month &amp; Year to Inspect:
                  </label>
                  <select
                    value={selectedMonthKey}
                    onChange={(e) => setSelectedMonthKey(e.target.value)}
                    style={{ fontSize: '15px', fontWeight: 800, padding: '10px 14px', borderRadius: '10px', color: 'var(--accent)' }}
                  >
                    {availableMonths.map(mKey => (
                      <option key={mKey} value={mKey}>
                        {fmtMonthKey(mKey)} {mKey === currentMonthKey ? ' (Current Month)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ fontWeight: 700, fontSize: '13.5px', marginBottom: '6px', display: 'block' }}>
                    Or Pick Custom Month:
                  </label>
                  <input
                    type="month"
                    value={selectedMonthKey}
                    onChange={(e) => e.target.value && setSelectedMonthKey(e.target.value)}
                    style={{ fontSize: '15px', fontWeight: 800, padding: '9px 12px', borderRadius: '10px' }}
                  />
                </div>
              </div>

              {/* STATS GRID FOR SELECTED MONTH */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                <div style={{ padding: '16px', background: 'var(--paper)', borderRadius: '12px', border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Gross Sales ({fmtMonthKey(selectedMonthKey)})</div>
                  <div className="mono" style={{ fontSize: '22px', fontWeight: 800, color: 'var(--accent)', marginTop: '4px' }}>{money(selGrossSales)}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>{selOrderCount} receipt(s)</div>
                </div>

                <div style={{ padding: '16px', background: 'var(--paper)', borderRadius: '12px', border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Expenses ({fmtMonthKey(selectedMonthKey)})</div>
                  <div className="mono" style={{ fontSize: '22px', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>- {money(selExpenses)}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>{selectedExpenses.length} expense item(s)</div>
                </div>

                <div style={{ padding: '16px', background: selNetProfit >= 0 ? '#ECFDF5' : '#FEF2F2', borderRadius: '12px', border: `1px solid ${selNetProfit >= 0 ? '#10B981' : '#EF4444'}` }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Net Profit ({fmtMonthKey(selectedMonthKey)})</div>
                  <div className="mono" style={{ fontSize: '24px', fontWeight: 900, color: selNetProfit >= 0 ? '#059669' : '#DC2626', marginTop: '4px' }}>
                    {money(selNetProfit)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Net Revenue after Expenses</div>
                </div>

                <div style={{ padding: '16px', background: 'var(--paper)', borderRadius: '12px', border: '1px solid var(--line)' }}>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Avg Order Value ({fmtMonthKey(selectedMonthKey)})</div>
                  <div className="mono" style={{ fontSize: '22px', fontWeight: 800, color: 'var(--ink)', marginTop: '4px' }}>{money(selAvgOrder)}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Average per order</div>
                </div>
              </div>
            </div>
          </div>

          {/* BAR CHART: REVENUE VS EXPENSE TREND (7 DAYS) */}
          <div className="card">
            <h2>
              <span>📈 7-Day Revenue &amp; Net Income Trend</span>
              <span className="badge">Daily Sales</span>
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
                        title={`${item.day} - Sales: ${money(item.revenue)} | Exp: ${money(item.expense)} | Net: ${money(item.net)}`}
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

          {/* FINANCIAL SUMMARY & HISTORICAL PERIOD COMPARISON */}
          <div className="card">
            <h2>
              <span>💳 Financial Statement &amp; Period Net Income</span>
              <span className="badge">Comparison</span>
            </h2>
            <div className="body stack">
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--paper)', borderRadius: '10px' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Today's Net Income:</span>
                <b className="mono" style={{ color: netToday >= 0 ? '#059669' : '#DC2626', fontSize: '15.5px' }}>{money(netToday)}</b>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--paper)', borderRadius: '10px' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Yesterday's Net Income:</span>
                <b className="mono" style={{ color: netYesterday >= 0 ? '#059669' : '#DC2626', fontSize: '15.5px' }}>{money(netYesterday)}</b>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--paper)', borderRadius: '10px' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>This Week's Net Income (Past 7 Days):</span>
                <b className="mono" style={{ color: netWeek >= 0 ? '#059669' : '#DC2626', fontSize: '15.5px' }}>{money(netWeek)}</b>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--paper)', borderRadius: '10px' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Last Week's Net Income (Days 8-14):</span>
                <b className="mono" style={{ color: netLastWeek >= 0 ? '#2563EB' : '#DC2626', fontSize: '15.5px' }}>{money(netLastWeek)}</b>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--paper)', borderRadius: '10px' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>This Month's Net Income:</span>
                <b className="mono" style={{ color: netMonth >= 0 ? '#7C3AED' : '#DC2626', fontSize: '15.5px' }}>{money(netMonth)}</b>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: 'var(--paper)', borderRadius: '10px' }}>
                <span style={{ color: 'var(--muted)', fontWeight: 600 }}>Last Month's Net Income:</span>
                <b className="mono" style={{ color: netLastMonth >= 0 ? '#7C3AED' : '#DC2626', fontSize: '15.5px' }}>{money(netLastMonth)}</b>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 14px', background: netTotalAll >= 0 ? '#ECFDF5' : '#FEF2F2', borderRadius: '10px', border: `1px solid ${netTotalAll >= 0 ? '#10B981' : '#EF4444'}` }}>
                <span style={{ fontWeight: 800, color: 'var(--ink)' }}>All-Time Net Profit:</span>
                <b className="mono" style={{ color: netTotalAll >= 0 ? '#059669' : '#DC2626', fontSize: '17px', fontWeight: 900 }}>
                  {money(netTotalAll)}
                </b>
              </div>
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

        </div>
      )}

      {/* TAB 2: DAILY EXPENSES & NET INCOME */}
      {adminTab === 'expenses' && (
        <div className="grid">
          {/* LEFT COLUMN: LOG NEW EXPENSE */}
          <div className="card">
            <h2>
              <span>💸 Log New Expense</span>
              <span className="badge" style={{ background: '#FEF2F2', color: '#DC2626' }}>Daily Outflow</span>
            </h2>
            <div className="body">
              <form onSubmit={submitExpense}>
                <div className="field">
                  <label>Expense Purpose / Description</label>
                  <input
                    placeholder="e.g. Printing Paper Roll, Electricity, Tea / Refreshments"
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="row r2">
                  <div className="field">
                    <label>Amount ({CUR})</label>
                    <input
                      className="mono"
                      type="number"
                      min="1"
                      step="1"
                      placeholder="0"
                      value={expAmount}
                      onChange={(e) => setExpAmount(e.target.value)}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Category</label>
                    <select value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>
                      <option value="Supplies">📦 Paper / Printing Supplies</option>
                      <option value="Utilities">⚡ Electricity / Utilities</option>
                      <option value="Food/Tea">☕ Tea / Refreshments</option>
                      <option value="Transport">🚚 Transport / Delivery</option>
                      <option value="Maintenance">🛠️ Equipment Maintenance</option>
                      <option value="Rent">🏢 Rent / Shop Expense</option>
                      <option value="Salary">💰 Staff Advance / Salary</option>
                      <option value="Other">🌀 Other Miscellaneous</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>Logged By Staff Member</label>
                  <select value={expStaff} onChange={(e) => setExpStaff(e.target.value)}>
                    {state.staff.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>

                <button className="btn primary block" type="submit" style={{ marginTop: '10px', background: '#DC2626', borderColor: '#DC2626' }}>
                  ➖ Record Expense &amp; Update Net Profit
                </button>
              </form>
            </div>
          </div>

          {/* RIGHT COLUMN: DAILY NET INCOME & EXPENSE LOG */}
          <div className="card">
            <h2>
              <span>📋 Expense Log &amp; Period Net Income</span>
              <span className="badge">{filteredExpenses.length} expense(s)</span>
            </h2>
            <div className="body">
              {/* FILTERS */}
              <div className="filters" style={{ marginBottom: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label>Search Expenses</label>
                  <input
                    className="search"
                    placeholder="Search description or category…"
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
                  <label>Period Filter</label>
                  <select value={filterDay} onChange={(e) => setFilterDay(e.target.value)}>
                    <option value="">All Time</option>
                    <option value="today">Today</option>
                    <option value="yesterday">Yesterday</option>
                    <option value="week">This Week (Past 7 Days)</option>
                    <option value="last_week">Last Week (Days 8-14)</option>
                    <option value="month">This Month</option>
                    <option value="last_month">Last Month</option>
                    <option value="selected_month">Inspect Selected Month ({fmtMonthKey(selectedMonthKey)})</option>
                  </select>
                </div>
              </div>

              {!filteredExpenses.length ? (
                <div className="empty-state">No expense records logged for this period.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Date &amp; Time</th>
                        <th>Staff</th>
                        <th>Category</th>
                        <th>Description</th>
                        <th className="num">Amount</th>
                        <th style={{ textAlign: 'center' }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredExpenses.map(e => (
                        <tr key={e.id}>
                          <td style={{ fontSize: '12.5px' }}>{fmtDate(e.ts)}</td>
                          <td>{e.staff || '—'}</td>
                          <td><span className="badge" style={{ margin: 0, fontSize: '10.5px' }}>{e.category}</span></td>
                          <td style={{ fontWeight: 700 }}>{e.title}</td>
                          <td className="num mono" style={{ color: '#DC2626', fontWeight: 800 }}>- {money(e.amount)}</td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              className="x"
                              title="Delete expense"
                              onClick={() => onDeleteExpense && onDeleteExpense(e.id)}
                            >
                              ×
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: SALES AUDIT & RECORDS */}
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
                <label>Period Filter</label>
                <select value={filterDay} onChange={(e) => setFilterDay(e.target.value)}>
                  <option value="">All Time</option>
                  <option value="today">Today</option>
                  <option value="yesterday">Yesterday</option>
                  <option value="week">This Week (Past 7 Days)</option>
                  <option value="last_week">Last Week (Days 8-14)</option>
                  <option value="month">This Month</option>
                  <option value="last_month">Last Month</option>
                  <option value="selected_month">Inspect Selected Month ({fmtMonthKey(selectedMonthKey)})</option>
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
                      <th>Payment</th>
                      <th className="num">Total</th>
                      <th className="num">Discount</th>
                      <th className="num">Paid</th>
                      <th className="num">Balance</th>
                      <th style={{ textAlign: 'center' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map(s => {
                      const { grossTotal, discAmt, realNetTotal, realPaid, realBalance } = getSaleTotals(s);
                      const pm = s.payMethod === 'Online' ? 'Online' : 'Cash';
                      return (
                        <tr key={s.id} className="click" onClick={() => setActiveModalSale(s)}>
                          <td className="mono" style={{ fontWeight: 700 }}>{s.id}</td>
                          <td>{fmtDate(s.ts)}</td>
                          <td>{s.staff || '—'}</td>
                          <td>{s.customer || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                          <td>
                            <span className="badge" style={{ margin: 0, background: pm === 'Online' ? '#F3E8FF' : '#F1F5F9', color: pm === 'Online' ? '#7C3AED' : '#475569', fontSize: '11px' }}>
                              {pm === 'Online' ? '💳 Online' : '💵 Cash'}
                            </span>
                          </td>
                          <td className="num">
                            <div className="mono" style={{ fontWeight: 800 }}>{money(realNetTotal)}</div>
                            {discAmt > 0 && (
                              <div style={{ fontSize: '10.5px', color: 'var(--muted)' }}>Subtotal: {money(grossTotal)}</div>
                            )}
                          </td>
                          <td className="num">
                            {discAmt > 0 ? (
                              <span className="mono" style={{ color: '#DC2626', fontWeight: 800 }}>- {money(discAmt)}</span>
                            ) : (
                              <span style={{ color: 'var(--muted)' }}>—</span>
                            )}
                          </td>
                          <td className="num mono">{money(realPaid)}</td>
                          <td className="num">
                            {realBalance > 0 ? (
                              <span className="mono" style={{ color: 'var(--danger)', fontWeight: 800 }}>{money(realBalance)}</span>
                            ) : (
                              <span style={{ color: '#059669', fontWeight: 700 }}>Paid</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center' }}>
                              {realBalance > 0 && (
                                <>
                                  <button
                                    className="btn primary sm"
                                    title="Mark Paid as Cash"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onMarkPaid(s.id, 'Cash');
                                    }}
                                  >
                                    💵 Cash
                                  </button>
                                  <button
                                    className="btn primary sm"
                                    style={{ background: '#7C3AED', borderColor: '#7C3AED' }}
                                    title="Mark Paid as Online"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onMarkPaid(s.id, 'Online');
                                    }}
                                  >
                                    💳 Online
                                  </button>
                                </>
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

      {/* TAB 4: RATE LIST & CUSTOM SERVICES EDITOR */}
      {adminTab === 'prices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* PHOTO COUNT RATES EDITOR (PICTURES, C.T.C, 1x1) */}
          <div className="card">
            <h2>📷 Photo Count Rate Management (Pictures, C.T.C &amp; 1x1)</h2>
            <div className="body">
              <p className="hint" style={{ marginTop: 0 }}>
                Edit rates per photo count below. Changes sync instantly to <b>Supabase Cloud Database</b>.
              </p>

              {/* ADD NEW PHOTO COUNT */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'flex-end', flexWrap: 'wrap', padding: '14px', background: 'var(--paper)', borderRadius: '12px', border: '1px solid var(--line)' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <label>Add New Photo Count / PP Option</label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 60"
                    value={newPhotoCount}
                    onChange={(e) => setNewPhotoCount(e.target.value)}
                  />
                </div>
                <button className="btn primary" onClick={handleAddPhotoCount}>
                  ➕ Add Count Option
                </button>
              </div>

              {/* PHOTO COUNT RATES TABLE */}
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Count / PP</th>
                      <th className="num">Pictures (EXP)</th>
                      <th className="num">Pictures (R.O)</th>
                      <th className="num">C.T.C (EXP)</th>
                      <th className="num">C.T.C (R.O)</th>
                      <th className="num">1x1 (EXP)</th>
                      <th className="num">1x1 (R.O)</th>
                      <th style={{ textAlign: 'center' }}>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {photoCounts.map(cnt => (
                      <tr key={cnt}>
                        <td><b>{cnt} Count</b></td>
                        <td className="num">
                          <input
                            type="number"
                            min="0"
                            className="price-in mono"
                            value={(state.albumExp && state.albumExp[cnt] !== undefined) ? state.albumExp[cnt] : ''}
                            onChange={(e) => updatePhotoRate('albumExp', cnt, e.target.value)}
                          />
                        </td>
                        <td className="num">
                          <input
                            type="number"
                            min="0"
                            className="price-in mono"
                            value={(state.albumRo && state.albumRo[cnt] !== undefined) ? state.albumRo[cnt] : ''}
                            onChange={(e) => updatePhotoRate('albumRo', cnt, e.target.value)}
                          />
                        </td>
                        <td className="num">
                          <input
                            type="number"
                            min="0"
                            className="price-in mono"
                            value={(state.ctcExp && state.ctcExp[cnt] !== undefined) ? state.ctcExp[cnt] : ''}
                            onChange={(e) => updatePhotoRate('ctcExp', cnt, e.target.value)}
                          />
                        </td>
                        <td className="num">
                          <input
                            type="number"
                            min="0"
                            className="price-in mono"
                            value={(state.ctcRo && state.ctcRo[cnt] !== undefined) ? state.ctcRo[cnt] : ''}
                            onChange={(e) => updatePhotoRate('ctcRo', cnt, e.target.value)}
                          />
                        </td>
                        <td className="num">
                          <input
                            type="number"
                            min="0"
                            className="price-in mono"
                            value={(state.oneByOneExp && state.oneByOneExp[cnt] !== undefined) ? state.oneByOneExp[cnt] : ''}
                            onChange={(e) => updatePhotoRate('oneByOneExp', cnt, e.target.value)}
                          />
                        </td>
                        <td className="num">
                          <input
                            type="number"
                            min="0"
                            className="price-in mono"
                            value={(state.oneByOneRo && state.oneByOneRo[cnt] !== undefined) ? state.oneByOneRo[cnt] : ''}
                            onChange={(e) => updatePhotoRate('oneByOneRo', cnt, e.target.value)}
                          />
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="x"
                            title="Remove photo count"
                            onClick={() => handleDeletePhotoCount(cnt)}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* PRINTS & FRAMES RATE EDITOR */}
          <div className="card">
            <h2>📸 Print &amp; Frame Rate Management</h2>
            <div className="body">
              <p className="hint" style={{ marginTop: 0 }}>
                Edit print and frame rates below. Changes sync instantly to <b>Supabase Cloud Database</b>.
              </p>

              {/* ADD NEW PRINT/FRAME SIZE */}
              <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', alignItems: 'flex-end', flexWrap: 'wrap', padding: '14px', background: 'var(--paper)', borderRadius: '12px', border: '1px solid var(--line)' }}>
                <div style={{ flex: 1, minWidth: '180px' }}>
                  <label>Add New Print / Frame Size</label>
                  <input
                    placeholder="e.g. 30x40"
                    value={newPrintSize}
                    onChange={(e) => setNewPrintSize(e.target.value)}
                  />
                </div>
                <button className="btn primary" onClick={handleAddPrintSize}>
                  ➕ Add New Size
                </button>
              </div>

              {/* PRINTS TABLE */}
              <div className="subhead">Photo Print Rates</div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Size</th>
                      {TYPES.map(([k, t]) => <th key={k} className="num">{t}</th>)}
                      <th style={{ textAlign: 'center' }}>Remove</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printSizes.map(sz => (
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
                        <td style={{ textAlign: 'center' }}>
                          <button
                            className="x"
                            title="Remove size"
                            onClick={() => {
                              if (!window.confirm(`Remove size ${sz}?`)) return;
                              const newPrints = { ...state.prints };
                              delete newPrints[sz];
                              const newFrames = { ...state.frames };
                              delete newFrames[sz];
                              const nextState = { ...state, prints: newPrints, frames: newFrames };
                              setState(nextState);
                              onSyncSettings(nextState);
                            }}
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* FRAMES TABLE */}
              <div className="subhead">Photo Frame Rates</div>
              <div style={{ overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Size</th>
                      <th className="num">Frame price ({CUR})</th>
                    </tr>
                  </thead>
                  <tbody>
                    {printSizes.map(sz => (
                      <tr key={sz}>
                        <td><b>{sz} Frame</b></td>
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

          {/* MISC SERVICES & PRODUCTS EDITOR */}
          <div className="grid">
            <div className="card">
              <h2>🛠️ Other Items &amp; Custom Services</h2>
              <div className="body">
                {!state.misc.length ? (
                  <div className="empty-state">No custom items defined yet.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Service / Product Name</th>
                          <th className="num">Rate ({CUR})</th>
                          <th style={{ textAlign: 'center' }}>Remove</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.misc.map((m, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                value={m.name}
                                style={{ width: '100%', border: 'none', background: 'transparent', fontWeight: 600 }}
                                onChange={(e) => {
                                  const newName = e.target.value;
                                  const nextMisc = [...state.misc];
                                  nextMisc[idx] = { ...nextMisc[idx], name: newName };
                                  const nextState = { ...state, misc: nextMisc };
                                  setState(nextState);
                                  onSyncSettings(nextState);
                                }}
                              />
                            </td>
                            <td className="num">
                              <input
                                type="number"
                                min="0"
                                className="price-in mono"
                                value={m.price !== undefined ? m.price : ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? '' : Number(e.target.value) || 0;
                                  const nextMisc = [...state.misc];
                                  nextMisc[idx] = { ...nextMisc[idx], price: val };
                                  const nextState = { ...state, misc: nextMisc };
                                  setState(nextState);
                                  onSyncSettings(nextState);
                                }}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="x"
                                title="Remove item"
                                onClick={() => {
                                  if (!window.confirm(`Delete ${m.name}?`)) return;
                                  const nextState = {
                                    ...state,
                                    misc: state.misc.filter((_, i) => i !== idx)
                                  };
                                  setState(nextState);
                                  onSyncSettings(nextState);
                                }}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ADD NEW MISC ITEM */}
            <div className="card">
              <h2>➕ Add New Service / Item</h2>
              <div className="body">
                <div className="field">
                  <label>Item / Service Name</label>
                  <input
                    placeholder="e.g. Mug Print, Soft Copy CD, Scan"
                    value={newMiscName}
                    onChange={(e) => setNewMiscName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Rate ({CUR})</label>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newMiscPrice}
                    onChange={(e) => setNewMiscPrice(e.target.value)}
                  />
                </div>
                <button className="btn primary block" onClick={handleAddMiscItem}>
                  ➕ Add New Item to Rate List
                </button>
              </div>
            </div>
          </div>

          {/* PACKAGE SETS & COMBOS EDITOR */}
          <div className="grid">
            <div className="card">
              <h2>🎁 Combo &amp; Package Sets</h2>
              <div className="body">
                {!state.sets.length ? (
                  <div className="empty-state">No package sets defined yet.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Package Name</th>
                          <th className="num">Price ({CUR})</th>
                          <th style={{ textAlign: 'center' }}>Remove</th>
                        </tr>
                      </thead>
                      <tbody>
                        {state.sets.map((st, idx) => (
                          <tr key={idx}>
                            <td>
                              <input
                                value={st.name}
                                style={{ width: '100%', border: 'none', background: 'transparent', fontWeight: 600 }}
                                onChange={(e) => {
                                  const newName = e.target.value;
                                  const nextSets = [...state.sets];
                                  nextSets[idx] = { ...nextSets[idx], name: newName };
                                  const nextState = { ...state, sets: nextSets };
                                  setState(nextState);
                                  onSyncSettings(nextState);
                                }}
                              />
                            </td>
                            <td className="num">
                              <input
                                type="number"
                                min="0"
                                className="price-in mono"
                                value={st.price !== undefined ? st.price : ''}
                                onChange={(e) => {
                                  const val = e.target.value === '' ? '' : Number(e.target.value) || 0;
                                  const nextSets = [...state.sets];
                                  nextSets[idx] = { ...nextSets[idx], price: val };
                                  const nextState = { ...state, sets: nextSets };
                                  setState(nextState);
                                  onSyncSettings(nextState);
                                }}
                              />
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              <button
                                className="x"
                                title="Remove combo"
                                onClick={() => {
                                  if (!window.confirm(`Delete package ${st.name}?`)) return;
                                  const nextState = {
                                    ...state,
                                    sets: state.sets.filter((_, i) => i !== idx)
                                  };
                                  setState(nextState);
                                  onSyncSettings(nextState);
                                }}
                              >
                                ×
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* ADD NEW COMBO SET */}
            <div className="card">
              <h2>➕ Add New Combo Package</h2>
              <div className="body">
                <div className="field">
                  <label>Package / Combo Name</label>
                  <input
                    placeholder="e.g. Set — 8 PP + 8 1x1 pics"
                    value={newSetName}
                    onChange={(e) => setNewSetName(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Package Rate ({CUR})</label>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    placeholder="0"
                    value={newSetPrice}
                    onChange={(e) => setNewSetPrice(e.target.value)}
                  />
                </div>
                <button className="btn primary block" onClick={handleAddSetItem}>
                  ➕ Add New Combo Package
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: TEAM & STAFF */}
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

      {/* TAB 6: SYSTEM & BACKUP */}
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
