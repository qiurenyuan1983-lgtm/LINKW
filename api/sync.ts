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
    const envApiKey = process.env.SYNC_API_KEY;
    if (envApiKey) {
      const authHeader = request.headers.get('Authorization') || request.headers.get('X-API-Key');
      const token = authHeader?.replace('Bearer ', '').trim();
      
      if (token !== envApiKey) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers });
      }
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    // Health Check / Database Connection Test
    if (action === 'health') {
        try {
            // Try to write and read from KV to ensure connection
            const timestamp = Date.now();
            await kv.set('health_check', timestamp);
            const val = await kv.get('health_check');
            
            if (val === timestamp) {
                return new Response(JSON.stringify({ status: 'ok', database: 'connected', timestamp }), { status: 200, headers });
            } else {
                 return new Response(JSON.stringify({ status: 'error', database: 'mismatch', message: 'Read/Write verification failed' }), { status: 500, headers });
            }
        } catch (dbError: any) {
            console.error("KV Error:", dbError);
            return new Response(JSON.stringify({ 
                status: 'error', 
                message: 'Database connection failed', 
                details: dbError.message,
                hint: 'Ensure Vercel KV is linked to this project.'
            }), { status: 500, headers });
        }
    }

    if (request.method === 'GET') {
      const data = await kv.get('warehouse_backup');
      return new Response(JSON.stringify(data || {}), { status: 200, headers });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      await kv.set('warehouse_backup', body);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
}