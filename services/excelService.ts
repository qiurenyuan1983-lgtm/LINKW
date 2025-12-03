import * as XLSX from 'xlsx';
import { UnloadPlan, UnloadPlanRow, LocationRule, OutboundRow, UnloadPlan as UnloadPlanType } from '../types';
import { AMZ_MAIN_LIST, AMZ_BUFFER_LIST, PLATFORM_LIST } from './dataService';

export function classifyDestinationForRule(dest: string): string {
  const raw = (dest || "").trim();
  const d = raw.toLowerCase();
  if (!d) return "other";

  // Exact match for Amazon lists
  if (AMZ_MAIN_LIST.some(mainDest => raw.toUpperCase().startsWith(mainDest))) return "amz-main";
  if (AMZ_BUFFER_LIST.some(bufferDest => raw.toUpperCase().startsWith(bufferDest))) return "amz-buffer";

  // Prioritize specific types before general ones
  if (d.includes("fedex") || d.includes("ups")) return "express";
  if (d.includes("希音") || d.includes("shein")) return "sehin";

  if (d.includes("住宅") || d.includes("私人") || d.includes("residential")) return "private";
  if (PLATFORM_LIST.some(p => d.includes(p.toLowerCase())) || d.includes('fbx') ) return "platform";
  
  // High value check
  if (raw.includes('$')) return "highvalue";
  
  // Fallback for other common patterns
  if (d.includes("amazon-")) return "amz-main"; // Assume unlisted are main
  if (/^[a-z]{3}\d$/i.test(raw)) return "amz-main";

  if (d.includes("暂扣") || d.includes("中转") || d.includes("仓储")) return "suspense";

  return "private"; // Default to private if no other rule matches
}

export function parseUnloadSheet(worksheet: XLSX.WorkSheet): UnloadPlan | null {
  const aoa = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
  if (!aoa || !aoa.length) {
    alert("表格内容为空");
    return null;
  }

  let containerNo = "";
  const containerRegex = /(柜号|container|cntr)/i;
  
  outerLoop: for (let i = 0; i < Math.min(15, aoa.length); i++) {
    const row = aoa[i] || [];
    for (let j = 0; j < row.length; j++) {
      const text = String(row[j] == null ? "" : row[j]).trim();
      if (containerRegex.test(text)) {
        if (text.includes(":") || text.includes("：")) {
            const split = text.split(/[:：]/);
            if(split[1] && split[1].trim()) {
                containerNo = split[1].trim();
                break outerLoop;
            }
        }
        if (j < row.length - 1) {
            const nextVal = String(row[j + 1] == null ? "" : row[j + 1]).trim();
            if(nextVal) {
                containerNo = nextVal;
                break outerLoop;
            }
        }
      }
    }
  }

  let headerRowIndex = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(30, aoa.length); i++) {
    const row = (aoa[i] || []).map(v => String(v == null ? "" : v).trim());
    if (!row.length) continue;
    if ( row.some(c => c.includes("派送地址")) || row.some(c => c.includes("目的地")) || row.some(c => c.toUpperCase() === "SO") ) {
      headerRowIndex = i;
      headers = row;
      break;
    }
  }

  if (headerRowIndex === -1) { return null; }

  const destIdx = headers.findIndex(h => /派送地址|目的地|destination|dest/i.test(h));
  const palletIdx = headers.findIndex(h => /PB数量|PB数|板数|预计板数|托盘|pallet/i.test(h));
  // Exact Copy: Check for existing "Location Arrangement" column to import
  const locationIdx = headers.findIndex(h => /库位安排|Location Arrangement/i.test(h));

  const soIdx = headers.findIndex(h => /^SO$/i.test(h));
  const shippingMarkIdx = headers.findIndex(h => /唛头|mark/i.test(h));
  const cartonsIdx = headers.findIndex(h => /箱数|carton|ctn|pcs/i.test(h));
  const weightIdx = headers.findIndex(h => /重量|weight|wt/i.test(h));
  const volumeIdx = headers.findIndex(h => /体积|volume|vol|cbm/i.test(h));

  if (destIdx === -1) { return null; }

  const rows: UnloadPlanRow[] = [];
  for (let i = headerRowIndex + 1; i < aoa.length; i++) {
    const row = aoa[i];
    if (!row || row.every(v => v == null || String(v).trim() === "")) continue;
    const dest = String(row[destIdx] || "").trim();
    let pallets = 1;
    if (palletIdx !== -1 && row[palletIdx] != null && String(row[palletIdx]).trim() !== "") {
      const pv = Number(row[palletIdx]);
      if (!Number.isNaN(pv) && pv > 0) pallets = pv;
    }
    
    // Read existing location if available
    let existingLocation = undefined;
    if (locationIdx !== -1 && row[locationIdx]) {
        existingLocation = String(row[locationIdx]).trim();
    }

    if (dest) {
        rows.push({ 
            raw: row.map(v => (v == null ? "" : v)), 
            dest, 
            pallets, 
            rowIndex: i, 
            containerNo,
            location: existingLocation, // Populate if imported
            so: soIdx !== -1 ? String(row[soIdx] || "").trim() : undefined,
            shippingMark: shippingMarkIdx !== -1 ? String(row[shippingMarkIdx] || "").trim() : undefined,
            cartons: cartonsIdx !== -1 ? Number(row[cartonsIdx]) || undefined : undefined,
            weight: weightIdx !== -1 ? Number(row[weightIdx]) || undefined : undefined,
            volume: volumeIdx !== -1 ? Number(row[volumeIdx]) || undefined : undefined,
        });
    }
  }
  return { headers, rows, headerRowIndex, worksheet, containerNo, workbook: null, sheetName: '' }; // workbook/sheetName populated by caller
}

