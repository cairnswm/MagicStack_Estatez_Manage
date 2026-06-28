import { Router, Request, Response } from 'express';
import { withConnection } from '../utils/db';
import { getTenantId } from '../utils/tenant';
import { errorResponse, successResponse } from '../utils/formatters';
import { auditCreate, auditUpdate } from '../utils/auditService';

const router = Router();
const ENTITY = 'estate_person';

// GET / - list persons with paging and optional search/filter
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required'));

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;
    const search = req.query.search as string | undefined;
    const active = req.query.active !== undefined ? req.query.active === 'true' : undefined;
    const estateId = req.query.estateId ? Number(req.query.estateId) : undefined;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (estateId) {
      conditions.push('estate_id = ?');
      params.push(estateId);
    }
    if (search) {
      conditions.push('(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR mobile LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (active !== undefined) {
      conditions.push('active = ?');
      params.push(active ? 1 : 0);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await withConnection(async (conn) => {
      const [countResult] = await conn.query(`SELECT COUNT(*) AS total FROM estate_person ${where}`, params);
      const totalRows = (countResult as any[])[0].total as number;

      const [rows] = await conn.query(
        `SELECT id, estate_id, first_name, last_name, preferred_name, email, mobile, id_number, passport_number, notes, active, created_at, modified_at
         FROM estate_person ${where} ORDER BY last_name, first_name LIMIT ? OFFSET ?`,
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

// GET /:id - get person by id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required'));

    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json(errorResponse('Invalid id in path'));

    const rows = await withConnection(async (conn) => {
      const [result] = await conn.query(
        `SELECT id, estate_id, first_name, last_name, preferred_name, email, mobile, id_number, passport_number, notes, active, created_at, modified_at
         FROM estate_person WHERE id = ?`,
        [id],
      );
      return result as any[];
    });

    if (rows.length === 0) return res.status(404).json(errorResponse(`Person with id ${id} not found`));
    return res.json(successResponse(rows[0]));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

// POST / - create person
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required'));

    const { estate_id, first_name, last_name, preferred_name, email, mobile, id_number, passport_number, notes } = req.body;
    if (!estate_id) return res.status(400).json(errorResponse('estate_id is required'));
    if (!first_name) return res.status(400).json(errorResponse('first_name is required'));
    if (!last_name) return res.status(400).json(errorResponse('last_name is required'));

    const row = await withConnection(async (conn) => {
      const [result] = await conn.query(
        `INSERT INTO estate_person (estate_id, first_name, last_name, preferred_name, email, mobile, id_number, passport_number, notes, active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [estate_id, first_name, last_name, preferred_name ?? null, email ?? null, mobile ?? null, id_number ?? null, passport_number ?? null, notes ?? null],
      );
      const insertId = (result as any).insertId as number;

      const [rows] = await conn.query('SELECT * FROM estate_person WHERE id = ?', [insertId]);
      const created = (rows as any[])[0];

      await auditCreate(conn, ENTITY, insertId, created);

      return created;
    });

    return res.status(201).json(successResponse(row));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

// PUT /:id - update person
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required'));

    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json(errorResponse('Invalid id in path'));

    const row = await withConnection(async (conn) => {
      const [existing] = await conn.query('SELECT * FROM estate_person WHERE id = ?', [id]);
      if ((existing as any[]).length === 0) return null;
      const before = (existing as any[])[0];

      const { first_name, last_name, preferred_name, email, mobile, id_number, passport_number, notes } = req.body;

      await conn.query(
        `UPDATE estate_person SET
           first_name = COALESCE(?, first_name),
           last_name = COALESCE(?, last_name),
           preferred_name = ?,
           email = ?,
           mobile = ?,
           id_number = ?,
           passport_number = ?,
           notes = ?
         WHERE id = ?`,
        [first_name ?? null, last_name ?? null,
          preferred_name ?? before.preferred_name, email ?? before.email,
          mobile ?? before.mobile, id_number ?? before.id_number,
          passport_number ?? before.passport_number, notes ?? before.notes, id],
      );

      const [updated] = await conn.query('SELECT * FROM estate_person WHERE id = ?', [id]);
      const after = (updated as any[])[0];

      await auditUpdate(conn, ENTITY, id, before, after);

      return after;
    });

    if (!row) return res.status(404).json(errorResponse(`Person with id ${id} not found`));
    return res.json(successResponse(row));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

// PATCH /:id/deactivate
router.patch('/:id/deactivate', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required'));

    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json(errorResponse('Invalid id in path'));

    const reason = req.body?.reason as string | undefined;

    const row = await withConnection(async (conn) => {
      const [existing] = await conn.query('SELECT * FROM estate_person WHERE id = ?', [id]);
      if ((existing as any[]).length === 0) return null;
      const before = (existing as any[])[0];

      await conn.query('UPDATE estate_person SET active = 0 WHERE id = ?', [id]);

      const [updated] = await conn.query('SELECT * FROM estate_person WHERE id = ?', [id]);
      const after = (updated as any[])[0];

      await auditUpdate(conn, ENTITY, id, before, after, undefined, reason);

      return after;
    });

    if (!row) return res.status(404).json(errorResponse(`Person with id ${id} not found`));
    return res.json(successResponse(row));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

// PATCH /:id/activate
router.patch('/:id/activate', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required'));

    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json(errorResponse('Invalid id in path'));

    const reason = req.body?.reason as string | undefined;

    const row = await withConnection(async (conn) => {
      const [existing] = await conn.query('SELECT * FROM estate_person WHERE id = ?', [id]);
      if ((existing as any[]).length === 0) return null;
      const before = (existing as any[])[0];

      await conn.query('UPDATE estate_person SET active = 1 WHERE id = ?', [id]);

      const [updated] = await conn.query('SELECT * FROM estate_person WHERE id = ?', [id]);
      const after = (updated as any[])[0];

      await auditUpdate(conn, ENTITY, id, before, after, undefined, reason);

      return after;
    });

    if (!row) return res.status(404).json(errorResponse(`Person with id ${id} not found`));
    return res.json(successResponse(row));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

export default router;
