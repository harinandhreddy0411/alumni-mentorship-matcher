DROP TRIGGER IF EXISTS trg_users_bd;
DROP TRIGGER IF EXISTS trg_sessions_bi;
DROP TRIGGER IF EXISTS trg_requests_bi;
DROP TRIGGER IF EXISTS trg_requests_bu;
DROP TRIGGER IF EXISTS trg_requests_ai;
DROP TRIGGER IF EXISTS trg_requests_au;
DROP TRIGGER IF EXISTS trg_messages_bi;
DROP TRIGGER IF EXISTS trg_messages_ai;
DROP TRIGGER IF EXISTS trg_meetings_bi;
DROP TRIGGER IF EXISTS trg_meetings_bu;
DROP TRIGGER IF EXISTS trg_meetings_ai;
DROP TRIGGER IF EXISTS trg_reviews_bi;
DROP VIEW IF EXISTS v_active_matches;
DROP VIEW IF EXISTS v_pending_queue;
DROP VIEW IF EXISTS v_mentor_load;
DROP VIEW IF EXISTS v_monthly_requests;
DROP VIEW IF EXISTS v_skill_demand;
DROP FUNCTION IF EXISTS fn_match_score;
DROP PROCEDURE IF EXISTS sp_send_request;
DROP PROCEDURE IF EXISTS sp_respond_request;
DROP PROCEDURE IF EXISTS sp_cancel_match;
DROP PROCEDURE IF EXISTS sp_book_meeting;
DROP PROCEDURE IF EXISTS sp_set_meeting_status;
DROP PROCEDURE IF EXISTS sp_submit_review;
DROP PROCEDURE IF EXISTS sp_recommend_mentors;

CREATE VIEW v_active_matches AS
SELECT r.request_id,
       r.student_id, s.full_name AS student_name, s.focus_track AS student_track,
       r.alumni_id,  a.full_name AS mentor_name,  a.focus_track AS mentor_track,
       r.focus_area, r.creation_ts AS matched_since
FROM mentorship_requests r
JOIN users s ON s.user_id = r.student_id
JOIN users a ON a.user_id = r.alumni_id
WHERE r.status = 'accepted';

CREATE VIEW v_pending_queue AS
SELECT r.request_id, r.alumni_id, r.student_id, s.full_name AS student_name,
       s.focus_track AS student_track, r.focus_area, r.pitch_message, r.creation_ts
FROM mentorship_requests r
JOIN users s ON s.user_id = r.student_id
WHERE r.status = 'pending';

CREATE VIEW v_mentor_load AS
SELECT u.user_id AS alumni_id, u.full_name, u.focus_track, u.professional_bio,
       ad.capacity_status, ad.max_mentees,
       (SELECT COUNT(*) FROM mentorship_requests r
         WHERE r.alumni_id = ad.alumni_id AND r.status = 'accepted') AS current_mentees,
       ad.max_mentees - (SELECT COUNT(*) FROM mentorship_requests r
         WHERE r.alumni_id = ad.alumni_id AND r.status = 'accepted') AS open_slots,
       (SELECT ROUND(AVG(rv.rating), 2) FROM reviews rv
         JOIN meetings m ON m.meeting_id = rv.meeting_id
         JOIN mentorship_requests r ON r.request_id = m.request_id
         WHERE r.alumni_id = ad.alumni_id) AS avg_rating,
       (SELECT COUNT(*) FROM reviews rv
         JOIN meetings m ON m.meeting_id = rv.meeting_id
         JOIN mentorship_requests r ON r.request_id = m.request_id
         WHERE r.alumni_id = ad.alumni_id) AS review_count
FROM alumni_details ad
JOIN users u ON u.user_id = ad.alumni_id;

CREATE VIEW v_monthly_requests AS
SELECT DATE_FORMAT(creation_ts, '%Y-%m') AS month,
       COUNT(*) AS total,
       SUM(status = 'accepted') AS accepted,
       SUM(status = 'declined') AS declined,
       SUM(status = 'pending')  AS pending
FROM mentorship_requests
GROUP BY DATE_FORMAT(creation_ts, '%Y-%m');

CREATE VIEW v_skill_demand AS
SELECT sk.skill_id, sk.name, sk.category,
       SUM(u.role = 'student') AS students,
       SUM(u.role = 'alumni')  AS mentors
