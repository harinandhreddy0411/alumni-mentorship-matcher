const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const pool = require('../db/pool');
const { requireSession } = require('../middleware/requireSession');

const router = express.Router();

router.get('/me', requireSession, (req, res) => {
    res.json({ success: true, user: req.user });
});

router.post('/register', async (req, res) => {
    const { username, password, role, fullName, graduationYear, department } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    if (!['student', 'alumni'].includes(role)) {
        return res.status(400).json({ success: false, error: 'Invalid role' });
    }
    const gradYear = Number(graduationYear);
    const dept = String(department || '').trim();
    if (role === 'alumni' && (!Number.isInteger(gradYear) || gradYear < 1990 || gradYear > 2100 || dept.length < 2)) {
        return res.status(400).json({ success: false, error: 'Alumni must give a graduation year and a department' });
    }
    if (String(password).length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters' });
    }
    const [existing] = await pool.query('SELECT user_id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
        return res.status(409).json({ success: false, error: 'Username unavailable' });
    }
    const hash = await bcrypt.hash(password, 10);
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.query(
            'INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)',
            [username, hash, role, fullName || username]
        );
        if (role === 'alumni') {
            await conn.query('INSERT INTO alumni_details (alumni_id, graduation_year, department) VALUES (?, ?, ?)', [result.insertId, gradYear, dept.slice(0, 60)]);
        }
        await conn.commit();
        res.json({ success: true, userId: result.insertId });
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
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
        `INSERT INTO sessions (user_id, token, expires_at)
         VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 7 DAY))
         ON DUPLICATE KEY UPDATE token = VALUES(token), login_ts = NOW(), expires_at = VALUES(expires_at)`,
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
