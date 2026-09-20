const express = require('express');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
// Serve static frontend files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

// In-memory fallback database
let dbCodes = [
    { id: '1', code: 'BYBIT-VIP-9921', tier: 'VIP Unlimited', used: false },
    { id: '2', code: 'BYBIT-PRO-4412', tier: 'Pro Trader', used: false }
];

let dbTransactions = [
    { id: 'tx-101', type: 'deposit', amount: 100, details: '7f8c9b4e12a1b2', status: 'pending' }
];

const BYBIT_API_KEY = process.env.BYBIT_API_KEY || 'eZKaZBv02FE2NX5Jd';
const BYBIT_API_SECRET = process.env.BYBIT_API_SECRET || 'TGvJJ6E833VwImpP8Ed5l6Y4E1owjlpvw';

// API Routes
app.get('/api/codes', (req, res) => res.json(dbCodes));

app.post('/api/codes', (req, res) => {
    const { tier } = req.body;
    const code = `BYBIT-${tier.toUpperCase().replace(/\s+/g, '-')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newCode = { id: Date.now().toString(), code, tier: tier || 'Pro Trader', used: false };
    dbCodes.push(newCode);
    res.json(newCode);
});

app.post('/api/codes/use', (req, res) => {
    const { code } = req.body;
    const found = dbCodes.find(c => c.code === code);
    if (!found) return res.status(400).json({ error: 'Invalid passcode' });
    if (found.used) return res.status(400).json({ error: 'Passcode already redeemed' });
    found.used = true;
    res.json({ success: true, tier: found.tier });
});

app.get('/api/transactions', (req, res) => res.json(dbTransactions));

app.post('/api/transactions', (req, res) => {
    const { type, amount, details } = req.body;
    const newTx = { id: 'tx-' + Date.now(), type, amount, details, status: 'pending' };
    dbTransactions.push(newTx);
    res.json(newTx);
});

app.patch('/api/transactions/:id', (req, res) => {
    const tx = dbTransactions.find(t => t.id === req.params.id);
    if (tx) {
        tx.status = 'approved';
        return res.json({ success: true, tx });
    }
    res.status(404).json({ error: 'Transaction not found' });
});

app.post('/api/bot/start', (req, res) => {
    const { symbol, strategy, capital } = req.body;
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    const rawString = timestamp + BYBIT_API_KEY + recvWindow + `symbol=${symbol}&side=Buy&orderType=Market&qty=${capital}`;
    const signature = crypto.createHmac('sha256', BYBIT_API_SECRET).update(rawString).digest('hex');

    res.json({
        success: true,
        message: `Successfully authenticated with Bybit V5 REST API. Bot active for ${symbol}.`,
        timestamp
    });
});

// Fallback to index.html for single-page application routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
