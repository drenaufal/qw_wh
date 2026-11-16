import { NextRequest, NextResponse } from 'next/server';
import { extractOrderRecords, ingestOrderRecords } from '@/lib/services/order-ingest';

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.json();
    const records = extractOrderRecords(rawBody);

    if (!records || records.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Empty payload: at least 1 order record required.' },
        { status: 400 }
      );
    }

    const result = await ingestOrderRecords(records, 'POST /api/orders/ingest');

    return NextResponse.json(
      {
        success: true,
        message: `Successfully processed ${result.count} order(s) (${result.insertedCount} new, ${result.updatedCount} updated).`,
        count: result.count,
        insertedCount: result.insertedCount,
        updatedCount: result.updatedCount,
        orders: result.orders,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('API Order Ingestion Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to ingest order data',
      },
      { status: 500 }
    );
  }
}
