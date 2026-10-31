require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const dir = path.join(__dirname, 'sql');
const caPath = path.join(__dirname, 'ca.pem');

function splitStatements(text) {
    const statements = [];
    let delimiter = ';';
    let buffer = '';
    for (const line of text.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (/^DELIMITER\s+/i.test(trimmed)) {
            delimiter = trimmed.split(/\s+/)[1];
            continue;
        }
        buffer += line + '\n';
        if (trimmed.endsWith(delimiter)) {
            const stmt = buffer.trim().slice(0, -delimiter.length).trim();
            if (stmt) statements.push(stmt);
            buffer = '';
        }
    }
    if (buffer.trim()) statements.push(buffer.trim());
    return statements;
}

async function main() {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: fs.existsSync(caPath) ? { ca: fs.readFileSync(caPath) } : undefined
    });
    await conn.query(
        `CREATE TABLE IF NOT EXISTS schema_migrations (
            filename   VARCHAR(100) PRIMARY KEY,
            applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB`
    );
    const [done] = await conn.query('SELECT filename FROM schema_migrations');
    const applied = new Set(done.map(r => r.filename));
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();

    for (const file of files) {
        const repeatable = file.startsWith('R__');
        if (!repeatable && applied.has(file)) continue;
        for (const stmt of splitStatements(fs.readFileSync(path.join(dir, file), 'utf8'))) {
            await conn.query(stmt);
        }
        if (!repeatable) await conn.query('INSERT INTO schema_migrations (filename) VALUES (?)', [file]);
        console.log((repeatable ? 'reapplied ' : 'applied ') + file);
    }
    await conn.end();
}

main().catch(err => {
    console.error(err.sqlMessage || err.message);
    process.exit(1);
});
