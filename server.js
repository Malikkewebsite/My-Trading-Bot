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

// Bot State Management with Repeat Trade & Fresh FVG Protection
let botState = {
    isRunning: false,
    symbol: 'BTC_USDT',
    capital: 5,
    intervalId: null,
    lastTradedFvgTime: null // Purane ya already traded setup ko dubara trade karne se rokne ke liye
};

app.get('/', (req, res) => {
    try {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } catch (err) {
        res.status(500).send('Frontend index.html not found.');
    }
});

app.get('/api/settings', (req, res) => {
    jsonResponse(res, { success: true, depositAddress: process.env.DEPOSIT_ADDRESS || 'TYourTRC20DepositWalletAddressHere12345' });
});

app.get('/api/deposit/info', (req, res) => {
    jsonResponse(res, { success: true, address: process.env.DEPOSIT_ADDRESS || 'TYourTRC20DepositWalletAddressHere12345' });
});

app.post('/api/admin/passcode', (req, res) => {
    const { plan } = req.body || {};
    const randomCode = 'VIP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    jsonResponse(res, { success: true, passcode: randomCode, plan: plan || 'Starter Plan' });
});

app.post('/api/admin/generate', (req, res) => {
    const randomCode = 'VIP-' + crypto.randomBytes(4).toString('hex').toUpperCase();
    jsonResponse(res, { success: true, passcode: randomCode });
});

function jsonResponse(res, data) {
    res.json(data);
}

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

// Calculate Exponential Moving Average (EMA)
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

// Helper function to execute Gate.io order
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
        throw new Error(`Exchange raw response error: ${textResponse.substring(0, 100)}`);
    }

    if (response.status !== 200 && response.status !== 201) {
        throw new Error(data.message || JSON.stringify(data));
    }
    return data;
}

