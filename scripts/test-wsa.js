const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Load env
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

const dispatchUrl = env.EXTERNAL_DISPATCH_API_URL;
const basicUser = env.EXTERNAL_ORDER_API_USER;
const basicPass = env.EXTERNAL_ORDER_API_PASSWORD;

async function testWsa(wsa) {
  const credentials = `${basicUser}:${basicPass}`;
  const base64Auth = Buffer.from(credentials).toString('base64');

  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `Basic ${base64Auth}`,
  };

  const payload = { shipmentNo: wsa };
  console.log(`Sending createDispatch for ${wsa}...`);
  const res = await fetch(dispatchUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  console.log(`Status: ${res.status}`);
  console.log(`Response: ${text}`);
}

testWsa('WSA26P058834').catch(console.error);
