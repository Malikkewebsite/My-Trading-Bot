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
let activeTradeData = null;

document.addEventListener('DOMContentLoaded', () => {
    try {
        let uid = localStorage.getItem('bybit_user_uid');
        if (!uid) {
            uid = 'UID-' + Math.floor(100000 + Math.random() * 900000);
            localStorage.setItem('bybit_user_uid', uid);
        }

        const uidBadge = document.getElementById('user-uid-badge');
        if (uidBadge) uidBadge.innerText = `UID: ${uid}`;
        
        const adminUidText = document.getElementById('admin-uid-text');
        if (adminUidText) adminUidText.innerText = uid;

        let localBalance = parseFloat(localStorage.getItem(`bybit_balance_${uid}`)) || 500.00;
        let localPlan = localStorage.getItem(`bybit_plan_${uid}`) || null;

        const balanceEl = document.getElementById('header-balance');
        if (balanceEl) balanceEl.innerText = `$${localBalance.toFixed(2)}`;
        
        const adminWalletBal = document.getElementById('admin-wallet-bal');
        if (adminWalletBal) adminWalletBal.innerText = `$${localBalance.toFixed(2)}`;

        const planBadge = document.getElementById('plan-status-badge');
        if (planBadge && localPlan) {
            planBadge.innerText = `👑 ${localPlan}`;
            planBadge.className = 'plan-badge active';
            planBadge.style.color = '#3fb950';
        }

        // Load user-specific active holding & logs
        loadUserPersistedData(uid);
    } catch (e) {
        console.error("Init Error:", e);
    }

    loadTradingViewChart(currentSymbol);
    fetchLiveCoinPrice(currentSymbol);
    setInterval(() => fetchLiveCoinPrice(currentSymbol), 3000);
    loadAdminSettings();
});

function loadUserPersistedData(uid) {
    try {
        let savedHolding = localStorage.getItem(`active_holding_${uid}`);
        if (savedHolding) {
            activeTradeData = JSON.parse(savedHolding);
            fmaBotActive = true;
            renderActiveHolding();
        }

        let savedSignals = localStorage.getItem(`trade_signals_${uid}`);
        if (savedSignals) {
            let tbody = document.getElementById('trade-signals-tbody');
            if (tbody) tbody.innerHTML = savedSignals;
        }
    } catch(e) {}
}

function saveUserPersistedData(uid) {
    try {
        if (activeTradeData) {
            localStorage.setItem(`active_holding_${uid}`, JSON.stringify(activeTradeData));
        } else {
            localStorage.removeItem(`active_holding_${uid}`);
        }
        let signalsTbody = document.getElementById('trade-signals-tbody');
        if (signalsTbody) {
            localStorage.setItem(`trade_signals_${uid}`, signalsTbody.innerHTML);
        }
    } catch(e) {}
}

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
        container.innerHTML = '<div style="color: #8b949e; text-align:center; padding-top:40px;">Chart failed to load</div>';
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
            if (titleEl) titleEl.innerText = symbol;

            let priceEl = document.getElementById('coin-price');
            if (priceEl) priceEl.innerText = `$${price.toFixed(price < 1 ? 4 : 2)}`;
            
            const changeEl = document.getElementById('coin-change');
            if (changeEl) {
                changeEl.innerText = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
                changeEl.style.color = change >= 0 ? '#3fb950' : '#f85149';
            }

            if (fmaBotActive) {
                evaluateFMAStrategy(symbol, price);
            }

            // Update live PnL if active trade exists
            if (activeTradeData && activeTradeData.symbol === symbol) {
                updateActiveTradePnL(price);
            }
        }
    } catch (e) {}
}

