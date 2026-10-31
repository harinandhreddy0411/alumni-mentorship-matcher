ALTER TABLE meetings
    MODIFY status ENUM('proposed','scheduled','completed','cancelled','declined') NOT NULL DEFAULT 'proposed',
    ADD COLUMN proposed_by INT NULL,
    ADD COLUMN acted_by INT NULL,
    ADD CONSTRAINT fk_meetings_proposer FOREIGN KEY (proposed_by) REFERENCES users(user_id) ON DELETE SET NULL,
    ADD CONSTRAINT fk_meetings_actor FOREIGN KEY (acted_by) REFERENCES users(user_id) ON DELETE SET NULL,
    ADD INDEX idx_meetings_time (scheduled_at, status);
