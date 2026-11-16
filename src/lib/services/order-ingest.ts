import { withTransaction } from '@/lib/db';
import { logAudit } from '@/lib/audit';
import { sseManager } from '@/lib/sse';
import { Order, OrderItem } from '@/lib/types';

export interface ExternalOrderLine {
  lineNo?: number;
  itemNo?: string;
  variantCode?: string;
  description?: string;
  description2?: string;
  qtyBase?: number;
  quantity?: number;
  qtyPicked?: number;
  qtyToShip?: number;
  packingStatus?: string;
  // Fallback field variants
  sku?: string;
  size?: string;
  warna?: string;
  product_name?: string;
  [key: string]: any;
}

export interface ExternalOrderPayload {
  no?: string;
  locationCode?: string;
  postingDate?: string;
  PostingDate?: string;
  status?: string;
  PackingStatus?: string;
  packingStatus?: string;
  shippingAgentCode?: string;
  orderNo?: string;
  pickingNo?: string;
  sourceName?: string;
  newDeliveryPriority?: string;
  pickupCode?: string;
  PickupCode?: string;
  pickup_code?: string;
  totalQtyPicking?: number;
  postedWarehouseShipmentLines?: ExternalOrderLine[];
  whseShipmentPickingLines?: ExternalOrderLine[];
  lines?: ExternalOrderLine[];
  items?: ExternalOrderLine[];
  order_items?: ExternalOrderLine[];
  warehouseShipmentLines?: ExternalOrderLine[];
  shipmentLines?: ExternalOrderLine[];
  // Fallback field variants
  no_wsa?: string;
  order_number?: string;
  picking_no?: string;
  courier_type?: string;
  customer_name?: string;
  [key: string]: any;
}

/**
 * Extracts line items array from various naming conventions (Business Central, REST, PascalCase, snake_case)
 */
export function extractLines(record: any): any[] {
  if (!record || typeof record !== 'object') return [];
  const candidates = [
    record.whseShipmentPickingLines,
    record.WhseShipmentPickingLines,
    record.whse_shipment_picking_lines,
    record.whseShipmentPickingLine,
    record.postedWarehouseShipmentLines,
    record.PostedWarehouseShipmentLines,
    record.posted_warehouse_shipment_lines,
    record.postedWarehouseShipmentLine,
    record.items,
    record.Items,
    record.order_items,
    record.lines,
    record.Lines,
    record.warehouseShipmentLines,
    record.WarehouseShipmentLines,
    record.shipmentLines,
    record.ShipmentLines,
  ];

  for (const c of candidates) {
    if (Array.isArray(c) && c.length > 0) return c;
    // OData nested object with value array: e.g. { value: [ ... ] }
    if (c && typeof c === 'object' && Array.isArray(c.value) && c.value.length > 0) {
      return c.value;
    }
  }

  // Fallback: check if any key in record contains 'line' or 'item' and is an array
  for (const key of Object.keys(record)) {
    const lk = key.toLowerCase();
    if ((lk.includes('line') || lk.includes('item')) && Array.isArray(record[key]) && record[key].length > 0) {
      return record[key];
    }
  }

  return [];
}

/**
 * Safely parses individual line item fields across case and naming variations
 */
export function extractLineItem(line: any): {
  sku: string | null;
  size: string | null;
  warna: string | null;
  productName: string;
  quantity: number;
  lineNo: number | null;
} {
  if (!line || typeof line !== 'object') {
    return {
      sku: null,
      size: null,
      warna: null,
      productName: 'Product Item',
      quantity: 1,
      lineNo: null,
    };
  }

  // SKU: itemNo | ItemNo | item_no | sku | SKU | productCode
  const sku = (
    line.itemNo ||
    line.ItemNo ||
    line.item_no ||
    line.Item_No ||
    line.sku ||
    line.SKU ||
    line.product_code ||
    line.productCode
  )?.toString().trim() || null;

  // Size / VariantCode
  const size = (
    line.variantCode ||
    line.VariantCode ||
    line.variant_code ||
    line.size ||
    line.Size ||
    line.variant ||
    line.Variant
  )?.toString().trim() || null;

  // Warna / Description2
  const warna = (
    line.description2 ||
    line.Description2 ||
    line.description_2 ||
    line.warna ||
    line.color ||
    line.Color ||
    line.colour
  )?.toString().trim() || null;

  // Product Name / Description
  const productName = (
    line.description ||
    line.Description ||
    line.product_name ||
    line.productName ||
    line.item_name ||
    line.itemName ||
    line.name ||
    line.Name ||
    sku ||
    'Product Item'
  )?.toString().trim() || 'Product Item';

  // Quantity
  const rawQty =
    line.quantity ??
    line.Quantity ??
    line.qtyPicked ??
    line.QtyPicked ??
    line.qty_picked ??
    line.qtyBase ??
    line.QtyBase ??
    line.qty_base ??
    line.qtyToShip ??
    line.QtyToShip ??
    line.qty ??
    line.Qty ??
    1;
  const numQty = Number(rawQty);
  const quantity = !isNaN(numQty) && numQty > 0 ? numQty : 1;

  // Line No
  const rawLineNo = line.lineNo ?? line.LineNo ?? line.line_no ?? line.Line_No;
  const lineNo = rawLineNo !== undefined && rawLineNo !== null && !isNaN(Number(rawLineNo))
    ? Number(rawLineNo)
    : null;

  return {
    sku,
    size,
    warna,
    productName,
    quantity,
    lineNo,
  };
}

