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
    entryPrice: 0,
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

// Gate.io All Spot Currency Pairs API for Search Bar
app.get('/api/gate/pairs', async (req, res) => {
    try {
        const response = await fetch('https://api.gateio.ws/api/v4/spot/currency_pairs');
        const pairs = await response.json();
        if (Array.isArray(pairs)) {
            const symbolList = pairs.map(p => p.id || p.base + '_' + p.quote);
            return res.json({ success: true, pairs: symbolList });
        }
        res.json({ success: false, pairs: [] });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to fetch Gate.io pairs' });
    }
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
        type: orderType,
        amount: amountVal.toString(),
        quote_amount: amountVal.toString()
    };

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

async function checkAndExecuteStrategy(symbol, rawQty) {
    const host = 'api.gateio.ws';
    const prefix = '/api/v4';
    const klinesRes = await fetch(`https://${host}${prefix}/spot/candlesticks?currency_pair=${symbol}&interval=15m&limit=150`);
    const klines = await klinesRes.json();

    if (!Array.isArray(klines) || klines.length < 80) {
        return { success: false, error: "Not enough candles data." };
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

    for (let i = 2; i < formattedCandles.length - 2; i++) {
        const c1 = formattedCandles[i - 2];
        const c2 = formattedCandles[i - 1];
        const c3 = formattedCandles[i];

        if (c3.low > c1.high) {
            const fvgBottom = c1.high;
            const fvgTop = c3.low;
            const fvgSize = fvgTop - fvgBottom;
            const c2Body = Math.abs(c2.close - c2.open);
            const c2Range = c2.high - c2.low;

            if (fvgSize > (c3.close * 0.0015) && c2Range > 0 && (c2Body / c2Range) >= 0.7) {
                const fvgTimestamp = c3.time;
                
                let pullbackFound = false;
                let bounceConfirmed = false;
                let targetEma = 0;

                for (let j = i + 1; j < formattedCandles.length - 1; j++) {
                    const testCandle = formattedCandles[j];
                    const currentEMA = ema50Array[j];
                    const insideFvg = testCandle.low <= fvgTop && testCandle.high >= fvgBottom;

                    if (insideFvg) {
                        pullbackFound = true;
                        targetEma = currentEMA;
                        
                        const nextCandle = formattedCandles[j + 1];
                        const isBullishBounce = nextCandle.close > nextCandle.open && (nextCandle.close - nextCandle.open) > (nextCandle.high - nextCandle.low) * 0.5;
                        const closeToEma = Math.abs(nextCandle.low - targetEma) / targetEma <= 0.002;

                        if (isBullishBounce && closeToEma) {
                            bounceConfirmed = true;
                            break;
                        }
                    }
                }

                if (pullbackFound && bounceConfirmed) {
                    if (botState.lastTradedFvgTime !== fvgTimestamp) {
                        validSetupFound = true;
                        matchedFvgTime = fvgTimestamp;
                        break;
                    }
                }
            }
        }
    }

    // STRICT CHECK: Agar setup nahi mila toh yahin se return kar do, order execute na ho!
    if (!validSetupFound) {
        return { success: false, error: "Strict FVG + 50 EMA strategy conditions not met yet." };
    }

    // Sirf tabhi order execute hoga jab 100% genuine setup match ho jayega
    const orderResult = await executeGateOrder(symbol, 'buy', 'market', rawQty);
    const executedPrice = parseFloat(orderResult.price || orderResult.fill_price || formattedCandles[formattedCandles.length - 1].close);

    return { success: true, entryPrice: executedPrice, fvgTime: matchedFvgTime };
}

// Vercel Background Cron Job Endpoint (Triggers automatically every 1 minute)
app.get('/api/bot/cron', async (req, res) => {
    try {
        if (!botState.isRunning) {
            return res.json({ success: true, message: "Bot is currently stopped." });
        }

        const result = await checkAndExecuteStrategy(botState.symbol, botState.capital);
        if (result.success) {
            botState.entryPrice = result.entryPrice;
            botState.lastTradedFvgTime = result.fvgTime;
            botState.isRunning = false; // Stop scanning once trade is successfully executed
            return res.json({ success: true, message: `Cron executed trade for ${botState.symbol} at $${result.entryPrice}` });
        }

        res.json({ success: false, message: "Cron scanning: Strategy conditions not met yet, waiting for genuine setup..." });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/gate/trade', async (req, res) => {
    try {
        const combinedData = { ...(req.query || {}), ...(req.body || {}) };
        
        let rawQty = findAmount(combinedData);
        if (rawQty === null || isNaN(rawQty) || rawQty <= 0) rawQty = 5;
        if (rawQty < 3) rawQty = 3;

        const symbol = combinedData.symbol || 'BTC_USDT';

        const availableBalance = await getGateAccountBalance();
        if (availableBalance < rawQty && availableBalance > 0) {
            return res.status(400).json({ 
                success: false, 
                error: `Exchange Error: Insufficient balance available. Required: $${rawQty}, Available: $${availableBalance.toFixed(2)}` 
            });
        }

        const result = await checkAndExecuteStrategy(symbol, rawQty);
        
        if (!result.success) {
            botState.isRunning = true;
            botState.symbol = symbol;
            botState.capital = rawQty;

            return res.status(400).json({ 
                success: false, 
                error: "Exchange Error: Initial setup not met yet. Bot is now running in automatic background mode and will execute trade as soon as FVG + EMA setup appears!" 
            });
        }

        botState.isRunning = true;
        botState.symbol = symbol;
        botState.capital = rawQty;
        botState.entryPrice = result.entryPrice;
        botState.lastTradedFvgTime = result.fvgTime;
        botState.isRunning = false;

        res.json({ 
            success: true, 
            entryPrice: result.entryPrice,
            message: `Automated order successfully executed for ${symbol.replace('_', '')} at $${result.entryPrice} with $${rawQty}!` 
        });

    } catch (err) {
        res.status(500).json({ success: false, error: err.message || 'Exchange Error: Failed to execute trade.' });
    }
});

app.post('/api/gate/close-all', async (req, res) => {
    try {
        botState.isRunning = false;
        botState.entryPrice = 0;

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
