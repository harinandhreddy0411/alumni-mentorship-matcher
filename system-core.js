const API_BASE = 'https://alumni-mentorship-matcher-backend.onrender.com/api';

const sessionStore = {
    get token() { return localStorage.getItem('amm_token'); },
    get role() { return localStorage.getItem('amm_role'); },
    get userId() { return localStorage.getItem('amm_user_id'); },
    get fullName() { return localStorage.getItem('amm_full_name'); },
    set(token, role, userId, fullName) {
        localStorage.setItem('amm_token', token);
        localStorage.setItem('amm_role', role);
        localStorage.setItem('amm_user_id', userId);
        localStorage.setItem('amm_full_name', fullName);
    },
    clear() {
        localStorage.removeItem('amm_token');
        localStorage.removeItem('amm_role');
        localStorage.removeItem('amm_user_id');
        localStorage.removeItem('amm_full_name');
    }
};

async function apiFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (sessionStore.token) headers['x-session-token'] = sessionStore.token;

    let res;
    try {
        res = await fetch(API_BASE + path, { ...options, headers });
    } catch (networkError) {
        alert('Cannot reach the server at ' + API_BASE + '. It may be waking up from sleep (free tier) — wait 30-60s and try again.');
        console.error('apiFetch network error:', networkError);
        return { success: false, error: 'Network error — server unreachable' };
    }

    let data;
    try { data = await res.json(); } catch { data = { success: false, error: 'Bad response from server' }; }
    if (!res.ok && res.status !== 400 && res.status !== 409) {
        data.success = false;
    }
    return data;
}

function setStatValue(labelText, value) {
    document.querySelectorAll('.alumni-stat-block').forEach(block => {
        const label = block.querySelector('.alumni-stat-label');
        if (label && label.textContent.trim() === labelText) {
            const valueEl = block.querySelector('.alumni-stat-value');
            if (valueEl) valueEl.textContent = value;
        }
    });
}

