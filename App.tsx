

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Rules from './pages/Rules';
import WMS from './pages/WMS';
import BI from './pages/BI'; 
import Exceptions from './pages/Exceptions';
import Users from './pages/Users';
import LocationManager from './pages/LocationManager'; 
import CloudSyncModal from './components/CloudSyncModal';
import { UserRole, LocationRule, LogEntry, DestContainerMap, ExceptionEntry, Accounts, CloudConfig, FullBackup } from './types';
import { generateDefaultRules, buildDefaultRule } from './services/dataService';
import { uploadData, downloadData } from './services/cloudService';
import { classifyDestinationForRule } from './services/excelService';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { X, Search as SearchIcon, Inbox, Printer, Trash2 } from 'lucide-react';
import { NotificationProvider, useNotifications } from './components/Notifications';

const STORAGE_KEY = "la_location_rules_v14"; 
const LOG_KEY = "la_location_logs_v14";
const EXCEPTIONS_KEY = "la_exceptions_v14";
const DEST_CONTAINER_KEY = "la_dest_container_map_v14";
const ACCOUNTS_KEY = "la_accounts_v14";
const CLOUD_CONFIG_KEY = "la_cloud_config_v14";
const LAST_SYNC_KEY = "la_last_sync_time_v14";
const SESSION_KEY = "la_session_v14";

const DEFAULT_ACCOUNTS: Accounts = {
  Mike: { password: "lk2025", role: "Mike" as UserRole },
  '入库组': { password: "123456", role: "operator" as UserRole },
  '出库组': { password: "123456", role: "staff" as UserRole }
};


// --- Container History Modal Component ---
interface ContainerHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  destContainerMap: DestContainerMap;
  rules: LocationRule[];
  onDeleteContainer: (containerNo: string) => void;
}
type ContainerDetails = {
  containerNo: string;
  entries: { dest: string; pallets: number; cartons: number }[];
};

