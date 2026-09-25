document.addEventListener('DOMContentLoaded', () => {
    fetchLiveTrades();
    setInterval(fetchLiveTrades, 4000); // Poll every 4 seconds for real-time sync
});

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        alert('Browser does not support notifications.');
        return;
    }
    let permission = await Notification.requestPermission();
    if (permission === 'granted') {
        alert('Push notifications enabled successfully!');
    } else {
        alert('Notification permission denied.');
    }
}

async function executeAndBroadcastTrade() {
    const symbol = document.getElementById('trade-symbol').value.toUpperCase();
    const type = document.getElementById('trade-type').value;
    const entry = document.getElementById('trade-entry').value;
    const target = document.getElementById('trade-target').value;
    const stopLoss = document.getElementById('trade-sl').value;

    if (!symbol || !entry) {
        alert('Please fill out at least the symbol and entry price.');
        return;
    }

    const tradeData = { symbol, type, entry, target, stopLoss };

    try {
        let res = await fetch('/api/trades', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(tradeData)
        });
        let data = await res.json();
        if (data.success) {
            alert('Trade executed and broadcasted successfully!');
            // Clear inputs
            document.getElementById('trade-symbol').value = '';
            document.getElementById('trade-entry').value = '';
            document.getElementById('trade-target').value = '';
            document.getElementById('trade-sl').value = '';
            fetchLiveTrades();
        }
    } catch (e) {
        alert('Failed to broadcast trade.');
    }
}

let lastFetchedCount = 0;
async function fetchLiveTrades() {
    try {
        let res = await fetch('/api/trades');
        let trades = await res.json();
        let tbody = document.getElementById('signals-tbody');
        
        if (trades.length === 0) {
            tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: #8b949e;">No active signals right now.</td></tr>`;
            return;
        }

        // Trigger notification if a new trade arrives
        if (trades.length > lastFetchedCount && lastFetchedCount !== 0) {
            let latest = trades[0];
            triggerPushNotification(`🚨 New Trade Signal: ${latest.symbol}`, `${latest.type} at $${latest.entry} (Target: $${latest.target})`);
        }
        lastFetchedCount = trades.length;

        tbody.innerHTML = '';
        trades.forEach(t => {
            let tr = document.createElement('tr');
            let typeClass = t.type === 'LONG' ? 'badge-long' : 'badge-short';
            tr.innerHTML = `
                <td><strong>${t.symbol}</strong></td>
                <td class="${typeClass}">${t.type}</td>
                <td>$${t.entry}</td>
                <td>$${t.target || 'N/A'}</td>
                <td style="color: #8b949e; font-size: 11px;">${t.timestamp}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {}
}

function triggerPushNotification(title, body) {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png'
        });
    }
}
