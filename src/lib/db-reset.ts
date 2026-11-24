import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { setupDatabase } from './db-setup';

// Load env files in priority order if running standalone script via tsx/node
try {
  const envFiles = ['.env.local', '.env.production', '.env'];
  for (const file of envFiles) {
    const envPath = path.resolve(process.cwd(), file);
    if (fs.existsSync(envPath)) {
      const lines = fs.readFileSync(envPath, 'utf-8').split('\n');
      for (const line of lines) {
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          const key = match[1];
          let value = (match[2] || '').trim().replace(/^['"]|['"]$/g, '');
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  }
} catch {
  // ignore
}

const connectionString =
  process.env.DATABASE_URL ||
  (process.env.DATABASE_HOST
    ? `postgresql://${process.env.DATABASE_USER || 'postgres'}:${encodeURIComponent(process.env.DATABASE_PASSWORD || '')}@${process.env.DATABASE_HOST}:${process.env.DATABASE_PORT || 5432}/${process.env.DATABASE_NAME || 'qw_whv4'}`
    : 'postgresql://postgres:prestasi10@localhost:5432/qw_whv4');

export async function resetDatabase() {
  const args = process.argv.slice(2);
  const isOrdersOnly = args.includes('--orders-only') || args.includes('--clean');
  const isNoSeed = args.includes('--no-seed');

  const pool = new Pool({ connectionString });
  const client = await pool.connect();

  const maskedConn = connectionString.replace(/:([^:@]+)@/, ':****@');
  console.log('====================================================');
  console.log('🔄 WAREHOUSE QUEUE SYSTEM - DATABASE RESET TOOL');
  console.log('====================================================');
  console.log(`📡 Target DB: ${maskedConn}`);

  try {
    if (isOrdersOnly) {
      console.log('\n🧹 Mode: BERSIHKAN DATA TRANSAKSI SAJA');
      console.log('ℹ️  Akun pengguna (users) & peran (roles) tetap dipertahankan.\n');

      const tablesToTruncate = [
        'pickup_photos',
        'pickup_transactions',
        'packing_items',
        'packing_sessions',
        'driver_arrivals',
        'order_items',
        'order_status_history',
        'order_priority_history',
        'audit_logs',
        'orders',
        'drivers',
      ];

      for (const table of tablesToTruncate) {
        try {
          await client.query(`TRUNCATE TABLE "${table}" CASCADE;`);
          console.log(`  ✓ Truncated table: ${table}`);
        } catch {
          // Table might not exist yet, skip safely
        }
      }

      console.log('\n✅ Seluruh data order, packing, pickup, dan audit log berhasil dikosongkan.');
      console.log('👉 Akun staf gudang & superadmin tetap utuh dan siap digunakan.');
    } else {
      console.log('\n💥 Mode: RESET TOTAL (FULL RESET)');
      console.log('⚠️  Menghapus semua tabel dan membangun ulang struktur database...\n');

      // 1. Get all existing tables in public schema
      const tablesRes = await client.query(`
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public';
      `);

      if (tablesRes.rows.length > 0) {
        const tableNames = tablesRes.rows.map((r) => `"${r.tablename}"`).join(', ');
        await client.query(`DROP TABLE IF EXISTS ${tableNames} CASCADE;`);
        console.log(`  ✓ Berhasil drop ${tablesRes.rows.length} tabel: ${tableNames}`);
      } else {
        console.log('  ℹ️  Tidak ada tabel yang ditemukan untuk di-drop.');
      }

      client.release();
      await pool.end();

      // 2. Re-initialize database schema, extensions, roles, and default users
      console.log('\n🚀 Membangun ulang skema database & data awal...');
      await setupDatabase();

      if (isNoSeed) {
        // If user explicitly doesn't want dummy sample orders, truncate orders
        const cleanupPool = new Pool({ connectionString });
        const cleanupClient = await cleanupPool.connect();
        try {
          await cleanupClient.query(`
            TRUNCATE TABLE order_items, orders CASCADE;
          `);
          console.log('  ℹ️  Sample orders dihilangkan (--no-seed aktif). Database bersih tanpa dummy data.');
        } finally {
          cleanupClient.release();
          await cleanupPool.end();
        }
      }

      console.log('\n====================================================');
      console.log('✅ DATABASE BERHASIL DI-RESET DENGAN SEMPURNA!');
      console.log('====================================================');
      console.log('Default Kredensial Login:');
      console.log('  • Super Admin  : username: admin    | password: admin123');
      console.log('  • Packer Staff : username: packer1  | password: admin123');
      console.log('  • Pickup Admin : username: pickup1  | password: admin123');
      console.log('====================================================\n');
      return;
    }
  } catch (err) {
    console.error('\n❌ Terjadi kesalahan saat reset database:', err);
    throw err;
  } finally {
    try {
      client.release();
      await pool.end();
    } catch {
      // Pool might already be closed in full reset path
    }
  }
}

// Execute directly if run via CLI
const isMain = process.argv[1] && /db-reset\.(ts|js)$/.test(process.argv[1]);
if (isMain) {
  resetDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch(() => {
      process.exit(1);
    });
}
