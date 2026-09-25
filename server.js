require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Initialize Supabase Client with Secret Key for backend operations
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Admin Broadcast Endpoint
app.post('/api/broadcast', async (req, res) => {
    const { password, symbol, trade_type, order_type, entry_price, target_price, stop_loss } = req.body;

    // Verify Admin Password
    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({ success: false, error: 'Invalid admin password!' });
    }

    if (!symbol || !trade_type || !order_type || !entry_price || !target_price || !stop_loss) {
        return res.status(400).json({ success: false, error: 'All signal fields are required.' });
    }

    // Insert signal into Supabase table
    const { data, error } = await supabase
        .from('signals')
        .insert([{
            symbol: symbol.toUpperCase(),
            trade_type,
            order_type,
            entry_price,
            target_price,
            stop_loss
        }])
        .select();

    if (error) {
        return res.status(500).json({ success: false, error: error.message });
    }

    res.json({ success: true, data });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
