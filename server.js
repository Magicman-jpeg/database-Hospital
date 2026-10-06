// =============================================================
//  Hospital Patient & Room Capacity Management System
//  Express REST API + static frontend
// =============================================================
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, ping } from './db.js';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Tiny async wrapper so route handlers can throw and get a 500.
const wrap = (fn) => (req, res) => fn(req, res).catch((err) => {
  console.error(err);
  res.status(err.statusCode || 500).json({ error: err.message || 'Server error' });
});

const httpError = (status, message) => Object.assign(new Error(message), { statusCode: status });

// -------------------------------------------------------------
//  GET /api/health
// -------------------------------------------------------------
app.get('/api/health', wrap(async (_req, res) => {
  await ping();
  res.json({ ok: true });
}));

// -------------------------------------------------------------
//  GET /api/departments
// -------------------------------------------------------------
app.get('/api/departments', wrap(async (_req, res) => {
  const [rows] = await pool.query(
    'SELECT department_id, department_name FROM departments ORDER BY department_name'
  );
  res.json(rows);
}));

// -------------------------------------------------------------
//  GET /api/rooms  — supports ?department=&type=&status= filters
//  Reads from the v_room_capacity view (pct + beds_available precomputed).
// -------------------------------------------------------------
app.get('/api/rooms', wrap(async (req, res) => {
  const { department, type, status } = req.query;
  const where = [];
  const params = [];

  if (department) { where.push('department_id = ?'); params.push(Number(department)); }
  if (type)       { where.push('room_type = ?');     params.push(String(type)); }
  if (status)     { where.push('status = ?');        params.push(String(status)); }

  const sql = `
    SELECT * FROM v_room_capacity
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY department_name, room_number`;
  const [rows] = await pool.query(sql, params);
  res.json(rows);
}));

// -------------------------------------------------------------
//  GET /api/admissions  — active admissions with patient + room info
// -------------------------------------------------------------
app.get('/api/admissions', wrap(async (req, res) => {
  const activeOnly = req.query.active !== 'false';
  const [rows] = await pool.query(
    `SELECT a.admission_id, a.patient_id, a.room_id, a.admission_date,
            a.discharge_date, a.status,
            p.first_name, p.last_name, p.contact_number,
            r.room_number, r.room_type
       FROM admissions a
       JOIN patients p ON p.patient_id = a.patient_id
       JOIN rooms    r ON r.room_id    = a.room_id
      ${activeOnly ? "WHERE a.status = 'Active'" : ''}
      ORDER BY a.admission_date DESC`
  );
  res.json(rows);
}));

// -------------------------------------------------------------
//  POST /api/admissions  — register + admit a patient
//  Body: { first_name, last_name, contact_number, room_id }
//  Runs in a transaction; a row-lock on the room prevents two
//  simultaneous admissions overfilling the last bed (race-safe).
//  Occupancy + room status are updated by DB triggers.
// -------------------------------------------------------------
app.post('/api/admissions', wrap(async (req, res) => {
  const { first_name, last_name, contact_number, room_id } = req.body || {};

  if (!first_name?.trim() || !last_name?.trim()) {
    throw httpError(400, 'first_name and last_name are required.');
  }
  if (!room_id) throw httpError(400, 'room_id is required.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // Lock the room row for the duration of the transaction.
    const [[room]] = await conn.query(
      'SELECT room_id, max_capacity, current_occupancy, status FROM rooms WHERE room_id = ? FOR UPDATE',
      [Number(room_id)]
    );
    if (!room) throw httpError(404, 'Room not found.');
    if (room.status === 'Maintenance') throw httpError(409, 'Room is under maintenance.');
    if (room.current_occupancy >= room.max_capacity) {
      throw httpError(409, 'Room is already full.');
    }

    // Create the patient, then the active admission (trigger bumps occupancy).
    const [pResult] = await conn.query(
      `INSERT INTO patients (first_name, last_name, contact_number, admission_status)
       VALUES (?, ?, ?, 'Admitted')`,
      [first_name.trim(), last_name.trim(), contact_number?.trim() || null]
    );
    const patientId = pResult.insertId;

    const [aResult] = await conn.query(
      `INSERT INTO admissions (patient_id, room_id, status) VALUES (?, ?, 'Active')`,
      [patientId, room.room_id]
    );

    await conn.commit();
    res.status(201).json({
      admission_id: aResult.insertId,
      patient_id: patientId,
      room_id: room.room_id,
    });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// -------------------------------------------------------------
//  PATCH /api/admissions/:id/discharge  — discharge a patient
//  Flips admission -> Discharged, sets discharge_date, marks patient
//  Discharged. Trigger decrements occupancy + reopens the room.
// -------------------------------------------------------------
app.patch('/api/admissions/:id/discharge', wrap(async (req, res) => {
  const admissionId = Number(req.params.id);
  if (!admissionId) throw httpError(400, 'Invalid admission id.');

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[adm]] = await conn.query(
      'SELECT admission_id, patient_id, status FROM admissions WHERE admission_id = ? FOR UPDATE',
      [admissionId]
    );
    if (!adm) throw httpError(404, 'Admission not found.');
    if (adm.status !== 'Active') throw httpError(409, 'Admission is not active.');

    await conn.query(
      `UPDATE admissions
          SET status = 'Discharged', discharge_date = NOW()
        WHERE admission_id = ?`,
      [admissionId]
    );
    await conn.query(
      `UPDATE patients SET admission_status = 'Discharged' WHERE patient_id = ?`,
      [adm.patient_id]
    );

    await conn.commit();
    res.json({ ok: true, admission_id: admissionId });
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}));

// -------------------------------------------------------------
//  PATCH /api/rooms/:id/status  — set Maintenance / Available
// -------------------------------------------------------------
app.patch('/api/rooms/:id/status', wrap(async (req, res) => {
  const roomId = Number(req.params.id);
  const { status } = req.body || {};
  if (!['Available', 'Maintenance'].includes(status)) {
    throw httpError(400, "status must be 'Available' or 'Maintenance'.");
  }

  const [[room]] = await pool.query(
    'SELECT max_capacity, current_occupancy FROM rooms WHERE room_id = ?',
    [roomId]
  );
  if (!room) throw httpError(404, 'Room not found.');

  // If re-opening, compute correct state from occupancy.
  let next = status;
  if (status === 'Available' && room.current_occupancy >= room.max_capacity) {
    next = 'Full';
  }
  await pool.query('UPDATE rooms SET status = ? WHERE room_id = ?', [next, roomId]);
  res.json({ ok: true, status: next });
}));

// -------------------------------------------------------------
//  Fallback to the dashboard for any non-API route.
// -------------------------------------------------------------
app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = Number(process.env.PORT) || 3000;
app.listen(PORT, () => {
  console.log(`\n  Hospital Capacity System running:  http://localhost:${PORT}\n`);
});
