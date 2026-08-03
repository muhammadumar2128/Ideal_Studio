import React, { useState, useEffect } from 'react';
import logoImg from '../WhatsApp Image 2026-08-01 at 3.09.30 PM.jpeg';
import { supabase } from './supabaseClient.js';
import PlatformLogin from './components/PlatformLogin.jsx';
import AdminLogin from './components/AdminLogin.jsx';
import AdminDashboard from './components/AdminDashboard.jsx';
import TeamPOSView from './components/TeamPOSView.jsx';

const CUR = "Rs";
const KEY = "studio_pos_v3";

function getDefaults() {
  const prints = {
    "4x6": { normal: 200, bg: 250, reorder: 60, urgent: 100 },
    "5x7": { normal: 300, bg: 350, reorder: 150, urgent: 200 },
    "6x8": { normal: 350, bg: 400, reorder: 250, urgent: 300 },
    "6x9": { normal: 450, bg: 500, reorder: 350 },
    "8x10": { normal: 650, bg: 700, reorder: 550 },
    "8x12": { normal: 700, bg: 750, reorder: 600 },
    "10x12": { normal: 950, bg: 1000, reorder: 800 },
    "10x15": { normal: 1100, bg: 1150, reorder: 850 },
    "12x16": { normal: 1400, bg: 1450, reorder: 1200 },
    "12x18": { normal: 1450, bg: 1500, reorder: 1300 },
    "16x20": { normal: 2600, bg: 2650, reorder: 2300 },
    "20x24": { normal: 3600, bg: 3650, reorder: 3000 },
    "24x30": { normal: 4200, bg: 4250, reorder: 3600 },
    "24x30 (large)": { normal: 4700, bg: 4750, reorder: 4200 }
  };
  const frames = { "4x6": 400, "5x7": 450, "6x8": 500, "6x9": 550, "8x10": 650, "8x12": 700, "10x12": 950, "10x15": 1000, "12x16": 1250, "12x18": 1300, "16x20": 2300, "20x24": 2800, "24x30": 3600, "24x30 (large)": 4200 };
  const exp = { 4: 200, 8: 250, 12: 300, 16: 350, 20: 400, 24: 450, 28: 500, 32: 550, 36: 600, 40: 650, 44: 700, 48: 750, 52: 800, 56: 850 };
  const ro = { 4: 150, 8: 200, 12: 250, 16: 300, 20: 350, 24: 400, 28: 450, 32: 500, 36: 550, 40: 600, 44: 650, 48: 700, 52: 750, 56: 800 };
  const misc = [
    { name: "1x1 pic — per piece", price: 0 },
    { name: "PP / Passport photo — per piece", price: 0 },
    { name: "White Mug", price: 1300 }, { name: "Magic Cup", price: 1600 }, { name: "Any Image Print", price: 20 },
    { name: "Certificate Paper Print (A4)", price: 450 }, { name: "Scan", price: 40 }, { name: "A4 B&W PDF / Word", price: 10 },
    { name: "CD", price: 150 }, { name: "DVD", price: 200 }, { name: "Colour Print (SET PRICE)", price: 0 },
    { name: "R.O 2B Pic", price: 150 },
    { name: "BG Change (flat)", price: 200 }, { name: "Re-Order PP set on 4R sheet", price: 150 }
  ];
  const sets = [{ name: "Set — 4 PP + 4 1x1 pics", price: 250 }];
  return {
    studio: "Ideal Photo Studio",
    counter: 0,
    sales: [],
    staff: ["Umar", "Kabeer", "Owner - Usman", "Alex"],
    lastStaff: "Umar",
    prints,
    frames,
    albumExp: exp,
    albumRo: ro,
    oneByOneExp: JSON.parse(JSON.stringify(exp)),
    oneByOneRo: JSON.parse(JSON.stringify(ro)),
    sets,
    misc,
    expenses: []
  };
}

function loadInitialState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const defs = getDefaults();
      for (let k in defs) {
        if (!(k in parsed)) parsed[k] = defs[k];
      }
      return parsed;
    }
  } catch (e) {
    console.error(e);
  }
  return getDefaults();
}

