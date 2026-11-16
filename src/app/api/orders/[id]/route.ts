import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';


export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const orderRes = await query(
      `SELECT o.*, d.name as driver_name, d.phone as driver_phone
       FROM orders o
       LEFT JOIN drivers d ON o.driver_id = d.id
       WHERE o.id = $1`,
      [id]
    );

    if (orderRes.rows.length === 0) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }

    const order = orderRes.rows[0];

    // Fetch items
    const itemsRes = await query(
      `SELECT * FROM order_items WHERE order_id = $1 ORDER BY line_no ASC NULLS LAST, created_at ASC`,
      [id]
    );

    // Fetch status history
    const statusHistoryRes = await query(
      `SELECT osh.*, u.name as user_name 
       FROM order_status_history osh
       LEFT JOIN users u ON osh.changed_by_user_id = u.id
       WHERE osh.order_id = $1 
       ORDER BY osh.changed_at ASC`,
      [id]
    );

    // Fetch driver arrivals
    const arrivalsRes = await query(
      `SELECT * FROM driver_arrivals WHERE order_id = $1 ORDER BY arrived_at ASC`,
      [id]
    );

    // Fetch packing sessions & items
    const packingRes = await query(
      `SELECT ps.*, u.name as packer_name
       FROM packing_sessions ps
       LEFT JOIN users u ON ps.packer_id = u.id
       WHERE ps.order_id = $1
       ORDER BY ps.started_at DESC`,
      [id]
    );

    // Fetch pickup transaction and photo
    const pickupRes = await query(
      `SELECT pt.*, pp.storage_key, pp.captured_at
       FROM pickup_transactions pt
       LEFT JOIN pickup_photos pp ON pp.pickup_transaction_id = pt.id
       WHERE pt.order_id = $1
       LIMIT 1`,
      [id]
    );

    return NextResponse.json({
      order: {
        ...order,
        items: itemsRes.rows,
        status_history: statusHistoryRes.rows,
        driver_arrivals: arrivalsRes.rows,
        packing_sessions: packingRes.rows,
        pickup_transaction: pickupRes.rows[0] || null,
      },
    });
  } catch (error: any) {
    console.error('Error fetching order detail:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch order detail' },
      { status: 500 }
    );
  }
}
