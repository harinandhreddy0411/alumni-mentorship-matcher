const systemDatabase = {
    initializeSchema: function() {
        if (!localStorage.getItem('alumni_users_table')) {
            localStorage.setItem('alumni_users_table', JSON.stringify([]));
        }
        if (!localStorage.getItem('alumni_sessions_table')) {
            localStorage.setItem('alumni_sessions_table', JSON.stringify(null));
        }
        this.enforceSystemAdmin();
    },
    enforceSystemAdmin: function() {
        let users = JSON.parse(localStorage.getItem('alumni_users_table'));
        const adminExists = users.some(user => user.role === 'admin');
        if (!adminExists) {
            users.push({
                userId: crypto.randomUUID(),
                username: 'admin',
                password: 'adminpassword',
                role: 'admin',
                creationTimestamp: new Date().toISOString(),
                track: '', bio: '', email: '',
                capacityStatus: 'active', capacityLimit: 3, capacityHours: ''
            });
            localStorage.setItem('alumni_users_table', JSON.stringify(users));
        }
    },
    registerEntity: function(username, password, role) {
        let users = JSON.parse(localStorage.getItem('alumni_users_table'));
        const userExists = users.some(user => user.username === username);
        if (userExists) {
            return { success: false, error: 'Username unavailable' };
        }
        const newEntity = {
            userId: crypto.randomUUID(),
            username: username,
            password: password,
            role: role,
            creationTimestamp: new Date().toISOString(),
            // extended fields so profile/capacity updates have somewhere to persist to
            track: '', bio: '', email: '',
            capacityStatus: 'active', capacityLimit: 3, capacityHours: ''
        };
        users.push(newEntity);
        localStorage.setItem('alumni_users_table', JSON.stringify(users));
        return { success: true, userId: newEntity.userId };
    },
    authenticateEntity: function(username, password) {
        const users = JSON.parse(localStorage.getItem('alumni_users_table'));
        const validUser = users.find(u => u.username === username && u.password === password);
        if (validUser) {
            localStorage.setItem('alumni_sessions_table', JSON.stringify({
                userId: validUser.userId,
                username: validUser.username,
                role: validUser.role,
                loginTimestamp: new Date().toISOString()
            }));
            return { success: true, role: validUser.role };
        }
        return { success: false, error: 'Authentication failed' };
    },
    terminateSession: function() {
        localStorage.setItem('alumni_sessions_table', JSON.stringify(null));
    },
    validateActiveSession: function() {
        return JSON.parse(localStorage.getItem('alumni_sessions_table'));
    },
    // ---- NEW: real persistence, replacing the alert-only stubs ----
    getUserById: function(userId) {
        const users = JSON.parse(localStorage.getItem('alumni_users_table'));
        return users.find(u => u.userId === userId) || null;
    },
    updateProfile: function(userId, { name, email, track, bio }) {
        let users = JSON.parse(localStorage.getItem('alumni_users_table'));
        const idx = users.findIndex(u => u.userId === userId);
        if (idx === -1) return { success: false };
        users[idx] = { ...users[idx], displayName: name, email, track, bio };
        localStorage.setItem('alumni_users_table', JSON.stringify(users));
        return { success: true };
    },
    updateCapacity: function(userId, { status, limit, hours }) {
        let users = JSON.parse(localStorage.getItem('alumni_users_table'));
        const idx = users.findIndex(u => u.userId === userId);
        if (idx === -1) return { success: false };
        users[idx] = { ...users[idx], capacityStatus: status, capacityLimit: limit, capacityHours: hours };
        localStorage.setItem('alumni_users_table', JSON.stringify(users));
        return { success: true };
    },
    terminateUser: function(userId) {
        let users = JSON.parse(localStorage.getItem('alumni_users_table'));
        const target = users.find(u => u.userId === userId);
        if (target && target.role === 'admin') {
            return { success: false, error: 'Cannot terminate an admin record' };
        }
        users = users.filter(u => u.userId !== userId);
        localStorage.setItem('alumni_users_table', JSON.stringify(users));
        return { success: true };
    }
};

