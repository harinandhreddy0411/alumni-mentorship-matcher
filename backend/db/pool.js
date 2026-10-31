require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const caPath = path.join(__dirname, 'ca.pem');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    dateStrings: true,
    ssl: fs.existsSync(caPath) ? { ca: fs.readFileSync(caPath) } : undefined
});

pool.pool.on('connection', function (conn) {
    conn.query("SET time_zone = '+00:00'");
});

module.exports = pool;
