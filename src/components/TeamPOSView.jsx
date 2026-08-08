import React, { useState, useEffect } from 'react';

const CUR = "Rs";
const SIZES = ["4x6", "5x7", "6x8", "6x9", "8x10", "8x12", "10x12", "10x15", "12x16", "12x18", "16x20", "20x24", "24x30", "24x30 (large)"];
const PP = [4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56];
const TYPES = [["normal", "Normal EXP"], ["bg", "BG Change"], ["reorder", "Re-order"], ["urgent", "Re-order (Urgent)"]];

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

export default function TeamPOSView({
  state,
  onSaveSale,
  onMarkPaid,
  onAddExpense,
  onDeleteExpense,
  setActiveModalSale,
  onOpenAdminLogin,
  isAdminLoggedIn
}) {
  const [teamTab, setTeamTab] = useState('new'); // 'new', 'records', 'expenses'
  const [cart, setCart] = useState([]);

  // Form states for sales
  const [selCat, setSelCat] = useState('print');
  const [selSize, setSelSize] = useState(SIZES[0]);
  const [selType, setSelType] = useState('normal');
  const [selPages, setSelPages] = useState(PP[0]);
  const [selBgColor, setSelBgColor] = useState('white'); // 'white' or 'blue'
  const [selSetIndex, setSelSetIndex] = useState(0);
  const [selMiscIndex, setSelMiscIndex] = useState(0);
  const [customDesc, setCustomDesc] = useState('');
  const [fPrice, setFPrice] = useState(200);
  const [fQty, setFQty] = useState(1);
  const [selStaff, setSelStaff] = useState(state.lastStaff || (state.staff[0] || 'Umar'));
  const [fCust, setFCust] = useState('');
  const [fPhone, setFPhone] = useState('');
  const [fPaid, setFPaid] = useState('');
  const [payMethod, setPayMethod] = useState('Cash'); // 'Cash' or 'Online'

  // Discount state (Always-visible field for staff when customer asks for discount)
  const [discountVal, setDiscountVal] = useState('');
  const [discountType, setDiscountType] = useState('rs'); // 'rs' or 'percent'

  // Expense form state for team
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('Supplies');

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
    const bgSuffix = selBgColor === 'blue' ? ' (Blue BG)' : ' (White BG)';
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
      label = `Pictures ${selPages}PP (New)${bgSuffix}`;
      meta = "Pictures";
      price = Number(state.albumExp[selPages]) || 0;
    } else if (selCat === "albro") {
      label = `Pictures ${selPages}PP (Re-order)${bgSuffix}`;
      meta = "Pictures";
      price = Number(state.albumRo[selPages]) || 0;
    } else if (selCat === "1x1exp") {
      label = `${selPages} 1x1 (New)${bgSuffix}`;
      meta = "1x1";
      price = Number(state.oneByOneExp[selPages]) || 0;
    } else if (selCat === "1x1ro") {
      label = `${selPages} 1x1 (Re-order)${bgSuffix}`;
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

    const isPhotoItem = selCat === 'albexp' || selCat === 'albro' || selCat === '1x1exp' || selCat === '1x1ro';
    const photoCount = isPhotoItem ? Number(selPages || 0) * qty : 0;
    const isExp = selCat === 'albexp' || selCat === '1x1exp';

    setCart(prevCart => {
      const existingIndex = prevCart.findIndex(item => item.label === label && item.price === price);
      if (existingIndex > -1) {
        const updated = [...prevCart];
        updated[existingIndex].qty += qty;
        if (isPhotoItem) {
          updated[existingIndex].photoCount = (updated[existingIndex].photoCount || 0) + photoCount;
        }
        return updated;
      } else {
        return [...prevCart, { label, cat: meta, price, qty, photoCount, isExp, selCat }];
      }
    });

    if (selCat === 'custom') setCustomDesc('');
    setFQty(1);
  };

  // Automated Cart Math & Photo Bundle Pricing Rule (Qty = Number of Persons)
  const rawCartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const photoItems = cart.filter(it => it.cat === 'Pictures' || it.cat === '1x1' || (it.photoCount && it.photoCount > 0));
  const totalPhotos = photoItems.reduce((sum, it) => sum + (it.photoCount || 0), 0);
  const sumIndividualPhotoPrices = photoItems.reduce((sum, it) => sum + (it.price * it.qty), 0);

  // Maximum persons count across photo items (Qty = number of persons)
  const personsCount = photoItems.reduce((max, it) => Math.max(max, Number(it.qty || 1)), 1);

  let photoBundleDiscount = 0;
  if (photoItems.length >= 1 && totalPhotos > 0 && personsCount >= 1) {
    const hasExp = photoItems.some(it => it.isExp);
    const baseRate = hasExp ? 200 : 150;

    // Photos allocated per person
    const photosPerPerson = Math.ceil(totalPhotos / personsCount);
    const blocksPerPerson = Math.ceil(photosPerPerson / 4);

    if (blocksPerPerson >= 1) {
      const pricePerPerson = baseRate + (blocksPerPerson - 1) * 50;
      const bundleTargetPrice = personsCount * pricePerPerson;

      if (sumIndividualPhotoPrices > bundleTargetPrice) {
        photoBundleDiscount = sumIndividualPhotoPrices - bundleTargetPrice;
      }
    }
  }

  const subtotalAfterBundle = Math.max(0, rawCartTotal - photoBundleDiscount);

  let manualDiscountAmount = 0;
  if (discountVal) {
    const val = Number(discountVal) || 0;
    if (val > 0) {
      if (discountType === 'percent') {
        manualDiscountAmount = Math.round((subtotalAfterBundle * Math.min(val, 100)) / 100);
      } else {
        manualDiscountAmount = Math.min(val, subtotalAfterBundle);
      }
    }
  }

  const cartTotal = Math.max(0, subtotalAfterBundle - manualDiscountAmount);
  const paidVal = fPaid.trim() !== '' ? (Number(fPaid) || 0) : cartTotal;
  const rawBalance = cartTotal - paidVal;
  const cartBalance = rawBalance < 0 ? 0 : rawBalance;

  // Save sale & show receipt
  const handleSave = () => {
    if (!cart.length) return;

    let finalCart = [...cart];
    if (photoBundleDiscount > 0) {
      finalCart.push({
        label: `🎁 Multi-Photo Combined Offer (${totalPhotos} pics)`,
        cat: 'Discount',
        price: -photoBundleDiscount,
        qty: 1
      });
    }

    if (manualDiscountAmount > 0) {
      const discLabel = discountType === 'percent'
        ? `🏷️ Customer Discount (${discountVal}%)`
        : `🏷️ Customer Discount`;
      finalCart.push({
        label: discLabel,
        cat: 'Discount',
        price: -manualDiscountAmount,
        qty: 1
      });
    }

    onSaveSale({
      cart: finalCart,
      selStaff,
      fCust,
      fPhone,
      cartTotal,
      paidVal,
      cartBalance,
      payMethod
    });
    setCart([]);
    setFCust('');
    setFPhone('');
    setFPaid('');
    setPayMethod('Cash');
    setDiscountVal('');
  };

  // Submit expense from team
  const submitTeamExpense = (e) => {
    e.preventDefault();
    if (!expTitle.trim() || !expAmount) return;
    onAddExpense({
      title: expTitle,
      amount: expAmount,
      category: expCategory,
      staff: selStaff
    });
    setExpTitle('');
    setExpAmount('');
    alert("Expense logged successfully!");
  };

  // Records filtering (Staff view limited to last 3 days)
  const now = new Date();
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
  threeDaysAgo.setHours(0, 0, 0, 0);

  const salesList = state.sales || [];
  const expensesList = state.expenses || [];

  // Staff POS view is restricted to past 3 days of records
  const recentSalesList = salesList.filter(s => {
    const d = new Date(s.ts);
    return d >= threeDaysAgo;
  });

  const filteredSales = recentSalesList.filter(s => {
    const d = new Date(s.ts);
    if (filterStaff && s.staff !== filterStaff) return false;
    const { realBalance } = getSaleTotals(s);
    if (filterStatus === "balance" && realBalance <= 0) return false;
    if (filterStatus === "paid" && realBalance > 0) return false;
    const q = searchBox.toLowerCase().trim();
    if (q && s.id.toLowerCase().indexOf(q) < 0 && (s.customer || "").toLowerCase().indexOf(q) < 0) return false;
    return true;
  });

  const pendingSalesCount = recentSalesList.filter(s => {
    const { realBalance } = getSaleTotals(s);
    return realBalance > 0;
  }).length;

  // Today totals
  const todaySalesTotal = salesList
    .filter(s => isSameDay(new Date(s.ts), now))
    .reduce((sum, s) => sum + Number(s.total || 0), 0);

  const todayExpensesTotal = expensesList
    .filter(e => isSameDay(new Date(e.ts), now))
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);

  const todayNetProfit = todaySalesTotal - todayExpensesTotal;

  return (
    <div className="team-pos-view">
      {/* TEAM TABS */}
      <nav className="tabs" style={{ marginBottom: '20px' }}>
        <button className={teamTab === 'new' ? 'active' : ''} onClick={() => setTeamTab('new')}>
          🛒 New Sale Order
        </button>
        <button className={teamTab === 'records' ? 'active' : ''} onClick={() => setTeamTab('records')}>
          📋 Sales Records {pendingSalesCount > 0 && <span className="badge" style={{ background: 'var(--danger-soft)', color: 'var(--danger)', fontWeight: 800 }}>{pendingSalesCount} Pending</span>}
        </button>
        <button className={teamTab === 'expenses' ? 'active' : ''} onClick={() => setTeamTab('expenses')}>
          💸 Log Daily Expense
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
                <div className="row r2">
                  <div className="field">
                    <label>Count / Pages</label>
                    <select value={selPages} onChange={(e) => setSelPages(Number(e.target.value))}>
                      {PP.map(p => <option key={p} value={p}>{p}{selCat.startsWith('1x1') ? ' 1x1' : ' PP'}</option>)}
                    </select>
                  </div>
                  <div className="field">
                    <label>Background Color</label>
                    <select value={selBgColor} onChange={(e) => setSelBgColor(e.target.value)}>
                      <option value="white">⚪ White Background</option>
                      <option value="blue">🔵 Blue Background</option>
                    </select>
                  </div>
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
                  {photoBundleDiscount > 0 && (
                    <div className="line" style={{ background: '#ECFDF5', border: '1px solid #10B981', borderRadius: '8px', padding: '8px 12px', marginTop: '6px' }}>
                      <div className="d">
                        <div className="t" style={{ fontWeight: 700, color: '#059669' }}>🎁 Multi-Photo Combined Offer</div>
                        <div className="m" style={{ color: '#047857' }}>Auto 4-pic block discount ({totalPhotos} pics)</div>
                      </div>
                      <div className="amt mono" style={{ fontWeight: 800, color: '#059669' }}>- {money(photoBundleDiscount)}</div>
                    </div>
                  )}

                  {manualDiscountAmount > 0 && (
                    <div className="line" style={{ background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', padding: '8px 12px', marginTop: '6px' }}>
                      <div className="d">
                        <div className="t" style={{ fontWeight: 700, color: '#DC2626' }}>🏷️ Customer Requested Discount</div>
                        <div className="m" style={{ color: '#B91C1C' }}>{discountType === 'percent' ? `${discountVal}% off` : 'Manual discount'}</div>
                      </div>
                      <div className="amt mono" style={{ fontWeight: 800, color: '#DC2626' }}>- {money(manualDiscountAmount)}</div>
                    </div>
                  )}
                </div>
              )}

              {(photoBundleDiscount > 0 || manualDiscountAmount > 0) && (
                <div style={{ fontSize: '12.5px', opacity: 0.8, display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span>Gross Subtotal</span>
                  <span className="mono">{money(rawCartTotal)}</span>
                </div>
              )}

              <div className="total-row">
                <span className="l">Total Amount</span>
                <span className="v mono">{money(cartTotal)}</span>
              </div>

              <div className="divider"></div>

              <div className="row r2">
                <div className="field">
                  <label>Served by Staff Member</label>
                  <select value={selStaff} onChange={(e) => setSelStaff(e.target.value)}>
                    {state.staff.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Payment Method</label>
                  <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
                    <option value="Cash">💵 Cash</option>
                    <option value="Online">💳 Online (Bank/JazzCash)</option>
                  </select>
                </div>
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
                  <label style={{ color: manualDiscountAmount > 0 ? '#DC2626' : undefined, fontWeight: 700 }}>
                    🏷️ Discount Amount (optional)
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      className="mono"
                      type="number"
                      min="0"
                      step="1"
                      placeholder="0"
                      value={discountVal}
                      onChange={(e) => setDiscountVal(e.target.value)}
                      style={{ flex: 1 }}
                    />
                    <select
                      value={discountType}
                      onChange={(e) => setDiscountType(e.target.value)}
                      style={{ width: '65px', padding: '4px', fontWeight: 700 }}
                    >
                      <option value="rs">Rs</option>
                      <option value="percent">%</option>
                    </select>
                  </div>
                </div>
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
              </div>

              <div className="row r1" style={{ marginTop: '8px' }}>
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
            <span>📋 Sales &amp; Receipts (Past 3 Days)</span>
            <span className="badge">{filteredSales.length} transaction(s) · 3 Days History</span>
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
                      <th>Payment</th>
                      <th className="num">Total</th>
                      <th className="num">Discount</th>
                      <th className="num">Paid</th>
                      <th className="num">Balance</th>
                      <th style={{ textAlign: 'center' }}>Mark Paid Mode</th>
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
                              <span style={{ color: 'var(--emerald)', fontWeight: 700 }}>Paid</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {realBalance > 0 ? (
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
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
                              </div>
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

      {/* TAB 3: LOG COUNTER EXPENSE */}
      {teamTab === 'expenses' && (
        <div className="grid">
          <div className="card">
            <h2>
              <span>💸 Log Daily Counter Expense</span>
              <span className="badge" style={{ background: '#FEF2F2', color: '#DC2626' }}>Outflow</span>
            </h2>
            <div className="body">
              <form onSubmit={submitTeamExpense}>
                <div className="field">
                  <label>Expense Description / Purpose</label>
                  <input
                    placeholder="e.g. Printing Paper Roll, Tea / Refreshments, Transport"
                    value={expTitle}
                    onChange={(e) => setExpTitle(e.target.value)}
                    required
                  />
                </div>

                <div className="row r2">
                  <div className="field">
                    <label>Expense Amount ({CUR})</label>
                    <input
                      className="mono"
                      type="number"
                      min="1"
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
                      <option value="Other">🌀 Other Miscellaneous</option>
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>Staff Member</label>
                  <select value={selStaff} onChange={(e) => setSelStaff(e.target.value)}>
                    {state.staff.map(name => <option key={name} value={name}>{name}</option>)}
                  </select>
                </div>

                <button className="btn primary block" type="submit" style={{ marginTop: '10px', background: '#DC2626', borderColor: '#DC2626' }}>
                  ➖ Record Counter Expense
                </button>
              </form>
            </div>
          </div>

          <div className="card">
            <h2>
              <span>📋 Today's Expenses Log</span>
              <span className="badge">{expensesList.filter(e => isSameDay(new Date(e.ts), now)).length} item(s)</span>
            </h2>
            <div className="body">
              {!expensesList.filter(e => isSameDay(new Date(e.ts), now)).length ? (
                <div className="empty-state">No expenses recorded today.</div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Time</th>
                        <th>Staff</th>
                        <th>Description</th>
                        <th className="num">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {expensesList
                        .filter(e => isSameDay(new Date(e.ts), now))
                        .map(e => (
                          <tr key={e.id}>
                            <td style={{ fontSize: '12.5px' }}>{new Date(e.ts).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })}</td>
                            <td>{e.staff || '—'}</td>
                            <td style={{ fontWeight: 700 }}>{e.title}</td>
                            <td className="num mono" style={{ color: '#DC2626', fontWeight: 800 }}>- {money(e.amount)}</td>
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
    </div>
  );
}