// 1. Start Bot & Run Algorithmic FVG (Unmitigated) + 50 EMA Strategy
app.post('/api/gate/trade', async (req, res) => {
    try {
        const combinedData = { ...(req.query || {}), ...(req.body || {}) };
        const apiKey = DEFAULT_GATE_KEY;
        const apiSecret = DEFAULT_GATE_SECRET;

        if (!apiKey || !apiSecret) {
            return res.status(400).json({ success: false, error: 'Environment variables API keys are missing.' });
        }

        let rawQty = findAmount(combinedData);
        if (rawQty === null || isNaN(rawQty) || rawQty <= 0) rawQty = 5;
        if (rawQty < 3) rawQty = 3;

        const symbol = combinedData.symbol || 'BTC_USDT';

        if (botState.isRunning) {
            return res.json({ success: true, message: 'Bot is already running and monitoring fresh FVG + 50 EMA strategy.' });
        }

        botState.isRunning = true;
        botState.symbol = symbol;
        botState.capital = rawQty;

        console.log(`[BOT STARTED] Monitoring 15m chart for ${symbol} using strict Unmitigated FVG + 50 EMA Strategy...`);

        // Algorithmic Strategy Loop
        botState.intervalId = setInterval(async () => {
            if (!botState.isRunning) {
                clearInterval(botState.intervalId);
                return;
            }

            try {
                const host = 'api.gateio.ws';
                const prefix = '/api/v4';
                const klinesRes = await fetch(`https://${host}${prefix}/spot/candlesticks?currency_pair=${botState.symbol}&interval=15m&limit=100`);
                const klines = await klinesRes.json();

                if (!Array.isArray(klines) || klines.length < 55) {
                    console.log("[NO TRADE] Insufficient candle data for analysis.");
                    return;
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

                // Step 2 & Unmitigated Rule: Detect Bullish FVG
                for (let i = 2; i < formattedCandles.length - 1; i++) {
                    const c1 = formattedCandles[i - 2];
                    const c3 = formattedCandles[i];

                    if (c3.low > c1.high) {
                        const fvgBottom = c1.high;
                        const fvgTop = c3.low;
                        const fvgTimestamp = c3.time;

                        // Agar yeh FVG pehle hi trade ho chuka hai, toh isko skip kardein (Repeat Trade Protection)
                        if (botState.lastTradedFvgTime === fvgTimestamp) {
                            continue;
                        }

                        // Check if FVG was already mitigated (touched/crossed) before our target test candle
                        let isAlreadyMitigatedBefore = false;
                        let touchFound = false;
                        let targetTestCandle = null;
                        let targetEma = 0;

                        for (let j = i + 1; j < formattedCandles.length; j++) {
                            const testCandle = formattedCandles[j];
                            const currentEMA = ema50Array[j];

                            const touchedFvg = testCandle.low <= fvgTop && testCandle.high >= fvgBottom;

                            if (!touchFound) {
                                if (touchedFvg) {
                                    // Yeh pehla touch hai, matlab FVG unmitigated tha aur abhi test hua hai!
                                    touchFound = true;
                                    targetTestCandle = testCandle;
                                    targetEma = currentEMA;
                                }
                            } else {
                                // Agar pehle touch ke baad koi aur candle aayi aur usne FVG ko cross kar liya bina proper setup ke, toh mitigated maana jayega
                                if (testCandle.low < fvgBottom) {
                                    isAlreadyMitigatedBefore = true;
                                    break;
                                }
                            }
                        }

                        if (touchFound && !isAlreadyMitigatedBefore && targetTestCandle) {
                            // Condition A & B: Check FVG touch and 50 EMA touch simultaneously
                            const touchedFvgNow = targetTestCandle.low <= fvgTop && targetTestCandle.high >= fvgBottom;
                            const touchedEmaNow = Math.abs(targetTestCandle.low - targetEma) / targetEma <= 0.003 || 
                                                  (targetTestCandle.low <= targetEma && targetTestCandle.high >= targetEma);

                            if (touchedFvgNow && touchedEmaNow) {
                                // Step 5: Bullish Confirmation Candle Check
                                const isGreen = targetTestCandle.close > targetTestCandle.open;
                                const emaNotBroken = targetTestCandle.low >= (targetEma * 0.995);

                                if (isGreen && emaNotBroken) {
                                    validSetupFound = true;
                                    matchedFvgTime = fvgTimestamp;
                                    break;
                                }
                            }
                        }
                    }
                    if (validSetupFound) break;
                }

                if (!validSetupFound) {
                    console.log("[NO TRADE / CONDITION NOT MET] No fresh unmitigated FVG + 50 EMA touch & confirmation found.");
                    return;
                }

                console.log(`[SETUP MET] Fresh unmitigated FVG & 50 EMA criteria satisfied. Executing LONG entry...`);

                // Save this FVG timestamp so it never triggers twice
                botState.lastTradedFvgTime = matchedFvgTime;

                // Execute LONG Entry
                await executeGateOrder(botState.symbol, 'buy', 'market', botState.capital);
                
                botState.isRunning = false;
                clearInterval(botState.intervalId);

            } catch (loopErr) {
                console.error("Strategy Loop Error:", loopErr.message);
            }
        }, 15000);

        jsonResponse(res, { 
            success: true, 
            message: 'Bot started successfully. Monitoring fresh unmitigated FVG and 50 EMA strategy conditions...' 
        });

    } catch (err) {
        botState.isRunning = false;
        res.status(500).json({ success: false, error: err.message || 'Failed to start bot.' });
    }
});

// 2. Stop Bot & Sell All Open Quantities Endpoint
app.post('/api/gate/close-all', async (req, res) => {
    try {
        botState.isRunning = false;
        if (botState.intervalId) {
            clearInterval(botState.intervalId);
        }

        const apiKey = DEFAULT_GATE_KEY;
        const apiSecret = DEFAULT_GATE_SECRET;

        if (!apiKey || !apiSecret) {
            return res.status(400).json({ success: false, error: 'API keys missing.' });
        }

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
                        console.log(`[EMERGENCY SELL] Sold ${availableBalance} of ${currency} due to Bot Stop.`);
                    } catch (sellErr) {
                        console.error(`Failed to sell ${currency}:`, sellErr.message);
                    }
                }
            }
        }

        jsonResponse(res, { success: true, message: 'Bot stopped successfully. All open orders canceled and coin quantities sold.' });
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
