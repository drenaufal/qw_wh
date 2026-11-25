import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest, hashPassword } from '@/lib/auth';
import { logAudit } from '@/lib/audit';


export async function GET(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, ['SUPERADMIN']);
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }

    const res = await query(
      `SELECT u.id, u.role_id, r.code as role_code, r.name as role_name, r.permissions as role_permissions,
              u.name, u.username, u.is_active, u.last_login_at, u.created_at, u.updated_at
       FROM users u
       JOIN roles r ON u.role_id = r.id
       ORDER BY u.created_at DESC`
    );

    return NextResponse.json({ users: res.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authenticateRequest(req, ['SUPERADMIN']);
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }
    const { user: currentUser } = auth;

    const body = await req.json();
    const { name, username, password, role_code } = body;

    if (!name || !username || !password || !role_code) {
      return NextResponse.json(
        { error: 'Name, username, password, and role are required' },
        { status: 400 }
      );
    }

    // Find role
    const roleRes = await query('SELECT id FROM roles WHERE code = $1', [role_code]);
    if (roleRes.rows.length === 0) {
      return NextResponse.json({ error: 'Invalid role code' }, { status: 400 });
    }
    const roleId = roleRes.rows[0].id;

    // Check duplicate username
    const existRes = await query('SELECT id FROM users WHERE LOWER(username) = LOWER($1)', [username.trim()]);
    if (existRes.rows.length > 0) {
      return NextResponse.json({ error: 'Username already taken' }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const insertRes = await query(
      `INSERT INTO users (role_id, name, username, password_hash, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, role_id, name, username, is_active, created_at, updated_at`,
      [roleId, name.trim(), username.trim().toLowerCase(), passwordHash]
    );

    const newUser = insertRes.rows[0];

    await logAudit({
      actor_type: 'USER',
      actor_user_id: currentUser.id,
      actor_name: currentUser.name,
      action: 'USER_CREATED',
      entity_type: 'USER',
      entity_id: newUser.id,
      new_values: { username: newUser.username, name: newUser.name, role_code },
    });

    return NextResponse.json(
      { success: true, user: { ...newUser, role_code } },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to create user' }, { status: 500 });
  }
}
