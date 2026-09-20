const adminWhatsAppNumber = "923000000000"; 

let okxSpotCoins = [
    "MOODENG-USDT", "XRP-USDT", "SOL-USDT", "BTC-USDT", "ETH-USDT", "DOGE-USDT", 
    "ADA-USDT", "AVAX-USDT", "LINK-USDT", "DOT-USDT", "MATIC-USDT",
    "PEPE-USDT", "SHIB-USDT", "LTC-USDT", "BCH-USDT", "NEAR-USDT",
    "APT-USDT", "SUI-USDT", "ORDI-USDT", "TIA-USDT", "INJ-USDT"
];

let selectedCoin = "MOODENG-USDT";
let isRunning = false;
let sessionProfit = 0;
let totalWalletBalance = 100.00;
let botCapital = 50;
let totalTrades = 0;
let winTrades = 0;
let adminRequests = [];
let isUserFrozen = false;
let globalBotSystemPaused = false;

let currentMarketPrice = 0.04401; 
let previousTickPrice = 0.04401;
let spotHolding = null;
let isPageOneAdminOnly = false;
let isAdminLoggedIn = false;

let activeAccessCodeObj = null;

let generatedCodes = {
    tier20Sec: [],
    tier7: [],
    tier14: [],
    tier30: []
};