// FIX: Updated slotting logic to prioritize V-zone for private/commercial and consolidate pallets more effectively.
export function assignLocationsForUnload(rows: UnloadPlanRow[], currentRules: LocationRule[], isManual: boolean = false): UnloadPlanRow[] {
  // 1. Separate rows that already have a location (from import) vs those needing assignment
  const rowsToAssign = rows.filter(r => !r.location);
  const rowsWithLocation = rows.filter(r => !!r.location);

  // 2. Pre-calculate total pallets per destination for this batch (only for rows needing assignment)
  const totalPalletsPerDest = rowsToAssign.reduce((acc, row) => {
    acc[row.dest] = (acc[row.dest] || 0) + row.pallets;
    return acc;
  }, {} as Record<string, number>);

  // 3. Create a mutable simulation of the warehouse state
  const capList = currentRules.map(r => ({
    range: r.range,
    type: r.type,
    destinations: r.destinations ? r.destinations.split(/[，,]/).map(t => t.trim()).filter(Boolean) : [],
    max: r.maxPallet,
    used: r.curPallet || 0,
    allowedDestCount: r.allowedDest,
  }));

  // 3b. Update simulation with already assigned locations (respect imported data)
  rowsWithLocation.forEach(row => {
      if (!row.location) return;
      const loc = capList.find(c => c.range === row.location);
      if (loc) {
          loc.used += row.pallets;
          if (!loc.destinations.includes(row.dest)) {
              loc.destinations.push(row.dest);
          }
      }
  });

  function findBestLocation(row: UnloadPlanRow) {
    const { dest, pallets } = row;
    const category = classifyDestinationForRule(dest);
    const totalPalletsForThisDest = totalPalletsPerDest[dest] || 0;

    let baseCandidatePool = capList;

    // V15: Mandatory zone logic for specific destination types on automatic import
    const isForcedAllocation = !isManual && (category === 'private' || category === 'platform');
    if (isForcedAllocation) {
        const forcedZones = ['V', 'H', 'F', 'R'];
        baseCandidatePool = capList.filter(c => {
            const prefix = c.range.charAt(0);
            if (forcedZones.includes(prefix)) {
                return true;
            }
            if (prefix === 'G') {
                const num = parseInt(c.range.slice(1), 10);
                if (!isNaN(num)) {
                    return num >= 5 && num <= 15;
                }
            }
            return false;
        });
    }


    // 3. Filter for valid candidate locations
    const candidates = baseCandidatePool.filter(c => {
      // Zone match
      let isZoneMatch = false;
      switch (category) {
        case 'amz-main':
          if (totalPalletsForThisDest > 20) isZoneMatch = c.type === 'amz-main-A';
          else isZoneMatch = c.type === 'amz-main-A' || c.type === 'amz-main-BC';
          break;
        case 'amz-buffer': isZoneMatch = c.type === 'amz-buffer'; break;
        case 'sehin': isZoneMatch = c.type === 'sehin'; break;
        case 'platform': isZoneMatch = c.type === 'platform'; break;
        case 'private': isZoneMatch = c.type === 'private'; break;
        case 'express': isZoneMatch = c.type === 'express'; break;
        case 'highvalue': isZoneMatch = c.type === 'highvalue'; break;
        case 'suspense': isZoneMatch = c.type === 'suspense'; break;
        default: isZoneMatch = c.type === 'private' || c.type === 'platform';
      }
      if (!isZoneMatch) return false;

      // Capacity check
      if (c.max !== null && c.used + pallets > c.max) return false;

      // Destination count check
      const hasDest = c.destinations.includes(dest);
      if (!hasDest && c.allowedDestCount !== null && c.destinations.length >= c.allowedDestCount) return false;

      return true;
    });

    // 4. Sort candidates by new priority
    candidates.sort((a, b) => {
        // Priority 1: Consolidation (already has this dest)
        const aHasDest = a.destinations.includes(dest);
        const bHasDest = b.destinations.includes(dest);
        if (aHasDest && !bHasDest) return -1;
        if (!aHasDest && bHasDest) return 1;

        // Priority 2: Modified Load Balancing
        const utilA = a.max ? a.used / a.max : 1;
        const utilB = b.max ? b.used / b.max : 1;
        
        if (aHasDest && bHasDest) {
            // If both are consolidating, prefer the fuller one to consolidate more aggressively.
            if (utilA !== utilB) return utilB - utilA;
        } else {
            // If neither is consolidating, prefer the emptier one to balance the load.
            if (utilA !== utilB) return utilA - utilB;
        }
        
        // Tie-breaker: Prefer locations with fewer unique destinations if not consolidating
        if (!aHasDest && !bHasDest) {
            if (a.destinations.length !== b.destinations.length) {
                return a.destinations.length - b.destinations.length;
            }
        }

        return 0;
    });
    
    const best = candidates[0];

    if (best) {
      // 5. Update simulation state for next iteration
      const bestInSim = capList.find(c => c.range === best.range);
      if (bestInSim) {
        bestInSim.used += pallets;
        if (!bestInSim.destinations.includes(dest)) {
          bestInSim.destinations.push(dest);
        }
      }
      return best.range;
    }
    
    // Fallback: If no ideal location, find the best available buffer/suspense zone
    const fallbackCandidates = capList.filter(c => {
      // Must be a fallback zone type
      if (c.type !== 'amz-buffer' && c.type !== 'suspense') return false;

      // Capacity check
      if (c.max !== null && c.used + pallets > c.max) return false;

      // Destination count check
      const hasDest = c.destinations.includes(dest);
      if (!hasDest && c.allowedDestCount !== null && c.destinations.length >= c.allowedDestCount) return false;
      
      return true;
    });

    if (fallbackCandidates.length > 0) {
      // Sort fallbacks by the same logic as primary candidates
      fallbackCandidates.sort((a, b) => {
        const aHasDest = a.destinations.includes(dest);
        const bHasDest = b.destinations.includes(dest);
        if (aHasDest && !bHasDest) return -1;
        if (!aHasDest && bHasDest) return 1;

        const utilA = a.max ? a.used / a.max : 1;
        const utilB = b.max ? b.used / b.max : 1;
        if (utilA !== utilB) return utilA - utilB;
        
        return a.destinations.length - b.destinations.length;
      });

      const fallback = fallbackCandidates[0];
      const fallbackInSim = capList.find(c => c.range === fallback.range);
      if (fallbackInSim) {
        fallbackInSim.used += pallets;
        if (!fallbackInSim.destinations.includes(dest)) {
          fallbackInSim.destinations.push(dest);
        }
        return fallbackInSim.range;
      }
    }

    return "";
  }

  // Combine rows: newly assigned + already existing
  const newlyAssigned = rowsToAssign.map(row => ({ ...row, location: findBestLocation(row) }));
  
  // Sort back by original index to maintain order
  return [...rowsWithLocation, ...newlyAssigned].sort((a, b) => a.rowIndex - b.rowIndex);
}

