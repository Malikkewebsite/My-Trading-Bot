const express = require('express');
const crypto = require('crypto');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let adminSettings = {
    usdtAddress: 'TRC20_OFFICIAL_WALLET_ADDRESS_HERE',
    easypaisaNumber: '03125124424 (Official Easypaisa)'
};
let accessCodes = {};
let transactions = [];
let usersCount = 1;

// --- BYBIT REAL EXCHANGE ORDER EXECUTION ROUTE ---
app.post('/api/bybit/trade', async (req, res) => {
    const { apiKey, apiSecret, symbol, side, orderType, qty, price, testnet } = req.body;

    if (!apiKey || !apiSecret) {
        return res.status(400).json({ success: false, error: 'Bybit API Key and Secret are required in settings.' });
    }

    const baseUrl = testnet ? 'https://api-testnet.bybit.com' : 'https://api.bybit.com';
    const endpoint = '/v5/order/create';
    const timestamp = Date.now().toString();
    const recvWindow = '5000';

    const payload = {
        category: 'spot',
        symbol: symbol,
        side: side,
        orderType: orderType,
        qty: qty.toString(),
        price: price ? price.toString() : undefined
    };

    Object.keys(payload).forEach(key => payload[key] === undefined && delete payload[key]);

    const bodyString = JSON.stringify(payload);
    const signatureString = timestamp + apiKey + recvWindow + bodyString;
    const signature = crypto.createHmac('sha256', apiSecret).update(signatureString).digest('hex');

    try {
        const response = await fetch(baseUrl + endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-BAPI-API-KEY': apiKey,
                'X-BAPI-TIMESTAMP': timestamp,
                'X-BAPI-SIGN': signature,
                'X-BAPI-RECV-WINDOW': recvWindow
            },
            body: bodyString
        });

        const textResponse = await response.text();
        let data;
        try {
            data = JSON.parse(textResponse);
        } catch (e) {
            return res.status(400).json({
                success: false,
                error: `Invalid JSON response from Bybit: ${textResponse.substring(0, 100)}`
            });
        }

        if (data.retCode !== 0) {
            return res.status(400).json({
                success: false,
                error: `Bybit Error (${data.retCode}): ${data.retMsg}`
            });
        }

        res.json({ success: true, data: data.result });
    } catch (err) {
        res.status(500).json({
            success: false,
            error: err.message || 'Failed to connect to Bybit exchange server.'
        });
    }
});

app.get('/api/admin/settings', (req, res) => res.json(adminSettings));
app.post('/api/admin/settings', (req, res) => {
    adminSettings = req.body;
    res.json({ success: true });
});

app.get('/api/admin/stats', (req, res) => {
    res.json({
        totalUsers: usersCount,
        pendingDeposits: transactions.filter(t => t.status === 'PENDING').length,
        activeSubscriptions: 1
    });
});

app.post('/api/codes', (req, res) => {
    const code = 'PRO-' + Math.random().toString(36).substring(2, 8).toUpperCase();
    accessCodes[code] = { tier: req.body.tier || 'Pro Trader', used: false };
    res.json({ code });
});

app.post('/api/codes/use', (req, res) => {
    const { code, uid } = req.body;
    if (accessCodes[code] && !accessCodes[code].used) {
        accessCodes[code].used = true;
        res.json({ success: true, tier: accessCodes[code].tier });
    } else {
        res.json({ success: false, error: 'Invalid or already used passcode.' });
    }
});

app.post('/api/transactions', (req, res) => {
    const tx = { id: transactions.length + 1, ...req.body, status: 'PENDING' };
    transactions.push(tx);
    res.json({ success: true, tx });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
