import { Router, Request, Response } from 'express';
import { withConnection } from '../utils/db';
import { getTenantId } from '../utils/tenant';
import { errorResponse, successResponse } from '../utils/formatters';
import { auditCreate, auditUpdate } from '../utils/auditService';

const router = Router();
const ENTITY = 'estate_person_type';

// GET / - list person types with paging and optional search/filter
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required'));

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;
    const search = req.query.search as string | undefined;
    const estateId = req.query.estateId ? Number(req.query.estateId) : undefined;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (estateId) {
      conditions.push('(estate_id = ? OR estate_id IS NULL)');
      params.push(estateId);
    }
    if (search) {
      conditions.push('(code LIKE ? OR description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await withConnection(async (conn) => {
      const [countResult] = await conn.query(`SELECT COUNT(*) AS total FROM estate_person_type ${where}`, params);
      const totalRows = (countResult as any[])[0].total as number;

      const [rows] = await conn.query(
        `SELECT id, estate_id, code, description, system_type, created_at, modified_at
         FROM estate_person_type ${where} ORDER BY code LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
      );

      return { totalRows, rows: rows as any[] };
    });

    return res.json(successResponse({
      rows: result.rows,
      page,
      pageSize,
      totalRows: result.totalRows,
      totalPages: Math.ceil(result.totalRows / pageSize),
    }));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

// GET /:id - get person type by id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required'));

    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json(errorResponse('Invalid id in path'));

    const rows = await withConnection(async (conn) => {
      const [result] = await conn.query(
        `SELECT id, estate_id, code, description, system_type, created_at, modified_at
         FROM estate_person_type WHERE id = ?`,
        [id],
      );
      return result as any[];
    });

    if (rows.length === 0) return res.status(404).json(errorResponse(`Person type with id ${id} not found`));
    return res.json(successResponse(rows[0]));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

// POST / - create person type
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required'));

    const { estate_id, code, description, system_type } = req.body;
    if (!code) return res.status(400).json(errorResponse('code is required'));
    if (!description) return res.status(400).json(errorResponse('description is required'));

    const row = await withConnection(async (conn) => {
      const [result] = await conn.query(
        `INSERT INTO estate_person_type (estate_id, code, description, system_type)
         VALUES (?, ?, ?, ?)`,
        [estate_id ?? null, code, description, system_type ? 1 : 0],
      );
      const insertId = (result as any).insertId as number;

      const [rows] = await conn.query('SELECT * FROM estate_person_type WHERE id = ?', [insertId]);
      const created = (rows as any[])[0];

      await auditCreate(conn, ENTITY, insertId, created);

      return created;
    });

    return res.status(201).json(successResponse(row));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

// PUT /:id - update person type
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required'));

    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json(errorResponse('Invalid id in path'));

    const row = await withConnection(async (conn) => {
      const [existing] = await conn.query('SELECT * FROM estate_person_type WHERE id = ?', [id]);
      if ((existing as any[]).length === 0) return null;
      const before = (existing as any[])[0];

      if (before.system_type) {
        throw new Error('System person types cannot be modified');
      }

      const { code, description } = req.body;

      await conn.query(
        `UPDATE estate_person_type SET
           code = COALESCE(?, code),
           description = COALESCE(?, description)
         WHERE id = ?`,
        [code ?? null, description ?? null, id],
      );

      const [updated] = await conn.query('SELECT * FROM estate_person_type WHERE id = ?', [id]);
      const after = (updated as any[])[0];

      await auditUpdate(conn, ENTITY, id, before, after);

      return after;
    });

    if (!row) return res.status(404).json(errorResponse(`Person type with id ${id} not found`));
    return res.json(successResponse(row));
  } catch (err) {
    if (err instanceof Error && err.message === 'System person types cannot be modified') {
      return res.status(400).json(errorResponse(err.message));
    }
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

export default router;