export function generateUnloadPlanSheet(plan: UnloadPlanType): XLSX.WorkSheet {
    const { worksheet, headers, headerRowIndex, rows } = plan;

    if (!worksheet) {
        throw new Error("Original worksheet is required to generate the plan.");
    }
    
    const locationHeader = '库位安排';
    // Find location column index from original headers
    let locationColIndex = headers.findIndex(h => /库位安排|Location Arrangement/i.test(h));
    
    // If column doesn't exist, add it to the header row
    if (locationColIndex === -1) {
        locationColIndex = headers.length; // It will be the next column
        const headerCellAddress = XLSX.utils.encode_cell({ r: headerRowIndex, c: locationColIndex });
        
        // This adds the new header to the worksheet object
        XLSX.utils.sheet_add_aoa(worksheet, [[locationHeader]], { origin: headerCellAddress });
        
        // Update worksheet's range to include the new column
        const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1");
        if (locationColIndex > range.e.c) {
            range.e.c = locationColIndex;
            worksheet['!ref'] = XLSX.utils.encode_range(range);
        }
    }
    
    // Add location data to each row
    rows.forEach(row => {
        if (row.location) {
            const cellAddress = XLSX.utils.encode_cell({ r: row.rowIndex, c: locationColIndex });
            // Create a cell object and add it to the worksheet
            const cell = { t: 's', v: row.location }; // 's' for string type
            worksheet[cellAddress] = cell;
        }
    });

    return worksheet;
}