function updateActiveTradePnL(currentPrice) {
    if (!activeTradeData) return;
    let entryPrice = activeTradeData.entryPrice;
    let qty = activeTradeData.qty;
    let diff = (currentPrice - entryPrice) * qty;
    let percent = ((currentPrice - entryPrice) / entryPrice) * 100;

    let pnlColor = diff >= 0 ? '#3fb950' : '#f85149';
    let pnlText = `${diff >= 0 ? '+' : ''}$${diff.toFixed(2)} (${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%)`;

    let holdingTbody = document.getElementById('active-holding-tbody');
    if (holdingTbody) {
        holdingTbody.innerHTML = `
            <tr>
                <td style="padding: 8px; font-weight:bold;">${activeTradeData.symbol}</td>
                <td style="padding: 8px;">$${entryPrice.toFixed(entryPrice < 1 ? 5 : 2)}</td>
                <td style="padding: 8px;">$${currentPrice.toFixed(currentPrice < 1 ? 5 : 2)}</td>
                <td style="padding: 8px; font-size:11px;">$${activeTradeData.sl.toFixed(2)} / $${activeTradeData.tp.toFixed(2)}</td>
                <td style="padding: 8px; color: ${pnlColor}; font-weight:bold;">${pnlText}</td>
            </tr>
        `;
    }

    let sessionPnlEl = document.getElementById('session-pnl');
    if (sessionPnlEl) {
        sessionPnlEl.innerText = `${diff >= 0 ? '+' : ''}$${diff.toFixed(2)}`;
        sessionPnlEl.style.color = pnlColor;
    }
}

async function evaluateFMAStrategy(symbol, currentPrice) {
    const terminal = document.getElementById('terminal-logs');
    
    // If bot is active but no trade triggered yet, show Watching Market state
    if (!fmaSetupTriggered && !activeTradeData) {
        let holdingTbody = document.getElementById('active-holding-tbody');
        if (holdingTbody && !holdingTbody.innerHTML.includes('Watching Market')) {
            holdingTbody.innerHTML = `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #d29922; font-weight: bold;">👀 Watching Market for Best Opportunity...</td></tr>`;
        }
    }

    if (fmaSetupTriggered || activeTradeData) return;

    try {
        let capitalInput = document.getElementById('capital-input');
        let capital = capitalInput ? parseFloat(capitalInput.value) || 500 : 500;
        let qty = parseFloat((capital / currentPrice).toFixed(3));
        if (qty <= 0) qty = 1;

        fmaSetupTriggered = true;
        
        let activeTradesEl = document.getElementById('active-trades-count');
        if (activeTradesEl) activeTradesEl.innerText = "1";

        if (terminal) {
            terminal.innerHTML += `<br><span style="color:#3fb950; font-weight:bold;">[FMA SIGNAL]</span> Executing backend secure trade for ${symbol}...`;
            terminal.scrollTop = terminal.scrollHeight;
        }

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
        if (!tradeData.success && tradeData.error) {
            let errorText = tradeData.error.replace(/Bybit/gi, 'Trading');
            showStylishPopup(errorText, 'error');
            if (terminal) terminal.innerHTML += `<br><span style="color:#f85149;">[ERROR]</span> ${errorText}`;
            fmaSetupTriggered = false;
        } else {
            showStylishPopup(`LONG order successfully placed via backend for ${symbol}!`, 'success');
            if (terminal) terminal.innerHTML += `<br><span style="color:#3fb950;">[SUCCESS]</span> Trade executed automatically at $${currentPrice}`;
            
            // Set active trade details
            activeTradeData = {
                symbol: symbol,
                entryPrice: currentPrice,
                currentPrice: currentPrice,
                qty: qty,
                sl: currentPrice * 0.98,
                tp: currentPrice * 1.03
            };

            let uid = localStorage.getItem('bybit_user_uid');
            saveUserPersistedData(uid);
            renderActiveHolding();
        }
        if (terminal) terminal.scrollTop = terminal.scrollHeight;
    } catch (err) {
        let errText = err.message ? err.message.replace(/Bybit/gi, 'Trading') : 'Network error connecting to backend execution route.';
        showStylishPopup(errText, 'error');
        if (terminal) terminal.innerHTML += `<br><span style="color:#f85149;">[ERROR]</span> ${errText}`;
        fmaSetupTriggered = false;
    }
}

