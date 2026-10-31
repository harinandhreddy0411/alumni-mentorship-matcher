CREATE TABLE IF NOT EXISTS users (
    user_id           INT AUTO_INCREMENT PRIMARY KEY,
    username          VARCHAR(50)  NOT NULL UNIQUE,
    password_hash     VARCHAR(255) NOT NULL,
    role              ENUM('student','alumni','admin') NOT NULL,
    full_name         VARCHAR(100) NOT NULL,
    focus_track       VARCHAR(30),
    professional_bio  TEXT,
    email             VARCHAR(120),
    creation_ts       DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS alumni_details (
    alumni_id        INT PRIMARY KEY,
    capacity_status  ENUM('active','paused') NOT NULL DEFAULT 'active',
    max_mentees      INT NOT NULL DEFAULT 3,
    preferred_hours  VARCHAR(100),
    FOREIGN KEY (alumni_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS mentorship_requests (
    request_id      INT AUTO_INCREMENT PRIMARY KEY,
    student_id      INT NOT NULL,
    alumni_id       INT NOT NULL,
    focus_area      VARCHAR(50),
    pitch_message   TEXT,
    status          ENUM('pending','accepted','declined') NOT NULL DEFAULT 'pending',
    creation_ts     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (alumni_id)  REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS sessions (
    session_id   INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT NOT NULL UNIQUE,
    token        VARCHAR(64) NOT NULL UNIQUE,
    login_ts     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;
