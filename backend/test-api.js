const assert = require('assert');
const base = process.env.API_BASE || 'http://localhost:3000/api';
let passed = 0;

async function call(method, path, token, body) {
    const res = await fetch(base + path, {
        method,
        headers: { 'Content-Type': 'application/json', ...(token ? { 'x-session-token': token } : {}) },
        body: body ? JSON.stringify(body) : undefined
    });
    return { status: res.status, data: await res.json() };
}
function check(label, cond, extra) {
    assert.ok(cond, label + (extra ? ' ' + JSON.stringify(extra) : ''));
    passed++;
    console.log('ok  ' + label);
}

(async () => {
    const tag = 'api' + Date.now();
    const pw = 'secret123';

    let r = await call('GET', '/public/summary');
    check('public summary needs no login', r.data.success && r.data.summary.mentors >= 0);
    r = await call('POST', '/auth/register', null, { username: tag + 's', password: pw, role: 'student', fullName: 'Test Student' });
    check('register student', r.data.success);
    r = await call('POST', '/auth/register', null, { username: tag + 'm', password: pw, role: 'alumni', fullName: 'Test Mentor' });
    check('register alumni', r.data.success);
    const mentorId = r.data.userId;
    r = await call('POST', '/auth/register', null, { username: tag + 's', password: pw, role: 'student' });
    check('duplicate username rejected', r.status === 409);
    r = await call('POST', '/auth/register', null, { username: tag + 'x', password: '123', role: 'student' });
    check('short password rejected', r.status === 400);

    r = await call('POST', '/auth/login', null, { username: tag + 's', password: 'wrong' });
    check('bad password rejected', r.status === 401);
    r = await call('POST', '/auth/login', null, { username: tag + 's', password: pw });
    const st = r.data.token;
    check('student login', r.data.success && r.data.role === 'student');
    r = await call('POST', '/auth/login', null, { username: tag + 'm', password: pw });
    const mt = r.data.token;
    check('alumni login', r.data.success && r.data.role === 'alumni');

    r = await call('GET', '/mentors', null);
    check('no token is refused', r.status === 401);
    r = await call('GET', '/admin/stats', st);
    check('student blocked from admin', r.status === 403);
    r = await call('GET', '/requests/incoming', st);
    check('student blocked from alumni route', r.status === 403);

    r = await call('PUT', '/profile', st, { fullName: 'Test Student', email: 's@example.com', focusTrack: 'Data Science', bio: 'Learning' });
    check('profile update', r.data.success);
    r = await call('GET', '/skills', st);
    check('skill catalog is seeded by migration', r.data.skills.length >= 30);
    const skillIds = r.data.skills.slice(0, 2).map(s => s.skill_id);
    r = await call('POST', '/skills', st, { name: 'Rust ' + Date.now() });
    check('custom skill can be added', r.data.success && r.data.skill.category === 'Other', r.data);
    r = await call('POST', '/skills', st, { name: 'x' });
    check('tiny skill name rejected', r.status === 400);
    r = await call('PUT', '/profile/skills', st, { skills: skillIds.map(id => ({ skillId: id, level: 'beginner' })) });
    check('student skills saved', r.data.success);
    await call('PUT', '/profile/skills', mt, { skills: [{ skillId: skillIds[0], level: 'expert' }] });

    r = await call('PUT', '/capacity', mt, { status: 'active', maxMentees: 0 });
    check('capacity below 1 rejected', r.status === 400);
    r = await call('PUT', '/capacity', mt, { status: 'active', maxMentees: 1, preferredHours: 'Evenings', slots: [{ weekday: 2, startTime: '18:00', endTime: '20:00' }] });
    check('capacity saved with slots', r.data.success);
    r = await call('GET', '/capacity', mt);
    check('capacity read back', r.data.capacity.max_mentees === 1 && r.data.slots.length === 1);

    r = await call('GET', '/mentors', st);
    const found = r.data.mentors.find(m => m.alumni_id === mentorId);
    check('mentor recommended with shared skill', found && found.shared_skills === 1);
    r = await call('GET', '/mentors/' + mentorId, st);
    check('mentor detail', r.data.success && r.data.slots.length === 1 && r.data.skills.length === 1);

    r = await call('POST', '/requests', st, { alumniId: mentorId, focusArea: 'SQL', pitchMessage: '' });
    check('empty pitch rejected', r.status === 400);
    r = await call('POST', '/requests', st, { alumniId: mentorId, focusArea: 'SQL', pitchMessage: 'Please mentor me' });
    check('request sent', r.data.success);
    const reqId = r.data.requestId;
    r = await call('POST', '/requests', st, { alumniId: mentorId, focusArea: 'SQL', pitchMessage: 'Again' });
    check('duplicate request blocked with message', r.status === 400 && /already have an open request/.test(r.data.error), r.data);
    r = await call('POST', '/requests', mt, { alumniId: mentorId, pitchMessage: 'x' });
    check('alumni cannot send request', r.status === 403);

    r = await call('GET', '/requests/incoming', mt);
    check('incoming lists the request', r.data.requests.some(x => x.request_id === reqId && x.shared_skills === 1));
    r = await call('GET', '/notifications', mt);
    check('alumni has a notification', r.data.unread >= 1);

    r = await call('POST', '/messages/' + reqId, st, { body: 'hello' });
    check('chat locked before acceptance', r.status === 400, r.data);
    r = await call('PATCH', '/requests/' + reqId, st, { status: 'accepted' });
    check('student cannot respond', r.status === 403);
    r = await call('PATCH', '/requests/' + reqId, mt, { status: 'accepted' });
    check('alumni accepts', r.data.success);
    r = await call('PATCH', '/requests/' + reqId, mt, { status: 'declined' });
    check('accepted request cannot be answered again', r.status === 400);

    r = await call('GET', '/requests/mine', st);
    const mine = r.data.requests.find(x => x.request_id === reqId);
    check('student sees mentor contact after acceptance', mine.status === 'accepted' && mine.mentor_email !== undefined);
    r = await call('GET', '/requests/mentees', mt);
    check('alumni sees mentee', r.data.mentees.some(x => x.request_id === reqId));
    r = await call('GET', '/matches/mine', st);
    check('match listed for student', r.data.matches.some(x => x.request_id === reqId && x.other_name === 'Test Mentor'));

    r = await call('POST', '/messages/' + reqId, st, { body: 'Hello mentor' });
    check('student sends message', r.data.success);
    r = await call('GET', '/matches/mine', mt);
    check('unread count for alumni', r.data.matches.find(x => x.request_id === reqId).unread === 1);
    r = await call('GET', '/messages/' + reqId, mt);
    check('alumni reads thread', r.data.messages.length === 1 && r.data.otherName === 'Test Student');
    r = await call('GET', '/matches/mine', mt);
    check('unread cleared after reading', r.data.matches.find(x => x.request_id === reqId).unread === 0);
    r = await call('POST', '/notifications/read', mt);
    check('notifications marked read', r.data.success);

    const future = new Date(Date.now() + 3 * 86400000).toISOString();
    r = await call('POST', '/meetings', st, { requestId: reqId, scheduledAt: new Date(Date.now() - 3600000).toISOString(), durationMin: 30 });
    check('past meeting rejected', r.status === 400);
    r = await call('POST', '/meetings', st, { requestId: reqId, scheduledAt: future, durationMin: 45, meetingLink: 'https://meet.example/x' });
    check('meeting booked', r.data.success);
    const meetingId = r.data.meetingId;
    r = await call('GET', '/meetings', mt);
    const meeting = r.data.meetings.find(x => x.meeting_id === meetingId);
    check('alumni sees meeting in UTC', meeting && meeting.scheduled_at.endsWith('Z') && meeting.other_name === 'Test Student');
    check('mentor is asked to respond', meeting.status === 'proposed' && meeting.can_respond === true);
    r = await call('GET', '/meetings', st);
    check('proposer is only waiting', r.data.meetings.find(x => x.meeting_id === meetingId).can_respond === false);
    r = await call('PATCH', '/meetings/' + meetingId, st, { status: 'scheduled' });
    check('proposer cannot accept own proposal', r.status === 400);
    r = await call('POST', '/meetings', mt, { requestId: reqId, scheduledAt: future, durationMin: 30 });
    check('overlapping proposal rejected', r.status === 400 && /overlaps/.test(r.data.error), r.data);
    r = await call('PATCH', '/meetings/' + meetingId, mt, { status: 'scheduled' });
    check('mentor accepts the proposal', r.data.success);
    r = await call('PATCH', '/meetings/' + meetingId, mt, { status: 'completed' });
    check('cannot complete early', r.status === 400);
    r = await call('PATCH', '/meetings/' + meetingId, st, { status: 'cancelled' });
    check('meeting cancelled', r.data.success);

    r = await call('POST', '/auth/login', null, { username: 'admin', password: process.env.ADMIN_PASSWORD || 'adminpassword' });
    const at = r.data.token;
    check('admin login', r.data.role === 'admin');
    r = await call('GET', '/admin/stats', at);
    check('admin stats', r.data.stats.totalUsers >= 3 && 'avgRating' in r.data.stats);
    r = await call('GET', '/admin/analytics', at);
    check('analytics payload', Array.isArray(r.data.monthly) && Array.isArray(r.data.leaders) && Array.isArray(r.data.skills) && Array.isArray(r.data.idleMentors), r.data);
    r = await call('GET', '/admin/audit', at);
    check('audit log written by triggers', r.data.entries.some(e => e.action === 'request_accepted'));
    r = await call('GET', '/admin/matches', at);
    check('admin match list', r.data.matches.some(x => x.request_id === reqId));
    r = await call('PATCH', '/admin/matches/' + reqId, at);
    check('admin revokes match', r.data.success);
    r = await call('PATCH', '/admin/matches/' + reqId, at);
    check('revoking twice fails', r.status === 400);

    r = await call('GET', '/admin/users', at);
    const adminId = r.data.users.find(u => u.username === 'admin').user_id;
    r = await call('DELETE', '/admin/users/' + adminId, at);
    check('admin account protected', r.status === 403);
    for (const u of r.data.users || []) void u;
    const list = (await call('GET', '/admin/users', at)).data.users.filter(u => u.username.startsWith(tag));
    for (const u of list) {
        r = await call('DELETE', '/admin/users/' + u.user_id, at);
        check('cleanup ' + u.username, r.data.success);
    }

    r = await call('POST', '/auth/logout', st);
    r = await call('GET', '/matches/mine', st);
    check('logout invalidates token', r.status === 401);

    console.log(`\n${passed} checks passed`);
})().catch(err => {
    console.error('\nFAILED:', err.message);
    process.exit(1);
});