export function mapCourierName(shippingAgentCode?: string): string {
  if (!shippingAgentCode) return 'General Fleet';
  const code = shippingAgentCode.trim().toUpperCase();
  if (code.includes('GOJEK') || code.includes('GOSEND')) return 'GoSend';
  if (code.includes('GRAB')) return 'GrabExpress';
  if (code.includes('JNT') || code.includes('J&T')) return 'J&T Express';
  if (code.includes('SICEPAT')) return 'SiCepat';
  if (code.includes('SHOPEE') || code.includes('SPX')) return 'Shopee Xpress';
  if (code.includes('ANTERAJA')) return 'Anteraja';
  if (code.includes('JNE')) return 'JNE Express';
  if (code.includes('NINJA')) return 'Ninja Van';
  return shippingAgentCode.trim();
}

/**
 * Normalizes input records from either:
 * - Direct array of records
 * - OData format: { "@odata.context": "...", "value": [ ... ] }
 * - Object with { orders: [ ... ] }
 * - Single record object { ... }
 */
export function extractOrderRecords(rawBody: any): ExternalOrderPayload[] {
  if (!rawBody) return [];
  if (Array.isArray(rawBody)) return rawBody;
  if (Array.isArray(rawBody.value)) return rawBody.value;
  if (Array.isArray(rawBody.orders)) return rawBody.orders;
  return [rawBody];
}

export interface IngestOptions {
  targetStatus?: 'READY_FOR_PICKUP' | 'PACKING';
}

/**
 * Ingests external order records with idempotent upsert and real-time SSE broadcasts.
 */