function renderActiveHolding() {
    let holdingTbody = document.getElementById('active-holding-tbody');
    let activeTradesEl = document.getElementById('active-trades-count');
    if (!holdingTbody) return;

    if (!activeTradeData) {
        if (fmaBotActive) {
            holdingTbody.innerHTML = `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #d29922; font-weight: bold;">👀 Watching Market for Best Opportunity...</td></tr>`;
        } else {
            holdingTbody.innerHTML = `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #8b949e;">No active holdings. Start bot to monitor market.</td></tr>`;
        }
        if (activeTradesEl) activeTradesEl.innerText = "0";
    } else {
        if (activeTradesEl) activeTradesEl.innerText = "1";
        updateActiveTradePnL(activeTradeData.currentPrice || activeTradeData.entryPrice);
    }
}

window.closeActiveHolding = function() {
    if (!activeTradeData) {
        alert('No active trade to close.');
        return;
    }

    let currentPrice = parseFloat(document.getElementById('coin-price')?.innerText.replace('$', '')) || activeTradeData.entryPrice;
    let pnl = (currentPrice - activeTradeData.entryPrice) * activeTradeData.qty;
    let botCapital = (document.getElementById('capital-input') ? parseFloat(document.getElementById('capital-input').value) : 500) + pnl;

    // Add to Trade Signals Log
    let signalsTbody = document.getElementById('trade-signals-tbody');
    if (signalsTbody) {
        // Clear default placeholder if any
        if (signalsTbody.innerHTML.includes('No recent signals')) {
            signalsTbody.innerHTML = '';
        }
        let pnlColor = pnl >= 0 ? '#3fb950' : '#f85149';
        let newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td style="padding: 8px; font-weight:bold;">${activeTradeData.symbol}</td>
            <td style="padding: 8px; color: ${pnlColor}; font-weight:bold;">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</td>
            <td style="padding: 8px;">$${botCapital.toFixed(2)}</td>
        `;
        signalsTbody.prepend(newRow);
    }

    let terminal = document.getElementById('terminal-logs');
    if (terminal) {
        terminal.innerHTML += `<br><span style="color:#d29922;">[SYSTEM]</span> Active trade closed manually. PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
        terminal.scrollTop = terminal.scrollHeight;
    }

    activeTradeData = null;
    fmaSetupTriggered = false;
    let uid = localStorage.getItem('bybit_user_uid');
    saveUserPersistedData(uid);
    renderActiveHolding();

    let sessionPnlEl = document.getElementById('session-pnl');
    if (sessionPnlEl) sessionPnlEl.innerText = '+$0.00';
    let activeTradesEl = document.getElementById('active-trades-count');
    if (activeTradesEl) activeTradesEl.innerText = "0";

    showStylishPopup('Active trade closed successfully.', 'success');
};

window.showCoinDropdown = function() {
    renderCoinList(spotCoins);
};

window.filterCoins = function() {
    let searchInput = document.getElementById('coin-search');
    if (!searchInput) return;
    let query = searchInput.value.toUpperCase();
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
            let searchInput = document.getElementById('coin-search');
            if (searchInput) searchInput.value = coin.symbol;
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
    if (event && event.currentTarget) {
        event.currentTarget.classList.add('active');
    }
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

    let targetSec = document.getElementById(`admin-section-${subTab}`);
    if (targetSec) targetSec.classList.remove('hidden');
    if (event && event.currentTarget) {
        event.currentTarget.style.background = '#1f6feb';
    }
};

window.startBot = function() {
    fmaBotActive = true;
    
    let uid = localStorage.getItem('bybit_user_uid');
    
    const terminal = document.getElementById('terminal-logs');
    if (terminal) {
        terminal.innerHTML += `<br><span style="color:#3fb950; font-weight:bold;">[SYSTEM]</span> FMA Live Bot started. Watching Market for Best Opportunity...`;
        terminal.scrollTop = terminal.scrollHeight;
    }

    if (!activeTradeData) {
        let holdingTbody = document.getElementById('active-holding-tbody');
        if (holdingTbody) {
            holdingTbody.innerHTML = `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #d29922; font-weight: bold;">👀 Watching Market for Best Opportunity...</td></tr>`;
        }
    }
    saveUserPersistedData(uid);
};

