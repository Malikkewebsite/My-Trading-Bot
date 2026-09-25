// Initialize Supabase client
const SUPABASE_URL = 'https://sbrtwcchusogvsopnjes.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_H0JP00q2U-oU0kMxTGOrbQ_HlKREikF';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

// DOM Elements
const openAdminBtn = document.getElementById('openAdminBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const adminModal = document.getElementById('adminModal');
const loginSection = document.getElementById('loginSection');
const broadcastSection = document.getElementById('broadcastSection');
const loginBtn = document.getElementById('loginBtn');
const adminPasswordInput = document.getElementById('adminPasswordInput');
const broadcastForm = document.getElementById('broadcastForm');
const signalsGrid = document.getElementById('signalsGrid');

// Modal Toggles
openAdminBtn.addEventListener('click', () => adminModal.classList.add('active'));
closeModalBtn.addEventListener('click', () => adminModal.classList.remove('active'));
adminModal.addEventListener('click', (e) => {
    if (e.target === adminModal) adminModal.classList.remove('active');
});

// Admin Password Authentication Check
loginBtn.addEventListener('click', () => {
    const password = adminPasswordInput.value.trim();
    if (password === 'MalikKaBot') {
        loginSection.style.display = 'none';
        broadcastSection.style.display = 'flex';
    } else {
        alert('Invalid Admin Password!');
        adminPasswordInput.value = '';
    }
});

// Handle Broadcast Form Submission (Direct to Supabase)
broadcastForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const symbol = document.getElementById('symbolInput').value.trim().toUpperCase();
    const trade_type = document.getElementById('tradeTypeInput').value;
    const order_type = document.getElementById('orderTypeInput').value;
    const entry_price = document.getElementById('entryInput').value.trim();
    const target_price = document.getElementById('targetInput').value.trim();
    const stop_loss = document.getElementById('stopLossInput').value.trim();

    const broadcastBtn = document.getElementById('broadcastBtn');
    broadcastBtn.textContent = 'Broadcasting Signal...';
    broadcastBtn.disabled = true;

    try {
        const { data, error } = await supabaseClient
            .from('signals')
            .insert([{ symbol, trade_type, order_type, entry_price, target_price, stop_loss }]);

        if (error) {
            throw error;
        }

        alert('Signal Broadcasted Successfully & Live Push Triggered!');
        broadcastForm.reset();
        adminModal.classList.remove('active');
    } catch (err) {
        console.error(err);
        alert('Error broadcasting signal: ' + err.message);
    } finally {
        broadcastBtn.textContent = 'Broadcast Signal';
        broadcastBtn.disabled = false;
    }
});

// Fetch Initial Signals from Supabase
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

// Render Signals to Grid
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

        card.innerHTML = `
            <div class="signal-header">
                <span class="symbol-title">${signal.symbol}</span>
                <div style="display: flex; gap: 6px; align-items: center;">
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
        `;
        signalsGrid.appendChild(card);
    });
}

// Real-Time Supabase Listener
function setupRealtimeListener() {
    supabaseClient
        .channel('public:signals')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'signals' }, payload => {
            console.log('New real-time signal received:', payload.new);
            fetchSignals();
        })
        .subscribe();
}

// Initialize on page load
fetchSignals();
setupRealtimeListener();
