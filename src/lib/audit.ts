import { PoolClient } from 'pg';
import { query } from './db';

export interface AuditParams {
  actor_type: 'SYSTEM' | 'USER' | 'DRIVER';
  actor_user_id?: string | null;
  actor_name?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_values?: any;
  new_values?: any;
  metadata?: any;
  client?: PoolClient; // optional client if within a transaction
}

export async function logAudit({
  actor_type,
  actor_user_id = null,
  actor_name = null,
  action,
  entity_type,
  entity_id = null,
  old_values = null,
  new_values = null,
  metadata = null,
  client,
}: AuditParams) {
  const sql = `
    INSERT INTO audit_logs (
      actor_type, actor_user_id, actor_name, action,
      entity_type, entity_id, old_values, new_values, metadata
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
  `;

  const values = [
    actor_type,
    actor_user_id,
    actor_name,
    action,
    entity_type,
    entity_id,
    old_values ? JSON.stringify(old_values) : null,
    new_values ? JSON.stringify(new_values) : null,
    metadata ? JSON.stringify(metadata) : null,
  ];

  if (client) {
    await client.query(sql, values);
  } else {
    await query(sql, values);
  }
}

