const SUPABASE_URL = 'https://sbrtwcchusogvsopnjes.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_H0JP00q2U-oU0kMxTGOrbQ_HlKREikF';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const openAdminBtn = document.getElementById('openAdminBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const adminModal = document.getElementById('adminModal');
const loginSection = document.getElementById('loginSection');
const broadcastSection = document.getElementById('broadcastSection');
const loginBtn = document.getElementById('loginBtn');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const broadcastForm = document.getElementById('broadcastForm');
const signalsGrid = document.getElementById('signalsGrid');
const notifyBtn = document.getElementById('notifyBtn');
const modalTitle = document.getElementById('modalTitle');
const editingSignalId = document.getElementById('editingSignalId');
const cancelEditBtn = document.getElementById('cancelEditBtn');
const broadcastBtn = document.getElementById('broadcastBtn');

let isAdminLoggedIn = false;
const PUBLIC_VAPID_KEY = 'BNty3pSq2RF9kPlfzT2VW9YY11fHAVU2d1KFZdlvFqrVlulo8eH4Wr0e1RgbMwQvQQPYemkVAiZ0wDFNhA4B2J4';

// Register Service Worker on Load for Background Push Capabilities with readiness check
if ('serviceWorker' in navigator) {
    window.addEventListener('load', async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            console.log('ServiceWorker registration successful with scope: ', registration.scope);
            await navigator.serviceWorker.ready;
        } catch (err) {
            console.error('ServiceWorker registration failed: ', err);
        }
    });
}

// Convert VAPID key string to Uint8Array
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

// Request Push Notification Permission & Save Offline Subscription to Supabase
notifyBtn.addEventListener('click', async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        alert("Push notifications are not supported by your browser.");
        return;
    }

    try {
        const permission = await Notification.requestPermission();
        if (permission === "granted") {
            const registration = await navigator.serviceWorker.ready;
            
            // Subscribe to browser push server for offline capability
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
            });

            // Save subscription to Supabase table
            const subJson = subscription.toJSON();
            const { error } = await supabaseClient
                .from('push_subscriptions')
                .upsert([{ endpoint: subJson.endpoint, keys: subJson.keys }], { onConflict: 'endpoint' });

            if (error) throw error;

            notifyBtn.textContent = "🔕 Alerts Active (Offline Ready)";
            notifyBtn.style.background = "#10B981";
            notifyBtn.style.color = "#FFFFFF";
            alert("Success! You will now receive background trade alerts even when the website is closed.");
        } else if (permission === "denied") {
            alert("Notification permissions were blocked. Please reset permissions in your browser address bar settings.");
        } else {
            alert("Notification permission request was dismissed.");
        }
    } catch (err) {
        console.error("Subscription error:", err);
        alert("Error enabling push subscriptions: " + err.message);
    }
});

openAdminBtn.addEventListener('click', () => adminModal.classList.add('active'));
closeModalBtn.addEventListener('click', () => {
    adminModal.classList.remove('active');
    resetForm();
});
adminModal.addEventListener('click', (e) => {
    if (e.target === adminModal) {
        adminModal.classList.remove('active');
        resetForm();
    }
});

loginBtn.addEventListener('click', () => {
    const password = adminPasswordInput.value.trim();
    if (password === 'MalikKaBot') {
        isAdminLoggedIn = true;
        loginSection.style.display = 'none';
        broadcastSection.style.display = 'flex';
        fetchSignals();
    } else {
        alert('Invalid Admin Password!');
        adminPasswordInput.value = '';
    }
});

function resetForm() {
    broadcastForm.reset();
    editingSignalId.value = '';
    modalTitle.textContent = 'Admin Signal Broadcast';
    broadcastBtn.textContent = 'Broadcast Signal';
    cancelEditBtn.style.display = 'none';
}

cancelEditBtn.addEventListener('click', resetForm);

// Handle Insert or Update Form Submission
broadcastForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const id = editingSignalId.value;
    const symbol = document.getElementById('symbolInput').value.trim().toUpperCase();
    const trade_type = document.getElementById('tradeTypeInput').value;
    const order_type = document.getElementById('orderTypeInput').value;
    const entry_price = document.getElementById('entryInput').value.trim();
    const target_price = document.getElementById('targetInput').value.trim();
    const stop_loss = document.getElementById('stopLossInput').value.trim();

    broadcastBtn.textContent = 'Saving...';
    broadcastBtn.disabled = true;

    try {
        if (id) {
            const { error } = await supabaseClient
                .from('signals')
                .update({ symbol, trade_type, order_type, entry_price, target_price, stop_loss })
                .eq('id', id);

            if (error) throw error;
            alert('Signal Updated Successfully!');
        } else {
            const { error } = await supabaseClient
                .from('signals')
                .insert([{ symbol, trade_type, order_type, entry_price, target_price, stop_loss, status: 'ACTIVE' }]);

            if (error) throw error;
            alert('Signal Broadcasted Successfully & Offline Push Triggered via Backend!');
        }

        resetForm();
        adminModal.classList.remove('active');
        fetchSignals();
    } catch (err) {
        console.error(err);
        alert('Error saving signal: ' + err.message);
    } finally {
        broadcastBtn.textContent = id ? 'Update Signal' : 'Broadcast Signal';
        broadcastBtn.disabled = false;
    }
});

