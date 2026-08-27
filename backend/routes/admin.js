const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { requireSession, requireRole } = require('../middleware/requireSession');

const router = express.Router();
router.use(requireSession, requireRole('admin'));

// --- Dashboard stats (replaces the hardcoded 142/38/12) ---
router.get('/stats', async (req, res) => {
    const [[{ totalUsers }]] = await pool.query('SELECT COUNT(*) AS totalUsers FROM users');
    const [[{ activeMatches }]] = await pool.query(
        "SELECT COUNT(*) AS activeMatches FROM mentorship_requests WHERE status = 'accepted'"
    );
    const [[{ pending }]] = await pool.query(
        "SELECT COUNT(*) AS pending FROM mentorship_requests WHERE status = 'pending'"
    );
    res.json({ success: true, stats: { totalUsers, activeMatches, pending } });
});

// --- User list (replaces the hardcoded David Chen / Sarah Jenkins / admin_root rows) ---
router.get('/users', async (req, res) => {
    const [rows] = await pool.query(
        'SELECT user_id, username, full_name, role, creation_ts FROM users ORDER BY user_id ASC'
    );
    res.json({ success: true, users: rows });
});

// --- Provision new user (the "Inject Record" form) ---
router.post('/users', async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    if (!['student', 'alumni', 'admin'].includes(role)) {
        return res.status(400).json({ success: false, error: 'Invalid role' });
    }
    const [existing] = await pool.query('SELECT user_id FROM users WHERE username = ?', [username]);
    if (existing.length > 0) {
        return res.status(409).json({ success: false, error: 'Username unavailable' });
    }
    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
        'INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)',
        [username, hash, role, username]
    );
    if (role === 'alumni') {
        await pool.query('INSERT INTO alumni_details (alumni_id) VALUES (?)', [result.insertId]);
    }
    res.json({ success: true, userId: result.insertId });
});

// --- Update an existing user (the missing "U" in CRUD) ---
router.put('/users/:id', async (req, res) => {
    const { username, fullName, role } = req.body;
    if (!username || !fullName || !role) {
        return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    if (!['student', 'alumni', 'admin'].includes(role)) {
        return res.status(400).json({ success: false, error: 'Invalid role' });
    }
    const [existingRows] = await pool.query('SELECT role FROM users WHERE user_id = ?', [req.params.id]);
    if (existingRows.length === 0) return res.status(404).json({ success: false, error: 'User not found' });
    const previousRole = existingRows[0].role;

    // block username collision with a DIFFERENT user
    const [collision] = await pool.query(
        'SELECT user_id FROM users WHERE username = ? AND user_id != ?',
        [username, req.params.id]
    );
    if (collision.length > 0) {
        return res.status(409).json({ success: false, error: 'That username is already taken by another account' });
    }

    await pool.query(
        'UPDATE users SET username = ?, full_name = ?, role = ? WHERE user_id = ?',
        [username, fullName, role, req.params.id]
    );

    // role changed TO alumni and wasn't before — needs an alumni_details row to exist
    if (role === 'alumni' && previousRole !== 'alumni') {
        await pool.query(
            'INSERT INTO alumni_details (alumni_id) VALUES (?) ON DUPLICATE KEY UPDATE alumni_id = alumni_id',
            [req.params.id]
        );
    }

    res.json({ success: true });
});

// --- Terminate user (blocked for admin accounts, matches the "Locked" row in your UI) ---
router.delete('/users/:id', async (req, res) => {
    const [rows] = await pool.query('SELECT role FROM users WHERE user_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'User not found' });
    if (rows[0].role === 'admin') {
        return res.status(403).json({ success: false, error: 'Cannot terminate an admin account' });
    }
    await pool.query('DELETE FROM users WHERE user_id = ?', [req.params.id]); // FK CASCADE cleans up related rows
    res.json({ success: true });
});

// --- Match audit log (replaces the hardcoded REQ-1092 / REQ-0844 rows) ---
router.get('/matches', async (req, res) => {
    const [rows] = await pool.query(
        `SELECT r.request_id, r.status, r.creation_ts,
                s.full_name AS student_name, a.full_name AS alumni_name
         FROM mentorship_requests r
         JOIN users s ON s.user_id = r.student_id
         JOIN users a ON a.user_id = r.alumni_id
         WHERE r.status IN ('pending', 'accepted')
         ORDER BY r.creation_ts DESC`
    );
    res.json({ success: true, matches: rows });
});

// --- Force Cancel (pending) / Revoke Match (accepted) — both just override status to 'declined' ---
router.patch('/matches/:id', async (req, res) => {
    const [result] = await pool.query(
        "UPDATE mentorship_requests SET status = 'declined' WHERE request_id = ?",
        [req.params.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Match not found' });
    res.json({ success: true });
});

module.exports = router;