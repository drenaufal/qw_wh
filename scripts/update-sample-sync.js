const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgresql://postgres:prestasi10@localhost:5432/qw_whv4' });

async function sync() {
  // Update WSA26P058834 to SYNCED
  await pool.query(`
    UPDATE orders 
    SET dispatch_sync_status = 'SYNCED', 
        dispatch_synced_at = NOW(),
        dispatch_sync_error = NULL
    WHERE id = '0a352f24-1190-42bf-9291-bfa72d107d81'
  `);

  // Update order 27c0a430-8cd0-42f1-a749-fc0dc1b7eee2 to FAILED ("Tidak Sync") as an example of failed sync
  await pool.query(`
    UPDATE orders 
    SET dispatch_sync_status = 'FAILED', 
        dispatch_sync_error = 'ERP 400: Posted Whse. Shipment No. WSA26P058838 timeout / already scanned'
    WHERE id = '27c0a430-8cd0-42f1-a749-fc0dc1b7eee2'
  `);

  const res = await pool.query(`
    SELECT id, order_number, no_wsa, status, dispatch_sync_status, dispatch_sync_error, dispatch_synced_at 
    FROM orders 
    WHERE id IN ('0a352f24-1190-42bf-9291-bfa72d107d81', '27c0a430-8cd0-42f1-a749-fc0dc1b7eee2')
  `);
  console.log('Orders updated:', res.rows);
  await pool.end();
}

sync().catch(console.error);
