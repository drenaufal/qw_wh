import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { authenticateRequest } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { sseManager } from '@/lib/sse';
import { TVAudioSettings } from '@/lib/types';

const DEFAULT_SETTINGS: TVAudioSettings = {
  enabled: true,
  preset: 'airport',
  volume: 0.8,
  customAudioBase64: null,
  customAudioName: null,
  triggers: {
    driverArrival: true,
    packingComplete: true,
    orderUpdate: true,
  },
};

export async function GET() {
  try {
    const res = await query(
      "SELECT value FROM system_settings WHERE key = 'tv_audio' LIMIT 1"
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ settings: DEFAULT_SETTINGS });
    }

    const settings = {
      ...DEFAULT_SETTINGS,
      ...res.rows[0].value,
      triggers: {
        ...DEFAULT_SETTINGS.triggers,
        ...(res.rows[0].value?.triggers || {}),
      },
    };

    return NextResponse.json({ settings });
  } catch (error: any) {
    console.error('Error fetching TV audio settings:', error);
    return NextResponse.json(
      { settings: DEFAULT_SETTINGS, error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    // RBAC: Only SUPERADMIN and PICKUP_ADMIN can modify sound settings
    const auth = await authenticateRequest(req, ['SUPERADMIN', 'PICKUP_ADMIN']);
    if ('errorResponse' in auth) {
      return auth.errorResponse;
    }
    const { user } = auth;

    const body = await req.json();
    const {
      enabled = true,
      preset = 'airport',
      volume = 0.8,
      customAudioBase64 = null,
      customAudioName = null,
      triggers = {
        driverArrival: true,
        packingComplete: true,
        orderUpdate: true,
      },
    } = body;

    const validPresets = ['airport', 'bell', 'elevator', 'marimba', 'digital', 'custom'];
    if (!validPresets.includes(preset)) {
      return NextResponse.json(
        { error: `Invalid preset. Must be one of: ${validPresets.join(', ')}` },
        { status: 400 }
      );
    }

    const clampedVolume = Math.min(1.0, Math.max(0.0, Number(volume) || 0.8));

    const updatedSettings: TVAudioSettings = {
      enabled: Boolean(enabled),
      preset,
      volume: clampedVolume,
      customAudioBase64: preset === 'custom' ? customAudioBase64 : null,
      customAudioName: preset === 'custom' ? customAudioName : null,
      triggers: {
        driverArrival: Boolean(triggers.driverArrival),
        packingComplete: Boolean(triggers.packingComplete),
        orderUpdate: Boolean(triggers.orderUpdate),
      },
    };

    // Save to database
    await query(
      `INSERT INTO system_settings (key, value, updated_at, updated_by)
       VALUES ('tv_audio', $1, NOW(), $2)
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value,
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by`,
      [JSON.stringify(updatedSettings), user.id]
    );

    // Audit log
    await logAudit({
      actor_type: 'USER',
      actor_user_id: user.id,
      actor_name: user.name,
      action: 'UPDATE_TV_AUDIO_SETTINGS',
      entity_type: 'SYSTEM_SETTINGS',
      new_values: updatedSettings,
      metadata: {
        preset: updatedSettings.preset,
        volume: updatedSettings.volume,
      },
    });

    // Real-time broadcast to all connected overhead TV screens
    sseManager.broadcast('tvAudioSettingsUpdate', updatedSettings);

    return NextResponse.json({
      success: true,
      settings: updatedSettings,
    });
  } catch (error: any) {
    console.error('Error updating TV audio settings:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update TV audio settings' },
      { status: 500 }
    );
  }
}
