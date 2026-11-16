import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import {
  extractOrderRecords,
  ingestOrderRecords,
  ExternalOrderPayload,
} from '@/lib/services/order-ingest';

// Dynamic reader for .env.local to support immediate changes without restarting server
function getDynamicEnv(key: string): string | undefined {
  try {
    const envPath = path.resolve(process.cwd(), '.env.local');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      const lines = content.split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match && match[1] === key) {
          const val = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
          if (val) return val;
        }
      }
    }
  } catch {
    // ignore file read errors
  }
  return process.env[key];
}

// Sample mock order matching user's exact JSON format for Posted Shipment
const MOCK_SHIPMENT_ORDERS: ExternalOrderPayload[] = [
  {
    no: 'WSA26P058826',
    PostingDate: '2026-10-26',
    shippingAgentCode: 'GOJEK',
    orderNo: '583841684064470696',
    sourceName: 'Noval Yona',
    newDeliveryPriority: 'PRIO-1',
    PickupCode: 'PK-9912',
    postedWarehouseShipmentLines: [
      {
        lineNo: 10000,
        itemNo: 'SPE904268',
        variantCode: 'NS',
        description: 'INTEGRAL FB SCK',
        description2: 'WHITE-NS',
        qtyBase: 1,
      },
    ],
  },
  {
    no: 'WSA26P058827',
    PostingDate: '2026-10-26',
    shippingAgentCode: 'SICEPAT',
    orderNo: '583841684064470777',
    sourceName: 'Budi Santoso',
    newDeliveryPriority: 'NORMAL',
    PickupCode: 'PK-9913',
    postedWarehouseShipmentLines: [
      {
        lineNo: 10000,
        itemNo: 'RUN10293',
        variantCode: '42',
        description: 'ULTRA BOOST STAGE',
        description2: 'CORE-BLACK',
        qtyBase: 2,
      },
    ],
  },
];

// Sample mock order matching user's exact JSON format for Warehouse Picking (Sedang Di Packing)
const MOCK_PICKING_ORDERS: ExternalOrderPayload[] = [
  {
    no: 'WSA26064728',
    locationCode: 'DM-MP',
    postingDate: '2026-11-16',
    PackingStatus: ' ',
    shippingAgentCode: 'GOSEND',
    orderNo: '5000021072',
    sourceName: 'Adinda Ayu',
    newDeliveryPriority: 'PRIO-1',
    totalQtyPicking: 1,
    pickupCode: '',
    whseShipmentPickingLines: [
      {
        no: 'WSA26064728',
        lineNo: 10000,
        itemNo: 'NIKDH3161101',
        variantCode: '085',
        description: 'NIKE COURT LEGACY NEXT NATURE',
        description2: 'WHITE/WHITE-BLACK-VOLT-085',
        quantity: 1,
      },
    ],
  },
];

function normalizeTargetUrl(rawUrl: string): string {
  let url = rawUrl.trim();
  const lower = url.toLowerCase();
  // Auto-append appropriate OData $expand parameter if omitted
  if (lower.includes('postedwarehouseshipment') && !lower.includes('$expand')) {
    const sep = url.includes('?') ? '&' : '?';
    url += `${sep}$expand=postedWarehouseShipmentLines`;
  } else if (lower.includes('whseshipmentpicking') && !lower.includes('$expand')) {
    const sep = url.includes('?') ? '&' : '?';
    url += `${sep}$expand=whseShipmentPickingLines`;
  }
  return url;
}

function buildAuthHeaders(): Record<string, string> {
  const apiKey = getDynamicEnv('EXTERNAL_ORDER_API_KEY');
  const authType = (getDynamicEnv('EXTERNAL_ORDER_API_AUTH_TYPE') || 'Basic').toLowerCase();
  const basicUser = getDynamicEnv('EXTERNAL_ORDER_API_USER');
  const basicPass = getDynamicEnv('EXTERNAL_ORDER_API_PASSWORD');

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (authType === 'basic') {
    if (basicUser || basicPass) {
      const credentials = `${basicUser || ''}:${basicPass || ''}`;
      const base64Auth = Buffer.from(credentials).toString('base64');
      headers['Authorization'] = `Basic ${base64Auth}`;
    } else if (apiKey) {
      if (apiKey.includes(':')) {
        const base64Auth = Buffer.from(apiKey).toString('base64');
        headers['Authorization'] = `Basic ${base64Auth}`;
      } else {
        const cleaned = apiKey.replace(/^Basic\s+/i, '').trim();
        headers['Authorization'] = `Basic ${cleaned}`;
      }
    }
  } else if (authType === 'apikey') {
    if (apiKey) headers['x-api-key'] = apiKey;
  } else {
    if (apiKey) {
      const cleaned = apiKey.replace(/^Bearer\s+/i, '').trim();
      headers['Authorization'] = `Bearer ${cleaned}`;
    }
  }

  return headers;
}

