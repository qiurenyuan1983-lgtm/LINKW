
import * as XLSX from 'xlsx';
import { UnloadPlan, UnloadPlanRow, LocationRule, OutboundRow, UnloadPlan as UnloadPlanType } from '../types';
import { AMZ_MAIN_LIST, AMZ_BUFFER_LIST, PLATFORM_LIST } from './dataService';

// Normalize destination code for better matching (e.g. "Amazon-MDW2" == "MDW2")
export function normalizeDestinationCode(dest: string): string {
    if (!dest) return "";
    return dest.trim().toLowerCase()
        .replace(/^(amazon|amz|fba)[\s-:]*/i, '') // Remove prefixes
        .replace(/[\s-]/g, ''); // Remove spaces and hyphens
}

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
  
  // Try to find container number in first few rows
  outerLoop: for (let i = 0; i < Math.min(15, aoa.length); i++) {
    const row = aoa[i] || [];
    for (let j = 0; j < row.length; j++) {
      const text = String(row[j] == null ? "" : row[j]).trim();
      if (containerRegex.test(text)) {
        // Case 1: "Container: ABCD1234567"
        if (text.includes(":") || text.includes("：")) {
            const split = text.split(/[:：]/);
            if(split[1] && split[1].trim()) {
                containerNo = split[1].trim();
                break outerLoop;
            }
        }
        // Case 2: Cell A: "Container", Cell B: "ABCD1234567"
        if (j < row.length - 1) {
            const nextVal = String(row[j + 1] == null ? "" : row[j + 1]).trim();
            if(nextVal && nextVal.length > 4) { // Basic length check
                containerNo = nextVal;
                break outerLoop;
            }
        }
      }
    }
  }

  // Find Header Row
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

  // Column Mapping
  const destIdx = headers.findIndex(h => /派送地址|目的地|destination|dest/i.test(h));
  const palletIdx = headers.findIndex(h => /PB数量|PB数|板数|预计板数|托盘|pallet/i.test(h));
  const locationIdx = headers.findIndex(h => /库位安排|Location Arrangement/i.test(h));
  const soIdx = headers.findIndex(h => /^SO$/i.test(h));
  const shippingMarkIdx = headers.findIndex(h => /唛头|mark/i.test(h));
  const cartonsIdx = headers.findIndex(h => /箱数|carton|ctn|pcs/i.test(h));
  const weightIdx = headers.findIndex(h => /重量|weight|wt/i.test(h));
  const volumeIdx = headers.findIndex(h => /体积|volume|vol|cbm/i.test(h));

  if (destIdx === -1) { return null; }

  const rows: UnloadPlanRow[] = [];
  let currentEntry: UnloadPlanRow | null = null;

  for (let i = headerRowIndex + 1; i < aoa.length; i++) {
    const row = aoa[i];
    // Skip totally empty rows
    if (!row || row.every(v => v == null || String(v).trim() === "")) continue;

    const rawDest = row[destIdx];
    const destText = rawDest ? String(rawDest).trim() : "";
    const rawLocation = (locationIdx !== -1 && row[locationIdx] != null) ? String(row[locationIdx]).trim() : "";

    // IMPORTANT: Skip the "库位按派" remark row if it exists
    // Check if the destination column OR the location column contains the keyword
    if (destText.includes("库位按派") || rawLocation.includes("库位按派")) {
        continue;
    }
    
    // Parse numeric fields safely
    const rowPallets = (palletIdx !== -1 && row[palletIdx] != null) ? Number(row[palletIdx]) : NaN;
    const rowCartons = (cartonsIdx !== -1 && row[cartonsIdx] != null) ? Number(row[cartonsIdx]) : NaN;
    const rowSo = (soIdx !== -1 && row[soIdx] != null) ? String(row[soIdx]).trim() : "";
    const rowMark = (shippingMarkIdx !== -1 && row[shippingMarkIdx] != null) ? String(row[shippingMarkIdx]).trim() : "";
    const rowWeight = (weightIdx !== -1 && row[weightIdx] != null) ? Number(row[weightIdx]) : NaN;
    const rowVolume = (volumeIdx !== -1 && row[volumeIdx] != null) ? Number(row[volumeIdx]) : NaN;

    if (destText && destText !== "——") {
        // New Destination Group detected. Push previous entry if it exists.
        if (currentEntry) {
            rows.push(currentEntry);
        }

        currentEntry = { 
            raw: row.map(v => (v == null ? "" : v)), 
            dest: destText, 
            pallets: (!isNaN(rowPallets) && rowPallets > 0) ? rowPallets : 1, // Default to 1 if missing/invalid
            rowIndex: i, 
            containerNo,
            location: rawLocation || undefined,
            so: rowSo,
            shippingMark: rowMark,
            cartons: !isNaN(rowCartons) ? rowCartons : 0,
            weight: !isNaN(rowWeight) ? rowWeight : 0,
            volume: !isNaN(rowVolume) ? rowVolume : 0,
        };
    } else {
        // Empty destination -> Continuation of previous entry (Merged cell behavior)
        if (currentEntry) {
            // Aggregate Cartons
            if (!isNaN(rowCartons)) {
                currentEntry.cartons = (currentEntry.cartons || 0) + rowCartons;
            }
            // Aggregate Weight/Volume
            if (!isNaN(rowWeight)) {
                currentEntry.weight = (currentEntry.weight || 0) + rowWeight;
            }
            if (!isNaN(rowVolume)) {
                currentEntry.volume = (currentEntry.volume || 0) + rowVolume;
            }
            // Merge Locations if multiple rows have locations
            if (rawLocation) {
                 const currentLocs = (currentEntry.location || "").split(/[,，]/).map(s => s.trim()).filter(Boolean);
                 if (!currentLocs.includes(rawLocation)) {
                     currentEntry.location = currentLocs.concat(rawLocation).join(', ');
                 }
            }
            // Note: We do NOT sum pallets from subsequent rows as standard Excel structure usually 
            // places the total pallet count for the group in the merged cell (first row).
        }
    }
  }
  
  // Push the final entry
  if (currentEntry) {
      rows.push(currentEntry);
  }

  // Pass worksheet as is, do not create a new one to preserve round-trip data
  return { headers, rows, headerRowIndex, worksheet, containerNo, workbook: null, sheetName: '' };
}

