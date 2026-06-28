import { withConnection } from './db';

const IGNORED_FIELDS = new Set([
  'created_at',
  'modified_at',
  'createdAt',
  'modifiedAt',
]);

async function getOrCreateEntityId(conn: any, entityName: string): Promise<number> {
  const [rows] = await conn.query(
    'SELECT id FROM audit_entity WHERE entity_name = ?',
    [entityName],
  );
  if ((rows as any[]).length > 0) return (rows as any[])[0].id as number;

  const [result] = await conn.query(
    'INSERT INTO audit_entity (entity_name) VALUES (?)',
    [entityName],
  );
  return (result as any).insertId as number;
}

async function insertChange(
  conn: any,
  entityId: number,
  recordId: number,
  action: string,
  userId?: number,
  reason?: string,
): Promise<number> {
  const [result] = await conn.query(
    'INSERT INTO audit_change (entity_id, record_id, action, changed_by_user_id, reason) VALUES (?, ?, ?, ?, ?)',
    [entityId, recordId, action, userId ?? null, reason ?? null],
  );
  return (result as any).insertId as number;
}

async function insertFieldChange(
  conn: any,
  changeId: number,
  fieldName: string,
  oldValue: string | null,
  newValue: string | null,
): Promise<void> {
  await conn.query(
    'INSERT INTO audit_change_field (change_id, field_name, old_value, new_value) VALUES (?, ?, ?, ?)',
    [changeId, fieldName, oldValue, newValue],
  );
}

function valueToString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export async function auditCreate(
  conn: any,
  entityName: string,
  recordId: number,
  data: Record<string, unknown>,
  userId?: number,
  reason?: string,
): Promise<void> {
  const entityId = await getOrCreateEntityId(conn, entityName);
  const changeId = await insertChange(conn, entityId, recordId, 'CREATE', userId, reason);

  for (const [key, value] of Object.entries(data)) {
    if (IGNORED_FIELDS.has(key)) continue;
    const strVal = valueToString(value);
    if (strVal !== null) {
      await insertFieldChange(conn, changeId, key, null, strVal);
    }
  }
}

export async function auditUpdate(
  conn: any,
  entityName: string,
  recordId: number,
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  userId?: number,
  reason?: string,
): Promise<void> {
  const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changedFields: Array<{ key: string; oldVal: string | null; newVal: string | null }> = [];

  for (const key of allKeys) {
    if (IGNORED_FIELDS.has(key)) continue;
    const oldVal = valueToString(before[key]);
    const newVal = valueToString(after[key]);
    if (oldVal !== newVal) {
      changedFields.push({ key, oldVal, newVal });
    }
  }

  if (changedFields.length === 0) return;

  const entityId = await getOrCreateEntityId(conn, entityName);
  const changeId = await insertChange(conn, entityId, recordId, 'UPDATE', userId, reason);

  for (const { key, oldVal, newVal } of changedFields) {
    await insertFieldChange(conn, changeId, key, oldVal, newVal);
  }
}

export async function auditDelete(
  conn: any,
  entityName: string,
  recordId: number,
  before: Record<string, unknown>,
  userId?: number,
  reason?: string,
): Promise<void> {
  const entityId = await getOrCreateEntityId(conn, entityName);
  const changeId = await insertChange(conn, entityId, recordId, 'DELETE', userId, reason);

  for (const [key, value] of Object.entries(before)) {
    if (IGNORED_FIELDS.has(key)) continue;
    const strVal = valueToString(value);
    await insertFieldChange(conn, changeId, key, strVal, null);
  }
}

export type AuditEventSeverity = 'INFO' | 'WARNING' | 'ERROR' | 'SECURITY' | 'CRITICAL';

export interface AuditEventOptions {
  estateId?: number;
  userId?: number;
  entityName?: string;
  recordId?: number;
  ipAddress?: string;
  userAgent?: string;
}

export async function auditEvent(
  eventType: string,
  severity: AuditEventSeverity,
  description: string,
  options: AuditEventOptions = {},
): Promise<void> {
  await withConnection(async (conn) => {
    await conn.query(
      `INSERT INTO audit_event
         (estate_id, user_id, event_type, entity_name, record_id, severity, description, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        options.estateId ?? null,
        options.userId ?? null,
        eventType,
        options.entityName ?? null,
        options.recordId ?? null,
        severity,
        description,
        options.ipAddress ?? null,
        options.userAgent ?? null,
      ],
    );
  });
}

export default { auditCreate, auditUpdate, auditDelete, auditEvent };
