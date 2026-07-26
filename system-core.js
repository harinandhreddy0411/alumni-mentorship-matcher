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
                creationTimestamp: new Date().toISOString()
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
            creationTimestamp: new Date().toISOString()
        };
        users.push(newEntity);
        localStorage.setItem('alumni_users_table', JSON.stringify(users));
        return { success: true };
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
    }
};

// Initialize the mock database on load
systemDatabase.initializeSchema();

document.addEventListener('DOMContentLoaded', () => {
    
    // --- 1. GLOBAL NAVIGATION CONTROLS ---
    const logoutControls = document.querySelectorAll('.alumni-btn-logout');
    logoutControls.forEach(btn => {
        btn.addEventListener('click', () => {
            systemDatabase.terminateSession();
            window.location.href = 'index.html';
        });
    });

    const signinControls = document.querySelectorAll('.alumni-btn-signin');
    signinControls.forEach(btn => {
        btn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    });

    // --- 2. INDEX.HTML (Login & Registration) ---
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

    // --- 3. STUDENT DASHBOARD ACTIONS ---
    const requestMatchBtns = document.querySelectorAll('.alumni-btn-action');
    requestMatchBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            window.location.href = 'request-mentor.html';
        });
    });

    // --- 4. REQUEST MENTOR FORM ---
    const reqMentorInput = document.getElementById('req-mentor');
    if (reqMentorInput) {
        const reqForm = reqMentorInput.closest('form');
        reqForm.addEventListener('submit', (event) => {
            event.preventDefault();
            alert('Mentorship Request Successfully Submitted to Queue.');
            window.location.href = 'student-dashboard.html';
        });
    }

    // --- 5. ALUMNI DASHBOARD ACTIONS ---
    const acceptBtns = document.querySelectorAll('.alumni-btn-accept');
    acceptBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.alumni-request-card');
            card.style.display = 'none'; // Visually removes the request from the feed
            alert('Match Accepted. Connection Established.');
        });
    });

    const declineBtns = document.querySelectorAll('.alumni-btn-decline');
    declineBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const card = e.target.closest('.alumni-request-card');
            card.style.display = 'none'; // Visually removes the request from the feed
            alert('Match Declined and removed from queue.');
        });
    });

    // --- 6. MANAGE SCHEDULE FORM ---
    const schedStatusInput = document.getElementById('sched-status');
    if (schedStatusInput) {
        const schedForm = schedStatusInput.closest('form');
        schedForm.addEventListener('submit', (event) => {
            event.preventDefault();
            alert('Capacity Constraints and Schedule Updated.');
            window.location.href = 'alumni-dashboard.html';
        });
    }

    // --- 7. PROFILE SETTINGS FORM ---
    const profileNameInput = document.getElementById('profile-name');
    if (profileNameInput) {
        const profileForm = profileNameInput.closest('form');
        profileForm.addEventListener('submit', (event) => {
            event.preventDefault();
            alert('User Profile Details Successfully Updated.');
        });
    }

    // --- 8. ADMIN USER CREATION FORM ---
    const adminAddRoleInput = document.getElementById('admin-add-role');
    if (adminAddRoleInput) {
        const adminAddForm = adminAddRoleInput.closest('form');
        adminAddForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const newUsername = document.getElementById('admin-add-username').value;
            alert(`New User [${newUsername}] Successfully Provisioned.`);
            adminAddForm.reset();
        });
    }

    // --- 9. ADMIN TABLE ACTIONS (Terminate/Cancel) ---
    const terminateBtns = document.querySelectorAll('.alumni-btn-terminate');
    terminateBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.closest('tr');
            if (row) {
                row.style.display = 'none'; // Visually removes the record from the table
                alert('System Record Terminated.');
            }
        });
    });
});