function generateRandomCode(prefix, len = 3) {
    let chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let res = prefix + "-";
    for(let i=0; i<len; i++) {
        res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
}

function initAdminCodes() {
    let savedCodes = localStorage.getItem("bot_generated_codes");
    if(savedCodes) {
        generatedCodes = JSON.parse(savedCodes);
        if(!generatedCodes.tier20Sec) generatedCodes.tier20Sec = [];
    } 
    
    if(!generatedCodes.tier20Sec || generatedCodes.tier20Sec.length === 0) {
        generatedCodes.tier20Sec = [{ code: generateRandomCode("T20", 3), seconds: 20, plan: "20 Seconds Test" }];
    }
    if(!generatedCodes.tier7 || generatedCodes.tier7.length === 0) {
        generatedCodes.tier7 = [];
        for(let i=0; i<5; i++) generatedCodes.tier7.push({ code: generateRandomCode("7D", 4), days: 7, plan: "7 Days Access" });
    }
    if(!generatedCodes.tier14 || generatedCodes.tier14.length === 0) {
        generatedCodes.tier14 = [];
        for(let i=0; i<5; i++) generatedCodes.tier14.push({ code: generateRandomCode("14D", 4), days: 14, plan: "14 Days Access" });
    }
    if(!generatedCodes.tier30 || generatedCodes.tier30.length === 0) {
        generatedCodes.tier30 = [];
        for(let i=0; i<5; i++) generatedCodes.tier30.push({ code: generateRandomCode("30D", 4), days: 30, plan: "30 Days VIP" });
    }
    saveCodesToStorage();
}

function saveCodesToStorage() {
    localStorage.setItem("bot_generated_codes", JSON.stringify(generatedCodes));
}

function renderAdminCodesList() {
    renderCodeCategory("codesList20Sec", generatedCodes.tier20Sec);
    renderCodeCategory("codesList7Days", generatedCodes.tier7);
    renderCodeCategory("codesList14Days", generatedCodes.tier14);
    renderCodeCategory("codesList30Days", generatedCodes.tier30);
}

function renderCodeCategory(elementId, codeArray) {
    let el = document.getElementById(elementId);
    if(!el) return;
    el.innerHTML = "";
    codeArray.forEach((item) => {
        el.innerHTML += `
            <div class="admin-code-badge">
                <span><b>${item.code}</b> (${item.plan})</span>
                <button class="btn-claim" onclick="copyCodeToClipboard('${item.code}')"><i class="fa-solid fa-copy"></i> Copy</button>
            </div>
        `;
    });
}

function copyCodeToClipboard(text) {
    navigator.clipboard.writeText(text);
    showToast(`Copied ${text} to Clipboard!`, "success");
}

function openPageOneAdminModal() {
    isPageOneAdminOnly = true;
    document.getElementById("adminNavTabs").style.display = "none";
    switchAdminTab('tab-codes');
    openModal('adminModal');
}

function openFullAdminModal() {
    isPageOneAdminOnly = false;
    document.getElementById("adminNavTabs").style.display = "flex";
    openModal('adminModal');
}

function verifyAndUnlockCode() {
    let userCode = document.getElementById("userPasscode").value.trim().toUpperCase();
    if(!userCode) {
        showToast("Please enter an access passcode!", "error");
        return;
    }

    let foundMatch = null;

    ['tier20Sec', 'tier7', 'tier14', 'tier30'].forEach(key => {
        let idx = generatedCodes[key].findIndex(c => c.code === userCode);
        if(idx !== -1) {
            foundMatch = generatedCodes[key][idx];
            generatedCodes[key].splice(idx, 1);
            
            if(key === 'tier20Sec') {
                generatedCodes[key].push({ code: generateRandomCode("T20", 3), seconds: 20, plan: "20 Seconds Test" });
            } else {
                let newDays = key === 'tier7' ? 7 : (key === 'tier14' ? 14 : 30);
                let newPrefix = key === 'tier7' ? '7D' : (key === 'tier14' ? '14D' : '30D');
                let newPlanName = key === 'tier7' ? '7 Days Access' : (key === 'tier14' ? '14 Days Access' : '30 Days VIP');
                generatedCodes[key].push({ code: generateRandomCode(newPrefix, 4), days: newDays, plan: newPlanName });
            }
            saveCodesToStorage();
            renderAdminCodesList();
        }
    });

    if(foundMatch) {
        let expiryTimestamp = foundMatch.seconds ? Date.now() + (foundMatch.seconds * 1000) : Date.now() + (foundMatch.days * 24 * 60 * 60 * 1000);
        activeAccessCodeObj = {
            plan: foundMatch.plan,
            days: foundMatch.days || 0,
            seconds: foundMatch.seconds || 0,
            expiry: expiryTimestamp
        };
        localStorage.setItem("bot_active_access", JSON.stringify(activeAccessCodeObj));
        document.getElementById("userPasscode").value = "";
        showToast(`Passcode Accepted! ${foundMatch.plan} Unlocked.`, "success");
        switchToDashboard();
    } else {
        document.getElementById("userPasscode").value = "";
        showToast("Invalid or Already Used Access Passcode!", "error");
    }
}

function checkActiveAccessValidity() {
    let savedAccess = localStorage.getItem("bot_active_access");
    if(savedAccess) {
        let accessObj = JSON.parse(savedAccess);
        if(Date.now() < accessObj.expiry) {
            activeAccessCodeObj = accessObj;
            switchToDashboard();
            return true;
        } else {
            localStorage.removeItem("bot_active_access");
            if(isRunning) stopTrading();
            showToast("Your Access Subscription has expired. Please buy a new passcode.", "error");
        }
    }
    document.getElementById("accessLandingPage").style.display = "flex";
    document.getElementById("mainBotDashboard").style.display = "none";
    return false;
}

function updateAccessTimerUI() {
    if(!activeAccessCodeObj) return;
    let diffMs = activeAccessCodeObj.expiry - Date.now();
    if(diffMs <= 0) {
        localStorage.removeItem("bot_active_access");
        activeAccessCodeObj = null;
        if(isRunning) stopTrading();
        document.getElementById("accessLandingPage").style.display = "flex";
        document.getElementById("mainBotDashboard").style.display = "none";
        showToast("Access Expired!", "error");
        return;
    }

    if(activeAccessCodeObj.seconds) {
        let secRem = Math.ceil(diffMs / 1000);
        document.getElementById("activePlanExpiry").innerText = `Expires in: ${secRem}s`;
    } else {
        let diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        document.getElementById("activePlanExpiry").innerText = `Expires in: ${diffDays} Days`;
    }
}

function switchToDashboard() {
    document.getElementById("accessLandingPage").style.display = "none";
    document.getElementById("mainBotDashboard").style.display = "block";
    
    if(activeAccessCodeObj) {
        document.getElementById("activePlanTitle").innerText = activeAccessCodeObj.plan;
        updateAccessTimerUI();
    }
}

function openPurchaseModal(planName, price) {
    let textMsg = encodeURIComponent(`Hello Admin, I want to purchase the OKX Trading Bot (${planName} Plan - $${price}). Please provide payment details and Access Code.`);
    document.getElementById("waContactLink").href = `https://wa.me/${adminWhatsAppNumber}?text=${textMsg}`;
    openModal("purchaseModal");
}

window.onload = function() {
    initAdminCodes();
    renderAdminCodesList();
    loadPersistentState();
    checkActiveAccessValidity();

    document.getElementById("coinSearchInput").value = selectedCoin;
    populateCoinList(okxSpotCoins);
    renderTradingViewChart(selectedCoin);
    fetchOKXRealPrice();
    setInterval(fetchOKXRealPrice, 1000);
    setInterval(updateAccessTimerUI, 1000);
};

function savePersistentState() {
    let state = {
        selectedCoin,
        isRunning,
        sessionProfit,
        totalWalletBalance,
        botCapital,
        totalTrades,
        winTrades,
        spotHolding,
        isAdminLoggedIn,
        riskPercent: document.getElementById("riskPercent").value,
        rrRatio: document.getElementById("rrRatio").value,
        breakEvenFilter: document.getElementById("breakEvenFilter").checked,
        tradeLogsHtml: document.getElementById("tradeLogs").innerHTML,
        terminalHtml: document.getElementById("sysTerminal").innerHTML
    };
    localStorage.setItem("trading_bot_state", JSON.stringify(state));
}

function loadPersistentState() {
    let saved = localStorage.getItem("trading_bot_state");
    if(saved) {
        try {
            let state = JSON.parse(saved);
            selectedCoin = state.selectedCoin || "MOODENG-USDT";
            isRunning = state.isRunning || false;
            sessionProfit = state.sessionProfit || 0;
            totalWalletBalance = state.totalWalletBalance || 100.00;
            botCapital = state.botCapital || 50;
            totalTrades = state.totalTrades || 0;
            winTrades = state.winTrades || 0;
            spotHolding = state.spotHolding || null;
            isAdminLoggedIn = state.isAdminLoggedIn || false;

            if(state.riskPercent) document.getElementById("riskPercent").value = state.riskPercent;
            if(state.rrRatio) document.getElementById("rrRatio").value = state.rrRatio;
            if(state.breakEvenFilter !== undefined) document.getElementById("breakEvenFilter").checked = state.breakEvenFilter;
            if(state.tradeLogsHtml) document.getElementById("tradeLogs").innerHTML = state.tradeLogsHtml;
            if(state.terminalHtml) document.getElementById("sysTerminal").innerHTML = state.terminalHtml;

            document.getElementById("headerBalance").innerText = `$${totalWalletBalance.toFixed(2)}`;
            document.getElementById("adminUserBalDisp").innerText = totalWalletBalance.toFixed(2);
            document.getElementById("botBalance").value = botCapital.toFixed(2);
            document.getElementById("dispSessionProfit").innerText = `$${sessionProfit.toFixed(2)}`;
            document.getElementById("statTotalTrades").innerText = totalTrades;
            document.getElementById("statWinRate").innerText = totalTrades > 0 ? `${((winTrades / totalTrades) * 100).toFixed(0)}%` : "0%";

            if(isRunning) {
                document.getElementById("statusBadge").classList.add("active");
                document.getElementById("statusText").innerText = "RUNNING";
                document.getElementById("stopBtn").classList.add("active");
            }
        } catch(e) { console.error("Error loading state", e); }
    }
}

function authenticateAdmin() {
    let inputPass = document.getElementById("adminPasswordInput").value;
    if(inputPass === "MalikSabkaBot") {
        isAdminLoggedIn = true;
        document.getElementById("adminAuthBox").style.display = "none";
        document.getElementById("adminContentBox").style.display = "block";
        
        if(isPageOneAdminOnly) {
            document.getElementById("adminNavTabs").style.display = "none";
            switchAdminTab('tab-codes');
        } else {
            document.getElementById("adminNavTabs").style.display = "flex";
        }

        renderAdminCodesList();
        showToast("Admin Authenticated Successfully!", "success");
        savePersistentState();
    } else {
        showToast("Incorrect Admin Password!", "error");
    }
}

function switchAdminTab(tabId) {
    document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));
    
    let activeBtn = Array.from(document.querySelectorAll('.admin-tab-btn')).find(b => b.getAttribute('onclick').includes(tabId));
    if(activeBtn) activeBtn.classList.add('active');
    document.getElementById(tabId).classList.add('active');
}