FROM skills sk
LEFT JOIN user_skills us ON us.skill_id = sk.skill_id
LEFT JOIN users u ON u.user_id = us.user_id
GROUP BY sk.skill_id, sk.name, sk.category;

DELIMITER $$

CREATE TRIGGER trg_users_bd BEFORE DELETE ON users
FOR EACH ROW
BEGIN
    IF OLD.role = 'admin' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Admin accounts cannot be deleted';
    END IF;
END$$

CREATE TRIGGER trg_sessions_bi BEFORE INSERT ON sessions
FOR EACH ROW
BEGIN
    IF NEW.expires_at IS NULL THEN
        SET NEW.expires_at = DATE_ADD(NOW(), INTERVAL 7 DAY);
    END IF;
END$$

CREATE TRIGGER trg_requests_bi BEFORE INSERT ON mentorship_requests
FOR EACH ROW
BEGIN
    DECLARE v_student_role VARCHAR(10);
    DECLARE v_alumni_role VARCHAR(10);
    DECLARE v_capacity VARCHAR(10);
    SELECT role INTO v_student_role FROM users WHERE user_id = NEW.student_id;
    SELECT role INTO v_alumni_role FROM users WHERE user_id = NEW.alumni_id;
    IF v_student_role IS NULL OR v_student_role <> 'student' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only students can send mentorship requests';
    END IF;
    IF v_alumni_role IS NULL OR v_alumni_role <> 'alumni' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Requests can only be sent to alumni';
    END IF;
    SELECT capacity_status INTO v_capacity FROM alumni_details WHERE alumni_id = NEW.alumni_id;
    IF v_capacity IS NULL OR v_capacity <> 'active' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This mentor is not accepting mentees right now';
    END IF;
    IF NEW.pitch_message IS NULL OR CHAR_LENGTH(TRIM(NEW.pitch_message)) = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A pitch message is required';
    END IF;
    IF EXISTS (SELECT 1 FROM mentorship_requests
               WHERE student_id = NEW.student_id AND alumni_id = NEW.alumni_id
                 AND status IN ('pending', 'accepted')) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You already have an open request with this mentor';
    END IF;
END$$

CREATE TRIGGER trg_requests_bu BEFORE UPDATE ON mentorship_requests
FOR EACH ROW
BEGIN
    DECLARE v_accepted INT;
    DECLARE v_max INT;
    IF NEW.student_id <> OLD.student_id OR NEW.alumni_id <> OLD.alumni_id THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A request cannot be reassigned';
    END IF;
    IF NEW.status <> OLD.status THEN
        IF OLD.status = 'declined' OR (OLD.status = 'accepted' AND NEW.status <> 'declined') THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This request is already closed';
        END IF;
        IF NEW.status = 'accepted' THEN
            SELECT COUNT(*) INTO v_accepted FROM mentorship_requests
             WHERE alumni_id = NEW.alumni_id AND status = 'accepted';
            SELECT max_mentees INTO v_max FROM alumni_details WHERE alumni_id = NEW.alumni_id;
            IF v_accepted >= v_max THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Mentee capacity reached';
            END IF;
        END IF;
    END IF;
END$$

CREATE TRIGGER trg_requests_ai AFTER INSERT ON mentorship_requests
FOR EACH ROW
BEGIN
    DECLARE v_name VARCHAR(100);
    SELECT full_name INTO v_name FROM users WHERE user_id = NEW.student_id;
    INSERT INTO notifications (user_id, kind, message)
    VALUES (NEW.alumni_id, 'request', CONCAT('New mentorship request from ', v_name));
    INSERT INTO audit_log (actor_id, action, entity, entity_id, detail)
    VALUES (NEW.student_id, 'request_sent', 'mentorship_requests', NEW.request_id, NEW.focus_area);
END$$

CREATE TRIGGER trg_requests_au AFTER UPDATE ON mentorship_requests
FOR EACH ROW
BEGIN
    DECLARE v_name VARCHAR(100);
    IF NEW.status <> OLD.status THEN
        SELECT full_name INTO v_name FROM users WHERE user_id = NEW.alumni_id;
        INSERT INTO notifications (user_id, kind, message)
        VALUES (NEW.student_id, 'request', CONCAT(v_name, ' ', NEW.status, ' your request'));
        INSERT INTO audit_log (actor_id, action, entity, entity_id, detail)
        VALUES (NEW.alumni_id, CONCAT('request_', NEW.status), 'mentorship_requests', NEW.request_id,
                CONCAT(OLD.status, ' to ', NEW.status));
    END IF;