// Updated slotting logic to split pallets across multiple locations and merge results.
export function assignLocationsForUnload(rows: UnloadPlanRow[], currentRules: LocationRule[], isManual: boolean = false): UnloadPlanRow[] {
  // 1. Separate rows that already have a location (from import) vs those needing assignment
  const rowsToAssign = rows.filter(r => !r.location);
  const rowsWithLocation = rows.filter(r => !!r.location);

  // OPTIMIZATION: Sort rowsToAssign by Destination (normalized) 
  // This ensures that all pallets for the same destination are processed continuously,
  // maximizing the effectiveness of the consolidation logic.
  rowsToAssign.sort((a, b) => {
      const destA = normalizeDestinationCode(a.dest);
      const destB = normalizeDestinationCode(b.dest);
      if (destA !== destB) return destA.localeCompare(destB);
      // Secondary sort: Larger pallet counts first to fill bins efficiently
      return b.pallets - a.pallets;
  });

  // 2. Pre-calculate total pallets per destination for this batch
  const totalPalletsPerDest = rowsToAssign.reduce((acc, row) => {
    acc[row.dest] = (acc[row.dest] || 0) + row.pallets;
    return acc;
  }, {} as Record<string, number>);

  // 3. Create a mutable simulation of the warehouse state
  const capList = currentRules.map(r => ({
    range: r.range,
    type: r.type,
    destinations: r.destinations ? r.destinations.split(/[，,]/).map(t => t.trim()).filter(Boolean) : [],
    max: r.maxPallet || 0,
    used: r.curPallet || 0,
    allowedDestCount: r.allowedDest,
    // Track containers in simulation for grouping logic
    containers: r.containers ? { ...r.containers } : {} as Record<string, number>
  }));

  // 3b. Update simulation with already assigned locations (respect imported data)
  rowsWithLocation.forEach(row => {
      if (!row.location) return;
      // Handle comma-separated locations (e.g. "A01, A02")
      const locs = row.location.split(/[,，]/).map(s => s.trim()).filter(Boolean);
      
      // Distribute usage estimate (simplified)
      const count = locs.length || 1;
      const palletsPerLoc = Math.ceil(row.pallets / count);

      locs.forEach(locName => {
          const loc = capList.find(c => c.range === locName);
          if (loc) {
              loc.used += palletsPerLoc;
              // Add normalized destination check
              const normDest = normalizeDestinationCode(row.dest);
              if (!loc.destinations.some(d => normalizeDestinationCode(d) === normDest)) {
                  loc.destinations.push(row.dest);
              }
              // Update container stats in simulation
              if (row.containerNo) {
                  loc.containers[row.containerNo] = (loc.containers[row.containerNo] || 0) + palletsPerLoc;
              }
          }
      });
  });

  function getBestCandidates(dest: string, palletsToPlace: number, rowContainer?: string) {
      const category = classifyDestinationForRule(dest);
      const totalPalletsForThisDest = totalPalletsPerDest[dest] || palletsToPlace;
      const normDest = normalizeDestinationCode(dest); // Robust matching

      let baseCandidatePool = capList;

      // Mandatory zone logic for Private/Platform (manual override logic)
      const isForcedAllocation = !isManual && (category === 'private' || category === 'platform');
      if (isForcedAllocation) {
          const forcedZones = ['V', 'H', 'F', 'R'];
          baseCandidatePool = capList.filter(c => {
              const prefix = c.range.charAt(0);
              if (forcedZones.includes(prefix)) return true;
              if (prefix === 'G') {
                  const num = parseInt(c.range.slice(1), 10);
                  if (!isNaN(num)) return num >= 5 && num <= 15;
              }
              return false;
          });
      }

      // Filter for valid candidate locations
      const candidates = baseCandidatePool.filter(c => {
          // Priority 1: Does this location ALREADY have this destination?
          // If yes, we want to allow it regardless of strict Zone Type matching to ensure consolidation.
          const hasDest = c.destinations.some(d => normalizeDestinationCode(d) === normDest);

          let isZoneMatch = false;
          switch (category) {
              case 'amz-main':
                  // Large shipments prefer Zone A, smaller ones can go to BC
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
          
          // Consolidate: If location already has this tag, bypass strict zone restrictions
          if (hasDest) isZoneMatch = true;

          if (!isZoneMatch) return false;

          // Must have SOME space
          if (c.max > 0 && c.used >= c.max) return false;

          // Destination count check (only for NEW destinations in this bin)
          if (!hasDest && c.allowedDestCount !== null && c.destinations.length >= c.allowedDestCount) return false;

          return true;
      });

      // Smart Sorting for Candidates
      candidates.sort((a, b) => {
          const aHasDest = a.destinations.some(d => normalizeDestinationCode(d) === normDest);
          const bHasDest = b.destinations.some(d => normalizeDestinationCode(d) === normDest);
          
          // 0. Same Container Continuity (New Priority)
          // If we are placing the same container, prioritize locations that already have it (if mixed/split)
          if (rowContainer) {
             const aHasContainer = a.containers && a.containers[rowContainer] > 0;
             const bHasContainer = b.containers && b.containers[rowContainer] > 0;
             if (aHasContainer && !bHasContainer) return -1;
             if (!aHasContainer && bHasContainer) return 1;
          }

          // 1. Consolidation Priority: Existing Destination Tag wins
          if (aHasDest && !bHasDest) return -1;
          if (!aHasDest && bHasDest) return 1;

          const utilA = a.max ? a.used / a.max : 1;
          const utilB = b.max ? b.used / b.max : 1;
          
          if (aHasDest && bHasDest) {
              // 2. If both have dest: Fill the fullest bin first (descending utilization) to clear space elsewhere/compact storage
              if (Math.abs(utilA - utilB) > 0.01) return utilB - utilA; 
          } else {
              // 3. If neither have dest: Prefer empty bins to avoid mixing, 
              // UNLESS the bin already has fewer destinations than another.
              
              // Prefer bins with fewer existing destination tags (Cleaner bins)
              if (a.destinations.length !== b.destinations.length) {
                  return a.destinations.length - b.destinations.length;
              }
              
              // Then prefer lower utilization (Emptiest) to maximize available contiguous space
              if (Math.abs(utilA - utilB) > 0.01) return utilA - utilB; 
          }
          
          // 4. Alpha sort for predictability
          return a.range.localeCompare(b.range, undefined, {numeric: true});
      });

      return candidates;
  }
  
  function getFallbackCandidates(dest: string, rowContainer?: string) {
       const normDest = normalizeDestinationCode(dest);
       return capList.filter(c => {
          // Fallback to Buffer or Suspense zones
          if (c.type !== 'amz-buffer' && c.type !== 'suspense') return false;
          if (c.max > 0 && c.used >= c.max) return false;
          
          const hasDest = c.destinations.some(d => normalizeDestinationCode(d) === normDest);
          if (!hasDest && c.allowedDestCount !== null && c.destinations.length >= c.allowedDestCount) return false;
          
          return true;
       }).sort((a, b) => {
            // 0. Container Continuity
            if (rowContainer) {
                const aHasContainer = a.containers && a.containers[rowContainer] > 0;
                const bHasContainer = b.containers && b.containers[rowContainer] > 0;
                if (aHasContainer && !bHasContainer) return -1;
                if (!aHasContainer && bHasContainer) return 1;
            }
            // Simple sort: Has Dest > Emptiest
            const aHasDest = a.destinations.some(d => normalizeDestinationCode(d) === normDest);
            const bHasDest = b.destinations.some(d => normalizeDestinationCode(d) === normDest);
            if (aHasDest && !bHasDest) return -1;
            if (!aHasDest && bHasDest) return 1;
            const utilA = a.max ? a.used / a.max : 1;
            const utilB = b.max ? b.used / b.max : 1;
            return utilA - utilB;
       });
  }

  // Iterate rows and assign (possibly splitting)
  const newlyAssigned = rowsToAssign.map(row => {
      let remaining = row.pallets;
      const assignments: { location: string; pallets: number; cartons: number }[] = [];
      const totalCartons = row.cartons || 0;
      const normDest = normalizeDestinationCode(row.dest);

      // Try primary candidates
      let candidates = getBestCandidates(row.dest, remaining, row.containerNo);
      
      // If no primaries, try fallback
      if (candidates.length === 0) {
          candidates = getFallbackCandidates(row.dest, row.containerNo);
      }

      for (const cand of candidates) {
          if (remaining <= 0) break;
          const available = cand.max - cand.used;
          if (available <= 0) continue;

          const take = Math.min(available, remaining);
          
          // Calculate proportional cartons
          let takeCartons = 0;
          if (totalCartons > 0 && row.pallets > 0) {
              takeCartons = Math.floor((take / row.pallets) * totalCartons);
          }

          // Update simulation state
          const candInSim = capList.find(c => c.range === cand.range);
          if (candInSim) {
              candInSim.used += take;
              // Check case-insensitive existence before adding tag
              if (!candInSim.destinations.some(d => normalizeDestinationCode(d) === normDest)) {
                  candInSim.destinations.push(row.dest);
              }
              // Track container in simulation
              if (row.containerNo) {
                  candInSim.containers[row.containerNo] = (candInSim.containers[row.containerNo] || 0) + take;
              }
          }

          assignments.push({ location: cand.range, pallets: take, cartons: takeCartons });
          remaining -= take;
      }
      
      // If still remaining (overflow), force overflow on best match (usually the first candidate even if full)
      if (remaining > 0 && candidates.length > 0) {
           const fallbackCand = candidates[0]; 
           const candInSim = capList.find(c => c.range === fallbackCand.range);
           if (candInSim) {
                candInSim.used += remaining;
                if (!candInSim.destinations.some(d => normalizeDestinationCode(d) === normDest)) {
                    candInSim.destinations.push(row.dest);
                }
                if (row.containerNo) {
                    candInSim.containers[row.containerNo] = (candInSim.containers[row.containerNo] || 0) + remaining;
                }
           }
           // Add to existing assignment or new
           const existIdx = assignments.findIndex(a => a.location === fallbackCand.range);
           const remCartons = totalCartons > 0 ? Math.ceil((remaining / row.pallets) * totalCartons) : 0;
           
           if (existIdx >= 0) {
               assignments[existIdx].pallets += remaining;
               assignments[existIdx].cartons += remCartons;
           } else {
               assignments.push({ location: fallbackCand.range, pallets: remaining, cartons: remCartons });
           }
           remaining = 0;
      }
      
      // Fix carton rounding errors (assign remainder to first assignment)
      if (totalCartons > 0 && assignments.length > 0) {
          const assignedCartons = assignments.reduce((s, a) => s + a.cartons, 0);
          const diff = totalCartons - assignedCartons;
          if (diff !== 0) {
              assignments[0].cartons += diff;
          }
      }

      const locString = assignments.map(a => a.location).join(', ');
      return { ...row, location: locString, assignments };
  });

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
        
        // This adds the new header to the worksheet object.
        const headerCell: XLSX.CellObject = { t: 's', v: locationHeader };
        worksheet[headerCellAddress] = headerCell;
    }
    
    // Update worksheet's range to include the new column
    const range = XLSX.utils.decode_range(worksheet['!ref'] || "A1");
    if (locationColIndex > range.e.c) {
        range.e.c = locationColIndex;
    }

    let lastRowIndex = headerRowIndex;

    // Add location data to each row
    rows.forEach(row => {
        const cellAddress = XLSX.utils.encode_cell({ r: row.rowIndex, c: locationColIndex });
        const cell: XLSX.CellObject = { t: 's', v: row.location || '' };
        worksheet[cellAddress] = cell;
        
        if (row.rowIndex > lastRowIndex) {
            lastRowIndex = row.rowIndex;
        }
    });

    // --- APPEND REMARK ROW ---
    const remarkRowIndex = lastRowIndex + 1;
    
    // Update range to include the new remark row
    if (remarkRowIndex > range.e.r) {
        range.e.r = remarkRowIndex;
    }
    
    // Fill specific columns: Destination, Pallets, Cartons, Location
    const destIdx = headers.findIndex(h => /派送地址|目的地|destination|dest/i.test(h));
    const palletIdx = headers.findIndex(h => /PB数量|PB数|板数|预计板数|托盘|pallet/i.test(h));
    const cartonsIdx = headers.findIndex(h => /箱数|carton|ctn|pcs/i.test(h));
    
    const remarkRowData = [
        { idx: destIdx, val: "——" },
        { idx: palletIdx, val: "——" },
        { idx: cartonsIdx, val: "——" },
        { idx: locationColIndex, val: "库位按派" }
    ];
    
    remarkRowData.forEach(item => {
        if (item.idx !== -1) {
            const addr = XLSX.utils.encode_cell({ r: remarkRowIndex, c: item.idx });
            worksheet[addr] = { t: 's', v: item.val };
        }
    });

    // --- STYLING (Applied to cell properties) ---
    // Note: Standard XLSX CE writes may strip these unless supported by the environment/version.
    
    // 1. Table Title (A1) - Size 36, Bold, Center
    // Assume title is at A1 or merged covering A1
    const titleCell = worksheet['A1'];
    if (titleCell) {
        if (!titleCell.s) titleCell.s = {};
        titleCell.s.font = { sz: 36, bold: true, name: "Calibri" };
        titleCell.s.alignment = { horizontal: "center", vertical: "center" };
    }

    // 2. Grid Borders & Header Bold
    const borderStyle = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" }
    };

    // Determine the full range of the table we want to style
    // From headerRowIndex to remarkRowIndex, columns 0 to locationColIndex
    for (let r = headerRowIndex; r <= remarkRowIndex; r++) {
        for (let c = 0; c <= locationColIndex; c++) {
            const cellRef = XLSX.utils.encode_cell({ r, c });
            let cell = worksheet[cellRef];
            
            // Ensure cell exists for border continuity
            if (!cell) {
                cell = { t: 's', v: '' };
                worksheet[cellRef] = cell;
            }
            
            if (!cell.s) cell.s = {};
            
            // Apply Borders
            cell.s.border = borderStyle;
            
            // Apply Bold to Header Row
            if (r === headerRowIndex) {
                cell.s.font = { bold: true };
                // Center align headers
                cell.s.alignment = { horizontal: "center", vertical: "center", wrapText: true };
            }
            
            // Center align the remark row text
            if (r === remarkRowIndex) {
                 cell.s.alignment = { horizontal: "center", vertical: "center" };
            }
        }
    }

    // Finalize range
    worksheet['!ref'] = XLSX.utils.encode_range(range);

    return worksheet;
}

