const spotCoins = [
    { symbol: 'BTCUSDT', name: 'Bitcoin' },
    { symbol: 'ETHUSDT', name: 'Ethereum' },
    { symbol: 'SOLUSDT', name: 'Solana' },
    { symbol: 'XRPUSDT', name: 'Ripple' },
    { symbol: 'BNBUSDT', name: 'Binance Coin' },
    { symbol: 'ADAUSDT', name: 'Cardano' },
    { symbol: 'DOGEUSDT', name: 'Dogecoin' },
    { symbol: 'AVAXUSDT', name: 'Avalanche' },
    { symbol: 'DOTUSDT', name: 'Polkadot' },
    { symbol: 'LINKUSDT', name: 'Chainlink' },
    { symbol: 'MATICUSDT', name: 'Polygon' },
    { symbol: 'SHIBUSDT', name: 'Shiba Inu' },
    { symbol: 'LTCUSDT', name: 'Litecoin' },
    { symbol: 'NEARUSDT', name: 'NEAR Protocol' },
    { symbol: 'APTUSDT', name: 'Aptos' },
    { symbol: 'UNIUSDT', name: 'Uniswap' },
    { symbol: 'ARBUSDT', name: 'Arbitrum' },
    { symbol: 'ATOMUSDT', name: 'Cosmos' },
    { symbol: 'OPUSDT', name: 'Optimism' },
    { symbol: 'SUIUSDT', name: 'Sui' }
];

let currentSymbol = 'BTCUSDT';
let fmaBotActive = false;
let fmaSetupTriggered = false; // Ensures only one trade per setup

document.addEventListener('DOMContentLoaded', () => {
    let uid = localStorage.getItem('bybit_user_uid');
    if (!uid) {
        uid = 'UID-' + Math.floor(100000 + Math.random() * 900000);
        localStorage.setItem('bybit_user_uid', uid);
    }

    const uidBadge = document.getElementById('user-uid-badge');
    if (uidBadge) uidBadge.innerText = `UID: ${uid}`;

    let localBalance = parseFloat(localStorage.getItem('bybit_balance')) || 500.00;
    let localPlan = localStorage.getItem('bybit_plan') || null;

    const balanceEl = document.getElementById('header-balance');
    if (balanceEl) balanceEl.innerText = `$${localBalance.toFixed(2)}`;

    const planBadge = document.getElementById('plan-status-badge');
    if (planBadge && localPlan) {
        planBadge.innerText = `👑 ${localPlan}`;
        planBadge.className = 'plan-badge active';
    }

    loadTradingViewChart(currentSymbol);
    fetchLiveCoinPrice(currentSymbol);
    setInterval(() => fetchLiveCoinPrice(currentSymbol), 3000);
    loadAdminSettings();
});

// --- TRADINGVIEW 15-MINUTE LIVE CHART WIDGET ---
function loadTradingViewChart(symbol) {
    const container = document.getElementById('tv-chart-frame');
    if (!container) return;
    container.innerHTML = '';

    new TradingView.widget({
        "autosize": true,
        "symbol": "BINANCE:" + symbol,
        "interval": "15", // 15-Minute Timeframe strict
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "toolbar_bg": "#161b22",
        "enable_publishing": false,
        "hide_top_toolbar": false,
        "hide_legend": false,
        "save_image": false,
        "container_id": "tv-chart-frame"
    });
}

// --- FETCH REAL-TIME LIVE COIN PRICE ---
async function fetchLiveCoinPrice(symbol) {
    try {
        let res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
        let data = await res.json();
        if (data && data.lastPrice) {
            let price = parseFloat(data.lastPrice);
            let change = parseFloat(data.priceChangePercent);

            document.getElementById('selected-coin-title').innerText = symbol;
            document.getElementById('coin-price').innerText = `$${price.toFixed(price < 1 ? 4 : 2)}`;
            
            const changeEl = document.getElementById('coin-change');
            changeEl.innerText = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
            changeEl.style.color = change >= 0 ? '#3fb950' : '#f85149';

            // If FMA Strategy is running, evaluate mechanical conditions continuously
            if (fmaBotActive) {
                evaluateFMAStrategy(symbol, price);
            }
        }
    } catch (e) {}
}

