import { CloudConfig, FullBackup } from '../types';

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