function renderTradingViewChart(coin) {
    const symbol = "OKX:" + coin.replace("-", "");
    const container = document.getElementById("chartContainer");
    container.innerHTML = `<iframe src="https://s.tradingview.com/widgetembed/?frameElementId=tradingview_widget&symbol=${symbol}&interval=15&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC" style="width: 100%; height: 320px; border: none;"></iframe>`;
    document.getElementById("chartSymbolTitle").innerText = `${coin} | 15M`;
}

async function fetchOKXRealPrice() {
    let instId = selectedCoin.toUpperCase();
    let binanceSymbol = instId.replace("-", "");
    let fetched = false;

    previousTickPrice = currentMarketPrice;

    try {
        let response = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${instId}`);
        let data = await response.json();
        if(data && data.data && data.data[0] && data.data[0].last) {
            currentMarketPrice = parseFloat(data.data[0].last);
            fetched = true;
        }
    } catch(e) {}

    if(!fetched) {
        try {
            let backupRes = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`);
            let backupData = await backupRes.json();
            if(backupData && backupData.price) {
                currentMarketPrice = parseFloat(backupData.price);
                fetched = true;
            }
        } catch(err) {}
    }

    if(!fetched && instId.includes("MOODENG")) {
        currentMarketPrice = 0.04401; 
    }
    
    let formattedPrice = currentMarketPrice < 1 ? currentMarketPrice.toFixed(5) : currentMarketPrice.toFixed(4);
    document.getElementById("liveChartPrice").innerText = `$${formattedPrice}`;
    
    if (isRunning && !globalBotSystemPaused && !isUserFrozen) {
        processBotTradingLogic();
    }
    updateAdminTradeMonitoring();
    savePersistentState();
}

