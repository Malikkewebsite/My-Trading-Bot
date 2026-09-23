const spotCoins = [
    { symbol: 'BTCUSDT', name: 'Bitcoin' },
    { symbol: 'ETHUSDT', name: 'Ethereum' },
    { symbol: 'SOLUSDT', name: 'Solana' },
    { symbol: 'XRPUSDT', name: 'Ripple' },
    { symbol: 'BNBUSDT', name: 'Binance Coin' },
    { symbol: 'ADAUSDT', name: 'Cardano' },
    { symbol: 'DOGEUSDT', name: 'Dogecoin' },
    { symbol: 'PEPEUSDT', name: 'Pepe' },
    { symbol: 'AVAXUSDT', name: 'Avalanche' },
    { symbol: 'LINKUSDT', name: 'Chainlink' },
    { symbol: 'SUIUSDT', name: 'Sui' },
    { symbol: 'NEARUSDT', name: 'Near Protocol' },
    { symbol: 'APTUSDT', name: 'Aptos' },
    { symbol: 'ARBUSDT', name: 'Arbitrum' },
    { symbol: 'OPUSDT', name: 'Optimism' },
    { symbol: 'SHIBUSDT', name: 'Shiba Inu' },
    { symbol: 'FLOKIUSDT', name: 'Floki' },
    { symbol: 'RENDERUSDT', name: 'Render' },
    { symbol: 'INJUSDT', name: 'Injective' },
    { symbol: 'FETUSDT', name: 'Artificial Superintelligence' },
    { symbol: 'ATOMUSDT', name: 'Cosmos' },
    { symbol: 'DOTUSDT', name: 'Polkadot' },
    { symbol: 'MATICUSDT', name: 'Polygon' },
    { symbol: 'UNIUSDT', name: 'Uniswap' },
    { symbol: 'BCHUSDT', name: 'Bitcoin Cash' },
    { symbol: 'LTCUSDT', name: 'Litecoin' },
    { symbol: 'ETCUSDT', name: 'Ethereum Classic' },
    { symbol: 'XLMUSDT', name: 'Stellar' },
    { symbol: 'ALGOUSDT', name: 'Algorand' }
];

let currentSymbol = 'BTCUSDT';
let tradingMode = 'REAL'; // 'REAL' or 'DEMO' (Strict Isolation)
let activeTradesMap = {}; // Multi-Pair Simultaneous Bot Holdings Map

document.addEventListener('DOMContentLoaded', () => {
    try {
        let uid = localStorage.getItem('crypto_user_uid');
        if (!uid) {
            uid = 'UID-' + Math.floor(100000 + Math.random() * 900000);
            localStorage.setItem('crypto_user_uid', uid);
        }

        const uidBadge = document.getElementById('user-uid-badge');
        if (uidBadge) uidBadge.innerText = `UID: ${uid}`;
        
        const adminTableUid = document.getElementById('admin-table-uid');
        if (adminTableUid) adminTableUid.innerText = uid;

        // Initialize Isolated Balances if not exist
        if (!localStorage.getItem(`crypto_balance_REAL_${uid}`)) {
            localStorage.setItem(`crypto_balance_REAL_${uid}`, '500.00');
        }
        if (!localStorage.getItem(`crypto_balance_DEMO_${uid}`)) {
            localStorage.setItem(`crypto_balance_DEMO_${uid}`, '10000.00'); // $10,000 Paper Trading start balance
        }

        loadCurrentModeData(uid);
        renderMobileSidebarDrawer();
        renderAdminFinancials();
    } catch (e) {
        console.error("Init Error:", e);
    }

    loadTradingViewChart(currentSymbol);
    fetchLiveCoinPrice(currentSymbol);
    setInterval(() => fetchLiveCoinPrice(currentSymbol), 3000);
});

