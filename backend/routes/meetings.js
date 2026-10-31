const express = require('express');
const pool = require('../db/pool');
const { requireSession, requireRole } = require('../middleware/requireSession');

const router = express.Router();
const participant = [requireSession, requireRole('student', 'alumni')];
const mentee = [requireSession, requireRole('student')];

function toUtcSql(value) {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return null;
    return d.toISOString().slice(0, 19).replace('T', ' ');
}

router.get('/meetings', participant, async (req, res) => {
    const uid = req.user.user_id;
    const [rows] = await pool.query(
        `SELECT m.meeting_id, m.request_id, m.duration_min, m.status, m.meeting_link,
                DATE_FORMAT(m.scheduled_at, '%Y-%m-%dT%H:%i:%sZ') AS scheduled_at,
                r.student_id, r.alumni_id,
                IF(r.student_id = ?, a.full_name, s.full_name) AS other_name,
                rv.rating, rv.comment
         FROM meetings m
         JOIN mentorship_requests r ON r.request_id = m.request_id
         JOIN users s ON s.user_id = r.student_id
         JOIN users a ON a.user_id = r.alumni_id
         LEFT JOIN reviews rv ON rv.meeting_id = m.meeting_id
         WHERE r.student_id = ? OR r.alumni_id = ?
         ORDER BY m.scheduled_at DESC`,
        [uid, uid, uid]
    );
    const meetings = rows.map(m => ({
        meeting_id: m.meeting_id,
        request_id: m.request_id,
        scheduled_at: m.scheduled_at,
        duration_min: m.duration_min,
        status: m.status,
        meeting_link: m.meeting_link,
        other_name: m.other_name,
        rating: m.rating,
        comment: m.comment,
        can_review: m.student_id === uid && m.status === 'completed' && m.rating === null
    }));
    res.json({ success: true, meetings });
});

router.post('/meetings', participant, async (req, res) => {
    const { requestId, scheduledAt, durationMin, meetingLink } = req.body;
    const when = toUtcSql(scheduledAt);
    if (!requestId || !when) {
        return res.status(400).json({ success: false, error: 'Match and a valid time are required' });
    }
    const duration = Number(durationMin) || 30;
    const [results] = await pool.query(
        'CALL sp_book_meeting(?, ?, ?, ?, ?)',
        [req.user.user_id, requestId, when, duration, meetingLink || null]
    );
    res.json({ success: true, meetingId: results[0][0].meeting_id });
});

router.patch('/meetings/:id', participant, async (req, res) => {
    const { status } = req.body;
    if (!['completed', 'cancelled'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    await pool.query('CALL sp_set_meeting_status(?, ?, ?)', [req.user.user_id, req.params.id, status]);
    res.json({ success: true });
});

router.post('/meetings/:id/review', mentee, async (req, res) => {
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ success: false, error: 'Rating must be between 1 and 5' });
    }
    await pool.query(
        'CALL sp_submit_review(?, ?, ?, ?)',
        [req.user.user_id, req.params.id, rating, req.body.comment || null]
    );
    res.json({ success: true });
});

module.exports = router;
