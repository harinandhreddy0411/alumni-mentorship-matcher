require('dotenv').config();
const express = require('express');
const cors = require('cors');
require('express-async-errors'); 

const authRoutes = require('./routes/auth');
const mentorshipRoutes = require('./routes/mentorship');
const profileRoutes = require('./routes/profile');
const adminRoutes = require('./routes/admin');

const app = express();

const allowedOrigins = [
    'https://harinandhreddy0411.github.io',
    'null'
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS: ' + origin));
        }
    }
}));

app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api', mentorshipRoutes);
app.use('/api', profileRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use((err, req, res, next) => {
    console.error('Unhandled route error:', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
});
process.on('unhandledRejection', (reason) => {
    console.error('Unhandled promise rejection:', reason);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Alumni Matcher API running on http://localhost:${PORT}`));
