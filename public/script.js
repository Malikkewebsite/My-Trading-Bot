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

// Request Push Notification Permission
notifyBtn.addEventListener('click', async () => {
    if (!("Notification" in window)) {
        alert("This browser does not support desktop push notifications.");
        return;
    }
    const permission = await Notification.requestPermission();
    if (permission === "granted") {
        notifyBtn.textContent = "🔕 Alerts Active";
        notifyBtn.style.background = "#10B981";
        notifyBtn.style.color = "#FFFFFF";
        new Notification("CryptoSignals Alert", { body: "Push notifications enabled for live spot signals!" });
    } else {
        alert("Notification permissions denied.");
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
        fetchSignals(); // Refresh cards to show admin buttons
    } else {
        alert('Invalid Admin Password!');
        adminPasswordInput.value = '';
    }
});

// Reset Form to Create Mode
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
            // Update Existing Trade
            const { error } = await supabaseClient
                .from('signals')
                .update({ symbol, trade_type, order_type, entry_price, target_price, stop_loss })
                .eq('id', id);

            if (error) throw error;
            alert('Signal Updated Successfully!');
        } else {
            // Insert New Trade
            const { error } = await supabaseClient
                .from('signals')
                .insert([{ symbol, trade_type, order_type, entry_price, target_price, stop_loss, status: 'ACTIVE' }]);

            if (error) throw error;
            alert('Signal Broadcasted Successfully & Live Push Triggered!');
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

// Fetch Signals
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

// Render Signals with Admin Control Buttons
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

// Global Admin Functions for Card Actions
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

// Real-Time Supabase Listener
function setupRealtimeListener() {
    supabaseClient
        .channel('public:signals')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'signals' }, payload => {
            console.log('Real-time change received:', payload);
            if (payload.eventType === 'INSERT' && Notification.permission === "granted") {
                const newSignal = payload.new;
                new Notification(`🚨 New Spot Signal: ${newSignal.symbol} (${newSignal.trade_type})`, {
                    body: `Order: ${newSignal.order_type}\nEntry: ${newSignal.entry_price}\nTarget: ${newSignal.target_price}`,
                });
            }
            fetchSignals();
        })
        .subscribe();
}

fetchSignals();
setupRealtimeListener();
