let currentUser = {
    uid: localStorage.getItem('bybit_user_uid') || ('UID-' + Math.floor(100000 + Math.random() * 900000)),
    balance: 0,
    activePlan: null,
    activeTrades: 0,
    sessionPnl: 0
};

localStorage.setItem('bybit_user_uid', currentUser.uid);

// Complete List of Bybit Spot Trading Coins
const bybitSpotCoins = [
    "BTCUSDT", "ETHUSDT", "SOLUSDT", "XRPUSDT", "ADAUSDT", 
    "DOGEUSDT", "AVAXUSDT", "DOTUSDT", "LINKUSDT", "MATICUSDT", 
    "NEARUSDT", "UNIUSDT", "ATOMUSDT", "LTCUSDT", "APTUSDT", 
    "SUIUSDT", "PEPEUSDT", "SHIBUSDT", "MOODENGUSDT", "RENDERUSDT"
];

window.onload = function() {
    document.getElementById('user-uid-badge').innerText = `UID: ${currentUser.uid}`;
    fetchUserData();
    fetchAdminSettings();
    renderCoinDropdown(bybitSpotCoins);
    startMockChart();
};

function switchTab(tabName) {
    document.querySelectorAll('.tab-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));

    if (tabName === 'trading') {
        document.getElementById('tab-trading').classList.add('active');
        event.currentTarget.classList.add('active');
    } else if (tabName === 'funds') {
        document.getElementById('tab-funds').classList.add('active');
        event.currentTarget.classList.add('active');
    } else if (tabName === 'pricing') {
        document.getElementById('tab-pricing').classList.add('active');
        event.currentTarget.classList.add('active');
    } else if (tabName === 'admin') {
        document.getElementById('tab-admin').classList.add('active');
        event.currentTarget.classList.add('active');
        fetchAdminStats();
        fetchAdminTransactions();
    }
}

async function fetchUserData() {
    try {
        const res = await fetch(`/api/user/${currentUser.uid}`);
        const data = await res.json();
        currentUser.balance = data.balance;
        currentUser.activePlan = data.activePlan;
        currentUser.activeTrades = data.activeTrades;
        currentUser.sessionPnl = data.sessionPnl;

        document.getElementById('header-balance').innerText = `Balance: $${currentUser.balance.toFixed(2)}`;
        document.getElementById('capital-input').value = currentUser.balance > 0 ? Math.min(500, currentUser.balance) : 100;
        
        const badge = document.getElementById('plan-status-badge');
        if (currentUser.activePlan) {
            badge.innerText = `✅ ${currentUser.activePlan}`;
            badge.className = 'plan-badge unlocked';
        } else {
            badge.innerText = '🔒 Plan Locked';
            badge.className = 'plan-badge locked';
        }
        document.getElementById('active-trades-count').innerText = currentUser.activeTrades;
        document.getElementById('session-pnl').innerText = `+$${currentUser.sessionPnl.toFixed(2)}`;
    } catch (e) {
        console.error("Error fetching user data:", e);
    }
}

// Coin Search Filtering
function filterCoins() {
    const query = document.getElementById('coin-search').value.toUpperCase();
    const filtered = bybitSpotCoins.filter(c => c.includes(query));
    renderCoinDropdown(filtered);
}

function renderCoinDropdown(coins) {
    const dropdown = document.getElementById('coin-dropdown');
    dropdown.innerHTML = '';
    if (coins.length === 0) {
        dropdown.classList.add('hidden');
        return;
    }
    dropdown.classList.remove('hidden');
    coins.forEach(coin => {
        const div = document.createElement('div');
        div.className = 'coin-item';
        div.innerText = coin;
        div.onclick = () => selectCoin(coin);
        dropdown.appendChild(div);
    });
}

function selectCoin(coin) {
    document.getElementById('coin-search').value = coin;
    document.getElementById('selected-coin-title').innerText = coin.replace('USDT', '/USDT');
    document.getElementById('coin-dropdown').classList.add('hidden');
    logTerminal(`[INFO] Switched active trading pair to ${coin} on Bybit Spot V5.`);
}

// Redeem Passcode
async function redeemPasscode() {
    const code = document.getElementById('passcode-input').value.trim();
    if (!code) return alert('Please enter a passcode!');

    const res = await fetch('/api/codes/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, uid: currentUser.uid })
    });
    const data = await res.json();
    if (data.success) {
        alert(`Success! Unlocked ${data.tier}`);
        document.getElementById('passcode-input').value = '';
        fetchUserData();
    } else {
        alert(data.error || 'Invalid passcode');
    }
}

