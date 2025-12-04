import { kv } from '@vercel/kv';

export const config = {
  runtime: 'edge',
};

export default async function handler(request: Request) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  try {
    // Optional: Check for API Key if configured in Vercel Environment Variables
    // Configure SYNC_API_KEY in your Vercel Project Settings to enable protection
    const envApiKey = process.env.SYNC_API_KEY;
    if (envApiKey) {
      const authHeader = request.headers.get('Authorization') || request.headers.get('X-API-Key');
      const token = authHeader?.replace('Bearer ', '').trim();
      
      if (token !== envApiKey) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
      }
    }

    if (request.method === 'POST') {
      const body = await request.json();
      
      // Basic validation ensuring it looks like our backup data
      if (!body || !body.timestamp || !body.version) {
        return new Response(JSON.stringify({ error: 'Invalid data payload' }), { status: 400, headers });
      }

      // Store data in Vercel KV
      // We use a fixed key 'warehouse_data' for simplicity. 
      await kv.set('warehouse_data', body);

      return new Response(JSON.stringify({ success: true, timestamp: Date.now() }), { status: 200, headers });
    }

    if (request.method === 'GET') {
      const data = await kv.get('warehouse_data');
      
      if (!data) {
        return new Response(JSON.stringify({ error: 'No data found' }), { status: 404, headers });
      }

      return new Response(JSON.stringify(data), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  } catch (error) {
    console.error('Sync Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers });
  }
}