const ContainerHistoryModal: React.FC<ContainerHistoryModalProps> = ({ isOpen, onClose, destContainerMap, rules, onDeleteContainer }) => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContainer, setSelectedContainer] = useState<ContainerDetails | null>(null);

  const containerData = useMemo(() => {
    const flatMap: { [key: string]: { dest: string; pallets: number; cartons: number }[] } = {};
    Object.entries(destContainerMap).forEach(([dest, containers]) => {
      Object.entries(containers).forEach(([containerNo, stats]) => {
        if (!flatMap[containerNo]) flatMap[containerNo] = [];
        // Handle migration safely for display
        const pallets = typeof stats === 'number' ? stats : stats.pallets;
        const cartons = typeof stats === 'number' ? 0 : stats.cartons;

        if (pallets > 0 || cartons > 0) flatMap[containerNo].push({ dest, pallets, cartons });
      });
    });
    return Object.entries(flatMap)
      .map(([containerNo, entries]) => ({ containerNo, entries }))
      .sort((a,b) => a.containerNo.localeCompare(b.containerNo));
  }, [destContainerMap]);
  
  const filteredContainers = useMemo(() => {
    if (!searchTerm) return containerData;
    return containerData.filter(c => c.containerNo.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, containerData]);

  useEffect(() => {
      if (!isOpen) {
          setSearchTerm('');
          setSelectedContainer(null);
      }
  }, [isOpen]);
  
  const getLocationArrangement = (dest: string) => {
      return rules
        .filter(r => r.destinations && r.destinations.split(/[，,]/).map(d => d.trim()).includes(dest))
        .map(r => r.range)
        .join(', ');
  }

  const getLocationNotes = (dest: string) => {
      // 1. Try to find notes from assigned rules
      const matchedRules = rules.filter(r => r.destinations && r.destinations.split(/[，,]/).map(d => d.trim()).includes(dest));
      const notes = Array.from(new Set(matchedRules.map(r => r.note).filter(Boolean)));
      if (notes.length > 0) return notes.join('; ');

      // 2. Fallback: Determine default note based on destination classification
      const category = classifyDestinationForRule(dest);
      const keyMap: Record<string, string> = {
          'amz-main': 'amz-main-A',
          'amz-buffer': 'amz-buffer',
          'sehin': 'sehin',
          'private': 'private',
          'platform': 'platform',
          'express': 'express',
          'highvalue': 'highvalue',
          'suspense': 'suspense'
      };
      
      const key = keyMap[category];
      return key ? t(key as any) : '';
  }

  const totals = useMemo(() => {
    if (!selectedContainer) return { pallets: 0, cartons: 0 };
    return selectedContainer.entries.reduce((acc, curr) => ({
      pallets: acc.pallets + curr.pallets,
      cartons: acc.cartons + curr.cartons
    }), { pallets: 0, cartons: 0 });
  }, [selectedContainer]);

  const handlePrint = () => {
    if (!selectedContainer) return;
    
    // Calculate totals
    const totalPallets = selectedContainer.entries.reduce((sum, entry) => sum + entry.pallets, 0);
    const totalCartons = selectedContainer.entries.reduce((sum, entry) => sum + entry.cartons, 0);

    // Generate Table Rows
    // Order: Destination Tag, Pallets, Cartons, Location Arrangement, Note
    const rows = selectedContainer.entries.map(entry => {
        const notes = getLocationNotes(entry.dest);
        const locs = getLocationArrangement(entry.dest);
        return `
          <tr>
            <td style="text-align: center;">${entry.dest}</td>
            <td style="text-align: center;">${entry.pallets}</td>
            <td style="text-align: center;">${entry.cartons}</td>
            <td style="text-align: center;">${locs}</td>
            <td style="text-align: center;">${notes}</td>
          </tr>
        `;
    }).join('');

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${t('containerDetails')} - ${selectedContainer.containerNo}</title>
        <style>
          body { 
            font-family: "Microsoft YaHei", sans-serif; 
            font-size: 14px; 
            font-weight: bold; /* 100% bold */
            -webkit-print-color-adjust: exact; 
          }
          table { 
            width: 100%; 
            border-collapse: collapse; 
            margin-top: 10px; 
            border: 2px solid #000; /* Outer border */
          }
          th, td { 
            border: 1px solid #000; /* Inner borders */
            padding: 6px 8px; 
            vertical-align: middle; 
          }
          
          th { 
             background-color: #D9D9D9 !important; /* White, Background 1, Darker 25% */
             font-weight: bold;
             text-align: center;
             height: 40px;
          }
          
          h2 { text-align: center; margin-bottom: 5px; }
          .meta { text-align: center; margin-bottom: 20px; font-weight: normal; font-size: 12px; }
          
          @media print {
            th { background-color: #D9D9D9 !important; -webkit-print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <h2>${t('containerDetails')}: ${selectedContainer.containerNo}</h2>
        <div class="meta">${t('time')}: ${new Date().toLocaleString()}</div>
        <table>
          <thead>
            <tr>
              <th style="width: 20%;">${t('colDest')}</th>
              <th style="width: 10%;">${t('palletCount')}</th>
              <th style="width: 10%;">${t('colCartons')}</th>
              <th style="width: 20%;">${t('locationArrangement')}</th>
              <th style="width: 40%;">${t('colNote')}</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
            <tr>
              <td style="text-align: center;">${t('total')}</td>
              <td style="text-align: center;">${totalPallets}</td>
              <td style="text-align: center;">${totalCartons}</td>
              <td colspan="2"></td>
            </tr>
          </tbody>
        </table>
        <script>
            window.onload = () => { window.print(); }
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.focus();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[900px] max-w-[95%] h-[600px] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">{t('containerHistoryTitle')}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><X size={20} /></button>
        </div>
        
        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
          <div className="w-full sm:w-1/4 border-b sm:border-b-0 sm:border-r flex flex-col h-48 sm:h-auto">
            <div className="p-2 border-b">
               <div className="relative">
                  <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input 
                     type="text" 
                     placeholder={t('searchContainer')}
                     value={searchTerm}
                     onChange={e => setSearchTerm(e.target.value)}
                     className="w-full pl-8 pr-2 py-1.5 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
               </div>
            </div>
            <div className="flex-1 overflow-y-auto">
               {filteredContainers.map(container => (
                 <div 
                   key={container.containerNo}
                   onClick={() => setSelectedContainer(container)}
                   className={`w-full text-left px-3 py-2 text-sm truncate font-mono flex items-center justify-between cursor-pointer group ${selectedContainer?.containerNo === container.containerNo ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-slate-50'}`}
                 >
                   <span className="truncate flex-1" title={container.containerNo}>{container.containerNo}</span>
                   {selectedContainer?.containerNo === container.containerNo && (
                      <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            if(confirm(t('confirmDeleteContainer', {container: container.containerNo}))) {
                                onDeleteContainer(container.containerNo);
                                setSelectedContainer(null);
                            }
                        }}
                        className="ml-1 p-1 bg-red-100 text-red-600 hover:bg-red-200 rounded transition-colors"
                        title={t('delete')}
                      >
                        <Trash2 size={14} />
                      </button>
                   )}
                 </div>
               ))}
               {filteredContainers.length === 0 && <p className="text-center text-xs text-slate-400 p-4">{t('noContainerFound')}</p>}
            </div>
          </div>
          
          <div className="w-full sm:w-3/4 overflow-y-auto p-4">
             {selectedContainer ? (
               <div>
                 <div className="flex justify-between items-center mb-3">
                    <h4 className="font-bold text-slate-700 flex items-center gap-2">
                        {t('containerDetails')}: 
                        <span className="font-mono bg-slate-100 px-2 py-1 rounded text-sm">{selectedContainer.containerNo}</span>
                    </h4>
                    <button 
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
                    >
                        <Printer size={16} />
                        {t('printReport')}
                    </button>
                 </div>
                 
                 <table className="w-full text-sm border-collapse border border-slate-200">
                    <thead className="text-left bg-slate-50 text-slate-700">
                      {/* Order: Destination Tag, Pallets, Cartons, Location Arrangement, Note */}
                      <tr>
                        <th className="p-2 font-bold border border-slate-200">{t('colDest')}</th>
                        <th className="p-2 font-bold text-center border border-slate-200">{t('palletCount')}</th>
                        <th className="p-2 font-bold text-center border border-slate-200">{t('colCartons')}</th>
                        <th className="p-2 font-bold border border-slate-200">{t('locationArrangement')}</th>
                        <th className="p-2 font-bold border border-slate-200">{t('colNote')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedContainer.entries.map((entry, index) => (
                        <tr key={index}>
                          <td className="p-2 border border-slate-200">{entry.dest}</td>
                          <td className="p-2 text-center font-medium border border-slate-200">{entry.pallets}</td>
                          <td className="p-2 text-center font-medium border border-slate-200">{entry.cartons || 0}</td>
                          <td className="p-2 text-xs text-slate-600 border border-slate-200">{getLocationArrangement(entry.dest)}</td>
                          <td className="p-2 text-xs text-slate-500 border border-slate-200 max-w-[150px] truncate" title={getLocationNotes(entry.dest)}>{getLocationNotes(entry.dest)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 font-bold text-slate-700 border-t border-slate-200">
                      <tr>
                        <td className="p-2 border border-slate-200">{t('total')}</td>
                        <td className="p-2 text-center border border-slate-200">{totals.pallets}</td>
                        <td className="p-2 text-center border border-slate-200">{totals.cartons}</td>
                        <td className="p-2 border border-slate-200" colSpan={2}></td>
                      </tr>
                    </tfoot>
                 </table>
               </div>
             ) : (
               <div className="h-full flex flex-col items-center justify-center text-slate-400">
                 <Inbox size={40} className="mb-2 opacity-50" />
                 <p>{t('noContainerSelected')}</p>
               </div>
             )}
          </div>
        </div>
      </div>
    </div>
  );
};


const AppContent: React.FC = () => {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [rules, setRules] = useState<LocationRule[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [exceptions, setExceptions] = useState<ExceptionEntry[]>([]);
  const [destContainerMap, setDestContainerMap] = useState<DestContainerMap>({});
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isCloudSyncOpen, setIsCloudSyncOpen] = useState(false);
  const [accounts, setAccounts] = useState<Accounts>(DEFAULT_ACCOUNTS);
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>({ url: '', apiKey: '' });
  const [lastSyncTime, setLastSyncTime] = useState<string>('');
  
  const { addNotification } = useNotifications();
  const { t } = useLanguage();

  // Granular flags to prevent infinite loops for each state slice
  const isRemoteRulesUpdate = useRef(false);
  const isRemoteLogsUpdate = useRef(false);
  const isRemoteExceptionsUpdate = useRef(false);
  const isRemoteDestContainerMapUpdate = useRef(false);
  const isRemoteAccountsUpdate = useRef(false);
  
  // Debounce ref for sync
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Debounce ref for auto upload
  const autoUploadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncChannel = useMemo(() => new BroadcastChannel('linkw_app_sync'), []);

  // Initialize Data and Session
  useEffect(() => {
    // 1. Restore Session (Auto Login)
    const savedSession = localStorage.getItem(SESSION_KEY);
    if (savedSession) {
        try {
            const { role } = JSON.parse(savedSession);
            if (role) {
                setUserRole(role);
                console.log("Session restored for role:", role);
            }
        } catch(e) { console.error("Session restore failed", e); }
    }

    // 2. Load Local Data
    const savedRules = localStorage.getItem(STORAGE_KEY);
    if (savedRules) {
      try {
        const parsedRules = JSON.parse(savedRules) as LocationRule[];
        const migratedRules = parsedRules.map(rule => {
          const defaultRule = buildDefaultRule(rule.range);
          return { ...defaultRule, ...rule };
        });
        setRules(migratedRules);
      } catch (e) {
        setRules(generateDefaultRules());
      }
    } else {
      setRules(generateDefaultRules());
    }
    
    // Accounts Load with Migration
    const savedAccounts = localStorage.getItem(ACCOUNTS_KEY);
    if (savedAccounts) {
        try { 
            const loaded = JSON.parse(savedAccounts);
            // V14.2 Migration: Rename default roles
            let changed = false;
            if (loaded['operator']) {
                loaded['入库组'] = loaded['operator'];
                delete loaded['operator'];
                changed = true;
            }
            if (loaded['staff']) {
                loaded['出库组'] = loaded['staff'];
                delete loaded['staff'];
                changed = true;
            }
            
            setAccounts(loaded); 
            if (changed) {
                 localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(loaded));
            }
        } catch(e) {}
    }

    const savedLogs = localStorage.getItem(LOG_KEY);
    if(savedLogs) try { setLogs(JSON.parse(savedLogs)); } catch(e){}

    const savedExceptions = localStorage.getItem(EXCEPTIONS_KEY);
    if (savedExceptions) try { setExceptions(JSON.parse(savedExceptions)); } catch (e) { }

    const savedMap = localStorage.getItem(DEST_CONTAINER_KEY);
    if(savedMap) {
        try { 
            const parsed = JSON.parse(savedMap);
            let migrated = false;
            Object.keys(parsed).forEach(dest => {
                if (typeof parsed[dest] === 'object') {
                    Object.keys(parsed[dest]).forEach(cont => {
                         if (typeof parsed[dest][cont] === 'number') {
                             parsed[dest][cont] = { pallets: parsed[dest][cont], cartons: 0 };
                             migrated = true;
                         }
                    });
                }
            });
            setDestContainerMap(parsed); 
            if (migrated) {
                localStorage.setItem(DEST_CONTAINER_KEY, JSON.stringify(parsed));
            }
        } catch(e) {}
    }
    
    const savedCloudConfig = localStorage.getItem(CLOUD_CONFIG_KEY);
    if (savedCloudConfig) try { setCloudConfig(JSON.parse(savedCloudConfig)); } catch (e) {}
    
    const savedSyncTime = localStorage.getItem(LAST_SYNC_KEY);
    if (savedSyncTime) setLastSyncTime(savedSyncTime);

  }, []);


  // Handle Auto Download on Startup if configured
  useEffect(() => {
      // If user is logged in, config is loaded, URL exists, and autoSync is enabled
      if (userRole && cloudConfig.url && cloudConfig.autoSync) {
          console.log("Auto-Sync enabled: Downloading latest data...");
          // Slight delay to ensure UI is ready
          setTimeout(() => {
              handleCloudDownload(true).catch(e => console.error("Auto-download failed:", e));
          }, 1000);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRole, cloudConfig.url, cloudConfig.autoSync]);


  useEffect(() => {
    const performSync = () => {
         try {
             // Mark all updates as remote to prevent echoing them back
             isRemoteRulesUpdate.current = true;
             isRemoteLogsUpdate.current = true;
             isRemoteExceptionsUpdate.current = true;
             isRemoteDestContainerMapUpdate.current = true;
             isRemoteAccountsUpdate.current = true;

             const savedRules = localStorage.getItem(STORAGE_KEY);
             if (savedRules) {
                const parsedRules = JSON.parse(savedRules) as LocationRule[];
                const migratedRules = parsedRules.map(rule => {
                    const defaultRule = buildDefaultRule(rule.range);
                    return { ...defaultRule, ...rule };
                });
                setRules(migratedRules);
             }
             
             const savedExceptions = localStorage.getItem(EXCEPTIONS_KEY);
             if (savedExceptions) setExceptions(JSON.parse(savedExceptions));

             const savedMap = localStorage.getItem(DEST_CONTAINER_KEY);
             if (savedMap) setDestContainerMap(JSON.parse(savedMap));

             const savedLogs = localStorage.getItem(LOG_KEY);
             if (savedLogs) setLogs(JSON.parse(savedLogs));

             const savedAccounts = localStorage.getItem(ACCOUNTS_KEY);
             if (savedAccounts) setAccounts(JSON.parse(savedAccounts));
             
             addNotification(t('updateFromOtherTab'), 'info');
         } catch (e) {
             console.error("Error syncing data:", e);
         }
    };

    const handleSync = () => {
        // Debounce sync to prevent notification spam and rapid re-renders
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        syncTimeoutRef.current = setTimeout(() => {
            performSync();
        }, 300);
    };

    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY || event.key === EXCEPTIONS_KEY || event.key === DEST_CONTAINER_KEY || event.key === LOG_KEY || event.key === ACCOUNTS_KEY) {
          handleSync();
      }
    };
    
    syncChannel.onmessage = (event) => {
        if (event.data === 'SYNC_UPDATE') {
            handleSync();
        }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      syncChannel.close();
      if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
    };
  }, [addNotification, t, syncChannel]);

  const broadcastUpdate = () => {
      syncChannel.postMessage('SYNC_UPDATE');
  };

  const scheduleAutoUpload = () => {
      if (!cloudConfig.autoSync || !cloudConfig.url) return;
      
      if (autoUploadTimeoutRef.current) clearTimeout(autoUploadTimeoutRef.current);
      
      // Debounce cloud uploads to avoid network spam on frequent edits
      autoUploadTimeoutRef.current = setTimeout(() => {
          console.log("Auto-Sync: Uploading changes to cloud...");
          handleCloudUpload(true).catch(e => console.error("Auto-upload failed", e));
      }, 5000); 
  };

  useEffect(() => {
    if (isRemoteRulesUpdate.current) {
        isRemoteRulesUpdate.current = false;
        return;
    }

    const handler = setTimeout(() => {
        if(rules.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
            broadcastUpdate();
            scheduleAutoUpload();
        }
    }, 800);
    return () => clearTimeout(handler);
  }, [rules]);
  
  useEffect(() => {
      if (isRemoteAccountsUpdate.current) {
          isRemoteAccountsUpdate.current = false;
          return;
      }
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
      broadcastUpdate();
      scheduleAutoUpload();
  }, [accounts]);

  useEffect(() => {
      if (isRemoteLogsUpdate.current) {
          isRemoteLogsUpdate.current = false;
          return;
      }
      localStorage.setItem(LOG_KEY, JSON.stringify(logs));
      broadcastUpdate();
      scheduleAutoUpload();
  }, [logs]);
  
  useEffect(() => {
      if (isRemoteExceptionsUpdate.current) {
          isRemoteExceptionsUpdate.current = false;
          return;
      }
      localStorage.setItem(EXCEPTIONS_KEY, JSON.stringify(exceptions));
      broadcastUpdate();
      scheduleAutoUpload();
  }, [exceptions]);

  useEffect(() => {
      if (isRemoteDestContainerMapUpdate.current) {
          isRemoteDestContainerMapUpdate.current = false;
          return;
      }
      const handler = setTimeout(() => {
        localStorage.setItem(DEST_CONTAINER_KEY, JSON.stringify(destContainerMap));
        broadcastUpdate();
        scheduleAutoUpload();
    }, 800); 
    return () => clearTimeout(handler);
  }, [destContainerMap]);


  const addLog = (text: string, location?: string, containerNo?: string) => {
    const newLog: LogEntry = { time: new Date().toLocaleString(), text, location, containerNo };
    setLogs(prev => [newLog, ...prev].slice(0, 300));
  };

  const addException = (entry: Omit<ExceptionEntry, 'id' | 'time'>) => {
    const newException: ExceptionEntry = {
      ...entry,
      id: `${new Date().toISOString()}-${Math.random()}`,
      time: new Date().toLocaleString(),
    };
    setExceptions(prev => [newException, ...prev]);
    addLog(`Exception Recorded: ${entry.description}`, undefined, entry.containerNo);
    addNotification(t('exceptionAdded'), 'error');
  };

  const handleAddUser = (user: {username: string, pass: string, role: UserRole}) => {
    if (accounts[user.username]) {
        addNotification(t('userExists'), 'error');
        return;
    }
    const newAccounts = {
        ...accounts,
        [user.username]: { password: user.pass, role: user.role }
    };
    setAccounts(newAccounts);
    addLog(`Admin added new user: ${user.username} with role ${user.role}`);
    addNotification(t('userAdded'), 'success');
};

const handleDeleteUser = (username: string) => {
    if (username === 'Mike') {
        addNotification(t('cannotDeleteSelf'), 'error');
        return;
    }
    const newAccounts = {...accounts};
    delete newAccounts[username];
    setAccounts(newAccounts);
    addLog(`Admin deleted user: ${username}`);
    addNotification(t('userDeleted'), 'success');
};

const handleAddLocation = (locationCode: string) => {
    if (rules.some(r => r.range.toUpperCase() === locationCode.toUpperCase())) {
        addNotification(t('locationExistsError', { locationCode }), 'error');
        return;
    }
    const newRule = buildDefaultRule(locationCode);
    setRules(prev => [...prev, newRule].sort((a,b) => a.range.localeCompare(b.range, undefined, {numeric: true})));
    addLog(`Admin added new location: ${locationCode}`);
    addNotification(t('locationAdded', { locationCode }), 'success');
};

const handleDeleteLocation = (locationCode: string) => {
    const ruleToDelete = rules.find(r => r.range === locationCode);
    if (!ruleToDelete) return; 

    if ((ruleToDelete.curPallet || 0) > 0) {
        addNotification(t('locationNotEmptyError', { locationCode }), 'error');
        return;
    }

    setRules(prev => prev.filter(r => r.range !== locationCode));
    addLog(`Admin deleted location: ${locationCode}`);
    addNotification(t('locationDeleted', { locationCode }), 'success');
};

const handleSaveCloudConfig = (config: CloudConfig) => {
    setCloudConfig(config);
    localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(config));
};

const handleCloudUpload = async (silent = false) => {
    const backup: FullBackup = {
        rules,
        logs,
        exceptions,
        destContainerMap,
        accounts,
        version: "v14",
        timestamp: Date.now(),
        backupDate: new Date().toLocaleString()
    };
    try {
        await uploadData(cloudConfig, backup);
        const time = new Date().toLocaleString();
        setLastSyncTime(time);
        localStorage.setItem(LAST_SYNC_KEY, time);
        if (!silent) addNotification("Data uploaded to cloud successfully.", 'success');
    } catch (e: any) {
        if (!silent) addNotification(`Upload failed: ${e.message}`, 'error');
        throw e;
    }
};

const handleCloudDownload = async (silent = false) => {
    try {
        const data = await downloadData(cloudConfig);
        
        // 1. Persist data to localStorage immediately
        if (data.rules) localStorage.setItem(STORAGE_KEY, JSON.stringify(data.rules));
        if (data.logs) localStorage.setItem(LOG_KEY, JSON.stringify(data.logs));
        if (data.exceptions) localStorage.setItem(EXCEPTIONS_KEY, JSON.stringify(data.exceptions));
        if (data.destContainerMap) localStorage.setItem(DEST_CONTAINER_KEY, JSON.stringify(data.destContainerMap));
        if (data.accounts) localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(data.accounts));

        // 2. Mark as remote updates to avoid auto-uploading what we just downloaded
        isRemoteRulesUpdate.current = true;
        isRemoteLogsUpdate.current = true;
        isRemoteExceptionsUpdate.current = true;
        isRemoteDestContainerMapUpdate.current = true;
        isRemoteAccountsUpdate.current = true;

        // 3. Update React State
        if (data.rules) setRules(data.rules);
        if (data.logs) setLogs(data.logs);
        if (data.exceptions) setExceptions(data.exceptions);
        if (data.destContainerMap) setDestContainerMap(data.destContainerMap);
        if (data.accounts) setAccounts(data.accounts);
        
        // 4. Trigger sync for other tabs
        setTimeout(() => broadcastUpdate(), 500);

        const time = new Date().toLocaleString();
        setLastSyncTime(time);
        localStorage.setItem(LAST_SYNC_KEY, time);
        if (!silent) addNotification("Data downloaded from cloud.", 'success');
    } catch (e: any) {
        if (!silent) addNotification(`Download failed: ${e.message}`, 'error');
        throw e;
    }
};

const handleDeleteContainer = (containerNo: string) => {
    // 1. Dest Container Map - Use deep copy for reliable state updates
    setDestContainerMap(prev => {
        const newMap: DestContainerMap = {};
        let changed = false;
        
        Object.keys(prev).forEach(dest => {
            const containers = prev[dest];
            if (containers[containerNo]) {
                changed = true;
                // Create shallow copy of the container list for this destination
                // Excluding the one to be deleted
                const { [containerNo]: removed, ...rest } = containers;
                
                // Only keep the destination if it still has containers
                if (Object.keys(rest).length > 0) {
                    newMap[dest] = rest;
                }
            } else {
                // Keep the original reference if not modified
                newMap[dest] = containers;
            }
        });
        
        return changed ? newMap : prev;
    });

    // 2. Logs
    setLogs(prev => prev.filter(l => l.containerNo !== containerNo));

    // 3. Exceptions
    setExceptions(prev => prev.filter(e => e.containerNo !== containerNo));

    addLog(`Deleted all data for container: ${containerNo}`);
    addNotification(t('containerDeleted'), 'success');
};

const handleLogin = (role: UserRole) => {
    setUserRole(role);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ role, timestamp: Date.now() }));
    addLog(`User logged in: ${role}`);
};

