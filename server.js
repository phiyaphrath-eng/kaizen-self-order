const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors({ origin: '*' }));

const SQUARE_ACCESS_TOKEN = process.env.SQUARE_ACCESS_TOKEN;
const SQUARE_LOCATION_ID  = process.env.SQUARE_LOCATION_ID;
const SQUARE_ENV          = process.env.SQUARE_ENV || 'sandbox';
const PORT                = process.env.PORT || 3000;

const SQUARE_BASE = SQUARE_ENV === 'production'
  ? 'https://connect.squareup.com'
  : 'https://connect.squareupsandbox.com';

app.get('/health', (req, res) => {
  res.json({ status: 'ok', env: SQUARE_ENV, location: SQUARE_LOCATION_ID });
});

app.post('/api/order', async (req, res) => {
  const { tableNumber, items, note } = req.body;
  if (!items || items.length === 0) {
    return res.status(400).json({ error: 'Missing items' });
  }
  const table = tableNumber || 'Walk-in';

  const lineItems = items.map(item => ({
    name: item.name,
    quantity: String(item.qty),
    base_price_money: {
      amount: Math.round(item.price * 100),
      currency: 'USD'
    },
    ...(note && { note })
  }));

  const payload = {
    idempotency_key: uuidv4(),
    order: {
      location_id: SQUARE_LOCATION_ID,
      reference_id: `TABLE_${table}_${Date.now()}`,
      line_items: lineItems,
      metadata: {
        table: String(table),
        source: 'kaizen-self-order',
        ...(note ? { note } : {})
      }
    }
  };

  try {
    const response = await fetch(`${SQUARE_BASE}/v2/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SQUARE_ACCESS_TOKEN}`,
        'Square-Version': '2024-01-18'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();
    if (!response.ok) {
      console.error('Square error:', data.errors);
      return res.status(response.status).json({ error: data.errors?.[0]?.detail || 'Square API Error' });
    }

    console.log(`✅ Order | Table ${table} | ID: ${data.order.id}`);
    res.json({ success: true, orderId: data.order.id });

  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// ── Serve Frontend
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<title>Kaizen Sushi & Ramen — Order</title>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@400;700;900&family=DM+Sans:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
<style>
:root {
  --bg:#080808; --surface:#101010; --card:#161616; --border:#222;
  --red:#c0392b; --red2:#e74c3c; --red-dim:rgba(192,57,43,0.13);
  --gold:#d4a843; --gold-dim:rgba(212,168,67,0.1);
  --text:#f0ebe0; --text-mid:#999; --text-dim:#555;
  --green:#27ae60;
}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;}
body{background:var(--bg);color:var(--text);font-family:'DM Sans',sans-serif;min-height:100vh;overflow-x:hidden;}

/* HEADER */
header{position:sticky;top:0;z-index:100;background:rgba(8,8,8,0.97);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);height:62px;display:flex;align-items:center;justify-content:space-between;padding:0 20px;gap:12px;}
.logo{display:flex;align-items:center;gap:10px;flex-shrink:0;}
.logo-mark{width:36px;height:36px;background:var(--red);border-radius:6px;display:flex;align-items:center;justify-content:center;font-family:'Noto Serif JP',serif;font-size:16px;font-weight:900;color:#fff;letter-spacing:-1px;}
.logo-text{line-height:1.15;}
.logo-name{font-family:'Noto Serif JP',serif;font-size:14px;font-weight:700;}
.logo-sub{font-size:9px;color:var(--text-dim);letter-spacing:2.5px;text-transform:uppercase;}
.hdr-right{display:flex;align-items:center;gap:8px;}
.table-chip{background:var(--surface);border:1px solid var(--border);color:var(--text-mid);padding:5px 11px;border-radius:6px;font-size:11px;font-weight:600;letter-spacing:.5px;white-space:nowrap;}
.cart-btn{background:var(--red);color:#fff;border:none;cursor:pointer;padding:9px 16px;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px;transition:all .2s;white-space:nowrap;position:relative;}
.cart-btn:active{transform:scale(.96);}
.cart-badge{background:#fff;color:var(--red);width:17px;height:17px;border-radius:50%;font-size:10px;font-weight:800;display:none;align-items:center;justify-content:center;}
.cart-badge.on{display:flex;}

/* CAT NAV */
.cat-nav{position:sticky;top:62px;z-index:90;background:rgba(8,8,8,0.97);backdrop-filter:blur(16px);border-bottom:1px solid var(--border);display:flex;overflow-x:auto;scrollbar-width:none;}
.cat-nav::-webkit-scrollbar{display:none;}
.cat-tab{background:none;border:none;border-bottom:2px solid transparent;color:var(--text-dim);padding:13px 16px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:500;cursor:pointer;white-space:nowrap;transition:all .2s;flex-shrink:0;}
.cat-tab.active{color:var(--text);border-bottom-color:var(--red);font-weight:700;}
.cat-tab:hover{color:var(--text-mid);}

/* MENU BODY */
.menu-body{padding:0 14px 120px;max-width:1100px;margin:0 auto;}
.menu-sec{padding-top:28px;}
.sec-head{display:flex;align-items:baseline;gap:10px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid var(--border);}
.sec-title{font-family:'Noto Serif JP',serif;font-size:17px;font-weight:700;}
.sec-count{font-size:11px;color:var(--text-dim);}

.menu-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;}

/* CARD */
.card{background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden;cursor:pointer;transition:border-color .2s,transform .15s;display:flex;flex-direction:column;position:relative;}
.card:hover{border-color:#333;}
.card:active{transform:scale(.98);}
.card-img{height:130px;background:var(--surface);display:flex;align-items:center;justify-content:center;font-size:52px;position:relative;flex-shrink:0;}
.card-img::after{content:'';position:absolute;inset:0;background:linear-gradient(to bottom,transparent 55%,rgba(0,0,0,.6));}
.card-body{padding:12px;flex:1;display:flex;flex-direction:column;}
.card-name{font-size:14px;font-weight:600;margin-bottom:4px;line-height:1.3;}
.card-desc{font-size:11px;color:var(--text-dim);line-height:1.5;flex:1;margin-bottom:10px;min-height:30px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;}
.card-foot{display:flex;align-items:center;justify-content:space-between;}
.card-price{font-size:17px;font-weight:700;color:var(--gold);}
.add-btn{background:var(--red);color:#fff;border:none;width:32px;height:32px;border-radius:50%;font-size:19px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-weight:700;transition:all .2s;flex-shrink:0;}
.add-btn:active{transform:scale(.88);background:var(--red2);}
.qty-pill{position:absolute;top:10px;right:10px;background:var(--red);color:#fff;width:22px;height:22px;border-radius:50%;font-size:11px;font-weight:800;display:none;align-items:center;justify-content:center;z-index:2;}
.qty-pill.on{display:flex;}

/* OVERLAY */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:200;opacity:0;pointer-events:none;transition:opacity .3s;backdrop-filter:blur(6px);}
.overlay.on{opacity:1;pointer-events:all;}

/* CART PANEL */
.cart-panel{position:fixed;right:0;top:0;bottom:0;width:min(440px,100vw);background:var(--surface);border-left:1px solid var(--border);z-index:201;display:flex;flex-direction:column;transform:translateX(100%);transition:transform .32s cubic-bezier(.4,0,.2,1);}
.cart-panel.open{transform:translateX(0);}
.cp-head{padding:20px 20px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.cp-title{font-family:'Noto Serif JP',serif;font-size:19px;font-weight:700;}
.cp-close{background:var(--card);border:1px solid var(--border);color:var(--text-mid);width:34px;height:34px;border-radius:50%;font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .2s;}
.cp-close:active{border-color:var(--red);color:var(--red);}
.cp-items{flex:1;overflow-y:auto;padding:12px 20px;scrollbar-width:thin;scrollbar-color:var(--border) transparent;}
.cp-empty{text-align:center;padding:60px 0;color:var(--text-dim);}
.cp-empty .ei{font-size:44px;margin-bottom:10px;}
.ci{display:flex;align-items:center;gap:12px;padding:12px 0;border-bottom:1px solid var(--border);animation:ciIn .2s ease;}
@keyframes ciIn{from{opacity:0;transform:translateX(16px)}}
.ci-emoji{font-size:32px;flex-shrink:0;}
.ci-info{flex:1;min-width:0;}
.ci-name{font-size:14px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.ci-price{color:var(--gold);font-size:13px;margin-top:2px;}
.qty-ctrl{display:flex;align-items:center;gap:6px;flex-shrink:0;}
.qb{background:var(--card);border:1px solid var(--border);color:var(--text);width:28px;height:28px;border-radius:50%;font-size:15px;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all .15s;}
.qb:active{border-color:var(--red);color:var(--red);}
.qn{font-weight:700;font-size:15px;min-width:20px;text-align:center;}

.cp-foot{padding:16px 20px;border-top:1px solid var(--border);background:var(--surface);flex-shrink:0;}
.cp-row{display:flex;justify-content:space-between;font-size:13px;color:var(--text-dim);margin-bottom:5px;}
.cp-total{display:flex;justify-content:space-between;font-size:19px;font-weight:700;margin-bottom:16px;}
.cp-total span:last-child{color:var(--gold);}
.note-inp{width:100%;background:var(--card);border:1px solid var(--border);color:var(--text);padding:9px 12px;border-radius:8px;font-family:'DM Sans',sans-serif;font-size:12px;margin-bottom:14px;resize:none;height:54px;transition:border-color .2s;}
.note-inp:focus{outline:none;border-color:var(--red);}
.note-inp::placeholder{color:var(--text-dim);}
.order-btn{width:100%;background:var(--red);color:#fff;border:none;padding:15px;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:16px;font-weight:700;cursor:pointer;transition:all .2s;display:flex;align-items:center;justify-content:center;gap:8px;letter-spacing:.3px;}
.order-btn:disabled{opacity:.4;cursor:not-allowed;}
.order-btn:not(:disabled):active{transform:scale(.98);background:var(--red2);}

/* SUCCESS */
.modal{position:fixed;inset:0;z-index:300;background:rgba(0,0,0,.88);display:flex;align-items:center;justify-content:center;opacity:0;pointer-events:none;transition:opacity .3s;}
.modal.on{opacity:1;pointer-events:all;}
.modal-box{background:var(--card);border:1px solid var(--border);border-radius:18px;padding:44px 36px;text-align:center;max-width:340px;width:90%;transform:scale(.9);transition:transform .3s cubic-bezier(.34,1.56,.64,1);}
.modal.on .modal-box{transform:scale(1);}
.modal-icon{font-size:64px;margin-bottom:14px;}
.modal-title{font-family:'Noto Serif JP',serif;font-size:22px;margin-bottom:8px;}
.modal-sub{color:var(--text-mid);font-size:14px;line-height:1.6;margin-bottom:6px;}
.modal-id{color:var(--text-dim);font-size:10px;font-family:monospace;margin-bottom:26px;}
.modal-btn{background:var(--red);color:#fff;border:none;padding:13px 36px;border-radius:10px;font-family:'DM Sans',sans-serif;font-size:15px;font-weight:700;cursor:pointer;transition:all .2s;}
.modal-btn:active{background:var(--red2);}

/* SPINNER */
.spin{width:16px;height:16px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:sp .7s linear infinite;}
@keyframes sp{to{transform:rotate(360deg)}}

/* STATUS */
.status-dot{position:fixed;bottom:14px;left:14px;z-index:50;background:var(--card);border:1px solid var(--border);border-radius:20px;padding:5px 12px;font-size:11px;display:flex;align-items:center;gap:6px;}
.dot{width:7px;height:7px;border-radius:50%;background:var(--green);animation:pulse 2s infinite;}
.dot.err{background:var(--red);animation:none;}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.3}}

::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:3px;}
/* TABLE SELECTION — FLOOR PLAN */
.table-screen{position:fixed;inset:0;z-index:500;background:#0d1117;display:flex;flex-direction:column;transition:opacity .4s;}
.table-screen.hidden{opacity:0;pointer-events:none;}
.ts-header{background:#0d1117;border-bottom:1px solid #1e2a3a;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
.ts-header-left{display:flex;align-items:center;gap:12px;}
.ts-mark{width:38px;height:38px;background:var(--red);border-radius:8px;display:flex;align-items:center;justify-content:center;font-family:'Noto Serif JP',serif;font-size:17px;font-weight:900;color:#fff;}
.ts-name{font-family:'Noto Serif JP',serif;font-size:16px;font-weight:700;}
.ts-addr{font-size:10px;color:#4a6080;letter-spacing:1px;}
.ts-prompt{font-size:12px;color:#4a7090;background:#111d2b;border:1px solid #1e3048;padding:6px 14px;border-radius:20px;}
.fp-body{flex:1;position:relative;overflow:hidden;padding:20px;}
/* floor grid bg */
.fp-body::before{content:'';position:absolute;inset:0;background-image:linear-gradient(rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.02) 1px,transparent 1px);background-size:40px 40px;}
/* TABLE BUTTONS */
.fp-table{position:absolute;cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:5px;border:2px solid #253a52;background:#162030;border-radius:10px;transition:all .2s;font-family:'DM Sans',sans-serif;}
.fp-table:hover{border-color:#4a90d9;background:#1a2d42;transform:scale(1.04);}
.fp-table:active{transform:scale(.97);}
.fp-table .ft-num{font-size:13px;font-weight:700;color:#8ab4d4;}
.fp-table .ft-sub{font-size:9px;color:#4a6080;letter-spacing:.5px;}
/* BAR SEATS — pill shape */
.fp-bar{position:absolute;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px;border:2px solid #253a52;background:#162030;border-radius:30px;transition:all .2s;font-family:'DM Sans',sans-serif;}
.fp-bar:hover{border-color:#4a90d9;background:#1a2d42;transform:scale(1.04);}
.fp-bar:active{transform:scale(.97);}
.fp-bar .ft-num{font-size:12px;font-weight:700;color:#8ab4d4;}
/* HOVER GLOW */
.fp-table:hover,.fp-bar:hover{box-shadow:0 0 0 3px rgba(74,144,217,.2);}
/* LEGEND */
.fp-legend{position:absolute;bottom:16px;right:16px;display:flex;gap:12px;font-size:10px;color:#4a6080;}
.leg-dot{width:8px;height:8px;border-radius:50%;background:#253a52;display:inline-block;margin-right:4px;}

</style>
</head>
<body>


<!-- TABLE SELECTION — FLOOR PLAN -->
<div class="table-screen" id="tableScreen">
  <div class="ts-header">
    <div class="ts-header-left">
      <div class="ts-mark">改</div>
      <div>
        <div class="ts-name">Kaizen Sushi &amp; Ramen</div>
        <div class="ts-addr">GRAND FORKS, ND</div>
      </div>
    </div>
    <div class="ts-prompt">👆 Tap your table to order</div>
  </div>
  <div class="fp-body" id="fpBody"></div>
</div>

<header>
  <div class="logo">
    <div class="logo-mark">改</div>
    <div class="logo-text">
      <div class="logo-name">Kaizen Sushi & Ramen</div>
      <div class="logo-sub">Self Order</div>
    </div>
  </div>
  <div class="hdr-right">
    <div class="table-chip" id="tableChip" onclick="changeTable()" style="cursor:pointer;">Table — ✏️</div>
    <button class="cart-btn" onclick="openCart()">
      🛒 Cart
      <span class="cart-badge" id="cartBadge">0</span>
    </button>
  </div>
</header>

<div class="cat-nav" id="catNav"></div>
<div class="menu-body" id="menuBody"></div>

<div class="overlay" id="overlay" onclick="closeCart()"></div>
<div class="cart-panel" id="cartPanel">
  <div class="cp-head">
    <div class="cp-title">Your Order</div>
    <button class="cp-close" onclick="closeCart()">✕</button>
  </div>
  <div class="cp-items" id="cpItems"><div class="cp-empty"><div class="ei">🍣</div><div>Nothing here yet</div></div></div>
  <div class="cp-foot">
    <div class="cp-row"><span>Items</span><span id="cpCount">0</span></div>
    <div class="cp-total"><span>Total</span><span id="cpTotal">\$0.00</span></div>
    <textarea class="note-inp" id="orderNote" placeholder="📝 Special requests (no spice, allergy, etc.)"></textarea>
    <button class="order-btn" id="orderBtn" onclick="submitOrder()" disabled>Place Order →</button>
  </div>
</div>

<div class="modal" id="successModal">
  <div class="modal-box">
    <div class="modal-icon">✅</div>
    <div class="modal-title">Order Placed!</div>
    <div class="modal-sub">Your order has been sent to the kitchen.<br>We'll have it ready for you shortly! 🍜</div>
    <div class="modal-id" id="modalId"></div>
    <button class="modal-btn" onclick="closeSuccess()">Order More</button>
  </div>
</div>

<div class="status-dot" id="statusDot">
  <div class="dot" id="dot"></div>
  <span id="statusTxt">Connected</span>
</div>

<script>

// FLOOR PLAN — positions match real Kaizen layout
// Layout based on Square POS floor plan photo
// Coordinates: left%, top% of fp-body container
const FLOOR_PLAN = [
  // LEFT COLUMN
  {id:'12', label:'Table 12', type:'table', x:4,  y:6,  w:17, h:14},
  {id:'14', label:'Table 14', type:'table', x:4,  y:26, w:17, h:14},
  {id:'15', label:'Table 15', type:'table', x:4,  y:46, w:17, h:14},
  // CENTER COLUMN
  {id:'7',  label:'Table 7',  type:'table', x:38, y:2,  w:16, h:12},
  {id:'8',  label:'Table 8',  type:'table', x:38, y:18, w:16, h:14},
  {id:'9',  label:'Table 9',  type:'table', x:38, y:36, w:16, h:14},
  {id:'10', label:'Table 10', type:'table', x:38, y:54, w:16, h:14},
  {id:'11', label:'Table 11', type:'table', x:38, y:72, w:16, h:14},
  // RIGHT COLUMN
  {id:'1',  label:'Table 1',  type:'table', x:74, y:2,  w:22, h:13},
  {id:'2',  label:'Table 2',  type:'table', x:74, y:18, w:22, h:11},
  {id:'3',  label:'Table 3',  type:'table', x:74, y:32, w:22, h:11},
  {id:'4',  label:'Table 4',  type:'table', x:74, y:46, w:22, h:11},
  {id:'5',  label:'Table 5',  type:'table', x:74, y:60, w:22, h:11},
  {id:'6',  label:'Table 6',  type:'table', x:74, y:74, w:22, h:11},
  // BAR — bottom
  {id:'B1', label:'Bar 1', type:'bar', x:2,  y:88, w:16, h:9},
  {id:'B2', label:'Bar 2', type:'bar', x:20, y:88, w:16, h:9},
  {id:'B3', label:'Bar 3', type:'bar', x:38, y:88, w:16, h:9},
];

let selectedTable = null;

function buildTableScreen() {
  const body = document.getElementById('fpBody');
  body.innerHTML = '';
  FLOOR_PLAN.forEach(t => {
    const el = document.createElement('button');
    el.className = t.type === 'bar' ? 'fp-bar' : 'fp-table';
    el.style.left   = t.x + '%';
    el.style.top    = t.y + '%';
    el.style.width  = t.w + '%';
    el.style.height = t.h + '%';
    el.innerHTML = \`<div class="ft-num">\${t.label}</div>\`;
    el.onclick = () => selectTable(t.id, t.label);
    body.appendChild(el);
  });
}

function changeTable() {
  if(confirm("Change table? Your order will be kept.")) {
    selectedTable = null;
    document.getElementById("tableChip").textContent = "Table — ✏️";
    document.getElementById("tableScreen").classList.remove("hidden");
  }
}

function selectTable(id, label) {
  selectedTable = id;
  document.getElementById('tableChip').textContent = label;
  document.getElementById('tableScreen').classList.add('hidden');
}

// ─────────────────────────────────────────────
// ⚙️ CONFIG — แก้ตรงนี้
// ─────────────────────────────────────────────
const BACKEND_URL  = '';
const TABLE_NUMBER = '1';                           // ← เปลี่ยนแต่ละ iPad
const DEMO_MODE    = false;
// Sandbox credentials (สำหรับทดสอบ)
// Access Token: EAAAl0tY_Xb1ST77_zZBic1Pk1K3Os8mEGLRVH-XcAeBCDkyNV-cU2RdG9Ssu33P
// Location ID:  LSQ4XY8D957FX

// ─────────────────────────────────────────────
// MENU DATA — จาก Square CSV ของ Kaizen
// ─────────────────────────────────────────────
const MENU = [
  // ── APPETIZER & SALAD
  {id:'a1',  cat:'appetizer', name:'Miso Soup',          desc:'Classic Japanese miso soup',                                                                        price:5.00,   emoji:'🍵'},
  {id:'a2',  cat:'appetizer', name:'Shrimp Tempura',     desc:'Crispy battered shrimp, tempura sauce',                                                             price:9.00,   emoji:'🍤'},
  {id:'a3',  cat:'appetizer', name:'Edamame',            desc:'Steamed soy beans tossed with poke sauce',                                                          price:8.00,   emoji:'🫛'},
  {id:'a4',  cat:'appetizer', name:'Gyoza',              desc:'Pan fried chicken & veggie dumplings with tempura sauce',                                           price:8.00,   emoji:'🥟'},
  {id:'a5',  cat:'appetizer', name:'Egg Drop Soup',      desc:'Classic egg drop soup',                                                                             price:7.00,   emoji:'🥣'},
  {id:'a6',  cat:'appetizer', name:'Bonchon Wing',       desc:'Korean style crispy fried wings with house Korean sauce',                                           price:9.00,   emoji:'🍗'},
  {id:'a7',  cat:'appetizer', name:'Cheese Roll',        desc:'Philadelphia cream cheese & shredded crab in crisp wrap, deep fried with sweet sauce',             price:9.00,   emoji:'🧀'},
  {id:'a8',  cat:'appetizer', name:'Crispy Tofu',        desc:'Fried crispy tofu served with house sauce',                                                         price:8.00,   emoji:'🫕'},
  {id:'a9',  cat:'appetizer', name:'Summer Roll',        desc:'Vietnamese rice wrap served with peanut sauce',                                                     price:9.00,   emoji:'🌯'},
  {id:'a10', cat:'appetizer', name:'Chicken Egg Roll',   desc:'Crispy chicken egg roll',                                                                           price:9.00,   emoji:'🥚'},
  {id:'a11', cat:'appetizer', name:'Heart Attack',       desc:'Tempura fried jalapeño stuffed with cream cheese, spicy tuna & spicy crab',                        price:9.00,   emoji:'🌶️'},

  // ── SUSHI APP & SALAD
  {id:'sa1', cat:'appetizer', name:'Hamachi Jalapeño',   desc:'Yellowtail with jalapeño',                                                                          price:13.95,  emoji:'🐟'},
  {id:'sa2', cat:'appetizer', name:'Tokyo Tower',        desc:'Appetizer served with crab or tuna, avocado and house sauce',                                      price:13.95,  emoji:'🗼'},
  {id:'sa3', cat:'appetizer', name:'Tuna Tataki',        desc:'Sliced tuna served with ponzu sauce topped with Japanese seasoning',                               price:13.95,  emoji:'🐡'},
  {id:'sa4', cat:'appetizer', name:'Sunomono Salad',     desc:'Japanese cucumber salad',                                                                           price:13.95,  emoji:'🥗'},
  {id:'sa5', cat:'appetizer', name:'Sashimi Salad',      desc:'Fresh sashimi over salad',                                                                          price:13.95,  emoji:'🥗'},
  {id:'sa6', cat:'appetizer', name:'Seared Tuna Salad',  desc:'Seared tuna over fresh salad',                                                                     price:13.95,  emoji:'🥗'},
  {id:'sa7', cat:'appetizer', name:'Crab Kani Salad',    desc:'Crab kani salad',                                                                                   price:13.95,  emoji:'🦀'},
  {id:'sa8', cat:'appetizer', name:'Ceviche',            desc:'Fresh ceviche',                                                                                     price:13.95,  emoji:'🍋'},

  // ── SIGNATURE & SPECIAL ROLLS
  {id:'r1',  cat:'signature', name:'Rainbow Roll',       desc:'Classic rainbow roll with assorted fish',                                                           price:16.95,  emoji:'🌈'},
  {id:'r2',  cat:'signature', name:'Honey Bunny',        desc:'Signature honey bunny roll',                                                                        price:16.95,  emoji:'🍯'},
  {id:'r3',  cat:'signature', name:'Spider Man Roll',    desc:'Signature spider man roll',                                                                         price:16.95,  emoji:'🕷️'},
  {id:'r4',  cat:'signature', name:'Snow Bomb',          desc:'Signature snow bomb roll',                                                                          price:16.95,  emoji:'❄️'},
  {id:'r5',  cat:'signature', name:'Mr. Tiger Roll',     desc:'Signature Mr. Tiger roll',                                                                          price:16.95,  emoji:'🐯'},
  {id:'r6',  cat:'signature', name:'Sub Marine Roll',    desc:'Signature submarine roll',                                                                          price:16.95,  emoji:'🚢'},
  {id:'r7',  cat:'signature', name:'Fantasy Vegan',      desc:'Signature vegan roll',                                                                              price:16.95,  emoji:'🌿'},
  {id:'r8',  cat:'signature', name:'Red Dragon',         desc:'Red dragon signature roll',                                                                         price:16.95,  emoji:'🐉'},
  {id:'r9',  cat:'signature', name:'Mango Tango',        desc:'Mango tango roll',                                                                                  price:16.95,  emoji:'🥭'},
  {id:'r10', cat:'signature', name:'Sea Sand',           desc:'Spicy crab & asparagus, ebi shrimp, crunchy spicy mayo and eel sauce',                            price:16.95,  emoji:'🌊'},
  {id:'r11', cat:'signature', name:'Corona Roll',        desc:'Spicy tuna crunchy lime roll with escolar, eel sauce and wasabi sauce',                           price:16.95,  emoji:'🍋'},
  {id:'r12', cat:'signature', name:'Chicky Chick Roll',  desc:'Battered tuna with chicken katsu style sauces',                                                    price:16.95,  emoji:'🍗'},
  {id:'r13', cat:'signature', name:'Emerald Roll',       desc:'Shrimp tempura cucumber topped with slice avocado, crunchy and eel sauce',                        price:16.95,  emoji:'💚'},
  {id:'r14', cat:'signature', name:'Burrito Lava Roll',  desc:'Half Japanese & Mexican style: tuna, salmon, white fish batter with spring mix and spicy sauce', price:16.95,  emoji:'🌮'},
  {id:'r15', cat:'signature', name:'Sweetie Pie Roll',   desc:'Spicy tuna jalapeño cream cheese roll deep fried, topped with spicy mayo',                       price:16.95,  emoji:'🥧'},
  {id:'r16', cat:'signature', name:'Grand Forks Roll',   desc:'Spicy tuna cucumber, spicy crab with mayo, wasabi and hot sauce on top',                         price:16.95,  emoji:'⭐'},
  {id:'r17', cat:'signature', name:'Alaskan Roll',       desc:'Alaskan signature roll',                                                                            price:16.95,  emoji:'🏔️'},
  {id:'r18', cat:'signature', name:'911 Roll',           desc:'Shrimp tempura jalapeño cream cheese, topped with salmon, tuna and avocado, spicy mayo & eel sauce', price:16.95, emoji:'🚨'},
  {id:'r19', cat:'signature', name:'Volcano Roll',       desc:'Avocado imitation crab cucumber roll topped with salmon, Italian herb seasoning, flame & seaweed flake', price:18.00, emoji:'🌋'},
  {id:'r20', cat:'signature', name:'Dynamite Roll',      desc:'Dynamite signature roll',                                                                           price:18.00,  emoji:'💥'},
  {id:'r21', cat:'signature', name:'American Dream',     desc:'Smoked salmon, cream cheese, asparagus topped with colby jack, masago, eel sauce',               price:18.00,  emoji:'🇺🇸'},

  // ── BASIC / SMALL ROLLS
  {id:'b1',  cat:'basic',     name:'California Roll',    desc:'Imitation crab with avocado and cucumber',                                                          price:9.00,   emoji:'🍱'},
  {id:'b2',  cat:'basic',     name:'Spicy California',   desc:'Imitation crab with avocado and cucumber, spicy',                                                  price:9.00,   emoji:'🌶️'},
  {id:'b3',  cat:'basic',     name:'Spicy Tuna Roll',    desc:'Fresh tuna with avocado',                                                                           price:9.00,   emoji:'🐟'},
  {id:'b4',  cat:'basic',     name:'Spicy Salmon Roll',  desc:'Fresh salmon and avocado',                                                                          price:9.00,   emoji:'🐠'},
  {id:'b5',  cat:'basic',     name:'Tuna Roll',          desc:'Fresh tuna with avocado',                                                                           price:9.00,   emoji:'🐟'},
  {id:'b6',  cat:'basic',     name:'Salmon Roll',        desc:'Fresh salmon and avocado',                                                                          price:9.00,   emoji:'🐠'},
  {id:'b7',  cat:'basic',     name:'Sweet Potato Roll',  desc:'Sweet potato roll',                                                                                 price:9.00,   emoji:'🍠'},
  {id:'b8',  cat:'basic',     name:'Avocado Roll',       desc:'Fresh avocado roll',                                                                                price:9.00,   emoji:'🥑'},
  {id:'b9',  cat:'basic',     name:'Philadelphia Roll',  desc:'Smoked salmon with Philadelphia cream cheese',                                                      price:9.00,   emoji:'🧀'},
  {id:'b10', cat:'basic',     name:'Veggie Roll',        desc:'Seasonal mix vegetables: cucumber, avocado or asparagus',                                          price:10.00,  emoji:'🥦'},
  {id:'b11', cat:'basic',     name:'Yellowtail Roll',    desc:'Fresh yellowtail hamachi with avocado and spicy sauce',                                            price:10.00,  emoji:'🐡'},
  {id:'b12', cat:'basic',     name:'Spicy Yellowtail',   desc:'Fresh yellowtail hamachi with avocado, spicy',                                                     price:10.00,  emoji:'🐡'},
  {id:'b13', cat:'basic',     name:'Broiled Eel Roll',   desc:'BBQ eel with avocado roll',                                                                         price:12.00,  emoji:'🐍'},

  // ── RAMEN
  {id:'rm1', cat:'ramen',     name:'Tonkotsu Ramen',     desc:'Chashu pork belly, wood ear mushroom, green onion, soft boiled egg in creamy pork bone broth',   price:16.95,  emoji:'🍜'},
  {id:'rm2', cat:'ramen',     name:'Spicy Miso Ramen',   desc:'Chashu pork belly, wood ear mushroom, green onion, soft boiled egg in spicy miso broth',        price:16.95,  emoji:'🌶️'},
  {id:'rm3', cat:'ramen',     name:'Shoyu Ramen',        desc:'Fried chicken, wood ear mushroom, green onion, soft boiled egg in light soy sauce broth',       price:16.95,  emoji:'🍜'},
  {id:'rm4', cat:'ramen',     name:'Pork Belly Ramen',   desc:'Crispy pork belly, wood ear mushroom, green onion, soft boiled egg in creamy miso broth',       price:16.95,  emoji:'🥩'},
  {id:'rm5', cat:'ramen',     name:'Kaow Soi',           desc:'Fried chicken, pickle cabbage, sliced red onion, green onion in coconut milk Northern Thai curry with crispy noodle', price:16.95, emoji:'🥥'},
  {id:'rm6', cat:'ramen',     name:'Hong Kong Ramen',    desc:'Roasted pork, stuffed wonton, bok choy, beansprout, green onion in a clear soy broth',         price:16.95,  emoji:'🥟'},
  {id:'rm7', cat:'ramen',     name:'Sukothai',           desc:'Rice noodle, roasted pork, minced pork, green bean, bean sprout, crushed peanuts in spicy Thai broth with fried wonton', price:16.95, emoji:'🍲'},
  {id:'rm8', cat:'ramen',     name:'Spicy Shrimp Ramen', desc:'Creamy hot & sour chili oil with big shrimp, bean sprout, red onion, crab stick',              price:18.95,  emoji:'🦐'},
  {id:'rm9', cat:'ramen',     name:'Chicken Pho',        desc:'Vietnamese style pho with chicken, just right!',                                                  price:16.95,  emoji:'🍜'},
  {id:'rm10',cat:'ramen',     name:'Wonton Soup',        desc:'Chicken dumplings with spinach in house oriental style soup. Great for cold days!',              price:15.95,  emoji:'🥣'},
  {id:'rm11',cat:'ramen',     name:'Vegan Ramen',        desc:'Plant-based ramen',                                                                                price:16.95,  emoji:'🌿'},

  // ── ENTREE
  {id:'e1',  cat:'entree',    name:'Chicken Teriyaki',   desc:'Grilled chicken with soy glaze & mirin, teriyaki sauce and jasmine rice',                        price:15.90,  emoji:'🍗'},
  {id:'e2',  cat:'entree',    name:'Salmon Teriyaki',    desc:'Grilled salmon with seasoning, teriyaki sauce and jasmine rice',                                  price:17.95,  emoji:'🐠'},
  {id:'e3',  cat:'entree',    name:'Tofu Teriyaki',      desc:'Fried tofu with seasoning, teriyaki sauce and jasmine rice',                                      price:15.95,  emoji:'🫕'},
  {id:'e4',  cat:'entree',    name:'Chicken Katsu',      desc:'Japanese style fried chicken with tonkatsu sauce',                                                 price:15.95,  emoji:'🍗'},
  {id:'e5',  cat:'entree',    name:'Beef Bulgogi',       desc:'Thinly sliced grilled steak marinated with gochujang Korean BBQ paste — savory & sweet',        price:16.95,  emoji:'🥩'},
  {id:'e6',  cat:'entree',    name:'BBQ Pork',           desc:'Stir fried pork with kimchi Korean style served in a bowl on jasmine rice',                      price:18.95,  emoji:'🍖'},
  {id:'e7',  cat:'entree',    name:'Triple Pork with Rice', desc:'Chashu pork, crispy pork belly and BBQ roasted pork with perfect boiled egg and jasmine rice', price:15.95, emoji:'🥩'},
  {id:'e8',  cat:'entree',    name:'Sesame Chicken',     desc:'Crispy deep fried chicken tossed in sesame sauce',                                                price:15.95,  emoji:'🍗'},
  {id:'e9',  cat:'entree',    name:'Kutsudon',           desc:'Japanese rice bowl with chicken, onion, egg, fish cake and seaweed',                             price:18.95,  emoji:'🍚'},
  {id:'e10', cat:'entree',    name:'Gyodon',             desc:'Japanese gyudon rice bowl',                                                                        price:18.95,  emoji:'🍚'},
  {id:'e11', cat:'entree',    name:'Japanese Curry Mild',desc:'Mild Japanese curry: potato, onion, carrot over crispy chicken and jasmine rice',               price:15.95,  emoji:'🍛'},
  {id:'e12', cat:'entree',    name:'Udon Stir Chicken',  desc:'Stir fried udon noodles with chicken and veggies',                                               price:16.95,  emoji:'🍝'},
  {id:'e13', cat:'entree',    name:'Udon Stir Tofu',     desc:'Stir fried udon noodles with tofu',                                                              price:16.95,  emoji:'🍝'},
  {id:'e14', cat:'entree',    name:'Yakimushi',          desc:'Stir fried Japanese noodles',                                                                      price:16.95,  emoji:'🍜'},
  {id:'e15', cat:'entree',    name:'Sushi Bagel',        desc:'Creative sushi bagel fusion',                                                                      price:18.95,  emoji:'🥯'},

  // ── NIGIRI
  {id:'n1',  cat:'nigiri',    name:'Salmon Nigiri',      desc:'Fresh salmon over sushi rice (2 pcs)',                                                             price:9.00,   emoji:'🐠'},
  {id:'n2',  cat:'nigiri',    name:'Tuna Nigiri',        desc:'Fresh tuna over sushi rice (2 pcs)',                                                              price:9.00,   emoji:'🐟'},
  {id:'n3',  cat:'nigiri',    name:'Seared Tuna Nigiri', desc:'Seared tuna over sushi rice (2 pcs)',                                                             price:9.00,   emoji:'🔥'},
  {id:'n4',  cat:'nigiri',    name:'Smoked Salmon Nigiri',desc:'Smoked salmon over sushi rice (2 pcs)',                                                         price:10.00,  emoji:'🐠'},
  {id:'n5',  cat:'nigiri',    name:'Escolar Nigiri',     desc:'Escolar over sushi rice (2 pcs)',                                                                 price:9.00,   emoji:'🐡'},
  {id:'n6',  cat:'nigiri',    name:'Broiled Eel Nigiri', desc:'BBQ eel over sushi rice (2 pcs)',                                                                 price:9.00,   emoji:'🐍'},
  {id:'n7',  cat:'nigiri',    name:'Cooked Shrimp Nigiri',desc:'Cooked shrimp over sushi rice (2 pcs)',                                                         price:9.00,   emoji:'🦐'},
  {id:'n8',  cat:'nigiri',    name:'Flying Fish Roe Nigiri',desc:'Tobiko over sushi rice (2 pcs)',                                                              price:9.00,   emoji:'🫧'},
  {id:'n9',  cat:'nigiri',    name:'Ikura Nigiri',       desc:'Salmon roe over sushi rice (2 pcs)',                                                              price:11.00,  emoji:'🫧'},

  // ── SASHIMI
  {id:'sh1', cat:'sashimi',   name:'Salmon Sashimi',     desc:'Fresh sliced salmon (3 pcs)',                                                                     price:9.00,   emoji:'🐠'},
  {id:'sh2', cat:'sashimi',   name:'Tuna Sashimi',       desc:'Fresh sliced tuna (3 pcs)',                                                                       price:9.00,   emoji:'🐟'},
  {id:'sh3', cat:'sashimi',   name:'Seared Tuna Sashimi',desc:'Seared tuna (3 pcs)',                                                                             price:9.00,   emoji:'🔥'},
  {id:'sh4', cat:'sashimi',   name:'Smoked Salmon Sashimi',desc:'Smoked salmon (3 pcs)',                                                                         price:9.00,   emoji:'🐠'},
  {id:'sh5', cat:'sashimi',   name:'Yellowtail Sashimi', desc:'Fresh yellowtail hamachi (3 pcs)',                                                                price:8.00,   emoji:'🐡'},
  {id:'sh6', cat:'sashimi',   name:'Escolar Sashimi',    desc:'Escolar (3 pcs)',                                                                                 price:9.00,   emoji:'🐡'},
  {id:'sh7', cat:'sashimi',   name:'Broiled Eel Sashimi',desc:'BBQ eel (3 pcs)',                                                                                price:10.00,  emoji:'🐍'},
  {id:'sh8', cat:'sashimi',   name:'Squid Sashimi',      desc:'Fresh squid (3 pcs)',                                                                             price:9.00,   emoji:'🦑'},
  {id:'sh9', cat:'sashimi',   name:'Cooked Shrimp Sashimi',desc:'Cooked shrimp (3 pcs)',                                                                        price:9.00,   emoji:'🦐'},
  {id:'sh10',cat:'sashimi',   name:'Flying Fish Roe Sashimi',desc:'Tobiko (3 pcs)',                                                                             price:9.00,   emoji:'🫧'},
  {id:'sh11',cat:'sashimi',   name:'Ikura Sashimi',      desc:'Salmon roe (3 pcs)',                                                                              price:11.00,  emoji:'🫧'},

  // ── SUSHI COMBO
  {id:'c1',  cat:'combo',     name:'Boat 1 Combo',       desc:'Two rolls + 6 pcs nigiri + 3 pcs sashimi',                                                       price:60.00,  emoji:'⛵'},
  {id:'c2',  cat:'combo',     name:'Boat 2 Combo',       desc:'Three rolls + 6 pcs nigiri + 6 pcs sashimi',                                                     price:90.00,  emoji:'🚤'},
  {id:'c3',  cat:'combo',     name:'Boat 3 Combo',       desc:'Four rolls + 9 pcs nigiri + 9 pcs sashimi',                                                      price:125.00, emoji:'🛥️'},
  {id:'c4',  cat:'combo',     name:'Boat 4 Combo',       desc:'Five rolls + 10 pcs nigiri + 10 pcs sashimi',                                                    price:135.00, emoji:'🚢'},
  {id:'c5',  cat:'combo',     name:'Two Roll Combo',     desc:'Choice of two rolls',                                                                              price:23.95,  emoji:'🍱'},
  {id:'c6',  cat:'combo',     name:'Nigiri Combo',       desc:'Chef\\'s choice nigiri selection',                                                                 price:18.00,  emoji:'🍣'},
  {id:'c7',  cat:'combo',     name:'Sashimi Combo',      desc:'Chef\\'s choice sashimi selection',                                                                price:18.00,  emoji:'🐟'},
  {id:'c8',  cat:'combo',     name:'Nigiri/Sashimi Combo',desc:'Mix of nigiri and sashimi',                                                                      price:18.00,  emoji:'🍣'},
  {id:'c9',  cat:'combo',     name:'Ahi Tuna Poke',      desc:'Hawaiian style tuna poke bowl with poke sauce, mix toppings, crab, wakame, seasoned vegetables', price:16.95,  emoji:'🐟'},
  {id:'c10', cat:'combo',     name:'Salmon Poke Bowl',   desc:'Fresh salmon poke bowl',                                                                           price:16.95,  emoji:'🐠'},
  {id:'c11', cat:'combo',     name:'Unagi Don',          desc:'BBQ eel traditional Japanese rice bowl with grilled eel, seasoning sauce and seasonal vegetables', price:19.00, emoji:'🐍'},
  {id:'c12', cat:'combo',     name:'Chirashi',           desc:'9 pcs chef\\'s choice sashimi and tempura served on a bed of sushi rice',                        price:19.00,  emoji:'🍱'},

  // ── DESSERT
  {id:'d1',  cat:'dessert',   name:'Mochi Ice Cream (Green Tea)', desc:'Japanese mochi ice cream with green tea flavor',                                        price:12.95,  emoji:'🍡'},

  // ── BEVERAGE
  {id:'bv1', cat:'beverage',  name:'Coke',               desc:'Classic Coca-Cola',                                                                                price:3.50,   emoji:'🥤'},
  {id:'bv2', cat:'beverage',  name:'Diet Coke',          desc:'Diet Coca-Cola',                                                                                  price:3.50,   emoji:'🥤'},
  {id:'bv3', cat:'beverage',  name:'Sprite',             desc:'Sprite',                                                                                           price:3.50,   emoji:'🥤'},
  {id:'bv4', cat:'beverage',  name:'Fanta Orange',       desc:'Fanta Orange',                                                                                    price:4.50,   emoji:'🍊'},
  {id:'bv5', cat:'beverage',  name:'Dr. Pepper',         desc:'Dr. Pepper',                                                                                      price:3.50,   emoji:'🥤'},
  {id:'bv6', cat:'beverage',  name:'Root Beer',          desc:'Root Beer',                                                                                       price:3.50,   emoji:'🥤'},
  {id:'bv7', cat:'beverage',  name:'Lemonade',           desc:'Fresh lemonade',                                                                                  price:3.50,   emoji:'🍋'},
  {id:'bv8', cat:'beverage',  name:'Apple Juice',        desc:'Apple juice',                                                                                     price:4.50,   emoji:'🍎'},
  {id:'bv9', cat:'beverage',  name:'Orange Juice',       desc:'Orange juice',                                                                                    price:4.50,   emoji:'🍊'},
  {id:'bv10',cat:'beverage',  name:'Cranberry Juice',    desc:'Cranberry juice',                                                                                 price:4.50,   emoji:'🍹'},
  {id:'bv11',cat:'beverage',  name:'Unsweet Tea',        desc:'Unsweetened iced tea',                                                                            price:4.50,   emoji:'🧋'},
  {id:'bv12',cat:'beverage',  name:'Hot Tea',            desc:'Hot tea',                                                                                         price:3.50,   emoji:'☕'},
  {id:'bv13',cat:'beverage',  name:'Vietnamese Coffee',  desc:'Vietnamese iced coffee',                                                                          price:5.95,   emoji:'☕'},
  {id:'bv14',cat:'beverage',  name:'Ramune (Grape)',     desc:'Japanese Ramune soda — Grape flavor',                                                             price:3.50,   emoji:'🍇'},
  {id:'bv15',cat:'beverage',  name:'Ramune (Orange)',    desc:'Japanese Ramune soda — Orange flavor',                                                            price:3.50,   emoji:'🍊'},
  {id:'bv16',cat:'beverage',  name:'Ramune (Peach)',     desc:'Japanese Ramune soda — Peach flavor',                                                             price:3.50,   emoji:'🍑'},

  // ── LIQUOR
  {id:'lq1', cat:'liquor',    name:'Beer Sapporo (Bottle)', desc:'Japanese Sapporo beer',                                                                       price:5.00,   emoji:'🍺'},
  {id:'lq2', cat:'liquor',    name:'Blue Moon',          desc:'Blue Moon beer',                                                                                  price:5.00,   emoji:'🌙'},
  {id:'lq3', cat:'liquor',    name:'Champagne (Glass)',   desc:'Champagne by the glass',                                                                         price:7.00,   emoji:'🥂'},
  {id:'lq4', cat:'liquor',    name:'Champagne (Bottle)',  desc:'Bottle of champagne',                                                                            price:26.00,  emoji:'🍾'},
  {id:'lq5', cat:'liquor',    name:'Yuzu Sake (Glass)',   desc:'Japanese yuzu sake',                                                                             price:7.00,   emoji:'🍶'},
  {id:'lq6', cat:'liquor',    name:'White Chardonnay (Glass)', desc:'Chardonnay by the glass',                                                                  price:8.00,   emoji:'🍷'},
  {id:'lq7', cat:'liquor',    name:'White Chardonnay (Bottle)', desc:'Bottle of Chardonnay',                                                                    price:29.00,  emoji:'🍾'},
  {id:'lq8', cat:'liquor',    name:'White Moscato (Glass)', desc:'Moscato by the glass',                                                                         price:8.50,   emoji:'🍷'},
  {id:'lq9', cat:'liquor',    name:'White Moscato (Bottle)', desc:'Bottle of Moscato',                                                                           price:32.00,  emoji:'🍾'},
  {id:'lq10',cat:'liquor',    name:'Sauvignon Blanc (Glass)', desc:'Sauvignon Blanc by the glass',                                                               price:7.00,   emoji:'🍷'},
  {id:'lq11',cat:'liquor',    name:'Sauvignon Blanc (Bottle)', desc:'Bottle of Sauvignon Blanc',                                                                 price:26.00,  emoji:'🍾'},
];

const CATS = [
  {id:'all',       label:'🍽 All'},
  {id:'appetizer', label:'🥟 Appetizers'},
  {id:'signature', label:'⭐ Signature Rolls'},
  {id:'basic',     label:'🍱 Basic Rolls'},
  {id:'ramen',     label:'🍜 Ramen'},
  {id:'entree',    label:'🍚 Entrées'},
  {id:'nigiri',    label:'🍣 Nigiri'},
  {id:'sashimi',   label:'🐟 Sashimi'},
  {id:'combo',     label:'⛵ Combos'},
  {id:'dessert',   label:'🍡 Dessert'},
  {id:'beverage',  label:'🥤 Beverages'},
  {id:'liquor',    label:'🍶 Liquor'},
];

const CAT_NAMES = {
  appetizer:'🥟 Appetizers & Salads', signature:'⭐ Signature & Special Rolls',
  basic:'🍱 Basic Rolls', ramen:'🍜 Ramen & Noodles', entree:'🍚 Entrées',
  nigiri:'🍣 Nigiri', sashimi:'🐟 Sashimi', combo:'⛵ Sushi Combos & Boats',
  dessert:'🍡 Desserts', beverage:'🥤 Beverages', liquor:'🍶 Liquor'
};

const CAT_ORDER = ['appetizer','signature','basic','ramen','entree','nigiri','sashimi','combo','dessert','beverage','liquor'];

// ─────────────────────────────────────────────
// STATE
// ─────────────────────────────────────────────
let cart = [];
let activeCat = 'all';

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  buildTableScreen();
  buildCatNav();
  renderMenu('all');
  if(!DEMO_MODE) checkConn();
  else { document.getElementById('statusTxt').textContent = 'Demo Mode'; }
});

async function checkConn() {
  try {
    const r = await fetch(\`\${BACKEND_URL}/health\`, {signal:AbortSignal.timeout(5000)});
    if(!r.ok) throw new Error();
    document.getElementById('statusTxt').textContent = 'Connected';
  } catch {
    document.getElementById('dot').className = 'dot err';
    document.getElementById('statusTxt').textContent = 'Server offline';
  }
}

// ─────────────────────────────────────────────
// RENDER
// ─────────────────────────────────────────────
function buildCatNav() {
  document.getElementById('catNav').innerHTML = CATS.map(c =>
    \`<button class="cat-tab \${c.id==='all'?'active':''}" onclick="filterCat('\${c.id}',this)">\${c.label}</button>\`
  ).join('');
}

function filterCat(id, btn) {
  activeCat = id;
  document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderMenu(id);
}

function renderMenu(cat) {
  const items = cat === 'all' ? MENU : MENU.filter(m => m.cat === cat);
  const grouped = {};
  CAT_ORDER.forEach(c => {
    const its = items.filter(m => m.cat === c);
    if(its.length) grouped[c] = its;
  });
  document.getElementById('menuBody').innerHTML = Object.entries(grouped).map(([c, its]) => \`
    <div class="menu-sec" id="sec_\${c}">
      <div class="sec-head">
        <div class="sec-title">\${CAT_NAMES[c]}</div>
        <div class="sec-count">\${its.length} items</div>
      </div>
      <div class="menu-grid">\${its.map(card).join('')}</div>
    </div>
  \`).join('');
  updateIndicators();
}

function card(item) {
  const c = cart.find(x => x.id === item.id);
  const qty = c ? c.qty : 0;
  return \`<div class="card" onclick="addItem('\${item.id}')">
    <div class="card-img">\${item.emoji}
      <div class="qty-pill \${qty?'on':''}" id="qp_\${item.id}">\${qty}</div>
    </div>
    <div class="card-body">
      <div class="card-name">\${item.name}</div>
      <div class="card-desc">\${item.desc}</div>
      <div class="card-foot">
        <div class="card-price">\$\${item.price.toFixed(2)}</div>
        <button class="add-btn" onclick="event.stopPropagation();addItem('\${item.id}')">+</button>
      </div>
    </div>
  </div>\`;
}

// ─────────────────────────────────────────────
// CART LOGIC
// ─────────────────────────────────────────────
function addItem(id) {
  const item = MENU.find(m => m.id === id);
  const ex = cart.find(c => c.id === id);
  if(ex) ex.qty++; else cart.push({...item, qty:1});
  updateCartUI();
  updateIndicators();
}

function changeQty(id, delta) {
  const idx = cart.findIndex(c => c.id === id);
  if(idx === -1) return;
  cart[idx].qty += delta;
  if(cart[idx].qty <= 0) cart.splice(idx, 1);
  updateCartUI();
  updateIndicators();
  renderCartItems();
}

function updateIndicators() {
  MENU.forEach(item => {
    const el = document.getElementById('qp_' + item.id);
    if(!el) return;
    const c = cart.find(x => x.id === item.id);
    if(c && c.qty > 0) { el.classList.add('on'); el.textContent = c.qty; }
    else el.classList.remove('on');
  });
}

function updateCartUI() {
  const total = cart.reduce((s,c) => s+c.qty, 0);
  const price = cart.reduce((s,c) => s+c.qty*c.price, 0);
  const badge = document.getElementById('cartBadge');
  if(total > 0) { badge.classList.add('on'); badge.textContent = total; }
  else badge.classList.remove('on');
  document.getElementById('cpTotal').textContent = \`\$\${price.toFixed(2)}\`;
  document.getElementById('cpCount').textContent = \`\${total} item\${total!==1?'s':''}\`;
  document.getElementById('orderBtn').disabled = total === 0;
}

function renderCartItems() {
  const el = document.getElementById('cpItems');
  if(!cart.length) { el.innerHTML = '<div class="cp-empty"><div class="ei">🍣</div><div>Nothing here yet</div></div>'; return; }
  el.innerHTML = cart.map(item => \`
    <div class="ci">
      <div class="ci-emoji">\${item.emoji}</div>
      <div class="ci-info">
        <div class="ci-name">\${item.name}</div>
        <div class="ci-price">\$\${item.price.toFixed(2)} × \${item.qty} = \$\${(item.price*item.qty).toFixed(2)}</div>
      </div>
      <div class="qty-ctrl">
        <button class="qb" onclick="changeQty('\${item.id}',-1)">−</button>
        <span class="qn">\${item.qty}</span>
        <button class="qb" onclick="changeQty('\${item.id}',1)">+</button>
      </div>
    </div>
  \`).join('');
}

function openCart() { renderCartItems(); document.getElementById('cartPanel').classList.add('open'); document.getElementById('overlay').classList.add('on'); }
function closeCart() { document.getElementById('cartPanel').classList.remove('open'); document.getElementById('overlay').classList.remove('on'); }

// ─────────────────────────────────────────────
// SUBMIT ORDER
// ─────────────────────────────────────────────
async function submitOrder() {
  const btn = document.getElementById('orderBtn');
  const note = document.getElementById('orderNote').value.trim();
  btn.disabled = true;
  btn.innerHTML = '<div class="spin"></div> Sending...';
  try {
    if(DEMO_MODE) {
      await new Promise(r => setTimeout(r, 1400));
      showSuccess(\`DEMO-\${Date.now()}\`);
    } else {
      const res = await fetch(\`\${BACKEND_URL}/api/order\`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          tableNumber: selectedTable || TABLE_NUMBER,
          items: cart.map(c => ({name:c.name, qty:c.qty, price:c.price})),
          note
        })
      });
      const data = await res.json();
      if(!res.ok) throw new Error(data.error || 'Server error');
      showSuccess(data.orderId);
    }
  } catch(err) {
    alert(\`❌ Error: \${err.message}\\nPlease ask staff for assistance.\`);
    btn.disabled = false;
    btn.innerHTML = 'Place Order →';
  }
}

function showSuccess(orderId) {
  closeCart();
  document.getElementById('modalId').textContent = \`Order ID: \${orderId}\`;
  document.getElementById('successModal').classList.add('on');
  cart = [];
  updateCartUI();
  updateIndicators();
  renderMenu(activeCat);
  document.getElementById('orderNote').value = '';
}

function closeSuccess() {
  document.getElementById('successModal').classList.remove('on');
}
</script>
</body>
</html>
`);
});

app.listen(PORT, () => {
  console.log(`🚀 Kaizen Self Order Server — port ${PORT} [${SQUARE_ENV}]`);
  console.log(`📍 Location: ${SQUARE_LOCATION_ID}`);
});
