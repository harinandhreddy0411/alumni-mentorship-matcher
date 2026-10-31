require('dotenv').config();
const assert = require('assert');
const mysql = require('mysql2/promise');

let passed = 0;
async function expectError(label, fn, fragment) {
    try {
        await fn();
    } catch (err) {
        assert.ok((err.sqlMessage || err.message).includes(fragment), `${label}: got "${err.sqlMessage || err.message}"`);
        passed++;
        console.log('ok  ' + label);
        return;
    }
    assert.fail(`${label}: expected an error containing "${fragment}"`);
}
function ok(label, cond) {
    assert.ok(cond, label);
    passed++;
    console.log('ok  ' + label);
}

(async () => {
    const db = await mysql.createConnection({
        host: process.env.DB_HOST, port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME
    });
    const q = async (sql, params) => (await db.query(sql, params))[0];
    const tag = 't' + Date.now();
    const mk = async (name, role) => {
        const r = await q('INSERT INTO users (username, password_hash, role, full_name) VALUES (?, ?, ?, ?)', [`${tag}_${name}`, 'x', role, name]);
        if (role === 'alumni') await q('INSERT INTO alumni_details (alumni_id) VALUES (?)', [r.insertId]);
        return r.insertId;
    };
    const s1 = await mk('Stu One', 'student');
    const s2 = await mk('Stu Two', 'student');
    const a1 = await mk('Alu One', 'alumni');
    const a2 = await mk('Alu Two', 'alumni');
    const adm = await mk('Adm', 'admin');
    await q('UPDATE alumni_details SET max_mentees = 1 WHERE alumni_id = ?', [a1]);

    await expectError('student cannot request a student', () => q('CALL sp_send_request(?,?,?,?)', [s1, s2, 'x', 'hi']), 'only be sent to alumni');
    await expectError('alumni cannot send a request', () => q('CALL sp_send_request(?,?,?,?)', [a1, a2, 'x', 'hi']), 'Only students');
    await expectError('empty pitch rejected', () => q('CALL sp_send_request(?,?,?,?)', [s1, a1, 'x', '  ']), 'pitch');

    const [[{ request_id: r1 }]] = await q('CALL sp_send_request(?,?,?,?)', [s1, a1, 'Backend', 'please mentor me']);
    ok('request created', r1 > 0);
    await expectError('duplicate open request blocked', () => q('CALL sp_send_request(?,?,?,?)', [s1, a1, 'Backend', 'again']), 'already have an open request');
    const [[{ request_id: r2 }]] = await q('CALL sp_send_request(?,?,?,?)', [s2, a1, 'Backend', 'me too']);

    const notes = await q('SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?', [a1]);
    ok('alumnus notified by trigger', notes[0].n === 2);

    await expectError('chat closed before acceptance', () => q('INSERT INTO messages (request_id, sender_id, body) VALUES (?,?,?)', [r1, s1, 'hello']), 'Chat opens');

    await q('CALL sp_respond_request(?,?,?)', [a1, r1, 'accepted']);
    ok('request accepted', (await q('SELECT status FROM mentorship_requests WHERE request_id = ?', [r1]))[0].status === 'accepted');
    await expectError('capacity enforced', () => q('CALL sp_respond_request(?,?,?)', [a1, r2, 'accepted']), 'capacity');
    await expectError('accepted request cannot be answered again', () => q('CALL sp_respond_request(?,?,?)', [a1, r1, 'declined']), 'Pending request not found');
    await expectError('other alumnus cannot answer', () => q('CALL sp_respond_request(?,?,?)', [a2, r2, 'accepted']), 'Pending request not found');
    await expectError('invalid status rejected', () => q('CALL sp_respond_request(?,?,?)', [a1, r2, 'maybe']), 'Invalid status');
    await q('CALL sp_respond_request(?,?,?)', [a1, r2, 'declined']);
    await expectError('declined request is final', () => q('UPDATE mentorship_requests SET status = ? WHERE request_id = ?', ['accepted', r2]), 'already closed');

    await q('INSERT INTO messages (request_id, sender_id, body) VALUES (?,?,?)', [r1, s1, 'hello mentor']);
    ok('chat works after acceptance', true);
    await expectError('outsider cannot chat', () => q('INSERT INTO messages (request_id, sender_id, body) VALUES (?,?,?)', [r1, s2, 'hi']), 'not part');
    await expectError('blank message rejected', () => q('INSERT INTO messages (request_id, sender_id, body) VALUES (?,?,?)', [r1, s1, '   ']), '');

    await expectError('past meeting rejected', () => q('CALL sp_book_meeting(?,?,?,?,?)', [s1, r1, '2020-01-01 10:00:00', 30, null]), 'future');
    await expectError('bad duration rejected', () => q('CALL sp_book_meeting(?,?,?,?,?)', [s1, r1, '2099-01-01 10:00:00', 5, null]), '');
    await expectError('outsider cannot book', () => q('CALL sp_book_meeting(?,?,?,?,?)', [s2, r1, '2099-01-01 10:00:00', 30, null]), 'not part');
    const [[{ meeting_id: m1 }]] = await q('CALL sp_book_meeting(?,?,?,?,?)', [s1, r1, '2099-01-01 10:00:00', 45, 'https://meet.example/abc']);
    ok('meeting proposed', m1 > 0);
    const [pm] = await q('SELECT status, meeting_link, proposed_by FROM meetings WHERE meeting_id = ?', [m1]);
    ok('new meeting waits for the other person', pm.status === 'proposed' && pm.meeting_link === 'https://meet.example/abc' && pm.proposed_by === s1);
    const prop = await q("SELECT message FROM notifications WHERE user_id = ? AND kind = 'meeting'", [a1]);
    ok('mentor notified of the proposal', prop.some(n => n.message.includes('proposed a meeting for {t:2099-01-01T10:00:00Z}')));
    await expectError('proposer cannot accept own proposal', () => q('CALL sp_set_meeting_status(?,?,?)', [s1, m1, 'scheduled']), 'other person');
    await expectError('proposal cannot be completed', () => q('CALL sp_set_meeting_status(?,?,?)', [a1, m1, 'completed']), 'accepted before');
    await expectError('overlapping meeting rejected', () => q('CALL sp_book_meeting(?,?,?,?,?)', [a1, r1, '2099-01-01 10:30:00', 30, null]), 'overlaps');
    const [[{ meeting_id: m2 }]] = await q('CALL sp_book_meeting(?,?,?,?,?)', [a1, r1, '2099-01-01 10:45:00', 30, null]);
    ok('back to back meeting allowed', m2 > 0);
    const [auto] = await q('SELECT meeting_link FROM meetings WHERE meeting_id = ?', [m2]);
    ok('link generated when left blank', /^https:\/\/meet\.jit\.si\/Alumni-/.test(auto.meeting_link));
    await expectError('bad meeting link rejected', () => q('CALL sp_book_meeting(?,?,?,?,?)', [a1, r1, '2099-03-01 10:00:00', 30, 'ftp://nope']), 'http');
    await q('CALL sp_set_meeting_status(?,?,?)', [a1, m2, 'cancelled']);
    await expectError('withdrawn proposal cannot be accepted', () => q('CALL sp_set_meeting_status(?,?,?)', [s1, m2, 'scheduled']), 'already closed');
    const [[{ meeting_id: m3 }]] = await q('CALL sp_book_meeting(?,?,?,?,?)', [s1, r1, '2099-02-01 10:00:00', 30, null]);
    await q('CALL sp_set_meeting_status(?,?,?)', [a1, m3, 'declined']);
    ok('proposal declined', (await q('SELECT status FROM meetings WHERE meeting_id = ?', [m3]))[0].status === 'declined');
    const dec = await q("SELECT message FROM notifications WHERE user_id = ? AND message LIKE '%declined the meeting%'", [s1]);
    ok('proposer told about the decline', dec.length === 1);
    await q('CALL sp_set_meeting_status(?,?,?)', [a1, m1, 'scheduled']);
    ok('meeting confirmed', (await q('SELECT status FROM meetings WHERE meeting_id = ?', [m1]))[0].status === 'scheduled');
    await expectError('cannot complete before start', () => q('CALL sp_set_meeting_status(?,?,?)', [a1, m1, 'completed']), 'before it starts');
    await expectError('cannot review before completion', () => q('CALL sp_submit_review(?,?,?,?)', [s1, m1, 5, 'great']), 'completed');
    await q('UPDATE meetings SET scheduled_at = ? WHERE meeting_id = ?', ['2020-01-01 10:00:00', m1]);
    await q('CALL sp_set_meeting_status(?,?,?)', [a1, m1, 'completed']);
    await expectError('rating out of range rejected', () => q('CALL sp_submit_review(?,?,?,?)', [s1, m1, 9, 'x']), '');
    await expectError('only mentee reviews', () => q('CALL sp_submit_review(?,?,?,?)', [a1, m1, 5, 'x']), 'mentee');
    await q('CALL sp_submit_review(?,?,?,?)', [s1, m1, 5, 'excellent']);
    await expectError('one review per meeting', () => q('CALL sp_submit_review(?,?,?,?)', [s1, m1, 4, 'again']), 'Duplicate');
    const load = await q('SELECT * FROM v_mentor_load WHERE alumni_id = ?', [a1]);
    ok('mentor load view', load[0].current_mentees === 1 && load[0].open_slots === 0 && Number(load[0].avg_rating) === 5);

    const sk = await q('INSERT INTO skills (name, category) VALUES (?, ?), (?, ?)', [tag + 'sql', 'Data', tag + 'react', 'Web']);
    const sqlId = sk.insertId;
    await q('INSERT INTO user_skills (user_id, skill_id) VALUES (?,?), (?,?)', [s2, sqlId, a2, sqlId]);
    const [recs] = await q('CALL sp_recommend_mentors(?)', [s2]);
    const top = recs.find(r => r.alumni_id === a2);
    ok('recommendation ranks by shared skills', top && Number(top.shared_skills) === 1 && Number(top.rank_pos) === 1);
    ok('full mentor hidden from recommendations', !recs.some(r => r.alumni_id === a1));

    await expectError('admin cannot be deleted', () => q('DELETE FROM users WHERE user_id = ?', [adm]), 'Admin accounts');

    await q('INSERT INTO sessions (user_id, token) VALUES (?, ?)', [s1, tag]);
    const sess = await q('SELECT expires_at FROM sessions WHERE user_id = ?', [s1]);
    ok('session expiry set by trigger', sess[0].expires_at !== null);

    await q('DELETE FROM users WHERE user_id IN (?, ?, ?, ?)', [s1, s2, a1, a2]);
    const left = await q('SELECT (SELECT COUNT(*) FROM mentorship_requests WHERE student_id = ? OR alumni_id = ?) AS r, (SELECT COUNT(*) FROM meetings WHERE meeting_id = ?) AS m', [s1, a1, m1]);
    ok('cascade removes requests and meetings', left[0].r === 0 && left[0].m === 0);
    await q('UPDATE users SET role = ? WHERE user_id = ?', ['student', adm]);
    await q('DELETE FROM users WHERE user_id = ?', [adm]);
    await q('DELETE FROM skills WHERE skill_id = ?', [sqlId]);
    await q('DELETE FROM skills WHERE name = ?', [tag + 'react']);

    console.log(`\n${passed} checks passed`);
    await db.end();
})().catch(err => {
    console.error('\nFAILED:', err.message);
    process.exit(1);
});
