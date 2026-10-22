import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, hashPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, ['SUPERADMIN']);
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }
    const { user: currentUser } = auth;
    const { id } = await params;

    const body = await req.json();
    const { is_active, role_code, name, password } = body;

    const existingRes = await query('SELECT * FROM users WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const existing = existingRes.rows[0];

    // Prevent deactivating own account
    if (is_active === false && existing.id === currentUser.id) {
      return NextResponse.json(
        { error: 'Cannot deactivate your own superadmin account' },
        { status: 400 }
      );
    }

    let roleId = existing.role_id;
    if (role_code) {
      const rRes = await query('SELECT id FROM roles WHERE code = $1', [role_code]);
      if (rRes.rows.length > 0) {
        roleId = rRes.rows[0].id;
      }
    }

    let passwordHash = existing.password_hash;
    if (password && password.trim().length >= 6) {
      passwordHash = await hashPassword(password);
    }

    const nextActive = is_active !== undefined ? is_active : existing.is_active;
    const nextName = name ? name.trim() : existing.name;

    const updateRes = await query(
      `UPDATE users
       SET role_id = $1, name = $2, password_hash = $3, is_active = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING id, role_id, name, username, is_active, updated_at`,
      [roleId, nextName, passwordHash, nextActive, id]
    );

    await logAudit({
      actor_type: 'USER',
      actor_user_id: currentUser.id,
      actor_name: currentUser.name,
      action: 'USER_UPDATED',
      entity_type: 'USER',
      entity_id: id,
      old_values: { is_active: existing.is_active, role_id: existing.role_id },
      new_values: { is_active: nextActive, role_id: roleId },
    });

    return NextResponse.json({ success: true, user: updateRes.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update user' }, { status: 500 });
  }
}

