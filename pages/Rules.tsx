
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LocationRule, UserRole, ColumnConfig, LOCATION_TYPES, DESTINATION_OPTIONS, UnloadPlan, UnloadPlanRow, DestContainerMap, LogEntry, ContainerStats } from '../types';
import * as XLSX from 'xlsx';
import { parseUnloadSheet, assignLocationsForUnload, parseOutboundSheet, parseContainerMapSheet, parseInventorySheet, generateUnloadPlanSheet } from '../services/excelService';
import { Search, Plus, Download, Upload, Settings, X, Trash2, FileText, ArrowUp, ArrowDown, ArrowUpDown, History, Hand, ScanLine, CheckSquare, Square } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import BarcodeScanner from '../components/BarcodeScanner';

const STORAGE_KEY = "la_location_rules_v14";
const COLUMN_SETTINGS_KEY = "la_column_settings_v14_cols";

const defaultCapacities: Record<string, number | null> = {
  'amz-main-A': 30,
  'amz-main-BC': 16,
  'amz-buffer': 12,
  'sehin': 30,
  'private': 16,
  'platform': 16,
  'express': 10,
  'suspense': 20,
  'highvalue': 8,
};

const getDestTagClass = (tag: string) => {
    const t = tag.toLowerCase();
    if (t.includes('amazon') || /^[a-z]{3}\d/i.test(t)) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (t.includes('shein') || t.includes('希音')) return 'bg-pink-100 text-pink-800 border-pink-200';
    if (t.includes('private') || t.includes('住宅') || t.includes('resident')) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (t.includes('fedex') || t.includes('ups')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (t.includes('暂扣') || t.includes('中转') || t.includes('fbx')) return 'bg-purple-100 text-purple-800 border-purple-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
}


interface Props {
  rules: LocationRule[];
  setRules: (rules: LocationRule[]) => void;
  userRole: UserRole;
  addLog: (text: string, location?: string) => void;
  logs: LogEntry[];
  destContainerMap: DestContainerMap;
  setDestContainerMap: React.Dispatch<React.SetStateAction<DestContainerMap>>;
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
}

// Destination Selector Modal Component
interface DestSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    currentDestinations: string;
    allowedCount: number | null;
    onSave: (newDestinations: string) => void;
    title: string;
}

const DestinationSelectorModal: React.FC<DestSelectorProps> = ({ isOpen, onClose, currentDestinations, allowedCount, onSave, title }) => {
    const { t } = useLanguage();
    const [searchTerm, setSearchTerm] = useState('');
    const [selected, setSelected] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen) {
            setSelected(currentDestinations.split(/[，,]/).map(t => t.trim()).filter(Boolean));
            setSearchTerm('');
        }
    }, [isOpen, currentDestinations]);

    const toggleSelection = (dest: string) => {
        if (selected.includes(dest)) {
            setSelected(prev => prev.filter(d => d !== dest));
        } else {
            if (allowedCount !== null && selected.length >= allowedCount) {
                alert(t('maxAllowed') + `: ${allowedCount}`);
                return;
            }
            setSelected(prev => [...prev, dest]);
        }
    };

    const handleSave = () => {
        onSave(selected.join('，'));
        onClose();
    };

    const filteredOptions = DESTINATION_OPTIONS.filter(opt => 
        opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-[500px] max-w-full flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800">{t('selectDestinations')}</h3>
                        <p className="text-xs text-slate-500">{title}</p>
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-slate-200"><X size={20} /></button>
                </div>
                
                <div className="p-3 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                        <input 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            placeholder={t('searchPlaceholder')}
                            className="w-full pl-9 pr-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                    <div className="grid grid-cols-2 gap-2">
                        {filteredOptions.map(opt => {
                            const isSelected = selected.includes(opt);
                            return (
                                <div 
                                    key={opt}
                                    onClick={() => toggleSelection(opt)}
                                    className={`flex items-center gap-2 p-2 rounded cursor-pointer border transition-colors ${isSelected ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50 border-transparent'}`}
                                >
                                    {isSelected ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} className="text-slate-300" />}
                                    <span className={`text-sm ${isSelected ? 'font-medium text-blue-700' : 'text-slate-600'}`}>{opt}</span>
                                </div>
                            );
                        })}
                    </div>
                    {filteredOptions.length === 0 && (
                        <p className="text-center text-slate-400 py-4">No matching destinations found.</p>
                    )}
                </div>

                <div className="p-4 border-t bg-slate-50 rounded-b-xl flex justify-between items-center">
                    <span className={`text-sm font-medium ${allowedCount && selected.length > allowedCount ? 'text-red-600' : 'text-slate-600'}`}>
                        {t('current')}: {selected.length} {allowedCount ? `/ ${allowedCount}` : ''}
                    </span>
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg">{t('cancel')}</button>
                        <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg font-medium">{t('done')}</button>
                    </div>
                </div>
            </div>
        </div>
    );
};