function startTrading() {
    if(isUserFrozen) { showToast("Your Account is Frozen by Admin!", "error"); return; }
    if(globalBotSystemPaused) { showToast("Bot System Paused Globally by Admin!", "error"); return; }
    if(isRunning) return;
    
    let userCap = parseFloat(document.getElementById("botBalance").value);
    if(!isNaN(userCap) && userCap > 0) botCapital = userCap;

    isRunning = true;
    document.getElementById("statusBadge").classList.add("active");
    document.getElementById("statusText").innerText = "RUNNING";
    document.getElementById("stopBtn").classList.add("active");

    showToast(`Algo Started ($${botCapital.toFixed(2)}). Scanning setup...`, "success");
    logConsole(`> Algo Started on ${selectedCoin}. Waiting for setup confirmation...`);
    savePersistentState();
}

function stopTrading() {
    if(!isRunning) return;
    
    if(spotHolding) {
        let priceDiff = currentMarketPrice - spotHolding.buyPrice;
        let manualPnL = (priceDiff / spotHolding.buyPrice) * spotHolding.cost;
        closePosition('STOP_ALGO_CLOSED', manualPnL);
    }

    isRunning = false;
    document.getElementById("statusBadge").classList.remove("active");
    document.getElementById("statusText").innerText = "STOPPED";
    document.getElementById("stopBtn").classList.remove("active");
    document.getElementById("lastChartSignal").innerHTML = `Signal Status: <b style="color:var(--text-muted)">Idle</b>`;
    showToast("Algo Stopped & Positions Closed", "error");
    logConsole(`> Algo Stopped by user. All active trades closed.`);
    savePersistentState();
}

