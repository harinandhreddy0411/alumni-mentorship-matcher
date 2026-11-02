const express = require('express');
const pool = require('../db/pool');
const { requireSession, requireRole } = require('../middleware/requireSession');

const router = express.Router();

router.get('/mentors', requireSession, requireRole('student'), async (req, res) => {
    const [results] = await pool.query('CALL sp_recommend_mentors(?)', [req.user.user_id]);
    const mentors = results[0].map(m => ({
        ...m,
        avg_rating: m.avg_rating === null ? null : Number(m.avg_rating),
        shared_skills: Number(m.shared_skills),
        rank_pos: Number(m.rank_pos)
    }));
    res.json({ success: true, mentors });
});

router.get('/mentors/:id', requireSession, requireRole('student'), async (req, res) => {
    const [rows] = await pool.query("SELECT * FROM v_mentor_load WHERE alumni_id = ? AND verification_status = 'verified'", [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ success: false, error: 'Mentor not found' });
    const [skills] = await pool.query(
        `SELECT s.name, s.category, us.level FROM user_skills us
         JOIN skills s ON s.skill_id = us.skill_id WHERE us.user_id = ? ORDER BY s.name`,
        [req.params.id]
    );
    const [slots] = await pool.query(
        `SELECT weekday, TIME_FORMAT(start_time, '%H:%i') AS start_time, TIME_FORMAT(end_time, '%H:%i') AS end_time
         FROM availability_slots WHERE alumni_id = ? ORDER BY weekday, start_time`,
        [req.params.id]
    );
    const [reviews] = await pool.query(
        `SELECT rv.rating, rv.comment, rv.created_ts, s.full_name AS reviewer
         FROM reviews rv
         JOIN meetings m ON m.meeting_id = rv.meeting_id
         JOIN mentorship_requests r ON r.request_id = m.request_id
         JOIN users s ON s.user_id = r.student_id
         WHERE r.alumni_id = ? ORDER BY rv.created_ts DESC LIMIT 5`,
        [req.params.id]
    );
    const [[{ shared }]] = await pool.query('SELECT fn_match_score(?, ?) AS shared', [req.user.user_id, req.params.id]);
    const mentor = rows[0];
    res.json({
        success: true,
        mentor: { ...mentor, avg_rating: mentor.avg_rating === null ? null : Number(mentor.avg_rating), shared_skills: Number(shared) },
        skills, slots, reviews
    });
});

router.post('/requests', requireSession, requireRole('student'), async (req, res) => {
    const { alumniId, focusArea, pitchMessage } = req.body;
    if (!alumniId || !pitchMessage) {
        return res.status(400).json({ success: false, error: 'Missing mentor or pitch' });
    }
    const [results] = await pool.query(
        'CALL sp_send_request(?, ?, ?, ?)',
        [req.user.user_id, alumniId, focusArea || null, pitchMessage]
    );
    res.json({ success: true, requestId: results[0][0].request_id });
});

router.get('/requests/mine', requireSession, requireRole('student'), async (req, res) => {
    const [rows] = await pool.query(
        `SELECT r.request_id, r.status, r.focus_area, r.pitch_message, r.creation_ts,
                u.user_id AS mentor_id, u.full_name AS mentor_name, u.focus_track AS mentor_track,
                CASE WHEN r.status = 'accepted' THEN u.email END AS mentor_email
         FROM mentorship_requests r JOIN users u ON u.user_id = r.alumni_id
         WHERE r.student_id = ? ORDER BY r.creation_ts DESC, r.request_id DESC`,
        [req.user.user_id]
    );
    res.json({ success: true, requests: rows });
});

router.get('/requests/incoming', requireSession, requireRole('alumni'), async (req, res) => {
    const [rows] = await pool.query(
        `SELECT q.request_id, q.focus_area, q.pitch_message, q.creation_ts,
                q.student_id, q.student_name, q.student_track,
                fn_match_score(q.student_id, q.alumni_id) AS shared_skills,
                (SELECT GROUP_CONCAT(sk.name ORDER BY FIELD(us.level, 'expert', 'intermediate', 'beginner'), sk.name SEPARATOR '|')
                   FROM user_skills us JOIN skills sk ON sk.skill_id = us.skill_id
                  WHERE us.user_id = q.student_id) AS skills
         FROM v_pending_queue q
         WHERE q.alumni_id = ? ORDER BY q.creation_ts ASC, q.request_id ASC`,
        [req.user.user_id]
    );
    res.json({ success: true, requests: rows.map(r => ({ ...r, shared_skills: Number(r.shared_skills) })) });
});

router.get('/requests/mentees', requireSession, requireRole('alumni'), async (req, res) => {
    const [rows] = await pool.query(
        `SELECT m.request_id, m.student_id, m.student_name, m.student_track, m.focus_area,
                m.matched_since AS creation_ts, u.email AS student_email
         FROM v_active_matches m JOIN users u ON u.user_id = m.student_id
         WHERE m.alumni_id = ? ORDER BY m.matched_since DESC`,
        [req.user.user_id]
    );
    res.json({ success: true, mentees: rows });
});

router.patch('/requests/:id', requireSession, requireRole('alumni'), async (req, res) => {
    const { status } = req.body;
    if (!['accepted', 'declined'].includes(status)) {
        return res.status(400).json({ success: false, error: 'Invalid status' });
    }
    await pool.query('CALL sp_respond_request(?, ?, ?)', [req.user.user_id, req.params.id, status]);
    res.json({ success: true });
});

router.get('/matches/mine', requireSession, requireRole('student', 'alumni'), async (req, res) => {
    const uid = req.user.user_id;
    const [rows] = await pool.query(
        `SELECT v.request_id, v.student_id, v.student_name, v.alumni_id, v.mentor_name, v.focus_area, v.matched_since,
                (SELECT COUNT(*) FROM messages m
                  WHERE m.request_id = v.request_id AND m.sender_id <> ? AND m.is_read = 0) AS unread,
                (SELECT DATE_FORMAT(MIN(mt.scheduled_at), '%Y-%m-%dT%H:%i:%sZ') FROM meetings mt
                  WHERE mt.request_id = v.request_id AND mt.status = 'scheduled'
                    AND mt.scheduled_at > UTC_TIMESTAMP()) AS next_meeting
         FROM v_active_matches v
         WHERE v.student_id = ? OR v.alumni_id = ?
         ORDER BY v.matched_since DESC`,
        [uid, uid, uid]
    );
    const matches = rows.map(r => ({
        request_id: r.request_id,
        focus_area: r.focus_area,
        matched_since: r.matched_since,
        unread: Number(r.unread),
        next_meeting: r.next_meeting,
        other_id: r.student_id === uid ? r.alumni_id : r.student_id,
        other_name: r.student_id === uid ? r.mentor_name : r.student_name
    }));
    res.json({ success: true, matches });
});

module.exports = router;
