require('dotenv').config();
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Pool } = require('pg');
const axios = require('axios');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// PostgreSQL / Supabase Connection Pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.connect((err) => {
  if (err) console.error('Database connection error:', err.stack);
  else console.log('Connected to Supabase Database successfully.');
});

// API endpoint to verify or generate passcodes
app.post('/api/verify-passcode', async (req, res) => {
  const { passcode } = req.body;
  try {
    // Basic validation or check against database
    if (passcode && passcode.length >= 6) {
      res.json({ success: true, message: 'Access granted successfully' });
    } else {
      res.status(400).json({ success: false, message: 'Invalid Passcode' });
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Bybit Market Data Proxy Endpoint
app.get('/api/bybit/ticker', async (req, res) => {
  try {
    const response = await axios.get('https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT');
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
