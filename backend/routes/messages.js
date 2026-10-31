const express = require('express');
const pool = require('../db/pool');
const { requireSession, requireRole } = require('../middleware/requireSession');

const router = express.Router();
const participant = [requireSession, requireRole('student', 'alumni')];

async function loadMatch(requestId, userId) {
    const [rows] = await pool.query(
        `SELECT r.request_id, r.status, r.student_id, r.alumni_id,
                s.full_name AS student_name, a.full_name AS mentor_name
         FROM mentorship_requests r
         JOIN users s ON s.user_id = r.student_id
         JOIN users a ON a.user_id = r.alumni_id
         WHERE r.request_id = ? AND (r.student_id = ? OR r.alumni_id = ?)`,
        [requestId, userId, userId]
    );
    return rows[0];
}

router.get('/messages/:requestId', participant, async (req, res) => {
    const uid = req.user.user_id;
    const match = await loadMatch(req.params.requestId, uid);
    if (!match) return res.status(404).json({ success: false, error: 'Conversation not found' });
    await pool.query(
        'UPDATE messages SET is_read = 1 WHERE request_id = ? AND sender_id <> ? AND is_read = 0',
        [match.request_id, uid]
    );
    const [messages] = await pool.query(
        `SELECT message_id, sender_id, body, DATE_FORMAT(sent_ts, '%Y-%m-%dT%H:%i:%s') AS sent_ts
         FROM messages WHERE request_id = ? AND message_id > ? ORDER BY message_id ASC`,
        [match.request_id, Number(req.query.after) || 0]
    );
    res.json({
        success: true,
        open: match.status === 'accepted',
        otherName: match.student_id === uid ? match.mentor_name : match.student_name,
        messages
    });
});

router.post('/messages/:requestId', participant, async (req, res) => {
    const body = String(req.body.body || '').trim();
    if (!body) return res.status(400).json({ success: false, error: 'Message is empty' });
    if (body.length > 2000) return res.status(400).json({ success: false, error: 'Message is too long' });
    const match = await loadMatch(req.params.requestId, req.user.user_id);
    if (!match) return res.status(404).json({ success: false, error: 'Conversation not found' });
    const [result] = await pool.query(
        'INSERT INTO messages (request_id, sender_id, body) VALUES (?, ?, ?)',
        [match.request_id, req.user.user_id, body]
    );
    res.json({ success: true, messageId: result.insertId });
});

router.get('/notifications', requireSession, async (req, res) => {
    const [rows] = await pool.query(
        `SELECT notification_id, kind, message, is_read, DATE_FORMAT(created_ts, '%Y-%m-%dT%H:%i:%s') AS created_ts
         FROM notifications WHERE user_id = ? ORDER BY notification_id DESC LIMIT 30`,
        [req.user.user_id]
    );
    const [[{ unread }]] = await pool.query(
        'SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND is_read = 0',
        [req.user.user_id]
    );
    res.json({ success: true, notifications: rows, unread });
});

router.post('/notifications/read', requireSession, async (req, res) => {
    await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0', [req.user.user_id]);
    res.json({ success: true });
});

module.exports = router;