function processBotTradingLogic() {
    let riskPct = parseFloat(document.getElementById("riskPercent").value) || 5;
    let maxRiskCap = parseFloat(document.getElementById("adminMaxRiskCap").value) || 10;
    
    if(riskPct > maxRiskCap) {
        riskPct = maxRiskCap;
        document.getElementById("riskPercent").value = maxRiskCap;
        showToast(`Risk capped at max allowed ${maxRiskCap}% by Admin rules`, "error");
    }

    let rrRatio = parseFloat(document.getElementById("rrRatio").value) || 3;
    let autoBE = document.getElementById("breakEvenFilter").checked;

    if (!spotHolding) {
        let isTriggered = currentMarketPrice > previousTickPrice; 

        if (!isTriggered) {
            document.getElementById("lastChartSignal").innerHTML = `Signal Status: <b style="color:var(--accent-yellow)">Waiting for Setup Touch</b>`;
            return; 
        }

        let buyPrice = currentMarketPrice; 
        let distance = buyPrice * 0.012; 
        let slPrice = buyPrice - distance;
        
        let riskPerCoin = buyPrice - slPrice;
        let tpPrice = buyPrice + (riskPerCoin * rrRatio);

        let totalRiskAmount = botCapital * (riskPct / 100);

        spotHolding = {
            coin: selectedCoin,
            buyPrice: buyPrice,
            cost: botCapital,
            qty: botCapital / buyPrice,
            slPrice: slPrice,
            tpPrice: tpPrice,
            initialRiskPrice: riskPerCoin,
            beTriggered: false,
            totalRiskAmount: totalRiskAmount
        };

        renderSpotHoldingUI();
        document.getElementById("lastChartSignal").innerHTML = `Signal Status: <b style="color:var(--accent-green)">BUY Active</b>`;

        logConsole(`> [ENTRY EXECUTION] Setup Confirmed on ${selectedCoin} @ $${buyPrice.toFixed(5)} | SL: $${slPrice.toFixed(5)} | TP: $${tpPrice.toFixed(5)}`);
        showToast(`Setup Confirmed! BUY Trade Executed.`, "success");
        savePersistentState();
        return;
    }

    let targetBEPrice = spotHolding.buyPrice + (spotHolding.initialRiskPrice * 1.5);
    if (autoBE && !spotHolding.beTriggered && currentMarketPrice >= targetBEPrice) {
        spotHolding.slPrice = spotHolding.buyPrice;
        spotHolding.beTriggered = true;
        logConsole(`> [AUTO BREAK-EVEN] Price reached 1:1.5 RR. SL moved to Entry ($${spotHolding.buyPrice.toFixed(5)})`);
        showToast(`Auto Break-Even Triggered! SL set to Entry`, "success");
    }

    renderSpotHoldingUI();

    if (currentMarketPrice >= spotHolding.tpPrice) {
        let tpProfit = spotHolding.totalRiskAmount * rrRatio;
        closePosition('TAKE_PROFIT', tpProfit);
    } 
    else if (currentMarketPrice <= spotHolding.slPrice) {
        let finalLoss = spotHolding.beTriggered ? 0 : -spotHolding.totalRiskAmount;
        closePosition(spotHolding.beTriggered ? 'BREAK_EVEN' : 'STOP_LOSS', finalLoss);
    }
}

