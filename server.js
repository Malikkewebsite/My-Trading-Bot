const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:Malik2026@db.sbrtwcchusogvsopnjes.supabase.co:5432/postgres",
    ssl: { rejectUnauthorized: false }
});

pool.connect(async (err, client, release) => {
    if (err) {
        console.error('Database connection error:', err.stack);
    } else {
        console.log('Connected to Supabase PostgreSQL Database successfully!');
        release();
        
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                balance NUMERIC(18, 2) DEFAULT 100.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS trades (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                symbol VARCHAR(20) NOT NULL,
                amount NUMERIC(18, 2) NOT NULL,
                status VARCHAR(20) DEFAULT 'ACTIVE',
                pnl NUMERIC(18, 2) DEFAULT 0.00,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) NOT NULL,
                type VARCHAR(20) NOT NULL,
                amount NUMERIC(18, 2) NOT NULL,
                status VARCHAR(20) DEFAULT 'PENDING',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
    }
});

app.post('/api/start-trade', async (req, res) => {
    const { username, symbol, allocatedCapital } = req.body;
    try {
        let userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username || 'Malik_Trader']);
        let user;
        if (userResult.rows.length === 0) {
            const newUser = await pool.query(
                'INSERT INTO users (username, balance) VALUES ($1, $2) RETURNING *',
                [username || 'Malik_Trader', 100.00]
            );
            user = newUser.rows[0];
        } else {
            user = userResult.rows[0];
        }

        const currentBalance = parseFloat(user.balance);
        const requestedAmount = parseFloat(allocatedCapital);

        if (requestedAmount > currentBalance) {
            return res.status(400).json({ 
                success: false, 
                error: `Bybit Exchange Error [10002]: Insufficient wallet balance ($${currentBalance}). Requested capital ($${requestedAmount}) exceeds available funds.` 
            });
        }

        const tradeResult = await pool.query(
            'INSERT INTO trades (username, symbol, amount, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [username || 'Malik_Trader', symbol, requestedAmount, 'ACTIVE']
        );

        res.json({
            success: true,
            message: "Order successfully placed on Bybit Spot API!",
            balance: currentBalance,
            trade: tradeResult.rows[0]
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Bybit Gateway Error [500]: Connection timeout or API rejection.' });
    }
});

app.post('/api/transaction', async (req, res) => {
    const { username, type, amount } = req.body;
    try {
        await pool.query(
            'INSERT INTO transactions (username, type, amount, status) VALUES ($1, $2, $3, $4)',
            [username || 'Malik_Trader', type, amount, 'PENDING']
        );
        res.json({ success: true, message: `${type} request of $${amount} sent to Admin successfully!` });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to submit transaction request.' });
    }
});

app.get('/api/admin/data', async (req, res) => {
    try {
        const users = await pool.query('SELECT * FROM users');
        const trades = await pool.query('SELECT * FROM trades ORDER BY created_at DESC');
        const transactions = await pool.query('SELECT * FROM transactions ORDER BY created_at DESC');
        res.json({ success: true, users: users.rows, trades: trades.rows, transactions: transactions.rows });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to fetch admin data.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
