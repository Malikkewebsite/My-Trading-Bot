const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

let broadcastSignals = [];

app.get('/api/signals', (req, res) => {
    res.json(broadcastSignals);
});

app.post('/api/signals', (req, res) => {
    const { password, symbol, type, entry, target, stopLoss } = req.body;

    // Check Admin Password
    if (password !== 'MalikSabSignals') {
        return res.status(401).json({ success: false, message: 'Invalid Admin Password!' });
    }

    const signal = {
        id: Date.now(),
        symbol: symbol.toUpperCase(),
        type,
        entry,
        target,
        stopLoss,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    broadcastSignals.unshift(signal);
    res.json({ success: true, signal });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