export async function ingestOrderRecords(
  records: ExternalOrderPayload[],
  sourceLabel = 'External API',
  options?: IngestOptions
): Promise<{
  success: boolean;
  count: number;
  insertedCount: number;
  updatedCount: number;
  orders: Order[];
}> {
  const processedOrders: Order[] = [];
  let insertedCount = 0;
  let updatedCount = 0;

  for (const record of records) {
    // 1. Map order fields
    const orderNumber = (record.orderNo || record.order_number)?.trim();
    const noWsa = (record.no || record.no_wsa)?.trim() || null;
    const pickingNo = (record.pickingNo || record.picking_no)?.trim() || null;
    const courierType = (record.shippingAgentCode || record.courier_type)?.trim() || null;
    const courierName = mapCourierName(courierType || undefined);
    const pickupCode = (record.PickupCode || record.pickup_code)?.trim() || null;
    const customerName = (record.sourceName || record.customer_name)?.trim() || null;

    if (!orderNumber) {
      continue;
    }

    // 2. Status: Tentukan status awal berdasarkan tipe record atau opsi eksplisit
    const hasPickingLines = Boolean(
      (record.whseShipmentPickingLines && Array.isArray(record.whseShipmentPickingLines) && record.whseShipmentPickingLines.length > 0) ||
      (record.PackingStatus !== undefined) ||
      (record.totalQtyPicking !== undefined)
    );

    const initialStatus: 'READY_FOR_PICKUP' | 'PACKING' =
      options?.targetStatus ?? (hasPickingLines ? 'PACKING' : 'READY_FOR_PICKUP');

    const packingStartedAt = initialStatus === 'PACKING' ? new Date().toISOString() : null;
    const packedAt = initialStatus === 'READY_FOR_PICKUP' ? new Date().toISOString() : null;

    // 3. Priority: all orders from external API default to 'NORMAL'.
    // 'DRIVER_WAITING' is strictly reserved for when a courier driver checks in at the kiosk.
    const initialPriority = 'NORMAL';

    // 4. Database Transaction for Idempotent Upsert
    const savedOrder = await withTransaction(async (client) => {
      // Check existing to distinguish inserted vs updated
      const existingRes = await client.query(
        'SELECT id, status, priority_status, packed_at, packing_started_at FROM orders WHERE order_number = $1',
        [orderNumber]
      );
      const isExisting = existingRes.rows.length > 0;

      const orderUpsertRes = await client.query(
        `INSERT INTO orders (
          order_number, no_wsa, picking_no, courier_type, courier_name,
          pickup_code, customer_name, status, priority_status, packing_started_at, packed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (order_number) DO UPDATE SET
          no_wsa = COALESCE(EXCLUDED.no_wsa, orders.no_wsa),
          picking_no = COALESCE(EXCLUDED.picking_no, orders.picking_no),
          courier_type = COALESCE(EXCLUDED.courier_type, orders.courier_type),
          courier_name = COALESCE(EXCLUDED.courier_name, orders.courier_name),
          pickup_code = COALESCE(EXCLUDED.pickup_code, orders.pickup_code),
          customer_name = COALESCE(EXCLUDED.customer_name, orders.customer_name),
          status = CASE 
            WHEN orders.status IN ('READY_FOR_PICKUP', 'SHIP') THEN orders.status
            ELSE EXCLUDED.status 
          END,
          priority_status = CASE 
            WHEN orders.priority_status = 'DRIVER_WAITING' AND orders.driver_arrived_at IS NOT NULL 
              THEN orders.priority_status 
            ELSE 'NORMAL' 
          END,
          packing_started_at = COALESCE(orders.packing_started_at, EXCLUDED.packing_started_at),
          packed_at = CASE 
            WHEN orders.status IN ('READY_FOR_PICKUP', 'SHIP') THEN orders.packed_at 
            ELSE EXCLUDED.packed_at 
          END,
          updated_at = NOW()
        RETURNING *`,
        [
          orderNumber,
          noWsa,
          pickingNo,
          courierType,
          courierName,
          pickupCode,
          customerName,
          initialStatus,
          initialPriority,
          packingStartedAt,
          packedAt,
        ]
      );

      if (isExisting) {
        updatedCount++;
      } else {
        insertedCount++;
      }

      const orderRow = orderUpsertRes.rows[0];

      // 5. Map & Insert Order Items using robust multi-schema parser
      const lines = extractLines(record);

      if (lines.length > 0) {
        // Delete previous items for idempotent reload
        await client.query('DELETE FROM order_items WHERE order_id = $1', [orderRow.id]);

        for (const line of lines) {
          const parsed = extractLineItem(line);

          await client.query(
            `INSERT INTO order_items (order_id, sku, size, warna, line_no, product_name, quantity)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              orderRow.id,
              parsed.sku,
              parsed.size,
              parsed.warna,
              parsed.lineNo,
              parsed.productName,
              parsed.quantity,
            ]
          );
        }
      }

      // Fetch inserted items to attach to response
      const itemsRes = await client.query(
        `SELECT id, order_id, sku, size, warna, line_no, product_name, quantity, created_at, updated_at
         FROM order_items
         WHERE order_id = $1
         ORDER BY line_no ASC NULLS LAST, created_at ASC`,
        [orderRow.id]
      );

      return {
        ...orderRow,
        items: itemsRes.rows,
      };
    });

    // 6. Broadcast SSE events for live screens
    try {
      sseManager.broadcast('orderCreated', savedOrder);
      sseManager.broadcast('orderUpdate', savedOrder);
    } catch (err) {
      console.warn('SSE broadcast error:', err);
    }

    // 7. Audit Log
    try {
      await logAudit({
        actor_type: 'SYSTEM',
        actor_name: sourceLabel,
        action: 'ORDER_INGESTED',
        entity_type: 'ORDER',
        entity_id: savedOrder.id,
        new_values: {
          order_number: savedOrder.order_number,
          no_wsa: savedOrder.no_wsa,
          picking_no: savedOrder.picking_no,
          courier_type: savedOrder.courier_type,
          pickup_code: savedOrder.pickup_code,
          items_count: savedOrder.items?.length || 0,
          status: savedOrder.status,
        },
      });
    } catch (err) {
      console.warn('Audit logging error:', err);
    }

    processedOrders.push(savedOrder);
  }

  return {
    success: true,
    count: processedOrders.length,
    insertedCount,
    updatedCount,
    orders: processedOrders,
  };
}

