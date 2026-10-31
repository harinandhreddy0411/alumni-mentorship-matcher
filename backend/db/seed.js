require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./pool');

(async () => {
    const password = process.env.ADMIN_PASSWORD || 'adminpassword';
    const [rows] = await pool.query("SELECT user_id FROM users WHERE username = 'admin'");
    if (rows.length > 0) {
        console.log('admin already exists');
    } else {
        const hash = await bcrypt.hash(password, 10);
        await pool.query(
            "INSERT INTO users (username, password_hash, role, full_name) VALUES ('admin', ?, 'admin', 'System Administrator')",
            [hash]
        );
        console.log('admin created');
    }
    await pool.end();
})().catch(err => {
    console.error(err.sqlMessage || err.message);
    process.exit(1);
});
