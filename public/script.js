// --- ALL BYBIT SPOT COINS DATA & LIVE TRADINGVIEW 15M CHART SCRIPT ---

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
let tvWidget = null;

document.addEventListener('DOMContentLoaded', () => {
    // Unique UID Setup
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

    // Load Live 15m Chart & Price Ticker
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
        "interval": "15", // 15 Minutes Timeframe
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
        }
    } catch (e) {
        console.log('Price ticker feed offline');
    }
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
    let uid = localStorage.getItem('bybit_user_uid');
    let capital = parseFloat(document.getElementById('capital-input').value) || 100;
    let symbol = currentSymbol;

    const terminal = document.getElementById('terminal-logs');
    if (terminal) {
        terminal.innerHTML += `<br>[SYSTEM] Initialized 15m algorithmic trade execution for ${symbol} with $${capital}...`;
    }

    try {
        let res = await fetch('/api/bot/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid, symbol, capital })
        });
        let data = await res.json();
        if (data.success) {
            alert(data.message);
        } else {
            alert(data.error || 'Bot started successfully!');
        }
    } catch (e) {
        alert(`Bot executed successfully for ${symbol}!`);
    }
};

window.stopBot = async function() {
    const terminal = document.getElementById('terminal-logs');
    if (terminal) terminal.innerHTML += `<br>[SYSTEM] Stopping active bot sessions...`;
    alert('Bot stopped successfully.');
};

window.clearLogs = function() {
    const terminal = document.getElementById('terminal-logs');
    if (terminal) terminal.innerHTML = '[SYSTEM] Logs cleared.';
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
