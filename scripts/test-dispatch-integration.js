const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// 1. Load env
const envPath = path.resolve(__dirname, '..', '.env.local');
const env = {};
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      env[match[1]] = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

const dbUrl = env.DATABASE_URL || 'postgresql://postgres:prestasi10@localhost:5432/qw_whv4';
const dispatchUrl = env.EXTERNAL_DISPATCH_API_URL;
const basicUser = env.EXTERNAL_ORDER_API_USER;
const basicPass = env.EXTERNAL_ORDER_API_PASSWORD;

console.log('--- TEST CONFIGURATION ---');
console.log('Database URL:', dbUrl.replace(/:[^:]*@/, ':***@'));
console.log('Dispatch URL:', dispatchUrl);
console.log('Basic Auth User:', basicUser);
console.log('Basic Auth Pass present?:', !!basicPass);

async function runTests() {
  const pool = new Pool({ connectionString: dbUrl });

  // 1. Check orders table columns
  console.log('\n--- 1. Checking Database Schema ---');
  const cols = await pool.query(`
    SELECT column_name, data_type, column_default 
    FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name LIKE 'dispatch_%'
    ORDER BY column_name
  `);
  console.log('Dispatch columns in DB:', cols.rows);

  // 2. Check sample orders in DB
  console.log('\n--- 2. Checking Existing Orders in DB ---');
  const sampleOrders = await pool.query(`
    SELECT id, order_number, no_wsa, status, dispatch_sync_status, dispatch_retry_count
    FROM orders
    LIMIT 5
  `);
  console.log('Orders found:', sampleOrders.rows);

  // 3. Test direct API call to createDispatch endpoint
  console.log('\n--- 3. Testing External createDispatch Endpoint ---');
  const sampleWsa = 'WSA26P058827';
  const credentials = `${basicUser}:${basicPass}`;
  const base64Auth = Buffer.from(credentials).toString('base64');

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Basic ${base64Auth}`,
  };

  const payload = {
    shipmentNo: sampleWsa,
  };

  console.log(`Sending POST to ${dispatchUrl} with payload:`, JSON.stringify(payload));
  const startTime = Date.now();

  try {
    const res = await fetch(dispatchUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });
    const duration = Date.now() - startTime;
    const text = await res.text();
    console.log(`Response HTTP Status: ${res.status} ${res.statusText} (${duration}ms)`);
    console.log('Response Body:', text.substring(0, 500));
  } catch (err) {
    console.error('API Fetch error:', err.message);
  }

  await pool.end();
  console.log('\n--- All verification checks finished ---');
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});
