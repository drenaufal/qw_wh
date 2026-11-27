export interface MenuItemDefinition {
  key: string;
  name: string;
  path: string;
  description: string;
  badge?: string;
  external?: boolean;
}

export const AVAILABLE_MENUS: MenuItemDefinition[] = [
  {
    key: 'DASHBOARD',
    name: 'Dashboard Operasional',
    path: '/dashboard',
    description: 'Statistik real-time, grafik antrian, dan ringkasan operasional harian',
    badge: 'LIVE',
  },
  {
    key: 'PACKING',
    name: 'Meja Packing',
    path: '/packing',
    description: 'Stasiun pengepakan barang ke kardus/kemasan ekspedisi',
    badge: 'STASIUN',
  },
  {
    key: 'PICKUP_ADMIN',
    name: 'Loket Pickup Driver',
    path: '/pickup-admin',
    description: 'Manajemen rak loket, verifikasi pickup, dan serah terima paket kurir',
    badge: 'DOCK',
  },
  {
    key: 'ORDERS',
    name: 'Antrian Order Aktif',
    path: '/orders',
    description: 'Daftar semua pesanan yang sedang diproses di gudang',
    badge: 'ANTREAN',
  },
  {
    key: 'SHIPPED_ORDERS',
    name: 'Riwayat Terkirim',
    path: '/shipped-orders',
    description: 'Arsip bukti foto serah terima dan riwayat pesanan selesai',
    badge: 'BUKTI',
  },
  {
    key: 'STATUS_MONITOR',
    name: 'Layar Monitor TV',
    path: '/status',
    description: 'Tampilan display antrian overhead untuk ruang tunggu kurir',
    badge: 'OVERHEAD',
    external: true,
  },
  {
    key: 'STATUS_PICKUP_MONITOR',
    name: 'Monitor Pickup & Penerima',
    path: '/status-pickup',
    description: 'Layar display antrian dengan kode pickup besar dan nama penerima yang diperjelas',
    badge: 'PICKUP TV',
    external: true,
  },
  {
    key: 'KIOSK',
    name: 'Kiosk Kedatangan Driver',
    path: '/kiosk',
    description: 'Layar sentuh mandiri check-in & foto bukti oleh kurir',
    badge: 'TOUCH',
    external: true,
  },
  {
    key: 'USERS',
    name: 'Kelola Akun & Peran',
    path: '/users',
    description: 'Manajemen akun staf, pembuatan role baru, dan konfigurasi hak akses menu',
    badge: 'AKSES',
  },
  {
    key: 'AUDIT',
    name: 'Log Audit Sistem',
    path: '/audit',
    description: 'Catatan rekam jejak aktivitas login, perubahan data, dan operasional',
    badge: 'LOG',
  },
];
