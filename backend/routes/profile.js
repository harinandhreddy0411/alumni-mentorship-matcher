const express = require('express');
const pool = require('../db/pool');
const { requireSession, requireRole } = require('../middleware/requireSession');

const router = express.Router();

router.get('/profile', requireSession, async (req, res) => {
    const [rows] = await pool.query(
        'SELECT full_name, email, focus_track, professional_bio, role FROM users WHERE user_id = ?',
        [req.user.user_id]
    );
    const [skills] = await pool.query(
        `SELECT s.skill_id, s.name, s.category, us.level
         FROM user_skills us JOIN skills s ON s.skill_id = us.skill_id
         WHERE us.user_id = ? ORDER BY s.name`,
        [req.user.user_id]
    );
    res.json({ success: true, profile: rows[0], skills });
});

router.put('/profile', requireSession, async (req, res) => {
    const { fullName, email, focusTrack, bio } = req.body;
    if (!fullName || !String(fullName).trim()) {
        return res.status(400).json({ success: false, error: 'Name is required' });
    }
    await pool.query(
        'UPDATE users SET full_name = ?, email = ?, focus_track = ?, professional_bio = ? WHERE user_id = ?',
        [fullName, email || null, focusTrack || null, bio || null, req.user.user_id]
    );
    res.json({ success: true });
});

router.get('/skills', requireSession, async (req, res) => {
    const [rows] = await pool.query('SELECT skill_id, name, category FROM skills ORDER BY category, name');
    res.json({ success: true, skills: rows });
});

router.post('/skills', requireSession, requireRole('student', 'alumni'), async (req, res) => {
    const name = String(req.body.name || '').replace(/[|]/g, ' ').replace(/\s+/g, ' ').trim();
    if (name.length < 2 || name.length > 40) {
        return res.status(400).json({ success: false, error: 'A skill name needs 2 to 40 characters' });
    }
    const [found] = await pool.query('SELECT skill_id, name, category FROM skills WHERE name = ?', [name]);
    if (found.length > 0) return res.json({ success: true, skill: found[0] });
    const [result] = await pool.query("INSERT INTO skills (name, category) VALUES (?, 'Other')", [name]);
    res.json({ success: true, skill: { skill_id: result.insertId, name, category: 'Other' } });
});

router.put('/profile/skills', requireSession, requireRole('student', 'alumni'), async (req, res) => {
    const items = Array.isArray(req.body.skills) ? req.body.skills : [];
    const levels = ['beginner', 'intermediate', 'expert'];
    const clean = items
        .map(i => ({ id: Number(i.skillId), level: levels.includes(i.level) ? i.level : 'intermediate' }))
        .filter(i => Number.isInteger(i.id) && i.id > 0);
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query('DELETE FROM user_skills WHERE user_id = ?', [req.user.user_id]);
        if (clean.length > 0) {
            await conn.query(
                'INSERT INTO user_skills (user_id, skill_id, level) VALUES ?',
                [clean.map(i => [req.user.user_id, i.id, i.level])]
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

router.get('/capacity', requireSession, requireRole('alumni'), async (req, res) => {
    const [rows] = await pool.query(
        'SELECT capacity_status, max_mentees, preferred_hours, verification_status, graduation_year, department FROM alumni_details WHERE alumni_id = ?',
        [req.user.user_id]
    );
    const [slots] = await pool.query(
        `SELECT slot_id, weekday, TIME_FORMAT(start_time, '%H:%i') AS start_time, TIME_FORMAT(end_time, '%H:%i') AS end_time
         FROM availability_slots WHERE alumni_id = ? ORDER BY weekday, start_time`,
        [req.user.user_id]
    );
    const [[{ current }]] = await pool.query(
        "SELECT COUNT(*) AS current FROM mentorship_requests WHERE alumni_id = ? AND status = 'accepted'",
        [req.user.user_id]
    );
    res.json({ success: true, capacity: { ...rows[0], current_mentees: current }, slots });
});

router.put('/capacity', requireSession, requireRole('alumni'), async (req, res) => {
    const { status, maxMentees, preferredHours, slots } = req.body;
    if (!['active', 'paused'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    const max = Number(maxMentees);
    if (!Number.isInteger(max) || max < 1 || max > 20) {
        return res.status(400).json({ success: false, error: 'Maximum mentees must be between 1 and 20' });
    }
    const cleanSlots = (Array.isArray(slots) ? slots : [])
        .map(s => [req.user.user_id, Number(s.weekday), s.startTime, s.endTime])
        .filter(s => Number.isInteger(s[1]) && s[1] >= 0 && s[1] <= 6 && /^\d{2}:\d{2}$/.test(s[2]) && /^\d{2}:\d{2}$/.test(s[3]) && s[3] > s[2]);
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        await conn.query(
            'UPDATE alumni_details SET capacity_status = ?, max_mentees = ?, preferred_hours = ? WHERE alumni_id = ?',
            [status, max, preferredHours || null, req.user.user_id]
        );
        if (Array.isArray(slots)) {
            await conn.query('DELETE FROM availability_slots WHERE alumni_id = ?', [req.user.user_id]);
            if (cleanSlots.length > 0) {
                await conn.query(
                    'INSERT IGNORE INTO availability_slots (alumni_id, weekday, start_time, end_time) VALUES ?',
                    [cleanSlots]
                );
            }
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

module.exports = router;
