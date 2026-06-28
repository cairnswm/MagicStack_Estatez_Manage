import { Router, Request, Response } from 'express';
import os from 'os';
import { getFetch } from '../utils/authClient';
import { successResponse } from '../utils/formatters';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const deployedAtEnv = process.env.DEPLOYED_AT;
  let deployedAtLocal = 'unknown';

  if (deployedAtEnv) {
    const parsed = new Date(deployedAtEnv);
    if (!isNaN(parsed.getTime())) {
      deployedAtLocal = parsed.toISOString();
    } else {
      deployedAtLocal = deployedAtEnv;
    }
  }

  const uptimeSeconds = Math.floor(process.uptime());
  const uptime = process.uptime();
  const cpuUsage = process.cpuUsage();
  const cpuTotalSeconds = (cpuUsage.user + cpuUsage.system) / 1_000_000;
  const cpuPercentage = uptime > 0 ? Number(((cpuTotalSeconds / uptime) * 100).toFixed(2)) : 0;
  const mem = process.memoryUsage();
  const startedAt = new Date(Date.now() - (process.uptime() * 1000)).toISOString();

  res.json({
    service: 'sample',
    status: 'ok',
    deployed_at: deployedAtLocal,
    started_at: startedAt,
    time_now: new Date().toISOString(),
    hostname: os.hostname(),
    node_version: process.version,
    pid: process.pid,
    uptime_seconds: uptimeSeconds,
    cpu_percent: cpuPercentage,
    memory: {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
      external_mb: Math.round(mem.external / 1024 / 1024),
    },
  });
});

router.get('/services', async (req: Request, res: Response) => {
  const serviceKeys = Object.keys(process.env).filter(k => k.startsWith('MAGICSTACK_'));

  const results = await Promise.all(
    serviceKeys.map(async (key) => {
      const baseUrl = (process.env[key] || '').replace(/\/$/, '');
      const url = `${baseUrl}/health`;
      const start = Date.now();
      try {
        const fetchFn = getFetch();
        const response = await fetchFn(url);
        return {
          service: key.replace(/^MAGICSTACK_/, '').toLowerCase(),
          url,
          status: response.ok ? 'ok' : 'error',
          http_status: response.status,
          response_ms: Date.now() - start,
        };
      } catch (error) {
        return {
          service: key.replace(/^MAGICSTACK_/, '').toLowerCase(),
          url,
          status: 'error',
          response_ms: Date.now() - start,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  const allOk = results.every(r => r.status === 'ok');

  res.status(allOk ? 200 : 207).json(
    successResponse({
      time_now: new Date().toISOString(),
      services: results,
    })
  );
});

export default router;
