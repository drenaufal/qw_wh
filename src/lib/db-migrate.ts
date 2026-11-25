import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// Multi-env loader: process.env -> .env.local -> .env.production -> .env
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

export async function runMigration() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL || connectionString,
  });

  const client = await pool.connect();
  const startTime = Date.now();

  try {
    console.log('========================================================');
    console.log('🚀 [DB MIGRATE] Starting PostgreSQL Schema Migration...');
    console.log('========================================================');

    await client.query('BEGIN');

    // 1. Extensions
    console.log('📦 [1/5] Checking database extensions...');
    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto";`);

    // 2. Base Tables
    console.log('📋 [2/5] Ensuring all core tables exist...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS roles (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        code VARCHAR(50) UNIQUE NOT NULL,
        name VARCHAR(100) NOT NULL,
        permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        role_id UUID NOT NULL REFERENCES roles(id),
        name VARCHAR(255) NOT NULL,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        last_login_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS drivers (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NULL,
        courier_company VARCHAR(100) NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS orders (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        external_order_id VARCHAR(255) NULL,
        order_number VARCHAR(100) UNIQUE NOT NULL,
        no_wsa VARCHAR(100) NULL,
        picking_no VARCHAR(100) NULL,
        courier_type VARCHAR(100) NULL,
        pickup_code VARCHAR(100) NULL,
        customer_name VARCHAR(255) NULL,
        courier_name VARCHAR(100) NULL,
        driver_id UUID NULL REFERENCES drivers(id),
        status VARCHAR(50) NOT NULL DEFAULT 'WAITING' CHECK (status IN ('WAITING','PACKING','READY_FOR_PICKUP','SHIP')),
        priority_status VARCHAR(50) NOT NULL DEFAULT 'NORMAL' CHECK (priority_status IN ('NORMAL','DRIVER_WAITING')),
        driver_arrived_at TIMESTAMPTZ NULL,
        packing_started_at TIMESTAMPTZ NULL,
        packed_at TIMESTAMPTZ NULL,
        shipped_at TIMESTAMPTZ NULL,
        driver_wait_duration_seconds INTEGER NULL,
        packing_duration_seconds INTEGER NULL,
        queue_number INTEGER NULL,
        dispatch_sync_status VARCHAR(50) DEFAULT 'PENDING',
        dispatch_sync_error TEXT NULL,
        dispatch_synced_at TIMESTAMPTZ NULL,
        dispatch_retry_count INTEGER DEFAULT 0,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        external_item_id VARCHAR(255) NULL,
        sku VARCHAR(100) NULL,
        size VARCHAR(50) NULL,
        warna VARCHAR(255) NULL,
        line_no INTEGER NULL,
        product_name VARCHAR(500) NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS driver_arrivals (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id),
        driver_id UUID NULL REFERENCES drivers(id),
        driver_name VARCHAR(255) NOT NULL,
        courier_company VARCHAR(100) NULL,
        arrived_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        recorded_by_type VARCHAR(50) NOT NULL DEFAULT 'DRIVER',
        recorded_by_user_id UUID NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS packing_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id),
        packer_id UUID NOT NULL REFERENCES users(id),
        started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        completed_at TIMESTAMPTZ NULL,
        notes TEXT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS packing_items (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        packing_session_id UUID NOT NULL REFERENCES packing_sessions(id) ON DELETE CASCADE,
        order_item_id UUID NOT NULL REFERENCES order_items(id),
        packed_quantity INTEGER NOT NULL CHECK (packed_quantity >= 0),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pickup_transactions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID UNIQUE NOT NULL REFERENCES orders(id),
        driver_name VARCHAR(255) NOT NULL,
        courier_company VARCHAR(100) NULL,
        picked_up_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        submitted_by_type VARCHAR(50) NOT NULL DEFAULT 'DRIVER',
        submitted_by_user_id UUID NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS pickup_photos (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        pickup_transaction_id UUID NOT NULL REFERENCES pickup_transactions(id),
        storage_key TEXT NOT NULL,
        mime_type VARCHAR(50) DEFAULT 'image/jpeg',
        file_size_bytes BIGINT NULL,
        width INTEGER NULL,
        height INTEGER NULL,
        captured_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS order_status_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id),
        from_status VARCHAR(50) NULL,
        to_status VARCHAR(50) NOT NULL,
        changed_by_type VARCHAR(50) NOT NULL,
        changed_by_user_id UUID NULL REFERENCES users(id),
        changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        metadata JSONB NULL
      );

      CREATE TABLE IF NOT EXISTS order_priority_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        order_id UUID NOT NULL REFERENCES orders(id),
        from_priority VARCHAR(50) NULL,
        to_priority VARCHAR(50) NOT NULL,
        changed_by_type VARCHAR(50) NOT NULL,
        changed_by_user_id UUID NULL REFERENCES users(id),
        changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        reason TEXT NULL
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_type VARCHAR(50) NOT NULL,
        actor_user_id UUID NULL REFERENCES users(id),
        actor_name VARCHAR(255) NULL,
        action VARCHAR(100) NOT NULL,
        entity_type VARCHAR(100) NOT NULL,
        entity_id UUID NULL,
        old_values JSONB NULL,
        new_values JSONB NULL,
        metadata JSONB NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS system_settings (
        key VARCHAR(100) PRIMARY KEY,
        value JSONB NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        updated_by UUID NULL REFERENCES users(id)
      );
    `);

    // 3. Incremental Column Migrations
    console.log('🔄 [3/5] Applying incremental column migrations...');
    await client.query(`
      -- Roles columns
      ALTER TABLE roles ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '[]'::jsonb;

      -- Orders columns
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS no_wsa VARCHAR(100);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS picking_no VARCHAR(100);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS courier_type VARCHAR(100);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_code VARCHAR(100);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS queue_number INTEGER;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_sync_status VARCHAR(50) DEFAULT 'PENDING';
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_sync_error TEXT NULL;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_synced_at TIMESTAMPTZ NULL;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatch_retry_count INTEGER DEFAULT 0;

      -- Order Items columns
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS size VARCHAR(50);
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS warna VARCHAR(255);
      ALTER TABLE order_items ADD COLUMN IF NOT EXISTS line_no INTEGER;

      -- Users columns
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ NULL;
    `);

    // 4. Performance Indexes
    console.log('⚡ [4/5] Creating performance indexes...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
      CREATE INDEX IF NOT EXISTS idx_orders_order_number ON orders(order_number);
      CREATE INDEX IF NOT EXISTS idx_orders_no_wsa ON orders(no_wsa);
      CREATE INDEX IF NOT EXISTS idx_orders_dispatch_sync_status ON orders(dispatch_sync_status);
      CREATE INDEX IF NOT EXISTS idx_orders_picking_no ON orders(picking_no);
      CREATE INDEX IF NOT EXISTS idx_orders_pickup_code ON orders(pickup_code);
      CREATE INDEX IF NOT EXISTS idx_orders_queue_number ON orders(queue_number);
      CREATE INDEX IF NOT EXISTS idx_order_items_sku ON order_items(sku);
      CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
      CREATE INDEX IF NOT EXISTS idx_orders_priority_status ON orders(priority_status);
      CREATE INDEX IF NOT EXISTS idx_orders_driver_arrived_at ON orders(driver_arrived_at);
      CREATE INDEX IF NOT EXISTS idx_orders_status_priority ON orders(status, priority_status);
      CREATE INDEX IF NOT EXISTS idx_driver_arrivals_order_id_arrived_at ON driver_arrivals(order_id, arrived_at);
      CREATE INDEX IF NOT EXISTS idx_packing_sessions_order_id ON packing_sessions(order_id);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
      CREATE INDEX IF NOT EXISTS idx_order_status_history_order_time ON order_status_history(order_id, changed_at);
      CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
    `);

    // 5. Seed Base Roles & System Settings
    console.log('🛡️  [5/5] Ensuring default roles & system settings...');
    await client.query(`
      INSERT INTO roles (code, name, permissions)
      VALUES 
        ('SUPERADMIN', 'Super Admin', '["/dashboard", "/packing", "/pickup-admin", "/orders", "/shipped-orders", "/status", "/kiosk", "/users", "/audit"]'::jsonb),
        ('PACKER', 'Packer', '["/dashboard", "/packing", "/orders", "/shipped-orders", "/status", "/kiosk"]'::jsonb),
        ('PICKUP_ADMIN', 'Pickup Admin', '["/dashboard", "/pickup-admin", "/orders", "/shipped-orders", "/status", "/kiosk"]'::jsonb)
      ON CONFLICT (code) DO UPDATE SET 
        name = EXCLUDED.name,
        permissions = CASE 
          WHEN roles.permissions IS NULL OR roles.permissions = '[]'::jsonb THEN EXCLUDED.permissions 
          ELSE roles.permissions 
        END;

      INSERT INTO system_settings (key, value)
      VALUES (
        'tv_audio',
        '{"enabled": true, "preset": "airport", "volume": 0.8, "customAudioBase64": null, "triggers": {"driverArrival": true, "packingComplete": true, "orderUpdate": true}}'::jsonb
      )
      ON CONFLICT (key) DO NOTHING;
    `);

    await client.query('COMMIT');

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log('========================================================');
    console.log(`✅ [DB MIGRATE] Migration completed successfully in ${duration}s!`);
    console.log('========================================================');
  } catch (error: any) {
    await client.query('ROLLBACK');
    console.error('❌ [DB MIGRATE ERROR]:', error.message || error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Auto-run if executed directly via CLI (tsx src/lib/db-migrate.ts)
if (require.main === module) {
  runMigration()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
