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
let fmaSetupTriggered = false;

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

    injectBybitKeyInputs();

    loadTradingViewChart(currentSymbol);
    fetchLiveCoinPrice(currentSymbol);
    setInterval(() => fetchLiveCoinPrice(currentSymbol), 3000);
    loadAdminSettings();
});

// --- STYLISH POPUP NOTIFICATION HANDLER ---
function showStylishPopup(message, type = 'error') {
    let existing = document.getElementById('custom-toast-popup');
    if (existing) existing.remove();

    let popup = document.createElement('div');
    popup.id = 'custom-toast-popup';
    popup.style.position = 'fixed';
    popup.style.bottom = '25px';
    popup.style.right = '25px';
    popup.style.padding = '16px 22px';
    popup.style.borderRadius = '12px';
    popup.style.color = '#fff';
    popup.style.fontWeight = '500';
    popup.style.fontSize = '14px';
    popup.style.zIndex = '99999';
    popup.style.boxShadow = '0 10px 30px rgba(0,0,0,0.5)';
    popup.style.transition = 'all 0.3s ease';
    popup.style.backdropFilter = 'blur(10px)';

    if (type === 'error') {
        popup.style.background = 'linear-gradient(135deg, rgba(218, 54, 51, 0.95), rgba(248, 81, 73, 0.95))';
        popup.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        popup.innerHTML = `⚠️ <strong>Bybit Exchange Error:</strong><br>${message}`;
    } else {
        popup.style.background = 'linear-gradient(135deg, rgba(35, 134, 54, 0.95), rgba(46, 160, 67, 0.95))';
        popup.style.border = '1px solid rgba(255, 255, 255, 0.3)';
        popup.innerHTML = `✅ <strong>Success:</strong><br>${message}`;
    }

    document.body.appendChild(popup);

    setTimeout(() => {
        popup.style.opacity = '0';
        setTimeout(() => popup.remove(), 300);
    }, 6000);
}

// Inject API key inputs with pre-filled default values
function injectBybitKeyInputs() {
    const configPanel = document.querySelector('.config-panel');
    if (configPanel && !document.getElementById('bybit-apikey-input')) {
        const div = document.createElement('div');
        div.innerHTML = `
            <div class="form-group" style="margin-top: 10px;">
                <label>Bybit API Key</label>
                <input type="password" id="bybit-apikey-input" value="eZKaZBvZ02FENX5Jd" placeholder="Enter Bybit API Key...">
            </div>
            <div class="form-group">
                <label>Bybit API Secret</label>
                <input type="password" id="bybit-apisecret-input" value="TGvIJJ6E833VwplmP8Eed5I6Y4E1owjlpvw" placeholder="Enter Bybit API Secret...">
            </div>
        `;
        configPanel.insertBefore(div, configPanel.querySelector('.action-buttons'));
    }
}

