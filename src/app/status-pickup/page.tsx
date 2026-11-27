'use client';

import { OverheadStatusBoard } from '@/components/OverheadStatusBoard';

export default function PickupTVStatusPage() {
  return (
    <OverheadStatusBoard
      title="Monitor Antrian & Pickup Code"
      badgeLabel="PICKUP DISPLAY"
      storageKey="wh_tv_pickup_column_settings_v1"
      showPickupCodeAndLargeCustomer={true}
    />
  );
}
