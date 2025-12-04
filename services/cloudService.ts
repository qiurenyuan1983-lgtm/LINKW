import { CloudConfig, FullBackup } from '../types';

export async function checkServerHealth(config: CloudConfig): Promise<{status: string, database?: string, message?: string, details?: string, hint?: string}> {
    if (!config.url) throw new Error("Missing Server URL");
    const baseUrl = config.url.replace(/\/$/, "");
    const separator = baseUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${separator}action=health`;

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                 ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}`, 'X-API-Key': config.apiKey } : {})
            },
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        const data = await response.json();
        
        // Return data even if response is not OK, so we can see the error details (hints) from the server
        // The backend specifically returns 503 for DB errors with a JSON body
        if (!response.ok && !data.status) {
             throw new Error(`Server error (${response.status})`);
        }
        return data;
    } catch (e: any) {
        console.error("Health check failed", e);
        if (e.name === 'AbortError') {
            throw new Error("Connection timed out. Check your URL.");
        }
        throw e;
    }
}

export async function uploadData(config: CloudConfig, data: FullBackup): Promise<boolean> {
    if (!config.url) throw new Error("Missing Server URL");
    
    const url = config.url.replace(/\/$/, "");

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}`, 'X-API-Key': config.apiKey } : {})
            },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorText = await response.text().catch(() => response.statusText);
            throw new Error(`Server error (${response.status}): ${errorText}`);
        }
        return true;
    } catch (e) {
        console.error("Upload failed", e);
        throw e;
    }
}

export async function downloadData(config: CloudConfig): Promise<FullBackup> {
     if (!config.url) throw new Error("Missing Server URL");
     
     const url = config.url.replace(/\/$/, "");

     try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                 ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}`, 'X-API-Key': config.apiKey } : {})
            }
        });
        
        if (!response.ok) {
             const errorText = await response.text().catch(() => response.statusText);
             throw new Error(`Server error (${response.status}): ${errorText}`);
        }
        
        const data = await response.json();
        
        if (!data || typeof data !== 'object') {
            throw new Error("Invalid response format: Expected JSON object");
        }
        
        return data as FullBackup;
    } catch (e) {
        console.error("Download failed", e);
        throw e;
    }
}