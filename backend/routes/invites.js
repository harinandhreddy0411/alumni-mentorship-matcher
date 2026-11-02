const express = require('express');
const pool = require('../db/pool');
const { requireSession, requireRole } = require('../middleware/requireSession');

const router = express.Router();

router.post('/invites', requireSession, requireRole('admin', 'alumni'), async (req, res) => {
    const [results] = await pool.query('CALL sp_create_invite(?)', [req.user.user_id]);
    res.json({ success: true, invite: results[0][0] });
});

router.get('/invites', requireSession, requireRole('admin', 'alumni'), async (req, res) => {
    const [rows] = await pool.query(
        `SELECT i.code, i.created_ts, i.expires_at, i.used_at, u.full_name AS used_by_name
         FROM alumni_invites i LEFT JOIN users u ON u.user_id = i.used_by
         WHERE i.created_by = ? ORDER BY i.invite_id DESC LIMIT 20`,
        [req.user.user_id]
    );
    res.json({ success: true, invites: rows });
});

module.exports = router;
