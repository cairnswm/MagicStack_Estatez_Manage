import pool from '../config/database';

export async function withConnection<T>(fn: (conn: any) => Promise<T>): Promise<T> {
  const conn = await pool.getConnection();
  try {
    return await fn(conn);
  } finally {
    conn.release();
  }
}

export async function query<T = any>(sql: string, params?: any[]): Promise<T> {
  return withConnection(async (conn) => {
    const [rows] = await conn.query(sql, params);
    return rows as T;
  });
}

export default { withConnection, query, pool };
