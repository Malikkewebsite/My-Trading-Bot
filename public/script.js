document.addEventListener('DOMContentLoaded', () => {
    fetchSignals();
    setInterval(fetchSignals, 4000); // Poll every 4 seconds
});

async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        alert('This browser does not support desktop notifications.');
        return;
    }
    let permission = await Notification.requestPermission();
    if (permission === 'granted') {
        alert('Notifications enabled successfully!');
    } else {
        alert('Permission denied for notifications.');
    }
}

async function broadcastSignal() {
    const password = document.getElementById('admin-pass').value;
    const symbol = document.getElementById('trade-symbol').value.toUpperCase();
    const type = document.getElementById('trade-type').value;
    const entry = document.getElementById('trade-entry').value;
    const target = document.getElementById('trade-target').value;
    const stopLoss = document.getElementById('trade-sl').value;

    if (!password || !symbol || !entry) {
        alert('Please fill in password, symbol, and entry price.');
        return;
    }

    try {
        let res = await fetch('/api/signals', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password, symbol, type, entry, target, stopLoss })
        });
        let data = await res.json();
        
        if (data.success) {
            alert('Signal broadcasted successfully!');
            // Clear inputs (keep password)
            document.getElementById('trade-symbol').value = '';
            document.getElementById('trade-entry').value = '';
            document.getElementById('trade-target').value = '';
            document.getElementById('trade-sl').value = '';
            fetchSignals();
        } else {
            alert(data.message || 'Unauthorized / Error broadcasting!');
        }
    } catch (e) {
        alert('Failed to connect to server.');
    }
}

let lastCount = 0;
async function fetchSignals() {
    try {
        let res = await fetch('/api/signals');
        let signals = await res.json();
        let tbody = document.getElementById('signals-tbody');
        
        if (signals.length === 0) {
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #94a3b8;">No active signals right now.</td></tr>`;
            return;
        }

        // Trigger notification for users if a new signal arrives
        if (signals.length > lastCount && lastCount !== 0) {
            let latest = signals[0];
            triggerNotification(`🚨 New Signal: ${latest.symbol}`, `${latest.type} | Entry: $${latest.entry} | Target: $${latest.target}`);
        }
        lastCount = signals.length;

        tbody.innerHTML = '';
        signals.forEach(s => {
            let tr = document.createElement('tr');
            let typeClass = s.type === 'LONG' ? 'badge-long' : 'badge-short';
            tr.innerHTML = `
                <td><strong>${s.symbol}</strong></td>
                <td><span class="${typeClass}">${s.type}</span></td>
                <td>$${s.entry}</td>
                <td>$${s.target || '-'}</td>
                <td>$${s.stopLoss || '-'}</td>
                <td style="color: #64748b; font-size: 12px;">${s.timestamp}</td>
            `;
            tbody.appendChild(tr);
        });
    } catch (e) {}
}

function triggerNotification(title, body) {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            body: body,
            icon: 'https://cdn-icons-png.flaticon.com/512/1216/1216733.png'
        });
    }
}
