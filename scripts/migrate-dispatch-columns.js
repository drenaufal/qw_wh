const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.resolve(__dirname, '..', '.env.local');
let dbUrl = 'postgresql://postgres:prestasi10@localhost:5432/qw_whv4';

if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const match = line.match(/^\s*DATABASE_URL\s*=\s*(.*)?\s*$/);
    if (match) {
      dbUrl = (match[1] || '').trim().replace(/^['"]|['"]$/g, '');
    }
  }
}

const pool = new Pool({ connectionString: dbUrl });

async function migrate() {
  console.log('Connecting to database...');
  await pool.query(`
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_sync_status VARCHAR(50) DEFAULT 'PENDING';
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_sync_error TEXT NULL;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_synced_at TIMESTAMPTZ NULL;
    ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_retry_count INTEGER DEFAULT 0;
    CREATE INDEX IF NOT EXISTS idx_orders_dispatch_sync_status ON orders(dispatch_sync_status);
  `);

  const res = await pool.query(`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'orders' AND column_name LIKE 'dispatch_%'
  `);
  console.log('Columns verified:', res.rows);
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
