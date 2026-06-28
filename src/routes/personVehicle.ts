import { Router, Request, Response } from 'express';
import { withConnection } from '../utils/db';
import { getTenantId } from '../utils/tenant';
import { errorResponse, successResponse } from '../utils/formatters';
import { auditCreate, auditUpdate } from '../utils/auditService';

const router = Router();
const ENTITY = 'estate_person_vehicle';

// GET / - list person-vehicle associations with paging and optional filter
router.get('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required'));

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;
    const active = req.query.active !== undefined ? req.query.active === 'true' : undefined;
    const personId = req.query.personId ? Number(req.query.personId) : undefined;
    const vehicleId = req.query.vehicleId ? Number(req.query.vehicleId) : undefined;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (personId) {
      conditions.push('person_id = ?');
      params.push(personId);
    }
    if (vehicleId) {
      conditions.push('vehicle_id = ?');
      params.push(vehicleId);
    }
    if (active !== undefined) {
      conditions.push('active = ?');
      params.push(active ? 1 : 0);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const result = await withConnection(async (conn) => {
      const [countResult] = await conn.query(`SELECT COUNT(*) AS total FROM estate_person_vehicle ${where}`, params);
      const totalRows = (countResult as any[])[0].total as number;

      const [rows] = await conn.query(
        `SELECT id, person_id, vehicle_id, primary_vehicle, start_date, end_date, active, created_at, modified_at
         FROM estate_person_vehicle ${where} ORDER BY person_id, vehicle_id LIMIT ? OFFSET ?`,
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

// GET /:id - get person-vehicle association by id
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required'));

    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json(errorResponse('Invalid id in path'));

    const rows = await withConnection(async (conn) => {
      const [result] = await conn.query(
        `SELECT id, person_id, vehicle_id, primary_vehicle, start_date, end_date, active, created_at, modified_at
         FROM estate_person_vehicle WHERE id = ?`,
        [id],
      );
      return result as any[];
    });

    if (rows.length === 0) return res.status(404).json(errorResponse(`Person-vehicle association with id ${id} not found`));
    return res.json(successResponse(rows[0]));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

// POST / - create person-vehicle association
router.post('/', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required'));

    const { person_id, vehicle_id, primary_vehicle, start_date, end_date } = req.body;
    if (!person_id) return res.status(400).json(errorResponse('person_id is required'));
    if (!vehicle_id) return res.status(400).json(errorResponse('vehicle_id is required'));

    const row = await withConnection(async (conn) => {
      const [result] = await conn.query(
        `INSERT INTO estate_person_vehicle (person_id, vehicle_id, primary_vehicle, start_date, end_date, active)
         VALUES (?, ?, ?, ?, ?, 1)`,
        [person_id, vehicle_id, primary_vehicle ? 1 : 0, start_date ?? null, end_date ?? null],
      );
      const insertId = (result as any).insertId as number;

      const [rows] = await conn.query('SELECT * FROM estate_person_vehicle WHERE id = ?', [insertId]);
      const created = (rows as any[])[0];

      await auditCreate(conn, ENTITY, insertId, created);

      return created;
    });

    return res.status(201).json(successResponse(row));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

// PUT /:id - update person-vehicle association
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required'));

    const id = Number(req.params.id);
    if (!id || isNaN(id)) return res.status(400).json(errorResponse('Invalid id in path'));

    const row = await withConnection(async (conn) => {
      const [existing] = await conn.query('SELECT * FROM estate_person_vehicle WHERE id = ?', [id]);
      if ((existing as any[]).length === 0) return null;
      const before = (existing as any[])[0];

      const { primary_vehicle, start_date, end_date } = req.body;

      await conn.query(
        `UPDATE estate_person_vehicle SET
           primary_vehicle = COALESCE(?, primary_vehicle),
           start_date = ?,
           end_date = ?
         WHERE id = ?`,
        [primary_vehicle !== undefined ? (primary_vehicle ? 1 : 0) : null,
          start_date ?? before.start_date, end_date ?? before.end_date, id],
      );

      const [updated] = await conn.query('SELECT * FROM estate_person_vehicle WHERE id = ?', [id]);
      const after = (updated as any[])[0];

      await auditUpdate(conn, ENTITY, id, before, after);

      return after;
    });

    if (!row) return res.status(404).json(errorResponse(`Person-vehicle association with id ${id} not found`));
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
      const [existing] = await conn.query('SELECT * FROM estate_person_vehicle WHERE id = ?', [id]);
      if ((existing as any[]).length === 0) return null;
      const before = (existing as any[])[0];

      await conn.query('UPDATE estate_person_vehicle SET active = 0 WHERE id = ?', [id]);

      const [updated] = await conn.query('SELECT * FROM estate_person_vehicle WHERE id = ?', [id]);
      const after = (updated as any[])[0];

      await auditUpdate(conn, ENTITY, id, before, after, undefined, reason);

      return after;
    });

    if (!row) return res.status(404).json(errorResponse(`Person-vehicle association with id ${id} not found`));
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
      const [existing] = await conn.query('SELECT * FROM estate_person_vehicle WHERE id = ?', [id]);
      if ((existing as any[]).length === 0) return null;
      const before = (existing as any[])[0];

      await conn.query('UPDATE estate_person_vehicle SET active = 1 WHERE id = ?', [id]);

      const [updated] = await conn.query('SELECT * FROM estate_person_vehicle WHERE id = ?', [id]);
      const after = (updated as any[])[0];

      await auditUpdate(conn, ENTITY, id, before, after, undefined, reason);

      return after;
    });

    if (!row) return res.status(404).json(errorResponse(`Person-vehicle association with id ${id} not found`));
    return res.json(successResponse(row));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

export default router;
