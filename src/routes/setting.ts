import { Router, Request, Response } from 'express';
import { withConnection } from '../utils/db';
import { getTenantId } from '../utils/tenant';
import { errorResponse, successResponse } from '../utils/formatters';
import { auditCreate, auditUpdate } from '../utils/auditService';

const router = Router();
const ENTITY = 'estate_setting';

// GET / - list settings with optional estateId filter
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required'));

    const estateId = req.query.estateId ? Number(req.query.estateId) : undefined;
    const search = req.query.search as string | undefined;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (estateId) {
      conditions.push('estate_id = ?');
      params.push(estateId);
    }
    if (search) {
      conditions.push('setting_key LIKE ?');
      params.push(`%${search}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await withConnection(async (conn) => {
      const [result] = await conn.query(
        `SELECT id, estate_id, setting_key, setting_value, created_at, modified_at
         FROM estate_setting ${where} ORDER BY estate_id, setting_key`,
        params,
      );
      return result as any[];
    });

    return res.json(successResponse(rows));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

// GET /:id - get setting by id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required'));

    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json(errorResponse('Invalid id in path'));

    const rows = await withConnection(async (conn) => {
      const [result] = await conn.query(
        `SELECT id, estate_id, setting_key, setting_value, created_at, modified_at
         FROM estate_setting WHERE id = ?`,
        [id],
      );
      return result as any[];
    });

    if (rows.length === 0) return res.status(404).json(errorResponse(`Setting with id ${id} not found`));
    return res.json(successResponse(rows[0]));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

// PUT /estate/:estateId/key/:settingKey - upsert a setting by estate and key
router.put('/estate/:estateId/key/:settingKey', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required'));

    const estateId = Number(req.params.estateId);
    if (!estateId || isNaN(estateId)) return res.status(400).json(errorResponse('Invalid estateId in path'));

    const settingKey = req.params.settingKey as string;
    if (!settingKey) return res.status(400).json(errorResponse('settingKey is required in path'));

    const { setting_value, reason } = req.body;
    if (setting_value === undefined) return res.status(400).json(errorResponse('setting_value is required'));

    const row = await withConnection(async (conn) => {
      const [existing] = await conn.query(
        'SELECT * FROM estate_setting WHERE estate_id = ? AND setting_key = ?',
        [estateId, settingKey],
      );

      if ((existing as any[]).length > 0) {
        const before = (existing as any[])[0];
        await conn.query(
          'UPDATE estate_setting SET setting_value = ? WHERE estate_id = ? AND setting_key = ?',
          [setting_value, estateId, settingKey],
        );
        const [updated] = await conn.query('SELECT * FROM estate_setting WHERE id = ?', [before.id]);
        const after = (updated as any[])[0];
        await auditUpdate(conn, ENTITY, before.id, before, after, undefined, reason);
        return after;
      }

      const [result] = await conn.query(
        'INSERT INTO estate_setting (estate_id, setting_key, setting_value) VALUES (?, ?, ?)',
        [estateId, settingKey, setting_value],
      );
      const insertId = (result as any).insertId as number;
      const [rows] = await conn.query('SELECT * FROM estate_setting WHERE id = ?', [insertId]);
      const created = (rows as any[])[0];
      await auditCreate(conn, ENTITY, insertId, created, undefined, reason);
      return created;
    });

    return res.json(successResponse(row));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

// POST / - create setting
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required'));

    const { estate_id, setting_key, setting_value } = req.body;
    if (!estate_id) return res.status(400).json(errorResponse('estate_id is required'));
    if (!setting_key) return res.status(400).json(errorResponse('setting_key is required'));

    const row = await withConnection(async (conn) => {
      const [result] = await conn.query(
        'INSERT INTO estate_setting (estate_id, setting_key, setting_value) VALUES (?, ?, ?)',
        [estate_id, setting_key, setting_value ?? null],
      );
      const insertId = (result as any).insertId as number;

      const [rows] = await conn.query('SELECT * FROM estate_setting WHERE id = ?', [insertId]);
      const created = (rows as any[])[0];

      await auditCreate(conn, ENTITY, insertId, created);

      return created;
    });

    return res.status(201).json(successResponse(row));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

// PUT /:id - update setting by id
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required'));

    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json(errorResponse('Invalid id in path'));

    const row = await withConnection(async (conn) => {
      const [existing] = await conn.query('SELECT * FROM estate_setting WHERE id = ?', [id]);
      if ((existing as any[]).length === 0) return null;
      const before = (existing as any[])[0];

      const { setting_value, reason } = req.body;

      await conn.query('UPDATE estate_setting SET setting_value = ? WHERE id = ?', [setting_value ?? null, id]);

      const [updated] = await conn.query('SELECT * FROM estate_setting WHERE id = ?', [id]);
      const after = (updated as any[])[0];

      await auditUpdate(conn, ENTITY, id, before, after, undefined, reason);

      return after;
    });

    if (!row) return res.status(404).json(errorResponse(`Setting with id ${id} not found`));
    return res.json(successResponse(row));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

export default router;
