import { Router, Request, Response } from 'express';
import { withConnection } from '../utils/db';
import { errorResponse, successResponse } from '../utils/formatters';
import { getTenantId } from '../utils/tenant';

const router = Router();

// GET /audit/events - get operational audit events
// Query params: estateId, eventType, severity, fromDate, toDate, page, pageSize
router.get('/events', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required (header X-Tenant-ID or query ?tenantId=)'));

    const estateId = req.query.estateId ? Number(req.query.estateId) : undefined;
    const eventType = req.query.eventType as string | undefined;
    const severity = req.query.severity as string | undefined;
    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const offset = (page - 1) * pageSize;

    const conditions: string[] = [];
    const params: unknown[] = [];

    if (estateId) {
      conditions.push('estate_id = ?');
      params.push(estateId);
    }
    if (eventType) {
      conditions.push('event_type = ?');
      params.push(eventType);
    }
    if (severity) {
      conditions.push('severity = ?');
      params.push(severity);
    }
    if (fromDate) {
      conditions.push('created_at >= ?');
      params.push(fromDate);
    }
    if (toDate) {
      conditions.push('created_at <= ?');
      params.push(toDate);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const rows = await withConnection(async (conn) => {
      const [countResult] = await conn.query(
        `SELECT COUNT(*) AS total FROM audit_event ${where}`,
        params,
      );
      const totalRows = (countResult as any[])[0].total as number;

      const [dataRows] = await conn.query(
        `SELECT id, estate_id, user_id, event_type, entity_name, record_id, severity, description, ip_address, user_agent, created_at
         FROM audit_event ${where}
         ORDER BY created_at DESC
         LIMIT ? OFFSET ?`,
        [...params, pageSize, offset],
      );

      return { totalRows, dataRows: dataRows as any[] };
    });

    const totalPages = Math.ceil(rows.totalRows / pageSize);

    return res.json(successResponse({
      rows: rows.dataRows,
      page,
      pageSize,
      totalRows: rows.totalRows,
      totalPages,
    }));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

// GET /audit/:entityName/:recordId - get audit change history for a specific entity record
router.get('/:entityName/:recordId', async (req: Request, res: Response) => {
  try {
    const tenantId = getTenantId(req);
    if (!tenantId) return res.status(400).json(errorResponse('Tenant id is required (header X-Tenant-ID or query ?tenantId=)'));

    const entityName = req.params.entityName as string;
    const recordId = Number(req.params.recordId);

    if (!entityName) return res.status(400).json(errorResponse('entityName is required in path'));
    if (!recordId || isNaN(recordId)) return res.status(400).json(errorResponse('recordId must be a valid number'));

    const results = await withConnection(async (conn) => {
      const [entityRows] = await conn.query(
        'SELECT id FROM audit_entity WHERE entity_name = ?',
        [entityName],
      );

      if ((entityRows as any[]).length === 0) {
        return [];
      }

      const entityId = (entityRows as any[])[0].id as number;

      const [changeRows] = await conn.query(
        `SELECT c.id, ae.entity_name, c.record_id, c.action, c.changed_by_user_id, c.changed_at, c.reason
         FROM audit_change c
         JOIN audit_entity ae ON ae.id = c.entity_id
         WHERE c.entity_id = ? AND c.record_id = ?
         ORDER BY c.changed_at DESC`,
        [entityId, recordId],
      );

      const changes = changeRows as any[];
      if (changes.length === 0) return [];

      const changeIds = changes.map((c: any) => c.id);
      const [fieldRows] = await conn.query(
        `SELECT change_id, field_name, old_value, new_value
         FROM audit_change_field
         WHERE change_id IN (?)
         ORDER BY change_id, field_name`,
        [changeIds],
      );

      const fieldsByChangeId = new Map<number, any[]>();
      for (const field of fieldRows as any[]) {
        const list = fieldsByChangeId.get(field.change_id) ?? [];
        list.push({ fieldName: field.field_name, oldValue: field.old_value, newValue: field.new_value });
        fieldsByChangeId.set(field.change_id, list);
      }

      return changes.map((c: any) => ({
        id: c.id,
        entityName: c.entity_name,
        recordId: c.record_id,
        action: c.action,
        changedByUserId: c.changed_by_user_id,
        changedAt: c.changed_at,
        reason: c.reason,
        fields: fieldsByChangeId.get(c.id) ?? [],
      }));
    });

    return res.json(successResponse(results));
  } catch (err) {
    return res.status(500).json(errorResponse(err instanceof Error ? err.message : 'Unknown error'));
  }
});

export default router;
