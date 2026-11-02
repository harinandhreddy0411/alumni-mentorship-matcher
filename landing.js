(function () {
    const A = window.App;
    const clamp = function (v, a, b) { return Math.min(b === undefined ? 1 : b, Math.max(a === undefined ? 0 : a, v)); };
    const lerp = function (a, b, t) { return a + (b - a) * t; };
    const ease = function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const nav = document.querySelector('.nav');
    const hero = document.querySelector('.hero');
    const heroMedia = document.querySelector('.hero__media');
    const heroCanvas = heroMedia.querySelector('canvas');
    const heroOver = document.querySelector('.hero__layer--over');
    const cue = document.querySelector('.hero__cue');
    const linen = document.querySelector('.linen');
    const stage = document.querySelector('.linen__stage');
    const track = document.querySelector('.linen__track');
    const arts = Array.prototype.slice.call(document.querySelectorAll('.linen__arts .medallion'));
    const beats = Array.prototype.slice.call(document.querySelectorAll('.beat'));
    const slant = document.querySelector('.slant');
    const slantHall = document.querySelector('.slant__hall');
    const slantLight = document.querySelector('.slant__layer--light');
    const slantLines = document.querySelectorAll('.slant__lines line');

    window.Art.skyline(heroCanvas);
    window.Art.hall(slantHall.querySelector('canvas'));
    document.querySelectorAll('[data-art]').forEach(function (c) { window.Art.medallion(c, c.dataset.art); });

    let heroP = 0;
    let slantT = 0;

    function progress(section) {
        const r = section.getBoundingClientRect();
        const total = section.offsetHeight - window.innerHeight;
        return clamp(-r.top / total);
    }

    function updateHero() {
        const W = window.innerWidth;
        const H = window.innerHeight;
        heroP = progress(hero);
        const t = reduce ? 1 : ease(clamp(heroP / 0.6));
        const small = W < 720;
        const tl = small ? W * 0.06 : W * 0.15;
        const tr = small ? W * 0.06 : W * 0.155;
        const tt = small ? Math.max(100, H * 0.22) : Math.max(H * 0.175, 112);
        const tb = small ? H * 0.2 : H * 0.165;
        const l = lerp(0, tl, t);
        const r = lerp(0, tr, t);
        const tp = lerp(0, tt, t);
        const b = lerp(0, tb, t);
        const rad = lerp(0, 36, t);
        heroMedia.style.left = l + 'px';
        heroMedia.style.right = r + 'px';
        heroMedia.style.top = tp + 'px';
        heroMedia.style.bottom = b + 'px';
        heroMedia.style.borderRadius = rad + 'px';
        heroMedia.style.boxShadow = '0 ' + lerp(0, 40, t) + 'px ' + lerp(0, 90, t) + 'px rgba(60,35,15,' + lerp(0, 0.32, t) + ')';
        heroCanvas.style.transform = 'scale(' + lerp(1.14, 1, t) + ')';
        heroOver.style.clipPath = 'inset(' + tp + 'px ' + r + 'px ' + b + 'px ' + l + 'px round ' + rad + 'px)';
        cue.style.opacity = String(1 - clamp(heroP / 0.1));
    }

    function sizeLinen() {
        linen.style.height = (beats.length + 2) * stage.offsetHeight + 'px';
    }

    function updateBeats() {
        const H = stage.offsetHeight;
        const d = clamp(-linen.getBoundingClientRect().top, 0, (beats.length + 1) * H);
        const ty = H - d;
        track.style.transform = 'translate3d(0,' + ty + 'px,0)';
        beats.forEach(function (beat, i) {
            const off = ty + i * H;
            const text = beat.querySelector('.beat__text');
            text.style.opacity = String(reduce ? 1 : 1 - Math.pow(clamp(Math.abs(off) / (H * 0.5)), 1.6));
            const art = arts[i];
            const k = clamp(Math.abs(off) / (H * 0.9));
            art.style.opacity = String(reduce ? (Math.abs(off) < H * 0.5 ? 1 : 0) : 1 - k * k);
            art.style.setProperty('--s', String(reduce ? 1 : 0.9 + 0.1 * (1 - k)));
        });
    }

    function updateSlant() {
        const p = progress(slant);
        slantT = reduce ? 1 : ease(clamp(p / 0.68));
        const t = slantT;
        const pts = [
            [lerp(52.5, 0, t), 0],
            [lerp(71, 100, t), 0],
            [lerp(45, 100, t), 100],
            [lerp(26.6, 0, t), 100]
        ];
        const poly = 'polygon(' + pts.map(function (q) { return q[0] + '% ' + q[1] + '%'; }).join(',') + ')';
        slantHall.style.clipPath = poly;
        slantLight.style.clipPath = poly;
        slantLines[0].setAttribute('x1', pts[3][0]);
        slantLines[0].setAttribute('x2', pts[0][0]);
        slantLines[1].setAttribute('x1', pts[2][0]);
        slantLines[1].setAttribute('x2', pts[1][0]);
        const o = String(1 - clamp((t - 0.7) / 0.3));
        slantLines[0].style.opacity = o;
        slantLines[1].style.opacity = o;
        slantHall.querySelector('canvas').style.transform = 'scale(' + lerp(1.2, 1, t) + ')';
    }

    function updateNav() {
        const y = nav.offsetHeight / 2;
        let theme = 'cream';
        const zones = [
            [hero, function () { return heroP < 0.1 ? 'dark' : 'cream'; }],
            [linen, function () { return 'sand'; }],
            [slant, function () { return slantT < 0.55 ? 'cream' : 'sand'; }],
            [document.getElementById('numbers'), function () { return 'sand'; }]
        ];
        zones.forEach(function (z) {
            const r = z[0].getBoundingClientRect();
            if (r.top <= y && r.bottom > y) theme = z[1]();
        });
        if (nav.dataset.theme !== theme) nav.dataset.theme = theme;
    }

    let ticking = false;
    function frame() {
        ticking = false;
        updateHero();
        updateBeats();
        updateSlant();
        updateNav();
    }
    function request() {
        if (!ticking) { ticking = true; requestAnimationFrame(frame); }
    }
    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', function () { sizeLinen(); request(); });
    sizeLinen();
    frame();

    document.querySelectorAll('.step').forEach(function (s, i) {
        s.style.transitionDelay = i * 90 + 'ms';
        A.track(s);
    });

    function countUp(el, to, decimals) {
        const start = performance.now();
        const dur = 1400;
        const run = function (now) {
            const k = clamp((now - start) / dur);
            const v = to * (1 - Math.pow(1 - k, 3));
            el.textContent = decimals ? v.toFixed(decimals) : Math.round(v).toLocaleString();
            if (k < 1) requestAnimationFrame(run);
        };
        requestAnimationFrame(run);
    }

    const figures = document.querySelector('.figures');
    let figuresData = null;
    let figuresSeen = false;
    function paintFigures() {
        if (!figuresData || !figuresSeen) return;
        const d = figuresData;
        const set = function (key, value, dec) {
            const el = figures.querySelector('[data-k="' + key + '"]');
            if (value === null || value === undefined) { el.textContent = '–'; return; }
            countUp(el, value, dec);
        };
        set('mentors', d.mentors);
        set('students', d.students);
        set('matches', d.matches);
        set('rating', d.rating, 1);
        figuresData = null;
    }
    new IntersectionObserver(function (entries, ob) {
        if (entries[0].isIntersecting) { figuresSeen = true; paintFigures(); ob.disconnect(); }
    }, { threshold: 0.35 }).observe(figures);
    A.api('GET', '/public/summary', null, { auth: false }).then(function (d) {
        figuresData = d.summary;
        paintFigures();
    }).catch(function () {
        figures.querySelectorAll('[data-k]').forEach(function (el) { el.textContent = '–'; });
    });

    const s = A.session.read();
    const navCta = document.getElementById('navCta');
    const authBox = document.getElementById('authBox');

    function signedInCard(user) {
        authBox.innerHTML =
            '<p class="eyebrow">Signed in</p><h3 style="font-size:34px;margin:14px 0 8px">' + A.esc(user.fullName) + '</h3>' +
            '<p class="muted" style="margin-bottom:26px;text-transform:capitalize">' + A.esc(user.role) + ' account</p>' +
            '<div class="row"><a class="btn" href="' + A.HOME[user.role] + '">Open dashboard</a>' +
            '<button class="btn btn--ghost" id="signOut">Sign out</button></div>';
        document.getElementById('signOut').onclick = async function () {
            try { await A.api('POST', '/auth/logout'); } catch (e) {}
            A.session.clear();
            location.reload();
        };
    }

    if (s && s.token) {
        navCta.textContent = 'Open dashboard';
        navCta.href = A.HOME[s.role];
        signedInCard(s);
        return;
    }

    navCta.href = '#join';

    const tabs = authBox.querySelectorAll('[role=tab]');
    const forms = { signin: document.getElementById('formSignin'), signup: document.getElementById('formSignup') };
    tabs.forEach(function (tab) {
        tab.onclick = function () {
            tabs.forEach(function (t) { t.setAttribute('aria-selected', String(t === tab)); });
            forms.signin.hidden = tab.dataset.tab !== 'signin';
            forms.signup.hidden = tab.dataset.tab !== 'signup';
        };
    });

    async function submit(form, fn) {
        const err = form.querySelector('.form-error');
        const btn = form.querySelector('button[type=submit]');
        err.textContent = '';
        btn.disabled = true;
        const label = btn.textContent;
        btn.textContent = 'One moment';
        try {
            await fn(new FormData(form));
        } catch (e) {
            err.textContent = e.message;
            btn.disabled = false;
            btn.textContent = label;
        }
    }

    async function signIn(username, password) {
        const d = await A.api('POST', '/auth/login', { username: username, password: password }, { auth: false });
        A.session.write({ token: d.token, role: d.role, userId: d.userId, fullName: d.fullName });
        return d;
    }

    forms.signin.addEventListener('submit', function (e) {
        e.preventDefault();
        submit(forms.signin, async function (fd) {
            const d = await signIn(String(fd.get('username')).trim(), fd.get('password'));
            location.href = A.HOME[d.role];
        });
    });

    const roleSel = document.getElementById('su-r');
    const alumniFields = document.getElementById('su-alumni');
    const alumniNote = document.getElementById('su-note');
    roleSel.addEventListener('change', function () {
        const isAlumni = roleSel.value === 'alumni';
        alumniFields.hidden = !isAlumni;
        alumniNote.hidden = !isAlumni;
        document.getElementById('su-d').required = isAlumni;
        document.getElementById('su-y').required = isAlumni;
    });

    forms.signup.addEventListener('submit', function (e) {
        e.preventDefault();
        submit(forms.signup, async function (fd) {
            const username = String(fd.get('username')).trim();
            await A.api('POST', '/auth/register', {
                fullName: String(fd.get('fullName')).trim(),
                username: username,
                password: fd.get('password'),
                role: fd.get('role'),
                graduationYear: fd.get('graduationYear'),
                department: String(fd.get('department') || '').trim(),
                inviteCode: String(fd.get('inviteCode') || '').trim()
            }, { auth: false });
            await signIn(username, fd.get('password'));
            location.href = 'profile.html?welcome=1';
        });
    });
})();