document.addEventListener('DOMContentLoaded', async () => {

    const signinBtns = document.querySelectorAll('.alumni-btn-signin');
    const navControls = document.querySelector('.alumni-ultra-controls');
    const isIndexPage = document.getElementById('auth-username') !== null;

    let activeUser = null;
    if (sessionStore.token) {
        const meResult = await apiFetch('/auth/me');
        if (meResult.success) {
            activeUser = meResult.user;
        } else {
            sessionStore.clear();
        }
    }

    if (activeUser) {
        signinBtns.forEach(btn => btn.style.setProperty('display', 'none', 'important'));
    }

    if (!isIndexPage && navControls) {
        const backBtn = document.createElement('button');
        backBtn.className = 'alumni-btn-back';
        backBtn.textContent = 'Back';
        backBtn.addEventListener('click', () => window.history.back());
        navControls.insertBefore(backBtn, navControls.firstChild);
    }

    document.querySelectorAll('.alumni-btn-logout').forEach(btn => {
        btn.addEventListener('click', async () => {
            await apiFetch('/auth/logout', { method: 'POST' });
            sessionStore.clear();
            window.location.href = 'index.html';
        });
    });

    signinBtns.forEach(btn => {
        btn.addEventListener('click', () => window.location.href = 'index.html');
    });

    const authUsernameInput = document.getElementById('auth-username');
    if (authUsernameInput) {
        const authForm = authUsernameInput.closest('form');
        authForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const password = document.getElementById('auth-password').value;
            const result = await apiFetch('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ username: authUsernameInput.value, password })
            });
            if (result.success) {
                sessionStore.set(result.token, result.role, result.userId, result.fullName);
                if (result.role === 'student') window.location.href = 'student-dashboard.html';
                else if (result.role === 'alumni') window.location.href = 'alumni-dashboard.html';
                else if (result.role === 'admin') window.location.href = 'admin-dashboard.html';
            } else {
                alert('Invalid System Credentials');
            }
        });
    }

    const regRoleInput = document.getElementById('reg-role');
    if (regRoleInput) {
        const regForm = regRoleInput.closest('form');
        regForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const username = document.getElementById('reg-username').value;
            const password = document.getElementById('reg-password').value;
            const result = await apiFetch('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ username, password, role: regRoleInput.value })
            });
            if (result.success) {
                alert('Registration Successful. Proceed to System Login.');
                regForm.reset();
            } else {
                alert('Registration Error: ' + (result.error || 'Username already exists in system.'));
            }
        });
    }

    const mentorGrid = document.querySelector('.alumni-directory-section .alumni-grid-layout');
    const isStudentDashboard = activeUser && activeUser.role === 'student' && mentorGrid && document.getElementById('my-mentor');
    if (isStudentDashboard) {
        const mineResult = await apiFetch('/requests/mine');
        const myRequests = mineResult.success ? mineResult.requests : [];
        const excludedIds = new Set(myRequests
            .filter(r => r.status === 'pending' || r.status === 'accepted')
            .map(r => String(r.mentor_id)));

        const result = await apiFetch('/mentors');
        if (result.success) {
            mentorGrid.innerHTML = '';
            const available = result.mentors.filter(m => !excludedIds.has(String(m.user_id)));
            const colors = ['navy', 'crimson', 'gold', 'royalblue'];
            available.forEach((m, i) => {
                const initials = m.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
                const card = document.createElement('div');
                card.className = 'alumni-mentor-card';
                card.dataset.mentorId = m.user_id;
                card.dataset.mentorName = m.full_name;
                card.innerHTML = `
                    <div class="alumni-card-banner" style="background-color: ${colors[i % colors.length]};"></div>
                    <div class="alumni-card-avatar">${initials}</div>
                    <h3 class="alumni-card-name">${m.full_name}</h3>
                    <p class="alumni-card-track" style="color: navy;">${m.focus_track || 'General Mentorship'}</p>
                    <p class="alumni-card-year">&nbsp;</p>
                    <button class="alumni-btn-action">Request Match</button>
                `;
                mentorGrid.appendChild(card);
            });
            if (available.length === 0) {
                mentorGrid.innerHTML = '<p>No mentors currently accepting requests.</p>';
            }
        }

        const myMentorSection = document.getElementById('my-mentor');
        const accepted = myRequests.find(r => r.status === 'accepted');
        const grid = myMentorSection.querySelector('.alumni-grid-layout');
        if (accepted) {
            grid.innerHTML = `
                <div class="alumni-mentor-card">
                    <div class="alumni-card-banner" style="background-color: limegreen;"></div>
                    <div class="alumni-card-avatar">${accepted.mentor_name.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}</div>
                    <h3 class="alumni-card-name">${accepted.mentor_name}</h3>
                    <p class="alumni-card-track" style="color: navy;">${accepted.mentor_track || ''}</p>
                    <p class="alumni-card-year">&nbsp;</p>
                    <button class="alumni-btn-action" disabled style="opacity:0.5;">Connected</button>
                </div>`;
        }

        setStatValue('Active Requests', myRequests.filter(r => r.status === 'pending').length);
        setStatValue('Connected Mentors', myRequests.filter(r => r.status === 'accepted').length);
    }


    document.addEventListener('click', (e) => {
        if (!e.target.classList.contains('alumni-btn-action')) return;
        const card = e.target.closest('.alumni-mentor-card');
        if (card && card.dataset.mentorId) {
            sessionStorage.setItem('pending_mentor_target', JSON.stringify({
                mentorId: card.dataset.mentorId,
                mentorName: card.dataset.mentorName
            }));
            window.location.href = 'request-mentor.html';
        }
    });

    const reqMentorInput = document.getElementById('req-mentor');
    if (reqMentorInput) {
        const stored = sessionStorage.getItem('pending_mentor_target');
        let mentorId = null;
        if (stored) {
            const { mentorId: id, mentorName } = JSON.parse(stored);
            mentorId = id;
            reqMentorInput.value = mentorName;
        }
        const reqForm = reqMentorInput.closest('form');
        reqForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            if (!mentorId) { alert('No mentor selected — go back and click Request Match on a mentor card.'); return; }
            const focusArea = document.getElementById('req-focus').value;
            const pitchMessage = document.getElementById('req-pitch').value;
            const result = await apiFetch('/requests', {
                method: 'POST',
                body: JSON.stringify({ alumniId: mentorId, focusArea, pitchMessage })
            });
            if (result.success) {
                sessionStorage.removeItem('pending_mentor_target');
                alert('Mentorship Request Successfully Submitted to Queue.');
                window.location.href = 'student-dashboard.html';
            } else {
                alert('Submission failed: ' + (result.error || 'unknown error'));
            }
        });
    }

    const incomingSection = document.querySelector('.alumni-directory-section .alumni-feed-layout');
    const isAlumniDashboard = activeUser && activeUser.role === 'alumni' && document.getElementById('my-mentees');
    if (isAlumniDashboard) {
        const incomingResult = await apiFetch('/requests/incoming');
        if (incomingResult.success && incomingSection) {
            incomingSection.innerHTML = '';
            if (incomingResult.requests.length === 0) {
                incomingSection.innerHTML = '<p>No pending requests right now.</p>';
            }
            incomingResult.requests.forEach(r => {
                const card = document.createElement('div');
                card.className = 'alumni-request-card';
                card.dataset.requestId = r.request_id;
                card.innerHTML = `
                    <div class="alumni-request-info">
                        <h3 class="alumni-card-name">${r.student_name}</h3>
                        <p class="alumni-card-track" style="color: navy; font-weight: 800;">${r.student_track || ''}</p>
                        <blockquote class="alumni-request-pitch">"${r.pitch_message}"</blockquote>
                    </div>
                    <div class="alumni-request-actions">
                        <button class="alumni-btn-accept">Accept Match</button>
                        <button class="alumni-btn-decline">Decline</button>
                    </div>`;
                incomingSection.appendChild(card);
            });
        }

        const menteesResult = await apiFetch('/requests/mentees');
        const menteesFeed = document.getElementById('my-mentees')?.querySelector('.alumni-feed-layout');
        if (menteesResult.success && menteesFeed) {
            menteesFeed.innerHTML = '';
            if (menteesResult.mentees.length === 0) {
                menteesFeed.innerHTML = '<p>No active mentees yet.</p>';
            }
            menteesResult.mentees.forEach(m => {
                const card = document.createElement('div');
                card.className = 'alumni-request-card';
                card.innerHTML = `
                    <div class="alumni-request-info">
                        <h3 class="alumni-card-name">${m.student_name}</h3>
                        <p class="alumni-card-track" style="color: navy; font-weight: 800;">${m.student_track || ''}</p>
                        <p class="alumni-request-pitch"><span class="alumni-status-indicator status-active">Active</span></p>
                    </div>`;
                menteesFeed.appendChild(card);
            });
        }

        if (incomingResult.success) setStatValue('Pending Requests', incomingResult.requests.length);
        if (menteesResult.success) setStatValue('Active Mentees', menteesResult.mentees.length);
    }

    document.addEventListener('click', async (e) => {
        if (e.target.classList.contains('alumni-btn-accept') || e.target.classList.contains('alumni-btn-decline')) {
            const card = e.target.closest('.alumni-request-card');
            const requestId = card?.dataset.requestId;
            const status = e.target.classList.contains('alumni-btn-accept') ? 'accepted' : 'declined';
            if (!requestId) { card.style.display = 'none'; return; }
            const result = await apiFetch(`/requests/${requestId}`, {
                method: 'PATCH',
                body: JSON.stringify({ status })
            });
            if (result.success) {
                card.style.display = 'none';
                alert(status === 'accepted' ? 'Match Accepted. Connection Established.' : 'Match Declined and removed from queue.');
            } else {
                alert('Action failed: ' + (result.error || 'unknown error'));
            }
        }
    });

    const schedStatusInput = document.getElementById('sched-status');
    if (schedStatusInput) {
        const capResult = await apiFetch('/capacity');
        if (capResult.success && capResult.capacity) {
            schedStatusInput.value = capResult.capacity.capacity_status || 'active';
            document.getElementById('sched-limit').value = capResult.capacity.max_mentees || 3;
            document.getElementById('sched-hours').value = capResult.capacity.preferred_hours || '';
        }
        const schedForm = schedStatusInput.closest('form');
        schedForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const result = await apiFetch('/capacity', {
                method: 'PUT',
                body: JSON.stringify({
                    status: schedStatusInput.value,
                    maxMentees: document.getElementById('sched-limit').value,
                    preferredHours: document.getElementById('sched-hours').value
                })
            });
            if (result.success) {
                alert('Capacity Constraints and Schedule Updated.');
                window.location.href = 'alumni-dashboard.html';
            } else {
                alert('Update failed: ' + (result.error || 'unknown error'));
            }
        });
    }

    const profileNameInput = document.getElementById('profile-name');
    if (profileNameInput) {
        const profResult = await apiFetch('/profile');
        if (profResult.success && profResult.profile) {
            profileNameInput.value = profResult.profile.full_name || '';
            document.getElementById('profile-email').value = profResult.profile.email || '';
            if (profResult.profile.focus_track) document.getElementById('profile-track').value = profResult.profile.focus_track;
            document.getElementById('profile-bio').value = profResult.profile.professional_bio || '';
        }
        const profileForm = profileNameInput.closest('form');
        profileForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const result = await apiFetch('/profile', {
                method: 'PUT',
                body: JSON.stringify({
                    fullName: profileNameInput.value,
                    email: document.getElementById('profile-email').value,
                    focusTrack: document.getElementById('profile-track').value,
                    bio: document.getElementById('profile-bio').value
                })
            });
            if (result.success) {
                sessionStore.set(sessionStore.token, sessionStore.role, sessionStore.userId, profileNameInput.value);
                alert('User Profile Details Successfully Updated.');
            } else {
                alert('Update failed: ' + (result.error || 'unknown error'));
            }
        });
    }

    if (activeUser && activeUser.role === 'admin') {

        function renderUserRow(u, includeStatusCol) {
            const roleBadgeClass = { student: 'alumni-badge-student', alumni: 'alumni-badge-alumni', admin: 'alumni-badge-admin' }[u.role];
            const roleLabel = u.role.charAt(0).toUpperCase() + u.role.slice(1);
            const idCell = `USR-${u.user_id}`;
            const actionsCell = u.role === 'admin'
                ? `<button class="alumni-btn-edit" disabled>Locked</button>`
                : `<button class="alumni-btn-edit" data-edit-user-id="${u.user_id}" data-username="${u.username}" data-full-name="${u.full_name || ''}" data-role="${u.role}">Edit</button>
                   <button class="alumni-btn-terminate" data-user-id="${u.user_id}">Terminate</button>`;
            const statusCell = includeStatusCol
                ? `<td><span class="alumni-status-indicator ${u.role === 'admin' ? 'status-secure' : 'status-active'}">${u.role === 'admin' ? 'Secure' : 'Active'}</span></td>`
                : '';
            return `<tr data-user-id="${u.user_id}">
                <td class="alumni-cell-id">${idCell}</td>
                <td>${u.full_name || u.username}</td>
                <td><span class="alumni-badge ${roleBadgeClass}">${roleLabel}</span></td>
                ${statusCell}
                <td><div class="alumni-table-actions">${actionsCell}</div></td>
            </tr>`;
        }

        const adminStatsPanel = document.querySelector('.alumni-dashboard-header-panel .alumni-dashboard-stats');
        const isAdminDashboard = adminStatsPanel && document.querySelector('.alumni-admin-table thead th')?.textContent === 'User ID'
            && document.querySelectorAll('.alumni-admin-table thead th').length === 5;
        if (isAdminDashboard) {
            const statsResult = await apiFetch('/admin/stats');
            if (statsResult.success) {
                setStatValue('Total Users', statsResult.stats.totalUsers);
                setStatValue('Active Matches', statsResult.stats.activeMatches);
                setStatValue('Pending', statsResult.stats.pending);
            }
            const usersResult = await apiFetch('/admin/users');
            const tbody = document.querySelector('.alumni-admin-table tbody');
            if (usersResult.success && tbody) {
                tbody.innerHTML = usersResult.users.map(u => renderUserRow(u, true)).join('');
            }
        }

        const provisionForm = document.getElementById('admin-add-role');
        if (provisionForm) {
            const usersResult = await apiFetch('/admin/users');
            const tbody = document.querySelector('.alumni-admin-table tbody');
            if (usersResult.success && tbody) {
                tbody.innerHTML = usersResult.users.map(u => renderUserRow(u, false)).join('');
            }
            const addForm = provisionForm.closest('form');
            addForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                const username = document.getElementById('admin-add-username').value;
                const password = document.getElementById('admin-add-password').value;
                const role = provisionForm.value;
                const result = await apiFetch('/admin/users', {
                    method: 'POST',
                    body: JSON.stringify({ username, password, role })
                });
                if (result.success) {
                    alert(`New User [${username}] Successfully Provisioned.`);
                    addForm.reset();
                    window.location.reload();
                } else {
                    alert('Provisioning Error: ' + (result.error || 'unknown error'));
                }
            });
        }

        const matchesTable = document.querySelector('.alumni-admin-table thead th')?.textContent === 'Match ID';
        if (matchesTable) {
            const matchesResult = await apiFetch('/admin/matches');
            const tbody = document.querySelector('.alumni-admin-table tbody');
            if (matchesResult.success && tbody) {
                tbody.innerHTML = matchesResult.matches.map(m => {
                    const statusClass = m.status === 'accepted' ? 'status-active' : 'status-secure';
                    const statusLabel = m.status === 'accepted' ? 'Active' : 'Pending';
                    const actionLabel = m.status === 'accepted' ? 'Revoke Match' : 'Force Cancel';
                    return `<tr data-request-id="${m.request_id}">
                        <td class="alumni-cell-id">REQ-${m.request_id}</td>
                        <td>${m.student_name}</td>
                        <td>${m.alumni_name}</td>
                        <td><span class="alumni-status-indicator ${statusClass}">${statusLabel}</span></td>
                        <td><div class="alumni-table-actions">
                            <button class="alumni-btn-terminate" data-request-id="${m.request_id}">${actionLabel}</button>
                        </div></td>
                    </tr>`;
                }).join('');
                if (matchesResult.matches.length === 0) {
                    tbody.innerHTML = '<tr><td colspan="5">No active or pending matches.</td></tr>';
                }
            }
        }

        document.addEventListener('click', async (e) => {
            if (!e.target.classList.contains('alumni-btn-edit') || e.target.disabled) return;
            const userId = e.target.dataset.editUserId;
            if (!userId) return;

            const currentUsername = e.target.dataset.username;
            const currentFullName = e.target.dataset.fullName;
            const currentRole = e.target.dataset.role;

            const newUsername = prompt('Username:', currentUsername);
            if (newUsername === null) return;
            const newFullName = prompt('Full name:', currentFullName);
            if (newFullName === null) return;
            const newRole = prompt('Role (student / alumni / admin):', currentRole);
            if (newRole === null) return;
            if (!['student', 'alumni', 'admin'].includes(newRole.trim().toLowerCase())) {
                alert('Role must be exactly one of: student, alumni, admin');
                return;
            }

            const result = await apiFetch(`/admin/users/${userId}`, {
                method: 'PUT',
                body: JSON.stringify({
                    username: newUsername.trim(),
                    fullName: newFullName.trim(),
                    role: newRole.trim().toLowerCase()
                })
            });
            if (result.success) {
                alert('User record updated.');
                window.location.reload();
            } else {
                alert('Update failed: ' + (result.error || 'unknown error'));
            }
        });

        document.addEventListener('click', async (e) => {
            if (!e.target.classList.contains('alumni-btn-terminate')) return;
            if (e.target.dataset.userId) {
                if (!confirm('Terminate this user account? This cannot be undone.')) return;
                const result = await apiFetch(`/admin/users/${e.target.dataset.userId}`, { method: 'DELETE' });
                if (result.success) {
                    e.target.closest('tr').style.display = 'none';
                } else {
                    alert('Termination failed: ' + (result.error || 'unknown error'));
                }
            } else if (e.target.dataset.requestId) {
                if (!confirm('Override this match? This cannot be undone.')) return;
                const result = await apiFetch(`/admin/matches/${e.target.dataset.requestId}`, { method: 'PATCH' });
                if (result.success) {
                    e.target.closest('tr').style.display = 'none';
                } else {
                    alert('Action failed: ' + (result.error || 'unknown error'));
                }
            }
        });
    }
});