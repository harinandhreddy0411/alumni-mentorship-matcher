const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const sslCaPath = path.join(__dirname, 'ca.pem');
const useSsl = fs.existsSync(sslCaPath);

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'alumni_matcher',
    waitForConnections: true,
    connectionLimit: 10,
    ssl: useSsl ? { ca: fs.readFileSync(sslCaPath) } : undefined
});

module.exports = pool;