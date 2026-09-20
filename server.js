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

// --- TRANSACTIONS ROUTES ---
app.post('/api/transactions', async (req, res) => {
    try {
        const { user_id, type, amount, status, details } = req.body;
        const { data, error } = await supabase
            .from('transactions')
            .insert([{ user_id, type, amount, status: status || 'pending', details }]);

        if (error) throw error;
        res.status(201).json({ status: 'success', message: 'Transaction saved to Supabase!', data });
    } catch (err) {
        console.error('Supabase Error:', err.message);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

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

app.patch('/api/transactions/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        const { data, error } = await supabase
            .from('transactions')
            .update({ status })
            .eq('id', id);

        if (error) throw error;
        res.status(200).json({ status: 'success', message: 'Transaction status updated!', data });
    } catch (err) {
        console.error('Supabase Error:', err.message);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// --- ACCESS CODES ROUTES ---
app.get('/api/codes', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('access_codes')
            .select('*');
        if (error) throw error;
        res.status(200).json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/codes', async (req, res) => {
    try {
        const { code, plan, seconds, days, is_used } = req.body;
        const { data, error } = await supabase
            .from('access_codes')
            .insert([{ code, plan, seconds, days, is_used: is_used || false }]);
        if (error) throw error;
        res.status(201).json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/codes/use', async (req, res) => {
    try {
        const { code } = req.body;
        // Find code in supabase
        const { data, error } = await supabase
            .from('access_codes')
            .select('*')
            .eq('code', code)
            .eq('is_used', false)
            .single();

        if (error || !data) {
            return res.status(400).json({ status: 'error', message: 'Invalid or Already Used Access Passcode!' });
        }

        // Mark code as used
        await supabase
            .from('access_codes')
            .update({ is_used: true })
            .eq('id', data.id);

        // Generate a new matching replacement code automatically
        let newCodeStr = generateRandomCodeServer(data.plan.includes('20') ? 'T20' : (data.plan.includes('7') ? '7D' : (data.plan.includes('14') ? '14D' : '30D')), data.plan.includes('20') ? 3 : 4);
        await supabase
            .from('access_codes')
            .insert([{
                code: newCodeStr,
                plan: data.plan,
                seconds: data.seconds,
                days: data.days,
                is_used: false
            }]);

        res.status(200).json({ status: 'success', matchedCode: data });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

function generateRandomCodeServer(prefix, len = 3) {
    let chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
    let res = prefix + "-";
    for(let i=0; i<len; i++) {
        res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return res;
}

// Server Listen
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
