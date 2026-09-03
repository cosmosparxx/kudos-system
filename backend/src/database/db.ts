import { Pool } from 'pg';
import { config } from 'dotenv';

config();

const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'kudos_db'
});

export async function createDbPool() {
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('Database connection successful');
    return pool;
  } catch (error) {
    console.error('Database connection failed:', error);
    throw error;
  }
}

export function getDbPool() {
  return pool;
}

export async function query(text: string, params?: any[]) {
  return pool.query(text, params);
}

export async function closePool() {
  await pool.end();
}
