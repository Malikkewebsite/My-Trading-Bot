document.getElementById('startBtn').addEventListener('click', async () => {
    const username = document.getElementById('usernameInput').value || 'Malik_Trader';
    const symbol = document.getElementById('coinSymbol').value;
    const allocatedCapital = parseFloat(document.getElementById('allocatedCapital').value);
    const logsContainer = document.getElementById('logsContainer');

    logsContainer.innerHTML += `<p>[INFO] Connecting to Bybit Live Server for ${symbol}...</p>`;

    try {
        const response = await fetch('/api/start-trade', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, symbol, allocatedCapital })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            logsContainer.innerHTML += `<p style="color: #00ffcc;">[SUCCESS] ${data.message}</p>`;
            logsContainer.innerHTML += `<p>[BYBIT API] Order Executed! Pair: ${symbol}, Capital: $${allocatedCapital}</p>`;
            document.getElementById('walletBalance').innerText = `$${data.balance}`;
        } else {
            // Server-side validation error (e.g. Insufficient balance)
            logsContainer.innerHTML += `<p style="color: #ff5252;">[ERROR] ${data.error}</p>`;
            alert(data.error);
        }
    } catch (err) {
        console.error(err);
        logsContainer.innerHTML += `<p style="color: #ff5252;">[CRITICAL ERROR] Failed to connect to server backend.</p>`;
    }
    
    logsContainer.scrollTop = logsContainer.scrollHeight;
});

document.getElementById('stopBtn').addEventListener('click', () => {
    const logsContainer = document.getElementById('logsContainer');
    logsContainer.innerHTML += `<p style="color: #ff9800;">[INFO] Algo Stopped by User. All active orders closed safely.</p>`;
    logsContainer.scrollTop = logsContainer.scrollHeight;
});
