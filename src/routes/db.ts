import { Router, Request, Response } from 'express';
import { withConnection } from '../utils/db';

const router = Router();

router.get('/health', async (req: Request, res: Response) => {
  try {
    let databaseServerTime: string | null = null;
    let databaseResponseMs: number | null = null;

    await withConnection(async (conn) => {
      const dbStart = Date.now();
      const [rows]: any = await conn.query('SELECT NOW() as server_time');
      databaseResponseMs = Date.now() - dbStart;
      databaseServerTime = rows[0]?.server_time
        ? new Date(rows[0].server_time).toISOString()
        : null;
    });

    res.json({
      service: 'sample',
      status: 'ok',
      deployed_at: process.env.DEPLOYED_AT || null,
      message: 'Database connection successful',
      database: process.env.DB_NAME || 'test',
      database_server_time: databaseServerTime,
      database_response_ms: databaseResponseMs,
      time_now: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Database health check failed:', error);
    res.status(503).json({
      service: 'sample',
      status: 'error',
      message: 'Database connection failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