async function selectPlan(planName) {
    alert(`Please purchase the ${planName} passcode from admin or fund management, then enter it in the top bar to unlock.`);
    switchTab('funds');
}

// Start & Stop Bot with Bybit API Execution
let activeBotInterval = null;

async function startBot() {
    if (!currentUser.activePlan) {
        alert('Access Denied! You must unlock a plan before starting the algorithmic bot.');
        switchTab('pricing');
        return;
    }

    const capital = parseFloat(document.getElementById('capital-input').value);
    if (capital > currentUser.balance) {
        alert(`Insufficient balance! Your available balance is $${currentUser.balance.toFixed(2)}. Please deposit more funds.`);
        return;
    }

    const symbol = document.getElementById('coin-search').value || 'BTCUSDT';
    const strategy = document.getElementById('strategy-select').value;
    const risk = document.getElementById('risk-input').value;

    logTerminal(`[INIT] Initializing Bybit API securely for ${symbol} using ${strategy}...`);

    const res = await fetch('/api/bot/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser.uid, symbol, capital, risk })
    });
    const data = await res.json();

    if (!data.success) {
        alert(data.error);
        logTerminal(`[ERROR] ${data.error}`);
        return;
    }

    logTerminal(`[SUCCESS] HMAC Signature Generated: ${data.signature.substring(0, 16)}...`);
    log(`[ORDER PLACED] Market Buy Order executed on Bybit for ${symbol} with $${capital}`);
    
    currentUser.activeTrades = 1;
    document.getElementById('active-trades-count').innerText = '1';
    
    // Simulate real-time PnL generation
    let currentProfit = 0;
    if (activeBotInterval) clearInterval(activeBotInterval);
    activeBotInterval = setInterval(() => {
        currentProfit += (Math.random() * 2 - 0.8);
        document.getElementById('session-pnl').innerText = `${currentProfit >= 0 ? '+' : ''}$${currentProfit.toFixed(2)}`;
        if (Math.random() > 0.8) {
            log(`[EXECUTION] Take Profit / FVG filled on ${symbol}. Profit locked: +$${currentProfit.toFixed(2)}`);
        }
    }, 4000);
}

async function stopBot() {
    if (activeBotInterval) clearInterval(activeBotInterval);
    const pnlText = document.getElementById('session-pnl').innerText.replace('$', '');
    const profit = parseFloat(pnlText) || 0;

    const res = await fetch('/api/bot/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser.uid, profit })
    });
    const data = await res.json();

    if (data.success) {
        log(`[BOT STOPPED] All positions closed. Profit of $${profit.toFixed(2)} instantly added to your balance.`);
        fetchUserData();
        document.getElementById('session-pnl').innerText = '+$0.00';
    }
}

// Deposit & Withdraw
async function submitDeposit() {
    const amount = document.getElementById('deposit-amount').value;
    const details = document.getElementById('tx-hash-input').value;
    const method = document.getElementById('deposit-method').value;

    if (!amount || !details) return alert('Please enter amount and transaction hash/receipt ID');

    const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser.uid, type: 'DEPOSIT', amount, details: `${method}: ${details}` })
    });
    const data = await res.json();
    if (data.id) {
        alert('Deposit proof submitted successfully! Pending admin approval.');
        document.getElementById('deposit-amount').value = '';
        document.getElementById('tx-hash-input').value = '';
    }
}

async function requestWithdrawal() {
    const amount = document.getElementById('withdraw-amount').value;
    const address = document.getElementById('withdraw-address').value;

    if (!amount || !address) return alert('Please enter amount and destination address');
    if (parseFloat(amount) > currentUser.balance) return alert('Requested amount exceeds available balance!');

    const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uid: currentUser.uid, type: 'WITHDRAW', amount, details: address })
    });
    const data = await res.json();
    if (data.id) {
        alert('Withdrawal request submitted successfully to admin.');
        document.getElementById('withdraw-amount').value = '';
        document.getElementById('withdraw-address').value = '';
        fetchUserData();
    }
}

async function fetchAdminSettings() {
    try {
        const res = await fetch('/api/admin/settings');
        const settings = await res.json();
        document.getElementById('display-usdt-wallet').innerText = settings.usdtAddress;
        document.getElementById('display-easypaisa').innerText = settings.easypaisaNumber;
        document.getElementById('admin-edit-usdt').value = settings.usdtAddress;
        document.getElementById('admin-edit-easypaisa').value = settings.easypaisaNumber;
    } catch (e) {}
}

