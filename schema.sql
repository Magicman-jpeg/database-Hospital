-- =============================================================
--  Hospital Patient & Room Capacity Management System
--  MySQL / MariaDB schema + triggers + sample data
--  Run:  mysql -u <user> -p < schema.sql
-- =============================================================

DROP DATABASE IF EXISTS hospital_capacity;
CREATE DATABASE hospital_capacity
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE hospital_capacity;

-- -------------------------------------------------------------
-- departments
-- -------------------------------------------------------------
CREATE TABLE departments (
  department_id   INT AUTO_INCREMENT PRIMARY KEY,
  department_name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- rooms
--   current_occupancy is maintained automatically by triggers
--   on the admissions table (see below).
-- -------------------------------------------------------------
CREATE TABLE rooms (
  room_id           INT AUTO_INCREMENT PRIMARY KEY,
  room_number       VARCHAR(30) NOT NULL UNIQUE,
  department_id     INT NOT NULL,
  room_type         ENUM('ICU','Private','Semi-Private','General Ward') NOT NULL,
  max_capacity      INT NOT NULL CHECK (max_capacity > 0),
  current_occupancy INT NOT NULL DEFAULT 0 CHECK (current_occupancy >= 0),
  status            ENUM('Available','Full','Maintenance') NOT NULL DEFAULT 'Available',
  CONSTRAINT fk_rooms_department
    FOREIGN KEY (department_id) REFERENCES departments(department_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT chk_capacity CHECK (current_occupancy <= max_capacity)
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- patients
-- -------------------------------------------------------------
CREATE TABLE patients (
  patient_id       INT AUTO_INCREMENT PRIMARY KEY,
  first_name       VARCHAR(80) NOT NULL,
  last_name        VARCHAR(80) NOT NULL,
  contact_number   VARCHAR(30),
  admission_status ENUM('Admitted','Discharged','Transferred') NOT NULL DEFAULT 'Discharged',
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- -------------------------------------------------------------
-- admissions  (patient <-> room assignments over time)
-- -------------------------------------------------------------
CREATE TABLE admissions (
  admission_id   INT AUTO_INCREMENT PRIMARY KEY,
  patient_id     INT NOT NULL,
  room_id        INT NOT NULL,
  admission_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  discharge_date DATETIME NULL,
  status         ENUM('Active','Discharged') NOT NULL DEFAULT 'Active',
  CONSTRAINT fk_adm_patient
    FOREIGN KEY (patient_id) REFERENCES patients(patient_id)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_adm_room
    FOREIGN KEY (room_id) REFERENCES rooms(room_id)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- A patient can only have ONE active admission at a time.
-- (status is part of the key so multiple 'Discharged' rows are allowed.)
CREATE UNIQUE INDEX uq_active_admission
  ON admissions (patient_id, status);

CREATE INDEX idx_adm_room    ON admissions (room_id);
CREATE INDEX idx_adm_status  ON admissions (status);

-- =============================================================
--  TRIGGERS  — the "auto-decrementing / auto-status" logic.
--  Occupancy and room status are derived from admissions so the
--  numbers can never drift out of sync with reality.
-- =============================================================
DELIMITER $$

-- When a NEW active admission is inserted -> bump occupancy, flip to Full if maxed.
CREATE TRIGGER trg_admission_after_insert
AFTER INSERT ON admissions
FOR EACH ROW
BEGIN
  IF NEW.status = 'Active' THEN
    UPDATE rooms
      SET current_occupancy = current_occupancy + 1,
          status = CASE
                     WHEN status = 'Maintenance' THEN 'Maintenance'
                     WHEN current_occupancy + 1 >= max_capacity THEN 'Full'
                     ELSE 'Available'
                   END
      WHERE room_id = NEW.room_id;
  END IF;
END$$

-- When an admission flips Active -> Discharged -> free the bed, reopen room.
CREATE TRIGGER trg_admission_after_update
AFTER UPDATE ON admissions
FOR EACH ROW
BEGIN
  IF OLD.status = 'Active' AND NEW.status = 'Discharged' THEN
    UPDATE rooms
      SET current_occupancy = GREATEST(current_occupancy - 1, 0),
          status = CASE
                     WHEN status = 'Maintenance' THEN 'Maintenance'
                     WHEN GREATEST(current_occupancy - 1, 0) >= max_capacity THEN 'Full'
                     ELSE 'Available'
                   END
      WHERE room_id = NEW.room_id;
  END IF;
END$$

DELIMITER ;

-- =============================================================
--  VIEW — convenient capacity read model for the dashboard.
-- =============================================================
CREATE OR REPLACE VIEW v_room_capacity AS
SELECT
  r.room_id,
  r.room_number,
  r.room_type,
  r.max_capacity,
  r.current_occupancy,
  (r.max_capacity - r.current_occupancy)              AS beds_available,
  ROUND(r.current_occupancy / r.max_capacity * 100)   AS occupancy_pct,
  r.status,
  d.department_id,
  d.department_name
FROM rooms r
JOIN departments d ON d.department_id = r.department_id;

-- =============================================================
--  SAMPLE / DUMMY DATA
-- =============================================================
INSERT INTO departments (department_name) VALUES
  ('Emergency'), ('Cardiology'), ('Pediatrics'), ('General Medicine');

INSERT INTO rooms (room_number, department_id, room_type, max_capacity) VALUES
  ('ICU-101',   1, 'ICU',          5),
  ('ICU-102',   2, 'ICU',          5),
  ('PRIV-201',  2, 'Private',      1),
  ('SEMI-202',  3, 'Semi-Private', 2),
  ('WARD-301',  4, 'General Ward', 8),
  ('WARD-302',  3, 'General Ward', 8),
  ('MAINT-999', 1, 'Private',      1);

-- Put one room into maintenance to show that state in the UI.
UPDATE rooms SET status = 'Maintenance' WHERE room_number = 'MAINT-999';

-- A few patients, some already admitted (triggers will adjust occupancy).
INSERT INTO patients (first_name, last_name, contact_number, admission_status) VALUES
  ('Maria',  'Santos',   '0917-100-1001', 'Admitted'),
  ('Jose',   'Reyes',    '0917-100-1002', 'Admitted'),
  ('Ana',    'Cruz',     '0917-100-1003', 'Admitted'),
  ('Pedro',  'Dela Cruz','0917-100-1004', 'Discharged'),
  ('Liza',   'Mendoza',  '0917-100-1005', 'Discharged');

-- Admit the three "Admitted" patients. The AFTER INSERT trigger
-- increments occupancy and recomputes room status.
INSERT INTO admissions (patient_id, room_id, status) VALUES
  (1, 1, 'Active'),  -- Maria -> ICU-101
  (2, 1, 'Active'),  -- Jose  -> ICU-101
  (3, 4, 'Active');  -- Ana   -> SEMI-202 (now 1/2 => "near full" in UI)
