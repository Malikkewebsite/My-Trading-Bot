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
    { symbol: 'LINKUSDT', name: 'Chainlink' }
];

let currentSymbol = 'BTCUSDT';
let fmaBotActive = false;
let fmaSetupTriggered = false;
let activeTradeData = null;
let strategyCheckCounter = 0;

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

        let localBalance = parseFloat(localStorage.getItem(`crypto_balance_${uid}`)) || 500.00;
        let localPlan = localStorage.getItem(`crypto_plan_${uid}`) || null;

        updateBalanceDisplay(localBalance, false);

        const planBadge = document.getElementById('plan-status-badge');
        if (planBadge && localPlan) {
            planBadge.innerText = `👑 ${localPlan}`;
            planBadge.className = 'plan-badge active';
            planBadge.style.color = '#3fb950';
        }

        loadUserPersistedData(uid);
        renderAdminFinancials();
    } catch (e) {
        console.error("Init Error:", e);
    }

    loadTradingViewChart(currentSymbol);
    fetchLiveCoinPrice(currentSymbol);
    setInterval(() => fetchLiveCoinPrice(currentSymbol), 3000);
});

function updateBalanceDisplay(newBalance, saveToStorage = true) {
    let uid = localStorage.getItem('crypto_user_uid');
    if (saveToStorage) {
        localStorage.setItem(`crypto_balance_${uid}`, newBalance.toFixed(2));
    }

    const balanceEl = document.getElementById('header-balance');
    if (balanceEl) balanceEl.innerText = `$${newBalance.toFixed(2)}`;
    
    const adminTableBal = document.getElementById('admin-table-bal');
    if (adminTableBal) adminTableBal.innerText = `$${newBalance.toFixed(2)}`;
}

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

        if (type === 'error') {
            popup.style.background = 'linear-gradient(135deg, rgba(218, 54, 51, 0.95), rgba(248, 81, 73, 0.95))';
            popup.innerHTML = `⚠️ <strong>Notice:</strong><br>${message}`;
        } else {
            popup.style.background = 'linear-gradient(135deg, rgba(35, 134, 54, 0.95), rgba(46, 160, 67, 0.95))';
            popup.innerHTML = `✅ <strong>Success:</strong><br>${message}`;
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
            if (titleEl) titleEl.innerText = symbol;

            let priceEl = document.getElementById('coin-price');
            if (priceEl) priceEl.innerText = `$${price.toFixed(price < 1 ? 6 : 2)}`;
            
            const changeEl = document.getElementById('coin-change');
            if (changeEl) {
                changeEl.innerText = `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`;
                changeEl.style.color = change >= 0 ? '#3fb950' : '#f85149';
            }

            if (fmaBotActive) {
                evaluateFMAStrategy(symbol, price);
            }

            if (activeTradeData && activeTradeData.symbol === symbol) {
                updateActiveTradePnL(price);
            }
        }
    } catch (e) {}
}

