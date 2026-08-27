const express = require('express');
const pool = require('../db/pool');
const { requireSession, requireRole } = require('../middleware/requireSession');

const router = express.Router();

// Student browses available alumni — replaces hardcoded SJ/MK/EL cards
router.get('/mentors', requireSession, requireRole('student'), async (req, res) => {
    const [rows] = await pool.query(
        `SELECT u.user_id, u.full_name, u.focus_track, ad.capacity_status
         FROM users u JOIN alumni_details ad ON ad.alumni_id = u.user_id
         WHERE u.role = 'alumni' AND ad.capacity_status = 'active'`
    );
    res.json({ success: true, mentors: rows });
});

// Student submits a request — replaces the alert-only, non-persisting request-mentor.html handler
router.post('/requests', requireSession, requireRole('student'), async (req, res) => {
    const { alumniId, focusArea, pitchMessage } = req.body;
    if (!alumniId || !pitchMessage) {
        return res.status(400).json({ success: false, error: 'Missing mentor or pitch' });
    }
    const [result] = await pool.query(
        `INSERT INTO mentorship_requests (student_id, alumni_id, focus_area, pitch_message)
         VALUES (?, ?, ?, ?)`,
        [req.user.user_id, alumniId, focusArea, pitchMessage]
    );
    res.json({ success: true, requestId: result.insertId });
});

// Student's own requests + accepted mentor (fills your "My Mentor" section with real data)
router.get('/requests/mine', requireSession, requireRole('student'), async (req, res) => {
    const [rows] = await pool.query(
        `SELECT r.request_id, r.status, r.focus_area, r.pitch_message,
                u.user_id AS mentor_id, u.full_name AS mentor_name, u.focus_track AS mentor_track
         FROM mentorship_requests r JOIN users u ON u.user_id = r.alumni_id
         WHERE r.student_id = ? ORDER BY r.creation_ts DESC`,
        [req.user.user_id]
    );
    res.json({ success: true, requests: rows });
});

// Alumni's incoming queue — replaces hardcoded David Chen / Priya Patel cards
router.get('/requests/incoming', requireSession, requireRole('alumni'), async (req, res) => {
    const [rows] = await pool.query(
        `SELECT r.request_id, r.status, r.focus_area, r.pitch_message, r.creation_ts,
                u.user_id AS student_id, u.full_name AS student_name, u.focus_track AS student_track
         FROM mentorship_requests r JOIN users u ON u.user_id = r.student_id
         WHERE r.alumni_id = ? AND r.status = 'pending' ORDER BY r.creation_ts ASC`,
        [req.user.user_id]
    );
    res.json({ success: true, requests: rows });
});

// Alumni's accepted mentees — fills "My Active Mentees" with real data
router.get('/requests/mentees', requireSession, requireRole('alumni'), async (req, res) => {
    const [rows] = await pool.query(
        `SELECT r.request_id, u.full_name AS student_name, u.focus_track AS student_track, r.creation_ts
         FROM mentorship_requests r JOIN users u ON u.user_id = r.student_id
         WHERE r.alumni_id = ? AND r.status = 'accepted'`,
        [req.user.user_id]
    );
    res.json({ success: true, mentees: rows });
});

// Accept / decline — replaces the DOM-only "hide the card" behavior with a real status update
router.patch('/requests/:id', requireSession, requireRole('alumni'), async (req, res) => {
    const { status } = req.body; // 'accepted' | 'declined'
    if (!['accepted', 'declined'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    const [result] = await pool.query(
        `UPDATE mentorship_requests SET status = ? WHERE request_id = ? AND alumni_id = ?`,
        [status, req.params.id, req.user.user_id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ success: false, error: 'Request not found' });
    res.json({ success: true });
});

module.exports = router;