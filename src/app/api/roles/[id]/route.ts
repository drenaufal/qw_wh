import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { AVAILABLE_MENUS } from '@/lib/constants/menus';

const SYSTEM_ROLES = ['SUPERADMIN', 'PACKER', 'PICKUP_ADMIN'];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, ['SUPERADMIN'], '/users');
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }
    const { user: currentUser } = auth;
    const { id } = await params;

    const roleRes = await query('SELECT * FROM roles WHERE id = $1', [id]);
    if (roleRes.rows.length === 0) {
      return NextResponse.json({ error: 'Role tidak ditemukan' }, { status: 404 });
    }
    const role = roleRes.rows[0];

    const body = await req.json();
    const { name, permissions } = body;

    let updatedName = role.name;
    if (name && typeof name === 'string' && name.trim()) {
      updatedName = name.trim();
    }

    let updatedPermissions = role.permissions;
    if (Array.isArray(permissions)) {
      if (role.code === 'SUPERADMIN') {
        // SUPERADMIN always retains access to all menus
        updatedPermissions = AVAILABLE_MENUS.map((m) => m.path);
      } else {
        updatedPermissions = permissions;
      }
    }

    const updateRes = await query(
      `UPDATE roles
       SET name = $1,
           permissions = $2::jsonb,
           updated_at = NOW()
       WHERE id = $3
       RETURNING id, code, name, permissions, created_at, updated_at`,
      [updatedName, JSON.stringify(updatedPermissions), id]
    );

    const updatedRole = updateRes.rows[0];

    await logAudit({
      actor_type: 'USER',
      actor_user_id: currentUser.id,
      actor_name: currentUser.name,
      action: 'ROLE_UPDATE',
      entity_type: 'ROLE',
      entity_id: id,
      metadata: { code: role.code, name: updatedName, permissions: updatedPermissions },
    });

    return NextResponse.json({ success: true, role: updatedRole });
  } catch (error: any) {
    console.error('Failed to update role:', error);
    return NextResponse.json({ error: error.message || 'Failed to update role' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, ['SUPERADMIN'], '/users');
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }
    const { user: currentUser } = auth;
    const { id } = await params;

    const roleRes = await query('SELECT * FROM roles WHERE id = $1', [id]);
    if (roleRes.rows.length === 0) {
      return NextResponse.json({ error: 'Role tidak ditemukan' }, { status: 404 });
    }
    const role = roleRes.rows[0];

    // Protect system base roles
    if (SYSTEM_ROLES.includes(role.code)) {
      return NextResponse.json(
        { error: `Role bawaan sistem (${role.name}) dilindungi dan tidak dapat dihapus.` },
        { status: 400 }
      );
    }

    // Check if any users are assigned to this role
    const userCountRes = await query(
      'SELECT COUNT(*)::int as count FROM users WHERE role_id = $1',
      [id]
    );
    const assignedCount = userCountRes.rows[0]?.count || 0;
    if (assignedCount > 0) {
      return NextResponse.json(
        {
          error: `Role "${role.name}" sedang digunakan oleh ${assignedCount} staf. Pindahkan staf ke peran lain sebelum menghapus role ini.`,
        },
        { status: 400 }
      );
    }

    await query('DELETE FROM roles WHERE id = $1', [id]);

    await logAudit({
      actor_type: 'USER',
      actor_user_id: currentUser.id,
      actor_name: currentUser.name,
      action: 'ROLE_DELETE',
      entity_type: 'ROLE',
      entity_id: id,
      metadata: { code: role.code, name: role.name },
    });

    return NextResponse.json({ success: true, message: `Role "${role.name}" berhasil dihapus.` });
  } catch (error: any) {
    console.error('Failed to delete role:', error);
    return NextResponse.json({ error: error.message || 'Failed to delete role' }, { status: 500 });
  }
}
