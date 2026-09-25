const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage for active broadcast trades (can be replaced with database later)
let broadcastTrades = [];

app.get('/api/trades', (req, res) => {
    res.json(broadcastTrades);
});

app.post('/api/trades', (req, res) => {
    const trade = {
        id: Date.now(),
        symbol: req.body.symbol,
        type: req.body.type, // LONG / SHORT
        entry: req.body.entry,
        target: req.body.target,
        stopLoss: req.body.stopLoss,
        timestamp: new Date().toLocaleTimeString()
    };
    broadcastTrades.unshift(trade);
    res.json({ success: true, trade });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
