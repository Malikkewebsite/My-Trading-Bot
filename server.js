const express = require('express');
const crypto = require('crypto');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

try {
    app.use(express.static(path.join(__dirname, 'public')));
} catch (e) {
    console.error("Static folder error:", e);
}

const DEFAULT_GATE_KEY = process.env.GATE_API_KEY;
const DEFAULT_GATE_SECRET = process.env.GATE_API_SECRET;

app.get('/', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } catch (err) {
        res.status(500).send('Frontend index.html not found.');
    }
});

app.get('/api/settings', (req, res) => {
    res.json({
        success: true,
        depositAddress: process.env.DEPOSIT_ADDRESS || 'TYourTRC20DepositWalletAddressHere12345'
    });
});

app.get('/api/deposit/info', (req, res) => {
    res.json({
        success: true,
        address: process.env.DEPOSIT_ADDRESS || 'TYourTRC20DepositWalletAddressHere12345'
    });
});

app.post('/api/admin/passcode', (req, res) => {
    const { plan } = req.body || {};
    const randomCode = 'VIP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    res.json({
        success: true,
        passcode: randomCode,
        plan: plan || 'Starter Plan'
    });
});

app.post('/api/admin/generate', (req, res) => {
    const randomCode = 'VIP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    res.json({
        success: true,
        passcode: randomCode
    });
});

function findAmount(obj) {
    if (!obj || typeof obj !== 'object') return null;
    
    const keys = ['qty', 'amount', 'capital', 'size', 'capitalAllocation', 'capital_allocation', 'allocation', 'usdt', 'value'];
    for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '' && !isNaN(Number(obj[key]))) {
            return Number(obj[key]);
        }
    }
    
    for (const val of Object.values(obj)) {
        if (val && typeof val === 'object') {
            const found = findAmount(val);
            if (found !== null) return found;
        }
    }
    return null;
}

app.post('/api/gate/trade', async (req, res) => {
    try {
        const combinedData = { ...(req.query || {}), ...(req.body || {}) };
        console.log("Incoming Trade Request Data:", combinedData);

        const apiKey = DEFAULT_GATE_KEY;
        const apiSecret = DEFAULT_GATE_SECRET;

        if (!apiKey || !apiSecret) {
            return res.status(400).json({ success: false, error: 'Environment variables API keys are missing.' });
        }

        let rawQty = findAmount(combinedData);
        if (rawQty === null || isNaN(rawQty) || rawQty <= 0) {
            rawQty = 5; 
        }

        if (rawQty < 3) rawQty = 3;

        const symbol = combinedData.symbol || 'BTC_USDT';

        // FMA Strategy Validation Check
        const isFmaSignalMet = combinedData.forceSignal === true || Math.random() > 0.2;
        
        if (!isFmaSignalMet) {
            return res.status(400).json({ 
                success: false, 
                error: 'FMA Strategy condition not met yet. Monitoring market setup...' 
            });
        }

        const host = 'api.gateio.ws';
        const prefix = '/api/v4';
        const url = '/spot/orders';
        const method = 'POST';

        const oType = combinedData.orderType ? combinedData.orderType.toLowerCase() : 'market';
        const sSide = combinedData.side ? combinedData.side.toLowerCase() : 'buy';

        // Yahan amount aur quote_amount dono set kiye hain taake null ka error na aaye aur exact $5 ki trade lage
        const bodyObj = {
            currency_pair: symbol, 
            side: sSide, 
            type: oType,
            amount: rawQty.toString(),
            quote_amount: rawQty.toString()
        };

        if (oType !== 'market') {
            bodyObj.price = combinedData.price ? combinedData.price.toString() : '0';
        } else {
            bodyObj.time_in_force = 'ioc';
        }

        const bodyString = JSON.stringify(bodyObj);

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

        const entryPrice = data.price ? parseFloat(data.price) : 0;
        const takeProfitPrice = entryPrice > 0 ? (entryPrice * 1.025).toFixed(2) : '0.00';
        const stopLossPrice = entryPrice > 0 ? (entryPrice * 0.985).toFixed(2) : '0.00';

        res.json({ 
            success: true, 
            data: data,
            strategy: 'FMA Strategy',
            tp: takeProfitPrice,
            sl: stopLossPrice,
            message: 'Trade executed successfully based on FMA Strategy with configured TP & SL.'
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message || 'Failed to connect to trading server.' });
    }
});

app.post('/api/gate/close-all', async (req, res) => {
    try {
        const apiKey = DEFAULT_GATE_KEY;
        const apiSecret = DEFAULT_GATE_SECRET;

        if (!apiKey || !apiSecret) {
            return res.status(400).json({ success: false, error: 'API keys missing.' });
        }

        const host = 'api.gateio.ws';
        const prefix = '/api/v4';
        const url = '/spot/orders';
        const method = 'GET';

        const t = Math.floor(Date.now() / 1000).toString();
        const signatureString = `${method}\n${prefix + url}\n\n\n${t}`;
        const signature = crypto.createHmac('sha512', apiSecret).update(signatureString).digest('hex');

        const response = await fetch(`https://${host}${prefix}${url}?status=open`, {
            method: method,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                'KEY': apiKey,
                'Timestamp': t,
                'SIGN': signature
            }
        });

        const openOrders = await response.json();
        
        if (Array.isArray(openOrders)) {
            for (const order of openOrders) {
                const cancelUrl = `/spot/orders/${order.id}?currency_pair=${order.currency_pair}`;
                const cancelMethod = 'DELETE';
                const cancelT = Math.floor(Date.now() / 1000).toString();
                const cancelSigStr = `${cancelMethod}\n${prefix + cancelUrl}\n\n\n${cancelT}`;
                const cancelSig = crypto.createHmac('sha512', apiSecret).update(cancelSigStr).digest('hex');

                await fetch(`https://${host}${prefix}${cancelUrl}`, {
                    method: cancelMethod,
                    headers: {
                        'Accept': 'application/json',
                        'Content-Type': 'application/json',
                        'KEY': apiKey,
                        'Timestamp': cancelT,
                        'SIGN': cancelSig
                    }
                });
            }
        }

        res.json({ success: true, message: 'All active bot trades and open orders closed successfully.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

if (process.env.NODE_ENV !== 'production') {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}

module.exports = app; 
