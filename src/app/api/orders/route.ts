import { NextRequest, NextResponse } from 'next/server';
import { query, withTransaction } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { sseManager } from '@/lib/sse';
import { Order, OrderItem } from '@/lib/types';


export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const exclude_status = searchParams.get('exclude_status');
    const priority = searchParams.get('priority');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '150');

    let sql = `
      SELECT o.id, o.external_order_id, o.order_number, o.no_wsa, o.picking_no, o.courier_type, o.pickup_code,
             o.customer_name, o.courier_name,
             o.driver_id, o.status, o.priority_status, o.driver_arrived_at, o.packing_started_at,
             o.packed_at, o.shipped_at, o.driver_wait_duration_seconds, o.packing_duration_seconds,
             o.queue_number,
             o.dispatch_sync_status, o.dispatch_sync_error, o.dispatch_synced_at, o.dispatch_retry_count,
             o.created_at, o.updated_at,
             d.name as driver_name, d.phone as driver_phone,
             (
               SELECT u.name FROM packing_sessions ps 
               JOIN users u ON ps.packer_id = u.id 
               WHERE ps.order_id = o.id AND ps.completed_at IS NULL 
               ORDER BY ps.started_at DESC LIMIT 1
             ) as current_packer_name,
             (
               SELECT json_build_object(
                 'id', pt.id,
                 'driver_name', pt.driver_name,
                 'courier_company', pt.courier_company,
                 'picked_up_at', pt.picked_up_at,
                 'photo_key', pp.storage_key
               )
               FROM pickup_transactions pt
               LEFT JOIN pickup_photos pp ON pp.pickup_transaction_id = pt.id
               WHERE pt.order_id = o.id
               LIMIT 1
             ) as pickup_transaction
      FROM orders o
      LEFT JOIN drivers d ON o.driver_id = d.id
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (status) {
      if (status.includes(',')) {
        const statuses = status.split(',');
        sql += ` AND o.status = ANY($${paramIndex})`;
        params.push(statuses);
        paramIndex++;
      } else {
        sql += ` AND o.status = $${paramIndex}`;
        params.push(status);
        paramIndex++;
      }
    }

    if (exclude_status) {
      if (exclude_status.includes(',')) {
        const statuses = exclude_status.split(',');
        sql += ` AND NOT (o.status = ANY($${paramIndex}))`;
        params.push(statuses);
        paramIndex++;
      } else {
        sql += ` AND o.status != $${paramIndex}`;
        params.push(exclude_status);
        paramIndex++;
      }
    }

    if (priority) {
      sql += ` AND o.priority_status = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    if (search) {
      sql += ` AND (
        o.order_number ILIKE $${paramIndex} OR
        o.no_wsa ILIKE $${paramIndex} OR
        o.picking_no ILIKE $${paramIndex} OR
        o.pickup_code ILIKE $${paramIndex} OR
        o.customer_name ILIKE $${paramIndex} OR
        o.courier_name ILIKE $${paramIndex} OR
        o.courier_type ILIKE $${paramIndex}
      )`;
      params.push(`%${search.trim()}%`);
      paramIndex++;
    }

    // Sort: If driver_waiting, sort ASC by queue_number and driver_arrived_at; otherwise created_at DESC
    if (priority === 'DRIVER_WAITING') {
      sql += ` ORDER BY o.queue_number ASC NULLS LAST, o.driver_arrived_at ASC NULLS LAST, o.created_at ASC`;
    } else {
      sql += ` ORDER BY 
        CASE WHEN o.priority_status = 'DRIVER_WAITING' THEN 0 ELSE 1 END,
        CASE WHEN o.priority_status = 'DRIVER_WAITING' THEN o.queue_number ELSE NULL END ASC NULLS LAST,
        o.created_at DESC`;
    }

    sql += ` LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await query<Order>(sql, params);

    // Fetch items for these orders
    const orderIds = result.rows.map((r) => r.id);
    let itemsMap: Record<string, OrderItem[]> = {};

    if (orderIds.length > 0) {
      const itemsRes = await query<OrderItem>(
        `SELECT id, order_id, sku, size, warna, line_no, product_name, quantity, created_at, updated_at
         FROM order_items
         WHERE order_id = ANY($1)
         ORDER BY line_no ASC NULLS LAST, created_at ASC`,
        [orderIds]
      );

      itemsRes.rows.forEach((item) => {
        if (!itemsMap[item.order_id]) itemsMap[item.order_id] = [];
        itemsMap[item.order_id].push(item);
      });
    }

    const orders = result.rows.map((order) => ({
      ...order,
      items: itemsMap[order.id] || [],
    }));

    return NextResponse.json({ orders });
  } catch (error: any) {
    console.error('Error fetching orders:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch orders' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    let { order_number, customer_name, courier_name, items } = body;

    // Auto-generate order number if omitted
    if (!order_number) {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      order_number = `ORD-${randomSuffix}`;
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: 'At least one order item is required' },
        { status: 400 }
      );
    }

    const newOrder = await withTransaction(async (client) => {
      // Check duplicate
      const checkRes = await client.query('SELECT id FROM orders WHERE order_number = $1', [order_number]);
      if (checkRes.rows.length > 0) {
        throw new Error(`Order number ${order_number} already exists`);
      }

      const orderInsert = await client.query(
        `INSERT INTO orders (order_number, customer_name, courier_name, status, priority_status)
         VALUES ($1, $2, $3, 'WAITING', 'NORMAL')
         RETURNING *`,
        [order_number, customer_name || null, courier_name || null]
      );

      const createdOrder = orderInsert.rows[0];
      const insertedItems: OrderItem[] = [];

      for (const item of items) {
        const itemRes = await client.query(
          `INSERT INTO order_items (order_id, sku, product_name, quantity)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [createdOrder.id, item.sku || null, item.product_name, item.quantity || 1]
        );
        insertedItems.push(itemRes.rows[0]);
      }

      // Record status history
      await client.query(
        `INSERT INTO order_status_history (order_id, from_status, to_status, changed_by_type, changed_by_user_id)
         VALUES ($1, NULL, 'WAITING', 'USER', $2)`,
        [createdOrder.id, user.id]
      );

      // Audit log
      await logAudit({
        actor_type: 'USER',
        actor_user_id: user.id,
        actor_name: user.name,
        action: 'ORDER_CREATED',
        entity_type: 'ORDER',
        entity_id: createdOrder.id,
        new_values: { order_number, customer_name, courier_name, items_count: items.length },
        client,
      });

      return {
        ...createdOrder,
        items: insertedItems,
      };
    });

    // Real-time broadcast
    sseManager.broadcast('orderCreated', newOrder);
    sseManager.broadcast('orderUpdate', newOrder);

    return NextResponse.json({ success: true, order: newOrder }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating order:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create order' },
      { status: 400 }
    );
  }
}
