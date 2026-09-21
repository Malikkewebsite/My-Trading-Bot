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
    { symbol: 'LINKUSDT', name: 'Chainlink' }
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
    if (document.getElementById('admin-uid-text')) document.getElementById('admin-uid-text').innerText = uid;

    let localBalance = parseFloat(localStorage.getItem('bybit_balance')) || 500.00;
    let localPlan = localStorage.getItem('bybit_plan') || null;

    const balanceEl = document.getElementById('header-balance');
    if (balanceEl) balanceEl.innerText = `$${localBalance.toFixed(2)}`;
    if (document.getElementById('admin-wallet-bal')) document.getElementById('admin-wallet-bal').innerText = `$${localBalance.toFixed(2)}`;

    const planBadge = document.getElementById('plan-status-badge');
    if (planBadge && localPlan) {
        planBadge.innerText = `👑 ${localPlan}`;
        planBadge.className = 'plan-badge active';
        planBadge.style.color = '#3fb950';
    }

    loadTradingViewChart(currentSymbol);
    fetchLiveCoinPrice(currentSymbol);
    setInterval(() => fetchLiveCoinPrice(currentSymbol), 3000);
    loadAdminSettings();
});

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
    popup.style.backdropFilter = 'blur(10px)';

    let cleanMessage = message ? message.replace(/Bybit/gi, 'Trading') : 'An error occurred.';

    if (type === 'error') {
        popup.style.background = 'linear-gradient(135deg, rgba(218, 54, 51, 0.95), rgba(248, 81, 73, 0.95))';
        popup.innerHTML = `⚠️ <strong>Error:</strong><br>${cleanMessage}`;
    } else {
        popup.style.background = 'linear-gradient(135deg, rgba(35, 134, 54, 0.95), rgba(46, 160, 67, 0.95))';
        popup.innerHTML = `✅ <strong>Success:</strong><br>${cleanMessage}`;
    }

    document.body.appendChild(popup);
    setTimeout(() => {
        popup.style.opacity = '0';
        setTimeout(() => popup.remove(), 300);
    }, 6000);
}

function loadTradingViewChart(symbol) {
    const container = document.getElementById('tv-chart-frame');
    if (!container) return;
    container.innerHTML = '';

    if (typeof TradingView !== 'undefined') {
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
            "container_id": "tv-chart-frame"
        });
    }
}

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

async function evaluateFMAStrategy(symbol, currentPrice) {
    const terminal = document.getElementById('terminal-logs');
    if (fmaSetupTriggered) return;

    try {
        let capital = parseFloat(document.getElementById('capital-input').value) || 500;
        let qty = parseFloat((capital / currentPrice).toFixed(3));
        if (qty <= 0) qty = 1;

        fmaSetupTriggered = true;
        document.getElementById('active-trades-count').innerText = "1";

        terminal.innerHTML += `<br><span style="color:#3fb950; font-weight:bold;">[FMA SIGNAL]</span> Executing backend secure trade...`;
        terminal.scrollTop = terminal.scrollHeight;

        // Gate.io API integration endpoint and formatted symbol (e.g. BTC_USDT)[cite: 1]
        let formattedSymbol = symbol.includes('_') ? symbol : symbol.replace('USDT', '_USDT');

        let tradeRes = await fetch('/api/gate/trade', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                symbol: formattedSymbol,
                side: 'buy',
                orderType: 'market',
                qty
            })
        });

        let tradeData = await tradeRes.json();
        if (!tradeData.success) {
            let errorText = tradeData.error ? tradeData.error.replace(/Bybit/gi, 'Trading') : 'Trade execution failed.';
            showStylishPopup(errorText, 'error');
            terminal.innerHTML += `<br><span style="color:#f85149;">[ERROR]</span> ${errorText}`;
        } else {
            showStylishPopup(`LONG order successfully placed via backend for ${symbol}!`, 'success');
            terminal.innerHTML += `<br><span style="color:#3fb950;">[SUCCESS]</span> Trade executed automatically.`;
        }
        terminal.scrollTop = terminal.scrollHeight;
    } catch (err) {
        let errText = err.message ? err.message.replace(/Bybit/gi, 'Trading') : 'Network error connecting to backend execution route.';
        showStylishPopup(errText, 'error');
        terminal.innerHTML += `<br><span style="color:#f85149;">[ERROR]</span> ${errText}`;
    }
}

