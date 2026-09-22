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

const DEFAULT_GATE_KEY = "571cbdc229c84e7056d4d6b160fc23b4";
const DEFAULT_GATE_SECRET = "b292e3d2aceae77273c78945ccf1955488abe3a7151e13f7b91bab53de8d45d3";

let botState = {
    isRunning: false,
    symbol: 'BTC_USDT',
    capital: 5,
    intervalId: null,
    lastTradedFvgTime: null
};

app.get('/', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } catch (err) {
        res.status(500).send('Frontend index.html not found.');
    }
});

app.get('/api/settings', (req, res) => {
    res.json({ success: true, depositAddress: process.env.DEPOSIT_ADDRESS || 'TYourTRC20DepositWalletAddressHere12345' });
});

app.get('/api/deposit/info', (req, res) => {
    res.json({ success: true, address: process.env.DEPOSIT_ADDRESS || 'TYourTRC20DepositWalletAddressHere12345' });
});

app.post('/api/admin/passcode', (req, res) => {
    const { plan } = req.body || {};
    const randomCode = 'VIP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    res.json({ success: true, passcode: randomCode, plan: plan || 'Starter Plan' });
});

app.post('/api/admin/generate', (req, res) => {
    const randomCode = 'VIP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    res.json({ success: true, passcode: randomCode });
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

function calculateEMA(data, period) {
    if (!data || data.length === 0) return [];
    const k = 2 / (period + 1);
    let emaArray = [];
    let prevEMA = data[0];
    emaArray.push(prevEMA);
    for (let i = 1; i < data.length; i++) {
        let currentEMA = (data[i] * k) + (prevEMA * (1 - k));
        emaArray.push(currentEMA);
        prevEMA = currentEMA;
    }
    return emaArray;
}

async function getGateAccountBalance() {
    const host = 'api.gateio.ws';
    const prefix = '/api/v4';
    const url = '/spot/accounts';
    const method = 'GET';
    const t = Math.floor(Date.now() / 1000).toString();

    const signatureString = `${method}\n${prefix + url}\n\n\n${t}`;
    const signature = crypto.createHmac('sha512', DEFAULT_GATE_SECRET).update(signatureString).digest('hex');

    const response = await fetch(`https://${host}${prefix}${url}`, {
        method: method,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'KEY': DEFAULT_GATE_KEY,
            'Timestamp': t,
            'SIGN': signature
        }
    });

    const accounts = await response.json();
    if (Array.isArray(accounts)) {
        const usdtAcc = accounts.find(acc => acc.currency === 'USDT');
        return usdtAcc ? parseFloat(usdtAcc.available || 0) : 0;
    }
    return 0;
}

async function executeGateOrder(symbol, side, orderType, amountVal, priceVal = '0') {
    const host = 'api.gateio.ws';
    const prefix = '/api/v4';
    const url = '/spot/orders';
    const method = 'POST';

    const bodyObj = {
        currency_pair: symbol,
        side: side,
        type: orderType
    };

    if (orderType === 'market' && side === 'buy') {
        bodyObj.quote_amount = amountVal.toString();
    } else {
        bodyObj.amount = amountVal.toString();
    }

    if (orderType !== 'market') {
        bodyObj.price = priceVal.toString();
    } else {
        bodyObj.time_in_force = 'ioc';
    }

    const bodyString = JSON.stringify(bodyObj);
    const hashedPayload = crypto.createHash('sha512').update(bodyString).digest('hex');
    const t = Math.floor(Date.now() / 1000).toString();

    const signatureString = `${method}\n${prefix + url}\n\n${hashedPayload}\n${t}`;
    const signature = crypto.createHmac('sha512', DEFAULT_GATE_SECRET).update(signatureString).digest('hex');

    const response = await fetch(`https://${host}${prefix}${url}`, {
        method: method,
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'KEY': DEFAULT_GATE_KEY,
            'Timestamp': t,
            'SIGN': signature
        },
        body: bodyString
    });

    const textResponse = await response.text();
    let data;
    try {
        data = JSON.parse(textResponse);
    } catch (e) {
        throw new Error(`Exchange Error: Raw response error: ${textResponse.substring(0, 100)}`);
    }

    if (response.status !== 200 && response.status !== 201) {
        throw new Error(`Exchange Error: ${data.message || JSON.stringify(data)}`);
    }
    return data;
}

