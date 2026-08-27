const pool = require('../db/pool');

async function requireSession(req, res, next) {
    const token = req.headers['x-session-token'];
    if (!token) return res.status(401).json({ success: false, error: 'No session token' });

    const [rows] = await pool.query(
        `SELECT s.user_id, u.role, u.full_name FROM sessions s
         JOIN users u ON u.user_id = s.user_id
         WHERE s.token = ?`,
        [token]
    );
    if (rows.length === 0) return res.status(401).json({ success: false, error: 'Invalid or expired session' });

    req.user = rows[0]; // { user_id, role, full_name }
    next();
}

function requireRole(role) {
    return (req, res, next) => {
        if (req.user.role !== role) return res.status(403).json({ success: false, error: 'Forbidden' });
        next();
    };
}

module.exports = { requireSession, requireRole };