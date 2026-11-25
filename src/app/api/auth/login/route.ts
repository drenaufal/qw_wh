import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { comparePassword, signToken } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username and password are required' },
        { status: 400 }
      );
    }

    const res = await query(
      `SELECT u.id, u.role_id, r.code as role_code, r.name as role_name, r.permissions as role_permissions,
              u.name, u.username, u.password_hash, u.is_active
       FROM users u
       JOIN roles r ON u.role_id = r.id
       WHERE LOWER(u.username) = LOWER($1)`,
      [username.trim()]
    );

    if (res.rows.length === 0) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    const user = res.rows[0];

    if (!user.is_active) {
      return NextResponse.json(
        { error: 'Account is deactivated. Please contact administrator.' },
        { status: 403 }
      );
    }

    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid username or password' },
        { status: 401 }
      );
    }

    // Update last_login_at
    await query('UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1', [user.id]);

    const token = signToken({
      userId: user.id,
      username: user.username,
      role: user.role_code,
      name: user.name,
    });

    await logAudit({
      actor_type: 'USER',
      actor_user_id: user.id,
      actor_name: user.name,
      action: 'USER_LOGIN',
      entity_type: 'USER',
      entity_id: user.id,
      metadata: { ip: req.headers.get('x-forwarded-for') || 'local' },
    });

    const userResponse = {
      id: user.id,
      role_id: user.role_id,
      role_code: user.role_code,
      role_name: user.role_name,
      role_permissions: user.role_permissions || [],
      name: user.name,
      username: user.username,
    };

    const response = NextResponse.json({
      success: true,
      user: userResponse,
      token,
    });

    // Set HTTP-only cookie for secure browser access
    response.cookies.set('wh_auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error during login' },
      { status: 500 }
    );
  }
}

