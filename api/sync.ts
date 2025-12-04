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
        return new Response(JSON.stringify({ error: 'Unauthorized: Invalid API Key' }), { status: 401, headers });
      }
    }

    const url = new URL(request.url);
    const action = url.searchParams.get('action');

    // Health Check / Database Connection Test
    if (action === 'health') {
        try {
            // Check if KV environment variables are present (basic check)
            if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
                 throw new Error("Missing KV Environment Variables");
            }

            // Verify KV connection by writing and reading a timestamp
            const timestamp = Date.now();
            await kv.set('health_check', timestamp);
            const val = await kv.get('health_check');
            
            if (Number(val) === timestamp) {
                return new Response(JSON.stringify({ 
                    status: 'ok', 
                    database: 'connected', 
                    message: 'Backend and Database (KV) operational',
                    timestamp 
                }), { status: 200, headers });
            } else {
                 return new Response(JSON.stringify({ 
                     status: 'error', 
                     database: 'mismatch', 
                     message: 'Database read/write verification failed.' 
                 }), { status: 503, headers });
            }
        } catch (dbError: any) {
            console.error("KV Error:", dbError);
            // Specific error guidance for the user
            return new Response(JSON.stringify({ 
                status: 'error', 
                database: 'disconnected',
                message: 'Database connection failed.', 
                details: dbError.message,
                hint: 'Please create a Vercel KV store in your Vercel Project > Storage tab.'
            }), { status: 503, headers });
        }
    }

    if (request.method === 'GET') {
      const data = await kv.get('warehouse_backup');
      return new Response(JSON.stringify(data || {}), { status: 200, headers });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      await kv.set('warehouse_backup', body);
      return new Response(JSON.stringify({ success: true, message: 'Data saved successfully' }), { status: 200, headers });
    }

    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
}