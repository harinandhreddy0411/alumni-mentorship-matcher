-- Alumni Mentorship Matcher — MySQL schema (3NF)
-- Run this once against a fresh database: mysql -u root -p < schema.sql

CREATE DATABASE IF NOT EXISTS alumni_matcher;
USE alumni_matcher;

CREATE TABLE users (
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

-- 3NF split: these attributes depend on "this user is an alumnus," not on user_id alone,
-- so they don't belong on the users supertype (they'd sit NULL for every student otherwise).
CREATE TABLE alumni_details (
    alumni_id        INT PRIMARY KEY,
    capacity_status  ENUM('active','paused') NOT NULL DEFAULT 'active',
    max_mentees      INT NOT NULL DEFAULT 3,
    preferred_hours  VARCHAR(100),
    FOREIGN KEY (alumni_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE mentorship_requests (
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

CREATE TABLE sessions (
    session_id   INT AUTO_INCREMENT PRIMARY KEY,
    user_id      INT NOT NULL UNIQUE,   -- UNIQUE enforces the 1:1 cardinality from the ER model
    token        VARCHAR(64) NOT NULL UNIQUE,
    login_ts     DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Seed an admin account so the system isn't unusable on first run
-- (password is 'adminpassword' — bcrypt hash generated at setup time, see seed.js)