async function fetchFromUrl(targetUrl: string, customTimeoutMs?: number): Promise<any> {
  const configuredTimeout = Number(getDynamicEnv('EXTERNAL_API_TIMEOUT_MS'));
  const timeoutMs = customTimeoutMs || (configuredTimeout > 0 ? configuredTimeout : 60000);
  const requestUrl = normalizeTargetUrl(targetUrl);
  const headers = buildAuthHeaders();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Timeout ${timeoutMs}ms reaching ${requestUrl}`));
  }, timeoutMs);

  try {
    const res = await fetch(requestUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => '');
      throw new Error(`External API responded with HTTP ${res.status}: ${res.statusText}. ${errorText}`);
    }

    return await res.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const syncType = (searchParams.get('type') || 'all').toLowerCase(); // 'all', 'shipment', 'picking'
    const useMock = searchParams.get('mock') === 'true';
    const timeoutParam = searchParams.get('timeout');
    const customTimeout = timeoutParam ? Number(timeoutParam) : undefined;

    const shipmentUrl = searchParams.get('shipmentUrl') || getDynamicEnv('EXTERNAL_ORDER_API_URL');
    const pickingUrl = searchParams.get('pickingUrl') || getDynamicEnv('EXTERNAL_PICKING_API_URL');

    let totalCount = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    const combinedOrders: any[] = [];

    const shipmentSummary: {
      success: boolean;
      count: number;
      insertedCount: number;
      updatedCount: number;
      source: string;
      error?: string;
    } = { success: false, count: 0, insertedCount: 0, updatedCount: 0, source: 'NONE' };

    const pickingSummary: {
      success: boolean;
      count: number;
      insertedCount: number;
      updatedCount: number;
      source: string;
      error?: string;
    } = { success: false, count: 0, insertedCount: 0, updatedCount: 0, source: 'NONE' };

    // 1. Process Shipment Sync (if requested)
    if (syncType === 'all' || syncType === 'shipment') {
      let rawShipmentData: any = null;

      if (useMock || !shipmentUrl) {
        rawShipmentData = MOCK_SHIPMENT_ORDERS;
        shipmentSummary.source = 'MOCK_DATA';
        shipmentSummary.success = true;
      } else {
        try {
          rawShipmentData = await fetchFromUrl(shipmentUrl, customTimeout);
          shipmentSummary.source = 'LIVE_API';
          shipmentSummary.success = true;
        } catch (err: any) {
          console.error('Shipment fetch error:', err.message);
          shipmentSummary.error = err.message;
          shipmentSummary.success = false;
          // Only fallback to mock if useMock was explicitly requested
          if (useMock) {
            rawShipmentData = MOCK_SHIPMENT_ORDERS;
            shipmentSummary.source = 'MOCK_DATA';
          }
        }
      }

      if (rawShipmentData) {
        const shipmentRecords = extractOrderRecords(rawShipmentData);
        if (shipmentRecords.length > 0) {
          const result = await ingestOrderRecords(
            shipmentRecords,
            `GET /api/orders/sync-external (shipment ${shipmentSummary.source})`,
            { targetStatus: 'READY_FOR_PICKUP' }
          );
          shipmentSummary.count = result.count;
          shipmentSummary.insertedCount = result.insertedCount;
          shipmentSummary.updatedCount = result.updatedCount;

          totalCount += result.count;
          totalInserted += result.insertedCount;
          totalUpdated += result.updatedCount;
          combinedOrders.push(...result.orders);
        }
      }
    }

    // 2. Process Picking Sync (if requested)
    if (syncType === 'all' || syncType === 'picking') {
      let rawPickingData: any = null;

      if (useMock || !pickingUrl) {
        rawPickingData = MOCK_PICKING_ORDERS;
        pickingSummary.source = 'MOCK_DATA';
        pickingSummary.success = true;
      } else {
        try {
          rawPickingData = await fetchFromUrl(pickingUrl, customTimeout);
          pickingSummary.source = 'LIVE_API';
          pickingSummary.success = true;
        } catch (err: any) {
          console.error('Picking fetch error:', err.message);
          pickingSummary.error = err.message;
          pickingSummary.success = false;
          // Only fallback to mock if useMock was explicitly requested
          if (useMock) {
            rawPickingData = MOCK_PICKING_ORDERS;
            pickingSummary.source = 'MOCK_DATA';
          }
        }
      }

      if (rawPickingData) {
        const pickingRecords = extractOrderRecords(rawPickingData);
        if (pickingRecords.length > 0) {
          const result = await ingestOrderRecords(
            pickingRecords,
            `GET /api/orders/sync-external (picking ${pickingSummary.source})`,
            { targetStatus: 'PACKING' }
          );
          pickingSummary.count = result.count;
          pickingSummary.insertedCount = result.insertedCount;
          pickingSummary.updatedCount = result.updatedCount;

          totalCount += result.count;
          totalInserted += result.insertedCount;
          totalUpdated += result.updatedCount;
          combinedOrders.push(...result.orders);
        }
      }
    }

    const hasErrors = Boolean(shipmentSummary.error || pickingSummary.error);
    const overallSuccess = totalCount > 0 || !hasErrors;

    let message = `Berhasil sinkronisasi total ${totalCount} order (${totalInserted} baru, ${totalUpdated} diperbarui).`;
    if (shipmentSummary.error || pickingSummary.error) {
      const errParts: string[] = [];
      if (shipmentSummary.error) errParts.push(`Shipment: ${shipmentSummary.error}`);
      if (pickingSummary.error) errParts.push(`Picking: ${pickingSummary.error}`);
      message += ` (Perhatian: ${errParts.join(' | ')})`;
    }

    if (!overallSuccess && totalCount === 0) {
      return NextResponse.json(
        {
          success: false,
          error: message,
          count: 0,
          insertedCount: 0,
          updatedCount: 0,
          shipment: shipmentSummary,
          picking: pickingSummary,
          orders: [],
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      message,
      count: totalCount,
      insertedCount: totalInserted,
      updatedCount: totalUpdated,
      shipment: shipmentSummary,
      picking: pickingSummary,
      orders: combinedOrders,
    });
  } catch (error: any) {
    console.error('External Order Sync Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Gagal sinkronisasi data dari API eksternal',
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
