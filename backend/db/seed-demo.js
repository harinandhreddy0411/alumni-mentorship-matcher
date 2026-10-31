require('dotenv').config();
const bcrypt = require('bcryptjs');
const pool = require('./pool');

function rng(seed) {
    return () => {
        seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
const rand = rng(20261030);
const pick = arr => arr[Math.floor(rand() * arr.length)];
const shuffle = arr => arr.map(v => [rand(), v]).sort((a, b) => a[0] - b[0]).map(p => p[1]);
const fmt = d => d.toISOString().slice(0, 19).replace('T', ' ');
const daysAgo = n => new Date(Date.now() - n * 86400000);

const skills = [
    ['Backend Development', 'Engineering'], ['Frontend Development', 'Engineering'], ['System Design', 'Engineering'],
    ['Data Structures', 'Engineering'], ['SQL and Databases', 'Data'], ['Machine Learning', 'Data'],
    ['Data Analysis', 'Data'], ['Cloud and DevOps', 'Infrastructure'], ['Kubernetes', 'Infrastructure'],
    ['Cybersecurity', 'Security'], ['Reverse Engineering', 'Security'], ['Android Development', 'Mobile'],
    ['Product Management', 'Product'], ['UI and UX Design', 'Design'], ['Technical Writing', 'Community'],
    ['Open Source', 'Community'], ['Competitive Programming', 'Career'], ['Interview Preparation', 'Career'],
    ['Resume Review', 'Career'], ['Research and Higher Studies', 'Career']
];

const alumni = [
    ['priya.nair', 'Priya Nair', 'Software Engineering', 'Backend engineer working on payment systems. Happy to talk about API design, databases and getting through the first year on a team.', ['Backend Development', 'SQL and Databases', 'System Design', 'Interview Preparation'], 4],
    ['arjun.mehta', 'Arjun Mehta', 'Data Science', 'Builds forecasting models for a logistics company. Can help with picking a first ML project and reading papers without getting lost.', ['Machine Learning', 'Data Analysis', 'SQL and Databases', 'Research and Higher Studies'], 4],
    ['kavya.reddy', 'Kavya Reddy', 'Cloud and DevOps', 'Platform engineer. Spends most days on Kubernetes, CI pipelines and cost reviews. Can walk you through setting up a real deployment.', ['Cloud and DevOps', 'Kubernetes', 'Open Source', 'Backend Development'], 3],
    ['rohan.iyer', 'Rohan Iyer', 'Cybersecurity', 'Application security engineer and former CTF player. Mentors on reverse engineering, web security and how to start in a security team.', ['Cybersecurity', 'Reverse Engineering', 'Android Development', 'Open Source'], 3],
    ['ananya.das', 'Ananya Das', 'Product and Design', 'Product manager for a consumer app. Can review portfolios, case studies and help you decide between design and product roles.', ['Product Management', 'UI and UX Design', 'Technical Writing', 'Resume Review'], 5],
    ['vikram.rao', 'Vikram Rao', 'Software Engineering', 'Full stack developer at a seed-stage startup. Good person to ask about shipping fast, side projects and choosing a stack.', ['Frontend Development', 'Backend Development', 'Open Source', 'Interview Preparation'], 5],
    ['meera.pillai', 'Meera Pillai', 'Research', 'PhD student in distributed systems. Can guide on research internships, writing to professors and preparing for graduate applications.', ['Research and Higher Studies', 'System Design', 'Data Structures', 'Technical Writing'], 3],
    ['siddharth.menon', 'Siddharth Menon', 'Data Science', 'Analytics lead at a retail company. Focuses on SQL, dashboards and turning messy data into decisions.', ['Data Analysis', 'SQL and Databases', 'Machine Learning', 'Resume Review'], 4],
    ['divya.krishnan', 'Divya Krishnan', 'Software Engineering', 'Android developer. Can help with building and publishing your first app and preparing for mobile interviews.', ['Android Development', 'Data Structures', 'Competitive Programming', 'Interview Preparation'], 4],
    ['karthik.varma', 'Karthik Varma', 'Cloud and DevOps', 'Site reliability engineer. Helps with Linux, networking basics, monitoring and on-call habits.', ['Cloud and DevOps', 'Cybersecurity', 'Backend Development', 'Kubernetes'], 3]
];

const students = [
    ['aditya.kumar', 'Aditya Kumar', 'Software Engineering', ['Backend Development', 'Data Structures']],
    ['sneha.joshi', 'Sneha Joshi', 'Data Science', ['Machine Learning', 'Data Analysis']],
    ['rahul.nambiar', 'Rahul Nambiar', 'Cybersecurity', ['Cybersecurity', 'Reverse Engineering']],
    ['isha.verma', 'Isha Verma', 'Product and Design', ['UI and UX Design', 'Product Management']],
    ['nikhil.shetty', 'Nikhil Shetty', 'Cloud and DevOps', ['Cloud and DevOps', 'Kubernetes']],
    ['lakshmi.menon', 'Lakshmi Menon', 'Software Engineering', ['Frontend Development', 'UI and UX Design']],
    ['harsh.vora', 'Harsh Vora', 'Software Engineering', ['Competitive Programming', 'Data Structures']],
    ['tanvi.kulkarni', 'Tanvi Kulkarni', 'Data Science', ['Data Analysis', 'SQL and Databases']],
    ['varun.bhat', 'Varun Bhat', 'Cybersecurity', ['Cybersecurity', 'Open Source']],
    ['pooja.sharma', 'Pooja Sharma', 'Research', ['Research and Higher Studies', 'Machine Learning']],
    ['akash.pillai', 'Akash Pillai', 'Software Engineering', ['Android Development', 'Backend Development']],
    ['neha.gupta', 'Neha Gupta', 'Product and Design', ['Product Management', 'Technical Writing']],
    ['sanjay.rao', 'Sanjay Rao', 'Cloud and DevOps', ['Cloud and DevOps', 'Backend Development']],
    ['ritika.sen', 'Ritika Sen', 'Data Science', ['Machine Learning', 'Research and Higher Studies']],
    ['manoj.krishna', 'Manoj Krishna', 'Software Engineering', ['System Design', 'Backend Development']],
    ['divyanshi.roy', 'Divyanshi Roy', 'Software Engineering', ['Frontend Development', 'Open Source']],
    ['yash.thakur', 'Yash Thakur', 'Cybersecurity', ['Reverse Engineering', 'Android Development']],
    ['anjali.nair', 'Anjali Nair', 'Data Science', ['SQL and Databases', 'Data Analysis']],
    ['gaurav.singh', 'Gaurav Singh', 'Software Engineering', ['Interview Preparation', 'Data Structures']],
    ['meghna.das', 'Meghna Das', 'Product and Design', ['UI and UX Design', 'Resume Review']],
    ['tarun.reddy', 'Tarun Reddy', 'Cloud and DevOps', ['Kubernetes', 'Cybersecurity']],
    ['shreya.iyer', 'Shreya Iyer', 'Research', ['Research and Higher Studies', 'Technical Writing']],
    ['kunal.deshmukh', 'Kunal Deshmukh', 'Software Engineering', ['Competitive Programming', 'Interview Preparation']],
    ['bhavna.rao', 'Bhavna Rao', 'Data Science', ['Machine Learning', 'SQL and Databases']]
];

const pitches = [
    'I am in my second year and want to build a project that is closer to real work than coursework. I would value your view on what to focus on.',
    'I have been learning this on my own for a few months and keep getting stuck on the same things. A mentor who has done it professionally would help a lot.',
    'I am applying for internships next semester and would like feedback on my resume and how I prepare.',
    'Your background is exactly the path I want to follow. Could you help me plan the next year?',
    'I contribute to a small open source project and want to get better at reviewing code and writing maintainable software.',
    'I want to understand how people in this field actually spend their week, and what skills to build first.'
];

const chat = [
    ['s', 'Thank you for accepting. Is there a good time this week to start?'],
    ['m', 'Glad to help. Send me what you are working on and we can plan a first call.'],
    ['s', 'I have a small project on GitHub. I will share the link before we meet.'],
    ['m', 'Good. Pick one thing you want feedback on so the call stays focused.']
];

const reviewComments = [
    'Clear, practical advice and gave me a plan I could follow.',
    'Reviewed my project in detail and pointed out what I had missed.',
    'Very patient with questions. I left the call knowing what to do next.',
    'Honest feedback on my resume. Changed how I wrote it.',
    'Helped me decide between two options I had been stuck on for weeks.'
];

(async () => {
    const [exists] = await pool.query("SELECT user_id FROM users WHERE username = 'priya.nair'");
    if (exists.length > 0) {
        console.log('demo data already present');
        await pool.end();
        return;
    }
    const hash = await bcrypt.hash('password123', 10);
    const q = async (sql, params) => (await pool.query(sql, params))[0];

    const skillId = {};
    for (const [name, category] of skills) {
        const r = await q('INSERT INTO skills (name, category) VALUES (?, ?) ON DUPLICATE KEY UPDATE category = VALUES(category)', [name, category]);
        const [row] = await q('SELECT skill_id FROM skills WHERE name = ?', [name]);
        skillId[name] = row.skill_id;
    }

    const alumniRows = [];
    for (const [username, fullName, track, bio, skillNames, max] of alumni) {
        const r = await q(
            "INSERT INTO users (username, password_hash, role, full_name, focus_track, professional_bio, email) VALUES (?, ?, 'alumni', ?, ?, ?, ?)",
            [username, hash, fullName, track, bio, `${username}@example.com`]
        );
        await q('INSERT INTO alumni_details (alumni_id, capacity_status, max_mentees, preferred_hours) VALUES (?, ?, ?, ?)',
            [r.insertId, 'active', max, 'Weekday evenings and Saturday mornings']);
        for (const n of skillNames) {
            await q('INSERT INTO user_skills (user_id, skill_id, level) VALUES (?, ?, ?)', [r.insertId, skillId[n], pick(['intermediate', 'expert', 'expert'])]);
        }
        const days = shuffle([0, 1, 2, 3, 4, 5]).slice(0, 3 + Math.floor(rand() * 2));
        for (const d of days) {
            const start = pick(['09:00', '11:00', '17:00', '18:30', '20:00']);
            const endHour = String(Number(start.slice(0, 2)) + 2).padStart(2, '0');
            await q('INSERT IGNORE INTO availability_slots (alumni_id, weekday, start_time, end_time) VALUES (?, ?, ?, ?)',
                [r.insertId, d, start, `${endHour}:${start.slice(3)}`]);
        }
        alumniRows.push({ id: r.insertId, skills: skillNames, max, name: fullName });
    }
    await q("UPDATE alumni_details SET capacity_status = 'paused' WHERE alumni_id = ?", [alumniRows[9].id]);

    const studentRows = [];
    for (const [username, fullName, track, skillNames] of students) {
        const r = await q(
            "INSERT INTO users (username, password_hash, role, full_name, focus_track, professional_bio, email) VALUES (?, ?, 'student', ?, ?, ?, ?)",
            [username, hash, fullName, track, `Student interested in ${track.toLowerCase()}.`, `${username}@example.com`]
        );
        for (const n of skillNames) {
            await q('INSERT INTO user_skills (user_id, skill_id, level) VALUES (?, ?, ?)', [r.insertId, skillId[n], pick(['beginner', 'intermediate'])]);
        }
        studentRows.push({ id: r.insertId, skills: skillNames, name: fullName });
    }

    const accepted = [];
    for (const s of studentRows) {
        const ranked = alumniRows
            .filter(a => a.id !== alumniRows[9].id)
            .map(a => ({ a, score: a.skills.filter(k => s.skills.includes(k)).length + rand() * 0.5 }))
            .sort((x, y) => y.score - x.score)
            .slice(0, 1 + Math.floor(rand() * 3));
        for (const { a } of ranked) {
            const focus = pick(s.skills);
            const age = 5 + Math.floor(rand() * 165);
            const [[{ request_id }]] = await q('CALL sp_send_request(?, ?, ?, ?)', [s.id, a.id, focus, pick(pitches)]);
            await q('UPDATE mentorship_requests SET creation_ts = ? WHERE request_id = ?', [fmt(daysAgo(age)), request_id]);
            const roll = rand();
            if (roll < 0.55) {
                try {
                    await q('CALL sp_respond_request(?, ?, ?)', [a.id, request_id, 'accepted']);
                    accepted.push({ request_id, student: s.id, alumni: a.id, age });
                } catch (err) {
                    await q('CALL sp_respond_request(?, ?, ?)', [a.id, request_id, 'declined']);
                }
            } else if (roll < 0.75) {
                await q('CALL sp_respond_request(?, ?, ?)', [a.id, request_id, 'declined']);
            }
        }
    }

    let reviewed = 0;
    let upcomingSeq = 0;
    for (const m of accepted) {
        const meetingsToMake = 1 + Math.floor(rand() * 2);
        for (let i = 0; i < meetingsToMake; i++) {
            const when = daysAgo(Math.max(1, m.age - 3 - i * 9));
            const r = await q(
                "INSERT INTO meetings (request_id, scheduled_at, duration_min, status, meeting_link) VALUES (?, ?, ?, 'completed', ?)",
                [m.request_id, fmt(when), pick([30, 45, 60]), 'https://meet.example.com/' + Math.floor(rand() * 1e6)]
            );
            if (rand() < 0.8) {
                await q('INSERT INTO reviews (meeting_id, rating, comment, created_ts) VALUES (?, ?, ?, ?)',
                    [r.insertId, rand() < 0.7 ? 5 : 4, pick(reviewComments), fmt(new Date(when.getTime() + 3600000))]);
                reviewed++;
            }
        }
        if (rand() < 0.6) {
            upcomingSeq++;
            const at = new Date(Date.now() + (2 + Math.floor(rand() * 10)) * 86400000 + upcomingSeq * 2 * 3600000);
            const [[{ meeting_id }]] = await q('CALL sp_book_meeting(?, ?, ?, ?, ?)', [m.alumni, m.request_id, fmt(at), 45, null]);
            if (rand() < 0.7) await q('CALL sp_set_meeting_status(?, ?, ?)', [m.student, meeting_id, 'scheduled']);
        }
        const base = Date.now() - Math.max(1, m.age - 2) * 86400000;
        for (let i = 0; i < chat.length; i++) {
            const sender = chat[i][0] === 's' ? m.student : m.alumni;
            await q('INSERT INTO messages (request_id, sender_id, body, is_read, sent_ts) VALUES (?, ?, ?, ?, ?)',
                [m.request_id, sender, chat[i][1], 1, fmt(new Date(base + i * 3600000))]);
        }
    }

    console.log(`${alumniRows.length} alumni, ${studentRows.length} students, ${accepted.length} accepted matches, ${reviewed} reviews`);
    console.log('Demo login: any username above with password "password123", for example priya.nair or aditya.kumar');
    await pool.end();
})().catch(err => {
    console.error(err.sqlMessage || err.message);
    process.exit(1);
});
