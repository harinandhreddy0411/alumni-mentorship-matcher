const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../db/pool');
const { requireSession } = require('../middleware/requireSession');

const router = express.Router();

router.get('/me', requireSession, (req, res) => {
    res.json({ success: true, user: req.user }); // { user_id, role, full_name }
});

router.post('/register', async (req, res) => {
    const { username, password, role, fullName } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    if (!['student', 'alumni'].includes(role)) {
        return res.status(400).json({ success: false, error: 'Invalid role' });
    }
    const [existing] = await pool.query('SELECT user_id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
        return res.status(409).json({ success: false, error: 'Username unavailable' });
    }
    const hash = await bcrypt.hash(password, 10);
    // fullName defaults to username since index.html's registration form doesn't collect a separate name
    const [result] = await pool.query(
        'INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)',
        [username, hash, role, fullName || username]
    );
    if (role === 'alumni') {
        await pool.query('INSERT INTO alumni_details (alumni_id) VALUES (?)', [result.insertId]);
    }
    res.json({ success: true, userId: result.insertId });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) {
        return res.status(401).json({ success: false, error: 'Authentication failed' });
    }
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
        return res.status(401).json({ success: false, error: 'Authentication failed' });
    }
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
        `INSERT INTO sessions (user_id, token) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE token = VALUES(token), login_ts = CURRENT_TIMESTAMP`,
        [user.user_id, token]
    );
    res.json({ success: true, role: user.role, token, userId: user.user_id, fullName: user.full_name });
});

router.post('/logout', async (req, res) => {
    const token = req.headers['x-session-token'];
    if (token) await pool.query('DELETE FROM sessions WHERE token = ?', [token]);
    res.json({ success: true });
});

module.exports = router;