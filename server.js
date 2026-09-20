const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB Connected Successfully!'))
    .catch((err) => console.error('Database connection error:', err));

// Supabase Client Initialization
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Test Route
app.get('/', (req, res) => {
    res.json({ status: 'success', message: 'API is running smoothly with Supabase & MongoDB!' });
});

// Save Transaction Route (Deposit / Withdraw to Supabase)
app.post('/api/transactions', async (req, res) => {
    try {
        const { user_id, type, amount, status } = req.body;
        const { data, error } = await supabase
            .from('transactions')
            .insert([{ user_id, type, amount, status: status || 'pending' }]);

        if (error) throw error;
        res.status(201).json({ status: 'success', message: 'Transaction saved to Supabase!', data });
    } catch (err) {
        console.error('Supabase Error:', err.message);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Get Transactions Route
app.get('/api/transactions', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;
        res.status(200).json({ status: 'success', data });
    } catch (err) {
        console.error('Supabase Error:', err.message);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Server Listen
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
