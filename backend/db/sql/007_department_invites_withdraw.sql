ALTER TABLE users ADD COLUMN department VARCHAR(60) NULL;

UPDATE users u JOIN alumni_details ad ON ad.alumni_id = u.user_id SET u.department = ad.department;

ALTER TABLE alumni_details DROP COLUMN department;

ALTER TABLE mentorship_requests
    MODIFY status ENUM('pending', 'accepted', 'declined', 'withdrawn') NOT NULL DEFAULT 'pending';

CREATE TABLE alumni_invites (
    invite_id   INT AUTO_INCREMENT PRIMARY KEY,
    code        VARCHAR(20) NOT NULL UNIQUE,
    created_by  INT NOT NULL,
    created_ts  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at  DATETIME NOT NULL,
    used_by     INT NULL,
    used_at     DATETIME NULL,
    FOREIGN KEY (created_by) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (used_by) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_invites_creator (created_by, used_at)
) ENGINE=InnoDB;