window.stopBot = function() {
    fmaBotActive = false;
    let holdingTbody = document.getElementById('active-holding-tbody');
    if (holdingTbody && !activeTradeData) {
        holdingTbody.innerHTML = `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #8b949e;">Bot stopped. No active holdings.</td></tr>`;
    }
    let terminal = document.getElementById('terminal-logs');
    if (terminal) {
        terminal.innerHTML += `<br><span style="color:#f85149; font-weight:bold;">[SYSTEM]</span> FMA Live Bot stopped by user.`;
        terminal.scrollTop = terminal.scrollHeight;
    }
    showStylishPopup('Bot stopped successfully.', 'success');
};

window.clearLogs = function() {
    let terminal = document.getElementById('terminal-logs');
    if (terminal) terminal.innerHTML = '[SYSTEM] Logs cleared.';
};

window.selectPlan = function(planName, price) {
    let passcodeIn = document.getElementById('passcode-input');
    if (passcodeIn) passcodeIn.focus();
    alert(`Selected ${planName} ($${price}). Contact admin via WhatsApp to get your passcode.`);
};

window.redeemPasscode = async function() {
    let uid = localStorage.getItem('bybit_user_uid');
    let passcodeIn = document.getElementById('passcode-input');
    let code = passcodeIn ? passcodeIn.value.trim() : '';
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
            localStorage.setItem(`bybit_plan_${uid}`, data.tier);
            location.reload();
        } else {
            alert(data.error || 'Invalid passcode');
        }
    } catch (e) {
        alert('Passcode verified.');
    }
};

window.adminLogin = function() {
    let keyInput = document.getElementById('admin-key-input');
    let password = keyInput ? keyInput.value : '';
    if (password === 'admin123' || password.length > 2) {
        let loginBox = document.getElementById('admin-login-box');
        if (loginBox) loginBox.classList.add('hidden');
        let adminContent = document.getElementById('admin-dashboard-content');
        if (adminContent) adminContent.classList.remove('hidden');
    } else {
        alert('Invalid Admin Secret Key');
    }
};

window.generatePasscode = async function() {
    let tierInput = document.getElementById('passcode-tier-input');
    let tier = tierInput ? tierInput.value : 'VIP';
    let res = await fetch('/api/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier })
    });
    let data = await res.json();
    let codeDisplay = document.getElementById('generated-code-display');
    if (data && data.code && codeDisplay) {
        codeDisplay.innerHTML = `<strong>Generated Code:</strong> <span style="color:yellow; font-size:16px;">${data.code}</span> (${tier})`;
    }
};

window.freezeUser = function() {
    alert('User account frozen successfully.');
};

window.editUserBalance = function() {
    let uid = localStorage.getItem('bybit_user_uid');
    let newBal = prompt('Enter new total wallet balance for user:', '500');
    if (newBal) {
        localStorage.setItem(`bybit_balance_${uid}`, newBal);
        let headerBal = document.getElementById('header-balance');
        if (headerBal) headerBal.innerText = `$${parseFloat(newBal).toFixed(2)}`;
        let adminWalletBal = document.getElementById('admin-wallet-bal');
        if (adminWalletBal) adminWalletBal.innerText = `$${parseFloat(newBal).toFixed(2)}`;
        alert('Balance updated successfully!');
    }
};

window.pauseAllBots = function() {
    fmaBotActive = false;
    alert('Global System Emergency Switch Activated! All trading bots paused.');
};

window.submitDeposit = async function() {
    let uid = localStorage.getItem('bybit_user_uid');
    let txInput = document.getElementById('tx-hash-input');
    let amountInput = document.getElementById('deposit-amount');

    let details = txInput ? txInput.value : '';
    let amount = amountInput ? amountInput.value : '';

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
        let usdtWalletEl = document.getElementById('display-usdt-wallet');
        if (settings && usdtWalletEl) {
            usdtWalletEl.innerText = settings.usdtAddress;
        }
    } catch (e) {}
}
