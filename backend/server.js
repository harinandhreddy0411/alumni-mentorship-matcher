require('dotenv').config();
const express = require('express');
const cors = require('cors');
require('express-async-errors');
const pool = require('./db/pool');

const app = express();

const allowedOrigins = new Set(['https://harinandhreddy0411.github.io', 'null']);
const localOrigin = /^http:\/\/(localhost|127\.0\.0\.1):\d+$/;

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin) || localOrigin.test(origin)) return callback(null, true);
        callback(new Error('Origin not allowed'));
    }
}));
app.use(express.json({ limit: '100kb' }));

app.use('/api/auth', require('./routes/auth'));
app.use('/api', require('./routes/public'));
app.use('/api', require('./routes/mentorship'));
app.use('/api', require('./routes/profile'));
app.use('/api', require('./routes/messages'));
app.use('/api', require('./routes/meetings'));
app.use('/api', require('./routes/invites'));
app.use('/api/admin', require('./routes/admin'));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/health/db', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ ok: true, database: 'reachable' });
    } catch (err) {
        res.status(503).json({ ok: false, database: 'unreachable', code: err.code });
    }
});

app.use((err, req, res, next) => {
    if (err.sqlState === '45000') {
        return res.status(400).json({ success: false, error: err.sqlMessage });
    }
    if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ success: false, error: 'That record already exists' });
    }
    if (err.errno === 3819 || err.errno === 4025) {
        return res.status(400).json({ success: false, error: 'A value is outside the allowed range' });
    }
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
        return res.status(400).json({ success: false, error: 'Referenced record does not exist' });
    }
    console.error('Unhandled route error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});

process.on('unhandledRejection', err => console.error('Unhandled rejection:', err));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on ${port}`));
