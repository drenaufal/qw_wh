import { NextResponse } from 'next/server';
import { query } from '@/lib/db';


export async function GET() {
  try {
    const res = await query('SELECT id, code, name FROM roles ORDER BY name ASC');
    return NextResponse.json({ roles: res.rows });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch roles' }, { status: 500 });
  }
}