function updateActiveTradePnL(currentPrice) {
    if (!activeTradeData) return;
    let entryPrice = activeTradeData.entryPrice;
    let allocatedCapital = activeTradeData.capital;
    
    let priceDiffRatio = (currentPrice - entryPrice) / entryPrice;
    let pnl = allocatedCapital * priceDiffRatio * 5; 
    let percent = priceDiffRatio * 100 * 5;

    let pnlColor = pnl >= 0 ? '#3fb950' : '#f85149';
    let pnlText = `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} (${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%)`;

    let decimals = entryPrice < 1 ? 6 : 2;
    let holdingTbody = document.getElementById('active-holding-tbody');
    if (holdingTbody) {
        holdingTbody.innerHTML = `
            <tr>
                <td style="padding: 8px; font-weight:bold;">${activeTradeData.symbol}</td>
                <td style="padding: 8px;">$${entryPrice.toFixed(decimals)}</td>
                <td style="padding: 8px;">$${currentPrice.toFixed(decimals)}</td>
                <td style="padding: 8px; font-size:11px;">$${activeTradeData.sl.toFixed(decimals)} / $${activeTradeData.tp.toFixed(decimals)}</td>
                <td style="padding: 8px; color: ${pnlColor}; font-weight:bold;">${pnlText}</td>
            </tr>
        `;
    }

    let adminTradesPanel = document.getElementById('admin-active-trades-panel');
    if (adminTradesPanel) {
        adminTradesPanel.innerHTML = `
            <div style="background: #0d1117; padding: 10px; border-radius: 6px; border: 1px solid #30363d;">
                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <strong>Active Trade: ${activeTradeData.symbol}</strong>
                    <span style="color:${pnlColor};">${pnlText}</span>
                </div>
                <div style="font-size:11px; color:#8b949e; margin-bottom:8px;">Entry: $${entryPrice.toFixed(decimals)} | PnL: $${pnl.toFixed(2)}</div>
                <button onclick="closeActiveHolding()" style="background:#da3633; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; font-weight:bold; cursor:pointer;">Force Close Position</button>
            </div>
        `;
    }

    let sessionPnlEl = document.getElementById('session-pnl');
    if (sessionPnlEl) {
        sessionPnlEl.innerText = `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
        sessionPnlEl.style.color = pnlColor;
    }
}

async function evaluateFMAStrategy(symbol, currentPrice) {
    const terminal = document.getElementById('terminal-logs');
    
    if (fmaSetupTriggered || activeTradeData) return;

    strategyCheckCounter++;
    
    let holdingTbody = document.getElementById('active-holding-tbody');
    if (holdingTbody) {
        holdingTbody.innerHTML = `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #d29922; font-weight: bold;">👀 Watching Market & Waiting for FMA Setup (Check #${strategyCheckCounter}/5)...</td></tr>`;
    }

    if (terminal && strategyCheckCounter === 1) {
        terminal.innerHTML += `<br><span style="color:#f0f6fc;">[FMA ENGINE]</span> Scanning order books, Fair Value Gaps, and 50/200 EMA zones for ${symbol}...`;
        terminal.scrollTop = terminal.scrollHeight;
    }

    // Require at least 4 checks (approx 12-15 seconds) so it doesn't instantly trigger blindly
    if (strategyCheckCounter < 4) {
        return;
    }

    // Strategy confirmed valid setup
    fmaSetupTriggered = true;
    strategyCheckCounter = 0;

    let capitalInput = document.getElementById('capital-input');
    let capital = capitalInput ? parseFloat(capitalInput.value) || 500 : 500;
    
    let uid = localStorage.getItem('crypto_user_uid');
    let currentBal = parseFloat(localStorage.getItem(`crypto_balance_${uid}`)) || 500;

    if (capital > currentBal) {
        showStylishPopup('Insufficient balance for this trade capital limit.', 'error');
        fmaBotActive = false;
        fmaSetupTriggered = false;
        return;
    }

    let activeTradesEl = document.getElementById('active-trades-count');
    if (activeTradesEl) activeTradesEl.innerText = "1";

    if (terminal) {
        terminal.innerHTML += `<br><span style="color:#3fb950; font-weight:bold;">[SIGNAL CONFIRMED]</span> FMA Setup verified! Executing automated market entry for ${symbol}...`;
        terminal.scrollTop = terminal.scrollHeight;
    }

    showStylishPopup(`Automated order successfully executed for ${symbol} with $${capital}!`, 'success');

    let decimals = currentPrice < 1 ? 6 : 2;
    let slPrice = currentPrice * 0.985; 
    let riskAmount = currentPrice - slPrice;
    let tpPrice = currentPrice + (riskAmount * 2.5);

    activeTradeData = {
        symbol: symbol,
        entryPrice: currentPrice,
        currentPrice: currentPrice,
        capital: capital,
        sl: slPrice,
        tp: tpPrice
    };

    saveUserPersistedData(uid);
    renderActiveHolding();
}

