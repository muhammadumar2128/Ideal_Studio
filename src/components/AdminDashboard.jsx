import React, { useState, useEffect } from 'react';

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

function downloadFile(fileName, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 500);
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
  onToggleVoidSale,
  onDeleteSale,
  onAddExpense,
  onDeleteExpense,
  onSyncSettings,
  onWipeAll,
  onExportJson,
  onExportCsv,
  onImportJson,
  setActiveModalSale,
  onOpenDrawer,
  onDrawerAdjustment,
  onCloseDrawer,
  onDeleteDrawerHistory,
  onChangeAdminPassword,
  onClockIn,
  onToggleBreak,
  onClockOut,
  onSaveManualAttendance,
  onDeleteAttendance,
  onAuthorizeTerminal,
  onRevokeTerminal,
  onRegenerateTerminalKey,
  onUpdateShopHours
}) {
  const [adminTab, setAdminTab] = useState('analytics');

  const now = new Date();
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonthKey, setSelectedMonthKey] = useState(currentMonthKey);

  // Shop Opening & Late Shift Rules states
  const [shopOpenTimeVal, setShopOpenTimeVal] = useState(state.shopOpenTime || "09:00");
  const [graceMinutesVal, setGraceMinutesVal] = useState(state.graceMinutes != null ? state.graceMinutes : 15);
  const [morningOpenerVal, setMorningOpenerVal] = useState(state.morningOpener || "Alex");
  const [staffSchedulesVal, setStaffSchedulesVal] = useState(state.staffSchedules || {
    "Alex": "09:00",
    "Kabeer": "18:00",
    "Umar": "09:00",
    "Owner - Usman": "10:00"
  });
  const [isSavingHours, setIsSavingHours] = useState(false);

  useEffect(() => {
    if (state.shopOpenTime) setShopOpenTimeVal(state.shopOpenTime);
    if (state.graceMinutes != null) setGraceMinutesVal(state.graceMinutes);
    if (state.morningOpener) setMorningOpenerVal(state.morningOpener);
    if (state.staffSchedules) setStaffSchedulesVal(state.staffSchedules);
  }, [state.shopOpenTime, state.graceMinutes, state.morningOpener, state.staffSchedules]);

  // Attendance and Terminal security states
  const [attSearchBox, setAttSearchBox] = useState('');
  const [attFilterStaff, setAttFilterStaff] = useState('');
  const [attFilterStatus, setAttFilterStatus] = useState('');
  const [attFilterPeriod, setAttFilterPeriod] = useState('selected_month');
  const [selectedPunchEdit, setSelectedPunchEdit] = useState(null);
  const [showPrintTimesheet, setShowPrintTimesheet] = useState(false);
  const [isCurrentDeviceAuthorized, setIsCurrentDeviceAuthorized] = useState(() => {
    return typeof window !== 'undefined' && localStorage.getItem('ideal_studio_counter_terminal_token') === (state.terminalKey || 'IPS-TAXILA-COUNTER-KEY-2026');
  });

  const formatPunchTime = (ts) => {
    if (!ts) return '—';
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const formatMinStr = (min) => {
    const m = Math.max(0, Math.round(min || 0));
    const hrs = Math.floor(m / 60);
    const rem = m % 60;
    if (hrs > 0 && rem > 0) return `${hrs}h ${rem}m`;
    if (hrs > 0) return `${hrs}h`;
    return `${rem}m`;
  };

  // Cash Drawer Shift Audit States
  const [selectedShiftSlip, setSelectedShiftSlip] = useState(null);
  const [filterDrawerStaff, setFilterDrawerStaff] = useState('');
  const [filterDrawerStatus, setFilterDrawerStatus] = useState('');

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

  // Admin password change state
  const [newAdminPass, setNewAdminPass] = useState('');
  const [confirmAdminPass, setConfirmAdminPass] = useState('');
  const [showPassText, setShowPassText] = useState(false);
  const [passFeedback, setPassFeedback] = useState(null);
  const [isSavingPass, setIsSavingPass] = useState(false);

  const handleUpdateAdminPassword = async (e) => {
    e.preventDefault();
    setPassFeedback(null);

    const cleanPass = newAdminPass.trim();
    if (!cleanPass) {
      setPassFeedback({ type: 'error', text: 'Password cannot be empty.' });
      return;
    }
    if (cleanPass.length < 4) {
      setPassFeedback({ type: 'error', text: 'Password must be at least 4 characters long.' });
      return;
    }
    if (cleanPass !== confirmAdminPass.trim()) {
      setPassFeedback({ type: 'error', text: 'Passwords do not match. Please re-enter identical passwords.' });
      return;
    }

    setIsSavingPass(true);
    try {
      if (onChangeAdminPassword) {
        await onChangeAdminPassword(cleanPass);
      }
      setPassFeedback({ type: 'success', text: 'Admin password updated and saved successfully!' });
      setNewAdminPass('');
      setConfirmAdminPass('');
    } catch (err) {
      setPassFeedback({ type: 'error', text: 'Failed to update password. Please check connection.' });
    } finally {
      setIsSavingPass(false);
    }
  };

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

  // Sales aggregation (excludes voided/duplicate sales)
  salesList.forEach(s => {
    if (s.isVoid) return;
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

    sTotalAll += paid;
    totalPendingBal += bal;
    if (bal <= 0) paidCount++;

    if (isSameDay(d, now)) sToday += paid;
    if (isYesterday(d)) sYesterday += paid;
    if (isThisWeek(d)) sWeek += paid;
    if (isLastWeek(d)) sLastWeek += paid;
    if (isThisMonth(d)) sMonth += paid;
    if (isLastMonth(d)) sLastMonth += paid;

    // Staff aggregation
    const staffName = s.staff || 'Unknown';
    if (!staffPerformance[staffName]) {
      staffPerformance[staffName] = { revenue: 0, count: 0, discounts: 0 };
    }
    staffPerformance[staffName].revenue += paid;
    staffPerformance[staffName].count += 1;
    if (saleDiscount > 0) {
      staffPerformance[staffName].discounts += saleDiscount;
    }

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
    if (s.isVoid) return false;
    const d = new Date(s.ts);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return ym === selectedMonthKey;
  });

  const selectedExpenses = expensesList.filter(e => {
    const d = new Date(e.ts);
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return ym === selectedMonthKey;
  });

  const selGrossSales = selectedSales.reduce((sum, s) => sum + Number(s.paid != null ? s.paid : s.total), 0);
  const selExpenses = selectedExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const selNetProfit = selGrossSales - selExpenses;
  const selOrderCount = selectedSales.length;
  const selAvgOrder = selOrderCount > 0 ? Math.round(selGrossSales / selOrderCount) : 0;

  const validSalesList = salesList.filter(s => !s.isVoid);
  const totalSalesCount = validSalesList.length;
  const avgOrderValue = totalSalesCount > 0 ? Math.round(sTotalAll / totalSalesCount) : 0;
  const collectionRate = sTotalAll > 0 ? Math.round(((sTotalAll - totalPendingBal) / sTotalAll) * 100) : 100;

  // Daily revenue bar chart data for past 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - i));
    const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
    const dayRevenue = salesList
      .filter(s => !s.isVoid && isSameDay(new Date(s.ts), date))
      .reduce((sum, s) => sum + Number(s.paid != null ? s.paid : s.total), 0);
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
    if (filterStatus === "active" && s.isVoid) return false;
    if (filterStatus === "void" && !s.isVoid) return false;
    if (filterStatus === "balance" && (s.isVoid || bal <= 0)) return false;
    if (filterStatus === "paid" && (s.isVoid || bal > 0)) return false;
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
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className="btn ghost sm"
              onClick={() => setAdminTab('system')}
              style={{ borderRadius: '8px', color: '#E2E8F0', borderColor: 'rgba(255,255,255,0.25)', fontSize: '12.5px' }}
              title="Change master admin panel password"
            >
              🔑 Change Password
            </button>
            <button className="btn danger sm" onClick={onLogout} style={{ borderRadius: '8px', fontSize: '12.5px' }}>
              🔒 Sign Out Admin
            </button>
          </div>
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
        <button className={adminTab === 'drawer' ? 'active' : ''} onClick={() => setAdminTab('drawer')}>
          💼 Cash Drawer &amp; Shifts {state.activeDrawerSession ? <span className="badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981', fontWeight: 800 }}>🟢 Open</span> : ''}
        </button>
        <button className={adminTab === 'prices' ? 'active' : ''} onClick={() => setAdminTab('prices')}>🏷️ Rate List &amp; Custom Services</button>
        <button className={adminTab === 'team' ? 'active' : ''} onClick={() => setAdminTab('team')}>👥 Team &amp; Staff</button>
        <button className={adminTab === 'attendance' ? 'active' : ''} onClick={() => setAdminTab('attendance')}>⏱️ Attendance &amp; Timesheets</button>
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
        <div className="grid-side-form">
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
                <div style={{ flex: 1, minWidth: '160px' }}>
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
                          <td style={{ fontSize: '12.5px', whiteSpace: 'nowrap' }}>{fmtDate(e.ts)}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>{e.staff || '—'}</td>
                          <td style={{ whiteSpace: 'nowrap' }}><span className="badge" style={{ margin: 0, fontSize: '10.5px' }}>{e.category}</span></td>
                          <td style={{ fontWeight: 700, minWidth: '150px' }}>{e.title}</td>
                          <td className="num mono" style={{ color: '#DC2626', fontWeight: 800, whiteSpace: 'nowrap' }}>- {money(e.amount)}</td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <button
                              className="btn danger sm"
                              title="Delete expense record permanently"
                              onClick={() => onDeleteExpense && onDeleteExpense(e.id)}
                            >
                              🗑️ Delete
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
                  <option value="active">Active Sales Only</option>
                  <option value="balance">Pending Balance</option>
                  <option value="paid">Fully Paid</option>
                  <option value="void">🚫 Wrong Entries</option>
                </select>
              </div>
            </div>

            <div className="hint" style={{ marginBottom: '14px' }}>
              {filteredSales.length > 0 && (() => {
                const activeInFilter = filteredSales.filter(s => !s.isVoid);
                const voidInFilter = filteredSales.filter(s => s.isVoid);
                const activeTotal = activeInFilter.reduce((a, s) => a + Number(s.total || 0), 0);
                return (
                  <span>
                    Showing <b>{filteredSales.length}</b> transaction(s)
                    {voidInFilter.length > 0 && ` (${activeInFilter.length} active, ${voidInFilter.length} wrong entries)`}
                    {' · Active Total: '}<b className="mono">{money(activeTotal)}</b>
                  </span>
                );
              })()}
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
                        <tr key={s.id} className={`click ${s.isVoid ? 'row-void' : ''}`} onClick={() => setActiveModalSale(s)}>
                          <td className="mono" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                            <span className={s.isVoid ? 'strikethrough' : ''}>{s.id}</span>
                            {s.isVoid && (
                              <span className="badge badge-void" style={{ marginLeft: '6px', fontSize: '9.5px', padding: '1px 5px' }}>
                                🚫 WRONG
                              </span>
                            )}
                          </td>
                          <td>{fmtDate(s.ts)}</td>
                          <td>{s.staff || '—'}</td>
                          <td>{s.customer || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                          <td>
                            <span className="badge" style={{ margin: 0, background: pm === 'Online' ? '#F3E8FF' : '#F1F5F9', color: pm === 'Online' ? '#7C3AED' : '#475569', fontSize: '11px' }}>
                              {pm === 'Online' ? '💳 Online' : '💵 Cash'}
                            </span>
                          </td>
                          <td className="num">
                            <div className={`mono ${s.isVoid ? 'strikethrough' : ''}`} style={{ fontWeight: 800 }}>{money(realNetTotal)}</div>
                            {discAmt > 0 && (
                              <div style={{ fontSize: '10.5px', color: 'var(--muted)' }}>Subtotal: {money(grossTotal)}</div>
                            )}
                          </td>
                          <td className="num">
                            {discAmt > 0 ? (
                              <span className={`mono ${s.isVoid ? 'strikethrough' : ''}`} style={{ color: '#DC2626', fontWeight: 800 }}>- {money(discAmt)}</span>
                            ) : (
                              <span style={{ color: 'var(--muted)' }}>—</span>
                            )}
                          </td>
                          <td className={`num mono ${s.isVoid ? 'strikethrough' : ''}`}>{money(realPaid)}</td>
                          <td className="num">
                            {s.isVoid ? (
                              <span className="badge badge-void" style={{ fontSize: '10px' }}>Wrong</span>
                            ) : realBalance > 0 ? (
                              <span className="mono" style={{ color: 'var(--danger)', fontWeight: 800 }}>{money(realBalance)}</span>
                            ) : (
                              <span style={{ color: '#059669', fontWeight: 700 }}>Paid</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center' }}>
                              {s.isVoid ? (
                                <button
                                  className="btn ghost sm"
                                  style={{ fontSize: '11px', padding: '3px 8px', color: '#D97706', borderColor: 'rgba(217, 119, 6, 0.4)' }}
                                  title="Restore this wrong entry back to active sales"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onToggleVoidSale && onToggleVoidSale(s.id);
                                  }}
                                >
                                  ♻️ Restore
                                </button>
                              ) : (
                                <>
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
                                    className="btn ghost sm"
                                    style={{ color: '#DC2626', borderColor: 'rgba(220, 38, 38, 0.3)', background: 'rgba(220, 38, 38, 0.05)', fontSize: '11px', padding: '3px 7px' }}
                                    title="Mark as Wrong Entry"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onToggleVoidSale && onToggleVoidSale(s.id, 'Wrong Entry');
                                    }}
                                  >
                                    ⚠️ Wrong
                                  </button>
                                </>
                              )}
                              <button
                                className="btn danger sm"
                                title="Delete receipt permanently from database"
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

      {/* TAB: ATTENDANCE & TIMESHEETS */}
      {adminTab === 'attendance' && (() => {
        const attendanceList = state.attendance || [];

        // Filter attendance records based on current filters
        const filteredAttendance = attendanceList.filter(a => {
          if (attFilterStaff && a.staff !== attFilterStaff) return false;
          if (attFilterStatus) {
            if (attFilterStatus === 'absent' && a.status !== 'absent') return false;
            if (attFilterStatus === 'late' && !a.isLate && !(a.lateMinutes > 0)) return false;
            if (attFilterStatus === 'active' && !(a.status === 'clocked_in' || a.status === 'on_break')) return false;
            if (attFilterStatus === 'completed' && a.status !== 'completed') return false;
            if (attFilterStatus === 'leave' && a.status !== 'leave') return false;
            if (attFilterStatus === 'manual' && !a.isManual) return false;
          }

          const recDate = new Date(a.clockIn || a.ts);
          if (attFilterPeriod === 'selected_month') {
            const ym = a.date ? a.date.slice(0, 7) : `${recDate.getFullYear()}-${String(recDate.getMonth() + 1).padStart(2, '0')}`;
            if (ym !== selectedMonthKey) return false;
          } else if (attFilterPeriod === 'today') {
            if (!isSameDay(recDate, now)) return false;
          } else if (attFilterPeriod === 'yesterday') {
            if (!isYesterday(recDate)) return false;
          } else if (attFilterPeriod === 'week') {
            if (!isThisWeek(recDate)) return false;
          }

          const q = attSearchBox.toLowerCase().trim();
          if (q) {
            const matchName = (a.staff || '').toLowerCase().includes(q);
            const matchDate = (a.date || '').toLowerCase().includes(q);
            const matchNotes = (a.notes || '').toLowerCase().includes(q);
            if (!matchName && !matchDate && !matchNotes) return false;
          }
          return true;
        });

        // Compute summary KPIs
        const totalPunches = filteredAttendance.length;
        const totalMinutesWorked = filteredAttendance.reduce((sum, a) => sum + (Number(a.totalWorkMinutes) || 0), 0);
        const totalHoursWorked = (totalMinutesWorked / 60).toFixed(1);
        const totalLatePunches = filteredAttendance.filter(a => a.isLate || a.lateMinutes > 0).length;

        // Group by staff for monthly timesheet summary
        const staffSummaryMap = {};
        (state.staff || []).forEach(name => {
          staffSummaryMap[name] = { staff: name, shifts: 0, distinctDays: new Set(), totalMinutes: 0, leaves: 0, absents: 0, lateCount: 0, lateMinutes: 0 };
        });

        filteredAttendance.forEach(a => {
          if (!staffSummaryMap[a.staff]) {
            staffSummaryMap[a.staff] = { staff: a.staff, shifts: 0, distinctDays: new Set(), totalMinutes: 0, leaves: 0, absents: 0, lateCount: 0, lateMinutes: 0 };
          }
          if (a.status === 'leave') {
            staffSummaryMap[a.staff].leaves += 1;
          } else if (a.status === 'absent') {
            staffSummaryMap[a.staff].absents += 1;
          } else {
            staffSummaryMap[a.staff].shifts += 1;
            if (a.date) staffSummaryMap[a.staff].distinctDays.add(a.date);
            staffSummaryMap[a.staff].totalMinutes += Number(a.totalWorkMinutes || 0);

            if (a.isLate || a.lateMinutes > 0) {
              staffSummaryMap[a.staff].lateCount += 1;
              staffSummaryMap[a.staff].lateMinutes += Number(a.lateMinutes || 0);
            }
          }
        });

        const staffSummaryList = Object.values(staffSummaryMap).sort((a, b) => b.totalMinutes - a.totalMinutes);

        // Detect if shop has not been opened yet today past scheduled time
        const unpunctualShopAlert = (() => {
          const n = new Date();
          const todayStr = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
          const todayPunches = (state.attendance || []).filter(a => a.date === todayStr && a.status !== 'leave' && a.status !== 'absent');
          if (todayPunches.length > 0) return null; // Already opened!

          const [h, m] = (state.shopOpenTime || "09:00").split(':').map(Number);
          const grace = Number(state.graceMinutes != null ? state.graceMinutes : 15);
          const scheduledDate = new Date(n.getFullYear(), n.getMonth(), n.getDate(), h, m, 0);
          const deadlineDate = new Date(scheduledDate.getTime() + (grace * 60000));

          if (n > deadlineDate) {
            const lateMins = Math.round((n - scheduledDate) / 60000);
            return {
              scheduled: state.shopOpenTime || "09:00",
              opener: state.morningOpener || "Alex",
              lateMins
            };
          }
          return null;
        })();

        // Export attendance CSV helper
        const handleExportAttendanceCsv = () => {
          const rows = [["Attendance ID", "Date", "Staff Name", "Status", "Clock In", "Clock Out", "Total Work Minutes", "Hours Worked", "Notes", "Manual Entry"]];
          filteredAttendance.forEach(a => {
            rows.push([
              a.id,
              a.date,
              a.staff,
              a.status,
              a.clockIn ? formatPunchTime(a.clockIn) : '',
              a.clockOut ? formatPunchTime(a.clockOut) : '',
              a.totalWorkMinutes || 0,
              ((a.totalWorkMinutes || 0) / 60).toFixed(2),
              `"${(a.notes || '').replace(/"/g, '""')}"`,
              a.isManual ? 'YES' : 'NO'
            ]);
          });
          const csvContent = rows.map(r => r.join(',')).join('\n');
          downloadFile(`attendance-timesheet-${selectedMonthKey}.csv`, csvContent, 'text/csv');
        };

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* UNPUNCTUAL MORNING SHOP OPENING ALERT */}
            {unpunctualShopAlert && (
              <div
                style={{
                  background: '#FEF2F2',
                  border: '2px solid #EF4444',
                  borderRadius: '12px',
                  padding: '18px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '32px' }}>🚨</span>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '16px', color: '#DC2626' }}>
                      Shop Opening Alert: Counter PC is still Offline!
                    </div>
                    <div style={{ fontSize: '13.5px', color: '#7F1D1D', marginTop: '2px' }}>
                      Scheduled opening was <strong>{unpunctualShopAlert.scheduled} AM</strong> (assigned to <strong>{unpunctualShopAlert.opener}</strong>).
                      As of now, the counter PC has not been powered on / opened ({unpunctualShopAlert.lateMins} minutes past scheduled time).
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn primary"
                  style={{ background: '#DC2626', borderColor: '#DC2626', fontWeight: 800 }}
                  onClick={() => {
                    setSelectedPunchEdit({
                      id: null,
                      staff: unpunctualShopAlert.opener,
                      date: new Date().toISOString().slice(0, 10),
                      clockInTime: '',
                      clockOutTime: '',
                      status: 'absent',
                      notes: `Unexcused absence · Did not open shop at ${unpunctualShopAlert.scheduled} AM`
                    });
                  }}
                >
                  ❌ Mark {unpunctualShopAlert.opener} Absent Today
                </button>
              </div>
            )}

            {/* SHOP OPENING & SHIFT HOURS CONFIGURATION CARD */}
            <div className="card" style={{ border: '2px solid rgba(37, 99, 235, 0.3)' }}>
              <h2>
                <span>⏰ Studio Morning Opening &amp; Shift Punctuality Rules</span>
                <span className="badge" style={{ background: '#EFF6FF', color: '#2563EB', fontWeight: 800 }}>
                  Automated Late Detection
                </span>
              </h2>
              <div className="body">
                <div style={{ background: 'rgba(37, 99, 235, 0.05)', padding: '14px 16px', borderRadius: '10px', border: '1px solid rgba(37, 99, 235, 0.15)', marginBottom: '18px' }}>
                  <div style={{ fontWeight: 800, color: 'var(--accent)', fontSize: '14px', marginBottom: '4px' }}>
                    ⚡ Morning PC Power-On Auto-Attendance (Auth PC Restricted):
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--ink)', lineHeight: 1.5 }}>
                    When the <strong>Authorized Counter PC (Auth PC)</strong> is powered on in the morning and launches the system (or connects to wifi), <strong>{morningOpenerVal}</strong>'s attendance is automatically recorded with the exact timestamp. If past {shopOpenTimeVal} + {graceMinutesVal}m grace, late minutes are logged automatically. Remote or unauthorized devices are blocked from auto-triggering.
                  </div>
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px dashed rgba(37, 99, 235, 0.2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span>Current Machine:</span>
                      {isCurrentDeviceAuthorized ? (
                        <span style={{ color: '#059669', background: '#ECFDF5', padding: '3px 8px', borderRadius: '6px', border: '1px solid #10B981' }}>
                          ✅ Authorized Counter PC (Auto-Attendance Active)
                        </span>
                      ) : (
                        <span style={{ color: '#DC2626', background: '#FEF2F2', padding: '3px 8px', borderRadius: '6px', border: '1px solid #EF4444' }}>
                          ⚠️ Not Authorized (Auto-Attendance Blocked on this Device)
                        </span>
                      )}
                    </div>
                    {!isCurrentDeviceAuthorized && onAuthorizeTerminal && (
                      <button
                        type="button"
                        className="btn primary sm"
                        style={{ background: '#10B981', borderColor: '#10B981', fontSize: '12px', padding: '5px 12px', fontWeight: 700 }}
                        onClick={() => {
                          onAuthorizeTerminal();
                          setIsCurrentDeviceAuthorized(true);
                          alert("✅ This computer is now registered as the Authorized Studio Counter PC! Auto-attendance is active here.");
                        }}
                      >
                        ⚡ Authorize This PC
                      </button>
                    )}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                  <div className="field">
                    <label>Studio General Opening Time</label>
                    <input
                      type="time"
                      value={shopOpenTimeVal}
                      onChange={(e) => setShopOpenTimeVal(e.target.value)}
                      style={{ fontSize: '16px', fontWeight: 700 }}
                    />
                  </div>

                  <div className="field">
                    <label>Punctuality Grace Period (Minutes)</label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={graceMinutesVal}
                      onChange={(e) => setGraceMinutesVal(e.target.value)}
                      style={{ fontSize: '16px', fontWeight: 700 }}
                    />
                    <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
                      Allows {graceMinutesVal} mins after scheduled shift before counting late penalty.
                    </div>
                  </div>

                  <div className="field">
                    <label>Default Morning Opener Staff (Auto PC Check-In)</label>
                    <select
                      value={morningOpenerVal}
                      onChange={(e) => setMorningOpenerVal(e.target.value)}
                      style={{ fontSize: '16px', fontWeight: 700 }}
                    >
                      {state.staff.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* INDIVIDUAL STAFF SHIFT SCHEDULES */}
                <div style={{ borderTop: '1px solid var(--line)', paddingTop: '16px', marginBottom: '18px' }}>
                  <div style={{ fontWeight: 800, fontSize: '14.5px', color: 'var(--ink)', marginBottom: '6px' }}>
                    👥 Individual Employee Shift Schedules (Personalized Late Calculation)
                  </div>
                  <p style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: 0, marginBottom: '14px' }}>
                    Each staff member's punctuality is checked against their own shift start time. For example, Kabeer scheduled at 6:00 PM will only be marked late if clocking in after 6:15 PM!
                  </p>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
                    {state.staff.map(staffName => {
                      const currentVal = (staffSchedulesVal && staffSchedulesVal[staffName]) || (staffName === morningOpenerVal ? shopOpenTimeVal : "09:00");
                      const isMorningOpener = staffName === morningOpenerVal;
                      const [h, m] = (currentVal || "09:00").split(':').map(Number);
                      const cutoffDate = new Date(2026, 0, 1, h, m + Number(graceMinutesVal || 0));
                      const cutoffStr = cutoffDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

                      return (
                        <div
                          key={staffName}
                          style={{
                            padding: '12px 14px',
                            borderRadius: '10px',
                            background: isMorningOpener ? 'rgba(37, 99, 235, 0.04)' : 'var(--paper)',
                            border: isMorningOpener ? '1.5px solid rgba(37, 99, 235, 0.3)' : '1px solid var(--line)'
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                            <span style={{ fontWeight: 800, fontSize: '14px' }}>{staffName}</span>
                            {isMorningOpener ? (
                              <span className="badge" style={{ background: '#EFF6FF', color: '#2563EB', fontSize: '11px', fontWeight: 700 }}>
                                ⭐ Morning Opener
                              </span>
                            ) : (
                              <span className="badge" style={{ background: 'var(--line-soft)', color: 'var(--muted)', fontSize: '11px' }}>
                                Staff Shift
                              </span>
                            )}
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                              type="time"
                              value={currentVal}
                              onChange={(e) => {
                                const nextVal = e.target.value;
                                setStaffSchedulesVal(prev => ({
                                  ...prev,
                                  [staffName]: nextVal
                                }));
                              }}
                              style={{ fontSize: '14.5px', fontWeight: 700, flex: 1, padding: '6px 10px' }}
                            />
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '5px' }}>
                            On-time until <strong>{cutoffStr}</strong> ({graceMinutesVal}m grace)
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="btn primary"
                    disabled={isSavingHours}
                    onClick={async () => {
                      setIsSavingHours(true);
                      if (onUpdateShopHours) {
                        await onUpdateShopHours({
                          shopOpenTime: shopOpenTimeVal,
                          graceMinutes: Number(graceMinutesVal),
                          morningOpener: morningOpenerVal,
                          staffSchedules: staffSchedulesVal
                        });
                      }
                      setIsSavingHours(false);
                      alert("✅ Studio opening & individual employee shift schedules saved successfully!");
                    }}
                  >
                    💾 Save Opening &amp; Punctuality Rules
                  </button>
                </div>
              </div>
            </div>
            
            {/* TERMINAL AUTHORIZATION & ANTI-PROXY CONTROL CARD */}
            <div className="card" style={{ border: isCurrentDeviceAuthorized ? '2px solid #10B981' : '2px solid #D97706' }}>
              <h2>
                <span>🖥️ Studio Counter Terminal Authorization &amp; Anti-Proxy Lock</span>
                <span className="badge" style={{ background: isCurrentDeviceAuthorized ? '#ECFDF5' : '#FEF3C7', color: isCurrentDeviceAuthorized ? '#059669' : '#D97706', fontWeight: 800 }}>
                  {isCurrentDeviceAuthorized ? '🟢 Authorized Counter Terminal' : '⚪ Unassigned Device'}
                </span>
              </h2>
              <div className="body stack">
                <p className="hint" style={{ marginTop: 0 }}>
                  This security feature prevents staff from marking attendance remotely from their homes or mobile phones.
                  Only computers authorized with the secret terminal key can punch shifts at the studio.
                </p>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'var(--paper)', borderRadius: '12px', border: '1px solid var(--line)', flexWrap: 'wrap', gap: '14px' }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '15px', color: 'var(--ink)' }}>
                      Current Computer Status: {isCurrentDeviceAuthorized ? '🟢 Authorized Studio Terminal' : '⚪ Not Authorized'}
                    </div>
                    <div style={{ fontSize: '12.5px', color: 'var(--muted)', marginTop: '4px' }}>
                      Security Token: <span className="mono" style={{ fontWeight: 700 }}>{state.terminalKey ? `${state.terminalKey.slice(0, 12)}••••` : 'IPS-TAXILA-COUNTER-KEY-2026'}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {!isCurrentDeviceAuthorized ? (
                      <button
                        type="button"
                        className="btn primary"
                        style={{ background: '#10B981', borderColor: '#10B981', fontWeight: 700 }}
                        onClick={() => {
                          if (onAuthorizeTerminal) {
                            onAuthorizeTerminal();
                            setIsCurrentDeviceAuthorized(true);
                            alert("✅ This computer is now registered as the official Studio Counter Terminal!");
                          }
                        }}
                      >
                        🖥️ Authorize This Computer
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="btn ghost"
                        style={{ color: '#DC2626', borderColor: 'rgba(220, 38, 38, 0.3)' }}
                        onClick={() => {
                          if (onRevokeTerminal) {
                            onRevokeTerminal();
                            setIsCurrentDeviceAuthorized(false);
                            alert("⚠️ Authorization removed from this computer.");
                          }
                        }}
                      >
                        Revoke This Device
                      </button>
                    )}

                    <button
                      type="button"
                      className="btn ghost"
                      title="Reset security token if an old PC was replaced"
                      onClick={() => {
                        if (window.confirm("Regenerate Terminal Security Key?\n\nThis will invalidate ALL currently authorized terminals. You will need to click 'Authorize This Computer' again on the counter PC.")) {
                          if (onRegenerateTerminalKey) {
                            onRegenerateTerminalKey();
                            setIsCurrentDeviceAuthorized(true);
                            alert("✅ Key regenerated and this device was re-authorized!");
                          }
                        }
                      }}
                    >
                      🔄 Regenerate Key
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* MONTHLY TIMESHEET & FILTER BAR */}
            <div className="card">
              <h2>
                <span>📅 Timesheet Period &amp; Employee Filters</span>
                <span className="badge" style={{ background: '#EFF6FF', color: '#2563EB' }}>
                  {fmtMonthKey(selectedMonthKey)}
                </span>
              </h2>
              <div className="body">
                <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px' }}>
                  
                  {/* MONTH SELECTOR */}
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <label style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '6px' }}>Select Month</label>
                    <select
                      value={selectedMonthKey}
                      onChange={(e) => {
                        setSelectedMonthKey(e.target.value);
                        setAttFilterPeriod('selected_month');
                      }}
                      style={{ fontWeight: 700 }}
                    >
                      {availableMonths.map(mKey => (
                        <option key={mKey} value={mKey}>{fmtMonthKey(mKey)} {mKey === currentMonthKey ? ' (Current)' : ''}</option>
                      ))}
                    </select>
                  </div>

                  {/* PERIOD FILTER */}
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <label style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '6px' }}>Quick Filter</label>
                    <select
                      value={attFilterPeriod}
                      onChange={(e) => setAttFilterPeriod(e.target.value)}
                    >
                      <option value="selected_month">Selected Month ({fmtMonthKey(selectedMonthKey)})</option>
                      <option value="today">Today Only</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="week">Past 7 Days</option>
                      <option value="all">All Time History</option>
                    </select>
                  </div>

                  {/* STAFF FILTER */}
                  <div style={{ flex: 1, minWidth: '150px' }}>
                    <label style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '6px' }}>Staff Member</label>
                    <select
                      value={attFilterStaff}
                      onChange={(e) => setAttFilterStaff(e.target.value)}
                    >
                      <option value="">All Staff Members</option>
                      {state.staff.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>

                  {/* STATUS FILTER */}
                  <div style={{ flex: 1, minWidth: '140px' }}>
                    <label style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '6px' }}>Status</label>
                    <select
                      value={attFilterStatus}
                      onChange={(e) => setAttFilterStatus(e.target.value)}
                    >
                      <option value="">All Statuses</option>
                      <option value="late">⚠️ Late Arrivals Only</option>
                      <option value="absent">❌ Absent Only</option>
                      <option value="active">🟢 Active On Duty</option>
                      <option value="completed">🏁 Completed Shift</option>
                      <option value="leave">🏖️ Approved Leave</option>
                      <option value="manual">✏️ Manual Entry</option>
                    </select>
                  </div>

                  {/* SEARCH BOX */}
                  <div style={{ flex: 1.5, minWidth: '180px' }}>
                    <label style={{ fontWeight: 700, fontSize: '13px', display: 'block', marginBottom: '6px' }}>Search</label>
                    <input
                      placeholder="Search employee, notes..."
                      value={attSearchBox}
                      onChange={(e) => setAttSearchBox(e.target.value)}
                    />
                  </div>

                </div>

                {/* ACTION BUTTONS */}
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'flex-end', borderTop: '1px solid var(--line-soft)', paddingTop: '16px' }}>
                  <button
                    type="button"
                    className="btn primary"
                    style={{ background: '#DC2626', borderColor: '#DC2626', fontWeight: 700 }}
                    onClick={() => {
                      setSelectedPunchEdit({
                        id: null,
                        staff: state.staff[0] || 'Umar',
                        date: new Date().toISOString().slice(0, 10),
                        clockInTime: '',
                        clockOutTime: '',
                        status: 'absent',
                        notes: 'Marked absent by Admin'
                      });
                    }}
                  >
                    ❌ Mark Absent
                  </button>

                  <button
                    type="button"
                    className="btn primary"
                    style={{ background: '#10B981', borderColor: '#10B981', fontWeight: 700 }}
                    onClick={() => {
                      setSelectedPunchEdit({
                        id: null,
                        staff: state.staff[0] || 'Umar',
                        date: new Date().toISOString().slice(0, 10),
                        clockInTime: '10:00',
                        clockOutTime: '19:00',
                        status: 'completed',
                        notes: 'Manual punch added by Admin'
                      });
                    }}
                  >
                    ➕ Add Manual Shift / Leave
                  </button>

                  <button
                    type="button"
                    className="btn ghost"
                    style={{ fontWeight: 700, borderColor: 'var(--accent)', color: 'var(--accent)' }}
                    onClick={handleExportAttendanceCsv}
                  >
                    📥 Export Timesheet (CSV)
                  </button>

                  <button
                    type="button"
                    className="btn ghost"
                    style={{ fontWeight: 700 }}
                    onClick={() => setShowPrintTimesheet(true)}
                  >
                    🖨️ Print Monthly Timesheet
                  </button>
                </div>
              </div>
            </div>

            {/* MONTHLY SUMMARY STAT CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div style={{ padding: '16px', background: 'var(--paper)', borderRadius: '12px', border: '1px solid var(--line)' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Shifts Logged</div>
                <div className="mono" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent)', marginTop: '4px' }}>{totalPunches}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>In selected view</div>
              </div>

              <div style={{ padding: '16px', background: 'var(--paper)', borderRadius: '12px', border: '1px solid var(--line)' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Total Hours Logged</div>
                <div className="mono" style={{ fontSize: '24px', fontWeight: 800, color: '#059669', marginTop: '4px' }}>{totalHoursWorked} hrs</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>{formatMinStr(totalMinutesWorked)}</div>
              </div>

              <div style={{ padding: '16px', background: filteredAttendance.filter(a => a.status === 'absent').length > 0 ? '#FEF2F2' : 'var(--paper)', borderRadius: '12px', border: filteredAttendance.filter(a => a.status === 'absent').length > 0 ? '1px solid #EF4444' : '1px solid var(--line)' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Absences Recorded</div>
                <div className="mono" style={{ fontSize: '24px', fontWeight: 800, color: '#DC2626', marginTop: '4px' }}>
                  {filteredAttendance.filter(a => a.status === 'absent').length}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Unexcused absences</div>
              </div>

              <div style={{ padding: '16px', background: 'var(--paper)', borderRadius: '12px', border: '1px solid var(--line)' }}>
                <div style={{ fontSize: '12px', color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase' }}>Registered Staff</div>
                <div className="mono" style={{ fontSize: '24px', fontWeight: 800, color: 'var(--ink)', marginTop: '4px' }}>{state.staff.length}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>Team members</div>
              </div>
            </div>

            {/* STAFF PAYROLL & TIMESHEET SUMMARY TABLE */}
            <div className="card">
              <h2>
                <span>👥 Staff Timesheet &amp; Working Hours Summary</span>
                <span className="badge">Payroll Ready</span>
              </h2>
              <div className="body">
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Staff Member</th>
                        <th className="num">Days Worked</th>
                        <th className="num">Total Hours</th>
                        <th className="num">Avg Shift</th>
                        <th className="num">⚠️ Late</th>
                        <th className="num">❌ Absent</th>
                        <th className="num">🏖️ Leaves</th>
                        <th style={{ textAlign: 'center' }}>Quick Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {staffSummaryList.map(item => {
                        const days = item.distinctDays.size;
                        const avgMin = days > 0 ? Math.round(item.totalMinutes / days) : 0;

                        return (
                          <tr key={item.staff}>
                            <td style={{ fontWeight: 800, fontSize: '15px' }}>{item.staff}</td>
                            <td className="num mono" style={{ fontWeight: 700 }}>{days} day(s)</td>
                            <td className="num mono" style={{ fontWeight: 800, color: '#059669' }}>
                              {(item.totalMinutes / 60).toFixed(1)} hrs ({formatMinStr(item.totalMinutes)})
                            </td>
                            <td className="num mono">{formatMinStr(avgMin)}</td>
                            <td className="num mono">
                              {item.lateCount > 0 ? (
                                <span style={{ color: '#D97706', fontWeight: 800, background: '#FEF3C7', padding: '2px 8px', borderRadius: '6px' }}>
                                  {item.lateCount}× ({formatMinStr(item.lateMinutes)})
                                </span>
                              ) : (
                                <span style={{ color: 'var(--muted)' }}>0</span>
                              )}
                            </td>
                            <td className="num mono">
                              {item.absents > 0 ? (
                                <span style={{ color: '#DC2626', fontWeight: 800, background: '#FEE2E2', padding: '2px 8px', borderRadius: '6px' }}>
                                  {item.absents}
                                </span>
                              ) : '0'}
                            </td>
                            <td className="num mono">{item.leaves > 0 ? <span style={{ color: '#D97706', fontWeight: 700 }}>{item.leaves}</span> : '0'}</td>
                            <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                              <button
                                type="button"
                                className="btn ghost sm"
                                style={{ marginRight: '6px' }}
                                onClick={() => setAttFilterStaff(item.staff)}
                              >
                                Filter Logs
                              </button>
                              <button
                                type="button"
                                className="btn ghost sm"
                                style={{ color: '#DC2626', borderColor: 'rgba(220, 38, 38, 0.3)', background: 'rgba(220, 38, 38, 0.05)' }}
                                onClick={() => setSelectedPunchEdit({
                                  id: null,
                                  staff: item.staff,
                                  date: new Date().toISOString().slice(0, 10),
                                  clockInTime: '',
                                  clockOutTime: '',
                                  status: 'absent',
                                  notes: 'Marked absent by Admin'
                                })}
                                title={`Mark ${item.staff} absent today`}
                              >
                                ❌ Mark Absent
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* DETAILED PUNCH LOGS */}
            <div className="card">
              <h2>
                <span>📋 Detailed Attendance Punch Log</span>
                <span className="badge">{filteredAttendance.length} record(s)</span>
              </h2>
              <div className="body">
                {!filteredAttendance.length ? (
                  <div className="empty-state">No attendance records found matching current filters.</div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Staff</th>
                          <th>Clock In</th>
                          <th>Clock Out</th>
                          <th>Break Time</th>
                          <th>Worked Time</th>
                          <th>Status</th>
                          <th>Notes</th>
                          <th style={{ textAlign: 'center' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredAttendance.map(rec => {
                          const breakMin = (rec.breaks || []).reduce((sum, b) => sum + (Number(b.durationMin) || 0), 0);

                          return (
                            <tr key={rec.id}>
                              <td style={{ fontSize: '13px', fontWeight: 600 }}>{rec.date}</td>
                              <td style={{ fontWeight: 800 }}>{rec.staff}</td>
                              <td style={{ fontSize: '13px' }}>{formatPunchTime(rec.clockIn)}</td>
                              <td style={{ fontSize: '13px' }}>{rec.clockOut ? formatPunchTime(rec.clockOut) : '—'}</td>
                              <td className="mono" style={{ fontSize: '13px' }}>{breakMin > 0 ? `${breakMin}m` : '0m'}</td>
                              <td className="mono" style={{ fontWeight: 800, color: '#059669' }}>
                                {formatMinStr(rec.totalWorkMinutes)}
                              </td>
                              <td>
                                {rec.status === 'absent' && (
                                  <span className="badge" style={{ background: '#FEE2E2', color: '#DC2626', fontWeight: 800, border: '1px solid #FCA5A5' }}>
                                    ❌ Absent
                                  </span>
                                )}
                                {rec.status === 'clocked_in' && (
                                  <span className="badge" style={{ background: '#ECFDF5', color: '#059669', fontWeight: 800 }}>
                                    🟢 On Shift
                                  </span>
                                )}
                                {rec.status === 'on_break' && (
                                  <span className="badge" style={{ background: '#FEF3C7', color: '#D97706', fontWeight: 800 }}>
                                    ☕ On Break
                                  </span>
                                )}
                                {rec.status === 'completed' && (
                                  <span className="badge" style={{ background: 'var(--line-soft)', color: 'var(--muted)' }}>
                                    🏁 Completed
                                  </span>
                                )}
                                {rec.status === 'leave' && (
                                  <span className="badge" style={{ background: '#FEF3C7', color: '#D97706' }}>
                                    🏖️ Leave
                                  </span>
                                )}
                                {(rec.isLate || rec.lateMinutes > 0) && (
                                  <span className="badge" style={{ marginLeft: '4px', background: '#FEF3C7', color: '#D97706', fontWeight: 800, border: '1px solid #FCD34D' }}>
                                    ⚠️ Late {rec.lateMinutes}m
                                  </span>
                                )}
                                {rec.autoCaptured && (
                                  <span className="badge" style={{ marginLeft: '4px', background: '#ECFDF5', color: '#059669', fontSize: '10.5px', border: '1px solid #A7F3D0' }}>
                                    🖥️ PC Boot
                                  </span>
                                )}
                                {rec.isManual && (
                                  <span className="badge" style={{ marginLeft: '4px', background: '#EFF6FF', color: '#2563EB', fontSize: '10px' }}>
                                    Manual
                                  </span>
                                )}
                              </td>
                              <td style={{ fontSize: '12px', color: 'var(--muted)', maxWidth: '200px' }}>
                                {rec.notes || '—'}
                              </td>
                              <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <button
                                  type="button"
                                  className="btn ghost sm"
                                  style={{ marginRight: '6px' }}
                                  onClick={() => {
                                    const inDate = new Date(rec.clockIn || rec.ts);
                                    const inTimeStr = `${String(inDate.getHours()).padStart(2, '0')}:${String(inDate.getMinutes()).padStart(2, '0')}`;
                                    let outTimeStr = '';
                                    if (rec.clockOut) {
                                      const outDate = new Date(rec.clockOut);
                                      outTimeStr = `${String(outDate.getHours()).padStart(2, '0')}:${String(outDate.getMinutes()).padStart(2, '0')}`;
                                    }
                                    setSelectedPunchEdit({
                                      id: rec.id,
                                      staff: rec.staff,
                                      date: rec.date || inDate.toISOString().slice(0, 10),
                                      clockInTime: inTimeStr,
                                      clockOutTime: outTimeStr,
                                      status: rec.status,
                                      notes: rec.notes || ''
                                    });
                                  }}
                                  title="Edit punch times or note"
                                >
                                  ✏️ Edit
                                </button>
                                <button
                                  type="button"
                                  className="btn danger sm"
                                  onClick={() => onDeleteAttendance && onDeleteAttendance(rec.id)}
                                  title="Delete attendance record"
                                >
                                  🗑️
                                </button>
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

          </div>
        );
      })()}

      {/* TAB 6: SYSTEM & BACKUP */}
      {adminTab === 'system' && (
        <div className="grid">
          {/* ADMIN PASSWORD & ACCESS CONTROL */}
          <div className="card" style={{ border: '2px solid rgba(37, 99, 235, 0.2)' }}>
            <h2>
              <span>🔐 Admin Password &amp; Security</span>
              <span className="badge" style={{ background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>Master Auth</span>
            </h2>
            <div className="body stack">
              <p className="hint" style={{ marginTop: 0 }}>
                Change the master password used to log in to this Executive Admin Panel. This password syncs securely to cloud.
              </p>

              <form onSubmit={handleUpdateAdminPassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>New Admin Password</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassText ? 'text' : 'password'}
                      placeholder="Enter new password (min. 4 characters)"
                      value={newAdminPass}
                      onChange={(e) => setNewAdminPass(e.target.value)}
                      required
                      style={{ paddingRight: '45px', width: '100%' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassText(!showPassText)}
                      style={{
                        position: 'absolute',
                        right: '8px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '15px',
                        color: 'var(--muted)',
                        padding: '4px 6px'
                      }}
                      title={showPassText ? 'Hide password' : 'Show password'}
                    >
                      {showPassText ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '13px', fontWeight: 600, display: 'block', marginBottom: '6px' }}>Confirm New Password</label>
                  <input
                    type={showPassText ? 'text' : 'password'}
                    placeholder="Confirm new password"
                    value={confirmAdminPass}
                    onChange={(e) => setConfirmAdminPass(e.target.value)}
                    required
                    style={{ width: '100%' }}
                  />
                </div>

                {passFeedback && (
                  <div style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    background: passFeedback.type === 'error' ? 'var(--danger-soft)' : '#ECFDF5',
                    color: passFeedback.type === 'error' ? 'var(--danger)' : '#047857',
                    border: passFeedback.type === 'error' ? '1px solid rgba(220, 38, 38, 0.2)' : '1px solid rgba(16, 185, 129, 0.3)'
                  }}>
                    {passFeedback.type === 'error' ? '⚠️ ' : '✅ '}
                    {passFeedback.text}
                  </div>
                )}

                <div style={{ marginTop: '4px' }}>
                  <button className="btn primary block" type="submit" disabled={isSavingPass}>
                    {isSavingPass ? 'Saving to Cloud...' : '💾 Save New Admin Password'}
                  </button>
                </div>
              </form>
            </div>
          </div>

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
      {/* TAB 7: CASH DRAWER & SHIFT AUDITS */}
      {adminTab === 'drawer' && (() => {
        const activeDrawer = state.activeDrawerSession;
        let activeCashSalesTotal = 0;
        let activeCashSalesCount = 0;
        let activeOnlineSalesTotal = 0;
        let activeCashExpensesTotal = 0;
        let activeCashInTotal = 0;
        let activeCashOutTotal = 0;
        let activeExpectedCash = 0;

        if (activeDrawer) {
          const openTs = Number(activeDrawer.openedAt || 0);
          salesList.forEach(s => {
            if (!s.isVoid && Number(s.ts) >= openTs) {
              const pm = s.payMethod === 'Online' ? 'Online' : 'Cash';
              const { realPaid } = getSaleTotals(s);
              if (pm === 'Cash') {
                activeCashSalesTotal += realPaid;
                activeCashSalesCount++;
              } else {
                activeOnlineSalesTotal += realPaid;
              }
            }
          });

          expensesList.forEach(e => {
            if (Number(e.ts) >= openTs) {
              activeCashExpensesTotal += Number(e.amount || 0);
            }
          });

          (activeDrawer.adjustments || []).forEach(a => {
            if (a.type === 'in') activeCashInTotal += Number(a.amount || 0);
            if (a.type === 'out') activeCashOutTotal += Number(a.amount || 0);
          });

          activeExpectedCash = Number(activeDrawer.openingFloat || 0) + activeCashSalesTotal + activeCashInTotal - activeCashExpensesTotal - activeCashOutTotal;
        }

        const drawerHistory = state.drawerHistory || [];
        const filteredDrawerHistory = drawerHistory.filter(d => {
          if (filterDrawerStaff && (d.closedBy !== filterDrawerStaff && d.openedBy !== filterDrawerStaff)) return false;
          if (filterDrawerStatus === 'balanced' && d.variance !== 0) return false;
          if (filterDrawerStatus === 'short' && d.variance >= 0) return false;
          if (filterDrawerStatus === 'over' && d.variance <= 0) return false;
          return true;
        });

        const totalShiftsCount = drawerHistory.length;
        const balancedShiftsCount = drawerHistory.filter(d => d.variance === 0).length;
        const shortShiftsCount = drawerHistory.filter(d => d.variance < 0).length;
        const overShiftsCount = drawerHistory.filter(d => d.variance > 0).length;
        const netVarianceTotal = drawerHistory.reduce((sum, d) => sum + Number(d.variance || 0), 0);

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
            {/* LIVE REGISTER STATUS CARD */}
            <div
              className="card"
              style={{
                padding: '20px 24px',
                borderLeft: `5px solid ${activeDrawer ? '#10B981' : 'var(--muted)'}`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className={`drawer-status-pill ${activeDrawer ? 'open' : 'closed'}`}>
                      <span className="status-dot"></span>
                      {activeDrawer ? 'Counter Register: Active Shift' : 'Counter Register: Closed'}
                    </span>
                    {activeDrawer && (
                      <span style={{ fontWeight: 800, fontSize: '15px' }}>
                        Cashier: {activeDrawer.openedBy}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--muted)', marginTop: '6px' }}>
                    {activeDrawer ? (
                      <>
                        Opened {fmtDate(activeDrawer.openedAt)} · Starting Float: <strong className="mono">{money(activeDrawer.openingFloat)}</strong>
                        {activeDrawer.openingNote && ` · Note: "${activeDrawer.openingNote}"`}
                      </>
                    ) : (
                      'No active shift in the counter cash drawer right now. Staff can open a shift from Counter POS view.'
                    )}
                  </div>
                </div>

                {activeDrawer && (
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '11px', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 700 }}>
                        Expected Physical Cash
                      </div>
                      <div className="mono" style={{ fontSize: '22px', fontWeight: 800, color: '#10B981' }}>
                        {money(activeExpectedCash)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {activeDrawer && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                    gap: '12px',
                    marginTop: '16px',
                    paddingTop: '16px',
                    borderTop: '1px solid var(--line-soft)'
                  }}
                >
                  <div style={{ fontSize: '13px' }}>
                    <span style={{ color: 'var(--muted)' }}>Cash Sales: </span>
                    <strong className="mono" style={{ color: '#10B981' }}>+ {money(activeCashSalesTotal)}</strong> ({activeCashSalesCount})
                  </div>
                  <div style={{ fontSize: '13px' }}>
                    <span style={{ color: 'var(--muted)' }}>Online Sales: </span>
                    <strong className="mono" style={{ color: '#7C3AED' }}>{money(activeOnlineSalesTotal)}</strong>
                  </div>
                  <div style={{ fontSize: '13px' }}>
                    <span style={{ color: 'var(--muted)' }}>Cash Expenses: </span>
                    <strong className="mono" style={{ color: '#DC2626' }}>- {money(activeCashExpensesTotal)}</strong>
                  </div>
                  <div style={{ fontSize: '13px' }}>
                    <span style={{ color: 'var(--muted)' }}>Cash In / Out: </span>
                    <strong className="mono">+{money(activeCashInTotal)} / -{money(activeCashOutTotal)}</strong>
                  </div>
                </div>
              )}
            </div>

            {/* AUDIT SUMMARY STATS */}
            <div className="drawer-kpis">
              <div className="drawer-kpi-card" style={{ borderLeft: '4px solid #0284C7' }}>
                <div className="drawer-kpi-label">Closed Shifts Logged</div>
                <div className="drawer-kpi-val mono">{totalShiftsCount}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Historical shifts audited</div>
              </div>

              <div className="drawer-kpi-card" style={{ borderLeft: '4px solid #10B981' }}>
                <div className="drawer-kpi-label">Balanced Shifts</div>
                <div className="drawer-kpi-val mono" style={{ color: '#10B981' }}>{balancedShiftsCount}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>100% matched physical cash</div>
              </div>

              <div className="drawer-kpi-card" style={{ borderLeft: '4px solid #DC2626' }}>
                <div className="drawer-kpi-label">Cash Shortages / Over</div>
                <div className="drawer-kpi-val mono" style={{ color: shortShiftsCount > 0 ? '#DC2626' : 'var(--ink)' }}>
                  {shortShiftsCount} short · {overShiftsCount} over
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Discrepancy incidents</div>
              </div>

              <div className="drawer-kpi-card" style={{ borderLeft: `4px solid ${netVarianceTotal >= 0 ? '#10B981' : '#DC2626'}` }}>
                <div className="drawer-kpi-label">Net Shift Variance</div>
                <div className="drawer-kpi-val mono" style={{ color: netVarianceTotal >= 0 ? '#10B981' : '#DC2626' }}>
                  {netVarianceTotal === 0 ? 'Rs 0' : (netVarianceTotal > 0 ? `+ ${money(netVarianceTotal)}` : money(netVarianceTotal))}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>Cumulative difference</div>
              </div>
            </div>

            {/* SHIFTS AUDIT LOG CARD */}
            <div className="card">
              <h2>
                <span>📜 Shift Closings &amp; Cash Reconciliation History</span>
                <span className="badge">{filteredDrawerHistory.length} record(s)</span>
              </h2>
              <div className="body">
                {/* FILTERS */}
                <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '18px' }}>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>Filter by Staff Member</label>
                    <select value={filterDrawerStaff} onChange={(e) => setFilterDrawerStaff(e.target.value)} style={{ marginTop: '4px' }}>
                      <option value="">All Staff Members</option>
                      {state.staff.map(name => <option key={name} value={name}>{name}</option>)}
                    </select>
                  </div>

                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 700, color: 'var(--muted)' }}>Filter by Reconciliation Status</label>
                    <select value={filterDrawerStatus} onChange={(e) => setFilterDrawerStatus(e.target.value)} style={{ marginTop: '4px' }}>
                      <option value="">All Shifts</option>
                      <option value="balanced">🟢 Balanced Only (Match)</option>
                      <option value="short">🔴 Cash Shortages Only (-)</option>
                      <option value="over">🟡 Cash Overages Only (+)</option>
                    </select>
                  </div>
                </div>

                {!filteredDrawerHistory.length ? (
                  <div className="cart-empty" style={{ padding: '30px 0' }}>
                    No drawer shift records found matching your filter criteria.
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table>
                      <thead>
                        <tr>
                          <th>Shift Timing</th>
                          <th>Cashier(s)</th>
                          <th className="num">Starting Float</th>
                          <th className="num">Cash Sales</th>
                          <th className="num">Expenses &amp; Drops</th>
                          <th className="num">Expected Cash</th>
                          <th className="num">Counted Cash</th>
                          <th>Reconciliation</th>
                          <th>Denominations</th>
                          <th className="num">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDrawerHistory.map(d => {
                          const isBalanced = d.variance === 0;
                          const isOver = d.variance > 0;
                          const denoms = d.denominations || {};
                          const denomList = [
                            denoms.d5000 > 0 ? `5000×${denoms.d5000}` : null,
                            denoms.d1000 > 0 ? `1000×${denoms.d1000}` : null,
                            denoms.d500 > 0 ? `500×${denoms.d500}` : null,
                            denoms.d100 > 0 ? `100×${denoms.d100}` : null,
                            denoms.d50 > 0 ? `50×${denoms.d50}` : null,
                            denoms.d20 > 0 ? `20×${denoms.d20}` : null,
                            denoms.d10 > 0 ? `10×${denoms.d10}` : null,
                            denoms.coins > 0 ? `Coins: ${money(denoms.coins)}` : null
                          ].filter(Boolean).join(', ');

                          return (
                            <tr key={d.id}>
                              <td style={{ fontSize: '12px' }}>
                                <strong style={{ color: 'var(--ink)' }}>{fmtDate(d.closedAt || d.ts)}</strong>
                                {d.openedAt && (
                                  <div style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '2px' }}>
                                    Opened: {new Date(d.openedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}
                                  </div>
                                )}
                              </td>
                              <td style={{ fontWeight: 600 }}>
                                <div>{d.closedBy || d.staff || '—'}</div>
                                {d.openedBy && d.openedBy !== d.closedBy && (
                                  <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Opened by {d.openedBy}</div>
                                )}
                              </td>
                              <td className="num mono">{money(d.openingFloat)}</td>
                              <td className="num mono" style={{ color: '#059669', fontWeight: 700 }}>
                                + {money(d.cashSalesTotal)}
                                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>{d.cashSalesCount || 0} order(s)</div>
                              </td>
                              <td className="num mono" style={{ color: '#DC2626' }}>
                                - {money((Number(d.cashExpensesTotal) || 0) + (Number(d.cashOutTotal) || 0))}
                              </td>
                              <td className="num mono" style={{ fontWeight: 700 }}>
                                {money(d.expectedCash)}
                              </td>
                              <td className="num mono" style={{ fontWeight: 800, fontSize: '15px' }}>
                                {money(d.countedCash)}
                              </td>
                              <td>
                                {isBalanced ? (
                                  <span style={{ color: '#10B981', fontWeight: 800 }}>🟢 Balanced</span>
                                ) : isOver ? (
                                  <span style={{ color: '#D97706', fontWeight: 800 }}>🟡 Over +{money(d.variance)}</span>
                                ) : (
                                  <span style={{ color: '#DC2626', fontWeight: 800 }}>🔴 Short -{money(Math.abs(d.variance))}</span>
                                )}
                                {d.closingNotes && (
                                  <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '2px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.closingNotes}>
                                    "{d.closingNotes}"
                                  </div>
                                )}
                              </td>
                              <td style={{ fontSize: '11.5px', color: 'var(--muted)', maxWidth: '160px' }}>
                                {denomList || '—'}
                              </td>
                              <td className="num">
                                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                                  <button
                                    className="btn ghost sm"
                                    style={{ padding: '4px 8px', fontSize: '12px' }}
                                    title="Reprint Shift Slip"
                                    onClick={() => setSelectedShiftSlip(d)}
                                  >
                                    🧾 Slip
                                  </button>
                                  {onDeleteDrawerHistory && (
                                    <button
                                      className="btn danger sm"
                                      style={{ padding: '4px 6px', fontSize: '12px' }}
                                      title="Delete Record"
                                      onClick={() => onDeleteDrawerHistory(d.id)}
                                    >
                                      🗑️
                                    </button>
                                  )}
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
          </div>
        );
      })()}

      {/* ADMIN REPRINT THERMAL SHIFT CLOSING SLIP MODAL */}
      {selectedShiftSlip && (
        <div
          className="overlay show"
          onClick={(e) => {
            if (e.target.className && e.target.className.includes('overlay')) {
              setSelectedShiftSlip(null);
            }
          }}
        >
          <div>
            <div id="receipt">
              <div className="rc-in">
                <div className="rc-c rc-name">{state.studio}</div>
                <div className="rc-c rc-small">Shop # 45, Post Office Market HIT, Taxila Cantt</div>
                <div className="rc-c rc-small">Ph: 0304-5225523 · WhatsApp: 0327-5006990</div>
                <div className="rc-c rc-small" style={{ fontWeight: 900, textTransform: 'uppercase', marginTop: '4px' }}>
                  *** SHIFT CLOSING Z-REPORT ***
                </div>
                <div className="rc-sep"></div>

                <div className="rc-row"><span>Shift ID</span><span>{selectedShiftSlip.id}</span></div>
                <div className="rc-row"><span>Opened</span><span>{fmtDate(selectedShiftSlip.openedAt)}</span></div>
                <div className="rc-row"><span>Closed</span><span>{fmtDate(selectedShiftSlip.closedAt)}</span></div>
                <div className="rc-row"><span>Opened By</span><span>{selectedShiftSlip.openedBy || '—'}</span></div>
                <div className="rc-row"><span>Closed By</span><span>{selectedShiftSlip.closedBy || '—'}</span></div>

                <div className="rc-sep"></div>
                <div className="rc-row"><span>Opening Float</span><span>{money(selectedShiftSlip.openingFloat)}</span></div>
                <div className="rc-row"><span>Cash Sales ({selectedShiftSlip.cashSalesCount || 0})</span><span>+ {money(selectedShiftSlip.cashSalesTotal)}</span></div>
                {Number(selectedShiftSlip.onlineSalesTotal || 0) > 0 && (
                  <div className="rc-row"><span>Online Sales ({selectedShiftSlip.onlineSalesCount || 0})</span><span>{money(selectedShiftSlip.onlineSalesTotal)} (card/app)</span></div>
                )}
                {Number(selectedShiftSlip.cashExpensesTotal || 0) > 0 && (
                  <div className="rc-row"><span>Cash Expenses ({selectedShiftSlip.cashExpensesCount || 0})</span><span>- {money(selectedShiftSlip.cashExpensesTotal)}</span></div>
                )}
                {Number(selectedShiftSlip.cashInTotal || 0) > 0 && (
                  <div className="rc-row"><span>Cash In Drops</span><span>+ {money(selectedShiftSlip.cashInTotal)}</span></div>
                )}
                {Number(selectedShiftSlip.cashOutTotal || 0) > 0 && (
                  <div className="rc-row"><span>Cash Out Drops</span><span>- {money(selectedShiftSlip.cashOutTotal)}</span></div>
                )}

                <div className="rc-sep"></div>
                <div className="rc-row" style={{ fontWeight: 800 }}>
                  <span>EXPECTED CASH</span>
                  <span>{money(selectedShiftSlip.expectedCash)}</span>
                </div>
                <div className="rc-row" style={{ fontWeight: 900, fontSize: '14px' }}>
                  <span>COUNTED CASH</span>
                  <span>{money(selectedShiftSlip.countedCash)}</span>
                </div>
                <div className="rc-row" style={{ fontWeight: 900 }}>
                  <span>VARIANCE</span>
                  <span>
                    {selectedShiftSlip.variance === 0
                      ? 'MATCH / 0.00'
                      : selectedShiftSlip.variance > 0
                      ? `OVER +${money(selectedShiftSlip.variance)}`
                      : `SHORT -${money(Math.abs(selectedShiftSlip.variance))}`}
                  </span>
                </div>

                {selectedShiftSlip.denominations && (
                  <>
                    <div className="rc-sep"></div>
                    <div className="rc-c rc-small" style={{ fontWeight: 800 }}>CURRENCY BREAKDOWN</div>
                    {selectedShiftSlip.denominations.d5000 > 0 && <div className="rc-row"><span>Rs 5,000 × {selectedShiftSlip.denominations.d5000}</span><span>{money(selectedShiftSlip.denominations.d5000 * 5000)}</span></div>}
                    {selectedShiftSlip.denominations.d1000 > 0 && <div className="rc-row"><span>Rs 1,000 × {selectedShiftSlip.denominations.d1000}</span><span>{money(selectedShiftSlip.denominations.d1000 * 1000)}</span></div>}
                    {selectedShiftSlip.denominations.d500 > 0 && <div className="rc-row"><span>Rs 500 × {selectedShiftSlip.denominations.d500}</span><span>{money(selectedShiftSlip.denominations.d500 * 500)}</span></div>}
                    {selectedShiftSlip.denominations.d100 > 0 && <div className="rc-row"><span>Rs 100 × {selectedShiftSlip.denominations.d100}</span><span>{money(selectedShiftSlip.denominations.d100 * 100)}</span></div>}
                    {selectedShiftSlip.denominations.d50 > 0 && <div className="rc-row"><span>Rs 50 × {selectedShiftSlip.denominations.d50}</span><span>{money(selectedShiftSlip.denominations.d50 * 50)}</span></div>}
                    {selectedShiftSlip.denominations.d20 > 0 && <div className="rc-row"><span>Rs 20 × {selectedShiftSlip.denominations.d20}</span><span>{money(selectedShiftSlip.denominations.d20 * 20)}</span></div>}
                    {selectedShiftSlip.denominations.d10 > 0 && <div className="rc-row"><span>Rs 10 × {selectedShiftSlip.denominations.d10}</span><span>{money(selectedShiftSlip.denominations.d10 * 10)}</span></div>}
                    {selectedShiftSlip.denominations.coins > 0 && <div className="rc-row"><span>Coins</span><span>{money(selectedShiftSlip.denominations.coins)}</span></div>}
                  </>
                )}

                {selectedShiftSlip.closingNotes && (
                  <>
                    <div className="rc-sep"></div>
                    <div className="rc-small"><strong>Note:</strong> {selectedShiftSlip.closingNotes}</div>
                  </>
                )}

                <div className="rc-sep"></div>
                <div className="rc-foot" style={{ marginTop: '10px' }}>
                  Cashier Sign: __________________<br />
                  Manager Sign: __________________<br />
                  Powered By Lunar Ai
                </div>
              </div>
            </div>

            <div className="rc-actions">
              <button className="btn primary" style={{ flex: 1 }} onClick={() => window.print()}>
                🖨️ Print Shift Slip
              </button>
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => setSelectedShiftSlip(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT / ADD MANUAL PUNCH MODAL */}
      {selectedPunchEdit && (
        <div
          className="overlay show"
          onClick={(e) => {
            if (e.target.className && e.target.className.includes('overlay')) setSelectedPunchEdit(null);
          }}
        >
          <div className="card" style={{ maxWidth: '520px', width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>
                {selectedPunchEdit.id ? '✏️ Edit Attendance Punch' : '➕ Add Manual Attendance / Leave'}
              </h3>
              <button className="x" onClick={() => setSelectedPunchEdit(null)}>×</button>
            </div>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const { id, staff, date, clockInTime, clockOutTime, status, notes } = selectedPunchEdit;
              const isAbsentOrLeave = status === 'absent' || status === 'leave';

              let clockInTs = null;
              let clockOutTs = null;
              let workMinutes = 0;

              if (!isAbsentOrLeave) {
                const [inH, inM] = (clockInTime || '10:00').split(':').map(Number);
                const [y, m, d] = date.split('-').map(Number);
                const inDate = new Date(y, m - 1, d, inH, inM, 0);
                clockInTs = inDate.getTime();

                if (clockOutTime && status !== 'clocked_in' && status !== 'on_break') {
                  const [outH, outM] = clockOutTime.split(':').map(Number);
                  const outDate = new Date(y, m - 1, d, outH, outM, 0);
                  clockOutTs = outDate.getTime();
                }

                if (clockInTs && clockOutTs && clockOutTs > clockInTs) {
                  workMinutes = Math.max(0, Math.round((clockOutTs - clockInTs) / 60000));
                }
              } else {
                const [y, m, d] = date.split('-').map(Number);
                const dayDate = new Date(y, m - 1, d, 9, 0, 0);
                clockInTs = dayDate.getTime();
              }

              const payload = {
                id,
                staff,
                date,
                clockIn: clockInTs,
                clockOut: clockOutTs,
                breaks: [],
                totalWorkMinutes: isAbsentOrLeave ? 0 : workMinutes,
                status,
                notes: notes.trim(),
                isManual: true
              };

              if (onSaveManualAttendance) {
                await onSaveManualAttendance(payload);
              }
              setSelectedPunchEdit(null);
            }}>
              <div className="field">
                <label>Staff Member</label>
                <select
                  value={selectedPunchEdit.staff}
                  onChange={(e) => setSelectedPunchEdit({ ...selectedPunchEdit, staff: e.target.value })}
                >
                  {state.staff.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Date (YYYY-MM-DD)</label>
                <input
                  type="date"
                  value={selectedPunchEdit.date}
                  onChange={(e) => setSelectedPunchEdit({ ...selectedPunchEdit, date: e.target.value })}
                  required
                />
              </div>

              <div className="field">
                <label>Attendance Status</label>
                <select
                  value={selectedPunchEdit.status}
                  onChange={(e) => setSelectedPunchEdit({ ...selectedPunchEdit, status: e.target.value })}
                  style={{ fontWeight: 800 }}
                >
                  <option value="absent">❌ Mark Absent (Did Not Attend / Missing)</option>
                  <option value="leave">🏖️ Approved Leave / Day Off</option>
                  <option value="completed">🏁 Completed Shift</option>
                  <option value="clocked_in">🟢 Clocked In (Active On Duty)</option>
                </select>
              </div>

              {selectedPunchEdit.status !== 'absent' && selectedPunchEdit.status !== 'leave' && (
                <div className="row r2">
                  <div className="field">
                    <label>Clock-In Time</label>
                    <input
                      type="time"
                      value={selectedPunchEdit.clockInTime || '10:00'}
                      onChange={(e) => setSelectedPunchEdit({ ...selectedPunchEdit, clockInTime: e.target.value })}
                      required
                    />
                  </div>
                  <div className="field">
                    <label>Clock-Out Time</label>
                    <input
                      type="time"
                      value={selectedPunchEdit.clockOutTime || '19:00'}
                      onChange={(e) => setSelectedPunchEdit({ ...selectedPunchEdit, clockOutTime: e.target.value })}
                    />
                  </div>
                </div>
              )}

              {selectedPunchEdit.status === 'absent' && (
                <div style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', color: '#DC2626', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: 600 }}>
                  ⚠️ Marking as <strong>Absent</strong> records 0 working hours for this date.
                </div>
              )}

              <div className="field" style={{ marginTop: '12px' }}>
                <label>Notes / Reason</label>
                <input
                  placeholder="e.g. Uninformed absence / Sick leave / Regular shift"
                  value={selectedPunchEdit.notes}
                  onChange={(e) => setSelectedPunchEdit({ ...selectedPunchEdit, notes: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '22px' }}>
                <button type="submit" className="btn primary" style={{ flex: 1, padding: '12px', fontWeight: 700 }}>
                  💾 Save Attendance Record
                </button>
                <button type="button" className="btn ghost" onClick={() => setSelectedPunchEdit(null)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINTABLE TIMESHEET MODAL */}
      {showPrintTimesheet && (
        <div
          className="overlay show"
          onClick={(e) => {
            if (e.target.className && e.target.className.includes('overlay')) setShowPrintTimesheet(false);
          }}
        >
          <div className="card" style={{ maxWidth: '820px', width: '100%', padding: '30px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '22px', fontWeight: 800 }}>Ideal Photo Studio</h2>
                <div style={{ color: 'var(--muted)', fontSize: '13px' }}>
                  Shop # 45, Post Office Market HIT, Taxila Cantt · Monthly Attendance Report
                </div>
                <div style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '14px', marginTop: '4px' }}>
                  Period: {fmtMonthKey(selectedMonthKey)}
                </div>
              </div>
              <button className="x" onClick={() => setShowPrintTimesheet(false)}>×</button>
            </div>

            <table style={{ width: '100%', marginBottom: '24px' }}>
              <thead>
                <tr>
                  <th>Staff Name</th>
                  <th className="num">Days Present</th>
                  <th className="num">Total Hours</th>
                  <th className="num">❌ Absent</th>
                  <th className="num">🏖️ Leaves</th>
                  <th>Sign</th>
                </tr>
              </thead>
              <tbody>
                {state.staff.map(name => {
                  const staffRecs = (state.attendance || []).filter(a => a.staff === name && (a.date || '').startsWith(selectedMonthKey));
                  const days = new Set(staffRecs.filter(a => a.status !== 'leave' && a.status !== 'absent').map(a => a.date)).size;
                  const totalMin = staffRecs.reduce((sum, a) => sum + (Number(a.totalWorkMinutes) || 0), 0);
                  const absents = staffRecs.filter(a => a.status === 'absent').length;
                  const leaves = staffRecs.filter(a => a.status === 'leave').length;

                  return (
                    <tr key={name}>
                      <td style={{ fontWeight: 800, padding: '10px 8px' }}>{name}</td>
                      <td className="num mono" style={{ fontWeight: 700 }}>{days}</td>
                      <td className="num mono" style={{ fontWeight: 700 }}>{(totalMin / 60).toFixed(1)} hrs ({formatMinStr(totalMin)})</td>
                      <td className="num mono">{absents > 0 ? <span style={{ color: '#DC2626', fontWeight: 800 }}>{absents}</span> : '0'}</td>
                      <td className="num mono">{leaves}</td>
                      <td style={{ borderBottom: '1px solid #CCC', width: '140px' }}></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', paddingTop: '20px', borderTop: '1px solid var(--line)', fontSize: '13px' }}>
              <div>
                Verified By: ___________________<br />
                (Studio Manager)
              </div>
              <div style={{ textAlign: 'right' }}>
                Approved By: ___________________<br />
                (Proprietor / Usman)
              </div>
            </div>

            <div className="rc-actions" style={{ marginTop: '24px' }}>
              <button type="button" className="btn primary" style={{ flex: 1 }} onClick={() => window.print()}>
                🖨️ Print Timesheet
              </button>
              <button type="button" className="btn ghost" style={{ flex: 1 }} onClick={() => setShowPrintTimesheet(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