export function parseOutboundSheet(aoa: any[][]): OutboundRow[] | null {
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
    const cartonsIdx = headers.findIndex(h => /箱数|件数|items|carton|ctn|pcs/i.test(h));

    if (palletIdx === -1) { alert("Outbound sheet: Could not find 'Pallets' column."); return null; }
    if (destIdx === -1 && locIdx === -1) { alert("Outbound sheet: Must have 'Location' or 'Destination' column."); return null; }

    const rows: OutboundRow[] = [];
    for (let i = headerRowIndex + 1; i < aoa.length; i++) {
      const row = aoa[i];
      if (!row || row.every((v: any) => v == null || String(v).trim() === "")) continue;
      
      const pallets = Number(row[palletIdx]);
      if (isNaN(pallets) || pallets <= 0) continue;

      const cartons = (cartonsIdx !== -1 && row[cartonsIdx] != null) ? Number(row[cartonsIdx]) : undefined;

      rows.push({ 
          dest: destIdx > -1 ? String(row[destIdx] || "").trim() : "",
          pallets,
          cartons: (cartons !== undefined && !isNaN(cartons)) ? cartons : undefined,
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


export function parseInventorySheet(json: any[]): { location: string; pallets: number; max?: number; dest?: string }[] | null {
  if (!json || json.length === 0) return null;

  const firstRow = json[0];
  const locKey = Object.keys(firstRow).find(k => /location|库位|bin/i.test(k));
  
  // Robust detection: Ensure we don't accidentally pick "Max Pallet" as "Current Pallet"
  const palletKey = Object.keys(firstRow).find(k => 
      !/max|capacity|容量|最大/i.test(k) && /pallet|托盘|quantity|数量/i.test(k)
  );

  const maxKey = Object.keys(firstRow).find(k => /max|capacity|容量|最大/i.test(k));
  const destKey = Object.keys(firstRow).find(k => /destination|目的地|dest/i.test(k));

  if (!locKey || !palletKey) {
    alert("Import failed: Could not find 'Location'/'库位' or 'Pallets'/'数量' columns.");
    return null;
  }

  return json.map(row => {
    const loc = row[locKey];
    const pallets = Number(row[palletKey]);
    const max = maxKey ? Number(row[maxKey]) : undefined;
    const dest = destKey ? String(row[destKey] || "").trim() : undefined;
    
    if (loc && !isNaN(pallets)) {
      return { 
          location: String(loc).trim(), 
          pallets, 
          max: (max && !isNaN(max)) ? max : undefined,
          dest: dest 
      };
    }
    return null;
  }).filter((item): item is NonNullable<typeof item> => item !== null);
}
