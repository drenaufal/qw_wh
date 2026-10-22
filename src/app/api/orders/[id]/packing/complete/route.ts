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
    const body = await req.json();
    const { items, notes } = body;

    const updatedOrder = await withTransaction(async (client) => {
      // Row lock
      const orderRes = await client.query(
        'SELECT * FROM orders WHERE id = $1 FOR UPDATE',
        [id]
      );

      if (orderRes.rows.length === 0) {
        throw new Error('Order not found');
      }

      const order = orderRes.rows[0];

      if (order.status === 'SHIP') {
        throw new Error('Cannot complete packing: Order is already shipped');
      }
      if (order.status === 'READY_FOR_PICKUP') {
        throw new Error('Packaging is already marked complete');
      }

      // Check required items
      const existingItemsRes = await client.query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [id]
      );
      const existingItems = existingItemsRes.rows;

      // Verification check: ensure every order item is provided and checked
      if (existingItems.length > 0) {
        if (!items || !Array.isArray(items)) {
          throw new Error('Verification checklist items are required');
        }

        const checkedIds = new Set(
          items.filter((it: any) => it.is_verified || it.packed_quantity > 0).map((it: any) => it.order_item_id)
        );

        for (const exp of existingItems) {
          if (!checkedIds.has(exp.id)) {
            throw new Error(`Item ${exp.product_name} (${exp.sku || 'No SKU'}) is not verified yet. All items must be checked.`);
          }
        }
      }

      const completedTime = new Date().toISOString();

      // Find or create active packing session
      const sessionRes = await client.query(
        `SELECT id, started_at FROM packing_sessions
         WHERE order_id = $1 AND completed_at IS NULL
         ORDER BY started_at DESC LIMIT 1`,
        [id]
      );

      let sessionId: string;
      let sessionStartTime = order.packing_started_at || completedTime;

      if (sessionRes.rows.length > 0) {
        sessionId = sessionRes.rows[0].id;
        sessionStartTime = sessionRes.rows[0].started_at;
        await client.query(
          `UPDATE packing_sessions
           SET completed_at = $1, notes = $2, updated_at = NOW()
           WHERE id = $3`,
          [completedTime, notes || null, sessionId]
        );
      } else {
        const newSession = await client.query(
          `INSERT INTO packing_sessions (order_id, packer_id, started_at, completed_at, notes)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id`,
          [id, user.id, sessionStartTime, completedTime, notes || null]
        );
        sessionId = newSession.rows[0].id;
      }

      // Record verified packing items
      if (items && Array.isArray(items)) {
        for (const it of items) {
          await client.query(
            `INSERT INTO packing_items (packing_session_id, order_item_id, packed_quantity)
             VALUES ($1, $2, $3)`,
            [sessionId, it.order_item_id, it.packed_quantity || 1]
          );
        }
      }

      // Calculate packing duration in seconds
      const startMs = new Date(sessionStartTime).getTime();
      const endMs = new Date(completedTime).getTime();
      const packingDurationSec = Math.max(0, Math.floor((endMs - startMs) / 1000));

      // Update order status to READY_FOR_PICKUP
      const updateRes = await client.query(
        `UPDATE orders
         SET status = 'READY_FOR_PICKUP',
             packed_at = $1,
             packing_duration_seconds = $2,
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [completedTime, packingDurationSec, id]
      );

      // Status history
      await client.query(
        `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by_type, changed_by_user_id, metadata)
         VALUES ($1, $2, 'READY_FOR_PICKUP', 'USER', $3, $4)`,
        [id, order.status, user.id, JSON.stringify({ duration_seconds: packingDurationSec, notes })]
      );

      // Audit log
      await logAudit({
        actor_type: 'USER',
        actor_user_id: user.id,
        actor_name: user.name,
        action: 'PACKING_COMPLETED',
        entity_type: 'ORDER',
        entity_id: id,
        old_values: { status: order.status },
        new_values: {
          status: 'READY_FOR_PICKUP',
          packed_at: completedTime,
          packing_duration_seconds: packingDurationSec,
        },
        metadata: { notes, total_items_verified: existingItems.length },
        client,
      });

      return updateRes.rows[0];
    });

    sseManager.broadcast('packingComplete', updatedOrder);
    sseManager.broadcast('orderUpdate', updatedOrder);

    return NextResponse.json({ success: true, order: updatedOrder });
  } catch (error: any) {
    console.error('Error completing packing:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to complete packing' },
      { status: 400 }
    );
  }
}