const Rules: React.FC<Props> = ({ rules, setRules, userRole, addLog, logs, destContainerMap, setDestContainerMap, addNotification }) => {
  const { t } = useLanguage();

  const DEFAULT_COLUMNS: ColumnConfig[] = useMemo(() => [
    { id: 'range', label: t('colRange'), order: 1, visible: true },
    { id: 'destinations', label: t('colDest'), order: 2, visible: true },
    { id: 'type', label: t('colType'), order: 3, visible: true },
    { id: 'maxPallet', label: t('colMax'), order: 4, visible: true },
    { id: 'curPallet', label: t('colCur'), order: 5, visible: true },
    { id: 'curCartons', label: t('colCartons'), order: 6, visible: true },
    { id: 'utilization', label: t('colUtil'), order: 7, visible: true },
    { id: 'allowedDest', label: t('colAllow'), order: 8, visible: true },
    { id: 'currentDest', label: t('colCurDest'), order: 9, visible: true },
    { id: 'status', label: t('colStatus'), order: 10, visible: true },
    { id: 'note', label: t('colNote'), order: 11, visible: true },
    { id: 'actions', label: t('colActions'), order: 12, visible: true},
  ], [t]);

  const [keyword, setKeyword] = useState('');
  const [columns, setColumns] = useState<ColumnConfig[]>(DEFAULT_COLUMNS);
  const [showColSettings, setShowColSettings] = useState(false);
  
  // Load/Save column settings
  useEffect(() => {
    const savedSettings = localStorage.getItem(COLUMN_SETTINGS_KEY);
    if (savedSettings) {
        try {
            const saved = JSON.parse(savedSettings) as ColumnConfig[];
            const savedMap = new Map(saved.map(c => [c.id, c]));
            setColumns(prevCols => prevCols.map(defaultCol => {
                const savedCol = savedMap.get(defaultCol.id);
                return savedCol ? { ...defaultCol, visible: savedCol.visible, order: savedCol.order } : defaultCol;
            }));
        } catch(e) {
            console.error("Failed to parse column settings from localStorage", e);
        }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); 

  useEffect(() => {
    localStorage.setItem(COLUMN_SETTINGS_KEY, JSON.stringify(columns));
  }, [columns]);

  useEffect(() => {
      setColumns(cols => cols.map(c => ({ ...c, label: DEFAULT_COLUMNS.find(d => d.id === c.id)?.label || c.label })));
  }, [t, DEFAULT_COLUMNS]);
  

  const [sortConfig, setSortConfig] = useState<{ key: string | null; direction: 'asc' | 'desc' }>({ key: 'range', direction: 'asc' });
  const [newRule, setNewRule] = useState<Partial<LocationRule>>({ type: 'suspense', maxPallet: defaultCapacities.suspense });
  const [historyModalLocation, setHistoryModalLocation] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [recentlyUpdated, setRecentlyUpdated] = useState<string[]>([]);
  
  // Modal for destination selection
  const [selectorModal, setSelectorModal] = useState<{
      isOpen: boolean;
      ruleIndex: number;
      currentDestinations: string;
      allowedCount: number | null;
      range: string;
  }>({ isOpen: false, ruleIndex: -1, currentDestinations: '', allowedCount: null, range: '' });

  // Store the last unload plan for re-export
  const [lastUnloadPlan, setLastUnloadPlan] = useState<UnloadPlan | null>(null);
  
  const prevRulesRef = useRef<LocationRule[]>([]);


  // Manual Unload Modal
  const [showManualUnload, setShowManualUnload] = useState(false);
  const [manualContainerNo, setManualContainerNo] = useState('');
  // Added cartons to manual state
  const [manualRows, setManualRows] = useState<{dest: string, pallets: number, cartons: number}[]>([{dest: '', pallets: 1, cartons: 0}]);

  const isAdmin = userRole === 'Mike';

  const canEdit = (field: keyof LocationRule) => {
    if (isAdmin) return true;
    return ['curPallet', 'curCartons', 'destinations', 'note'].includes(field);
  };

  useEffect(() => {
    if (newRule.type && defaultCapacities[newRule.type]) {
        setNewRule(prev => ({ ...prev, maxPallet: defaultCapacities[newRule.type] }));
    }
  }, [newRule.type]);

  useEffect(() => {
    if (prevRulesRef.current && prevRulesRef.current.length > 0 && rules.length > 0) {
      const updatedRanges: string[] = [];
      const prevRulesMap = new Map(prevRulesRef.current.map(r => [r.range, JSON.stringify(r)]));

      for (const newRule of rules) {
        const oldRuleJSON = prevRulesMap.get(newRule.range);
        if (oldRuleJSON && oldRuleJSON !== JSON.stringify(newRule)) {
          updatedRanges.push(newRule.range);
        }
      }
      
      if (updatedRanges.length > 0) {
        setRecentlyUpdated(updatedRanges);
        const timer = setTimeout(() => {
          setRecentlyUpdated(current => current.filter(item => !updatedRanges.includes(item)));
        }, 2000); 
        return () => clearTimeout(timer);
      }
    }
    prevRulesRef.current = rules;
  }, [rules]);


  const handleColumnVisibilityToggle = (id: string, isVisible: boolean) => {
        setColumns(prev => {
            const newCols = [...prev];
            const colIndex = newCols.findIndex(c => c.id === id);
            if (colIndex > -1) {
                newCols[colIndex].visible = isVisible;
                if (isVisible) {
                    const maxOrder = Math.max(0, ...newCols.filter(c => c.visible && c.id !== id).map(c => c.order));
                    newCols[colIndex].order = maxOrder + 1;
                }
            }
            return newCols;
        });
    };
    
    const handleColumnOrderChange = (id: string, direction: 'up' | 'down') => {
        setColumns(prev => {
            const newCols = [...prev];
            const visibleCols = newCols.filter(c => c.visible).sort((a, b) => a.order - b.order);
            const currentIndex = visibleCols.findIndex(c => c.id === id);
            if (currentIndex === -1) return newCols;
            const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
            if (targetIndex >= 0 && targetIndex < visibleCols.length) {
                const currentOriginalIndex = newCols.findIndex(c => c.id === visibleCols[currentIndex].id);
                const targetOriginalIndex = newCols.findIndex(c => c.id === visibleCols[targetIndex].id);
                if (currentOriginalIndex > -1 && targetOriginalIndex > -1) {
                    const tempOrder = newCols[currentOriginalIndex].order;
                    newCols[currentOriginalIndex].order = newCols[targetOriginalIndex].order;
                    newCols[targetOriginalIndex].order = tempOrder;
                }
            }
            return newCols;
        });
    };

  const handleUpdateRule = (index: number, field: keyof LocationRule, value: any) => {
    if (!canEdit(field)) return;
    const newRules = [...rules];
    const oldVal = newRules[index][field];
    newRules[index] = { ...newRules[index], [field]: value };
    
    if (field === 'destinations') {
        const tags = (value as string).split(/[，,]/).filter(Boolean);
        newRules[index].currentDest = tags.length;
    }

    setRules(newRules);
    addLog(`Updated ${newRules[index].range} ${field}: ${oldVal} -> ${value}`, newRules[index].range);
  };

  const handleAddRule = () => {
    if (!newRule.range) return addNotification("Range is required.", 'error');

    const rangePattern = /^([A-Z])(\d+)-([A-Z])(\d+)$/;
    const match = newRule.range.match(rangePattern);

    let rulesToAdd: LocationRule[] = [];

    if (match && match[1] === match[3]) { 
        const prefix = match[1];
        const start = parseInt(match[2], 10);
        const end = parseInt(match[4], 10);

        if (start > end) return addNotification("Start of range cannot be greater than end.", 'error');

        for (let i = start; i <= end; i++) {
            const numStr = String(i).padStart(match[2].length, '0');
            const range = `${prefix}${numStr}`;
            rulesToAdd.push({
                range,
                type: newRule.type || 'suspense',
                destinations: '',
                maxPallet: newRule.maxPallet || null,
                curPallet: null,
                allowedDest: newRule.allowedDest || 2,
                currentDest: 0,
                note: newRule.note || '',
                curCartons: null
            });
        }
    } else { 
        rulesToAdd.push({
            range: newRule.range,
            type: newRule.type || 'suspense',
            destinations: '',
            maxPallet: newRule.maxPallet || null,
            curPallet: null,
            allowedDest: newRule.allowedDest || 2,
            currentDest: 0,
            note: newRule.note || '',
            curCartons: null
        });
    }

    setRules([...rules, ...rulesToAdd]);
    setNewRule({ type: 'suspense' });
    addLog(`Added rule(s): ${newRule.range}`);
};


  const handleDeleteRule = (index: number) => {
    if(!confirm(t('confirmDelete'))) return;
    const r = rules[index];
    const newRules = rules.filter((_, i) => i !== index);
    setRules(newRules);
    addLog(`Deleted rule: ${r.range}`, r.range);
  };

  const handleSort = (key: string) => {
      let direction: 'asc' | 'desc' = 'asc';
      if (sortConfig.key === key && sortConfig.direction === 'asc') {
          direction = 'desc';
      }
      setSortConfig({ key, direction });
  };
  
  const handleScan = (code: string) => {
    setKeyword(code);
    setIsScannerOpen(false);
    addNotification(`Scanned: ${code}`, 'success');
  };
  
  // --- Import/Export & Allocation Logic ---

  const applyUnloadLogic = (rows: UnloadPlanRow[], isManual: boolean = false) => {
      const assigned = assignLocationsForUnload(rows, rules, isManual);
      
      setDestContainerMap(prevMap => {
        const newMap = {...prevMap};
        assigned.forEach(row => {
            if (row.dest && row.containerNo) {
                if (!newMap[row.dest]) newMap[row.dest] = {};
                
                // Handle existing values which might be numbers (old format) or objects (new format)
                const existing = newMap[row.dest][row.containerNo];
                let currentPallets = 0;
                let currentCartons = 0;

                if (existing) {
                    if (typeof existing === 'number') {
                        currentPallets = existing;
                    } else {
                        currentPallets = existing.pallets;
                        currentCartons = existing.cartons;
                    }
                }

                newMap[row.dest][row.containerNo] = {
                    pallets: currentPallets + row.pallets,
                    cartons: currentCartons + (row.cartons || 0)
                };
            }
        });
        return newMap;
      });
      
      // Use mapping to create a deep clone of the objects we are about to modify to ensure immutability
      const newRules = rules.map(r => ({ ...r }));
      
      assigned.forEach(row => {
          if (row.location) {
              const rIdx = newRules.findIndex(r => r.range === row.location);
              if (rIdx >= 0) {
                  // Only update rules if we actually assigned something new
                  newRules[rIdx].curPallet = (newRules[rIdx].curPallet || 0) + row.pallets;
                  
                  if (row.cartons) {
                      newRules[rIdx].curCartons = (newRules[rIdx].curCartons || 0) + row.cartons;
                  }

                  const tags = (newRules[rIdx].destinations || "").split(/[，,]/).map(t => t.trim()).filter(Boolean);
                  if (row.dest && !tags.includes(row.dest)) {
                      tags.push(row.dest);
                      newRules[rIdx].destinations = tags.join('，');
                      newRules[rIdx].currentDest = tags.length;
                  }
                  addLog(`Assigned ${row.pallets} pallets for ${row.dest} to ${row.location}`, row.location);
              }
          }
      });
      setRules(newRules);
      return assigned;
  };


  const handleUnloadImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, {type: 'array', cellStyles: true});
        const sheetName = wb.SheetNames[0];
        const worksheet = wb.Sheets[sheetName];
        const parsed = parseUnloadSheet(worksheet);
        
        if(parsed) {
            // Check for duplicate container
            if (parsed.containerNo) {
                const isDuplicate = Object.values(destContainerMap).some(destMap => 
                    Object.prototype.hasOwnProperty.call(destMap, parsed.containerNo)
                );
                
                if (isDuplicate) {
                    addNotification(t('duplicateContainerError', { container: parsed.containerNo }), 'error');
                    e.target.value = ''; 
                    return;
                }
            }

            const assignedRows = applyUnloadLogic([...parsed.rows]);
            
            // Store the plan with workbook for exact export
            setLastUnloadPlan({ ...parsed, rows: assignedRows, workbook: wb, sheetName });

            addLog(`Imported Unload Plan: ${parsed.rows.length} rows.`);
            addNotification(`${t('importSuccess')} ${assignedRows.filter(r => !!r.location).length} locations assigned.`, 'success');

        } else {
            addNotification("Failed to parse unload sheet. Check header format.", 'error');
        }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };
  
  const handleExportPlan = () => {
    if (!lastUnloadPlan || !lastUnloadPlan.workbook) {
        return addNotification("No unload plan available to export.", "error");
    }

    const { workbook, sheetName } = lastUnloadPlan;
    
    // We modify the original worksheet in-place to ensure exact copy of everything else
    const worksheet = workbook.Sheets[sheetName];
    
    // We need to use generateUnloadPlanSheet logic but apply it to this existing worksheet object
    // effectively updating it with new location values
    const updatedWorksheet = generateUnloadPlanSheet({ ...lastUnloadPlan, worksheet });
    
    // Update the workbook with the modified worksheet
    workbook.Sheets[sheetName] = updatedWorksheet;
    
    XLSX.writeFile(workbook, `UnloadPlan_${lastUnloadPlan.containerNo || 'Export'}.xlsx`, { cellStyles: true });
    addLog("Exported Unload Plan (Exact Copy)");
  };

  const handleManualUnload = () => {
    if (manualRows.some(r => !r.dest || r.pallets <= 0)) {
        return addNotification("Please fill all destination and pallet fields correctly.", 'error');
    }
    const unloadRows: UnloadPlanRow[] = manualRows.map((r, i) => ({
        dest: r.dest,
        pallets: r.pallets,
        cartons: r.cartons,
        containerNo: manualContainerNo,
        raw: [],
        rowIndex: i 
    }));

    setLastUnloadPlan(null); // Clear previous file import if manual is used

    applyUnloadLogic(unloadRows, true);
    addNotification(t('unloadSuccess'), 'success');
    setShowManualUnload(false);
    setManualContainerNo('');
    setManualRows([{dest: '', pallets: 1, cartons: 0}]);
  };

  const handleOutboundImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, {type: 'array'});
        const aoa = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], {header: 1}) as any[][];
        const rows = parseOutboundSheet(aoa);
        
        if(rows) {
            const newRules = [...rules];
            let deducted = 0;
            let notFound = 0;

            rows.forEach(row => {
                let remaining = row.pallets;
                if (row.location) {
                    const idx = newRules.findIndex(r => r.range === row.location);
                    if (idx !== -1) {
                        const take = Math.min(newRules[idx].curPallet || 0, remaining);
                        newRules[idx].curPallet = (newRules[idx].curPallet || 0) - take;
                        if(newRules[idx].curPallet === 0) {
                            newRules[idx].destinations = "";
                            newRules[idx].curCartons = 0;
                        }
                        remaining -= take;
                        deducted += take;
                        addLog(`Deducted ${take} pallets from specified location ${row.location}`, row.location);
                    } else {
                        notFound++;
                    }
                }

                while (remaining > 0) {
                     const candidates = newRules.map((r, i) => ({r, i}))
                        .filter(x => (x.r.destinations || "").includes(row.dest))
                        .sort((a, b) => (b.r.curPallet || 0) - (a.r.curPallet || 0));
                     
                     if (candidates.length === 0) { notFound++; break; }
                     
                     const target = candidates[0];
                     const take = Math.min(target.r.curPallet || 0, remaining);
                     if (take <= 0) { notFound++; break; }
                     
                     newRules[target.i].curPallet = (newRules[target.i].curPallet || 0) - take;
                     if(newRules[target.i].curPallet === 0) {
                         newRules[target.i].destinations = "";
                         newRules[target.i].curCartons = 0;
                     } 
                     remaining -= take;
                     deducted += take;
                     addLog(`Deducted ${take} pallets for ${row.dest} from ${target.r.range}`, target.r.range);
                }
            });
            setRules(newRules);
            const msg = `${t('deductedPallets')} (${deducted}). ${notFound > 0 ? `${notFound} rows had issues.` : ''}`;
            addLog(`Imported Outbound: Deducted ${deducted} pallets. ${notFound > 0 ? `${notFound} rows not fully processed.` : ''}`);
            addNotification(msg, notFound > 0 ? 'info' : 'success');
        }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  };
  
  const handleInventoryImport = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
          const wb = XLSX.read(data, {type: 'array'});
          const sheet = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(sheet) as any[];
          const parsed = parseInventorySheet(json);
          
          if (parsed) {
              const newRules = [...rules];
              let updated = 0;
              parsed.forEach(item => {
                 const idx = newRules.findIndex(r => r.range === item.location);
                 if (idx >= 0) {
                     newRules[idx].curPallet = item.pallets;
                     if (item.max !== undefined) {
                         newRules[idx].maxPallet = item.max;
                     }
                     updated++;
                 }
              });
              setRules(newRules);
              addLog(`Inventory Import: Updated ${updated} locations.`);
              addNotification(`${t('importSuccess')} Updated ${updated} locations.`, 'success');
          }
      };
      reader.readAsArrayBuffer(file);
      e.target.value = '';
  }

  const exportXLSX = () => {
     const ws = XLSX.utils.json_to_sheet(rules);
     const wb = XLSX.utils.book_new();
     XLSX.utils.book_append_sheet(wb, ws, "Rules");
     XLSX.writeFile(wb, "LocationRules.xlsx");
     addLog("Exported Rules XLSX");
  };

  const sortedColumns = useMemo(() => [...columns].sort((a,b) => a.order - b.order).filter(c => c.visible), [columns]);

  const sortedAndFilteredRules = useMemo(() => {
    let result = [...rules];
    
    if(keyword) {
        const low = keyword.toLowerCase();
        result = result.filter(r => r.range.toLowerCase().includes(low) || r.destinations.toLowerCase().includes(low) || r.note.toLowerCase().includes(low));
    }

    if (sortConfig.key) {
        result.sort((a, b) => {
            const isAsc = sortConfig.direction === 'asc';
            const key = sortConfig.key as keyof LocationRule | 'utilization' | 'status';

            if (key === 'utilization') {
                const uA = (a.curPallet || 0) / (a.maxPallet || 1);
                const uB = (b.curPallet || 0) / (b.maxPallet || 1);
                return isAsc ? uA - uB : uB - uA;
            }
            if (key === 'status') {
                const overA = (a.allowedDest && a.currentDest && a.currentDest > a.allowedDest) ? 1 : 0;
                const overB = (b.allowedDest && b.currentDest && b.currentDest > b.allowedDest) ? 1 : 0;
                return isAsc ? overA - overB : overB - overA;
            }
            if (key === 'type') {
                const labelA = t(a.type as any) || a.type;
                const labelB = t(b.type as any) || b.type;
                return isAsc ? labelA.localeCompare(labelB) : labelB.localeCompare(labelA);
            }

            const valA = a[key as keyof LocationRule];
            const valB = b[key as keyof LocationRule];

            if (valA === valB) return 0;
            if (valA === null || valA === undefined) return 1;
            if (valB === null || valB === undefined) return -1;
            if (typeof valA === 'number' && typeof valB === 'number') return isAsc ? valA - valB : valB - valA;
            
            return isAsc 
                ? String(valA).localeCompare(String(valB), undefined, {numeric: true})
                : String(valB).localeCompare(String(valA), undefined, {numeric: true});
        });
    }
    return result;
  }, [rules, keyword, sortConfig, t]);
  
  const handleDeleteTag = (ruleIndex: number, tag: string) => {
      if (!confirm(`${t('removeTag')} "${tag}"?`)) return;
      const rule = rules[ruleIndex];
      const tags = (rule.destinations || "").split(/[，,]/).map(t=>t.trim()).filter(Boolean);
      const newTags = tags.filter(t => t !== tag);
      handleUpdateRule(ruleIndex, 'destinations', newTags.join('，'));
  }

  const getDestTooltip = (dest: string) => {
    if (!destContainerMap[dest]) return dest;
    const containers = destContainerMap[dest];
    const lines = Object.entries(containers).map(([container, stats]) => {
         const val: any = stats;
         // Handle legacy number or new ContainerStats object
         const s = (typeof val === 'number') ? { pallets: val, cartons: 0 } : (val as ContainerStats);
         return `${container}: ${s.pallets} plts | ${s.cartons} ctns`;
    });
    return `${dest}\n---\n${lines.join('\n')}`;
  };

  const openDestSelector = (ruleIndex: number, rule: LocationRule) => {
      if (!canEdit('destinations')) return;
      setSelectorModal({
          isOpen: true,
          ruleIndex: ruleIndex,
          currentDestinations: rule.destinations,
          allowedCount: rule.allowedDest,
          range: rule.range
      });
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] space-y-4 relative">
        <BarcodeScanner 
            isOpen={isScannerOpen} 
            onClose={() => setIsScannerOpen(false)} 
            onScan={handleScan}
            addNotification={addNotification}
        />
        
        {/* Destination Selector Modal */}
        <DestinationSelectorModal 
            isOpen={selectorModal.isOpen}
            onClose={() => setSelectorModal(prev => ({ ...prev, isOpen: false }))}
            currentDestinations={selectorModal.currentDestinations}
            allowedCount={selectorModal.allowedCount}
            onSave={(newDest) => handleUpdateRule(selectorModal.ruleIndex, 'destinations', newDest)}
            title={selectorModal.range}
        />

        {/* Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center z-10 flex-none">
            <div className="flex gap-2 w-full xl:w-auto">
                <div className="relative flex-1 xl:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder={t('searchPlaceholder')} className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" value={keyword} onChange={e => setKeyword(e.target.value)} />
                </div>
                <button onClick={() => setIsScannerOpen(true)} className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600" title="Scan Barcode/QR Code"><ScanLine size={20} /></button>
                <button onClick={() => setShowColSettings(!showColSettings)} className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600" title={t('columnSettings')}><Settings size={20} /></button>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
                <button onClick={() => setShowManualUnload(true)} className="flex items-center gap-2 px-3 py-2 bg-fuchsia-50 text-fuchsia-700 rounded-lg hover:bg-fuchsia-100 border border-fuchsia-200 text-sm font-medium transition-colors"><Hand size={16} /> {t('manualUnload')}</button>
                <button onClick={exportXLSX} className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 border border-emerald-200 text-sm font-medium transition-colors"><Download size={16} /> {t('rules')}</button>
                
                <label className="flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200 text-sm font-medium cursor-pointer transition-colors"><Upload size={16} /> {t('unload')}<input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleUnloadImport} /></label>

                {/* Export Results button placed next to Import Unload */}
                {lastUnloadPlan && (
                    <button 
                        onClick={handleExportPlan} 
                        className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 border border-indigo-200 text-sm font-medium transition-colors shadow-sm animate-fade-in-right"
                        title={t('exportPlanTooltip')}
                    >
                        <Download size={16} /> {t('exportPlan')}
                    </button>
                )}

                <label className="flex items-center gap-2 px-3 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 border border-orange-200 text-sm font-medium cursor-pointer transition-colors"><Upload size={16} /> {t('outbound')}<input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleOutboundImport} /></label>
                <label className="flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 border border-purple-200 text-sm font-medium cursor-pointer transition-colors"><FileText size={16} /> {t('inventory')}<input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleInventoryImport} /></label>
            </div>
        </div>

        {showManualUnload && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-[600px] max-w-full">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">{t('manualUnloadTitle')}</h3>
                    <div className="space-y-2">
                        <input value={manualContainerNo} onChange={e => setManualContainerNo(e.target.value)} placeholder={t('containerNo')} className="w-full px-3 py-2 border rounded-lg" />
                        <div className="max-h-64 overflow-y-auto space-y-2 p-1">
                        {manualRows.map((row, i) => (
                            <div key={i} className="flex gap-2 items-center">
                                <input value={row.dest} onChange={e => { const newRows = [...manualRows]; newRows[i].dest = e.target.value; setManualRows(newRows); }} placeholder={t('colDest')} className="flex-1 px-3 py-2 border rounded-lg" />
                                <input type="number" value={row.pallets} onChange={e => { const newRows = [...manualRows]; newRows[i].pallets = Number(e.target.value); setManualRows(newRows); }} placeholder={t('colCur')} className="w-20 px-3 py-2 border rounded-lg" title="Pallets" />
                                <input type="number" value={row.cartons} onChange={e => { const newRows = [...manualRows]; newRows[i].cartons = Number(e.target.value); setManualRows(newRows); }} placeholder={t('colCartons')} className="w-20 px-3 py-2 border rounded-lg" title="Cartons" />
                                <button onClick={() => setManualRows(manualRows.filter((_, idx) => idx !== i))} className="text-red-500 hover:text-red-700 p-2"><Trash2 size={16} /></button>
                            </div>
                        ))}
                        </div>
                        <button onClick={() => setManualRows([...manualRows, {dest: '', pallets: 1, cartons: 0}])} className="text-sm text-blue-600 hover:underline">{t('addDestRow')}</button>
                    </div>
                    <div className="flex justify-end gap-2 mt-4">
                        <button onClick={() => setShowManualUnload(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">{t('cancel')}</button>
                        <button onClick={handleManualUnload} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg">{t('processUnload')}</button>
                    </div>
                </div>
            </div>
        )}

        {historyModalLocation && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-2xl">
                    <div className="flex justify-between items-center mb-4 border-b pb-4">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                             <History className="text-blue-500" size={20} />
                            {t('history')}: <span className="font-mono bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{historyModalLocation}</span>
                        </h3>
                        <button onClick={() => setHistoryModalLocation(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                            <X size={24} />
                        </button>
                    </div>
                    
                    <div className="max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {/* Timeline */}
                        <div className="relative border-l-2 border-blue-100 ml-4 space-y-8 my-4">
                            {logs.filter(l => l.location === historyModalLocation).map((log, i) => (
                                <div key={i} className="relative pl-8 group">
                                    {/* Timeline Node */}
                                    <div className="absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-4 border-white bg-blue-500 shadow-sm group-hover:scale-110 transition-transform"></div>
                                    
                                    <div className="flex flex-col gap-1.5 animate-fade-in-up" style={{animationDelay: `${i * 50}ms`}}>
                                        {/* Time Label */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                                                {log.time}
                                            </span>
                                        </div>
                                        
                                        {/* Content Card */}
                                        <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200 hover:bg-white hover:shadow-md transition-all">
                                            {log.text}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                        
                        {logs.filter(l => l.location === historyModalLocation).length === 0 && (
                             <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-3">
                                    <History size={32} className="opacity-20" />
                                </div>
                                <p>{t('noHistory')}</p>
                            </div>
                        )}
                    </div>
                    
                    <div className="flex justify-end mt-4 pt-4 border-t border-slate-100">
                        <button onClick={() => setHistoryModalLocation(null)} className="px-5 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 font-medium shadow-lg shadow-slate-200 transition-all">{t('done')}</button>
                    </div>
                </div>
            </div>
        )}

        {showColSettings && (
          <div className="absolute top-20 right-4 w-64 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm z-30 shadow-2xl animate-fade-in-up">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-slate-700">{t('columnSettings')}</h4>
                <button onClick={() => setShowColSettings(false)} className="p-1 rounded-full hover:bg-slate-200"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 gap-4 max-h-[60vh] overflow-y-auto">
                <div>
                    <h5 className="font-semibold text-slate-600 mb-2 border-b pb-1">Visible Columns</h5>
                    <ul className="space-y-1 min-h-[50px]">
                        {columns.filter(c => c.visible).sort((a,b) => a.order - b.order).map((col, index, visibleCols) => (
                            <li key={col.id} className="flex items-center justify-between p-2 rounded bg-white hover:bg-slate-100 border">
                                <span className="font-medium">{col.label}</span>
                                <div className="flex items-center gap-1 text-slate-500">
                                    <button disabled={index === 0} onClick={() => handleColumnOrderChange(col.id, 'up')} className="p-1 disabled:opacity-30 hover:text-slate-800" title="Move up"><ArrowUp size={14} /></button>
                                    <button disabled={index === visibleCols.length - 1} onClick={() => handleColumnOrderChange(col.id, 'down')} className="p-1 disabled:opacity-30 hover:text-slate-800" title="Move down"><ArrowDown size={14} /></button>
                                    <button onClick={() => handleColumnVisibilityToggle(col.id, false)} className="p-1 text-red-500 hover:text-red-700" title="Hide column"><Trash2 size={16} /></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <h5 className="font-semibold text-slate-600 mb-2 border-b pb-1">Hidden Columns</h5>
                    <div className="flex flex-wrap gap-2">
                        {columns.filter(c => !c.visible).map(col => (
                             <button key={col.id} onClick={() => handleColumnVisibilityToggle(col.id, true)} className="px-2 py-1 bg-white border border-dashed border-slate-300 rounded hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-slate-500 flex items-center gap-1">
                                 <Plus size={14} /> {col.label}
                             </button>
                        ))}
                    </div>
                </div>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-1 flex flex-col min-h-0">
            <div className="overflow-auto flex-1 w-full relative">
               <table className="w-full text-sm text-left relative border-collapse">
                  <thead className="bg-slate-50 text-slate-500 font-medium border-b border-slate-200 sticky top-0 z-20 shadow-sm">
                     <tr>
                        {sortedColumns.map(col => (
                           <th key={col.id} className="px-4 py-3 whitespace-nowrap bg-slate-50">
                              <button onClick={() => handleSort(col.id)} className="flex items-center gap-1 hover:text-slate-800 font-semibold focus:outline-none">
                                 {col.label}
                                 {sortConfig.key === col.id && (
                                     sortConfig.direction === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                                 )}
                                 {sortConfig.key !== col.id && <ArrowUpDown size={14} className="opacity-0 group-hover:opacity-50" />}
                              </button>
                           </th>
                        ))}
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {sortedAndFilteredRules.map((rule, index) => {
                         const realIndex = rules.findIndex(r => r.range === rule.range);
                         const utilization = (rule.maxPallet && rule.maxPallet > 0) ? (rule.curPallet || 0) / rule.maxPallet : 0;
                         const isOverflow = rule.allowedDest && rule.currentDest && rule.currentDest > rule.allowedDest;
                         const isRecentlyUpdated = recentlyUpdated.includes(rule.range);
                         
                         return (
                             <tr key={rule.range} className={`hover:bg-slate-50 transition-colors duration-500 ${isOverflow ? 'bg-red-50/50' : ''} ${isRecentlyUpdated ? 'bg-yellow-100' : ''}`}>
                                 {sortedColumns.map(col => (
                                     <td 
                                        key={col.id} 
                                        className="px-4 py-2 align-middle border-r border-transparent last:border-0"
                                        onDoubleClick={() => col.id === 'destinations' && canEdit('destinations') && openDestSelector(realIndex, rule)}
                                     >
                                         {col.id === 'range' && (
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-slate-700">{rule.range}</span>
                                                <button onClick={() => setHistoryModalLocation(rule.range)} className="text-slate-300 hover:text-blue-500"><History size={14} /></button>
                                            </div>
                                         )}
                                         {col.id === 'destinations' && (
                                            <div className="flex flex-wrap gap-1 max-w-xs cursor-pointer min-h-[24px]">
                                                {(rule.destinations || "").split(/[，,]/).map(t => t.trim()).filter(Boolean).map((tag, i) => (
                                                    <span 
                                                        key={i} 
                                                        onClick={(e) => { e.stopPropagation(); canEdit('destinations') && handleDeleteTag(realIndex, tag); }}
                                                        className={`px-2 py-0.5 rounded-full text-xs border font-medium cursor-pointer hover:shadow-sm transition-all ${getDestTagClass(tag)}`}
                                                        title={getDestTooltip(tag)}
                                                    >
                                                        {tag}
                                                    </span>
                                                ))}
                                                {canEdit('destinations') && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); openDestSelector(realIndex, rule); }}
                                                        className="px-2 py-0.5 rounded-full text-xs border border-dashed border-slate-300 text-slate-400 hover:text-blue-500 hover:border-blue-300 opacity-50 hover:opacity-100 transition-opacity"
                                                    >
                                                        +
                                                    </button>
                                                )}
                                            </div>
                                         )}
                                         {col.id === 'type' && (
                                             <select 
                                                value={rule.type} 
                                                disabled={!isAdmin}
                                                onChange={e => handleUpdateRule(realIndex, 'type', e.target.value)}
                                                className="bg-transparent text-xs py-1 rounded border-transparent hover:border-slate-200 focus:border-blue-300 disabled:opacity-70 disabled:cursor-not-allowed"
                                             >
                                                 {LOCATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                             </select>
                                         )}
                                         {col.id === 'maxPallet' && (
                                             <input 
                                                type="number" 
                                                value={rule.maxPallet || ''} 
                                                disabled={!isAdmin}
                                                onChange={e => handleUpdateRule(realIndex, 'maxPallet', parseInt(e.target.value) || 0)}
                                                className="w-16 px-2 py-1 text-right border rounded border-slate-200 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                                             />
                                         )}
                                         {col.id === 'curPallet' && (
                                             <input 
                                                type="number" 
                                                value={rule.curPallet || 0} 
                                                disabled={!canEdit('curPallet')}
                                                onChange={e => handleUpdateRule(realIndex, 'curPallet', parseInt(e.target.value) || 0)}
                                                className={`w-16 px-2 py-1 text-right border rounded focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 ${isOverflow ? 'border-red-300 text-red-600 bg-red-50' : 'border-slate-200'}`}
                                             />
                                         )}
                                         {col.id === 'curCartons' && (
                                             <input 
                                                type="number" 
                                                value={rule.curCartons || 0} 
                                                disabled={!canEdit('curCartons')}
                                                onChange={e => handleUpdateRule(realIndex, 'curCartons', parseInt(e.target.value) || 0)}
                                                className={`w-16 px-2 py-1 text-right border rounded focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500 border-slate-200`}
                                             />
                                         )}
                                         {col.id === 'utilization' && (
                                             <div className="flex items-center gap-2">
                                                 <div className="w-20 bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                                                    <div 
                                                        className={`h-full rounded-full ${utilization >= 0.95 ? 'bg-red-500' : utilization >= 0.8 ? 'bg-orange-500' : utilization < 0.5 && utilization > 0 ? 'bg-emerald-500' : utilization === 0 ? 'bg-slate-300' : 'bg-blue-500'}`} 
                                                        style={{ width: `${Math.min(utilization * 100, 100)}%` }}
                                                    ></div>
                                                 </div>
                                                 <span className="text-xs font-medium text-slate-600 w-9 text-right">{Math.round(utilization * 100)}%</span>
                                             </div>
                                         )}
                                         {col.id === 'allowedDest' && (
                                              <input 
                                                type="number" 
                                                value={rule.allowedDest || 0} 
                                                disabled={!isAdmin}
                                                onChange={e => handleUpdateRule(realIndex, 'allowedDest', parseInt(e.target.value) || 0)}
                                                className="w-12 px-2 py-1 text-right border rounded border-slate-200 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
                                             />
                                         )}
                                         {col.id === 'currentDest' && (
                                             <span className={`font-mono ${isOverflow ? 'text-red-600 font-bold' : 'text-slate-600'}`}>{rule.currentDest || 0}</span>
                                         )}
                                         {col.id === 'status' && (
                                             <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${isOverflow ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                                                 {isOverflow ? t('statusOverflow') : t('statusOk')}
                                             </span>
                                         )}
                                         {col.id === 'note' && (
                                             <input 
                                                type="text" 
                                                value={rule.note || ''} 
                                                disabled={!canEdit('note')}
                                                onChange={e => handleUpdateRule(realIndex, 'note', e.target.value)}
                                                className="w-full min-w-[150px] px-2 py-1 border rounded border-slate-200 focus:border-blue-500 disabled:bg-transparent disabled:border-transparent text-slate-600 text-xs"
                                                placeholder="..."
                                             />
                                         )}
                                         {col.id === 'actions' && isAdmin && (
                                             <button onClick={() => handleDeleteRule(realIndex)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                                 <Trash2 size={16} />
                                             </button>
                                         )}
                                     </td>
                                 ))}
                             </tr>
                         )
                     })}
                     {sortedAndFilteredRules.length === 0 && (
                         <tr>
                             <td colSpan={sortedColumns.length} className="px-4 py-8 text-center text-slate-400 italic">
                                 No locations found matching your criteria.
                             </td>
                         </tr>
                     )}
                  </tbody>
               </table>
            </div>
            
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row items-center justify-end gap-4 flex-none">
                <span className="text-xs text-slate-500">
                    {t('count')}: {sortedAndFilteredRules.length}
                </span>
            </div>
        </div>
    </div>
  );
};

export default Rules;