END$$

CREATE TRIGGER trg_messages_bi BEFORE INSERT ON messages
FOR EACH ROW
BEGIN
    DECLARE v_student INT;
    DECLARE v_alumni INT;
    DECLARE v_status VARCHAR(10);
    SELECT student_id, alumni_id, status INTO v_student, v_alumni, v_status
      FROM mentorship_requests WHERE request_id = NEW.request_id;
    IF v_status IS NULL OR v_status <> 'accepted' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Chat opens once a request is accepted';
    END IF;
    IF NEW.sender_id NOT IN (v_student, v_alumni) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You are not part of this match';
    END IF;
END$$

CREATE TRIGGER trg_messages_ai AFTER INSERT ON messages
FOR EACH ROW
BEGIN
    DECLARE v_student INT;
    DECLARE v_alumni INT;
    DECLARE v_name VARCHAR(100);
    SELECT student_id, alumni_id INTO v_student, v_alumni
      FROM mentorship_requests WHERE request_id = NEW.request_id;
    SELECT full_name INTO v_name FROM users WHERE user_id = NEW.sender_id;
    INSERT INTO notifications (user_id, kind, message)
    VALUES (IF(NEW.sender_id = v_student, v_alumni, v_student), 'message',
            CONCAT('New message from ', v_name));
END$$

CREATE TRIGGER trg_meetings_bi BEFORE INSERT ON meetings
FOR EACH ROW
BEGIN
    DECLARE v_status VARCHAR(10);
    SELECT status INTO v_status FROM mentorship_requests WHERE request_id = NEW.request_id;
    IF v_status IS NULL OR v_status <> 'accepted' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Meetings can only be booked for accepted matches';
    END IF;
    IF NEW.status = 'scheduled' AND NEW.scheduled_at <= UTC_TIMESTAMP() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pick a time in the future';
    END IF;
END$$

CREATE TRIGGER trg_meetings_bu BEFORE UPDATE ON meetings
FOR EACH ROW
BEGIN
    IF NEW.status <> OLD.status THEN
        IF OLD.status <> 'scheduled' THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This meeting is already closed';
        END IF;
        IF NEW.status = 'completed' AND OLD.scheduled_at > UTC_TIMESTAMP() THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A meeting cannot be completed before it starts';
        END IF;
    END IF;
END$$

CREATE TRIGGER trg_meetings_ai AFTER INSERT ON meetings
FOR EACH ROW
BEGIN
    DECLARE v_student INT;
    DECLARE v_alumni INT;
    SELECT student_id, alumni_id INTO v_student, v_alumni
      FROM mentorship_requests WHERE request_id = NEW.request_id;
    IF NEW.status = 'scheduled' THEN
        INSERT INTO notifications (user_id, kind, message)
        VALUES (v_student, 'meeting', CONCAT('Meeting booked for ', DATE_FORMAT(NEW.scheduled_at, '%d %b %Y %H:%i'), ' UTC')),
               (v_alumni,  'meeting', CONCAT('Meeting booked for ', DATE_FORMAT(NEW.scheduled_at, '%d %b %Y %H:%i'), ' UTC'));
    END IF;
END$$

CREATE TRIGGER trg_reviews_bi BEFORE INSERT ON reviews
FOR EACH ROW
BEGIN
    DECLARE v_status VARCHAR(10);
    SELECT status INTO v_status FROM meetings WHERE meeting_id = NEW.meeting_id;
    IF v_status IS NULL OR v_status <> 'completed' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only completed meetings can be reviewed';
    END IF;
END$$

CREATE FUNCTION fn_match_score(p_student INT, p_alumni INT) RETURNS INT
READS SQL DATA
BEGIN
    DECLARE v_score INT;
    SELECT COUNT(*) INTO v_score
      FROM user_skills a
      JOIN user_skills b ON b.skill_id = a.skill_id
     WHERE a.user_id = p_student AND b.user_id = p_alumni;
    RETURN v_score;
END$$