function closePosition(reason, pnl) {
    if (!spotHolding) return;

    let isWin = pnl > 0;
    botCapital += pnl;
    sessionProfit += pnl;
    totalTrades++;
    if (isWin) winTrades++;

    totalWalletBalance += pnl; 
    document.getElementById("headerBalance").innerText = `$${totalWalletBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById("adminUserBalDisp").innerText = totalWalletBalance.toFixed(2);

    document.getElementById("botBalance").value = botCapital.toFixed(2);
    document.getElementById("dispSessionProfit").innerText = `$${sessionProfit.toFixed(2)}`;
    document.getElementById("statTotalTrades").innerText = totalTrades;
    document.getElementById("statWinRate").innerText = `${((winTrades / totalTrades) * 100).toFixed(0)}%`;

    renderSingleLog({
        coin: spotHolding.coin,
        pnl: pnl,
        botBal: botCapital,
        isWin: isWin
    });

    document.getElementById("lastChartSignal").innerHTML = `Signal Status: <b style="color:${isWin ? 'var(--accent-green)' : 'var(--accent-red)'}">Closed (${reason})</b>`;
    logConsole(`> [SPOT SELL] ${reason} Hit! Final PnL: ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`);
    showToast(`Trade Closed (${reason}): ${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`, isWin ? "success" : "error");

    spotHolding = null;
    renderSpotHoldingUI();
    savePersistentState();
}

function renderSpotHoldingUI() {
    let tbody = document.getElementById("openPositionTable");
    if (!spotHolding) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--text-muted);">No Active Spot Position (Scanning)</td></tr>`;
        return;
    }

    let priceDiff = currentMarketPrice - spotHolding.buyPrice;
    let pnlDollars = (priceDiff / spotHolding.buyPrice) * spotHolding.cost;
    let pnlPercent = (priceDiff / spotHolding.buyPrice) * 100;

    let pnlColor = pnlDollars >= 0 ? '#0ecb81' : '#f6465d';
    let pnlSign = pnlDollars >= 0 ? '+' : '';

    let dec = spotHolding.buyPrice < 1 ? 5 : 4;

    tbody.innerHTML = `<tr>
        <td><b>${spotHolding.coin}</b></td>
        <td>$${spotHolding.buyPrice.toFixed(dec)}</td>
        <td style="color:var(--accent-yellow)">$${currentMarketPrice.toFixed(dec)}</td>
        <td><small>SL: $${spotHolding.slPrice.toFixed(dec)}<br>TP: $${spotHolding.tpPrice.toFixed(dec)}</small></td>
        <td style="color:${pnlColor}; font-weight:700;">${pnlSign}$${pnlDollars.toFixed(2)} (${pnlSign}${pnlPercent.toFixed(2)}%)</td>
    </tr>`;
}

