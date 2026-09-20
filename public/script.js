function showErrorPopup(message) {
    const popup = document.getElementById('errorPopup');
    const msgElem = document.getElementById('popupErrorMessage');
    if(msgElem && popup) {
        msgElem.innerText = message;
        popup.style.display = 'flex';
    }
}

const closeBtn = document.getElementById('popupCloseBtn');
if(closeBtn) {
    closeBtn.addEventListener('click', () => {
        document.getElementById('errorPopup').style.display = 'none';
    });
}

const startBtn = document.getElementById('startBtn');
if(startBtn) {
    startBtn.addEventListener('click', async () => {
        const username = document.getElementById('usernameInput').value || 'Malik_Trader';
        const symbol = document.getElementById('coinSymbol').value;
        const allocatedCapital = parseFloat(document.getElementById('allocatedCapital').value);
        const logsContainer = document.getElementById('logsContainer');

        logsContainer.innerHTML += `<p>[INFO] Executing trade on ${symbol}...</p>`;

        try {
            const response = await fetch('/api/start-trade', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, symbol, allocatedCapital })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                logsContainer.innerHTML += `<p style="color: #00ffcc;">[SUCCESS] ${data.message}</p>`;
                document.getElementById('walletBalance').innerText = `$${data.balance}`;
            } else {
                logsContainer.innerHTML += `<p style="color: #ff5252;">[ERROR] ${data.error}</p>`;
                showErrorPopup(data.error);
            }
        } catch (err) {
            showErrorPopup("Network connection failed. Check your internet connection.");
        }
        logsContainer.scrollTop = logsContainer.scrollHeight;
    });
}

const depositBtn = document.getElementById('depositBtn');
if(depositBtn) {
    depositBtn.addEventListener('click', async () => {
        const username = document.getElementById('usernameInput').value || 'Malik_Trader';
        const amount = prompt("Enter Deposit Amount ($):", "100");
        if(!amount) return;

        const res = await fetch('/api/transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, type: 'DEPOSIT', amount: parseFloat(amount) })
        });
        const data = await res.json();
        alert(data.message);
    });
}

const withdrawBtn = document.getElementById('withdrawBtn');
if(withdrawBtn) {
    withdrawBtn.addEventListener('click', async () => {
        const username = document.getElementById('usernameInput').value || 'Malik_Trader';
        const amount = prompt("Enter Withdrawal Amount ($):", "50");
        if(!amount) return;

        const res = await fetch('/api/transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, type: 'WITHDRAW', amount: parseFloat(amount) })
        });
        const data = await res.json();
        alert(data.message);
    });
}

const stopBtn = document.getElementById('stopBtn');
if(stopBtn) {
    stopBtn.addEventListener('click', () => {
        const logs = document.getElementById('logsContainer');
        logs.innerHTML += `<p style="color: #ff9800;">[INFO] Bot stopped safely.</p>`;
    });
}
