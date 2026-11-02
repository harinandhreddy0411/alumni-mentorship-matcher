ALTER TABLE alumni_details
    ADD COLUMN verification_status ENUM('pending', 'verified', 'rejected') NOT NULL DEFAULT 'pending',
    ADD COLUMN graduation_year SMALLINT NULL,
    ADD COLUMN department VARCHAR(60) NULL,
    ADD COLUMN verified_by INT NULL,
    ADD COLUMN verified_at DATETIME NULL,
    ADD CONSTRAINT chk_graduation_year CHECK (graduation_year IS NULL OR graduation_year BETWEEN 1990 AND 2100),
    ADD CONSTRAINT fk_alumni_verified_by FOREIGN KEY (verified_by) REFERENCES users(user_id) ON DELETE SET NULL,
    ADD INDEX idx_alumni_verification (verification_status);

UPDATE alumni_details SET verification_status = 'verified', verified_at = CURRENT_TIMESTAMP;
