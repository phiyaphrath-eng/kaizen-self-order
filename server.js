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
  if (!tableNumber || !items || items.length === 0) {
    return res.status(400).json({ error: 'Missing tableNumber or items' });
  }

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
      reference_id: `TABLE_${tableNumber}_${Date.now()}`,
      line_items: lineItems,
      metadata: {
        table: String(tableNumber),
        source: 'kaizen-self-order',
        note: note || ''
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

    console.log(`✅ Order | Table ${tableNumber} | ID: ${data.order.id}`);
    res.json({ success: true, orderId: data.order.id });

  } catch (err) {
    console.error('Server error:', err.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Kaizen Self Order Server — port ${PORT} [${SQUARE_ENV}]`);
  console.log(`📍 Location: ${SQUARE_LOCATION_ID}`);
});