systemDatabase.initializeSchema();

document.addEventListener('DOMContentLoaded', () => {

    const activeSession = systemDatabase.validateActiveSession();
    const signinBtns = document.querySelectorAll('.alumni-btn-signin');
    const navControls = document.querySelector('.alumni-ultra-controls');

    const isIndexPage = document.getElementById('auth-username') !== null;

    if (activeSession) {
        signinBtns.forEach(btn => {
            btn.style.setProperty('display', 'none', 'important');
        });
    }

    if (!isIndexPage && navControls) {
        const backBtn = document.createElement('button');
        backBtn.className = 'alumni-btn-back';
        backBtn.textContent = 'Back';
        backBtn.addEventListener('click', () => {
            window.history.back();
        });
        navControls.insertBefore(backBtn, navControls.firstChild);
    }

    const logoutControls = document.querySelectorAll('.alumni-btn-logout');
    logoutControls.forEach(btn => {
        btn.addEventListener('click', () => {
            systemDatabase.terminateSession();
            window.location.href = 'index.html';
        });
    });

    signinBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    });

    // --- Login ---
    const authUsernameInput = document.getElementById('auth-username');
    if (authUsernameInput) {
        const authForm = authUsernameInput.closest('form');
        authForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const passwordInput = document.getElementById('auth-password').value;
            const authResult = systemDatabase.authenticateEntity(authUsernameInput.value, passwordInput);
            if (authResult.success) {
                if (authResult.role === 'student') window.location.href = 'student-dashboard.html';
                else if (authResult.role === 'alumni') window.location.href = 'alumni-dashboard.html';
                else if (authResult.role === 'admin') window.location.href = 'admin-dashboard.html';
            } else {
                alert('Invalid System Credentials');
            }
        });
    }

    // --- Registration ---
    const regRoleInput = document.getElementById('reg-role');
    if (regRoleInput) {
        const regForm = regRoleInput.closest('form');
        regForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const usernameInput = document.getElementById('reg-username').value;
            const passwordInput = document.getElementById('reg-password').value;
            const regResult = systemDatabase.registerEntity(usernameInput, passwordInput, regRoleInput.value);
            if (regResult.success) {
                alert('Registration Successful. Proceed to System Login.');
                regForm.reset();
            } else {
                alert('Registration Error: Username already exists in system.');
            }
        });
    }

    // --- Request Match: capture WHICH mentor was clicked, before navigating ---
    const requestMatchBtns = document.querySelectorAll('.alumni-btn-action');
    requestMatchBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.alumni-mentor-card');
            if (card) {
                const mentorId = card.dataset.mentorId || '';
                const mentorName = card.dataset.mentorName || card.querySelector('.alumni-card-name')?.textContent || '';
                sessionStorage.setItem('pending_mentor_target', JSON.stringify({ mentorId, mentorName }));
            }
            window.location.href = 'request-mentor.html';
        });
    });

    // --- request-mentor.html: fill the target field from what was actually clicked ---
    const reqMentorInput = document.getElementById('req-mentor');
    if (reqMentorInput) {
        const stored = sessionStorage.getItem('pending_mentor_target');
        if (stored) {
            const { mentorId, mentorName } = JSON.parse(stored);
            reqMentorInput.value = mentorId ? `${mentorId}-${mentorName}` : mentorName;
        }
        const reqForm = reqMentorInput.closest('form');
        reqForm.addEventListener('submit', (event) => {
            event.preventDefault();
            sessionStorage.removeItem('pending_mentor_target');
            alert('Mentorship Request Successfully Submitted to Queue.');
            window.location.href = 'student-dashboard.html';
        });
    }

    // --- Alumni accept/decline (still DOM-only by design — no separate "matches" table exists yet;
    //     wire this to a real alumni_matches_table if/when admin-matches.html needs live data) ---
    const acceptBtns = document.querySelectorAll('.alumni-btn-accept');
    acceptBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.alumni-request-card');
            card.style.display = 'none';
            alert('Match Accepted. Connection Established.');
        });
    });

    const declineBtns = document.querySelectorAll('.alumni-btn-decline');
    declineBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.alumni-request-card');
            card.style.display = 'none';
            alert('Match Declined and removed from queue.');
        });
    });

    // --- Capacity Control (manage-schedule.html) — now actually persists ---
    const schedStatusInput = document.getElementById('sched-status');
    if (schedStatusInput) {
        if (activeSession) {
            const user = systemDatabase.getUserById(activeSession.userId);
            if (user) {
                schedStatusInput.value = user.capacityStatus || 'active';
                document.getElementById('sched-limit').value = user.capacityLimit || 3;
                document.getElementById('sched-hours').value = user.capacityHours || '';
            }
        }
        const schedForm = schedStatusInput.closest('form');
        schedForm.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!activeSession) { alert('No active session.'); return; }
            systemDatabase.updateCapacity(activeSession.userId, {
                status: schedStatusInput.value,
                limit: document.getElementById('sched-limit').value,
                hours: document.getElementById('sched-hours').value
            });
            alert('Capacity Constraints and Schedule Updated.');
            window.location.href = 'alumni-dashboard.html';
        });
    }

    // --- Profile (profile.html) — now actually persists, and prefills from session ---
    const profileNameInput = document.getElementById('profile-name');
    if (profileNameInput) {
        if (activeSession) {
            const user = systemDatabase.getUserById(activeSession.userId);
            if (user) {
                profileNameInput.value = user.displayName || user.username || '';
                document.getElementById('profile-email').value = user.email || '';
                document.getElementById('profile-track').value = user.track || document.getElementById('profile-track').value;
                document.getElementById('profile-bio').value = user.bio || '';
            }
        }
        const profileForm = profileNameInput.closest('form');
        profileForm.addEventListener('submit', (event) => {
            event.preventDefault();
            if (!activeSession) { alert('No active session.'); return; }
            systemDatabase.updateProfile(activeSession.userId, {
                name: profileNameInput.value,
                email: document.getElementById('profile-email').value,
                track: document.getElementById('profile-track').value,
                bio: document.getElementById('profile-bio').value
            });
            alert('User Profile Details Successfully Updated.');
        });
    }

    // --- Admin: provision new user — now actually calls registerEntity ---
    const adminAddRoleInput = document.getElementById('admin-add-role');
    if (adminAddRoleInput) {
        const adminAddForm = adminAddRoleInput.closest('form');
        adminAddForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const newUsername = document.getElementById('admin-add-username').value;
            const newPassword = document.getElementById('admin-add-password')?.value || 'changeme';
            const result = systemDatabase.registerEntity(newUsername, newPassword, adminAddRoleInput.value);
            if (result.success) {
                alert(`New User [${newUsername}] Successfully Provisioned.`);
                adminAddForm.reset();
                window.location.reload(); // reflect the new row in the registry table
            } else {
                alert(`Provisioning Error: ${result.error}`);
            }
        });
    }

    // --- Admin: terminate user — now actually removes the record ---
    // Requires each <tr> in admin-users.html to carry data-user-id="<that user's userId>".
    const terminateBtns = document.querySelectorAll('.alumni-btn-terminate');
    terminateBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            const userId = row?.dataset.userId;
            if (!userId) {
                console.warn('Terminate clicked but row has no data-user-id — add it to admin-users.html rows.');
                row.style.display = 'none'; // fallback: at least hides it, matches old behavior
                return;
            }
            const result = systemDatabase.terminateUser(userId);
            if (result.success) {
                row.style.display = 'none';
                alert('System Record Terminated.');
            } else {
                alert(result.error);
            }
        });
    });
});
