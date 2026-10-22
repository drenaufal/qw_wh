import { NextResponse } from 'next/server';
import { query } from '@/lib/db';


export async function GET() {
  try {
    const statsQuery = `
      SELECT
        COUNT(*) as total_orders_all,
        COUNT(*) FILTER (WHERE DATE(created_at AT TIME ZONE 'Asia/Jakarta') = CURRENT_DATE) as total_orders_today,
        COUNT(*) FILTER (WHERE status = 'WAITING') as waiting_count,
        COUNT(*) FILTER (WHERE status = 'PACKING') as packing_count,
        COUNT(*) FILTER (WHERE status = 'READY_FOR_PICKUP') as ready_count,
        COUNT(*) FILTER (WHERE status = 'SHIP') as shipped_count,
        COUNT(*) FILTER (WHERE priority_status = 'DRIVER_WAITING' AND status != 'SHIP') as driver_waiting_count,
        COALESCE(AVG(packing_duration_seconds) FILTER (WHERE packing_duration_seconds IS NOT NULL), 0) as avg_packing_duration,
        COALESCE(AVG(driver_wait_duration_seconds) FILTER (WHERE driver_wait_duration_seconds IS NOT NULL), 0) as avg_wait_duration
      FROM orders;
    `;

    const res = await query(statsQuery);
    const raw = res.rows[0];

    const stats = {
      total_orders_today: parseInt(raw.total_orders_today || '0'),
      total_orders_all: parseInt(raw.total_orders_all || '0'),
      waiting_count: parseInt(raw.waiting_count || '0'),
      packing_count: parseInt(raw.packing_count || '0'),
      ready_count: parseInt(raw.ready_count || '0'),
      shipped_count: parseInt(raw.shipped_count || '0'),
      driver_waiting_count: parseInt(raw.driver_waiting_count || '0'),
      avg_packing_duration: Math.round(parseFloat(raw.avg_packing_duration || '0')),
      avg_wait_duration: Math.round(parseFloat(raw.avg_wait_duration || '0')),
    };

    return NextResponse.json({ stats });
  } catch (error: any) {
    console.error('Stats query error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch dashboard stats' },
      { status: 500 }
    );
  }
}
