import { put, list } from '@vercel/blob';

// Using standard Node.js runtime for Vercel Functions
export default async function handler(request, response) {
  const BACKUP_FILENAME = 'warehouse_backup.json';
  
  // Configuration: Use Environment Variable or Fallback to provided token
  const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN || "vercel_blob_rw_8o6KtljWo845d7WJ_Z4Kr9dJFuFfAbAug7HBrZlwJA0CIcG";

  // Set CORS headers
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-API-Key');

  // Handle preflight request
  if (request.method === 'OPTIONS') {
    return response.status(200).end();
  }

  try {
    // Optional: Check for API Key if configured in Vercel Environment Variables
    const envApiKey = process.env.SYNC_API_KEY;
    if (envApiKey) {
      // In Node.js, headers are lowercase
      const authHeader = request.headers.authorization || request.headers['x-api-key'];
      const token = authHeader?.replace('Bearer ', '').trim();
      
      if (token !== envApiKey) {
        return response.status(401).json({ error: 'Unauthorized: Invalid API Key' });
      }
    }

    const { action } = request.query;

    // Health Check / Storage Connection Test
    if (action === 'health') {
        if (!BLOB_TOKEN) {
             return response.status(503).json({ 
                status: 'error', 
                database: 'disconnected',
                message: 'Vercel Blob token missing', 
                hint: 'Link a Vercel Blob store in Project Settings > Storage tab.'
            });
        }

        try {
            // Verify Blob access by listing files
            await list({ limit: 1, token: BLOB_TOKEN });
            
            return response.status(200).json({ 
                status: 'ok', 
                database: 'connected', 
                message: 'Vercel Blob Operational',
                timestamp: Date.now()
            });
        } catch (dbError: any) {
            console.error("Blob Error:", dbError);
            return response.status(503).json({ 
                status: 'error', 
                database: 'disconnected',
                message: 'Storage connection failed', 
                details: dbError.message,
                hint: 'Check your Vercel Blob credentials.'
            });
        }
    }

    if (request.method === 'GET') {
      // Find the backup file
      const { blobs } = await list({ prefix: BACKUP_FILENAME, limit: 1, token: BLOB_TOKEN });
      const backupFile = blobs.find(b => b.pathname === BACKUP_FILENAME);

      if (backupFile) {
          // Fetch the content from the Blob URL
          const fileResponse = await fetch(backupFile.url);
          const data = await fileResponse.json();
          return response.status(200).json(data);
      }
      
      // Return empty object if no backup exists yet
      return response.status(200).json({});
    }

    if (request.method === 'POST') {
      // In Vercel Node.js functions, request.body is already parsed for JSON content-types
      const body = request.body;
      
      // Save data to Blob storage, overwriting existing file
      await put(BACKUP_FILENAME, JSON.stringify(body), { 
          access: 'public', 
          addRandomSuffix: false, // Ensures we overwrite the file at the same path
          token: BLOB_TOKEN,
          contentType: 'application/json'
      });

      return response.status(200).json({ success: true, message: 'Data saved to Vercel Blob' });
    }

    return response.status(405).json({ error: 'Method not allowed' });

  } catch (error: any) {
    console.error("API Error:", error);
    return response.status(500).json({ error: error.message });
  }
}