app.post('/api/gate/trade', async (req, res) => {
    try {
        const combinedData = { ...(req.query || {}), ...(req.body || {}) };
        
        let rawQty = findAmount(combinedData);
        if (rawQty === null || isNaN(rawQty) || rawQty <= 0) rawQty = 5;
        if (rawQty < 3) rawQty = 3;

        const symbol = combinedData.symbol || 'BTC_USDT';

        // Step 1: Exchange Balance Verification Check
        const availableBalance = await getGateAccountBalance();
        if (availableBalance < rawQty && availableBalance > 0) {
            return res.status(400).json({ 
                success: false, 
                error: `Exchange Error: Insufficient balance available in your account. Required: $${rawQty}, Available: $${availableBalance.toFixed(2)}` 
            });
        }

        // Step 2: Strict Strategy Validation Check (Fetching Candles & Evaluating FVG + 50 EMA)
        const host = 'api.gateio.ws';
        const prefix = '/api/v4';
        const klinesRes = await fetch(`https://${host}${prefix}/spot/candlesticks?currency_pair=${symbol}&interval=15m&limit=120`);
        const klines = await klinesRes.json();

        if (!Array.isArray(klines) || klines.length < 60) {
            return res.status(400).json({ 
                success: false, 
                error: "Exchange Error: Strategy conditions not met yet. Waiting for strict FVG + EMA setup..." 
            });
        }

        const formattedCandles = klines.map(k => ({
            time: k[0],
            open: parseFloat(k[5]),
            high: parseFloat(k[3]),
            low: parseFloat(k[4]),
            close: parseFloat(k[2])
        }));

        const closes = formattedCandles.map(c => c.close);
        const ema50Array = calculateEMA(closes, 50);

        let validSetupFound = false;
        let matchedFvgTime = null;

        for (let i = 2; i < formattedCandles.length - 1; i++) {
            const c1 = formattedCandles[i - 2];
            const c2 = formattedCandles[i - 1];
            const c3 = formattedCandles[i];

            // Strict Bullish FVG Check: Gap between c1 high and c3 low with significant body size of c2
            if (c3.low > c1.high) {
                const fvgBottom = c1.high;
                const fvgTop = c3.low;
                const fvgSize = fvgTop - fvgBottom;
                const avgBody = Math.abs(c2.close - c2.open);

                if (fvgSize > 0 && avgBody > (fvgSize * 0.2)) {
                    const fvgTimestamp = c3.time;
                    let touchFound = false;
                    let targetTestCandle = null;
                    let targetEma = 0;

                    for (let j = i + 1; j < formattedCandles.length; j++) {
                        const testCandle = formattedCandles[j];
                        const currentEMA = ema50Array[j];
                        const touchedFvg = testCandle.low <= fvgTop && testCandle.high >= fvgBottom;

                        if (touchedFvg) {
                            touchFound = true;
                            targetTestCandle = testCandle;
                            targetEma = currentEMA;
                            break;
                        }
                    }

                    if (touchFound && targetTestCandle) {
                        const isGreen = targetTestCandle.close > targetTestCandle.open;
                        const nearEma = Math.abs(targetTestCandle.low - targetEma) / targetEma <= 0.008;

                        if (isGreen && nearEma) {
                            validSetupFound = true;
                            matchedFvgTime = fvgTimestamp;
                            break;
                        }
                    }
                }
            }
        }

        if (!validSetupFound) {
            return res.status(400).json({ 
                success: false, 
                error: "Exchange Error: Strategy conditions not met yet. No valid FVG + 50 EMA confluence found." 
            });
        }

        // Step 3: Execute Real Order on Gate.io
        await executeGateOrder(symbol, 'buy', 'market', rawQty);

        botState.isRunning = true;
        botState.symbol = symbol;
        botState.capital = rawQty;
        botState.lastTradedFvgTime = matchedFvgTime;

        res.json({ success: true, message: `Automated order successfully executed for ${symbol.replace('_', '')} with $${rawQty}!` });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message || 'Exchange Error: Failed to execute trade.' });
    }
});

app.post('/api/gate/close-all', async (req, res) => {
    try {
        botState.isRunning = false;
        if (botState.intervalId) clearInterval(botState.intervalId);

        const apiKey = DEFAULT_GATE_KEY;
        const apiSecret = DEFAULT_GATE_SECRET;
        if (!apiKey || !apiSecret) return res.status(400).json({ success: false, error: 'Exchange Error: API keys missing.' });

        const host = 'api.gateio.ws';
        const prefix = '/api/v4';
        const t = Math.floor(Date.now() / 1000).toString();

        const ordersUrl = '/spot/orders';
        const getSigStr = `GET\n${prefix + ordersUrl}\n\nstatus=open\n${t}`;
        const getSig = crypto.createHmac('sha512', apiSecret).update(getSigStr).digest('hex');

        const ordersRes = await fetch(`https://${host}${prefix}${ordersUrl}?status=open`, {
            method: 'GET',
            headers: { 'KEY': apiKey, 'Timestamp': t, 'SIGN': getSig, 'Accept': 'application/json' }
        });
        const openOrders = await ordersRes.json();

        if (Array.isArray(openOrders)) {
            for (const order of openOrders) {
                const delUrl = `/spot/orders/${order.id}?currency_pair=${order.currency_pair}`;
                const delT = Math.floor(Date.now() / 1000).toString();
                const delSigStr = `DELETE\n${prefix + delUrl}\n\n\n${delT}`;
                const delSig = crypto.createHmac('sha512', apiSecret).update(delSigStr).digest('hex');

                await fetch(`https://${host}${delUrl}`, {
                    method: 'DELETE',
                    headers: { 'KEY': apiKey, 'Timestamp': delT, 'SIGN': delSig, 'Accept': 'application/json' }
                });
            }
        }

        const accUrl = '/spot/accounts';
        const accT = Math.floor(Date.now() / 1000).toString();
        const accSigStr = `GET\n${prefix + accUrl}\n\n\n${accT}`;
        const accSig = crypto.createHmac('sha512', apiSecret).update(accSigStr).digest('hex');

        const accRes = await fetch(`https://${host}${prefix}${accUrl}`, {
            method: 'GET',
            headers: { 'KEY': apiKey, 'Timestamp': accT, 'SIGN': accSig, 'Accept': 'application/json' }
        });
        const accounts = await accRes.json();

        if (Array.isArray(accounts)) {
            for (const acc of accounts) {
                const availableBalance = parseFloat(acc.available || 0);
                const currency = acc.currency;
                if (currency !== 'USDT' && availableBalance > 0) {
                    const pair = `${currency}_USDT`;
                    try {
                        await executeGateOrder(pair, 'sell', 'market', availableBalance);
                    } catch (sellErr) {}
                }
            }
        }

        res.json({ success: true, message: 'Bot stopped successfully and active holdings sold.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

module.exports = app;