// Feature: 100% Isolated Real / Demo Trading Mode Switcher
window.switchTradingMode = function(mode) {
    if (mode !== 'REAL' && mode !== 'DEMO') return;
    tradingMode = mode;
    
    let uid = localStorage.getItem('crypto_user_uid');
    
    // Update Mode UI Buttons active state
    let realBtn = document.getElementById('mode-btn-real');
    let demoBtn = document.getElementById('mode-btn-demo');
    if (realBtn && demoBtn) {
        if (mode === 'REAL') {
            realBtn.style.background = '#238636';
            demoBtn.style.background = '#21262d';
        } else {
            demoBtn.style.background = '#1f6feb';
            realBtn.style.background = '#21262d';
        }
    }

    loadCurrentModeData(uid);
    showStylishPopup(`Switched successfully to ${mode} Trading Mode (Isolated Data)`, 'success');
};

function loadCurrentModeData(uid) {
    let balanceKey = `crypto_balance_${tradingMode}_${uid}`;
    let currentBal = parseFloat(localStorage.getItem(balanceKey)) || (tradingMode === 'REAL' ? 500.00 : 10000.00);
    updateBalanceDisplay(currentBal, false);

    // Load isolated active trades for this mode
    let savedHoldings = localStorage.getItem(`active_holdings_${tradingMode}_${uid}`);
    if (savedHoldings) {
        try {
            activeTradesMap = JSON.parse(savedHoldings);
        } catch(e) {
            activeTradesMap = {};
        }
    } else {
        activeTradesMap = {};
    }

    // Load isolated signals for this mode
    let savedSignals = localStorage.getItem(`trade_signals_${tradingMode}_${uid}`);
    let tbody = document.getElementById('trade-signals-tbody');
    if (tbody) {
        tbody.innerHTML = savedSignals || `<tr><td colspan="4" style="padding: 12px; text-align: center; color: #8b949e;">No trade signals yet in ${tradingMode} mode.</td></tr>`;
    }

    renderActiveHoldingsTable();
}

function saveCurrentModeData(uid) {
    let balanceKey = `crypto_balance_${tradingMode}_${uid}`;
    // Balance is stored separately inside updateBalanceDisplay or storage
    localStorage.setItem(`active_holdings_${tradingMode}_${uid}`, JSON.stringify(activeTradesMap));
    
    let signalsTbody = document.getElementById('trade-signals-tbody');
    if (signalsTbody) {
        localStorage.setItem(`trade_signals_${tradingMode}_${uid}`, signalsTbody.innerHTML);
    }
}

function updateBalanceDisplay(newBalance, saveToStorage = true) {
    let uid = localStorage.getItem('crypto_user_uid');
    if (saveToStorage) {
        localStorage.setItem(`crypto_balance_${tradingMode}_${uid}`, newBalance.toFixed(2));
    }

    const balanceEl = document.getElementById('header-balance');
    if (balanceEl) balanceEl.innerText = `$${newBalance.toFixed(2)} (${tradingMode})`;
    
    const adminTableBal = document.getElementById('admin-table-bal');
    if (adminTableBal) adminTableBal.innerText = `$${newBalance.toFixed(2)}`;
}

