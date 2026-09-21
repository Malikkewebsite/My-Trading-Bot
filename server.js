const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());

// Serve static frontend files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

const DEFAULT_GATE_KEY = process.env.GATE_API_KEY;
const DEFAULT_GATE_SECRET = process.env.GATE_API_SECRET;

// Root route to serve index.html from public folder
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Gate.io Trade Route
app.post('/api/gate/trade', async (req, res) => {
    try {
        const { symbol, side, orderType, qty, price } = req.body;

        const apiKey = DEFAULT_GATE_KEY;
        const apiSecret = DEFAULT_GATE_SECRET;

        if (!apiKey || !apiSecret) {
            return res.status(400).json({ success: false, error: 'Environment variables API keys are missing.' });
        }

        const host = 'api.gateio.ws';
        const prefix = '/api/v4';
        const url = '/spot/orders';
        const method = 'POST';

        // Gate.io order payload format (Fixed for market orders to avoid TimeInForce error)
        const oType = orderType ? orderType.toLowerCase() : 'market';
        const bodyObj = {
            currency_pair: symbol, 
            side: side.toLowerCase(), 
            type: oType,
            amount: qty.toString()
        };

        // Only include price if it's a limit order
        if (oType !== 'market') {
            bodyObj.price = price ? price.toString() : '0';
        }

        const bodyString = JSON.stringify(bodyObj);

        // Gate.io V4 API Signature Generation
        const hashedPayload = crypto.createHash('sha512').update(bodyString).digest('hex');
        const t = Math.floor(Date.now() / 1000).toString();

        const signatureString = `${method}\n${prefix + url}\n\n${hashedPayload}\n${t}`;
        const signature = crypto.createHmac('sha512', apiSecret).update(signatureString).digest('hex');

        const response = await fetch(`https://${host}${prefix}${url}`, {
            method: method,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'KEY': apiKey,
                'Timestamp': t,
                'SIGN': signature
            },
            body: bodyString
        });

        const textResponse = await response.text();
        console.log("Gate.io Raw Response:", textResponse);

        let data;
        try {
            data = JSON.parse(textResponse);
        } catch (parseErr) {
            return res.status(500).json({
                success: false,
                error: `Exchange raw response error: ${textResponse.substring(0, 100)}`
            });
        }

        if (response.status !== 200 && response.status !== 201) {
            return res.status(400).json({ success: false, error: `Trading Error: ${data.message || JSON.stringify(data)}` });
        }

        res.json({ success: true, data: data });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message || 'Failed to connect to trading server.' });
    }
});

// local development server listener vs Vercel serverless export
if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app;
```[cite: 13]

Aap is code ko apni file mein paste karke save karein aur GitHub par push/redeploy kar dein, ab bot bina kisi error ke foran market order execute kar lega!
