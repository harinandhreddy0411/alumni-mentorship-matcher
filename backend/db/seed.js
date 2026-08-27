const bcrypt = require('bcryptjs');
const pool = require('./pool');

async function seed() {
    const [existing] = await pool.query("SELECT user_id FROM users WHERE role = 'admin' LIMIT 1");
    if (existing.length > 0) {
        console.log('Admin already exists, skipping seed.');
        process.exit(0);
    }
    const hash = await bcrypt.hash('adminpassword', 10);
    await pool.query(
        `INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, 'admin', 'System Administrator')`,
        ['admin', hash]
    );
    console.log('Admin account created: username=admin password=adminpassword');
    process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