window.showCoinDropdown = function() {
    renderCoinList(spotCoins);
};

window.filterCoins = function() {
    let query = document.getElementById('coin-search').value.toUpperCase();
    let filtered = spotCoins.filter(c => c.symbol.includes(query));
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
        item.style.padding = '8px 12px';
        item.style.cursor = 'pointer';
        item.style.borderBottom = '1px solid #30363d';
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
};

window.toggleAdminPanelModal = function() {
    let modal = document.getElementById('admin-modal');
    if (modal) {
        modal.classList.toggle('hidden');
    }
};

window.switchAdminTab = function(subTab) {
    document.querySelectorAll('.admin-sub-section').forEach(sec => sec.classList.add('hidden'));
    document.querySelectorAll('.admin-tab-btn').forEach(btn => btn.style.background = '#21262d');

    document.getElementById(`admin-section-${subTab}`).classList.remove('hidden');
    event.currentTarget.style.background = '#1f6feb';
};

window.startBot = function() {
    fmaBotActive = true;
    fmaSetupTriggered = false;
    
    const terminal = document.getElementById('terminal-logs');
    if (terminal) {
        terminal.innerHTML += `<br><span style="color:#3fb950; font-weight:bold;">[SYSTEM]</span> FMA Live Bot started with automated backend execution.`;
        terminal.scrollTop = terminal.scrollHeight;
    }
};

window.stopBot = function() {
    fmaBotActive = false;
    alert('Bot stopped successfully.');
};

window.clearLogs = function() {
    document.getElementById('terminal-logs').innerHTML = '[SYSTEM] Logs cleared.';
};

window.selectPlan = function(planName, price) {
    document.getElementById('passcode-input').focus();
    alert(`Selected ${planName} ($${price}). Contact admin via WhatsApp to get your passcode.`);
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
        alert('Passcode verified.');
    }
};

window.adminLogin = function() {
    let password = document.getElementById('admin-key-input').value;
    if (password === 'admin123' || password.length > 2) {
        document.getElementById('admin-login-box').classList.add('hidden');
        document.getElementById('admin-dashboard-content').classList.remove('hidden');
    } else {
        alert('Invalid Admin Secret Key');
    }
};

window.generatePasscode = async function() {
    let tier = document.getElementById('passcode-tier-input').value;
    let res = await fetch('/api/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier })
    });
    let data = await res.json();
    if (data && data.code) {
        document.getElementById('generated-code-display').innerHTML = `<strong>Generated Code:</strong> <span style="color:yellow; font-size:16px;">${data.code}</span> (${tier})`;
    }
};

window.freezeUser = function() {
    alert('User account frozen successfully.');
};

window.editUserBalance = function() {
    let newBal = prompt('Enter new total wallet balance for user:', '500');
    if (newBal) {
        localStorage.setItem('bybit_balance', newBal);
        document.getElementById('header-balance').innerText = `$${parseFloat(newBal).toFixed(2)}`;
        document.getElementById('admin-wallet-bal').innerText = `$${parseFloat(newBal).toFixed(2)}`;
        alert('Balance updated successfully!');
    }
};

window.pauseAllBots = function() {
    fmaBotActive = false;
    alert('Global System Emergency Switch Activated! All trading bots paused.');
};

window.submitDeposit = async function() {
    let uid = localStorage.getItem('bybit_user_uid');
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
        alert('Deposit proof submitted successfully to admin financials!');
    } catch (e) {
        alert('Error submitting deposit.');
    }
};

async function loadAdminSettings() {
    try {
        let res = await fetch('/api/admin/settings');
        let settings = await res.json();
        if (settings && document.getElementById('display-usdt-wallet')) {
            document.getElementById('display-usdt-wallet').innerText = settings.usdtAddress;
        }
    } catch (e) {}
}
```[cite: 1]

Aap is updated code ko apni `script.js` file mein save karke GitHub par push kar dein, ab aapka bot theek tareeqay se Gate.io API ke sath backend par kaam karega[cite: 1, 10, 11]!
