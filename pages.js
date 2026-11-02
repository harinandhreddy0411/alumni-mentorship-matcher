(function () {
    const A = window.App;
    const api = A.api;
    const esc = A.esc;
    const view = document.getElementById('view');
    const param = function (k) { return new URLSearchParams(location.search).get(k); };
    const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const TRACKS = ['Software Engineering', 'Data Science', 'Cybersecurity', 'Cloud and DevOps', 'Product and Design', 'Research'];

    function head(eyebrow, title, text, actions) {
        return '<div class="page__head"><div><p class="eyebrow">' + esc(eyebrow) + '</p><h1>' + esc(title) + '</h1>' +
            (text ? '<p>' + esc(text) + '</p>' : '') + '</div>' + (actions ? '<div class="item__actions">' + actions + '</div>' : '') + '</div>';
    }

    function section(title, aside, body, id) {
        return '<section class="section"' + (id ? ' id="' + id + '"' : '') + '><div class="section__head"><h2>' + esc(title) + '</h2>' + (aside ? '<span>' + aside + '</span>' : '') + '</div>' + body + '</section>';
    }

    function stat(value, label, href) {
        const inner = '<div class="stat__v">' + value + '</div><div class="stat__l">' + esc(label) + '</div>';
        return href ? '<a class="stat" href="' + href + '">' + inner + '</a>' : '<div class="stat">' + inner + '</div>';
    }

    function skillChips(list, mine, max) {
        if (!list) return '<p class="muted card__skills" style="font-size:13px">No skills listed yet</p>';
        const names = list.split('|').sort(function (a, b) { return (mine.has(b) ? 1 : 0) - (mine.has(a) ? 1 : 0); });
        return '<div class="chips chips--sm card__skills">' + names.slice(0, max).map(function (n) {
            return '<span class="chip' + (mine.has(n) ? ' chip--shared' : '') + '">' + esc(n) + '</span>';
        }).join('') + (names.length > max ? '<span class="chip chip--more">+' + (names.length - max) + ' more</span>' : '') + '</div>';
    }

    function proposalBanner(meetings) {
        const now = Date.now();
        const n = meetings.filter(function (m) { return m.can_respond && A.parseDate(m.scheduled_at).getTime() > now; }).length;
        if (!n) return '';
        return '<div class="card card--dark" style="margin-top:24px;display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap"><div><h3>' + n + (n === 1 ? ' meeting proposal needs' : ' meeting proposals need') + ' your answer</h3><p class="muted" style="margin-top:6px">Accept a time that suits you or decline it.</p></div><a class="btn btn--light" href="meetings.html#proposals">Review</a></div>';
    }

    let hashDone = false;
    function shell(inner) {
        view.innerHTML = '<div class="page"><div class="wrap">' + inner + '</div></div>';
        if (location.hash && !hashDone) {
            const el = document.getElementById(location.hash.slice(1));
            if (el) { hashDone = true; el.scrollIntoView(); }
        }
    }

    function fail(e, retry) {
        view.innerHTML = '<div class="page"><div class="wrap"><div class="card" style="max-width:560px;margin:60px auto;text-align:center"><h3>That did not load</h3><p class="muted" style="margin:12px 0 22px">' + esc(e.message) + '</p><button class="btn" id="retry">Try again</button></div></div></div>';
        document.getElementById('retry').onclick = retry;
    }

    function loading() {
        shell('<div class="skeleton" style="min-height:90px;max-width:480px;margin-bottom:40px"></div>' + A.skeleton(3));
    }

    function person(name, sub) {
        return '<div class="who"><span class="avatar">' + esc(A.initials(name)) + '</span><div><div class="item__title">' + esc(name) + '</div>' + (sub ? '<div class="item__sub">' + esc(sub) + '</div>' : '') + '</div></div>';
    }

    function upcomingOf(meetings) {
        const now = Date.now();
        return meetings.filter(function (m) { return m.status === 'scheduled' && A.parseDate(m.scheduled_at).getTime() > now; })
            .sort(function (a, b) { return A.parseDate(a.scheduled_at) - A.parseDate(b.scheduled_at); });
    }

    function meetingRows(list) {
        if (list.length === 0) return '<div class="list">' + A.empty('Nothing booked', 'Booked meetings appear here with the time in your timezone.') + '</div>';
        return '<div class="list">' + list.map(function (m) {
            return '<div class="item"><div class="item__main">' + person(m.other_name, A.fmtDateTime(m.scheduled_at) + ' · ' + m.duration_min + ' min') + '</div>' +
                '<div class="item__actions">' + (m.meeting_link ? '<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="' + esc(m.meeting_link) + '">Join link</a>' : '') + '<a class="btn btn--sm" href="meetings.html">Manage</a></div></div>';
        }).join('') + '</div>';
    }

    const pages = {};

    pages.student = async function (s) {
        loading();
        const r = await Promise.all([api('GET', '/mentors'), api('GET', '/requests/mine'), api('GET', '/matches/mine'), api('GET', '/meetings'), api('GET', '/profile')]);
        const mentors = r[0].mentors;
        const mine = new Set(r[4].skills.map(function (x) { return x.name; }));
        const requests = r[1].requests;
        const matches = r[2].matches;
        const upcoming = upcomingOf(r[3].meetings);
        const open = requests.filter(function (x) { return x.status === 'pending'; }).length;
        const unread = matches.reduce(function (n, m) { return n + m.unread; }, 0);
        const noSkills = mentors.length > 0 && mentors.every(function (m) { return m.shared_skills === 0; });

        const cards = mentors.length === 0
            ? '<div class="list">' + A.empty('No mentors available right now', 'Everyone is full or paused. Check back soon.') + '</div>'
            : '<div class="grid">' + mentors.map(function (m) {
                return '<a class="card" href="request-mentor.html?mentor=' + m.alumni_id + '"><div class="card__top"><div class="who"><span class="avatar">' + esc(A.initials(m.full_name)) + '</span><div><h3>' + esc(m.full_name) + '</h3><div class="card__meta">' + esc(m.focus_track || 'Mentor') + (m.department ? ' · ' + esc(m.department) : '') + (m.graduation_year ? ' · Class of ' + m.graduation_year : '') + '</div></div></div>' +
                    (m.shared_skills > 0 ? '<span class="badge badge--match">' + m.shared_skills + ' shared</span>' : '') + (m.same_department ? '<span class="badge badge--match">Your department</span>' : '') + '</div>' +
                    '<p class="card__bio">' + esc(m.professional_bio || 'No bio yet.') + '</p>' + skillChips(m.skills, mine, 5) +
                    '<div class="card__foot"><span>' + A.stars(m.avg_rating) + (m.review_count ? ' <span class="muted">(' + m.review_count + ')</span>' : '') + '</span><span>' + m.open_slots + ' open ' + (m.open_slots === 1 ? 'place' : 'places') + '</span></div></a>';
            }).join('') + '</div>';

        const reqList = requests.length === 0
            ? '<div class="list">' + A.empty('No requests yet', 'Open a mentor above and send a short pitch.') + '</div>'
            : '<div class="list">' + requests.map(function (q) {
                return '<div class="item"><div class="item__main">' + person(q.mentor_name, (q.focus_area || 'General') + ' · sent ' + A.ago(q.creation_ts)) +
                    '<div class="item__text">' + esc(q.pitch_message) + '</div></div><div class="item__actions">' + A.badge(q.status) +
                    (q.status === 'pending' ? '<button class="btn btn--ghost btn--sm" data-withdraw="' + q.request_id + '">Withdraw</button>' : '') +
                    (q.status === 'accepted' ? '<a class="btn btn--sm" href="messages.html?match=' + q.request_id + '">Message</a><a class="btn btn--ghost btn--sm" href="meetings.html?match=' + q.request_id + '">Book</a>' : '') + '</div></div>';
            }).join('') + '</div>';

        shell(
            head('Student', 'Good to see you, ' + A.firstName(s.fullName) + '.', 'Mentors are ranked by the skills you share with them, then by rating.') +
            '<div class="stats">' + stat(open, 'Pending requests', '#requests') + stat(matches.length, 'Active mentors', 'messages.html') + stat(unread, 'Unread messages', 'messages.html') + stat(upcoming[0] ? esc(A.fmtDateTime(upcoming[0].scheduled_at)) : '–', 'Next meeting', 'meetings.html').replace('stat__v"', 'stat__v" style="font-size:' + (upcoming[0] ? '24px' : '') + '"') + '</div>' + proposalBanner(r[3].meetings) +
            (noSkills ? '<div class="card card--dark" style="margin-top:24px;display:flex;justify-content:space-between;align-items:center;gap:20px;flex-wrap:wrap"><div><h3>Add your skills</h3><p class="muted" style="margin-top:6px">Mentors are not ranked for you yet. Tell us what you know and what you want to learn.</p></div><a class="btn btn--light" href="profile.html">Add skills</a></div>' : '') +
            section('Recommended mentors', mentors.length + ' available', cards, 'mentors') +
            section('Your requests', requests.length + ' in total', reqList, 'requests') +
            (upcoming.length ? section('Upcoming meetings', '', meetingRows(upcoming)) : '')
        );
        view.querySelectorAll('[data-withdraw]').forEach(function (b) {
            b.onclick = async function () {
                if (!(await A.confirmDialog('Withdraw this request?', 'The mentor is told, and you can ask them again later.', 'Withdraw', true))) return;
                try { await api('POST', '/requests/' + b.dataset.withdraw + '/withdraw'); A.toast('Request withdrawn'); pages.student(s); } catch (e) { A.toast(e.message, true); }
            };
        });
    };

    pages.mentor = async function (s) {
        const id = param('mentor');
        if (!id) { location.href = 'student-dashboard.html'; return; }
        loading();
        const r = await Promise.all([api('GET', '/mentors/' + id), api('GET', '/profile')]);
        const m = r[0].mentor;
        const mine = new Set(r[1].skills.map(function (x) { return x.name; }));
        const slotsByDay = {};
        r[0].slots.forEach(function (sl) { (slotsByDay[sl.weekday] = slotsByDay[sl.weekday] || []).push(sl.start_time + '–' + sl.end_time); });
        const week = '<div class="week">' + DAYS.map(function (d, i) {
            const list = slotsByDay[i];
            return '<div class="' + (list ? 'on' : '') + '"><b>' + d + '</b>' + (list ? list.map(esc).join('<br>') : '–') + '</div>';
        }).join('') + '</div>';
        const skills = r[0].skills.length ? '<div class="chips">' + r[0].skills.map(function (k) {
            return '<span class="chip' + (mine.has(k.name) ? ' chip--on' : '') + '">' + esc(k.name) + '<small>' + esc(k.level) + '</small></span>';
        }).join('') + '</div>' : '<p class="muted">This mentor has not listed any skills yet.</p>';
        const reviews = r[0].reviews.length ? '<div class="list">' + r[0].reviews.map(function (v) {
            return '<div class="item"><div class="item__main"><div class="item__title">' + A.stars(v.rating) + '</div><div class="item__text">' + esc(v.comment || 'No comment.') + '</div><div class="item__sub">' + esc(v.reviewer) + ' · ' + A.fmtDate(v.created_ts) + '</div></div></div>';
        }).join('') + '</div>' : '<div class="list">' + A.empty('No reviews yet', 'Reviews appear after a completed meeting.') + '</div>';
        const datalist = r[0].skills.map(function (k) { return '<option value="' + esc(k.name) + '">'; }).join('');
        const closed = m.capacity_status !== 'active' || m.open_slots <= 0;

        shell(
            '<a class="muted" href="student-dashboard.html">← All mentors</a><div style="height:24px"></div>' +
            '<div class="split"><div>' +
            '<div class="who" style="gap:22px;margin-bottom:26px"><span class="avatar avatar--lg">' + esc(A.initials(m.full_name)) + '</span><div><p class="eyebrow">' + esc(m.focus_track || 'Mentor') + (m.department ? ' · ' + esc(m.department) : '') + (m.graduation_year ? ' · Class of ' + m.graduation_year : '') + '</p><h1 style="font-size:clamp(34px,4vw,56px);margin-top:8px">' + esc(m.full_name) + '</h1><div style="margin-top:10px">' + A.stars(m.avg_rating) + (m.review_count ? ' <span class="muted">' + m.review_count + ' reviews</span>' : '') + '</div></div></div>' +
            '<p style="font-size:18px;color:var(--ink-2);max-width:60ch">' + esc(m.professional_bio || 'This mentor has not written a bio yet.') + '</p>' +
            section('Skills', m.shared_skills + ' in common with you', skills) +
            section('Usually free', 'In the mentor\'s own timezone', week) +
            section('What mentees said', '', reviews) +
            '</div><aside class="card card--dark" style="position:sticky;top:100px"><h3>Send a request</h3><p class="muted" style="margin:8px 0 22px">' + (closed ? 'This mentor is not taking new mentees right now.' : m.open_slots + ' ' + (m.open_slots === 1 ? 'place' : 'places') + ' left. Keep it short and specific.') + '</p>' +
            '<form id="reqForm" novalidate><div class="field"><label style="color:rgba(246,242,234,.8)" for="rf-f">Focus area</label><input class="input" id="rf-f" name="focus" list="focusList" maxlength="50" placeholder="What do you want help with?"><datalist id="focusList">' + datalist + '</datalist></div>' +
            '<div class="field"><label style="color:rgba(246,242,234,.8)" for="rf-p">Your pitch</label><textarea class="textarea" id="rf-p" name="pitch" maxlength="1000" placeholder="Where you are now, what you are trying to do, and what you would like from this mentor."></textarea></div>' +
            '<div class="form-error" role="alert" style="color:#f0a08f"></div><button class="btn btn--light" type="submit" style="width:100%"' + (closed ? ' disabled' : '') + '>Send request</button></form></aside></div>'
        );
        document.getElementById('reqForm').addEventListener('submit', async function (e) {
            e.preventDefault();
            const f = e.target;
            const err = f.querySelector('.form-error');
            const btn = f.querySelector('button');
            err.textContent = '';
            if (f.pitch.value.trim().length < 20) { err.textContent = 'Write at least a couple of sentences.'; return; }
            btn.disabled = true;
            try {
                await api('POST', '/requests', { alumniId: Number(id), focusArea: f.focus.value.trim(), pitchMessage: f.pitch.value.trim() });
                A.toast('Request sent to ' + m.full_name);
                setTimeout(function () { location.href = 'student-dashboard.html'; }, 600);
            } catch (ex) {
                err.textContent = ex.message;
                btn.disabled = false;
            }
        });
    };

    pages.alumni = async function (s) {
        loading();
        const r = await Promise.all([api('GET', '/requests/incoming'), api('GET', '/requests/mentees'), api('GET', '/capacity'), api('GET', '/meetings'), api('GET', '/matches/mine'), api('GET', '/profile'), api('GET', '/invites')]);
        const mySkills = new Set(r[5].skills.map(function (x) { return x.name; }));
        const incoming = r[0].requests;
        const mentees = r[1].mentees;
        const cap = r[2].capacity;
        const upcoming = upcomingOf(r[3].meetings);
        const unreadByReq = {};
        r[4].matches.forEach(function (m) { unreadByReq[m.request_id] = m.unread; });

        const paused = cap.capacity_status !== 'active';
        const incomingHtml = incoming.length === 0
            ? '<div class="list">' + A.empty('No pending requests', paused ? 'You are paused, so students cannot find you.' : 'New requests show up here.') + '</div>'
            : '<div class="list">' + incoming.map(function (q) {
                return '<div class="item"><div class="item__main">' + person(q.student_name, (q.student_track || 'Student') + ' · ' + (q.focus_area || 'General') + ' · ' + A.ago(q.creation_ts)) +
                    '<div class="item__text">' + esc(q.pitch_message) + '</div>' + (q.skills ? '<div style="margin-top:12px">' + skillChips(q.skills, mySkills, 6) + '</div>' : '') + (q.shared_skills > 0 ? '<div style="margin-top:12px"><span class="badge badge--match">' + q.shared_skills + ' shared skill' + (q.shared_skills === 1 ? '' : 's') + '</span></div>' : '') + '</div>' +
                    '<div class="item__actions"><button class="btn btn--ghost btn--sm" data-act="declined" data-id="' + q.request_id + '">Decline</button><button class="btn btn--sm" data-act="accepted" data-id="' + q.request_id + '">Accept</button></div></div>';
            }).join('') + '</div>';
        const menteesHtml = mentees.length === 0
            ? '<div class="list">' + A.empty('No mentees yet', 'Accepted students appear here.') + '</div>'
            : '<div class="list">' + mentees.map(function (m) {
                const u = unreadByReq[m.request_id] || 0;
                return '<div class="item"><div class="item__main">' + person(m.student_name, (m.student_track || 'Student') + ' · ' + (m.focus_area || 'General') + ' · since ' + A.fmtDate(m.creation_ts)) + '</div><div class="item__actions">' +
                    (m.student_email ? '<a class="btn btn--ghost btn--sm" href="mailto:' + esc(m.student_email) + '">Email</a>' : '') +
                    '<a class="btn btn--ghost btn--sm" href="meetings.html?match=' + m.request_id + '">Book</a><a class="btn btn--sm" href="messages.html?match=' + m.request_id + '">Message' + (u ? ' (' + u + ')' : '') + '</a>' +
                    '<button class="btn btn--danger btn--sm" data-end="' + m.request_id + '" hidden>End</button></div></div>';
            }).join('') + '</div>';

        shell(
            head('Mentor', 'Welcome, ' + A.firstName(s.fullName) + '.', 'Answer requests, talk to your mentees and keep your capacity current.', '<a class="btn btn--ghost" href="manage-schedule.html">Capacity and hours</a>') +
            (cap.verification_status !== 'verified' ? '<div class="card card--dark" style="margin-bottom:24px"><h3>' + (cap.verification_status === 'rejected' ? 'Your account was not verified' : 'Waiting for verification') + '</h3><p class="muted" style="margin-top:6px">' + (cap.verification_status === 'rejected' ? 'Contact the administrator. Students cannot see you.' : 'An administrator is checking your graduation details. Students cannot see you until then.') + '</p></div>' : '') +
            (paused ? '<div class="card card--dark" style="margin-bottom:24px"><h3>You are paused</h3><p class="muted" style="margin-top:6px">Students cannot see you until you switch back to active in Capacity and hours.</p></div>' : '') +
            '<div class="stats">' + stat(incoming.length, 'Pending requests', '#requests') + stat(mentees.length + ' / ' + cap.max_mentees, 'Mentees', '#mentees') + stat(cap.capacity_status === 'active' ? 'Open' : 'Paused', 'Status', 'manage-schedule.html') + stat(upcoming.length, 'Upcoming meetings', 'meetings.html') + '</div>' + proposalBanner(r[3].meetings) +
            section('Requests waiting', incoming.length + ' pending', incomingHtml, 'requests') +
            section('Your mentees', mentees.length + ' of ' + cap.max_mentees + ' places used', menteesHtml, 'mentees') +
            (cap.verification_status === 'verified' ? inviteBlock(r[6].invites, 'you can vouch for up to 3 new alumni') : '') +
            (upcoming.length ? section('Upcoming meetings', '', meetingRows(upcoming)) : '')
        );
        wireInvites(function () { pages.alumni(s); });

        view.querySelectorAll('[data-act]').forEach(function (b) {
            b.onclick = async function () {
                b.disabled = true;
                try {
                    await api('PATCH', '/requests/' + b.dataset.id, { status: b.dataset.act });
                    A.toast(b.dataset.act === 'accepted' ? 'Request accepted' : 'Request declined');
                    pages.alumni(s).catch(function (e) { fail(e, function () { pages.alumni(s); }); });
                } catch (e) {
                    A.toast(e.message, true);
                    b.disabled = false;
                }
            };
        });
    };

    pages.schedule = async function () {
        loading();
        const d = await api('GET', '/capacity');
        const state = { status: d.capacity.capacity_status, max: d.capacity.max_mentees, slots: d.slots.map(function (x) { return { weekday: x.weekday, startTime: x.start_time, endTime: x.end_time }; }) };

        function slotRow(sl, i) {
            return '<div class="slot" data-i="' + i + '"><select class="select" data-f="weekday">' + DAYS.map(function (n, k) { return '<option value="' + k + '"' + (k === sl.weekday ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select>' +
                '<input class="input" type="time" data-f="startTime" value="' + esc(sl.startTime) + '"><input class="input" type="time" data-f="endTime" value="' + esc(sl.endTime) + '"><button type="button" class="btn btn--ghost btn--sm" data-rm="' + i + '">Remove</button></div>';
        }

        function paint() {
            shell(
                head('Mentor', 'Capacity and hours', 'This is what students see. Paused mentors are hidden from the list.') +
                '<div class="two"><div class="card"><div class="field"><span class="label">Status</span><div class="switch" role="group"><button type="button" data-s="active" aria-pressed="' + (state.status === 'active') + '">Open to mentees</button><button type="button" data-s="paused" aria-pressed="' + (state.status === 'paused') + '">Paused</button></div></div>' +
                '<div class="field"><span class="label">Maximum mentees</span><div class="stepper"><button type="button" data-m="-1" aria-label="Fewer">−</button><output>' + state.max + '</output><button type="button" data-m="1" aria-label="More">+</button></div><span class="hint">You currently have ' + d.capacity.current_mentees + '. The database will not let you accept more than this number.</span></div>' +
                '<div class="field"><label for="hrs">Preferred hours</label><input class="input" id="hrs" maxlength="100" value="' + esc(d.capacity.preferred_hours || '') + '" placeholder="For example: weekday evenings"></div></div>' +
                '<div class="card"><div class="section__head" style="margin-top:0"><h3>Weekly availability</h3></div><div id="slots">' + (state.slots.length ? state.slots.map(slotRow).join('') : '<p class="muted" style="margin-bottom:14px">No slots yet. Add the times you are usually free.</p>') + '</div><button type="button" class="btn btn--ghost btn--sm" id="addSlot">Add a slot</button></div></div>' +
                '<div class="form-error" id="schErr" role="alert" style="margin-top:20px"></div><div style="margin-top:12px"><button class="btn" id="saveSch">Save changes</button></div>'
            );
            view.querySelectorAll('[data-s]').forEach(function (b) { b.onclick = function () { state.status = b.dataset.s; sync(); paint(); }; });
            view.querySelectorAll('[data-m]').forEach(function (b) { b.onclick = function () { state.max = Math.min(20, Math.max(1, state.max + Number(b.dataset.m))); sync(); paint(); }; });
            view.querySelectorAll('[data-rm]').forEach(function (b) { b.onclick = function () { sync(); state.slots.splice(Number(b.dataset.rm), 1); paint(); }; });
            document.getElementById('addSlot').onclick = function () { sync(); state.slots.push({ weekday: 0, startTime: '18:00', endTime: '20:00' }); paint(); };
            document.getElementById('saveSch').onclick = save;
        }

        function sync() {
            state.hours = document.getElementById('hrs').value;
            view.querySelectorAll('.slot').forEach(function (row) {
                const sl = state.slots[Number(row.dataset.i)];
                if (!sl) return;
                sl.weekday = Number(row.querySelector('[data-f=weekday]').value);
                sl.startTime = row.querySelector('[data-f=startTime]').value;
                sl.endTime = row.querySelector('[data-f=endTime]').value;
            });
        }

        async function save() {
            sync();
            const err = document.getElementById('schErr');
            const bad = state.slots.find(function (x) { return !x.startTime || !x.endTime || x.endTime <= x.startTime; });
            if (bad) { err.textContent = 'Every slot needs an end time after its start time.'; return; }
            err.textContent = '';
            const btn = document.getElementById('saveSch');
            btn.disabled = true;
            try {
                await api('PUT', '/capacity', { status: state.status, maxMentees: state.max, preferredHours: state.hours, slots: state.slots });
                A.toast('Saved');
            } catch (e) {
                err.textContent = e.message;
            }
            btn.disabled = false;
        }
        paint();
    };

    pages.profile = async function (s) {
        loading();
        const r = await Promise.all([api('GET', '/profile'), api('GET', '/skills')]);
        const p = r[0].profile;
        const catalog = r[1].skills;
        const chosen = {};
        r[0].skills.forEach(function (k) { chosen[k.skill_id] = k.level; });
        const tracks = TRACKS.indexOf(p.focus_track) === -1 && p.focus_track ? TRACKS.concat([p.focus_track]) : TRACKS;
        const groups = {};
        catalog.forEach(function (k) { (groups[k.category] = groups[k.category] || []).push(k); });

        function skillsHtml() {
            const keys = Object.keys(groups).sort();
            return keys.map(function (cat) {
                return '<div class="skillgroup"><h4>' + esc(cat) + '</h4><div class="chips">' + groups[cat].map(function (k) {
                    return '<button type="button" class="chip' + (chosen[k.skill_id] ? ' chip--on' : '') + '" data-k="' + k.skill_id + '" aria-pressed="' + Boolean(chosen[k.skill_id]) + '">' + esc(k.name) + '</button>';
                }).join('') + '</div></div>';
            }).join('');
        }

        function levelsHtml() {
            const ids = Object.keys(chosen);
            if (ids.length === 0) return '<p class="muted">Tap a few skills above and set how well you know each one here.</p>';
            return ids.map(function (id) {
                const k = catalog.find(function (x) { return String(x.skill_id) === id; });
                return '<div class="item" style="padding:12px 0;border-bottom:1px solid var(--line)"><span>' + esc(k.name) + '</span><select class="select" style="width:auto" data-l="' + id + '">' +
                    ['beginner', 'intermediate', 'expert'].map(function (lv) { return '<option' + (chosen[id] === lv ? ' selected' : '') + '>' + lv + '</option>'; }).join('') + '</select></div>';
            }).join('');
        }

        shell(
            head(s.role === 'alumni' ? 'Mentor' : 'Student', param('welcome') ? 'Welcome. Add your skills.' : 'Your profile', param('welcome') ? 'Your account is ready. Fill in a few details and pick your skills so the matcher has something to work with.' : 'Your name, a short bio and the skills used for matching.') +
            '<form id="pf" novalidate><div class="two"><div class="card"><div class="field"><label for="pf-n">Full name</label><input class="input" id="pf-n" name="fullName" value="' + esc(p.full_name) + '" required></div>' +
            '<div class="field"><label for="pf-e">Email</label><input class="input" id="pf-e" name="email" type="email" value="' + esc(p.email || '') + '"><span class="hint">Shown to a mentor or mentee only after a request is accepted.</span></div>' +
            '<div class="field"><label for="pf-t">Focus track</label><select class="select" id="pf-t" name="focusTrack"><option value="">Not set</option>' + tracks.map(function (t) { return '<option' + (t === p.focus_track ? ' selected' : '') + '>' + esc(t) + '</option>'; }).join('') + '</select></div>' +
            '<div class="field"><label for="pf-d">Department</label><input class="input" id="pf-d" name="department" maxlength="60" value="' + esc(p.department || '') + '" placeholder="For example: CSE"><span class="hint">Mentors from your department are ranked higher for you.</span></div>' +
            '<div class="field"><label for="pf-b">Bio</label><textarea class="textarea" id="pf-b" name="bio" maxlength="1000" placeholder="' + (s.role === 'alumni' ? 'What you do now and what you can help with.' : 'Where you are and what you are working towards.') + '">' + esc(p.professional_bio || '') + '</textarea></div></div>' +
            '<div class="card"><h3>Skills</h3><p class="muted" style="margin:8px 0 20px">' + (s.role === 'alumni' ? 'Tap what you can mentor on. Students see these on your card.' : 'Tap what you know and what you want to learn. Mentors are ranked by how many you share.') + '</p><div id="skills">' + skillsHtml() + '</div><div class="skilladd"><input class="input" id="skNew" maxlength="40" placeholder="Not listed? Add your own skill" autocomplete="off"><button type="button" class="btn btn--ghost" id="skAdd">Add</button></div><div class="form-error" id="skErr" role="alert"></div><div class="section__head" style="margin-top:22px"><h3 style="font-size:20px">Your level</h3></div><div id="levels">' + levelsHtml() + '</div></div></div>' +
            '<div class="form-error" id="pfErr" role="alert" style="margin-top:20px"></div><div style="margin-top:12px"><button class="btn" type="submit">Save profile</button></div></form>'
        );

        function bind() {
            view.querySelectorAll('[data-k]').forEach(function (b) {
                b.onclick = function () {
                    const id = b.dataset.k;
                    if (chosen[id]) delete chosen[id]; else chosen[id] = 'intermediate';
                    b.classList.toggle('chip--on', Boolean(chosen[id]));
                    b.setAttribute('aria-pressed', String(Boolean(chosen[id])));
                    document.getElementById('levels').innerHTML = levelsHtml();
                    bindLevels();
                };
            });
            bindLevels();
        }
        function bindLevels() {
            view.querySelectorAll('[data-l]').forEach(function (sel) { sel.onchange = function () { chosen[sel.dataset.l] = sel.value; }; });
        }
        bind();

        async function addSkill() {
            const input = document.getElementById('skNew');
            const err = document.getElementById('skErr');
            const name = input.value.trim();
            err.textContent = '';
            if (name.length < 2) { err.textContent = 'Type at least two letters.'; return; }
            try {
                const d = await api('POST', '/skills', { name: name });
                if (!catalog.some(function (k) { return k.skill_id === d.skill.skill_id; })) {
                    catalog.push(d.skill);
                    (groups[d.skill.category] = groups[d.skill.category] || []).push(d.skill);
                }
                chosen[d.skill.skill_id] = chosen[d.skill.skill_id] || 'intermediate';
                input.value = '';
                document.getElementById('skills').innerHTML = skillsHtml();
                document.getElementById('levels').innerHTML = levelsHtml();
                bind();
            } catch (ex) { err.textContent = ex.message; }
        }
        document.getElementById('skAdd').onclick = addSkill;
        document.getElementById('skNew').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } });

        document.getElementById('pf').addEventListener('submit', async function (e) {
            e.preventDefault();
            const f = e.target;
            const err = document.getElementById('pfErr');
            const btn = f.querySelector('[type=submit]');
            err.textContent = '';
            if (!f.fullName.value.trim()) { err.textContent = 'Your name is required.'; return; }
            btn.disabled = true;
            try {
                await api('PUT', '/profile', { fullName: f.fullName.value.trim(), email: f.email.value.trim(), focusTrack: f.focusTrack.value, department: f.department.value.trim(), bio: f.bio.value.trim() });
                await api('PUT', '/profile/skills', { skills: Object.keys(chosen).map(function (id) { return { skillId: Number(id), level: chosen[id] }; }) });
                A.session.write(Object.assign({}, A.session.read(), { fullName: f.fullName.value.trim() }));
                A.toast('Profile saved');
                if (param('welcome')) setTimeout(function () { location.href = A.HOME[s.role]; }, 700);
            } catch (ex) {
                err.textContent = ex.message;
            }
            btn.disabled = false;
        });
    };

    pages.messages = async function (s) {
        loading();
        const d = await api('GET', '/matches/mine');
        const matches = d.matches;
        if (matches.length === 0) {
            shell(head('Messages', 'Conversations') + '<div class="list">' + A.empty('No conversations yet', 'Chat opens once a mentor accepts a request.') + '</div>');
            return;
        }
        let current = Number(param('match')) || matches[0].request_id;
        if (!matches.some(function (m) { return m.request_id === current; })) current = matches[0].request_id;
        let lastId = 0;
        let timer = null;

        shell(head('Messages', 'Conversations') + '<div class="chat"><aside class="chat__side" id="side"></aside><section class="chat__main"><div class="chat__head" id="chead"></div><div class="chat__log" id="log"></div><form class="chat__form" id="cform"><input class="input" id="cin" maxlength="2000" placeholder="Write a message" autocomplete="off"><button class="btn" type="submit">Send</button></form></section></div>');

        function side() {
            document.getElementById('side').innerHTML = matches.map(function (m) {
                return '<button class="chat__row" data-m="' + m.request_id + '" aria-current="' + (m.request_id === current) + '"><span class="avatar">' + esc(A.initials(m.other_name)) + '</span><div><strong>' + esc(m.other_name) + '</strong><span>' + esc(m.focus_area || 'General') + '</span></div>' + (m.unread && m.request_id !== current ? '<i class="dot"></i>' : '') + '</button>';
            }).join('');
            view.querySelectorAll('[data-m]').forEach(function (b) { b.onclick = function () { open(Number(b.dataset.m)); }; });
        }

        function bubble(msg) {
            const mine = msg.sender_id === s.userId;
            return '<div class="bubble ' + (mine ? 'bubble--me' : 'bubble--them') + '">' + esc(msg.body) + '<small>' + esc(A.fmtTime(msg.sent_ts)) + '</small></div>';
        }

        async function pull(first) {
            const log = document.getElementById('log');
            const res = await api('GET', '/messages/' + current + '?after=' + lastId);
            if (first) {
                document.getElementById('chead').innerHTML = '<div class="who"><span class="avatar">' + esc(A.initials(res.otherName)) + '</span><div class="item__title">' + esc(res.otherName) + '</div></div><a class="btn btn--ghost btn--sm" href="meetings.html?match=' + current + '">Book a meeting</a>';
                log.innerHTML = '';
            }
            if (res.messages.length) {
                const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 80 || first;
                log.insertAdjacentHTML('beforeend', res.messages.map(bubble).join(''));
                lastId = res.messages[res.messages.length - 1].message_id;
                if (atBottom) log.scrollTop = log.scrollHeight;
            }
            if (first && res.messages.length === 0) log.innerHTML = '<div class="chat__empty">No messages yet. Say hello.</div>';
            else if (res.messages.length) { const empty = log.querySelector('.chat__empty'); if (empty) empty.remove(); }
            document.getElementById('cin').disabled = !res.open;
            document.getElementById('cin').placeholder = res.open ? 'Write a message' : 'This match has ended';
            const row = matches.find(function (m) { return m.request_id === current; });
            if (row && row.unread) { row.unread = 0; side(); }
        }

        async function open(id) {
            current = id;
            lastId = 0;
            history.replaceState(null, '', 'messages.html?match=' + id);
            side();
            try { await pull(true); } catch (e) { A.toast(e.message, true); }
        }

        document.getElementById('cform').addEventListener('submit', async function (e) {
            e.preventDefault();
            const input = document.getElementById('cin');
            const body = input.value.trim();
            if (!body) return;
            input.value = '';
            try {
                await api('POST', '/messages/' + current, { body: body });
                await pull(false);
            } catch (ex) {
                A.toast(ex.message, true);
                input.value = body;
            }
        });

        timer = setInterval(function () { if (!document.hidden) pull(false).catch(function () {}); }, 4000);
        window.addEventListener('beforeunload', function () { clearInterval(timer); });
        side();
        await pull(true);
    };

    pages.meetings = async function (s) {
        loading();
        const r = await Promise.all([api('GET', '/meetings'), api('GET', '/matches/mine')]);
        const meetings = r[0].meetings;
        const matches = r[1].matches;
        const now = Date.now();
        const upcoming = upcomingOf(meetings);
        const proposals = meetings.filter(function (m) { return m.status === 'proposed' && A.parseDate(m.scheduled_at).getTime() > now; })
            .sort(function (a, b) { return A.parseDate(a.scheduled_at) - A.parseDate(b.scheduled_at); });
        const past = meetings.filter(function (m) { return upcoming.indexOf(m) === -1 && proposals.indexOf(m) === -1; });
        const pre = Number(param('match')) || (matches[0] && matches[0].request_id);

        function row(m) {
            const when = A.parseDate(m.scheduled_at).getTime();
            const actions = [];
            let note = '';
            let status = m.status;
            if (m.status === 'proposed') {
                if (when <= now) {
                    status = 'expired';
                } else if (m.can_respond) {
                    note = esc(A.firstName(m.other_name)) + ' proposed this time';
                    actions.push('<button class="btn btn--ghost btn--sm" data-decline="' + m.meeting_id + '">Decline</button>', '<button class="btn btn--sm" data-accept="' + m.meeting_id + '">Accept</button>');
                } else {
                    note = 'Waiting for ' + esc(A.firstName(m.other_name)) + ' to confirm';
                    actions.push('<button class="btn btn--ghost btn--sm" data-cancel="' + m.meeting_id + '">Withdraw</button>');
                }
            }
            if (m.status === 'scheduled') {
                if (m.meeting_link) actions.push('<a class="btn btn--ghost btn--sm" target="_blank" rel="noopener" href="' + esc(m.meeting_link) + '">Join call</a>');
                if (when <= now) actions.push('<button class="btn btn--sm" data-done="' + m.meeting_id + '">Mark complete</button>');
                actions.push('<button class="btn btn--ghost btn--sm" data-cancel="' + m.meeting_id + '">Cancel</button>');
            }
            if (m.can_review) actions.push('<button class="btn btn--copper btn--sm" data-review="' + m.meeting_id + '">Leave a review</button>');
            return '<div class="item"><div class="item__main">' + person(m.other_name, A.fmtDateTime(m.scheduled_at) + ' · ' + m.duration_min + ' min') +
                (note ? '<div class="item__text">' + note + '</div>' : '') +
                (m.rating ? '<div class="item__text">' + A.stars(m.rating) + (m.comment ? ' <span class="muted">' + esc(m.comment) + '</span>' : '') + '</div>' : '') + '</div><div class="item__actions">' + A.badge(status) + actions.join('') + '</div></div>';
        }

        const form = matches.length === 0
            ? '<div class="card">' + A.empty('Nothing to book yet', 'You can book once a request is accepted.') + '</div>'
            : '<form class="card" id="bk" novalidate><div class="row"><div class="field"><label for="bk-m">With</label><select class="select" id="bk-m" name="match">' + matches.map(function (m) { return '<option value="' + m.request_id + '"' + (m.request_id === pre ? ' selected' : '') + '>' + esc(m.other_name) + '</option>'; }).join('') + '</select></div>' +
            '<div class="field"><label for="bk-d">Date and time (your timezone)</label><input class="input" id="bk-d" name="when" type="datetime-local" required></div>' +
            '<div class="field"><label for="bk-l">Length</label><select class="select" id="bk-l" name="len"><option value="30">30 minutes</option><option value="45">45 minutes</option><option value="60">60 minutes</option><option value="90">90 minutes</option></select></div></div>' +
            '<div class="field"><label for="bk-k">Video call link</label><input class="input" id="bk-k" name="link" maxlength="255" placeholder="Leave empty and a private call room is created for you"><span class="hint">The other person has to confirm the time before it is booked. Once confirmed, you both get a Join call button.</span></div><div class="form-error" id="bkErr" role="alert"></div><button class="btn" type="submit">Send proposal</button></form>';

        shell(
            head(s.role === 'alumni' ? 'Mentor' : 'Student', 'Meetings', 'Propose a time, the other person confirms it, then you both join the same call. Times are shown in your timezone.') +
            section('Propose a meeting', '', form) +
            (proposals.length ? section('Waiting for an answer', proposals.length + (proposals.length === 1 ? ' proposal' : ' proposals'), '<div class="list">' + proposals.map(row).join('') + '</div>', 'proposals') : '') +
            section('Upcoming', upcoming.length + ' booked', '<div class="list">' + (upcoming.length ? upcoming.map(row).join('') : A.empty('Nothing upcoming', 'Booked meetings appear here.')) + '</div>') +
            section('Past and closed', past.length + ' meetings', '<div class="list">' + (past.length ? past.map(row).join('') : A.empty('No history yet')) + '</div>')
        );

        const refresh = function () { pages.meetings(s).catch(function (e) { fail(e, function () { pages.meetings(s); }); }); };
        const bk = document.getElementById('bk');
        if (bk) {
            const min = new Date(Date.now() + 3600000);
            min.setMinutes(0, 0, 0);
            bk.when.min = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            bk.when.value = new Date(min.getTime() - min.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            bk.addEventListener('submit', async function (e) {
                e.preventDefault();
                const err = document.getElementById('bkErr');
                err.textContent = '';
                if (!bk.when.value) { err.textContent = 'Choose a date and time.'; return; }
                const btn = bk.querySelector('[type=submit]');
                btn.disabled = true;
                try {
                    await api('POST', '/meetings', { requestId: Number(bk.match.value), scheduledAt: new Date(bk.when.value).toISOString(), durationMin: Number(bk.len.value), meetingLink: bk.link.value.trim() });
                    A.toast('Proposal sent. It is booked once they confirm.');
                    refresh();
                } catch (ex) {
                    err.textContent = ex.message;
                    btn.disabled = false;
                }
            });
        }
        async function setStatus(id, status) {
            try {
                await api('PATCH', '/meetings/' + id, { status: status });
                A.toast({ completed: 'Marked complete', scheduled: 'Meeting confirmed', declined: 'Proposal declined', cancelled: 'Cancelled' }[status]);
                refresh();
            } catch (e) { A.toast(e.message, true); }
        }
        view.querySelectorAll('[data-done]').forEach(function (b) { b.onclick = function () { setStatus(b.dataset.done, 'completed'); }; });
        view.querySelectorAll('[data-accept]').forEach(function (b) { b.onclick = function () { setStatus(b.dataset.accept, 'scheduled'); }; });
        view.querySelectorAll('[data-decline]').forEach(function (b) { b.onclick = function () { setStatus(b.dataset.decline, 'declined'); }; });
        view.querySelectorAll('[data-cancel]').forEach(function (b) {
            b.onclick = async function () {
                if (await A.confirmDialog('Cancel this meeting?', 'The other person is notified straight away.', 'Cancel meeting', true)) setStatus(b.dataset.cancel, 'cancelled');
            };
        });
        view.querySelectorAll('[data-review]').forEach(function (b) {
            b.onclick = function () {
                let rating = 0;
                const m = A.openModal('<h3>How did it go?</h3><p>One rating per meeting. It cannot be changed afterwards.</p><div class="rate" id="rt">' + [1, 2, 3, 4, 5].map(function (n) { return '<button type="button" data-n="' + n + '" aria-label="' + n + ' stars">★</button>'; }).join('') + '</div><div class="field" style="margin-top:18px"><label for="rv">Comment</label><textarea class="textarea" id="rv" maxlength="500" placeholder="What was useful?"></textarea></div><div class="form-error" id="rvErr" role="alert"></div><div class="modal__actions"><button class="btn btn--ghost" data-no>Cancel</button><button class="btn" data-ok>Submit</button></div>');
                const stars = m.el.querySelectorAll('[data-n]');
                stars.forEach(function (st) {
                    st.onclick = function () {
                        rating = Number(st.dataset.n);
                        stars.forEach(function (x) { x.classList.toggle('on', Number(x.dataset.n) <= rating); });
                    };
                });
                m.el.querySelector('[data-no]').onclick = m.close;
                m.el.querySelector('[data-ok]').onclick = async function () {
                    const err = m.el.querySelector('#rvErr');
                    if (!rating) { err.textContent = 'Pick a rating.'; return; }
                    try {
                        await api('POST', '/meetings/' + b.dataset.review + '/review', { rating: rating, comment: m.el.querySelector('#rv').value.trim() });
                        m.close();
                        A.toast('Thanks for the review');
                        refresh();
                    } catch (ex) { err.textContent = ex.message; }
                };
            };
        });
    };

    function bars(monthly) {
        if (monthly.length === 0) return '<p class="muted">No requests yet.</p>';
        const max = Math.max.apply(null, monthly.map(function (m) { return m.total; })) || 1;
        const H = 170;
        const label = function (m) {
            const d = new Date(m.month + '-01T00:00:00Z');
            return d.toLocaleDateString([], { month: 'short', timeZone: 'UTC' });
        };
        return '<div class="bars">' + monthly.map(function (m) {
            const hp = function (v) { return Math.round((v / max) * H); };
            return '<div class="bars__col" title="' + m.total + ' requests"><div class="bars__stack"><span style="height:0;background:var(--copper)" data-h="' + hp(m.accepted) + '"></span><span style="height:0;background:var(--ink)" data-h="' + hp(m.declined) + '"></span><span style="height:0;background:var(--gold)" data-h="' + hp(m.pending) + '"></span></div><div class="bars__label">' + label(m) + '</div></div>';
        }).join('') + '</div><div class="legend"><span><i style="background:var(--copper)"></i>Accepted</span><span><i style="background:var(--ink)"></i>Declined</span><span><i style="background:var(--gold)"></i>Pending</span></div>';
    }

    pages.adminHome = async function () {
        loading();
        const r = await Promise.all([api('GET', '/admin/stats'), api('GET', '/admin/analytics')]);
        const st = r[0].stats;
        const an = r[1];
        const maxSkill = Math.max.apply(null, an.skills.map(function (k) { return k.students + k.mentors; }).concat([1]));
        const leaders = an.leaders.length === 0 ? '<div class="empty">No mentors rated yet.</div>' :
            '<div class="table-wrap"><table class="table"><thead><tr><th>Track</th><th>Rank</th><th>Mentor</th><th class="num">Rating</th><th class="num">Reviews</th><th class="num">Mentees</th></tr></thead><tbody>' +
            an.leaders.map(function (l) { return '<tr><td>' + esc(l.focus_track) + '</td><td>' + l.track_rank + '</td><td>' + esc(l.full_name) + '</td><td class="num">' + (l.avg_rating === null ? '–' : l.avg_rating.toFixed(2)) + '</td><td class="num">' + l.review_count + '</td><td class="num">' + l.current_mentees + '</td></tr>'; }).join('') + '</tbody></table></div>';
        const idle = an.idleMentors.length === 0 ? '<div class="list">' + A.empty('Every mentor has received a request') + '</div>' :
            '<div class="list">' + an.idleMentors.map(function (m) { return '<div class="item">' + person(m.full_name, m.focus_track || 'No track set') + '<span class="badge">No requests</span></div>'; }).join('') + '</div>';

        shell(
            head('Administrator', 'Overview', 'Everything below is read from views and queries in the database.') +
            '<div class="stats stats--four">' + stat(st.totalUsers, 'Users', 'admin-users.html') + stat(st.students, 'Students', 'admin-users.html') + stat(st.mentors, 'Verified mentors', 'admin-alumni.html') + stat(st.activeMatches, 'Active matches', 'admin-matches.html') + stat(st.pending, 'Pending', 'admin-matches.html') + stat(st.completedMeetings, 'Meetings done') + stat(st.messages, 'Messages') + stat(st.avgRating === null ? '–' : st.avgRating.toFixed(1), 'Average rating') + '</div>' +
            '<div class="split section"><div class="card"><div class="section__head" style="margin-top:0"><h2>Requests by month</h2></div>' + bars(an.monthly) + '</div>' +
            '<div class="card" style="text-align:center"><div class="section__head" style="margin-top:0"><h2>Acceptance rate</h2></div><div style="display:grid;place-items:center;padding:14px 0"><div class="ring" style="--p:' + (an.acceptanceRate || 0) + '"><b>' + (an.acceptanceRate === null ? '–' : an.acceptanceRate + '%') + '</b></div></div><p class="muted">Accepted out of all decided requests.</p></div></div>' +
            section('Skills in demand', 'students and mentors', '<div class="card">' + an.skills.map(function (k) {
                return '<div class="hbar"><span>' + esc(k.name) + '</span><div class="hbar__track"><span style="width:0;background:var(--copper)" data-w="' + (k.students / maxSkill * 100) + '"></span><span style="width:0;background:var(--ink)" data-w="' + (k.mentors / maxSkill * 100) + '"></span></div><span class="muted">' + (k.students + k.mentors) + '</span></div>';
            }).join('') + '<div class="legend"><span><i style="background:var(--copper)"></i>Students</span><span><i style="background:var(--ink)"></i>Mentors</span></div></div>') +
            section('Top mentors in each track', 'ranked with a window function', leaders) +
            section('Mentors with no requests', an.idleMentors.length + ' found', idle)
        );
        requestAnimationFrame(function () {
            view.querySelectorAll('[data-h]').forEach(function (el) { el.style.height = el.dataset.h + 'px'; });
            view.querySelectorAll('[data-w]').forEach(function (el) { el.style.width = el.dataset.w + '%'; });
        });
    };

    pages.adminUsers = async function () {
        loading();
        const d = await api('GET', '/admin/users');
        let users = d.users;
        let q = '';

        function table() {
            const rows = users.filter(function (u) { return (u.username + ' ' + u.full_name + ' ' + u.role).toLowerCase().indexOf(q) !== -1; });
            return rows.length === 0 ? A.empty('No users match') : '<table class="table"><thead><tr><th>Name</th><th>Username</th><th>Role</th><th>Joined</th><th></th></tr></thead><tbody>' +
                rows.map(function (u) {
                    return '<tr><td>' + person(u.full_name) + '</td><td>' + esc(u.username) + '</td><td><span class="badge">' + esc(u.role) + '</span></td><td>' + A.fmtDate(u.creation_ts) + '</td><td class="num"><div class="item__actions" style="justify-content:flex-end"><button class="btn btn--ghost btn--sm" data-edit="' + u.user_id + '">Edit</button>' +
                        (u.role === 'admin' ? '' : '<button class="btn btn--danger btn--sm" data-del="' + u.user_id + '">Delete</button>') + '</div></td></tr>';
                }).join('') + '</tbody></table>';
        }

        function paint() {
            document.getElementById('tbl').innerHTML = table();
            view.querySelectorAll('[data-edit]').forEach(function (b) { b.onclick = function () { edit(Number(b.dataset.edit)); }; });
            view.querySelectorAll('[data-del]').forEach(function (b) { b.onclick = function () { remove(Number(b.dataset.del)); }; });
        }

        async function reload() { users = (await api('GET', '/admin/users')).users; paint(); }

        async function edit(id) {
            const u = users.find(function (x) { return x.user_id === id; });
            const res = await A.formDialog({
                title: 'Edit user', submit: 'Save changes',
                fields: [{ name: 'fullName', label: 'Full name', value: u.full_name, required: true }, { name: 'username', label: 'Username', value: u.username, required: true }, { name: 'role', label: 'Role', type: 'select', value: u.role, options: [{ value: 'student', label: 'Student' }, { value: 'alumni', label: 'Alumni' }, { value: 'admin', label: 'Admin' }] }],
                onSubmit: function (v) { return api('PUT', '/admin/users/' + id, v); }
            });
            if (res) { A.toast('User updated'); reload(); }
        }

        async function remove(id) {
            const u = users.find(function (x) { return x.user_id === id; });
            if (!(await A.confirmDialog('Delete ' + u.full_name + '?', 'Their requests, messages, meetings and session are removed with them. This cannot be undone.', 'Delete user', true))) return;
            try { await api('DELETE', '/admin/users/' + id); A.toast('User deleted'); reload(); } catch (e) { A.toast(e.message, true); }
        }

        shell(head('Administrator', 'Users', users.length + ' accounts. Deleting a user cascades to everything linked to them.', '<button class="btn" id="addUser">Add user</button>') +
            '<div class="field" style="max-width:420px"><input class="input" id="uq" placeholder="Search by name, username or role" aria-label="Search users"></div><div class="table-wrap" id="tbl"></div>');
        paint();
        document.getElementById('uq').oninput = function (e) { q = e.target.value.trim().toLowerCase(); paint(); };
        document.getElementById('addUser').onclick = async function () {
            const res = await A.formDialog({
                title: 'Add user', submit: 'Create user',
                fields: [{ name: 'fullName', label: 'Full name', required: true }, { name: 'username', label: 'Username', required: true }, { name: 'password', label: 'Password', type: 'password', required: true }, { name: 'role', label: 'Role', type: 'select', value: 'student', options: [{ value: 'student', label: 'Student' }, { value: 'alumni', label: 'Alumni' }, { value: 'admin', label: 'Admin' }] }],
                onSubmit: function (v) { return api('POST', '/admin/users', v); }
            });
            if (res) { A.toast('User created'); reload(); }
        };
    };

    function inviteBlock(invites, note) {
        const rows = invites.length === 0 ? '<div class="list">' + A.empty('No invite codes yet') + '</div>' :
            '<div class="list">' + invites.map(function (i) {
                const state = i.used_at ? 'Used' + (i.used_by_name ? ' by ' + esc(i.used_by_name) : '') : (new Date(i.expires_at).getTime() < Date.now() ? 'Expired' : 'Unused');
                return '<div class="item"><div class="item__main"><div class="item__title" style="font-family:monospace;letter-spacing:.06em">' + esc(i.code) + '</div><div class="item__sub">Expires ' + A.fmtDate(i.expires_at) + '</div></div><span class="badge">' + state + '</span></div>';
            }).join('') + '</div>';
        return section('Invite codes', note, rows + '<div style="margin-top:16px"><button class="btn btn--sm" data-newinvite>Create invite code</button></div>');
    }
    function wireInvites(reload) {
        const b = view.querySelector('[data-newinvite]');
        if (!b) return;
        b.onclick = async function () {
            try { const d = await api('POST', '/invites'); A.toast('Invite code ' + d.invite.code + ' created'); reload(); } catch (e) { A.toast(e.message, true); }
        };
    }

    pages.adminAlumni = async function () {
        loading();
        const both = await Promise.all([api('GET', '/admin/alumni'), api('GET', '/invites')]);
        const list = both[0].alumni;
        const label = { pending: 'Waiting', verified: 'Verified', rejected: 'Rejected' };
        const table = list.length === 0 ? A.empty('No alumni accounts yet') : '<table class="table"><thead><tr><th>Name</th><th>Department</th><th>Graduated</th><th>Status</th><th>Decided by</th><th>Invited by</th><th></th></tr></thead><tbody>' +
            list.map(function (a) {
                const verify = a.verification_status === 'verified' ? '' : '<button class="btn btn--sm" data-ok="' + a.user_id + '">Verify</button> ';
                const reject = a.verification_status === 'pending' ? '<button class="btn btn--danger btn--sm" data-no="' + a.user_id + '">Reject</button>' : (a.verification_status === 'verified' ? '<button class="btn btn--danger btn--sm" data-no="' + a.user_id + '">Revoke</button>' : '');
                return '<tr><td>' + esc(a.full_name) + '<div class="muted">' + esc(a.username) + '</div></td><td>' + esc(a.department || '–') + '</td><td>' + (a.graduation_year || '–') + '</td><td><span class="badge">' + label[a.verification_status] + '</span></td><td>' + esc(a.verified_by_name || '–') + '</td><td>' + esc(a.invited_by_name || '–') + '</td><td class="num">' + verify + reject + '</td></tr>';
            }).join('') + '</tbody></table>';
        const waiting = list.filter(function (a) { return a.verification_status === 'pending'; }).length;
        shell(head('Administrator', 'Alumni verification', waiting + ' waiting. Only verified alumni appear to students and can receive requests.') + '<div class="table-wrap">' + table + '</div>' + inviteBlock(both[1].invites, 'a code from you verifies the new alumnus at once'));
        wireInvites(pages.adminAlumni);
        function decide(attr, decision, title, text) {
            view.querySelectorAll('[' + attr + ']').forEach(function (b) {
                b.onclick = async function () {
                    if (decision === 'rejected' && !(await A.confirmDialog(title, text, 'Confirm', true))) return;
                    try { await api('PATCH', '/admin/alumni/' + b.getAttribute(attr), { decision: decision }); A.toast(decision === 'verified' ? 'Alumnus verified' : 'Alumnus rejected'); pages.adminAlumni(); } catch (e) { A.toast(e.message, true); }
                };
            });
        }
        decide('data-ok', 'verified');
        decide('data-no', 'rejected', 'Reject this alumnus?', 'They will be hidden from students and cannot receive new requests.');
    };

    pages.adminMatches = async function () {
        loading();
        const r = await Promise.all([api('GET', '/admin/matches'), api('GET', '/admin/audit')]);
        const matches = r[0].matches;
        const table = matches.length === 0 ? A.empty('No open matches') : '<table class="table"><thead><tr><th>Student</th><th>Mentor</th><th>Focus</th><th>Status</th><th>Created</th><th></th></tr></thead><tbody>' +
            matches.map(function (m) {
                return '<tr><td>' + esc(m.student_name) + '</td><td>' + esc(m.alumni_name) + '</td><td>' + esc(m.focus_area || '–') + '</td><td>' + A.badge(m.status) + '</td><td>' + A.fmtDate(m.creation_ts) + '</td><td class="num"><button class="btn btn--danger btn--sm" data-cancel="' + m.request_id + '">' + (m.status === 'pending' ? 'Cancel' : 'Revoke') + '</button></td></tr>';
            }).join('') + '</tbody></table>';
        const audit = r[1].entries.length === 0 ? '<div class="list">' + A.empty('No activity yet') + '</div>' :
            '<div class="list">' + r[1].entries.map(function (e) {
                return '<div class="item"><div class="item__main"><div class="item__title">' + esc(e.action.replace(/_/g, ' ')) + '</div><div class="item__sub">' + esc(e.actor || 'Removed user') + (e.detail ? ' · ' + esc(e.detail) : '') + '</div></div><span class="muted">' + esc(A.ago(e.created_ts)) + '</span></div>';
            }).join('') + '</div>';
        shell(head('Administrator', 'Matches', 'Pending and active matches. Cancelling sets the request to declined.') + '<div class="table-wrap">' + table + '</div>' + section('Audit log', 'written by triggers', audit));
        view.querySelectorAll('[data-cancel]').forEach(function (b) {
            b.onclick = async function () {
                if (!(await A.confirmDialog('Cancel this match?', 'The request is marked declined and both people are notified.', 'Confirm', true))) return;
                try { await api('PATCH', '/admin/matches/' + b.dataset.cancel); A.toast('Match cancelled'); pages.adminMatches(); } catch (e) { A.toast(e.message, true); }
            };
        });
    };

    const ROLE = { student: 'student', mentor: 'student', alumni: 'alumni', schedule: 'alumni', profile: 'student,alumni', messages: 'student,alumni', meetings: 'student,alumni', adminHome: 'admin', adminUsers: 'admin', adminMatches: 'admin', adminAlumni: 'admin' };
    const key = document.body.dataset.page;
    const s = A.guard(ROLE[key]);
    if (!s) return;
    A.mountShell();
    pages[key](s).catch(function (e) { fail(e, function () { pages[key](s).catch(function (x) { fail(x, function () { location.reload(); }); }); }); });
})();