async function fetchSignals() {
    const { data, error } = await supabaseClient
        .from('signals')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching signals:', error);
        return;
    }

    renderSignals(data);
}

function renderSignals(signals) {
    if (!signals || signals.length === 0) {
        signalsGrid.innerHTML = `<div class="empty-state">Waiting for live broadcasted signals...</div>`;
        return;
    }

    signalsGrid.innerHTML = '';
    signals.forEach(signal => {
        const card = document.createElement('div');
        card.className = 'signal-card';
        
        const badgeClass = signal.trade_type === 'BUY' ? 'badge-buy' : 'badge-sell';
        const formattedDate = new Date(signal.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

        let statusBadge = '<span class="status-badge status-active">ACTIVE</span>';
        if (signal.status === 'WIN') statusBadge = '<span class="status-badge status-win">WIN (TP HIT)</span>';
        if (signal.status === 'LOSS') statusBadge = '<span class="status-badge status-loss">LOSS (SL HIT)</span>';
        if (signal.status === 'BE') statusBadge = '<span class="status-badge status-be">BREAK-EVEN (B.E)</span>';

        card.innerHTML = `
            <div class="signal-header">
                <span class="symbol-title">${signal.symbol}</span>
                <div style="display: flex; gap: 6px; align-items: center;">
                    ${statusBadge}
                    <span class="order-badge">${signal.order_type}</span>
                    <span class="badge ${badgeClass}">${signal.trade_type}</span>
                </div>
            </div>
            <div class="signal-body">
                <div class="metric-row">
                    <span class="metric-label">Entry Price</span>
                    <span class="metric-value entry">${signal.entry_price}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Target (TP)</span>
                    <span class="metric-value target">${signal.target_price}</span>
                </div>
                <div class="metric-row">
                    <span class="metric-label">Stop Loss (SL)</span>
                    <span class="metric-value sl">${signal.stop_loss}</span>
                </div>
            </div>
            <div class="signal-footer">
                <span>Spot Broadcast</span>
                <span>${formattedDate}</span>
            </div>
            ${isAdminLoggedIn ? `
            <div class="admin-card-actions">
                <button class="btn-edit" onclick="openEditModal(${signal.id}, '${signal.symbol}', '${signal.trade_type}', '${signal.order_type}', '${signal.entry_price}', '${signal.target_price}', '${signal.stop_loss}')">✏️ Edit</button>
                <button class="btn-win" onclick="updateSignalStatus(${signal.id}, 'WIN')">✅ Win</button>
                <button class="btn-loss" onclick="updateSignalStatus(${signal.id}, 'LOSS')">❌ Loss</button>
                <button class="btn-be" onclick="updateSignalStatus(${signal.id}, 'BE')">🛡️ B.E</button>
                <button class="btn-delete" onclick="deleteSignal(${signal.id})">🗑️ Delete</button>
            </div>` : ''}
        `;
        signalsGrid.appendChild(card);
    });
}

window.openEditModal = function(id, symbol, trade_type, order_type, entry_price, target_price, stop_loss) {
    adminModal.classList.add('active');
    loginSection.style.display = 'none';
    broadcastSection.style.display = 'flex';
    modalTitle.textContent = 'Edit Signal #' + id;
    editingSignalId.value = id;
    document.getElementById('symbolInput').value = symbol;
    document.getElementById('tradeTypeInput').value = trade_type;
    document.getElementById('orderTypeInput').value = order_type;
    document.getElementById('entryInput').value = entry_price;
    document.getElementById('targetInput').value = target_price;
    document.getElementById('stopLossInput').value = stop_loss;
    broadcastBtn.textContent = 'Update Signal';
    cancelEditBtn.style.display = 'block';
};

window.updateSignalStatus = async function(id, status) {
    try {
        const { error } = await supabaseClient
            .from('signals')
            .update({ status })
            .eq('id', id);

        if (error) throw error;
        fetchSignals();
    } catch (err) {
        alert('Error updating status: ' + err.message);
    }
};

window.deleteSignal = async function(id) {
    if (!confirm('Are you sure you want to delete this signal?')) return;
    try {
        const { error } = await supabaseClient
            .from('signals')
            .delete()
            .eq('id', id);

        if (error) throw error;
        fetchSignals();
    } catch (err) {
        alert('Error deleting signal: ' + err.message);
    }
};

// Real-Time Supabase Listener for Feed UI updates
function setupRealtimeListener() {
    supabaseClient
        .channel('public:signals')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'signals' }, payload => {
            console.log('Real-time change received:', payload);
            fetchSignals();
        })
        .subscribe();
}

fetchSignals();
setupRealtimeListener();