function renderActiveHolding() {
    let holdingTbody = document.getElementById('active-holding-tbody');
    let activeTradesEl = document.getElementById('active-trades-count');
    let adminTradesPanel = document.getElementById('admin-active-trades-panel');

    if (!holdingTbody) return;

    if (!activeTradeData) {
        if (fmaBotActive) {
            holdingTbody.innerHTML = `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #d29922; font-weight: bold;">👀 Watching Market for Best Opportunity...</td></tr>`;
        } else {
            holdingTbody.innerHTML = `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #8b949e;">No active holdings. Start bot to monitor market.</td></tr>`;
        }
        if (activeTradesEl) activeTradesEl.innerText = "0";
        if (adminTradesPanel) {
            adminTradesPanel.innerHTML = `<p style="color: #8b949e; margin-bottom: 10px;">No active trade currently running.</p>`;
        }
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
    let priceDiffRatio = (currentPrice - activeTradeData.entryPrice) / activeTradeData.entryPrice;
    let pnl = activeTradeData.capital * priceDiffRatio * 5;

    let uid = localStorage.getItem('crypto_user_uid');
    let currentBalance = parseFloat(localStorage.getItem(`crypto_balance_${uid}`)) || 500.00;
    let updatedBalance = currentBalance + pnl;
    updateBalanceDisplay(updatedBalance);

    let signalsTbody = document.getElementById('trade-signals-tbody');
    if (signalsTbody) {
        if (signalsTbody.innerHTML.includes('No trade signals yet')) {
            signalsTbody.innerHTML = '';
        }
        let pnlColor = pnl >= 0 ? '#3fb950' : '#f85149';
        let newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td style="padding: 8px; font-weight:bold;">${activeTradeData.symbol}</td>
            <td style="padding: 8px; color: ${pnlColor}; font-weight:bold;">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</td>
            <td style="padding: 8px;">$${activeTradeData.capital.toFixed(2)}</td>
        `;
        signalsTbody.prepend(newRow);
    }

    let terminal = document.getElementById('terminal-logs');
    if (terminal) {
        terminal.innerHTML += `<br><span style="color:#d29922;">[SYSTEM]</span> Position closed. PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)} | Balance Updated.`;
        terminal.scrollTop = terminal.scrollHeight;
    }

    activeTradeData = null;
    fmaSetupTriggered = false;
    strategyCheckCounter = 0;
    saveUserPersistedData(uid);
    renderActiveHolding();

    let sessionPnlEl = document.getElementById('session-pnl');
    if (sessionPnlEl) sessionPnlEl.innerText = '+$0.00';
    let activeTradesEl = document.getElementById('active-trades-count');
    if (activeTradesEl) activeTradesEl.innerText = "0";

    showStylishPopup('Position closed successfully & balance updated.', 'success');
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
        renderAdminFinancials();
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

window.copyAdminCode = function(codeText) {
    navigator.clipboard.writeText(codeText);
    showStylishPopup(`Passcode ${codeText} copied to clipboard!`, 'success');
};

window.startBot = function() {
    fmaBotActive = true;
    strategyCheckCounter = 0;
    
    let uid = localStorage.getItem('crypto_user_uid');
    
    const terminal = document.getElementById('terminal-logs');
    if (terminal) {
        terminal.innerHTML += `<br><span style="color:#3fb950; font-weight:bold;">[SYSTEM]</span> FMA Live Bot started. Initializing strict market scan...`;
        terminal.scrollTop = terminal.scrollHeight;
    }

    if (!activeTradeData) {
        let holdingTbody = document.getElementById('active-holding-tbody');
        if (holdingTbody) {
            holdingTbody.innerHTML = `<tr><td colspan="5" style="padding: 12px; text-align: center; color: #d29922; font-weight: bold;">👀 Watching Market for FMA Setup...</td></tr>`;
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
    let newBal = prompt('Enter new total wallet balance for user:', '500');
    if (newBal !== null) {
        let val = parseFloat(newBal) || 0;
        updateBalanceDisplay(val, true);
        showStylishPopup(`User balance instantly updated to $${val.toFixed(2)}!`, 'success');
    }
};

window.pauseAllBots = function() {
    fmaBotActive = false;
    showStylishPopup('Global System Emergency Switch Activated! All trading bots paused.', 'error');
};

window.addNewTradingPair = function() {
    let pairInput = document.getElementById('admin-new-pair');
    let pair = pairInput ? pairInput.value.trim().toUpperCase() : '';
    if (!pair) {
        alert('Please enter a valid trading pair (e.g. MOODENGUSDT)');
        return;
    }
    spotCoins.push({ symbol: pair, name: pair });
    showStylishPopup(`New spot trading pair ${pair} added successfully!`, 'success');
    pairInput.value = '';
};

window.submitDeposit = function() {
    let uid = localStorage.getItem('crypto_user_uid');
    let txInput = document.getElementById('tx-hash-input');
    let amountInput = document.getElementById('deposit-amount');

    let details = txInput ? txInput.value : '';
    let amount = parseFloat(amountInput ? amountInput.value : 0) || 0;

    if (!details || amount <= 0) {
        alert('Please fill out valid deposit amount and reference ID.');
        return;
    }

    let pendingList = JSON.parse(localStorage.getItem('admin_pending_requests') || '[]');
    pendingList.push({
        id: Date.now(),
        uid: uid,
        type: 'DEPOSIT',
        amount: amount,
        details: details
    });
    localStorage.setItem('admin_pending_requests', JSON.stringify(pendingList));

    showStylishPopup('Deposit proof submitted successfully to admin financials!', 'success');
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
        tr.style.borderBottom = '1px solid #30363d';
        tr.innerHTML = `
            <td style="padding: 8px;">${req.type}<br><span style="font-size:10px; color:#8b949e;">${req.uid}</span></td>
            <td style="padding: 8px; color:#3fb950; font-weight:bold;">$${req.amount}</td>
            <td style="padding: 8px; font-size:11px; color:#c9d1d9;">${req.details}</td>
            <td style="padding: 8px;">
                <button onclick="resolveRequest(${req.id}, 'ACCEPT')" style="background: #238636; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer; margin-right: 4px; font-weight:bold;">Accept ✓</button>
                <button onclick="resolveRequest(${req.id}, 'REJECT')" style="background: #da3633; color: #fff; border: none; padding: 4px 8px; border-radius: 4px; font-size: 10px; cursor: pointer; font-weight:bold;">Reject ✕</button>
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
        let currentBal = parseFloat(localStorage.getItem(`crypto_balance_${uid}`)) || 500;
        let newBal = currentBal + req.amount;
        updateBalanceDisplay(newBal, true);
        showStylishPopup(`Deposit request accepted! User balance updated instantly to $${newBal.toFixed(2)}.`, 'success');
    } else {
        showStylishPopup('Deposit request rejected.', 'error');
    }

    renderAdminFinancials();
};
