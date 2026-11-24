import fs from 'fs';
import path from 'path';

function getDynamicEnv(key: string): string | undefined {
  if (process.env[key]) return process.env[key];
  try {
    const envFiles = ['.env.local', '.env.production', '.env'];
    for (const file of envFiles) {
      const envPath = path.resolve(process.cwd(), file);
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, 'utf8');
        const lines = content.split('\n');
        for (const line of lines) {
          const match = line.match(new RegExp(`^\\s*${key}\\s*=\\s*(.*)?\\s*$`));
          if (match) {
            const val = (match[1] || '').trim().replace(/^['"]|['"]$/g, '');
            if (val) return val;
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return process.env[key];
}

export interface DispatchResult {
  success: boolean;
  shipmentNo: string;
  statusCode?: number;
  data?: any;
  error?: string;
  timestamp: string;
}

export async function sendExternalDispatch(shipmentNo: string): Promise<DispatchResult> {
  const timestamp = new Date().toISOString();
  const cleanedShipmentNo = shipmentNo.trim();

  if (!cleanedShipmentNo) {
    return {
      success: false,
      shipmentNo,
      error: 'Nomor WSA (shipmentNo) kosong',
      timestamp,
    };
  }

  const endpointUrl =
    getDynamicEnv('EXTERNAL_DISPATCH_API_URL') ||
    'https://bc.panatradeprestasi.com:7248/UAT/api/panatrade/warehouse/v1.0/companies(fdc329b5-9a4a-ed11-ac38-81e458651713)/createDispatch';

  const basicUser = getDynamicEnv('EXTERNAL_ORDER_API_USER') || 'lsadmin';
  const basicPass = getDynamicEnv('EXTERNAL_ORDER_API_PASSWORD') || '';

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  if (basicUser || basicPass) {
    const credentials = `${basicUser}:${basicPass}`;
    const base64Auth = Buffer.from(credentials).toString('base64');
    headers['Authorization'] = `Basic ${base64Auth}`;
  }

  const payload = {
    shipmentNo: cleanedShipmentNo,
  };

  const timeoutMs = 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`Timeout ${timeoutMs}ms saat menghubungi ERP Dispatch API`));
  }, timeoutMs);

  try {
    console.log(`[EXTERNAL_DISPATCH] Sending createDispatch to ${endpointUrl} with shipmentNo: ${cleanedShipmentNo}`);
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const text = await res.text();
    let parsedData: any = null;
    try {
      parsedData = JSON.parse(text);
    } catch {
      parsedData = text;
    }

    if (res.ok) {
      console.log(`[EXTERNAL_DISPATCH] Success response (${res.status}):`, parsedData);
      return {
        success: true,
        shipmentNo: cleanedShipmentNo,
        statusCode: res.status,
        data: parsedData,
        timestamp,
      };
    } else {
      const errMsg =
        parsedData?.error?.message ||
        parsedData?.message ||
        (typeof parsedData === 'string' && parsedData ? parsedData.substring(0, 300) : `HTTP ${res.status} ${res.statusText}`);

      console.error(`[EXTERNAL_DISPATCH] Error response (${res.status}):`, errMsg);
      return {
        success: false,
        shipmentNo: cleanedShipmentNo,
        statusCode: res.status,
        data: parsedData,
        error: `ERP ${res.status}: ${errMsg}`,
        timestamp,
      };
    }
  } catch (err: any) {
    clearTimeout(timeoutId);
    console.error(`[EXTERNAL_DISPATCH] Network/Timeout error:`, err);
    return {
      success: false,
      shipmentNo: cleanedShipmentNo,
      error: err.name === 'AbortError' ? `Timeout (${timeoutMs / 1000}s) saat menghubungi ERP Dispatch` : err.message || 'Network error',
      timestamp,
    };
  }
}
