CREATE TABLE skills (
    skill_id   INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(40) NOT NULL UNIQUE,
    category   VARCHAR(30) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE user_skills (
    user_id   INT NOT NULL,
    skill_id  INT NOT NULL,
    level     ENUM('beginner','intermediate','expert') NOT NULL DEFAULT 'intermediate',
    PRIMARY KEY (user_id, skill_id),
    FOREIGN KEY (user_id)  REFERENCES users(user_id)   ON DELETE CASCADE,
    FOREIGN KEY (skill_id) REFERENCES skills(skill_id) ON DELETE CASCADE,
    INDEX idx_user_skills_skill (skill_id)
) ENGINE=InnoDB;

CREATE TABLE availability_slots (
    slot_id     INT AUTO_INCREMENT PRIMARY KEY,
    alumni_id   INT NOT NULL,
    weekday     TINYINT NOT NULL,
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL,
    CONSTRAINT chk_slot_weekday CHECK (weekday BETWEEN 0 AND 6),
    CONSTRAINT chk_slot_range CHECK (end_time > start_time),
    UNIQUE KEY uq_slot (alumni_id, weekday, start_time),
    FOREIGN KEY (alumni_id) REFERENCES alumni_details(alumni_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE messages (
    message_id  INT AUTO_INCREMENT PRIMARY KEY,
    request_id  INT NOT NULL,
    sender_id   INT NOT NULL,
    body        TEXT NOT NULL,
    is_read     TINYINT(1) NOT NULL DEFAULT 0,
    sent_ts     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_message_body CHECK (CHAR_LENGTH(TRIM(body)) > 0),
    FOREIGN KEY (request_id) REFERENCES mentorship_requests(request_id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id)  REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_messages_thread (request_id, sent_ts)
) ENGINE=InnoDB;

CREATE TABLE meetings (
    meeting_id    INT AUTO_INCREMENT PRIMARY KEY,
    request_id    INT NOT NULL,
    scheduled_at  DATETIME NOT NULL,
    duration_min  INT NOT NULL DEFAULT 30,
    status        ENUM('scheduled','completed','cancelled') NOT NULL DEFAULT 'scheduled',
    meeting_link  VARCHAR(255),
    created_ts    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_meeting_duration CHECK (duration_min BETWEEN 15 AND 180),
    FOREIGN KEY (request_id) REFERENCES mentorship_requests(request_id) ON DELETE CASCADE,
    INDEX idx_meetings_request (request_id, scheduled_at)
) ENGINE=InnoDB;

CREATE TABLE reviews (
    review_id    INT AUTO_INCREMENT PRIMARY KEY,
    meeting_id   INT NOT NULL UNIQUE,
    rating       TINYINT NOT NULL,
    comment      TEXT,
    created_ts   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5),
    FOREIGN KEY (meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE notifications (
    notification_id  INT AUTO_INCREMENT PRIMARY KEY,
    user_id          INT NOT NULL,
    kind             VARCHAR(30) NOT NULL,
    message          VARCHAR(255) NOT NULL,
    is_read          TINYINT(1) NOT NULL DEFAULT 0,
    created_ts       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_notifications_user (user_id, is_read, created_ts)
) ENGINE=InnoDB;

CREATE TABLE audit_log (
    log_id      INT AUTO_INCREMENT PRIMARY KEY,
    actor_id    INT NULL,
    action      VARCHAR(40) NOT NULL,
    entity      VARCHAR(40) NOT NULL,
    entity_id   INT NOT NULL,
    detail      VARCHAR(255),
    created_ts  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (actor_id) REFERENCES users(user_id) ON DELETE SET NULL,
    INDEX idx_audit_created (created_ts)
) ENGINE=InnoDB;
