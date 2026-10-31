const express = require('express');
const bcrypt = require('bcryptjs');
const pool = require('../db/pool');
const { requireSession, requireRole } = require('../middleware/requireSession');

const router = express.Router();
router.use(requireSession, requireRole('admin'));

router.get('/stats', async (req, res) => {
    const [[row]] = await pool.query(
        `SELECT (SELECT COUNT(*) FROM users) AS totalUsers,
                (SELECT COUNT(*) FROM users WHERE role = 'student') AS students,
                (SELECT COUNT(*) FROM users WHERE role = 'alumni') AS mentors,
                (SELECT COUNT(*) FROM mentorship_requests WHERE status = 'accepted') AS activeMatches,
                (SELECT COUNT(*) FROM mentorship_requests WHERE status = 'pending') AS pending,
                (SELECT COUNT(*) FROM meetings WHERE status = 'completed') AS completedMeetings,
                (SELECT COUNT(*) FROM messages) AS messages,
                (SELECT ROUND(AVG(rating), 2) FROM reviews) AS avgRating`
    );
    res.json({
        success: true,
        stats: { ...row, avgRating: row.avgRating === null ? null : Number(row.avgRating) }
    });
});

router.get('/users', async (req, res) => {
    const [rows] = await pool.query(
        'SELECT user_id, username, full_name, role, creation_ts FROM users ORDER BY user_id ASC'
    );
    res.json({ success: true, users: rows });
});

router.post('/users', async (req, res) => {
    const { username, password, role, fullName } = req.body;
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
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [result] = await conn.query(
            'INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)',
            [username, hash, role, fullName || username]
        );
        if (role === 'alumni') {
            await conn.query('INSERT INTO alumni_details (alumni_id) VALUES (?)', [result.insertId]);
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

    const [collision] = await pool.query(
        'SELECT user_id FROM users WHERE username = ? AND user_id != ?',
        [username, req.params.id]
    );
    if (collision.length > 0) {
        return res.status(409).json({ success: false, error: 'That username is already taken by another account' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query(
            'UPDATE users SET username = ?, full_name = ?, role = ? WHERE user_id = ?',
            [username, fullName, role, req.params.id]
        );
        if (role === 'alumni' && previousRole !== 'alumni') {
            await conn.query(
                'INSERT INTO alumni_details (alumni_id) VALUES (?) ON DUPLICATE KEY UPDATE alumni_id = alumni_id',
                [req.params.id]
            );
        }
        await conn.commit();
        res.json({ success: true });
    } catch (err) {
        await conn.rollback();
        throw err;
    } finally {
        conn.release();
    }
});

router.delete('/users/:id', async (req, res) => {
    const [rows] = await pool.query('SELECT role FROM users WHERE user_id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'User not found' });
    if (rows[0].role === 'admin') {
        return res.status(403).json({ success: false, error: 'Cannot terminate an admin account' });
    }
    await pool.query('DELETE FROM users WHERE user_id = ?', [req.params.id]);
    res.json({ success: true });
});

router.get('/matches', async (req, res) => {
    const [rows] = await pool.query(
        `SELECT r.request_id, r.status, r.focus_area, r.creation_ts,
                s.full_name AS student_name, a.full_name AS alumni_name
         FROM mentorship_requests r
         JOIN users s ON s.user_id = r.student_id
         JOIN users a ON a.user_id = r.alumni_id
         WHERE r.status IN ('pending', 'accepted')
         ORDER BY r.creation_ts DESC, r.request_id DESC`
    );
    res.json({ success: true, matches: rows });
});

router.patch('/matches/:id', async (req, res) => {
    await pool.query('CALL sp_cancel_match(?)', [req.params.id]);
    res.json({ success: true });
});

router.get('/analytics', async (req, res) => {
    const [monthly] = await pool.query(
        'SELECT month, total, accepted, declined, pending FROM v_monthly_requests ORDER BY month DESC LIMIT 12'
    );
    const [leaders] = await pool.query(
        `WITH ranked AS (
             SELECT alumni_id, full_name, focus_track, current_mentees, avg_rating, review_count,
                    RANK() OVER (PARTITION BY focus_track
                                 ORDER BY COALESCE(avg_rating, 0) DESC, current_mentees DESC) AS track_rank
             FROM v_mentor_load
         )
         SELECT alumni_id, full_name, focus_track, current_mentees, avg_rating, review_count, track_rank
         FROM ranked WHERE track_rank <= 3 AND focus_track IS NOT NULL
         ORDER BY focus_track, track_rank, full_name`
    );
    const [skills] = await pool.query(
        'SELECT name, category, students, mentors FROM v_skill_demand ORDER BY (students + mentors) DESC, name LIMIT 10'
    );
    const [[rates]] = await pool.query(
        `SELECT SUM(status = 'accepted') AS accepted, SUM(status = 'declined') AS declined,
                SUM(status = 'pending') AS pending FROM mentorship_requests`
    );
    const [idle] = await pool.query(
        `SELECT u.user_id, u.full_name, u.focus_track
         FROM users u
         LEFT JOIN mentorship_requests r ON r.alumni_id = u.user_id
         WHERE u.role = 'alumni' AND r.request_id IS NULL
         ORDER BY u.full_name`
    );
    const decided = Number(rates.accepted || 0) + Number(rates.declined || 0);
    res.json({
        success: true,
        monthly: monthly.reverse().map(m => ({
            month: m.month, total: Number(m.total), accepted: Number(m.accepted),
            declined: Number(m.declined), pending: Number(m.pending)
        })),
        leaders: leaders.map(l => ({ ...l, avg_rating: l.avg_rating === null ? null : Number(l.avg_rating) })),
        skills: skills.map(s => ({ ...s, students: Number(s.students), mentors: Number(s.mentors) })),
        acceptanceRate: decided === 0 ? null : Math.round((Number(rates.accepted) / decided) * 100),
        idleMentors: idle
    });
});

router.get('/audit', async (req, res) => {
    const [rows] = await pool.query(
        `SELECT al.log_id, al.action, al.entity, al.entity_id, al.detail, al.created_ts, u.full_name AS actor
         FROM audit_log al LEFT JOIN users u ON u.user_id = al.actor_id
         ORDER BY al.log_id DESC LIMIT 50`
    );
    res.json({ success: true, entries: rows });
});

module.exports = router;
