(function () {
    const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);
    const API_BASE = isLocal ? 'http://localhost:3000/api' : 'https://alumni-mentorship-matcher.onrender.com/api';
    const KEY = 'amm.session';
    let memory = null;

    const session = {
        read() {
            try { return JSON.parse(localStorage.getItem(KEY)) || memory; } catch (e) { return memory; }
        },
        write(v) {
            memory = v;
            try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {}
        },
        clear() {
            memory = null;
            try { localStorage.removeItem(KEY); } catch (e) {}
        }
    };

    const HOME = { student: 'student-dashboard.html', alumni: 'alumni-dashboard.html', admin: 'admin-dashboard.html' };

    function esc(v) {
        return String(v === null || v === undefined ? '' : v).replace(/[&<>"']/g, function (ch) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
        });
    }

    function initials(name) {
        const parts = String(name || '?').trim().split(/\s+/);
        return ((parts[0] || '?')[0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
    }

    function firstName(name) {
        return String(name || '').trim().split(/\s+/)[0] || 'there';
    }

    function parseDate(v) {
        if (!v) return null;
        const s = String(v).replace(' ', 'T');
        const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(s) ? s : s + 'Z');
        return Number.isNaN(d.getTime()) ? null : d;
    }

    function fmtDateTime(v) {
        const d = parseDate(v);
        return d ? d.toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) : '';
    }

    function fmtDate(v) {
        const d = parseDate(v);
        return d ? d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    }

    function fmtTime(v) {
        const d = parseDate(v);
        return d ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '';
    }

    function ago(v) {
        const d = parseDate(v);
        if (!d) return '';
        const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
        if (s < 60) return 'just now';
        if (s < 3600) return Math.floor(s / 60) + ' min ago';
        if (s < 86400) return Math.floor(s / 3600) + ' h ago';
        if (s < 86400 * 30) return Math.floor(s / 86400) + ' d ago';
        return fmtDate(v);
    }

    function stars(n) {
        if (n === null || n === undefined) return '<span class="muted">No reviews yet</span>';
        const full = Math.round(n);
        return '<span class="stars" aria-label="' + n + ' out of 5">' + '★'.repeat(full) + '<i>' + '★'.repeat(5 - full) + '</i></span>';
    }

    function badge(status) {
        return '<span class="badge badge--' + esc(status) + '">' + esc(status) + '</span>';
    }

    let bannerEl = null;
    const banner = {
        show(text) {
            if (!bannerEl) {
                bannerEl = document.createElement('div');
                bannerEl.className = 'banner';
                bannerEl.setAttribute('role', 'status');
                document.body.appendChild(bannerEl);
            }
            bannerEl.textContent = text;
        },
        hide() {
            if (bannerEl) { bannerEl.remove(); bannerEl = null; }
        }
    };

    async function api(method, path, body, opts) {
        const options = opts || {};
        const s = session.read();
        const headers = { 'Content-Type': 'application/json' };
        if (s && s.token && options.auth !== false) headers['x-session-token'] = s.token;
        const ctrl = new AbortController();
        const timer = setTimeout(function () { ctrl.abort(); }, 80000);
        const slow = setTimeout(function () {
            banner.show('Waking the server. The free host sleeps when idle and can take up to a minute.');
        }, 3500);
        let res;
        try {
            res = await fetch(API_BASE + path, {
                method: method,
                headers: headers,
                body: body ? JSON.stringify(body) : undefined,
                signal: ctrl.signal
            });
        } catch (e) {
            throw new Error('Cannot reach the server. Check your connection and try again.');
        } finally {
            clearTimeout(timer);
            clearTimeout(slow);
            banner.hide();
        }
        let data = null;
        try { data = await res.json(); } catch (e) {}
        if (res.status === 401 && options.auth !== false && s) {
            session.clear();
            if (document.body.classList.contains('app')) location.href = 'index.html#join';
            throw new Error('Your session has ended. Please sign in again.');
        }
        if (!res.ok || !data || data.success === false) {
            if (res.status >= 500) throw new Error((data && data.error) || 'The server hit a problem. If this keeps happening, the database may have powered off.');
            throw new Error((data && data.error) || 'Request failed');
        }
        return data;
    }

    function toast(text, bad) {
        let box = document.querySelector('.toasts');
        if (!box) {
            box = document.createElement('div');
            box.className = 'toasts';
            box.setAttribute('aria-live', 'polite');
            document.body.appendChild(box);
        }
        const t = document.createElement('div');
        t.className = 'toast' + (bad ? ' toast--bad' : '');
        t.textContent = text;
        box.appendChild(t);
        setTimeout(function () {
            t.style.transition = 'opacity .3s';
            t.style.opacity = '0';
            setTimeout(function () { t.remove(); }, 320);
        }, bad ? 5200 : 3200);
    }

    function openModal(html) {
        const wrap = document.createElement('div');
        wrap.className = 'modal';
        wrap.innerHTML = '<div class="modal__box" role="dialog" aria-modal="true">' + html + '</div>';
        document.body.appendChild(wrap);
        const close = function () { wrap.remove(); document.removeEventListener('keydown', onKey); };
        const onKey = function (e) { if (e.key === 'Escape') close(); };
        document.addEventListener('keydown', onKey);
        wrap.addEventListener('mousedown', function (e) { if (e.target === wrap) close(); });
        return { el: wrap, close: close };
    }

    function confirmDialog(title, text, label, danger) {
        return new Promise(function (resolve) {
            const m = openModal(
                '<h3>' + esc(title) + '</h3><p>' + esc(text) + '</p><div class="modal__actions">' +
                '<button class="btn btn--ghost" data-no>Cancel</button>' +
                '<button class="btn ' + (danger ? 'btn--copper' : '') + '" data-yes>' + esc(label || 'Confirm') + '</button></div>'
            );
            m.el.querySelector('[data-no]').onclick = function () { m.close(); resolve(false); };
            m.el.querySelector('[data-yes]').onclick = function () { m.close(); resolve(true); };
            m.el.addEventListener('mousedown', function (e) { if (e.target === m.el) resolve(false); });
        });
    }

    function formDialog(opts) {
        return new Promise(function (resolve) {
            const fields = opts.fields.map(function (f) {
                let control;
                if (f.type === 'select') {
                    control = '<select class="select" name="' + f.name + '">' + f.options.map(function (o) {
                        return '<option value="' + esc(o.value) + '"' + (String(o.value) === String(f.value) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
                    }).join('') + '</select>';
                } else {
                    control = '<input class="input" name="' + f.name + '" type="' + (f.type || 'text') + '" value="' + esc(f.value || '') + '"' + (f.required ? ' required' : '') + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '>';
                }
                return '<div class="field"><label>' + esc(f.label) + '</label>' + control + '</div>';
            }).join('');
            const m = openModal(
                '<h3>' + esc(opts.title) + '</h3>' + (opts.text ? '<p>' + esc(opts.text) + '</p>' : '') +
                '<form novalidate>' + fields + '<div class="form-error" role="alert"></div><div class="modal__actions">' +
                '<button type="button" class="btn btn--ghost" data-no>Cancel</button>' +
                '<button type="submit" class="btn">' + esc(opts.submit || 'Save') + '</button></div></form>'
            );
            const form = m.el.querySelector('form');
            m.el.querySelector('[data-no]').onclick = function () { m.close(); resolve(null); };
            form.addEventListener('submit', async function (e) {
                e.preventDefault();
                const data = {};
                new FormData(form).forEach(function (v, k) { data[k] = String(v).trim(); });
                const err = form.querySelector('.form-error');
                const btn = form.querySelector('[type=submit]');
                btn.disabled = true;
                try {
                    if (opts.onSubmit) await opts.onSubmit(data);
                    m.close();
                    resolve(data);
                } catch (ex) {
                    err.textContent = ex.message;
                    btn.disabled = false;
                }
            });
            const first = form.querySelector('input,select');
            if (first) first.focus();
        });
    }

    const NAV = {
        student: [['student-dashboard.html', 'Mentors'], ['messages.html', 'Messages'], ['meetings.html', 'Meetings'], ['profile.html', 'Profile']],
        alumni: [['alumni-dashboard.html', 'Overview'], ['messages.html', 'Messages'], ['meetings.html', 'Meetings'], ['manage-schedule.html', 'Availability'], ['profile.html', 'Profile']],
        admin: [['admin-dashboard.html', 'Overview'], ['admin-users.html', 'Users'], ['admin-matches.html', 'Matches']]
    };

    function markup() {
        return '<span class="mark"><span class="mark__name"><b>A</b>lumni</span><span class="mark__sub">Mentorship Matcher</span></span>';
    }

    function mountShell() {
        const s = session.read();
        const page = location.pathname.split('/').pop() || 'index.html';
        const links = (NAV[s.role] || []).map(function (l) {
            return '<a href="' + l[0] + '"' + (page === l[0] ? ' aria-current="page"' : '') + '>' + l[1] + '</a>';
        }).join('');
        const nav = document.createElement('header');
        nav.className = 'nav';
        nav.innerHTML =
            '<a href="' + HOME[s.role] + '" aria-label="Home">' + markup() + '</a>' +
            '<nav class="nav__links">' + links + '</nav>' +
            '<div class="nav__right">' +
            (s.role === 'admin' ? '' : '<div class="account"><button class="bell" aria-label="Notifications" data-bell><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg><i hidden></i></button><div class="menu menu--wide" hidden data-notes></div></div>') +
            '<div class="account"><button class="account__btn" data-account aria-label="Account"><span class="avatar">' + esc(initials(s.fullName)) + '</span></button>' +
            '<div class="menu" hidden data-menu><div class="menu__who"><strong>' + esc(s.fullName) + '</strong><span>' + esc(s.role) + '</span></div>' +
            (s.role === 'admin' ? '' : '<a href="profile.html">Profile</a>') + '<button data-logout>Sign out</button></div></div></div>';
        document.body.prepend(nav);

        const menu = nav.querySelector('[data-menu]');
        const notes = nav.querySelector('[data-notes]');
        nav.querySelector('[data-account]').onclick = function (e) {
            e.stopPropagation();
            if (notes) notes.hidden = true;
            menu.hidden = !menu.hidden;
        };
        nav.querySelector('[data-logout]').onclick = async function () {
            try { await api('POST', '/auth/logout'); } catch (e) {}
            session.clear();
            location.href = 'index.html';
        };
        document.addEventListener('click', function (e) {
            if (!e.target.closest('.account')) {
                menu.hidden = true;
                if (notes) notes.hidden = true;
            }
        });

        if (s.role !== 'admin') {
            const bell = nav.querySelector('[data-bell]');
            const dot = bell.querySelector('i');
            const load = async function () {
                try {
                    const d = await api('GET', '/notifications');
                    dot.hidden = d.unread === 0;
                    notes.innerHTML = d.notifications.length === 0
                        ? '<div class="note">Nothing yet.<small>Requests, messages and meetings show up here.</small></div>'
                        : d.notifications.map(function (n) {
                            return '<div class="note' + (n.is_read ? '' : ' note--new') + '">' + esc(n.message) + '<small>' + esc(ago(n.created_ts)) + '</small></div>';
                        }).join('');
                } catch (e) {}
            };
            bell.onclick = async function (e) {
                e.stopPropagation();
                menu.hidden = true;
                notes.hidden = !notes.hidden;
                if (!notes.hidden && !dot.hidden) {
                    try { await api('POST', '/notifications/read'); dot.hidden = true; } catch (er) {}
                }
            };
            load();
            setInterval(function () { if (!document.hidden) load(); }, 45000);
        }
    }

    function guard(role) {
        const s = session.read();
        if (!s || !s.token) { location.replace('index.html#join'); return null; }
        const allowed = role === 'any' ? true : role.split(',').includes(s.role);
        if (!allowed) { location.replace(HOME[s.role]); return null; }
        return s;
    }

    function skeleton(n) {
        let out = '';
        for (let i = 0; i < (n || 3); i++) out += '<div class="skeleton" style="margin-bottom:16px"></div>';
        return out;
    }

    function empty(title, text) {
        return '<div class="empty"><strong>' + esc(title) + '</strong>' + esc(text || '') + '</div>';
    }

    function track(el, delay) {
        const ob = new IntersectionObserver(function (entries) {
            entries.forEach(function (en) {
                if (en.isIntersecting) { en.target.classList.add('in'); ob.unobserve(en.target); }
            });
        }, { threshold: 0.2 });
        ob.observe(el);
    }

    window.App = {
        API_BASE: API_BASE, HOME: HOME, session: session, api: api, esc: esc, initials: initials, firstName: firstName,
        fmtDate: fmtDate, fmtDateTime: fmtDateTime, fmtTime: fmtTime, ago: ago, parseDate: parseDate,
        stars: stars, badge: badge, toast: toast, openModal: openModal, confirmDialog: confirmDialog, formDialog: formDialog,
        mountShell: mountShell, guard: guard, skeleton: skeleton, empty: empty, markup: markup, track: track
    };
})();