async function saveAdminSettings() {
    const usdtAddress = document.getElementById('admin-edit-usdt').value;
    const easypaisaNumber = document.getElementById('admin-edit-easypaisa').value;

    const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ usdtAddress, easypaisaNumber })
    });
    const data = await res.json();
    if (data.success) {
        alert('Admin deposit wallet info updated permanently!');
        fetchAdminSettings();
    }
}

// Admin Panel Functions
function adminLogin() {
    const key = document.getElementById('admin-key-input').value;
    if (key === 'admin123' || key === 'admin') {
        document.getElementById('admin-login-box').classList.add('hidden');
        document.getElementById('admin-dashboard').classList.remove('hidden');
        fetchAdminStats();
        fetchAdminTransactions();
    } else {
        alert('Incorrect admin password! (Try: admin123)');
    }
}

async function fetchAdminStats() {
    try {
        const res = await fetch('/api/admin/stats');
        const stats = await res.json();
        document.getElementById('admin-total-users').innerText = stats.totalUsers;
        document.getElementById('admin-pending-deposits').innerText = stats.pendingDeposits;
        document.getElementById('admin-active-subs').innerText = stats.activeSubscriptions;
    } catch (e) {}
}

async function fetchAdminTransactions() {
    try {
        const res = await fetch('/api/transactions');
        const txs = await res.json();
        const tbody = document.getElementById('admin-tx-tbody');
        tbody.innerHTML = '';
        txs.forEach(tx => {
            const tr = document.createElement('tr');
            let badgeClass = tx.status === 'PENDING' ? 'badge-pending' : (tx.status === 'APPROVED' ? 'badge-approved' : 'badge-rejected');
            tr.innerHTML = `
                <td>${tx.id}</td>
                <td>${tx.uid}</td>
                <td>${tx.type}</td>
                <td>$${tx.amount}</td>
                <td>${tx.details}</td>
                <td><span class="${badgeClass}">${tx.status}</span></td>
                <td>
                    ${tx.status === 'PENDING' ? `
                        <button onclick="processTx('${tx.id}', 'APPROVE')" class="btn-xs" style="background:#0ecb81;color:#000;">Approve</button>
                        <button onclick="processTx('${tx.id}', 'REJECT')" class="btn-xs" style="background:#f6465d;color:#fff;">Reject</button>
                    ` : 'Processed'}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {}
}

async function processTx(id, action) {
    const res = await fetch(`/api/transactions/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
    });
    const data = await res.json();
    if (data.success) {
        alert(`Transaction ${action.toLowerCase()}ed successfully!`);
        fetchAdminStats();
        fetchAdminTransactions();
        fetchUserData();
    } else {
        alert(data.error);
    }
}

async function generatePasscode() {
    const tier = document.getElementById('passcode-tier-input').value || 'Starter Plan';
    const res = await fetch('/api/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier })
    });
    const data = await res.json();
    document.getElementById('generated-code-display').innerHTML = `Generated Passcode for <b>${data.tier}</b>: <span style="color:var(--accent);font-weight:bold;">${data.code}</span>`;
}

function logTerminal(text) {
    const term = document.getElementById('terminal-logs');
    term.innerHTML += `\n[${new Date().toLocaleTimeString()}] ${text}`;
    term.scrollTop = term.scrollHeight;
}

function log(text) {
    logTerminal(text);
}

function clearLogs() {
    document.getElementById('terminal-logs.innerHTML = '';
}

function copyWallet() {
    navigator.clipboard.writeText(document.getElementById('display-usdt-wallet').innerText);
    alert('USDT Address copied to clipboard!');
}

function copyEasypaisa() {
    navigator.clipboard.writeText(document.getElementById('display-easypaisa').innerText);
    alert('Easypaisa number copied to clipboard!');
}

function startMockChart() {
    const canvas = document.getElementById('priceCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let price = 142.50;
    setInterval(() => {
        price += (Math.random() * 2 - 1);
        document.getElementById('coin-price').innerText = `$${price.toFixed(2)}`;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#0ecb81';
        ctx.lineWidth = 2;
        ctx.beginPath();
        let y = 100;
        for (let i = 0; i < canvas.width; i += 10) {
            y += (Math.random() * 6 - 3);
            if (i === 0) ctx.moveTo(i, y);
            else ctx.lineTo(i, y);
        }
        ctx.stroke();
    }, 2000);
}
