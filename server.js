const express = require('express');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Supabase Connection (Aap yahan apni Supabase URL aur Anon Key laga sakte hain agar zaroorat ho)
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = process.env.SUPABASE_KEY || 'YOUR_SUPABASE_KEY';
const supabase = createClient(supabaseUrl, supabaseKey);

// Codes Endpoint
app.get('/api/codes', async (req, res) => {
    try {
        let { data, error } = await supabase.from('access_codes').select('*');
        if (error) throw error;
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Use Code Endpoint
app.post('/api/codes/use', async (req, res) => {
    const { code } = req.body;
    try {
        let { data, error } = await supabase.from('access_codes').select('*').eq('code', code).single();
        if (error || !data) {
            return res.status(400).json({ status: 'error', message: 'Invalid Passcode!' });
        }
        if (data.is_used) {
            return res.status(400).json({ status: 'error', message: 'Passcode already used!' });
        }

        // Mark code as used
        await supabase.from('access_codes').update({ is_used: true }).eq('code', code);
        res.json({ status: 'success', matchedCode: data });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// Transactions Endpoints
app.get('/api/transactions', async (req, res) => {
    try {
        let { data, error } = await supabase.from('transactions').select('*');
        if (error) throw error;
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.post('/api/transactions', async (req, res) => {
    const txData = req.body;
    try {
        let { data, error } = await supabase.from('transactions').insert([txData]);
        if (error) throw error;
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

app.patch('/api/transactions/:id', async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    try {
        let { data, error } = await supabase.from('transactions').update({ status }).eq('id', id);
        if (error) throw error;
        res.json({ status: 'success', data });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
