import React, { useState, useEffect } from 'react';

const CUR = "Rs";
const SIZES = ["4x6", "5x7", "6x8", "6x9", "8x10", "8x12", "10x12", "10x15", "12x16", "12x18", "16x20", "20x24", "24x30", "24x30 (large)"];
const PP = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56];
const TYPES = [["normal", "Normal EXP"], ["bg", "BG Change"], ["reorder", "Re-order"], ["urgent", "Re-order (Urgent)"]];

function money(n) {
  return CUR + " " + Number(n || 0).toLocaleString("en-PK");
}

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) + " · " + d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function isSameDay(d1, d2) {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

export default function TeamPOSView({
  state,
  onSaveSale,
  onMarkPaid,
  setActiveModalSale,
  onOpenAdminLogin,
  isAdminLoggedIn
}) {
  const [teamTab, setTeamTab] = useState('new'); // 'new' or 'records'
  const [cart, setCart] = useState([]);

  // Form states
  const [selCat, setSelCat] = useState('print');
  const [selSize, setSelSize] = useState(SIZES[0]);
  const [selType, setSelType] = useState('normal');
  const [selPages, setSelPages] = useState(PP[0]);
  const [selSetIndex, setSelSetIndex] = useState(0);
  const [selMiscIndex, setSelMiscIndex] = useState(0);
  const [customDesc, setCustomDesc] = useState('');
  const [fPrice, setFPrice] = useState(200);
  const [fQty, setFQty] = useState(1);
  const [selStaff, setSelStaff] = useState(state.lastStaff || (state.staff[0] || 'Umar'));
  const [fCust, setFCust] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fPaid, setFPaid] = useState('');

  // Records Filter states
  const [searchBox, setSearchBox] = useState('');
  const [filterStaff, setFilterStaff] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Available type options for selected print size
  const currentPrintTypes = TYPES.filter(([key]) => {
    const p = state.prints[selSize] || {};
    return p[key] != null && p[key] !== "" && Number(p[key]) >= 0 && (key in p);
  });

  // Calculate current label, price, and category metadata
  const getItemDetails = () => {
    let label = "", price = 0, meta = "";
    if (selCat === "print") {
      const typeLabel = (TYPES.find(([k]) => k === selType) || ["", ""])[1];
      label = `${selSize} — ${typeLabel}`;
      meta = "Print";
      price = Number((state.prints[selSize] || {})[selType]) || 0;
    } else if (selCat === "frame") {
      label = `${selSize} Frame`;
      meta = "Frame";
      price = Number(state.frames[selSize]) || 0;
    } else if (selCat === "albexp") {
      label = `Pictures ${selPages}PP (New)`;
      meta = "Pictures";
      price = Number(state.albumExp[selPages]) || 0;
    } else if (selCat === "albro") {
      label = `Pictures ${selPages}PP (Re-order)`;
      meta = "Pictures";
      price = Number(state.albumRo[selPages]) || 0;
    } else if (selCat === "1x1exp") {
      label = `${selPages} 1x1 (New)`;
      meta = "1x1";
      price = Number(state.oneByOneExp[selPages]) || 0;
    } else if (selCat === "1x1ro") {
      label = `${selPages} 1x1 (Re-order)`;
      meta = "1x1";
      price = Number(state.oneByOneRo[selPages]) || 0;
    } else if (selCat === "set") {
      const item = state.sets[selSetIndex] || { name: "", price: 0 };
      label = item.name;
      meta = "Set";
      price = Number(item.price) || 0;
    } else if (selCat === "misc") {
      const item = state.misc[selMiscIndex] || { name: "", price: 0 };
      label = item.name;
      meta = "Item";
      price = Number(item.price) || 0;
    } else {
      label = customDesc.trim();
      meta = "Custom";
      price = Number(fPrice) || 0;
    }
    return { label, price, meta };
  };

  // Sync price input when parameters change
  useEffect(() => {
    if (selCat !== 'custom') {
      const { price } = getItemDetails();
      setFPrice(price);
    }
  }, [selCat, selSize, selType, selPages, selSetIndex, selMiscIndex, state]);

  // Keep type valid when size changes
  useEffect(() => {
    if (selCat === 'print' && currentPrintTypes.length > 0) {
      if (!currentPrintTypes.some(([k]) => k === selType)) {
        setSelType(currentPrintTypes[0][0]);
      }
    }
  }, [selSize, selCat]);

  // Add item to receipt
  const handleAddItem = () => {
    const { label, price, meta } = getItemDetails();
    const qty = Number(fQty) || 0;
    if (!label) {
      alert("Add a description first.");
      return;
    }
    if (qty < 1) return;

    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(item => item.label === label && item.price === price);
      if (existingIndex > -1) {
        const updated = [...prevCart];
        updated[existingIndex].qty += qty;
        return updated;
      } else {
        return [...prevCart, { label, cat: meta, price, qty }];
      }
    });

    if (selCat === 'custom') setCustomDesc('');
    setFQty(1);
  };

  // Cart math
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const paidVal = Number(fPaid) || 0;
  const rawBalance = cartTotal - paidVal;
  const cartBalance = rawBalance < 0 ? 0 : rawBalance;

  // Save sale & show receipt
  const handleSave = () => {
    if (!cart.length) return;
    onSaveSale({
      cart,
      selStaff,
      fCust,
      fPhone,
      cartTotal,
      paidVal,
      cartBalance
    });
    setCart([]);
    setFCust('');
    setFPhone('');
    setFPaid('');
  };

  // Records filtering
  const now = new Date();
  const salesList = state.sales || [];
  const filteredSales = salesList.filter(s => {
    const d = new Date(s.ts);
    if (filterStaff && s.staff !== filterStaff) return false;
    const bal = s.balance != null ? s.balance : 0;
    if (filterStatus === "balance" && bal <= 0) return false;
    if (filterStatus === "paid" && bal > 0) return false;
    const q = searchBox.toLowerCase().trim();
    if (q && s.id.toLowerCase().indexOf(q) < 0 && (s.customer || "").toLowerCase().indexOf(q) < 0) return false;
    return true;
  });

  const pendingSalesCount = salesList.filter(s => (s.balance != null ? s.balance : 0) > 0).length;

  return (
    <div className="team-pos-view">
      {/* TEAM TABS */}
      <nav className="tabs" style={{ marginBottom: '20px' }}>
        <button className={teamTab === 'new' ? 'active' : ''} onClick={() => setTeamTab('new')}>
          🛒 New Sale Order
        </button>
        <button className={teamTab === 'records' ? 'active' : ''} onClick={() => setTeamTab('records')}>
          📋 Sales Records &amp; Pending Balances {pendingSalesCount > 0 && <span className="badge" style={{ background: 'var(--danger-soft)', color: 'var(--danger)', fontWeight: 800 }}>{pendingSalesCount} Pending</span>}
        </button>
      </nav>

      {/* TAB 1: NEW SALE */}
      {teamTab === 'new' && (
        <div className="grid">
          {/* LEFT COLUMN: ADD ITEM FORM */}
          <div className="card">
            <h2>
              <span>🛒 New Sale Order</span>
              <span className="badge" style={{ background: '#EFF6FF', color: '#2563EB' }}>Fast Counter POS</span>
            </h2>
            <div className="body">
              <div className="field">
                <label>Select Category</label>
                <select value={selCat} onChange={(e) => setSelCat(e.target.value)} style={{ fontWeight: 600 }}>
                  <option value="print">📸 Print (by size)</option>
                  <option value="frame">🖼️ Frame (by size)</option>
                  <option value="albexp">📷 Pictures — New (EXP)</option>
                  <option value="albro">🔄 Pictures — Re-order (R.O)</option>
                  <option value="1x1exp">🆔 1x1 — New (EXP)</option>
                  <option value="1x1ro">🆔 1x1 — Re-order (R.O)</option>
                  <option value="set">🎁 Set / Combo Package</option>
                  <option value="misc">🛠️ Other Item / Service</option>
                  <option value="custom">✏️ Custom / One-off Item</option>
                </select>
              </div>

              {(selCat === 'print' || selCat === 'frame') && (
                <div className="row r2">
                  <div className="field">
                    <label>Size</label>
                    <select value={selSize} onChange={(e) => setSelSize(e.target.value)}>
                      {SIZES.map(sz => <option key={sz} value={sz}>{sz}</option>)}
                    </select>
                  </div>
                  {selCat === 'print' && (
                    <div className="field">
                      <label>Type</label>
                      <select value={selType} onChange={(e) => setSelType(e.target.value)}>
                        {currentPrintTypes.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
                      </select>
                    </div>
                  )}
                </div>
              )}

              {(selCat === 'albexp' || selCat === 'albro' || selCat === '1x1exp' || selCat === '1x1ro') && (
                <div className="field">
                  <label>Count / Pages</label>
                  <select value={selPages} onChange={(e) => setSelPages(Number(e.target.value))}>
                    {PP.map(p => <option key={p} value={p}>{p}{selCat.startsWith('1x1') ? ' 1x1' : ' PP'}</option>)}
                  </select>
                </div>
              )}

              {selCat === 'set' && (
                <div className="field">
                  <label>Package Set</label>
                  <select value={selSetIndex} onChange={(e) => setSelSetIndex(Number(e.target.value))}>
                    {state.sets.map((st, i) => (
                      <option key={i} value={i}>{st.name}  —  {money(st.price)}</option>
                    ))}
                  </select>
                </div>
              )}

              {selCat === 'misc' && (
                <div className="field">
                  <label>Item / Service</label>
                  <select value={selMiscIndex} onChange={(e) => setSelMiscIndex(Number(e.target.value))}>
                    {state.misc.map((m, i) => (
                      <option key={i} value={i}>{m.name}  —  {money(m.price)}</option>
                    ))}
                  </select>
                </div>
              )}

              {selCat === 'custom' && (
                <div className="field">
                  <label>Description</label>
                  <input
                    placeholder="e.g. photo editing, urgent handling"
                    value={customDesc}
                    onChange={(e) => setCustomDesc(e.target.value)}
                  />
                </div>
              )}

              <div className="row r3">
                <div className="field">
                  <label>Price ({CUR})</label>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={fPrice}
                    onChange={(e) => setFPrice(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Qty</label>
                  <input
                    className="mono"
                    type="number"
                    min="1"
                    step="1"
                    value={fQty}
                    onChange={(e) => setFQty(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Line Total</label>
                  <div className="preview-price mono">{money((Number(fPrice) || 0) * (Number(fQty) || 0))}</div>
                </div>
              </div>

              <button className="btn primary block" onClick={handleAddItem} style={{ marginTop: '8px' }}>
                ➕ Add Item to Receipt
              </button>
            </div>
          </div>

          {/* RIGHT COLUMN: CURRENT RECEIPT CART */}
          <div className="card">
            <h2>
              <span>🧾 Current Receipt</span>
              <span className="badge">{cart.length} item(s)</span>
            </h2>
            <div className="body">
              {!cart.length ? (
                <div className="cart-empty">
                  No items on receipt.<br />Select a product on the left and click Add.
                </div>
              ) : (
                <div style={{ maxHeight: '280px', overflowY: 'auto', paddingRight: '4px' }}>
                  {cart.map((item, i) => (
                    <div key={i} className="line">
                      <div className="d">
                        <div className="t">{item.label}</div>
                        <div className="m">{item.cat} · {item.qty} × {money(item.price)}</div>
                      </div>
                      <div className="amt mono">{money(item.price * item.qty)}</div>
                      <button className="x" title="Remove" onClick={() => setCart(cart.filter((_, idx) => idx !== i))}>×</button>
                    </div>
                  ))}
                </div>
              )}

              <div className="total-row">
                <span className="l">Total Amount</span>
                <span className="v mono">{money(cartTotal)}</span>
              </div>

              <div className="divider"></div>

              <div className="field">
                <label>Served by Staff Member</label>
                <select value={selStaff} onChange={(e) => setSelStaff(e.target.value)}>
                  {state.staff.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              </div>

              <div className="row r2">
                <div className="field">
                  <label>Customer Name (optional)</label>
                  <input placeholder="Customer Name" value={fCust} onChange={(e) => setFCust(e.target.value)} />
                </div>
                <div className="field">
                  <label>Phone Number (optional)</label>
                  <input className="mono" placeholder="03xx-xxxxxxx" value={fPhone} onChange={(e) => setFPhone(e.target.value)} />
                </div>
              </div>

              <div className="row r2">
                <div className="field">
                  <label>Paid Amount ({CUR})</label>
                  <input
                    className="mono"
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={fPaid}
                    onChange={(e) => setFPaid(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label>Remaining Balance</label>
                  <div
                    className="preview-price mono"
                    style={{ color: rawBalance > 0 ? 'var(--danger)' : 'var(--emerald)' }}
                  >
                    {money(cartBalance)}
                  </div>
                </div>
              </div>

              <div className="stack">
                <button
                  className="btn primary block"
                  disabled={cart.length === 0}
                  onClick={handleSave}
                  style={{ height: '48px', fontSize: '15.5px' }}
                >
                  🖨️ Save &amp; Print Thermal Receipt
                </button>
                <button
                  className="btn ghost block sm"
                  onClick={() => {
                    if (cart.length && !window.confirm("Clear all items on this receipt?")) return;
                    setCart([]);
                    setFCust('');
                    setFPhone('');
                    setFPaid('');
                  }}
                >
                  Clear Receipt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: SALES RECORDS & PENDING BALANCES */}
      {teamTab === 'records' && (
        <div className="card">
          <h2>
            <span>📋 All Sales &amp; Receipts</span>
            <span className="badge">{filteredSales.length} transaction(s)</span>
          </h2>
          <div className="body">
            <div className="filters">
              <div style={{ flex: 1 }}>
                <label>Search Receipts</label>
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
                <label>Payment Status</label>
                <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="">All Transactions</option>
                  <option value="balance">⚠️ Pending Balance</option>
                  <option value="paid">✅ Fully Paid</option>
                </select>
              </div>
            </div>

            {!filteredSales.length ? (
              <div className="empty-state">No matching sales records found.</div>
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
                              <span style={{ color: 'var(--emerald)', fontWeight: 700 }}>Paid</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {bal > 0 ? (
                              <button
                                className="btn primary sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onMarkPaid(s.id);
                                }}
                              >
                                Mark Paid
                              </button>
                            ) : (
                              <span style={{ color: 'var(--muted)' }}>—</span>
                            )}
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
    </div>
  );
}
