const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());

// Serve static frontend files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

const DEFAULT_BYBIT_KEY = process.env.BYBIT_API_KEY;
const DEFAULT_BYBIT_SECRET = process.env.BYBIT_API_SECRET;

// Root route to serve index.html from public folder
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Bybit Trade Route
app.post('/api/bybit/trade', async (req, res) => {
    try {
        const { symbol, side, orderType, qty, price, testnet } = req.body;

        const apiKey = DEFAULT_BYBIT_KEY;
        const apiSecret = DEFAULT_BYBIT_SECRET;

        if (!apiKey || !apiSecret) {
            return res.status(400).json({ success: false, error: 'Environment variables BYBIT_API_KEY or BYBIT_API_SECRET are missing.' });
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
        } catch (parseErr) {
            return res.status(500).json({ 
                success: false, 
                error: 'Invalid JSON response from Bybit server. Check network or API credentials.' 
            });
        }

        if (data.retCode !== 0) {
            return res.status(400).json({ success: false, error: `Bybit Error (${data.retCode}): ${data.retMsg}` });
        }

        res.json({ success: true, data: data.result });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message || 'Failed to connect to Bybit server.' });
    }
});

// Local development server listener vs Vercel serverless export
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;
