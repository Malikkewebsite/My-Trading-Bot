const express = require('express');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Persistent Data Store
let dbState = {
    settings: {
        usdtAddress: '1Qf9Y2khESJW1ChVWFM5MERdown...',
        easypaisaNumber: '03123456789 (Account Title: Bybit Bot)'
    },
    users: [
        { uid: 'UID-884102', balance: 1250.00, activePlan: null, activeTrades: 0, sessionPnl: 0 },
        { uid: 'UID-552190', balance: 450.00, activePlan: 'Starter Plan', activeTrades: 1, sessionPnl: 15.50 }
    ],
    codes: [
        { id: '1', code: 'BYBIT-STARTER-9921', tier: 'Starter Plan', used: false },
        { id: '2', code: 'BYBIT-PRO-4412', tier: 'Pro Trader', used: false },
        { id: '3', code: 'BYBIT-VIP-7788', tier: 'VIP Unlimited', used: false }
    ],
    transactions: [
        { id: 'tx-101', uid: 'UID-884102', type: 'DEPOSIT', amount: 100, details: '7f8c9b4e12a1b2', status: 'PENDING' }
    ]
};

const BYBIT_API_KEY = process.env.BYBIT_API_KEY || 'eZKaZBv02FE2NX5Jd';
const BYBIT_API_SECRET = process.env.BYBIT_API_SECRET || 'TGvJJ6E833VwImpP8Ed5l6Y4E1owjlpvw';

// --- ADMIN SETTINGS & STATS ---
app.get('/api/admin/settings', (req, res) => {
    res.json(dbState.settings);
});

app.post('/api/admin/settings', (req, res) => {
    const { usdtAddress, easypaisaNumber } = req.body;
    if (usdtAddress) dbState.settings.usdtAddress = usdtAddress;
    if (easypaisaNumber) dbState.settings.easypaisaNumber = easypaisaNumber;
    res.json({ success: true, settings: dbState.settings });
});

app.get('/api/admin/stats', (req, res) => {
    const totalUsers = dbState.users.length;
    const pendingDeposits = dbState.transactions.filter(t => t.type === 'DEPOSIT' && t.status === 'PENDING').length;
    const activeSubscriptions = dbState.users.filter(u => u.activePlan !== null).length;
    res.json({ totalUsers, pendingDeposits, activeSubscriptions });
});

// --- USER & WALLET ROUTES ---
app.get('/api/user/:uid', (req, res) => {
    let user = dbState.users.find(u => u.uid === req.params.uid);
    if (!user) {
        user = { uid: req.params.uid, balance: 500.00, activePlan: null, activeTrades: 0, sessionPnl: 0 };
        dbState.users.push(user);
    }
    res.json(user);
});

// --- SUBSCRIPTIONS / PASSCODES ---
app.get('/api/codes', (req, res) => res.json(dbState.codes));

app.post('/api/codes', (req, res) => {
    const { tier } = req.body;
    const code = `BYBIT-${tier.toUpperCase().replace(/\s+/g, '-')}-${Math.floor(1000 + Math.random() * 9000)}`;
    const newCode = { id: Date.now().toString(), code, tier: tier || 'Pro Trader', used: false };
    dbState.codes.push(newCode);
    res.json(newCode);
});

app.post('/api/codes/use', (req, res) => {
    const { code, uid } = req.body;
    const found = dbState.codes.find(c => c.code === code);
    if (!found) return res.status(400).json({ error: 'Invalid passcode' });
    if (found.used) return res.status(400).json({ error: 'Passcode already redeemed' });
    
    found.used = true;
    let user = dbState.users.find(u => u.uid === uid);
    if (user) {
        user.activePlan = found.tier;
    }
    res.json({ success: true, tier: found.tier });
});

// --- TRANSACTIONS (DEPOSIT / WITHDRAW) ---
app.get('/api/transactions', (req, res) => res.json(dbState.transactions));

app.post('/api/transactions', (req, res) => {
    const { uid, type, amount, details } = req.body;
    const newTx = { id: 'tx-' + Date.now(), uid: uid || 'UID-884102', type: type.toUpperCase(), amount: parseFloat(amount), details, status: 'PENDING' };
    dbState.transactions.push(newTx);
    res.json(newTx);
});

// Admin Approve or Reject
app.post('/api/transactions/:id/action', (req, res) => {
    const { action } = req.body; // 'APPROVE' or 'REJECT'
    const tx = dbState.transactions.find(t => t.id === req.params.id);
    if (!tx) return res.status(404).json({ error: 'Transaction not found' });
    if (tx.status !== 'PENDING') return res.status(400).json({ error: 'Transaction already processed' });

    let user = dbState.users.find(u => u.uid === tx.uid);

    if (action === 'APPROVE') {
        tx.status = 'APPROVED';
        if (user) {
            if (tx.type === 'DEPOSIT') user.balance += tx.amount;
            if (tx.type === 'WITHDRAW') {
                if (user.balance >= tx.amount) user.balance -= tx.amount;
                else return res.status(400).json({ error: 'Insufficient user balance for withdrawal' });
            }
        }
    } else if (action === 'REJECT') {
        tx.status = 'REJECTED';
    } else {
        return res.status(400).json({ error: 'Invalid action' });
    }

    res.json({ success: true, tx, user });
});

// --- BYBIT TRADING BOT EXECUTION (REAL API MOCK / V5 REST) ---
app.post('/api/bot/start', (req, res) => {
    const { uid, symbol, capital, risk } = req.body;
    let user = dbState.users.find(u => u.uid === uid);

    if (!user) return res.status(400).json({ error: 'User not found' });
    if (!user.activePlan) return res.status(400).json({ error: 'Please unlock an algorithm plan first before starting the bot!' });
    if (capital > user.balance) return res.status(400).json({ error: `Insufficient balance! Available balance is $${user.balance.toFixed(2)}` });

    // Bybit V5 Signature Generation simulation
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    const rawString = timestamp + BYBIT_API_KEY + recvWindow + `symbol=${symbol}&side=Buy&orderType=Market&qty=${capital}`;
    const signature = crypto.createHmac('sha256', BYBIT_API_SECRET).update(rawString).digest('hex');

    user.activeTrades = 1;

    res.json({
        success: true,
        message: `Bybit V5 API Executed! Order opened for ${symbol} with $${capital} capital.`,
        signature,
        balance: user.balance
    });
});

app.post('/api/bot/stop', (req, res) => {
    const { uid, profit } = req.body;
    let user = dbState.users.find(u => u.uid === uid);
    if (user) {
        user.balance += parseFloat(profit || 0);
        user.activeTrades = 0;
        user.sessionPnl += parseFloat(profit || 0);
    }
    res.json({ success: true, newBalance: user ? user.balance : 0 });
});

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Vercel serverless compatibility fix
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

module.exports = app;
