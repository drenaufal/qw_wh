import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, ['SUPERADMIN'], '/users');
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }

    const res = await query(
      `SELECT r.id, r.code, r.name, r.permissions, r.created_at, r.updated_at,
              COUNT(u.id)::int as user_count
       FROM roles r
       LEFT JOIN users u ON u.role_id = r.id
       GROUP BY r.id, r.code, r.name, r.permissions, r.created_at, r.updated_at
       ORDER BY 
         CASE WHEN r.code = 'SUPERADMIN' THEN 1 
              WHEN r.code = 'PACKER' THEN 2 
              WHEN r.code = 'PICKUP_ADMIN' THEN 3 
              ELSE 4 
         END,
         r.created_at ASC`
    );

    return NextResponse.json({ roles: res.rows });
  } catch (error: any) {
    console.error('Failed to fetch roles:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch roles' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, ['SUPERADMIN'], '/users');
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }
    const { user: currentUser } = auth;

    const body = await req.json();
    const { name, code, permissions } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Nama peran wajib diisi' }, { status: 400 });
    }

    if (!code || typeof code !== 'string' || !code.trim()) {
      return NextResponse.json({ error: 'Kode peran wajib diisi' }, { status: 400 });
    }

    const sanitizedCode = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
    if (sanitizedCode.length < 2) {
      return NextResponse.json({ error: 'Kode peran minimal 2 karakter (huruf/angka)' }, { status: 400 });
    }

    // Check duplicate code
    const existing = await query('SELECT id FROM roles WHERE UPPER(code) = UPPER($1)', [sanitizedCode]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: `Kode peran "${sanitizedCode}" sudah digunakan` }, { status: 400 });
    }

    const safePermissions = Array.isArray(permissions) ? permissions : [];

    const insertRes = await query(
      `INSERT INTO roles (code, name, permissions)
       VALUES ($1, $2, $3::jsonb)
       RETURNING id, code, name, permissions, created_at, updated_at`,
      [sanitizedCode, name.trim(), JSON.stringify(safePermissions)]
    );

    const newRole = insertRes.rows[0];

    await logAudit({
      actor_type: 'USER',
      actor_user_id: currentUser.id,
      actor_name: currentUser.name,
      action: 'ROLE_CREATE',
      entity_type: 'ROLE',
      entity_id: newRole.id,
      metadata: { code: sanitizedCode, name: name.trim(), permissions: safePermissions },
    });

    return NextResponse.json({
      success: true,
      role: { ...newRole, user_count: 0 },
    }, { status: 201 });
  } catch (error: any) {
    console.error('Failed to create role:', error);
    return NextResponse.json({ error: error.message || 'Failed to create role' }, { status: 500 });
  }
}