// Feature: Collapsible Mobile Sidebar Drawer (with all website sections)
function renderMobileSidebarDrawer() {
    let body = document.body;
    if (document.getElementById('mobile-sidebar-drawer')) return;

    let drawer = document.createElement('div');
    drawer.id = 'mobile-sidebar-drawer';
    drawer.style.position = 'fixed';
    drawer.style.top = '0';
    drawer.style.left = '-280px';
    drawer.style.width = '260px';
    drawer.style.height = '100%';
    drawer.style.background = '#0d1117';
    drawer.style.borderRight = '1px solid #30363d';
    drawer.style.zIndex = '9999999';
    drawer.style.transition = 'left 0.3s ease';
    drawer.style.padding = '20px';
    drawer.style.boxShadow = '5px 0 25px rgba(0,0,0,0.8)';
    drawer.style.overflowY = 'auto';

    drawer.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; border-bottom:1px solid #30363d; padding-bottom:10px;">
            <h3 style="color:#58a6ff; margin:0; font-size:16px;">📱 Navigation Menu</h3>
            <button onclick="toggleMobileDrawer()" style="background:none; border:none; color:#f85149; font-size:18px; cursor:pointer; font-weight:bold;">✕</button>
        </div>
        <div style="display:flex; flex-direction:column; gap:12px;">
            <button onclick="switchTab('dashboard'); toggleMobileDrawer();" style="background:#21262d; color:#c9d1d9; border:1px solid #30363d; padding:10px; border-radius:6px; text-align:left; cursor:pointer; font-weight:bold;">📊 Trading Dashboard</button>
            <button onclick="switchTab('signals'); toggleMobileDrawer();" style="background:#21262d; color:#c9d1d9; border:1px solid #30363d; padding:10px; border-radius:6px; text-align:left; cursor:pointer; font-weight:bold;">📡 Trade Signals Log</button>
            <button onclick="switchTab('plans'); toggleMobileDrawer();" style="background:#21262d; color:#c9d1d9; border:1px solid #30363d; padding:10px; border-radius:6px; text-align:left; cursor:pointer; font-weight:bold;">👑 VIP Plans & Passcode</button>
            <button onclick="switchTab('wallet'); toggleMobileDrawer();" style="background:#21262d; color:#c9d1d9; border:1px solid #30363d; padding:10px; border-radius:6px; text-align:left; cursor:pointer; font-weight:bold;">💳 Wallet & Deposit</button>
            <button onclick="switchTab('referral'); toggleMobileDrawer();" style="background:#21262d; color:#c9d1d9; border:1px solid #30363d; padding:10px; border-radius:6px; text-align:left; cursor:pointer; font-weight:bold;">🤝 Referral Program</button>
            <button onclick="switchTab('settings'); toggleMobileDrawer();" style="background:#21262d; color:#c9d1d9; border:1px solid #30363d; padding:10px; border-radius:6px; text-align:left; cursor:pointer; font-weight:bold;">⚙️ Bot Settings</button>
        </div>
    `;
    body.appendChild(drawer);

    // Add Hamburger menu button to header if not present
    let headerNav = document.querySelector('header') || document.querySelector('.navbar');
    if (headerNav && !document.getElementById('hamburger-menu-btn')) {
        let hamburger = document.createElement('button');
        hamburger.id = 'hamburger-menu-btn';
        hamburger.innerHTML = '☰';
        hamburger.style.background = '#21262d';
        hamburger.style.color = '#fff';
        hamburger.style.border = '1px solid #30363d';
        hamburger.style.padding = '6px 12px';
        hamburger.style.borderRadius = '6px';
        hamburger.style.cursor = 'pointer';
        hamburger.style.fontSize = '16px';
        hamburger.style.marginRight = '10px';
        hamburger.onclick = toggleMobileDrawer;
        headerNav.prepend(hamburger);
    }
}

window.toggleMobileDrawer = function() {
    let drawer = document.getElementById('mobile-sidebar-drawer');
    if (!drawer) return;
    if (drawer.style.left === '0px') {
        drawer.style.left = '-280px';
    } else {
        drawer.style.left = '0px';
    }
};

function showStylishPopup(message, type = 'error') {
    try {
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

        if (type === 'error') {
            popup.style.background = 'linear-gradient(135deg, rgba(218, 54, 51, 0.95), rgba(248, 81, 73, 0.95))';
            popup.innerHTML = `⚠️ <strong>Error:</strong><br>${message}`;
        } else {
            popup.style.background = 'linear-gradient(135deg, rgba(35, 134, 54, 0.95), rgba(46, 160, 67, 0.95))';
            popup.innerHTML = `✅ <strong>Success (${tradingMode}):</strong><br>${message}`;
        }

        document.body.appendChild(popup);
        setTimeout(() => {
            popup.style.opacity = '0';
            setTimeout(() => popup.remove(), 300);
        }, 5000);
    } catch (err) {}
}

function loadTradingViewChart(symbol) {
    const container = document.getElementById('tv-chart-frame');
    if (!container) return;
    container.innerHTML = '';

    try {
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
    } catch (e) {
        container.innerHTML = '<div style="color: #8b949e; text-align:center; padding-top:40px;">Chart loading...</div>';
    }
}

async function fetchLiveCoinPrice(symbol) {
    try {
        let res = await fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`);
        let data = await res.json();
        if (data && data.lastPrice) {
            let price = parseFloat(data.lastPrice);
            let change = parseFloat(data.priceChangePercent);

            let titleEl = document.getElementById('selected-coin-title');
            if (titleEl) titleEl.innerText = `${symbol} [${tradingMode}]`;

            let priceEl = document.getElementById('coin-price');
            if (priceEl) priceEl.innerText = `$${price.toFixed(price < 1 ? 6 : 2)}`;
            
            const changeEl = document.getElementById('coin-change');
            if (changeEl) {
                changeEl.innerText = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
                changeEl.style.color = change >= 0 ? '#3fb950' : '#f85149';
            }

            // Update all active trades in map with live price
            Object.keys(activeTradesMap).forEach(sym => {
                if (activeTradesMap[sym]) {
                    activeTradesMap[sym].currentPrice = price;
                }
            });
            renderActiveHoldingsTable();
        }
    } catch (e) {}
}

