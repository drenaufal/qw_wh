export type UserRole = 'SUPERADMIN' | 'PACKER' | 'PICKUP_ADMIN';

export type OrderStatus = 'WAITING' | 'PACKING' | 'READY_FOR_PICKUP' | 'SHIP';

export type PriorityStatus = 'NORMAL' | 'DRIVER_WAITING';

export interface User {
  id: string;
  role_id: string;
  role_code: UserRole;
  role_name: string;
  name: string;
  username: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  sku?: string | null;
  size?: string | null;
  warna?: string | null;
  line_no?: number | null;
  product_name: string;
  quantity: number;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  external_order_id?: string | null;
  order_number: string;
  no_wsa?: string | null;
  picking_no?: string | null;
  courier_type?: string | null;
  pickup_code?: string | null;
  customer_name: string | null;
  courier_name: string | null;
  driver_id?: string | null;
  driver_name?: string | null;
  driver_phone?: string | null;
  status: OrderStatus;
  priority_status: PriorityStatus;
  driver_arrived_at: string | null;
  packing_started_at: string | null;
  packed_at: string | null;
  shipped_at: string | null;
  driver_wait_duration_seconds: number | null;
  packing_duration_seconds: number | null;
  queue_number?: number | null;
  dispatch_sync_status?: 'PENDING' | 'SYNCED' | 'FAILED' | string;
  dispatch_sync_error?: string | null;
  dispatch_synced_at?: string | null;
  dispatch_retry_count?: number;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  current_packer_name?: string | null;
  pickup_transaction?: {
    id: string;
    driver_name: string;
    courier_company: string;
    picked_up_at: string;
    photo_key?: string;
  } | null;
}

export interface DriverArrival {
  id: string;
  order_id: string;
  driver_name: string;
  courier_company: string;
  arrived_at: string;
  recorded_by_type: 'DRIVER' | 'STAFF';
  recorded_by_user_id?: string | null;
  created_at: string;
}

export interface PackingSession {
  id: string;
  order_id: string;
  packer_id: string;
  packer_name?: string;
  started_at: string;
  completed_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PickupTransaction {
  id: string;
  order_id: string;
  driver_name: string;
  courier_company: string;
  picked_up_at: string;
  submitted_by_type: 'DRIVER' | 'STAFF';
  submitted_by_user_id?: string | null;
  created_at: string;
}

export interface PickupPhoto {
  id: string;
  pickup_transaction_id: string;
  storage_key: string; // base64 data url
  mime_type: string;
  file_size_bytes?: number | null;
  width?: number | null;
  height?: number | null;
  captured_at: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_type: 'SYSTEM' | 'USER' | 'DRIVER';
  actor_user_id?: string | null;
  actor_name?: string | null;
  action: string;
  entity_type: string;
  entity_id?: string | null;
  old_values?: any;
  new_values?: any;
  metadata?: any;
  created_at: string;
}

export interface DashboardStats {
  total_orders_today: number;
  waiting_count: number;
  packing_count: number;
  ready_count: number;
  shipped_count: number;
  driver_waiting_count: number;
}

export type SoundPreset = 'airport' | 'bell' | 'elevator' | 'marimba' | 'digital' | 'custom';

export interface TVAudioSettings {
  enabled: boolean;
  preset: SoundPreset;
  volume: number; // 0.1 to 1.0
  customAudioBase64?: string | null;
  customAudioName?: string | null;
  triggers: {
    driverArrival: boolean;
    packingComplete: boolean;
    orderUpdate: boolean;
  };
}

