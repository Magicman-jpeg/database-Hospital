// MySQL connection pool (promise-based) using mysql2.
import mysql from 'mysql2/promise';
import 'dotenv/config';

export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hospital_capacity',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Ensures DATETIME values come back as strings, not server-local Date objects.
  dateStrings: true,
});

// Small helper so routes can run a quick health check.
export async function ping() {
  const conn = await pool.getConnection();
  try {
    await conn.query('SELECT 1');
  } finally {
    conn.release();
  }
}
