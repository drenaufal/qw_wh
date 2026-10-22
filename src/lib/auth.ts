import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { query } from './db';
import { User, UserRole } from './types';

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-jwt-key-warehouse-queue-2026-min-32-chars';

export interface TokenPayload {
  userId: string;
  username: string;
  role: UserRole;
  name: string;
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch {
    return null;
  }
}

export async function getCurrentUser(req: NextRequest): Promise<User | null> {
  // Read from Authorization header or cookie
  let token: string | undefined;

  const authHeader = req.headers.get('Authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else {
    token = req.cookies.get('wh_auth_token')?.value;
  }

  if (!token) return null;

  const decoded = verifyToken(token);
  if (!decoded) return null;

  const res = await query<User>(
    `SELECT u.id, u.role_id, r.code as role_code, r.name as role_name,
            u.name, u.username, u.is_active, u.last_login_at, u.created_at, u.updated_at
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.id = $1 AND u.is_active = true`,
    [decoded.userId]
  );

  if (res.rows.length === 0) return null;
  return res.rows[0];
}

export async function authenticateRequest(
  req: NextRequest,
  allowedRoles?: UserRole[]
): Promise<{ user: User } | { errorResponse: NextResponse }> {
  const user = await getCurrentUser(req);

  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Unauthorized: Authentication required' },
        { status: 401 }
      ),
    };
  }

  if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role_code)) {
    return {
      errorResponse: NextResponse.json(
        { error: 'Forbidden: Insufficient permissions for this action' },
        { status: 403 }
      ),
    };
  }

  return { user };
}

