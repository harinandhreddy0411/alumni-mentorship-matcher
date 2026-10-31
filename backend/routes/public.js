const express = require('express');
const pool = require('../db/pool');

const router = express.Router();

router.get('/public/summary', async (req, res) => {
    const [[row]] = await pool.query(
        `SELECT (SELECT COUNT(*) FROM users WHERE role = 'alumni') AS mentors,
                (SELECT COUNT(*) FROM users WHERE role = 'student') AS students,
                (SELECT COUNT(*) FROM mentorship_requests WHERE status = 'accepted') AS matches,
                (SELECT COUNT(*) FROM meetings WHERE status = 'completed') AS meetings,
                (SELECT ROUND(AVG(rating), 1) FROM reviews) AS rating`
    );
    res.json({
        success: true,
        summary: {
            mentors: Number(row.mentors),
            students: Number(row.students),
            matches: Number(row.matches),
            meetings: Number(row.meetings),
            rating: row.rating === null ? null : Number(row.rating)
        }
    });
});

module.exports = router;
