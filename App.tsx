
import React, { useState, useEffect, useMemo } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Rules from './pages/Rules';
import WMS from './pages/WMS';
import BI from './pages/BI'; // New import
import Exceptions from './pages/Exceptions';
import Users from './pages/Users';
import LocationManager from './pages/LocationManager'; 
import { UserRole, LocationRule, LogEntry, DestContainerMap, ExceptionEntry, Accounts } from './types';
import { generateDefaultRules, buildDefaultRule } from './services/dataService';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { X, Search as SearchIcon, Inbox } from 'lucide-react';
import { NotificationProvider, useNotifications } from './components/Notifications';

const STORAGE_KEY = "la_location_rules_v14"; 
const LOG_KEY = "la_location_logs_v14";
const EXCEPTIONS_KEY = "la_exceptions_v14";
const DEST_CONTAINER_KEY = "la_dest_container_map_v14";
const ACCOUNTS_KEY = "la_accounts_v14";

const DEFAULT_ACCOUNTS: Accounts = {
  Mike: { password: "lk2025", role: "Mike" as UserRole },
  operator: { password: "123456", role: "operator" as UserRole },
  staff: { password: "123456", role: "staff" as UserRole }
};


// --- Container History Modal Component ---
interface ContainerHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  destContainerMap: DestContainerMap;
  rules: LocationRule[];
}
type ContainerDetails = {
  containerNo: string;
  entries: { dest: string; pallets: number; cartons: number }[];
};

const ContainerHistoryModal: React.FC<ContainerHistoryModalProps> = ({ isOpen, onClose, destContainerMap, rules }) => {
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-[800px] max-w-[95%] h-[600px] max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b flex justify-between items-center">
          <h3 className="text-lg font-bold text-slate-800">{t('containerHistoryTitle')}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100"><X size={20} /></button>
        </div>
        
        <div className="flex-1 flex flex-col sm:flex-row overflow-hidden">
          <div className="w-full sm:w-1/3 border-b sm:border-b-0 sm:border-r flex flex-col h-48 sm:h-auto">
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
                 <button 
                   key={container.containerNo}
                   onClick={() => setSelectedContainer(container)}
                   className={`w-full text-left px-3 py-2 text-sm truncate font-mono ${selectedContainer?.containerNo === container.containerNo ? 'bg-blue-100 text-blue-700 font-medium' : 'hover:bg-slate-50'}`}
                 >
                   {container.containerNo}
                 </button>
               ))}
               {filteredContainers.length === 0 && <p className="text-center text-xs text-slate-400 p-4">{t('noContainerFound')}</p>}
            </div>
          </div>
          
          <div className="w-full sm:w-2/3 overflow-y-auto p-4">
             {selectedContainer ? (
               <div>
                 <h4 className="font-bold text-slate-700 mb-3">{t('containerDetails')}: <span className="font-mono bg-slate-100 px-2 py-1 rounded">{selectedContainer.containerNo}</span></h4>
                 <table className="w-full text-sm">
                    <thead className="text-left bg-slate-50 text-slate-500">
                      <tr>
                        <th className="p-2 font-medium">{t('colDest')}</th>
                        <th className="p-2 font-medium">{t('locationArrangement')}</th>
                        <th className="p-2 font-medium text-right">{t('palletCount')}</th>
                        <th className="p-2 font-medium text-right">{t('colCartons')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedContainer.entries.map((entry, index) => (
                        <tr key={index}>
                          <td className="p-2">{entry.dest}</td>
                          <td className="p-2 text-xs text-slate-500">{getLocationArrangement(entry.dest)}</td>
                          <td className="p-2 text-right font-medium">{entry.pallets}</td>
                          <td className="p-2 text-right font-medium">{entry.cartons}</td>
                        </tr>
                      ))}
                    </tbody>
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
  const [accounts, setAccounts] = useState<Accounts>(DEFAULT_ACCOUNTS);
  const { addNotification } = useNotifications();
  const { t } = useLanguage();

  const syncChannel = useMemo(() => new BroadcastChannel('linkw_app_sync'), []);

  useEffect(() => {
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
    
    const savedAccounts = localStorage.getItem(ACCOUNTS_KEY);
    if (savedAccounts) {
        try { setAccounts(JSON.parse(savedAccounts)); } catch(e) {}
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

  }, []);

  useEffect(() => {
    const handleSync = () => {
         try {
             const savedRules = localStorage.getItem(STORAGE_KEY);
             if (savedRules) setRules(JSON.parse(savedRules));
             
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
    };
  }, [addNotification, t, syncChannel]);

  const broadcastUpdate = () => {
      syncChannel.postMessage('SYNC_UPDATE');
  };

  useEffect(() => {
    const handler = setTimeout(() => {
        if(rules.length > 0) {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(rules));
            broadcastUpdate();
        }
    }, 800);
    return () => clearTimeout(handler);
  }, [rules]);
  
  useEffect(() => {
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));
    broadcastUpdate();
  }, [accounts]);

  useEffect(() => {
    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
    broadcastUpdate();
  }, [logs]);
  
  useEffect(() => {
    localStorage.setItem(EXCEPTIONS_KEY, JSON.stringify(exceptions));
    broadcastUpdate();
  }, [exceptions]);

  useEffect(() => {
    const handler = setTimeout(() => {
        localStorage.setItem(DEST_CONTAINER_KEY, JSON.stringify(destContainerMap));
        broadcastUpdate();
    }, 800); 
    return () => clearTimeout(handler);
  }, [destContainerMap]);


  const addLog = (text: string, location?: string) => {
    const newLog: LogEntry = { time: new Date().toLocaleString(), text, location };
    setLogs(prev => [newLog, ...prev].slice(0, 300));
  };

  const addException = (entry: Omit<ExceptionEntry, 'id' | 'time'>) => {
    const newException: ExceptionEntry = {
      ...entry,
      id: `${new Date().toISOString()}-${Math.random()}`,
      time: new Date().toLocaleString(),
    };
    setExceptions(prev => [newException, ...prev]);
    addLog(`Exception Recorded: ${entry.description}`);
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


  if (!userRole) {
    return <Login onLogin={(role) => {
        setUserRole(role);
        addLog(`User logged in: ${role}`);
    }} accounts={accounts} />;
  }

  return (
    <Router>
      <Layout 
        userRole={userRole} 
        onLogout={() => setUserRole(null)} 
        onQueryContainerHistory={() => setIsHistoryModalOpen(true)}
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
      <ContainerHistoryModal isOpen={isHistoryModalOpen} onClose={() => setIsHistoryModalOpen(false)} destContainerMap={destContainerMap} rules={rules} />
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
