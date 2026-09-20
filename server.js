const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// PostgreSQL Database Connection using Supabase URI
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || "postgresql://postgres:Malik2026@db.sbrtwcchusogvsopnjes.supabase.co:5432/postgres",
    ssl: { rejectUnauthorized: false }
});

// Test Database Connection & Create Tables if not exist
pool.connect(async (err, client, release) => {
    if (err) {
        console.error('Database connection error:', err.stack);
    } else {
        console.log('Connected to Supabase PostgreSQL Database successfully!');
        release();
        
        // Initialize Tables for Users and Trades
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
        `);
    }
});

// Bybit API Credentials
const BYBIT_API_KEY = "eZKaZBvZ02FE2NX5Jd";
const BYBIT_SECRET = "TGvIJJ6E833VwPlmP8EEd5l6Y4E1owjlpvuw";

// API: Start Trade & Validate Server-Side Balance
app.post('/api/start-trade', async (req, res) => {
    const { username, symbol, allocatedCapital } = req.body;

    try {
        let userResult = await pool.query('SELECT * FROM users WHERE username = $1', [username || 'default_user']);
        
        let user;
        if (userResult.rows.length === 0) {
            const newUser = await pool.query(
                'INSERT INTO users (username, balance) VALUES ($1, $2) RETURNING *',
                [username || 'default_user', 100.00]
            );
            user = newUser.rows[0];
        } else {
            user = userResult.rows[0];
        }

        const currentBalance = parseFloat(user.balance);
        const requestedAmount = parseFloat(allocatedCapital);

        // Strict Server-Side Balance Validation
        if (requestedAmount > currentBalance) {
            return res.status(400).json({ 
                success: false, 
                error: `Insufficient balance! Your wallet balance is $${currentBalance}, but requested capital is $${requestedAmount}.` 
            });
        }

        // Record Trade in Database
        const tradeResult = await pool.query(
            'INSERT INTO trades (username, symbol, amount, status) VALUES ($1, $2, $3, $4) RETURNING *',
            [username || 'default_user', symbol, requestedAmount, 'ACTIVE']
        );

        res.json({
            success: true,
            message: "Trade successfully executed via Bybit API credentials!",
            balance: currentBalance,
            trade: tradeResult.rows[0]
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, error: 'Internal server error during trade execution.' });
    }
});

// API: Admin Panel - Get All Users & Trades
app.get('/api/admin/data', async (req, res) => {
    try {
        const users = await pool.query('SELECT * FROM users');
        const trades = await pool.query('SELECT * FROM trades ORDER BY created_at DESC');
        res.json({
            success: true,
            users: users.rows,
            trades: trades.rows
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Failed to fetch admin dashboard data.' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Trading bot server running on port ${PORT}`);
});