const handleLogout = () => {
    setUserRole(null);
    localStorage.removeItem(SESSION_KEY);
};


  if (!userRole) {
    return <Login onLogin={handleLogin} accounts={accounts} />;
  }

  return (
    <Router>
      <Layout 
        userRole={userRole} 
        onLogout={handleLogout} 
        onQueryContainerHistory={() => setIsHistoryModalOpen(true)}
        onOpenCloudSync={() => setIsCloudSyncOpen(true)}
      >
        <Routes>
          <Route path="/" element={<Dashboard rules={rules} />} />
          <Route path="/rules" element={<Rules rules={rules} setRules={setRules} userRole={userRole} addLog={addLog} logs={logs} destContainerMap={destContainerMap} setDestContainerMap={setDestContainerMap} addNotification={addNotification} />} />
          <Route path="/bi" element={<BI rules={rules} logs={logs} />} />
          <Route path="/exceptions" element={<Exceptions exceptions={exceptions} onAddException={addException} />} />
          <Route path="/wms" element={<WMS />} />
          {userRole === 'Mike' && <Route path="/users" element={<Users accounts={accounts} onAddUser={handleAddUser} onDeleteUser={handleDeleteUser} />} />}
          {userRole === 'Mike' && <Route path="/locations" element={<LocationManager rules={rules} onAddLocation={handleAddLocation} onDeleteLocation={handleDeleteLocation} />} />}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Layout>
      <ContainerHistoryModal 
        isOpen={isHistoryModalOpen} 
        onClose={() => setIsHistoryModalOpen(false)} 
        destContainerMap={destContainerMap} 
        rules={rules} 
        onDeleteContainer={handleDeleteContainer}
      />
      <CloudSyncModal 
        isOpen={isCloudSyncOpen} 
        onClose={() => setIsCloudSyncOpen(false)} 
        config={cloudConfig}
        onSaveConfig={handleSaveCloudConfig}
        onUpload={() => handleCloudUpload(false)}
        onDownload={() => handleCloudDownload(false)}
        lastSyncTime={lastSyncTime}
      />
    </Router>
  );
};

const App: React.FC = () => {
  return (
    <LanguageProvider>
      <NotificationProvider>
        <AppContent />
      </NotificationProvider>
    </LanguageProvider>
  );
};

export default App;
