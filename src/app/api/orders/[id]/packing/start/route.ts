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
    const auth = await authenticateRequest(req, ['PACKER', 'SUPERADMIN']);
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }
    const { user } = auth;
    const { id } = await params;

    const updatedOrder = await withTransaction(async (client) => {
      // Row lock to prevent race condition when two packers try to claim the same order
      const orderRes = await client.query(
        'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (orderRes.rows.length === 0) {
        throw new Error('Order not found');
      }

      const order = orderRes.rows[0];

      if (order.status === 'SHIP') {
        throw new Error('Cannot claim order: Already shipped');
      }
      if (order.status === 'READY_FOR_PICKUP') {
        throw new Error('Cannot claim order: Packaging is already complete');
      }

      const oldStatus = order.status;
      const startTime = new Date().toISOString();

      // Update order status
      const updateRes = await client.query(
        `UPDATE orders
         SET status = 'PACKING',
             packing_started_at = COALESCE(packing_started_at, $1),
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [startTime, id]
      );

      // Create packing session
      await client.query(
        `INSERT INTO packing_sessions (order_id, packer_id, started_at)
         VALUES ($1, $2, $3)`,
        [id, user.id, startTime]
      );

      // Status history
      if (oldStatus !== 'PACKING') {
        await client.query(
          `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by_type, changed_by_user_id)
           VALUES ($1, $2, 'PACKING', 'USER', $3)`,
          [id, oldStatus, user.id]
        );
      }

      // Audit log
      await logAudit({
        actor_type: 'USER',
        actor_user_id: user.id,
        actor_name: user.name,
        action: 'PACKING_STARTED',
        entity_type: 'ORDER',
        entity_id: id,
        old_values: { status: oldStatus },
        new_values: { status: 'PACKING', packing_started_at: startTime },
        client,
      });

      return {
        ...updateRes.rows[0],
        current_packer_name: user.name,
      };
    });

    sseManager.broadcast('packingStart', updatedOrder);
    sseManager.broadcast('orderUpdate', updatedOrder);

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('Error starting packing:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to start packing' },
      { status: 400 }
    );
  }
}

