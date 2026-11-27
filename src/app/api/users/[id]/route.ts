import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { authenticateRequest, hashPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

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

    const body = await req.json();
    const { is_active, role_code, name, password } = body;

    const existingRes = await query(
      `SELECT u.*, r.code as current_role_code
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [id]
    );
    if (existingRes.rows.length === 0) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }
    const existing = existingRes.rows[0];

    // Prevent deactivating own account
    if (is_active === false && existing.id === currentUser.id) {
      return NextResponse.json(
        { error: 'Tidak dapat menonaktifkan akun Anda sendiri yang sedang login.' },
        { status: 400 }
      );
    }

    let roleId = existing.role_id;
    let nextRoleCode = existing.current_role_code;
    if (role_code && role_code !== existing.current_role_code) {
      // Prevent demoting the last active SUPERADMIN
      if (existing.current_role_code === 'SUPERADMIN') {
        const otherSuperRes = await query(
          `SELECT COUNT(*)::int as count
           FROM users u
           JOIN roles r ON u.role_id = r.id
           WHERE r.code = 'SUPERADMIN' AND u.is_active = true AND u.id != $1`,
          [id]
        );
        if ((otherSuperRes.rows[0]?.count || 0) === 0) {
          return NextResponse.json(
            { error: 'Tidak dapat mengubah peran SUPERADMIN aktif terakhir agar sistem tidak terkunci.' },
            { status: 400 }
          );
        }
      }

      const rRes = await query('SELECT id, code FROM roles WHERE code = $1', [role_code]);
      if (rRes.rows.length === 0) {
        return NextResponse.json({ error: 'Kode peran tidak valid' }, { status: 400 });
      }
      roleId = rRes.rows[0].id;
      nextRoleCode = rRes.rows[0].code;
    }

    let passwordHash = existing.password_hash;
    if (password !== undefined && password !== null && String(password).trim() !== '') {
      const trimmedPwd = String(password).trim();
      if (trimmedPwd.length < 6) {
        return NextResponse.json(
          { error: 'Password baru minimal harus 6 karakter' },
          { status: 400 }
        );
      }
      passwordHash = await hashPassword(trimmedPwd);
    }

    const nextActive = is_active !== undefined ? is_active : existing.is_active;
    const nextName = name && String(name).trim() ? String(name).trim() : existing.name;

    await query(
      `UPDATE users
       SET role_id = $1, name = $2, password_hash = $3, is_active = $4, updated_at = NOW()
       WHERE id = $5`,
      [roleId, nextName, passwordHash, nextActive, id]
    );

    const updatedUserRes = await query(
      `SELECT u.id, u.role_id, r.code as role_code, r.name as role_name, r.permissions as role_permissions,
              u.name, u.username, u.is_active, u.last_login_at, u.created_at, u.updated_at
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [id]
    );

    await logAudit({
      actor_type: 'USER',
      actor_user_id: currentUser.id,
      actor_name: currentUser.name,
      action: 'USER_UPDATED',
      entity_type: 'USER',
      entity_id: id,
      old_values: {
        name: existing.name,
        is_active: existing.is_active,
        role_id: existing.role_id,
        role_code: existing.current_role_code,
      },
      new_values: {
        name: nextName,
        is_active: nextActive,
        role_id: roleId,
        role_code: nextRoleCode,
        password_changed: passwordHash !== existing.password_hash,
      },
    });

    return NextResponse.json({ success: true, user: updatedUserRes.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Gagal memperbarui pengguna' }, { status: 500 });
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

    const existingRes = await query(
      `SELECT u.id, u.name, u.username, u.role_id, u.is_active, r.code as role_code
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE u.id = $1`,
      [id]
    );

    if (existingRes.rows.length === 0) {
      return NextResponse.json({ error: 'Pengguna tidak ditemukan' }, { status: 404 });
    }
    const targetUser = existingRes.rows[0];

    // Prevent deleting own account
    if (targetUser.id === currentUser.id) {
      return NextResponse.json(
        { error: 'Tidak dapat menghapus akun Anda sendiri yang sedang login.' },
        { status: 400 }
      );
    }

    // Prevent deleting the last active SUPERADMIN
    if (targetUser.role_code === 'SUPERADMIN') {
      const otherSuperRes = await query(
        `SELECT COUNT(*)::int as count
         FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE r.code = 'SUPERADMIN' AND u.is_active = true AND u.id != $1`,
        [id]
      );
      if ((otherSuperRes.rows[0]?.count || 0) === 0) {
        return NextResponse.json(
          { error: 'Tidak dapat menghapus akun SUPERADMIN aktif terakhir.' },
          { status: 400 }
        );
      }
    }

    await withTransaction(async (client) => {
      // Unlink historical user FK references safely while preserving order/audit history
      await client.query(`UPDATE driver_arrivals SET recorded_by_user_id = NULL WHERE recorded_by_user_id = $1`, [id]);
      await client.query(`UPDATE packing_sessions SET packer_id = NULL WHERE packer_id = $1`, [id]);
      await client.query(`UPDATE pickup_transactions SET submitted_by_user_id = NULL WHERE submitted_by_user_id = $1`, [id]);
      await client.query(`UPDATE order_status_history SET changed_by_user_id = NULL WHERE changed_by_user_id = $1`, [id]);
      await client.query(`UPDATE order_priority_history SET changed_by_user_id = NULL WHERE changed_by_user_id = $1`, [id]);
      await client.query(`UPDATE audit_logs SET actor_user_id = NULL WHERE actor_user_id = $1`, [id]);
      await client.query(`UPDATE system_settings SET updated_by = NULL WHERE updated_by = $1`, [id]);

      await client.query(`DELETE FROM users WHERE id = $1`, [id]);
    });

    await logAudit({
      actor_type: 'USER',
      actor_user_id: currentUser.id,
      actor_name: currentUser.name,
      action: 'USER_DELETED',
      entity_type: 'USER',
      entity_id: id,
      old_values: {
        username: targetUser.username,
        name: targetUser.name,
        role_id: targetUser.role_id,
        role_code: targetUser.role_code,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Akun @${targetUser.username} berhasil dihapus.`,
    });
  } catch (error: any) {
    console.error('Failed to delete user:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal menghapus pengguna' },
      { status: 500 }
    );
  }
}