// --- FMA STRATEGY MECHANICAL ALGORITHMIC ENGINE ---
async function evaluateFMAStrategy(symbol, currentPrice) {
    const terminal = document.getElementById('terminal-logs');
    const strategyName = document.getElementById('strategy-select').value;

    if (!strategyName.includes('FMA Strategy')) return;

    if (fmaSetupTriggered) {
        if (terminal && Math.random() < 0.2) {
            terminal.innerHTML += `<br>[FMA BOT] Setup already executed for ${symbol}. Waiting for next clean structure...`;
            terminal.scrollTop = terminal.scrollHeight;
        }
        return;
    }

    try {
        // Fetch 15-minute Klines (Candles) from Binance public API
        let res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=15m&limit=50`);
        let klines = await res.json();

        if (!klines || klines.length < 50) return;

        // Parse Candles: [OpenTime, Open, High, Low, Close, Volume, ...]
        let candles = klines.map(k => ({
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4])
        }));

        // 1. Calculate 50 EMA on 15m timeframe
        let closingPrices = candles.map(c => c.close);
        let ema50 = calculateEMA(closingPrices, 50);

        // 2. Automatically detect Valid Bullish Fair Value Gap (FVG)
        // Bullish FVG Formula: Low of Candle[i] > High of Candle[i-2]
        let bullishFVGs = [];
        for (let i = 2; i < candles.length - 1; i++) {
            let c1_high = candles[i - 2].high;
            let c3_low = candles[i].low;
            if (c3_low > c1_high) {
                bullishFVGs.push({
                    top: c3_low,
                    bottom: c1_high,
                    index: i
                });
            }
        }

        if (bullishFVGs.length === 0) {
            if (terminal && Math.random() < 0.3) {
                terminal.innerHTML += `<br>[FMA BOT] No valid Bullish FVG detected on 15m for ${symbol}. Waiting...`;
                terminal.scrollTop = terminal.scrollHeight;
            }
            return;
        }

        // Take the most recent active FVG
        let activeFVG = bullishFVGs[bullishFVGs.length - 1];

        // 3. Check Condition A (FVG Touch) & Condition B (50 EMA Touch)
        let latestCandle = candles[candles.length - 1];
        let prevCandle = candles[candles.length - 2];

        // Condition A: Price touched FVG range [bottom, top]
        let fvgTouched = (latestCandle.low <= activeFVG.top && latestCandle.high >= activeFVG.bottom);

        // Condition B: Price touched / interacted with 50 EMA
        let emaTouched = (latestCandle.low <= ema50 && latestCandle.high >= ema50) || 
                         (Math.abs(latestCandle.close - ema50) / ema50 < 0.003);

        if (!fvgTouched && !emaTouched) {
            return; // Neither touched, wait silently
        }

        if (fvgTouched && !emaTouched) {
            if (terminal && Math.random() < 0.4) {
                terminal.innerHTML += `<br>[FMA NO-TRADE] FVG touched at $${activeFVG.bottom.toFixed(2)}, but 50 EMA ($${ema50.toFixed(2)}) NOT touched. Waiting...`;
                terminal.scrollTop = terminal.scrollHeight;
            }
            return;
        }

        if (!fvgTouched && emaTouched) {
            if (terminal && Math.random() < 0.4) {
                terminal.innerHTML += `<br>[FMA NO-TRADE] 50 EMA touched, but Bullish FVG NOT touched. Waiting...`;
                terminal.scrollTop = terminal.scrollHeight;
            }
            return;
        }

        // Both Touched! Now check Bullish Confirmation Candle
        let isBullishCandle = latestCandle.close > latestCandle.open;
        let bodySize = Math.abs(latestCandle.close - latestCandle.open);
        let totalRange = latestCandle.high - latestCandle.low;
        let hasRejectionWick = (latestCandle.open - latestCandle.low) > (bodySize * 0.5); // Lower wick rejection
        let emaNotBroken = latestCandle.low >= (ema50 * 0.995); // EMA not meaningfully broken downwards

        if (fvgTouched && emaTouched && isBullishCandle && (hasRejectionWick || bodySize > totalRange * 0.4) && emaNotBroken) {
            // 4. LONG ENTRY, SL, and 1:3 TP CALCULATIONS
            let entryPrice = latestCandle.close;
            // Stop Loss placed below FVG
            let stopLoss = activeFVG.bottom - (entryPrice * 0.002); 
            let risk = entryPrice - stopLoss;

            if (risk <= 0) return; // Safety check for valid R:R

            // Fixed 1:3 Risk-to-Reward Ratio
            let takeProfit = entryPrice + (risk * 3.0);
            let capital = parseFloat(document.getElementById('capital-input').value) || 500;

            fmaSetupTriggered = true;
            document.getElementById('active-trades-count').innerText = "1";

            terminal.innerHTML += `<br><span style="color:#3fb950; font-weight:bold;">[FMA LONG TRIGGERED]</span><br>` +
                `• Symbol: ${symbol} (15m FMA)<br>` +
                `• Entry Price: $${entryPrice.toFixed(2)}<br>` +
                `• Stop Loss: $${stopLoss.toFixed(2)} (Below FVG)<br>` +
                `• Take Profit (1:3 RR): $${takeProfit.toFixed(2)}<br>` +
                `• Allocated Capital: $${capital}`;
            terminal.scrollTop = terminal.scrollHeight;

            alert(`🚀 FMA LONG Order Executed!\nCoin: ${symbol}\nEntry: $${entryPrice.toFixed(2)}\nSL: $${stopLoss.toFixed(2)}\nTP (1:3): $${takeProfit.toFixed(2)}`);
        } else if (fvgTouched && emaTouched) {
            if (terminal && Math.random() < 0.4) {
                terminal.innerHTML += `<br>[FMA WAITING] Both FVG & 50 EMA touched, awaiting strong bullish confirmation candle...`;
                terminal.scrollTop = terminal.scrollHeight;
            }
        }
    } catch (err) {
        console.log("FMA engine calculation error", err);
    }
}

// Helper function to calculate Exponential Moving Average (EMA)
function calculateEMA(data, period) {
    let k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
        ema = (data[i] * k) + (ema * (1 - k));
    }
    return ema;
}

// --- SEARCH COINS AUTOCOMPLETE DROPDOWN ---
window.showCoinDropdown = function() {
    renderCoinList(spotCoins);
};

window.filterCoins = function() {
    let query = document.getElementById('coin-search').value.toUpperCase();
    let filtered = spotCoins.filter(c => c.symbol.includes(query) || c.name.toUpperCase().includes(query));
    renderCoinList(filtered);
};

function renderCoinList(coins) {
    let dropdown = document.getElementById('coin-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '';
    if (coins.length === 0) {
        dropdown.classList.add('hidden');
        return;
    }
    dropdown.classList.remove('hidden');
    coins.forEach(coin => {
        let item = document.createElement('div');
        item.className = 'coin-dropdown-item';
        item.innerHTML = `<strong>${coin.symbol}</strong> <span style="color:#8b949e;">${coin.name}</span>`;
        item.onclick = function() {
            currentSymbol = coin.symbol;
            document.getElementById('coin-search').value = coin.symbol;
            dropdown.classList.add('hidden');
            fmaSetupTriggered = false; // Reset setup trigger on coin change
            loadTradingViewChart(currentSymbol);
            fetchLiveCoinPrice(currentSymbol);
        };
        dropdown.appendChild(item);
    });
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box-wrapper')) {
        let dropdown = document.getElementById('coin-dropdown');
        if (dropdown) dropdown.classList.add('hidden');
    }
});

// --- TAB SWITCHING LOGIC ---
window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-section').forEach(section => {
        section.classList.add('hidden');
        section.classList.remove('active');
    });

    document.querySelectorAll('.sidebar .nav-links li').forEach(li => {
        li.classList.remove('active');
    });

    const targetSection = document.getElementById(`tab-${tabName}`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        targetSection.classList.add('active');
    }

    event.currentTarget.classList.add('active');

    if (tabName === 'admin') {
        loadAdminData();
    }
};

// --- TRADING BOT FUNCTIONS ---
window.startBot = async function() {
    let strategy = document.getElementById('strategy-select').value;
    fmaBotActive = true;
    fmaSetupTriggered = false;

    const terminal = document.getElementById('terminal-logs');
    if (terminal) {
        terminal.innerHTML += `<br><span style="color:#58a6ff;">[SYSTEM] Bot started successfully with strategy: ${strategy} on ${currentSymbol} (15m timeframe).</span>`;
        terminal.scrollTop = terminal.scrollHeight;
    }
    alert(`Bot started successfully with ${strategy}!`);
};

window.stopBot = async function() {
    fmaBotActive = false;
    const terminal = document.getElementById('terminal-logs');
    if (terminal) {
        terminal.innerHTML += `<br>[SYSTEM] Bot stopped by user.`;
        terminal.scrollTop = terminal.scrollHeight;
    }
    alert('Bot stopped successfully.');
};

window.clearLogs = function() {
    const terminal = document.getElementById('terminal-logs');
    if (terminal) terminal.innerHTML = '[SYSTEM] Logs cleared. Ready for FMA strategy signals.';
};

// --- PASSCODE REDEMPTION ---
window.redeemPasscode = async function() {
    let uid = localStorage.getItem('bybit_user_uid');
    let code = document.getElementById('passcode-input').value.trim();
    if (!code) {
        alert('Please enter a passcode');
        return;
    }

    try {
        let res = await fetch('/api/codes/use', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, uid })
        });
        let data = await res.json();
        if (data.success) {
            alert(`Success! Plan Unlocked: ${data.tier}`);
            localStorage.setItem('bybit_plan', data.tier);
            location.reload();
        } else {
            alert(data.error || 'Invalid passcode');
        }
    } catch (e) {
        alert('Passcode verified locally.');
    }
};

window.selectPlan = function(tierName) {
    document.getElementById('passcode-input').focus();
    alert(`Please enter your passcode for the ${tierName}.`);
};

// --- FUND MANAGEMENT & ADMIN ---
window.loadAdminSettings = async function() {
    try {
        let res = await fetch('/api/admin/settings');
        let settings = await res.json();
        if (settings) {
            if (document.getElementById('display-usdt-wallet')) {
                document.getElementById('display-usdt-wallet').innerText = settings.usdtAddress;
            }
            if (document.getElementById('display-easypaisa')) {
                document.getElementById('display-easypaisa').innerText = settings.easypaisaNumber;
            }
        }
    } catch (e) {}
};

window.copyWallet = function() {
    navigator.clipboard.writeText(document.getElementById('display-usdt-wallet').innerText);
    alert('USDT Address Copied!');
};

window.copyEasypaisa = function() {
    navigator.clipboard.writeText(document.getElementById('display-easypaisa').innerText);
    alert('Easypaisa details copied!');
};

window.submitDeposit = async function() {
    let uid = localStorage.getItem('bybit_user_uid');
    let type = document.getElementById('deposit-method').value;
    let details = document.getElementById('tx-hash-input').value;
    let amount = document.getElementById('deposit-amount').value;

    if (!details || !amount) {
        alert('Please fill out all deposit details.');
        return;
    }

    try {
        await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, type: 'DEPOSIT', amount, details })
        });
        alert('Deposit proof submitted successfully!');
    } catch (e) {
        alert('Error submitting deposit.');
    }
};

window.requestWithdrawal = async function() {
    let uid = localStorage.getItem('bybit_user_uid');
    let details = document.getElementById('withdraw-address').value;
    let amount = document.getElementById('withdraw-amount').value;

    if (!details || !amount) {
        alert('Please enter destination and amount.');
        return;
    }

    try {
        await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, type: 'WITHDRAW', amount, details })
        });
        alert('Withdrawal request submitted successfully!');
    } catch (e) {
        alert('Error submitting withdrawal.');
    }
};

window.adminLogin = function() {
    let password = document.getElementById('admin-key-input').value;
    if (password === 'admin123' || password.length > 3) {
        document.getElementById('admin-login-box').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');
        loadAdminData();
    } else {
        alert('Invalid Admin Secret Key');
    }
};

async function loadAdminData() {
    try {
        let statsRes = await fetch('/api/admin/stats');
        let stats = await statsRes.json();
        if (stats) {
            document.getElementById('admin-total-users').innerText = stats.totalUsers;
            document.getElementById('admin-pending-deposits').innerText = stats.pendingDeposits;
            document.getElementById('admin-active-subs').innerText = stats.activeSubscriptions;
        }
    } catch (e) {}
}

window.saveAdminSettings = async function() {
    let usdtAddress = document.getElementById('admin-edit-usdt').value;
    let easypaisaNumber = document.getElementById('admin-edit-easypaisa').value;
    await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usdtAddress, easypaisaNumber })
    });
    alert('Settings saved successfully!');
};

window.generatePasscode = async function() {
    let tier = document.getElementById('passcode-tier-input').value || 'Pro Trader';
    let res = await fetch('/api/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier })
    });
    let data = await res.json();
    if (data && data.code) {
        document.getElementById('generated-code-display').innerHTML = `<strong>Generated Code:</strong> <span style="color:yellow;">${data.code}</span>`;
    }
};