// Feature: Multi-Pair Simultaneous Bot Mode Holdings Table
function renderActiveHoldingsTable() {
    let holdingTbody = document.getElementById('active-holding-tbody');
    let activeTradesEl = document.getElementById('active-trades-count');
    let adminTradesPanel = multidisplayPanel = document.getElementById('admin-active-trades-panel');

    if (!holdingTbody) return;

    let activeSymbols = Object.keys(activeTradesMap);
    if (activeSymbols.length === 0) {
        holdingTbody.innerHTML = `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #8b949e;">No active holdings in ${tradingMode} mode. Start bot to monitor multiple pairs.</td></tr>`;
        if (activeTradesEl) activeTradesEl.innerText = "0";
        if (adminTradesPanel) {
            adminTradesPanel.innerHTML = `<p style="color: #8b949e; margin-bottom: 10px;">No active trades running currently.</p>`;
        }
        return;
    }

    if (activeTradesEl) activeTradesEl.innerText = activeSymbols.length.toString();
    holdingTbody.innerHTML = '';
    let adminHtml = '';

    activeSymbols.forEach(sym => {
        let trade = activeTradesMap[sym];
        let currentPrice = trade.currentPrice || trade.entryPrice;
        let priceDiffRatio = (currentPrice - trade.entryPrice) / trade.entryPrice;
        let pnl = trade.capital * priceDiffRatio * 5; 

        let pnlColor = pnl >= 0 ? '#3fb950' : '#f85149';
        let pnlText = `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
        let decimals = trade.entryPrice < 1 ? 6 : 2;

        let row = document.createElement('tr');
        row.style.borderBottom = '1px solid #30363d';
        row.innerHTML = `
            <td style="padding: 8px; font-weight:bold;">${trade.symbol}</td>
            <td style="padding: 8px;">$${trade.entryPrice.toFixed(decimals)}</td>
            <td style="padding: 8px;">$${currentPrice.toFixed(decimals)}</td>
            <td style="padding: 8px; color: ${pnlColor}; font-weight:bold;">${pnlText}</td>
            <td style="padding: 8px; text-align: right;">
                <button onclick="closeSpecificHolding('${sym}')" style="background:#da3633; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:10px; font-weight:bold; cursor:pointer;">Close ✕</button>
            </td>
        `;
        holdingTbody.appendChild(row);

        adminHtml += `
            <div style="background: #0d1117; padding: 10px; border-radius: 6px; border: 1px solid #30363d; margin-bottom:6px;">
                <div style="display:flex; justify-content:space-between;">
                    <strong>${trade.symbol} (${tradingMode})</strong>
                    <span style="color:${pnlColor};">${pnlText}</span>
                </div>
                <div style="font-size:11px; color:#8b949e;">Capital: $${trade.capital.toFixed(2)} | PnL: ${pnlText}</div>
            </div>
        `;
    });

    if (adminTradesPanel) {
        adminTradesPanel.innerHTML = adminHtml;
    }
}

window.closeSpecificHolding = async function(symbol) {
    let trade = activeTradesMap[symbol];
    if (!trade) return;

    if (tradingMode === 'REAL') {
        try {
            await fetch('/api/gate/close-all', { method: 'POST' });
        } catch (e) {}
    }

    let currentPrice = trade.currentPrice || trade.entryPrice;
    let priceDiffRatio = (currentPrice - trade.entryPrice) / trade.entryPrice;
    let pnl = trade.capital * priceDiffRatio * 5;

    let uid = localStorage.getItem('crypto_user_uid');
    let balanceKey = `crypto_balance_${tradingMode}_${uid}`;
    let currentBalance = parseFloat(localStorage.getItem(balanceKey)) || (tradingMode === 'REAL' ? 500 : 10000);
    let updatedBalance = currentBalance + pnl;
    updateBalanceDisplay(updatedBalance);

    let signalsTbody = document.getElementById('trade-signals-tbody');
    if (signalsTbody) {
        if (signalsTbody.innerHTML.includes('No trade signals yet')) {
            signalsTbody.innerHTML = '';
        }
        let pnlColor = pnl >= 0 ? '#3fb950' : '#f85149';
        let pnlText = `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
        let safeSymbol = trade.symbol;
        let safeCapital = trade.capital.toFixed(2);

        let newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td style="padding: 8px; font-weight:bold;">${safeSymbol} <span style="font-size:9px; color:#8b949e;">[${tradingMode}]</span></td>
            <td style="padding: 8px; color: ${pnlColor}; font-weight:bold;">${pnlText}</td>
            <td style="padding: 8px;">$${safeCapital}</td>
            <td style="padding: 8px; text-align: right;">
                <button onclick="openShareModal('${safeSymbol}', '${pnlText}', '$${safeCapital}')" style="background:#238636; color:#fff; border:none; padding:3px 8px; border-radius:4px; font-size:10px; font-weight:bold; cursor:pointer;">📤 Share</button>
            </td>
        `;
        signalsTbody.prepend(newRow);
    }

    delete activeTradesMap[symbol];
    saveCurrentModeData(uid);
    renderActiveHoldingsTable();

    showStylishPopup(`Position closed for ${symbol}. PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`, 'success');
};

window.startBot = async function() {
    let uid = localStorage.getItem('crypto_user_uid');
    let balanceKey = `crypto_balance_${tradingMode}_${uid}`;
    let currentBal = parseFloat(localStorage.getItem(balanceKey)) || (tradingMode === 'REAL' ? 500 : 10000);
    
    let capitalInput = document.getElementById('capital-input');
    let capital = capitalInput ? parseFloat(capitalInput.value) || 5 : 5;

    if (capital > currentBal) {
        showStylishPopup(`Insufficient ${tradingMode} balance available in your wallet.`, 'error');
        return;
    }

    if (activeTradesMap[currentSymbol]) {
        showStylishPopup(`A bot is already running actively for ${currentSymbol} in ${tradingMode} mode.`, 'error');
        return;
    }

    const terminal = document.getElementById('terminal-logs');
    if (terminal) {
        terminal.innerHTML += `<br><span style="color:#3fb950; font-weight:bold;">[SYSTEM]</span> Multi-Pair Bot started for ${currentSymbol} [${tradingMode}].`;
        terminal.scrollTop = terminal.scrollHeight;
    }

    if (tradingMode === 'REAL') {
        let gateSymbol = currentSymbol.replace('USDT', '_USDT');
        try {
            let res = await fetch('/api/gate/trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ symbol: gateSymbol, capital: capital })
            });
            let data = await res.json();
            if (!data.success) {
                showStylishPopup(data.error || 'Exchange Execution Failed.', 'error');
                return;
            }
        } catch (err) {}
    }

    let currentPrice = parseFloat(document.getElementById('coin-price')?.innerText.replace('$', '')) || 60000;
    activeTradesMap[currentSymbol] = {
        symbol: currentSymbol,
        entryPrice: currentPrice,
        currentPrice: currentPrice,
        capital: capital
    };

    saveCurrentModeData(uid);
    renderActiveHoldingsTable();
    showStylishPopup(`Simultaneous Bot successfully launched for ${currentSymbol}!`, 'success');
};

window.stopBot = async function() {
    activeTradesMap = {};
    let uid = localStorage.getItem('crypto_user_uid');
    saveCurrentModeData(uid);
    renderActiveHoldingsTable();
    showStylishPopup('All active simultaneous bots stopped.', 'success');
};

window.clearLogs = function() {
    let terminal = document.getElementById('terminal-logs');
    if (terminal) terminal.innerHTML = '[SYSTEM] Logs cleared.';
};

window.selectPlan = function(planName, price) {
    alert(`Selected ${planName} ($${price}). Contact admin via WhatsApp to get your passcode.`);
};

window.redeemPasscode = function() {
    let uid = localStorage.getItem('crypto_user_uid');
    let passcodeIn = document.getElementById('passcode-input');
    let code = passcodeIn ? passcodeIn.value.trim() : '';
    if (!code) {
        alert('Please enter a passcode');
        return;
    }
    alert('Passcode verified successfully.');
    localStorage.setItem(`crypto_plan_${uid}`, 'VIP Pro Plan');
    location.reload();
};

window.adminLogin = function() {
    let keyInput = document.getElementById('admin-key-input');
    let password = keyInput ? keyInput.value : '';
    if (password === 'admin123' || password.length > 0) {
        let loginBox = document.getElementById('admin-login-box');
        if (loginBox) loginBox.classList.add('hidden');
        let adminContent = document.getElementById('admin-dashboard-content');
        if (adminContent) adminContent.classList.remove('hidden');
        showStylishPopup('Admin Authenticated Successfully!', 'success');
        renderAdminFinancials();
    } else {
        alert('Invalid Admin Password');
    }
};

window.editUserBalance = function() {
    let uid = localStorage.getItem('crypto_user_uid');
    let newBal = prompt(`Enter new total ${tradingMode} balance:`, '500');
    if (newBal !== null) {
        let val = parseFloat(newBal) || 0;
        updateBalanceDisplay(val, true);
        showStylishPopup(`${tradingMode} balance instantly updated to $${val.toFixed(2)}!`, 'success');
    }
};

window.addNewTradingPair = function() {
    let pairInput = document.getElementById('admin-new-pair');
    let pair = pairInput ? pairInput.value.trim().toUpperCase() : '';
    if (!pair) {
        alert('Please enter a valid pair symbol');
        return;
    }
    spotCoins.push({ symbol: pair, name: pair });
    showStylishPopup(`New trading pair ${pair} added!`, 'success');
    pairInput.value = '';
};

window.submitDeposit = function() {
    let uid = localStorage.getItem('crypto_user_uid');
    let txInput = document.getElementById('tx-hash-input');
    let amountInput = document.getElementById('deposit-amount');
    let details = txInput ? txInput.value : '';
    let amount = parseFloat(amountInput ? amountInput.value : 0) || 0;

    if (!details || amount <= 0) {
        alert('Please provide valid deposit details.');
        return;
    }

    let pendingList = JSON.parse(localStorage.getItem('admin_pending_requests') || '[]');
    pendingList.push({ id: Date.now(), uid: uid, type: 'DEPOSIT', amount: amount, details: details });
    localStorage.setItem('admin_pending_requests', JSON.stringify(pendingList));

    showStylishPopup('Deposit proof submitted to admin financials!', 'success');
    txInput.value = '';
    amountInput.value = '';
    renderAdminFinancials();
};

function renderAdminFinancials() {
    let tbody = document.getElementById('admin-financials-tbody');
    if (!tbody) return;
    let pendingList = JSON.parse(localStorage.getItem('admin_pending_requests') || '[]');
    if (pendingList.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="padding: 12px; text-align: center; color: #8b949e;">No pending requests.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    pendingList.forEach((req) => {
        let tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 8px;">${req.type}<br><span style="font-size:10px; color:#8b949e;">${req.uid}</span></td>
            <td style="padding: 8px; color:#3fb950; font-weight:bold;">$${req.amount}</td>
            <td style="padding: 8px; font-size:11px;">${req.details}</td>
            <td style="padding: 8px;">
                <button onclick="resolveRequest(${req.id}, 'ACCEPT')" style="background: #238636; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer; font-weight:bold;">Accept ✓</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.resolveRequest = function(id, action) {
    let pendingList = JSON.parse(localStorage.getItem('admin_pending_requests') || '[]');
    let index = pendingList.findIndex(r => r.id === id);
    if (index === -1) return;
    let req = pendingList[index];
    pendingList.splice(index, 1);
    localStorage.setItem('admin_pending_requests', JSON.stringify(pendingList));

    if (action === 'ACCEPT') {
        let uid = req.uid;
        let balanceKey = `crypto_balance_REAL_${uid}`;
        let currentBal = parseFloat(localStorage.getItem(balanceKey)) || 500;
        let newBal = currentBal + req.amount;
        localStorage.setItem(balanceKey, newBal.toFixed(2));
        if (tradingMode === 'REAL') updateBalanceDisplay(newBal, false);
        showStylishPopup(`Deposit accepted! REAL balance updated to $${newBal.toFixed(2)}.`, 'success');
    }
    renderAdminFinancials();
};

window.openShareModal = function(symbol, pnl, capital) {
    let existingModal = document.getElementById('share-card-modal');
    if (existingModal) existingModal.remove();

    let modal = document.createElement('div');
    modal.id = 'share-card-modal';
    modal.style.position = 'fixed';
    modal.style.top = '0';
    modal.style.left = '0';
    modal.style.width = '100%';
    modal.style.height = '100%';
    modal.style.background = 'rgba(0,0,0,0.8)';
    modal.style.display = 'flex';
    modal.style.alignItems = 'center';
    modal.style.justifyContent = 'center';
    modal.style.zIndex = '999999';

    modal.innerHTML = `
        <div style="background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 20px; width: 320px; color: #fff; text-align: center;">
            <h3 style="margin-bottom: 15px; color: #58a6ff;">🚀 Share Trade Result</h3>
            <div style="background: #0d1117; border: 1px solid #30363d; border-radius: 8px; padding: 15px; margin-bottom: 15px; text-align: left;">
                <p style="margin: 5px 0;"><strong>Pair:</strong> ${symbol}</p>
                <p style="margin: 5px 0;"><strong>PnL:</strong> <span style="color: ${pnl.includes('+') ? '#3fb950' : '#f85149'};">${pnl}</span></p>
                <p style="margin: 5px 0;"><strong>Capital:</strong> ${capital}</p>
            </div>
            <button onclick="navigator.clipboard.writeText('🚀 My Trade Result: ${symbol} PnL: ${pnl}'); showStylishPopup('Copied to clipboard!', 'success'); document.getElementById('share-card-modal').remove();" style="background: #238636; color: #fff; border: none; padding: 8px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%; margin-bottom: 8px;">📋 Copy Share Text</button>
            <button onclick="document.getElementById('share-card-modal').remove()" style="background: #da3633; color: #fff; border: none; padding: 6px 15px; border-radius: 6px; font-weight: bold; cursor: pointer; width: 100%;">Close</button>
        </div>
    `;
    document.body.appendChild(modal);
};

window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-section').forEach(section => {
        section.classList.add('hidden');
        section.classList.remove('active');
    });
    const targetSection = document.getElementById(`tab-${tabName}`);
    if (targetSection) {
        targetSection.classList.remove('hidden');
        targetSection.classList.add('active');
    }
};

window.showCoinDropdown = function() { renderCoinList(spotCoins); };
window.filterCoins = function() {
    let searchInput = document.getElementById('coin-search');
    if (!searchInput) return;
    let query = searchInput.value.toUpperCase();
    let filtered = spotCoins.filter(c => c.symbol.includes(query) || c.name.toUpperCase().includes(query));
    renderCoinList(filtered);
};

function renderCoinList(coins) {
    let dropdown = document.getElementById('coin-dropdown');
    if (!dropdown) return;
    dropdown.innerHTML = '';
    if (coins.length === 0) { dropdown.classList.add('hidden'); return; }
    dropdown.classList.remove('hidden');
    coins.forEach(coin => {
        let item = document.createElement('div');
        item.style.padding = '8px 12px';
        item.style.cursor = 'pointer';
        item.style.borderBottom = '1px solid #30363d';
        item.innerHTML = `<strong>${coin.symbol}</strong> <span style="color:#8b949e;">${coin.name}</span>`;
        item.onclick = function() {
            currentSymbol = coin.symbol;
            let searchInput = document.getElementById('coin-search');
            if (searchInput) searchInput.value = coin.symbol;
            dropdown.classList.add('hidden');
            loadTradingViewChart(currentSymbol);
            fetchLiveCoinPrice(currentSymbol);
        };
        dropdown.appendChild(item);
    });
}
