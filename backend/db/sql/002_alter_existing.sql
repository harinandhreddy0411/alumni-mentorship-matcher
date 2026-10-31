ALTER TABLE users MODIFY creation_ts DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE mentorship_requests MODIFY creation_ts DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE sessions MODIFY login_ts DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE sessions ADD COLUMN expires_at DATETIME NULL;
ALTER TABLE alumni_details ADD CONSTRAINT chk_max_mentees CHECK (max_mentees BETWEEN 1 AND 20);
ALTER TABLE users ADD INDEX idx_users_role (role);
ALTER TABLE mentorship_requests ADD INDEX idx_req_alumni_status (alumni_id, status);
ALTER TABLE mentorship_requests ADD INDEX idx_req_student_status (student_id, status);
