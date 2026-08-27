require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const mentorshipRoutes = require('./routes/mentorship');
const profileRoutes = require('./routes/profile');
const adminRoutes = require('./routes/admin');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api', mentorshipRoutes);
app.use('/api', profileRoutes);
app.use('/api/admin', adminRoutes);

app.get('/api/health', (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Alumni Matcher API running on http://localhost:${PORT}`));