function money(n) {
  return CUR + " " + Number(n || 0).toLocaleString("en-PK");
}

function pad(n) {
  return ("0000" + n).slice(-4);
}

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

export default function App() {
  const [state, setState] = useState(loadInitialState);
  const [isPlatformAuth, setIsPlatformAuth] = useState(() => {
    return localStorage.getItem('platform_pos_auth') === 'true' || sessionStorage.getItem('platform_pos_auth') === 'true';
  });
  const [viewMode, setViewMode] = useState('team'); // 'team' or 'admin'
  const [adminUser, setAdminUser] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [cloudSynced, setCloudSynced] = useState(false);
  const [activeModalSale, setActiveModalSale] = useState(null);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('studio_pos_theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('studio_pos_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // Auto-save state to localStorage whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Could not save to localStorage:', e);
    }
  }, [state]);

  // Check Supabase Auth session on mount
  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAdminUser(session.user);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAdminUser(session?.user || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Fetch initial data from Supabase and subscribe to Realtime updates
  useEffect(() => {
    if (!supabase) return;

    let isMounted = true;

    async function initSupabase() {
      try {
        const [salesRes, settingsRes] = await Promise.all([
          supabase.from('sales').select('*').order('ts', { ascending: false }),
          supabase.from('studio_settings').select('*').eq('id', 1).maybeSingle()
        ]);

        if (salesRes.error) console.warn('Supabase sales error:', salesRes.error.message);
        if (settingsRes.error) console.warn('Supabase settings error:', settingsRes.error.message);

        if (isMounted) {
          setCloudSynced(true);
          setState(prev => {
            const updated = { ...prev };
            if (salesRes.data && salesRes.data.length > 0) {
              const normalSales = [];
              const expList = [];

              salesRes.data.forEach(s => {
                const isExp = s.customer === '__EXPENSE__' || (s.id && String(s.id).startsWith('EXP-'));
                if (isExp) {
                  expList.push({
                    id: s.id,
                    ts: Number(s.ts),
                    title: (s.items && s.items[0] && s.items[0].title) || 'Expense',
                    amount: Number(s.total || 0),
                    category: s.phone || (s.items && s.items[0] && s.items[0].category) || 'Supplies',
                    staff: s.staff || 'Umar'
                  });
                } else {
                  const pm = s.payMethod || (s.items && s.items[0] && s.items[0].payMethod) || 'Cash';
                  normalSales.push({
                    id: s.id,
                    ts: Number(s.ts),
                    staff: s.staff || '',
                    customer: s.customer || '',
                    phone: s.phone || '',
                    items: s.items || [],
                    total: Number(s.total || 0),
                    paid: Number(s.paid != null ? s.paid : s.total),
                    balance: Number(s.balance || 0),
                    payMethod: pm
                  });
                }
              });

              updated.sales = normalSales;
              if (expList.length > 0) updated.expenses = expList;
            }

            if (settingsRes.data) {
              const st = settingsRes.data;
              if (st.studio_name) updated.studio = st.studio_name;
              if (st.counter != null && st.counter > updated.counter) updated.counter = st.counter;
              if (st.last_staff) updated.lastStaff = st.last_staff;
              if (st.staff && Array.isArray(st.staff) && st.staff.length > 0) updated.staff = st.staff;
              if (st.prints && Object.keys(st.prints).length > 0) updated.prints = st.prints;
              if (st.frames && Object.keys(st.frames).length > 0) updated.frames = st.frames;
              if (st.album_exp) updated.albumExp = st.album_exp;
              if (st.album_ro) updated.albumRo = st.album_ro;
              if (st.one_by_one_exp) updated.oneByOneExp = st.one_by_one_exp;
              if (st.one_by_one_ro) updated.oneByOneRo = st.one_by_one_ro;
              if (st.sets) updated.sets = st.sets;
              if (st.misc) updated.misc = st.misc;
              if (st.expenses && Array.isArray(st.expenses) && st.expenses.length > 0) updated.expenses = st.expenses;
            }
            return updated;
          });
        }
      } catch (err) {
        console.error('Supabase init failed:', err);
      }
    }

    initSupabase();

    // Subscribe to realtime database changes
    const channel = supabase
      .channel('pos_realtime_app')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new;
          const isExp = row.customer === '__EXPENSE__' || (row.id && String(row.id).startsWith('EXP-'));
          if (isExp) {
            const formattedExp = {
              id: row.id,
              ts: Number(row.ts),
              title: (row.items && row.items[0] && row.items[0].title) || 'Expense',
              amount: Number(row.total || 0),
              category: row.phone || (row.items && row.items[0] && row.items[0].category) || 'Supplies',
              staff: row.staff || 'Umar'
            };
            setState(prev => {
              if (prev.expenses && prev.expenses.some(e => e.id === formattedExp.id)) return prev;
              return { ...prev, expenses: [formattedExp, ...(prev.expenses || [])] };
            });
          } else {
            const pm = row.payMethod || (row.items && row.items[0] && row.items[0].payMethod) || 'Cash';
            const formatted = {
              id: row.id,
              ts: Number(row.ts),
              staff: row.staff || '',
              customer: row.customer || '',
              phone: row.phone || '',
              items: row.items || [],
              total: Number(row.total || 0),
              paid: Number(row.paid != null ? row.paid : row.total),
              balance: Number(row.balance || 0),
              payMethod: pm
            };
            setState(prev => {
              if (prev.sales.some(s => s.id === formatted.id)) return prev;
              return { ...prev, sales: [formatted, ...prev.sales] };
            });
          }
        } else if (payload.eventType === 'UPDATE') {
          const row = payload.new;
          const isExp = row.customer === '__EXPENSE__' || (row.id && String(row.id).startsWith('EXP-'));
          if (isExp) {
            const formattedExp = {
              id: row.id,
              ts: Number(row.ts),
              title: (row.items && row.items[0] && row.items[0].title) || 'Expense',
              amount: Number(row.total || 0),
              category: row.phone || (row.items && row.items[0] && row.items[0].category) || 'Supplies',
              staff: row.staff || 'Umar'
            };
            setState(prev => ({
              ...prev,
              expenses: (prev.expenses || []).map(e => e.id === row.id ? formattedExp : e)
            }));
          } else {
            setState(prev => ({
              ...prev,
              sales: prev.sales.map(s => s.id === row.id ? {
                id: row.id,
                ts: Number(row.ts),
                staff: row.staff || '',
                customer: row.customer || '',
                phone: row.phone || '',
                items: row.items || [],
                total: Number(row.total || 0),
                paid: Number(row.paid != null ? row.paid : row.total),
                balance: Number(row.balance || 0),
                payMethod: row.payMethod || (row.items && row.items[0] && row.items[0].payMethod) || 'Cash'
              } : s)
            }));
          }
        } else if (payload.eventType === 'DELETE') {
          const oldId = payload.old.id;
          const isExp = String(oldId).startsWith('EXP-');
          if (isExp) {
            setState(prev => ({ ...prev, expenses: (prev.expenses || []).filter(e => e.id !== oldId) }));
          } else {
            setState(prev => ({ ...prev, sales: prev.sales.filter(s => s.id !== oldId) }));
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'studio_settings' }, (payload) => {
        if (payload.new) {
          const st = payload.new;
          setState(prev => ({
            ...prev,
            studio: st.studio_name || prev.studio,
            counter: st.counter != null ? st.counter : prev.counter,
            lastStaff: st.last_staff || prev.lastStaff,
            staff: st.staff || prev.staff,
            prints: st.prints || prev.prints,
            frames: st.frames || prev.frames,
            albumExp: st.album_exp || prev.albumExp,
            albumRo: st.album_ro || prev.albumRo,
            oneByOneExp: st.one_by_one_exp || prev.oneByOneExp,
            oneByOneRo: st.one_by_one_ro || prev.oneByOneRo,
            sets: st.sets || prev.sets,
            misc: st.misc || prev.misc
          }));
        }
      })
      .subscribe();

    return () => {
      isMounted = false;
      supabase.removeChannel(channel);
    };
  }, []);

  // Helper to sync updated settings to Supabase and LocalStorage
  const syncSettingsToCloud = async (newState) => {
    try {
      localStorage.setItem('ideal_studio_pos_v2', JSON.stringify(newState));
    } catch (err) {
      console.warn('LocalStorage save error:', err);
    }

    if (!supabase) return;
    try {
      const { error } = await supabase.from('studio_settings').upsert({
        id: 1,
        studio_name: newState.studio,
        counter: newState.counter,
        last_staff: newState.lastStaff,
        staff: newState.staff,
        prints: newState.prints,
        frames: newState.frames,
        album_exp: newState.albumExp,
        album_ro: newState.albumRo,
        one_by_one_exp: newState.oneByOneExp,
        one_by_one_ro: newState.oneByOneRo,
        sets: newState.sets,
        misc: newState.misc,
        updated_at: new Date().toISOString()
      });

      if (error) {
        console.error('Supabase settings upsert error:', error.message);
      }
    } catch (e) {
      console.error('Error syncing settings to Supabase:', e);
    }
  };

  // Handle saving new sale from Team POS
  const handleSaveSaleFromTeam = async ({ cart, selStaff, fCust, fPhone, cartTotal, paidVal, cartBalance, payMethod }) => {
    const nextCounter = state.counter + 1;
    const chosenPayMethod = payMethod || 'Cash';
    const itemsWithPayMethod = cart.map((it, i) => i === 0 ? { ...it, payMethod: chosenPayMethod } : it);

    const newSale = {
      id: "R-" + pad(nextCounter),
      ts: Date.now(),
      staff: selStaff,
      customer: fCust.trim(),
      phone: fPhone.trim(),
      items: itemsWithPayMethod,
      total: cartTotal,
      paid: paidVal,
      balance: cartBalance,
      payMethod: chosenPayMethod
    };

    const nextState = {
      ...state,
      counter: nextCounter,
      lastStaff: selStaff,
      sales: [newSale, ...state.sales]
    };
    setState(nextState);
    setActiveModalSale(newSale);

    if (supabase) {
      try {
        await supabase.from('sales').insert([{
          id: newSale.id,
          ts: newSale.ts,
          staff: newSale.staff,
          customer: newSale.customer,
          phone: newSale.phone,
          items: newSale.items,
          total: newSale.total,
          paid: newSale.paid,
          balance: newSale.balance
        }]);

        await supabase.from('studio_settings').upsert({
          id: 1,
          counter: nextCounter,
          last_staff: selStaff,
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.error('Error saving to Supabase:', err);
      }
    }
  };

  // Handle Mark Paid
  const handleMarkPaid = async (saleId, payMethodArg) => {
    const targetSale = state.sales.find(s => s.id === saleId);
    if (!targetSale) return;

    let finalPayMethod = payMethodArg;
    if (!finalPayMethod) {
      const isOnline = window.confirm(`Mark receipt ${saleId} as Paid via Online Transfer?\n\nClick [OK] for Online Transfer, or [Cancel] for Cash.`);
      finalPayMethod = isOnline ? 'Online' : 'Cash';
    }

    const updatedItems = (targetSale.items || []).map((it, i) => i === 0 ? { ...it, payMethod: finalPayMethod } : it);

    setState(prev => ({
      ...prev,
      sales: prev.sales.map(s => {
        if (s.id === saleId) {
          return { ...s, paid: s.total, balance: 0, payMethod: finalPayMethod, items: updatedItems };
        }
        return s;
      })
    }));

    if (activeModalSale && activeModalSale.id === saleId) {
      setActiveModalSale(prev => ({ ...prev, paid: prev.total, balance: 0, payMethod: finalPayMethod, items: updatedItems }));
    }

    if (supabase) {
      try {
        await supabase
          .from('sales')
          .update({ paid: targetSale.total, balance: 0, items: updatedItems })
          .eq('id', saleId);
      } catch (err) {
        console.error('Error updating sale in Supabase:', err);
      }
    }
  };

  // Handle Delete Individual Sale (Admin Only)
  const handleDeleteSale = async (saleId) => {
    if (!window.confirm(`Delete receipt ${saleId}? This cannot be undone.`)) return;

    setState(prev => ({
      ...prev,
      sales: prev.sales.filter(s => s.id !== saleId)
    }));

    if (activeModalSale && activeModalSale.id === saleId) {
      setActiveModalSale(null);
    }

    if (supabase) {
      try {
        await supabase
          .from('sales')
          .delete()
          .eq('id', saleId);
      } catch (err) {
        console.error('Error deleting sale in Supabase:', err);
      }
    }
  };

  // Expense Handlers
  const handleAddExpense = async ({ title, amount, category, staff }) => {
    const newExp = {
      id: "EXP-" + Date.now(),
      ts: Date.now(),
      title: title.trim(),
      amount: Number(amount) || 0,
      category: category || "General",
      staff: staff || state.lastStaff || "Umar"
    };

    const nextState = {
      ...state,
      expenses: [newExp, ...(state.expenses || [])]
    };
    setState(nextState);

    if (supabase) {
      try {
        await supabase.from('sales').insert([{
          id: newExp.id,
          ts: newExp.ts,
          staff: newExp.staff,
          customer: '__EXPENSE__',
          phone: newExp.category,
          items: [{ title: newExp.title, category: newExp.category, amount: newExp.amount }],
          total: newExp.amount,
          paid: newExp.amount,
          balance: 0
        }]);
      } catch (err) {
        console.error('Error syncing expense to Supabase:', err);
      }
    }
  };

  const handleDeleteExpense = async (expId) => {
    if (!window.confirm("Delete this expense record?")) return;
    const nextState = {
      ...state,
      expenses: (state.expenses || []).filter(e => e.id !== expId)
    };
    setState(nextState);

    if (supabase) {
      try {
        await supabase.from('sales').delete().eq('id', expId);
      } catch (err) {
        console.error('Error deleting expense from Supabase:', err);
      }
    }
  };

  // Export & Backup handlers
  const downloadFile = (fileName, content, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 500);
  };

  const handleExportJson = () => {
    downloadFile(`studio-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(state, null, 2), "application/json");
  };

  const handleExportCsv = () => {
    const rows = [["Receipt", "Date", "Time", "Staff", "Customer", "Phone", "Category", "Item", "Qty", "Unit price", "Line total", "Receipt total"]];
    [...state.sales].reverse().forEach(s => {
      const d = new Date(s.ts);
      s.items.forEach(it => {
        rows.push([s.id, d.toLocaleDateString("en-GB"), d.toLocaleTimeString("en-GB"), s.staff || "", s.customer || "", s.phone || "", it.cat, it.label, it.qty, it.price, it.price * it.qty, s.total]);
      });
    });
    const csv = rows.map(r => r.map(c => {
      const str = String(c);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(",")).join("\n");
    downloadFile(`studio-sales-${new Date().toISOString().slice(0, 10)}.csv`, csv, "text/csv");
  };

  const handleImportJson = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      try {
        const parsed = JSON.parse(evt.target.result);
        if (!parsed.sales) throw new Error("Invalid format");
        if (window.confirm(`Restore this backup? It replaces your current ${state.sales.length} record(s).`)) {
          const defs = getDefaults();
          for (let k in defs) {
            if (!(k in parsed)) parsed[k] = defs[k];
          }
          setState(parsed);
          await syncSettingsToCloud(parsed);
          alert(`Restored ${parsed.sales.length} record(s).`);
        }
      } catch (err) {
        alert("That file doesn't look like a valid backup.");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  };

  const handleWipeAll = async () => {
    if (!window.confirm("Delete ALL records from Cloud Database? This cannot be undone.")) return;
    if (!window.confirm("Really sure? Export a backup first if you haven't.")) return;

    const nextState = { ...state, sales: [], counter: 0 };
    setState(nextState);

    if (supabase) {
      try {
        await supabase.from('sales').delete().neq('id', '');
        await supabase.from('studio_settings').upsert({ id: 1, counter: 0 });
      } catch (err) {
        console.error('Error wiping Supabase data:', err);
      }
    }
  };

  const handleSwitchToAdmin = () => {
    if (adminUser) {
      setViewMode('admin');
    } else {
      setShowLoginModal(true);
    }
  };

  const handleLogoutAdmin = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setAdminUser(null);
    setViewMode('team');
  };

  // 1. If not authenticated into the Platform yet, render Platform Login screen
  if (!isPlatformAuth) {
    return (
      <PlatformLogin
        onLoginSuccess={() => {
          localStorage.setItem('platform_pos_auth', 'true');
          sessionStorage.setItem('platform_pos_auth', 'true');
          setIsPlatformAuth(true);
        }}
      />
    );
  }

  return (
    <>
      <div className="wrap">
      {/* GLOBAL HEADER */}
      <header className="top">
        <div className="brand">
          <img src={logoImg} alt="Ideal Photo Studio Logo" className="logo" />
          <div>
            <h1>
              <span
                id="studioName"
                contentEditable={viewMode === 'admin'}
                suppressContentEditableWarning
                spellCheck={false}
                onBlur={(e) => {
                  const val = e.target.innerText.trim() || "Ideal Photo Studio";
                  const nextState = { ...state, studio: val };
                  setState(nextState);
                  syncSettingsToCloud(nextState);
                }}
              >
                {state.studio}
              </span>
            </h1>
            <div className="sub">
              Ph: 0304-5225523 · WhatsApp: 0327-5006990
              {cloudSynced ? (
                <span style={{ marginLeft: '8px', color: 'var(--emerald)', fontWeight: 700 }}>
                  ⚡ Supabase Live
                </span>
              ) : (
                <span style={{ marginLeft: '8px', color: 'var(--muted)' }}>
                  💾 Local Cache
                </span>
              )}
            </div>
          </div>
        </div>

        {/* MODE SWITCHER & PLATFORM LOCK BUTTONS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {viewMode === 'team' ? (
            <button
              className="btn primary"
              onClick={handleSwitchToAdmin}
              style={{ borderRadius: '10px', fontSize: '13.5px' }}
            >
              📊 {adminUser ? 'Open Admin Dashboard' : 'Admin Login'}
            </button>
          ) : (
            <button
              className="btn ghost"
              onClick={() => setViewMode('team')}
              style={{ borderRadius: '10px', fontSize: '13.5px' }}
            >
              🛒 Back to Counter POS
            </button>
          )}

          <button
            className="btn ghost sm"
            title="Toggle Light/Dark Theme"
            onClick={toggleTheme}
            style={{ borderRadius: '10px', fontWeight: 600 }}
          >
            {theme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode'}
          </button>

          <button
            className="btn ghost sm"
            title="Lock platform"
            onClick={() => {
              localStorage.removeItem('platform_pos_auth');
              sessionStorage.removeItem('platform_pos_auth');
              setIsPlatformAuth(false);
            }}
            style={{ borderRadius: '10px', color: 'var(--muted)' }}
          >
            🔒 Lock
          </button>
        </div>
      </header>

      {/* VIEW SWITCHING: TEAM POS vs ADMIN DASHBOARD */}
      {viewMode === 'team' ? (
        <TeamPOSView
          state={state}
          onSaveSale={handleSaveSaleFromTeam}
          onMarkPaid={handleMarkPaid}
          onAddExpense={handleAddExpense}
          onDeleteExpense={handleDeleteExpense}
          setActiveModalSale={setActiveModalSale}
          onOpenAdminLogin={() => setShowLoginModal(true)}
          isAdminLoggedIn={!!adminUser}
        />
      ) : (
        <AdminDashboard
          state={state}
          setState={setState}
          onLogout={handleLogoutAdmin}
          onMarkPaid={handleMarkPaid}
          onDeleteSale={handleDeleteSale}
          onAddExpense={handleAddExpense}
          onDeleteExpense={handleDeleteExpense}
          onSyncSettings={syncSettingsToCloud}
          onWipeAll={handleWipeAll}
          onExportJson={handleExportJson}
          onExportCsv={handleExportCsv}
          onImportJson={handleImportJson}
          setActiveModalSale={setActiveModalSale}
        />
      )}

      {/* ADMIN LOGIN MODAL */}
      {showLoginModal && (
        <AdminLogin
          onLoginSuccess={(user) => {
            setAdminUser(user);
            setShowLoginModal(false);
            setViewMode('admin');
          }}
          onClose={() => setShowLoginModal(false)}
        />
      )}
    </div>

    {/* THERMAL RECEIPT MODAL OVERLAY (Outside .wrap for exact printing) */}
    {activeModalSale && (
      <div
        className="overlay show"
        onClick={(e) => {
          if (e.target.className && e.target.className.includes('overlay')) {
            setActiveModalSale(null);
          }
        }}
      >
        <div>
          <div id="receipt">
            <div className="rc-in">
              <div className="rc-c rc-name">{state.studio}</div>
              <div className="rc-c rc-small">Shop # 45, Post Office Market HIT, Taxila Cantt</div>
              <div className="rc-c rc-small">Ph: 0304-5225523 · WhatsApp: 0327-5006990</div>
              <div className="rc-c rc-small">Sales Receipt</div>
              <div className="rc-sep"></div>

              <div className="rc-row"><span>Receipt</span><span>{activeModalSale.id}</span></div>
              <div className="rc-row"><span>Date</span><span>{fmtDate(activeModalSale.ts)}</span></div>
              {activeModalSale.staff && <div className="rc-row"><span>Served by</span><span>{activeModalSale.staff}</span></div>}
              {activeModalSale.customer && <div className="rc-row"><span>Customer</span><span>{activeModalSale.customer}</span></div>}
              {activeModalSale.phone && <div className="rc-row"><span>Phone</span><span>{activeModalSale.phone}</span></div>}

              <div className="rc-sep"></div>
              {activeModalSale.items.map((it, idx) => (
                <div key={idx} className="rc-item">
                  <div className="top">
                    <span>{it.label}</span>
                    <span>{money(it.price * it.qty)}</span>
                  </div>
                  <div className="sub">{it.qty} × {money(it.price)}</div>
                </div>
              ))}
              <div className="rc-sep"></div>

              <div className="rc-total">
                <span>TOTAL</span>
                <span>{money(activeModalSale.total)}</span>
              </div>
              <div className="rc-row" style={{ marginTop: '4px' }}>
                <span>Paid ({activeModalSale.payMethod === 'Online' ? '💳 Online' : '💵 Cash'})</span>
                <span>{money(activeModalSale.paid != null ? activeModalSale.paid : activeModalSale.total)}</span>
              </div>
              {(activeModalSale.balance != null ? activeModalSale.balance : 0) > 0 && (
                <div className="rc-row" style={{ fontWeight: 700 }}>
                  <span>BALANCE</span>
                  <span>{money(activeModalSale.balance)}</span>
                </div>
              )}
              <div className="rc-foot">
                Payment: {activeModalSale.payMethod === 'Online' ? 'Online Transfer (Bank/JazzCash)' : 'Cash'}<br />
                Please keep this receipt for photo collection. Thank you!<br />Powered By Lunar Ai
              </div>
            </div>
          </div>

          <div className="rc-actions">
            <button className="btn primary" style={{ flex: 1 }} onClick={() => window.print()}>
              🖨️ Print Receipt
            </button>
            {(activeModalSale.balance != null ? activeModalSale.balance : 0) > 0 && (
              <>
                <button
                  className="btn primary"
                  style={{ flex: 1, background: 'var(--emerald)', borderColor: 'var(--emerald)' }}
                  onClick={() => handleMarkPaid(activeModalSale.id, 'Cash')}
                >
                  💵 Paid (Cash)
                </button>
                <button
                  className="btn primary"
                  style={{ flex: 1, background: '#7C3AED', borderColor: '#7C3AED' }}
                  onClick={() => handleMarkPaid(activeModalSale.id, 'Online')}
                >
                  💳 Paid (Online)
                </button>
              </>
            )}
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => setActiveModalSale(null)}>
              Close
            </button>
          </div>
        </div>
      </div>
    )}
  </>
);
}
