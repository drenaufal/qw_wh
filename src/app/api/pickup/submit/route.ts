import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { sseManager } from '@/lib/sse';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { order_id, driver_name, courier_company, photo_base64 } = body;

    if (!order_id) {
      return NextResponse.json({ error: 'Order ID is required' }, { status: 400 });
    }
    if (!driver_name || !driver_name.trim()) {
      return NextResponse.json({ error: 'Driver name is required' }, { status: 400 });
    }
    if (!photo_base64 || !photo_base64.startsWith('data:image/')) {
      return NextResponse.json(
        { error: 'Valid proof of handover camera photo is required' },
        { status: 400 }
      );
    }

    const user = await getCurrentUser(req);
    const submittedByType = user ? 'STAFF' : 'DRIVER';
    const submittedByUserId = user ? user.id : null;

    const result = await withTransaction(async (client) => {
      // Row-level lock to prevent double pickups / simultaneous dispatches
      const orderRes = await client.query(
        'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
        [order_id]
      );

      if (orderRes.rows.length === 0) {
        throw new Error('Order not found');
      }

      const order = orderRes.rows[0];

      if (order.status === 'SHIP') {
        throw new Error(`Order ${order.order_number} has already been picked up and shipped.`);
      }

      if (order.status !== 'READY_FOR_PICKUP') {
        throw new Error(
          `Order ${order.order_number} is currently in '${order.status}' status. Packing must be finished first.`
        );
      }

      const shippedTime = new Date().toISOString();

      // Compute driver wait duration in seconds if driver_arrived_at is set
      let waitDurationSec: number | null = null;
      if (order.driver_arrived_at) {
        const startMs = new Date(order.driver_arrived_at).getTime();
        const endMs = new Date(shippedTime).getTime();
        waitDurationSec = Math.max(0, Math.floor((endMs - startMs) / 1000));
      }

      // Check or create driver
      let driverId = order.driver_id;
      if (driver_name) {
        const driverRes = await client.query(
          `INSERT INTO drivers (name, courier_company)
           VALUES ($1, $2)
           RETURNING id`,
          [driver_name.trim(), courier_company || order.courier_name || null]
        );
        driverId = driverRes.rows[0].id;
      }

      // Update Order to SHIP
      const updatedOrderRes = await client.query(
        `UPDATE orders
         SET status = 'SHIP',
             driver_id = COALESCE($1, driver_id),
             shipped_at = $2,
             driver_wait_duration_seconds = $3,
             updated_at = NOW()
         WHERE id = $4
         RETURNING *`,
        [driverId, shippedTime, waitDurationSec, order_id]
      );

      // Create Pickup Transaction
      const txnRes = await client.query(
        `INSERT INTO pickup_transactions (
          order_id, driver_name, courier_company, picked_up_at,
          submitted_by_type, submitted_by_user_id
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, picked_up_at`,
        [
          order_id,
          driver_name.trim(),
          courier_company || order.courier_name || 'General',
          shippedTime,
          submittedByType,
          submittedByUserId,
        ]
      );

      const txnId = txnRes.rows[0].id;

      // Approximate byte size of base64
      const approxBytes = Math.round((photo_base64.length * 3) / 4);

      // Store Photo
      await client.query(
        `INSERT INTO pickup_photos (
          pickup_transaction_id, storage_key, mime_type, file_size_bytes, captured_at
        ) VALUES ($1, $2, $3, $4, $5)`,
        [txnId, photo_base64, 'image/jpeg', approxBytes, shippedTime]
      );

      // Record Order Status History
      await client.query(
        `INSERT INTO order_status_history (
          order_id, from_status, to_status, changed_by_type, changed_by_user_id, metadata
        ) VALUES ($1, 'READY_FOR_PICKUP', 'SHIP', $2, $3, $4)`,
        [
          order_id,
          submittedByType,
          submittedByUserId,
          JSON.stringify({
            transaction_id: txnId,
            driver_name: driver_name.trim(),
            courier_company,
            wait_duration_seconds: waitDurationSec,
          }),
        ]
      );

      // Audit Log
      await logAudit({
        actor_type: submittedByType === 'STAFF' ? 'USER' : 'DRIVER',
        actor_user_id: submittedByUserId,
        actor_name: user ? user.name : driver_name.trim(),
        action: 'ORDER_PICKUP_HANDOVER',
        entity_type: 'ORDER',
        entity_id: order_id,
        old_values: { status: 'READY_FOR_PICKUP' },
        new_values: {
          status: 'SHIP',
          shipped_at: shippedTime,
          driver_wait_duration_seconds: waitDurationSec,
        },
        metadata: {
          transaction_id: txnId,
          driver_name: driver_name.trim(),
          courier_company,
        },
        client,
      });

      return {
        order: updatedOrderRes.rows[0],
        receipt: {
          transaction_id: `TXN-${txnId.substring(0, 8).toUpperCase()}`,
          order_number: order.order_number,
          driver_name: driver_name.trim(),
          courier_company: courier_company || order.courier_name || 'General',
          shipped_at: shippedTime,
          wait_duration_seconds: waitDurationSec,
        },
      };
    });

    // Real-time broadcast
    sseManager.broadcast('pickupShipped', result);
    sseManager.broadcast('orderUpdate', result.order);

    return NextResponse.json({
      success: true,
      receipt: result.receipt,
      order: result.order,
    });
  } catch (error: any) {
    console.error('Pickup submission error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to submit pickup' },
      { status: 400 }
    );
  }
}

