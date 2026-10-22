import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';


export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, ['SUPERADMIN']);
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }

    const { searchParams } = new URL(req.url);
    const action = searchParams.get('action');
    const entityType = searchParams.get('entity_type');
    const limit = parseInt(searchParams.get('limit') || '100');

    let sql = `
      SELECT al.*, u.username as actor_username
      FROM audit_logs al
      LEFT JOIN users u ON al.actor_user_id = u.id
      WHERE 1=1
    `;
    const params: any[] = [];
    let pIdx = 1;

    if (action) {
      sql += ` AND al.action = $${pIdx}`;
      params.push(action);
      pIdx++;
    }

    if (entityType) {
      sql += ` AND al.entity_type = $${pIdx}`;
      params.push(entityType);
      pIdx++;
    }

    sql += ` ORDER BY al.created_at DESC LIMIT $${pIdx}`;
    params.push(limit);

    const res = await query(sql, params);

    return NextResponse.json({ logs: res.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch audit logs' }, { status: 500 });
  }
}
