const fs = require('fs');
const path = require('path');

function sslOptions() {
    if (process.env.DB_CA) return { ca: process.env.DB_CA.replace(/\\n/g, '\n') };
    const caPath = path.join(__dirname, 'ca.pem');
    if (fs.existsSync(caPath)) return { ca: fs.readFileSync(caPath) };
    return undefined;
}

module.exports = sslOptions;
