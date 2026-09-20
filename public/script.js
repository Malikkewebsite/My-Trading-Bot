async function verifyAccess() {
  const passcode = document.getElementById('passcodeInput').value;
  if(!passcode) {
    alert('Please enter a passcode');
    return;
  }
  try {
    const res = await fetch('/api/verify-passcode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode })
    });
    const data = await res.json();
    if(data.success) {
      window.location.href = 'dashboard.html';
    } else {
      alert('Access Denied: Invalid Passcode');
    }
  } catch(err) {
    console.error(err);
    alert('Error verifying passcode');
  }
}

async function fetchTicker() {
  const priceEl = document.getElementById('livePrice');
  if(!priceEl) return;
  try {
    const res = await fetch('/api/bybit/ticker');
    const data = await res.json();
    if(data.result && data.result.list && data.result.list.length > 0) {
      priceEl.innerText = `$${parseFloat(data.result.list[0].lastPrice).toLocaleString()}`;
    }
  } catch(err) {
    console.error('Ticker fetch error:', err);
  }
}

function generatePasscode() {
  const randomKey = 'SMC-' + Math.random().toString(36).substring(2, 10).toUpperCase();
  document.getElementById('generatedKey').innerText = `Generated Passcode: ${randomKey}`;
}

// Auto update ticker if on dashboard
if(document.getElementById('livePrice')) {
  fetchTicker();
  setInterval(fetchTicker, 3000);
}

function toggleBot() {
  alert('Bot execution status toggled successfully!');
}
