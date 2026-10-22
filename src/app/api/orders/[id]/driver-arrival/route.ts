import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { sseManager } from '@/lib/sse';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { driver_name, courier_company, driver_phone } = body;

    const user = await getCurrentUser(req);
    const recordedByType = user ? 'STAFF' : 'DRIVER';
    const recordedByUserId = user ? user.id : null;

    const updatedOrder = await withTransaction(async (client) => {
      // Concurrency lock: row-level lock
      const orderRes = await client.query(
        'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (orderRes.rows.length === 0) {
        throw new Error('Order not found');
      }

      const order = orderRes.rows[0];

      if (order.status === 'SHIP') {
        throw new Error('Cannot register arrival: Order has already been shipped');
      }

      const oldPriority = order.priority_status;
      const arrivalTime = new Date().toISOString();

      // Check or create driver record
      let driverId = order.driver_id;
      if (driver_name) {
        const dRes = await client.query(
          `INSERT INTO drivers (name, phone, courier_company)
           VALUES ($1, $2, $3)
           RETURNING id`,
          [driver_name, driver_phone || null, courier_company || null]
        );
        driverId = dRes.rows[0].id;
      }

      // Update order
      const updateRes = await client.query(
        `UPDATE orders
         SET priority_status = 'DRIVER_WAITING',
             driver_id = COALESCE($1, driver_id),
             driver_arrived_at = COALESCE(driver_arrived_at, $2),
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [driverId, arrivalTime, id]
      );

      // Record driver arrival log
      await client.query(
        `INSERT INTO driver_arrivals (order_id, driver_id, driver_name, courier_company, arrived_at, recorded_by_type, recorded_by_user_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          id,
          driverId,
          driver_name || 'Anonymous Courier',
          courier_company || order.courier_name || null,
          arrivalTime,
          recordedByType,
          recordedByUserId,
        ]
      );

      // Record priority change history
      if (oldPriority !== 'DRIVER_WAITING') {
        await client.query(
          `INSERT INTO order_priority_history (order_id, from_priority, to_priority, changed_by_type, changed_by_user_id, reason)
           VALUES ($1, $2, 'DRIVER_WAITING', $3, $4, $5)`,
          [
            id,
            oldPriority,
            recordedByType,
            recordedByUserId,
            `Driver arrival registered by ${driver_name || 'Courier'}`,
          ]
        );
      }

      // Audit log
      await logAudit({
        actor_type: recordedByType === 'STAFF' ? 'USER' : 'DRIVER',
        actor_user_id: recordedByUserId,
        actor_name: user ? user.name : (driver_name || 'Courier Driver'),
        action: 'DRIVER_ARRIVAL',
        entity_type: 'ORDER',
        entity_id: id,
        old_values: { priority_status: oldPriority },
        new_values: { priority_status: 'DRIVER_WAITING', driver_arrived_at: arrivalTime },
        metadata: { driver_name, courier_company },
        client,
      });

      return updateRes.rows[0];
    });

    // Broadcast SSE
    sseManager.broadcast('driverArrival', updatedOrder);
    sseManager.broadcast('orderUpdate', updatedOrder);
    sseManager.broadcast('priorityUpdate', updatedOrder);

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('Error recording driver arrival:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to record driver arrival' },
      { status: 400 }
    );
  }
}

