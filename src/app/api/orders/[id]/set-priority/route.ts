import { NextRequest, NextResponse } from 'next/server';
import { withTransaction } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { sseManager } from '@/lib/sse';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await authenticateRequest(req, ['PICKUP_ADMIN', 'SUPERADMIN']);
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }
    const { user } = auth;
    const { id } = await params;
    const body = await req.json();
    const { priority, reason } = body;

    if (!['NORMAL', 'DRIVER_WAITING'].includes(priority)) {
      return NextResponse.json(
        { error: 'Invalid priority. Must be NORMAL or DRIVER_WAITING.' },
        { status: 400 }
      );
    }

    const updatedOrder = await withTransaction(async (client) => {
      const orderRes = await client.query(
        'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (orderRes.rows.length === 0) {
        throw new Error('Order not found');
      }

      const order = orderRes.rows[0];
      const oldPriority = order.priority_status;

      let arrivalTime = order.driver_arrived_at;
      if (priority === 'DRIVER_WAITING' && !arrivalTime) {
        arrivalTime = new Date().toISOString();
      } else if (priority === 'NORMAL') {
        arrivalTime = null;
      }

      const updateRes = await client.query(
        `UPDATE orders
         SET priority_status = $1,
             driver_arrived_at = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [priority, arrivalTime, id]
      );

      // Priority history
      await client.query(
        `INSERT INTO order_priority_history (order_id, from_priority, to_priority, changed_by_type, changed_by_user_id, reason)
         VALUES ($1, $2, $3, 'USER', $4, $5)`,
        [id, oldPriority, priority, user.id, reason || `Manual override by ${user.name}`]
      );

      // Audit log
      await logAudit({
        actor_type: 'USER',
        actor_user_id: user.id,
        actor_name: user.name,
        action: 'PRIORITY_OVERRIDE',
        entity_type: 'ORDER',
        entity_id: id,
        old_values: { priority_status: oldPriority },
        new_values: { priority_status: priority, driver_arrived_at: arrivalTime },
        metadata: { reason },
        client,
      });

      return updateRes.rows[0];
    });

    sseManager.broadcast('priorityUpdate', updatedOrder);
    sseManager.broadcast('orderUpdate', updatedOrder);

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('Error changing order priority:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update priority' },
      { status: 400 }
    );
  }
}