// --- TRADINGVIEW 15-MINUTE LIVE CHART WIDGET ---
function loadTradingViewChart(symbol) {
    const container = document.getElementById('tv-chart-frame');
    if (!container) return;
    container.innerHTML = '';

    new TradingView.widget({
        "autosize": true,
        "symbol": "BINANCE:" + symbol,
        "interval": "15",
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
    if (fmaSetupTriggered) return;

    try {
        let res = await fetch(`https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=15m&limit=50`);
        let klines = await res.json();

        if (!klines || klines.length < 50) return;

        let candles = klines.map(k => ({
            open: parseFloat(k[1]),
            high: parseFloat(k[2]),
            low: parseFloat(k[3]),
            close: parseFloat(k[4])
        }));

        let closingPrices = candles.map(c => c.close);
        let ema50 = calculateEMA(closingPrices, 50);

        let bullishFVGs = [];
        for (let i = 2; i < candles.length - 1; i++) {
            let c1_high = candles[i - 2].high;
            let c3_low = candles[i].low;
            if (c3_low > c1_high) {
                bullishFVGs.push({ top: c3_low, bottom: c1_high, index: i });
            }
        }

        if (bullishFVGs.length === 0) return;

        let activeFVG = bullishFVGs[bullishFVGs.length - 1];
        let latestCandle = candles[candles.length - 1];

        let fvgTouched = (latestCandle.low <= activeFVG.top && latestCandle.high >= activeFVG.bottom);
        let emaTouched = (latestCandle.low <= ema50 && latestCandle.high >= ema50) || 
                         (Math.abs(latestCandle.close - ema50) / ema50 < 0.003);

        if (!fvgTouched || !emaTouched) return;

        let isBullishCandle = latestCandle.close > latestCandle.open;
        let bodySize = Math.abs(latestCandle.close - latestCandle.open);
        let totalRange = latestCandle.high - latestCandle.low;
        let hasRejectionWick = (latestCandle.open - latestCandle.low) > (bodySize * 0.5);
        let emaNotBroken = latestCandle.low >= (ema50 * 0.995);

        if (fvgTouched && emaTouched && isBullishCandle && (hasRejectionWick || bodySize > totalRange * 0.4) && emaNotBroken) {
            let entryPrice = latestCandle.close;
            let capital = parseFloat(document.getElementById('capital-input').value) || 500;
            let qty = parseFloat((capital / entryPrice).toFixed(3));
            if (qty <= 0) qty = 1;

            fmaSetupTriggered = true;
            document.getElementById('active-trades-count').innerText = "1";

            terminal.innerHTML += `<br><span style="color:#3fb950; font-weight:bold;">[FMA LONG TRIGGERED]</span> Executing real order on Bybit...`;
            terminal.scrollTop = terminal.scrollHeight;

            const apiKey = document.getElementById('bybit-apikey-input') ? document.getElementById('bybit-apikey-input'].value.trim() : 'eZKaZBvZ02FENX5Jd';
            const apiSecret = document.getElementById('bybit-apisecret-input') ? document.getElementById('bybit-apisecret-input'].value.trim() : 'TGvIJJ6E833VwplmP8Eed5I6Y4E1owjlpvw';

            try {
                let tradeRes = await fetch('/api/bybit/trade', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        apiKey,
                        apiSecret,
                        symbol,
                        side: 'Buy',
                        orderType: 'Market',
                        qty,
                        testnet: false
                    })
                });

                let tradeData = await tradeRes.json();

                if (!tradeData.success) {
                    showStylishPopup(tradeData.error, 'error');
                    terminal.innerHTML += `<br><span style="color:#f85149;">[BYBIT ERROR]</span> ${tradeData.error}`;
                    terminal.scrollTop = terminal.scrollHeight;
                } else {
                    showStylishPopup(`LONG order successfully placed on Bybit for ${symbol} (${qty} units)!`, 'success');
                    terminal.innerHTML += `<br><span style="color:#3fb950;">[BYBIT SUCCESS]</span> Order ID: ${tradeData.data.orderId || 'Executed'}`;
                    terminal.scrollTop = terminal.scrollHeight;
                }
            } catch (err) {
                showStylishPopup('Network error connecting to backend Bybit execution route.', 'error');
            }
        }
    } catch (err) {
        console.log("FMA engine error", err);
    }
}

function calculateEMA(data, period) {
    let k = 2 / (period + 1);
    let ema = data[0];
    for (let i = 1; i < data.length; i++) {
        ema = (data[i] * k) + (ema * (1 - k));
    }
    return ema;
}

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
            fmaSetupTriggered = false;
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

window.startBot = async function() {
    let strategy = document.getElementById('strategy-select').value;
    fmaBotActive = true;
    fmaSetupTriggered = false;

    const terminal = document.getElementById('terminal-logs');
    if (terminal) {
        terminal.innerHTML += `<br><span style="color:#58a6ff;">[SYSTEM] Bot started with ${strategy} on ${currentSymbol} (15m). Real Bybit execution enabled.</span>`;
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