export function parseOutboundSheet(aoa: any[][]): OutboundRow[] | null {
    // FIX: Corrected typo from aoo to aoa
    if (!aoa || aoa.length === 0) return null;

    let headerRowIndex = -1;
    let headers: string[] = [];
     for (let i = 0; i < Math.min(10, aoa.length); i++) {
        const row = (aoa[i] || []).map(v => String(v == null ? "" : v).trim());
        if (row.some(c => /库位|area|目的地|destination/i.test(c))) {
            headerRowIndex = i;
            headers = row;
            break;
        }
    }
    if (headerRowIndex === -1) { alert("Outbound sheet: Could not find header row."); return null; }
    
    const locIdx = headers.findIndex(h => /库位|area/i.test(h));
    const palletIdx = headers.findIndex(h => /板数|托盘|pallets/i.test(h));
    const destIdx = headers.findIndex(h => /目的地|destination/i.test(h));
    const containerIdx = headers.findIndex(h => /柜号|container/i.test(h));

    if (palletIdx === -1) { alert("Outbound sheet: Could not find 'Pallets' column."); return null; }
    if (destIdx === -1 && locIdx === -1) { alert("Outbound sheet: Must have 'Location' or 'Destination' column."); return null; }

    const rows: OutboundRow[] = [];
    for (let i = headerRowIndex + 1; i < aoa.length; i++) {
      const row = aoa[i];
      if (!row || row.every((v: any) => v == null || String(v).trim() === "")) continue;
      
      const pallets = Number(row[palletIdx]);
      if (isNaN(pallets) || pallets <= 0) continue;

      rows.push({ 
          dest: destIdx > -1 ? String(row[destIdx] || "").trim() : "",
          pallets,
          location: locIdx > -1 ? String(row[locIdx] || "").trim() : undefined,
          containerNo: containerIdx > -1 ? String(row[containerIdx] || "").trim() : undefined,
      });
    }
    return rows;
}


export function parseContainerMapSheet(json: any[]): { dest: string; containerNo: string }[] | null {
  if (!json || json.length === 0) return null;

  const firstRow = json[0];
  const destKey = Object.keys(firstRow).find(k => /destination|目的地/i.test(k));
  const containerKey = Object.keys(firstRow).find(k => /container|柜号/i.test(k));

  if (!destKey || !containerKey) {
    alert("Import failed: Could not find 'Destination'/'目的地' or 'Container'/'柜号' columns.");
    return null;
  }

  return json.map(row => {
    const dest = row[destKey];
    const container = row[containerKey];
    return (dest && container) ? { dest: String(dest).trim(), containerNo: String(container).trim() } : null;
  }).filter((item): item is { dest: string; containerNo: string } => item !== null);
}


export function parseInventorySheet(json: any[]): { location: string; pallets: number; max?: number }[] | null {
  if (!json || json.length === 0) return null;

  const firstRow = json[0];
  const locKey = Object.keys(firstRow).find(k => /location|库位|bin/i.test(k));
  const palletKey = Object.keys(firstRow).find(k => /pallets|托盘|quantity|数量/i.test(k));
  const maxKey = Object.keys(firstRow).find(k => /max|capacity|容量|最大/i.test(k));

  if (!locKey || !palletKey) {
    alert("Import failed: Could not find 'Location'/'库位' or 'Pallets'/'数量' columns.");
    return null;
  }

  return json.map(row => {
    const loc = row[locKey];
    const pallets = Number(row[palletKey]);
    const max = maxKey ? Number(row[maxKey]) : undefined;
    
    if (loc && !isNaN(pallets)) {
      return { location: String(loc).trim(), pallets, max: (max && !isNaN(max)) ? max : undefined };
    }
    return null;
// FIX: Corrected the type predicate to robustly filter nulls and resolve the type error.
  }).filter((item): item is NonNullable<typeof item> => item !== null);
}