CREATE PROCEDURE sp_send_request(IN p_student INT, IN p_alumni INT, IN p_focus VARCHAR(50), IN p_pitch TEXT)
BEGIN
    INSERT INTO mentorship_requests (student_id, alumni_id, focus_area, pitch_message)
    VALUES (p_student, p_alumni, p_focus, p_pitch);
    SELECT LAST_INSERT_ID() AS request_id;
END$$

CREATE PROCEDURE sp_respond_request(IN p_alumni INT, IN p_request INT, IN p_status VARCHAR(10))
BEGIN
    DECLARE v_lock INT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    IF p_status NOT IN ('accepted', 'declined') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid status';
    END IF;
    START TRANSACTION;
    SELECT alumni_id INTO v_lock FROM alumni_details WHERE alumni_id = p_alumni FOR UPDATE;
    UPDATE mentorship_requests SET status = p_status
     WHERE request_id = p_request AND alumni_id = p_alumni AND status = 'pending';
    IF ROW_COUNT() = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Pending request not found';
    END IF;
    COMMIT;
END$$

CREATE PROCEDURE sp_cancel_match(IN p_request INT)
BEGIN
    UPDATE mentorship_requests SET status = 'declined'
     WHERE request_id = p_request AND status IN ('pending', 'accepted');
    IF ROW_COUNT() = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Match not found';
    END IF;
END$$

CREATE PROCEDURE sp_book_meeting(IN p_user INT, IN p_request INT, IN p_at DATETIME, IN p_duration INT, IN p_link VARCHAR(255))
BEGIN
    DECLARE v_student INT;
    DECLARE v_alumni INT;
    SELECT student_id, alumni_id INTO v_student, v_alumni
      FROM mentorship_requests WHERE request_id = p_request;
    IF v_student IS NULL OR p_user NOT IN (v_student, v_alumni) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You are not part of this match';
    END IF;
    INSERT INTO meetings (request_id, scheduled_at, duration_min, meeting_link)
    VALUES (p_request, p_at, p_duration, p_link);
    SELECT LAST_INSERT_ID() AS meeting_id;
END$$

CREATE PROCEDURE sp_set_meeting_status(IN p_user INT, IN p_meeting INT, IN p_status VARCHAR(10))
BEGIN
    DECLARE v_student INT;
    DECLARE v_alumni INT;
    IF p_status NOT IN ('completed', 'cancelled') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid status';
    END IF;
    SELECT r.student_id, r.alumni_id INTO v_student, v_alumni
      FROM meetings m JOIN mentorship_requests r ON r.request_id = m.request_id
     WHERE m.meeting_id = p_meeting;
    IF v_student IS NULL OR p_user NOT IN (v_student, v_alumni) THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Meeting not found';
    END IF;
    UPDATE meetings SET status = p_status WHERE meeting_id = p_meeting;
END$$

CREATE PROCEDURE sp_submit_review(IN p_student INT, IN p_meeting INT, IN p_rating INT, IN p_comment TEXT)
BEGIN
    DECLARE v_student INT;
    SELECT r.student_id INTO v_student
      FROM meetings m JOIN mentorship_requests r ON r.request_id = m.request_id
     WHERE m.meeting_id = p_meeting;
    IF v_student IS NULL OR v_student <> p_student THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only the mentee can review this meeting';
    END IF;
    INSERT INTO reviews (meeting_id, rating, comment) VALUES (p_meeting, p_rating, p_comment);
END$$

CREATE PROCEDURE sp_recommend_mentors(IN p_student INT)
BEGIN
    SELECT t.*,
           RANK() OVER (ORDER BY t.shared_skills DESC, COALESCE(t.avg_rating, 0) DESC) AS rank_pos
      FROM (SELECT ml.alumni_id, ml.full_name, ml.focus_track, ml.professional_bio,
                   ml.open_slots, ml.avg_rating, ml.review_count,
                   fn_match_score(p_student, ml.alumni_id) AS shared_skills
              FROM v_mentor_load ml
             WHERE ml.capacity_status = 'active'
               AND ml.open_slots > 0
               AND NOT EXISTS (SELECT 1 FROM mentorship_requests r
                                WHERE r.student_id = p_student AND r.alumni_id = ml.alumni_id
                                  AND r.status IN ('pending', 'accepted'))) t
     ORDER BY rank_pos, t.full_name;
END$$

DELIMITER ;