function adminAdjustWallet() {
    let newBal = prompt("Enter new total wallet balance for UID-781988:", totalWalletBalance);
    if(newBal !== null && !isNaN(newBal)) {
        totalWalletBalance = parseFloat(newBal);
        document.getElementById("headerBalance").innerText = `$${totalWalletBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        document.getElementById("adminUserBalDisp").innerText = totalWalletBalance.toFixed(2);
        showToast("User Wallet Adjusted by Admin", "success");
        savePersistentState();
    }
}

function adminToggleUserStatus() {
    isUserFrozen = !isUserFrozen;
    document.getElementById("userAccStatus").innerText = isUserFrozen ? "Frozen" : "Active";
    document.getElementById("userAccStatus").style.color = isUserFrozen ? "var(--accent-red)" : "var(--accent-green)";
    if(isUserFrozen && isRunning) stopTrading();
    showToast(`User Account ${isUserFrozen ? 'Frozen' : 'Unfrozen'}`, "error");
}

function toggleGlobalBotSwitch() {
    globalBotSystemPaused = !globalBotSystemPaused;
    let btn = document.getElementById("globalSwitchBtn");
    btn.innerText = globalBotSystemPaused ? "Resume All" : "Pause All";
    btn.style.background = globalBotSystemPaused ? "var(--accent-green)" : "";
    if(globalBotSystemPaused && isRunning) stopTrading();
    showToast(`Global Bot System ${globalBotSystemPaused ? 'Paused' : 'Resumed'}`, "error");
}

function adminAddCoin() {
    let input = document.getElementById("adminNewCoin").value.toUpperCase().trim();
    if(input && !okxSpotCoins.includes(input)) {
        okxSpotCoins.unshift(input);
        populateCoinList(okxSpotCoins);
        selectCoin(input);
        document.getElementById("adminNewCoin").value = "";
        showToast(`Added ${input} to OKX List!`, "success");
    }
}

function updateAdminTradeMonitoring() {
    let view = document.getElementById("adminActiveTradeView");
    let btn = document.getElementById("adminForceCloseBtn");
    if(spotHolding) {
        let priceDiff = currentMarketPrice - spotHolding.buyPrice;
        let pnl = (priceDiff / spotHolding.buyPrice) * spotHolding.cost;
        let dec = spotHolding.buyPrice < 1 ? 5 : 4;
        view.innerHTML = `Active Trade: <b>${spotHolding.coin}</b> | Entry: $${spotHolding.buyPrice.toFixed(dec)} | PnL: <b style="color:${pnl>=0?'var(--accent-green)':'var(--accent-red)'}">$${pnl.toFixed(2)}</b>`;
        btn.style.display = "block";
    } else {
        view.innerText = "No active positions running across platform.";
        btn.style.display = "none";
    }
}

function adminForceCloseTrade() {
    if(spotHolding) {
        let priceDiff = currentMarketPrice - spotHolding.buyPrice;
        let pnl = (priceDiff / spotHolding.buyPrice) * spotHolding.cost;
        closePosition('ADMIN_FORCE_CLOSE', pnl);
        showToast("Trade Force-Closed by Admin!", "error");
    }
}

function populateCoinList(coins) {
    let dropdown = document.getElementById("coinDropdown");
    dropdown.innerHTML = "";
    coins.forEach(coin => {
        let item = document.createElement("div");
        item.innerText = coin;
        item.onclick = function() { selectCoin(coin); };
        dropdown.appendChild(item);
    });
}

function selectCoin(coin) {
    selectedCoin = coin;
    document.getElementById("coinSearchInput").value = coin;
    document.getElementById("coinDropdown").style.display = "none";
    renderTradingViewChart(coin);
    fetchOKXRealPrice();
    showToast(`Loaded ${selectedCoin}`, "success");
    savePersistentState();
}

function showCoins() { document.getElementById("coinDropdown").style.display = "block"; }
function filterCoins() {
    let query = document.getElementById("coinSearchInput").value.toUpperCase();
    let filtered = okxSpotCoins.filter(c => c.includes(query));
    populateCoinList(filtered);
}

function openModal(id) { document.getElementById(id).style.display = "flex"; }
function closeModals() { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); }

async function submitDeposit() {
    let amt = document.getElementById("depAmount").value;
    let txid = document.getElementById("depTxid").value;
    let net = document.getElementById("depNetwork").value;

    if(!amt || !txid) { showToast("Fill all deposit details!", "error"); return; }

    let txData = {
        user_id: "UID-781988",
        type: "DEPOSIT",
        amount: parseFloat(amt),
        status: "pending"
    };

    try {
        await fetch('http://localhost:5000/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(txData)
        });
    } catch(e) {
        console.error("Supabase API Error", e);
    }

    adminRequests.push({ id: Date.now(), type: 'DEPOSIT', amount: parseFloat(amt), details: `${net} | ${txid.substring(0,8)}...` });
    renderAdminTable();
    closeModals();
    showToast("Deposit Request Sent & Saved to Supabase!", "success");
}

async function submitWithdraw() {
    let amt = document.getElementById("withAmount").value;
    let addr = document.getElementById("withAddress").value;

    if(!amt || !addr) { showToast("Fill all withdraw details!", "error"); return; }

    let txData = {
        user_id: "UID-781988",
        type: "WITHDRAW",
        amount: parseFloat(amt),
        status: "pending"
    };

    try {
        await fetch('http://localhost:5000/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(txData)
        });
    } catch(e) {
        console.error("Supabase API Error", e);
    }

    adminRequests.push({ id: Date.now(), type: 'WITHDRAW', amount: parseFloat(amt), details: addr.substring(0,8) + '...' });
    renderAdminTable();
    closeModals();
    showToast("Withdraw Request Sent & Saved to Supabase!", "success");
}

function renderAdminTable() {
    let tbody = document.getElementById("adminRequestsTable");
    if(adminRequests.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">No pending requests</td></tr>`;
        return;
    }

    tbody.innerHTML = "";
    adminRequests.forEach(req => {
        let row = `<tr>
            <td style="color:${req.type === 'DEPOSIT' ? '#0ecb81' : '#f0b90b'}"><b>${req.type}</b></td>
            <td>$${req.amount}</td>
            <td><small>${req.details}</small></td>
            <td>
                <button class="btn-claim" onclick="approveReq(${req.id})">Approve</button>
                <button class="btn-close-pos" onclick="rejectReq(${req.id})">Reject</button>
            </td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

function approveReq(id) {
    let req = adminRequests.find(r => r.id === id);
    if(req) {
        if(req.type === 'DEPOSIT') totalWalletBalance += req.amount;
        else totalWalletBalance -= req.amount;

        document.getElementById("headerBalance").innerText = `$${totalWalletBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
        document.getElementById("adminUserBalDisp").innerText = totalWalletBalance.toFixed(2);
        showToast(`${req.type} Request Approved!`, "success");
        savePersistentState();
    }
    adminRequests = adminRequests.filter(r => r.id !== id);
    renderAdminTable();
}

function rejectReq(id) {
    adminRequests = adminRequests.filter(r => r.id !== id);
    renderAdminTable();
    showToast("Request Rejected", "error");
}

function claimSessionProfit() {
    if (sessionProfit <= 0) {
        showToast("No profit to claim!", "error");
        return;
    }
    totalWalletBalance += sessionProfit;
    document.getElementById("headerBalance").innerText = `$${totalWalletBalance.toLocaleString('en-US', {minimumFractionDigits: 2})}`;
    document.getElementById("adminUserBalDisp").innerText = totalWalletBalance.toFixed(2);
    showToast(`Claimed $${sessionProfit.toFixed(2)} to Wallet!`, "success");
    sessionProfit = 0;
    document.getElementById("dispSessionProfit").innerText = "$0.00";
    savePersistentState();
}

function renderSingleLog(log) {
    let container = document.getElementById("tradeLogs");
    if(container.innerHTML.includes("Select coin")) container.innerHTML = "";

    let typeColor = log.pnl >= 0 ? '#0ecb81' : '#f6465d';

    let row = `<tr>
        <td><b>${log.coin}</b></td>
        <td style="color:${typeColor}">${log.pnl >= 0 ? '+' : ''}$${log.pnl.toFixed(2)}</td>
        <td><b>$${log.botBal.toFixed(2)}</b></td>
    </tr>`;

    container.insertAdjacentHTML('afterbegin', row);
    savePersistentState();
}

function showToast(msg, type = 'info') {
    let container = document.getElementById("toastContainer");
    let toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerText = msg;
    container.appendChild(toast);
    setTimeout(() => { toast.remove(); }, 3000);
}

function logConsole(msg) {
    let terminal = document.getElementById("sysTerminal");
    terminal.innerHTML += `${msg}<br>`;
    terminal.scrollTop = terminal.scrollHeight;
    savePersistentState();
}
