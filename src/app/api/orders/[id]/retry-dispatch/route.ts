import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { sseManager } from '@/lib/sse';
import { sendExternalDispatch } from '@/lib/services/external-dispatch';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const user = await getCurrentUser(req);

    // Fetch order
    const orderRes = await query('SELECT * FROM orders WHERE id = $1', [id]);
    if (orderRes.rows.length === 0) {
      return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
    }

    const order = orderRes.rows[0];

    if (order.status !== 'SHIP') {
      return NextResponse.json(
        { error: `Pesanan masih berstatus '${order.status}'. Hanya pesanan yang sudah diserahterimakan (SHIP) yang dapat disinkronkan ke ERP.` },
        { status: 400 }
      );
    }

    const shipmentNo = order.no_wsa?.trim();
    if (!shipmentNo) {
      return NextResponse.json(
        { error: 'Pesanan tidak memiliki Nomor WSA (no_wsa) untuk createDispatch.' },
        { status: 400 }
      );
    }

    // Call external dispatch API
    const dispatchResult = await sendExternalDispatch(shipmentNo);

    let updatedOrder;
    if (dispatchResult.success) {
      const updateRes = await query(
        `UPDATE orders
         SET dispatch_sync_status = 'SYNCED',
             dispatch_synced_at = NOW(),
             dispatch_sync_error = NULL,
             dispatch_retry_count = COALESCE(dispatch_retry_count, 0) + 1,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );
      updatedOrder = updateRes.rows[0];

      await logAudit({
        actor_type: user ? 'USER' : 'SYSTEM',
        actor_user_id: user?.id,
        actor_name: user?.name || 'Staff User',
        action: 'DISPATCH_RETRY_SUCCESS',
        entity_type: 'ORDER',
        entity_id: id,
        new_values: {
          dispatch_sync_status: 'SYNCED',
          shipmentNo,
          response: dispatchResult.data,
          retry_count: updatedOrder.dispatch_retry_count,
        },
      });
    } else {
      const updateRes = await query(
        `UPDATE orders
         SET dispatch_sync_status = 'FAILED',
             dispatch_sync_error = $2,
             dispatch_retry_count = COALESCE(dispatch_retry_count, 0) + 1,
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id, dispatchResult.error || 'ERP dispatch failed']
      );
      updatedOrder = updateRes.rows[0];

      await logAudit({
        actor_type: user ? 'USER' : 'SYSTEM',
        actor_user_id: user?.id,
        actor_name: user?.name || 'Staff User',
        action: 'DISPATCH_RETRY_FAILED',
        entity_type: 'ORDER',
        entity_id: id,
        new_values: {
          dispatch_sync_status: 'FAILED',
          shipmentNo,
          error: dispatchResult.error,
          retry_count: updatedOrder.dispatch_retry_count,
        },
      });
    }

    // Real-time broadcast
    sseManager.broadcast('orderUpdate', updatedOrder);

    return NextResponse.json({
      success: dispatchResult.success,
      order: updatedOrder,
      dispatch: dispatchResult,
      message: dispatchResult.success
        ? 'Sinkronisasi createDispatch ke ERP berhasil!'
        : `Sinkronisasi gagal: ${dispatchResult.error}`,
    });
  } catch (error: any) {
    console.error('Retry dispatch error:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal memproses kirim ulang dispatch' },
      { status: 500 }
    );
  }
}
