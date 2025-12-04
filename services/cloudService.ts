import { CloudConfig, FullBackup } from '../types';

export async function checkServerHealth(config: CloudConfig): Promise<{status: string, database?: string, message?: string, details?: string}> {
    if (!config.url) throw new Error("Missing Server URL");
    const baseUrl = config.url.replace(/\/$/, "");
    // Handle query params if already present in the user-provided URL
    const separator = baseUrl.includes('?') ? '&' : '?';
    const url = `${baseUrl}${separator}action=health`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                 ...(config.apiKey ? { 'Authorization': `Bearer ${config.apiKey}`, 'X-API-Key': config.apiKey } : {})
            }
        });
        
        const data = await response.json();
        if (!response.ok) {
             throw new Error(data.message || data.error || `Server error (${response.status})`);
        }
        return data;
    } catch (e) {
        console.error("Health check failed", e);
        throw e;
    }
}

export async function uploadData(config: CloudConfig, data: FullBackup): Promise<boolean> {
    if (!config.url) throw new Error("Missing Server URL");
    
    // Remove trailing slash if present for cleaner URL construction, though usually fetch handles it
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
        
        // Basic validation
        if (!data || typeof data !== 'object') {
            throw new Error("Invalid response format: Expected JSON object");
        }
        
        return data as FullBackup;
    } catch (e) {
        console.error("Download failed", e);
        throw e;
    }
}