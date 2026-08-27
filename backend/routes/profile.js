const express = require('express');
const pool = require('../db/pool');
const { requireSession, requireRole } = require('../middleware/requireSession');

const router = express.Router();

router.get('/profile', requireSession, async (req, res) => {
    const [rows] = await pool.query(
        'SELECT full_name, email, focus_track, professional_bio FROM users WHERE user_id = ?',
        [req.user.user_id]
    );
    res.json({ success: true, profile: rows[0] });
});

router.put('/profile', requireSession, async (req, res) => {
    const { fullName, email, focusTrack, bio } = req.body;
    await pool.query(
        'UPDATE users SET full_name = ?, email = ?, focus_track = ?, professional_bio = ? WHERE user_id = ?',
        [fullName, email, focusTrack, bio, req.user.user_id]
    );
    res.json({ success: true });
});

router.get('/capacity', requireSession, requireRole('alumni'), async (req, res) => {
    const [rows] = await pool.query(
        'SELECT capacity_status, max_mentees, preferred_hours FROM alumni_details WHERE alumni_id = ?',
        [req.user.user_id]
    );
    res.json({ success: true, capacity: rows[0] });
});

router.put('/capacity', requireSession, requireRole('alumni'), async (req, res) => {
    const { status, maxMentees, preferredHours } = req.body;
    await pool.query(
        'UPDATE alumni_details SET capacity_status = ?, max_mentees = ?, preferred_hours = ? WHERE alumni_id = ?',
        [status, maxMentees, preferredHours, req.user.user_id]
    );
    res.json({ success: true });
});

module.exports = router;