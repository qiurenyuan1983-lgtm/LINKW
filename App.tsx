
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './components/Login';
import Dashboard from './pages/Dashboard';
import Rules from './pages/Rules';
import BI from './pages/BI';
import Exceptions from './pages/Exceptions';
import WMS from './pages/WMS';
import Users from './pages/Users';
import LocationManager from './pages/LocationManager';
import StockAdjustment from './pages/StockAdjustment';
import CostControl from './pages/CostControl';
import MobileStocktaking from './pages/MobileStocktaking';
import GeminiAssistant from './components/GeminiAssistant';
import CloudSyncModal from './components/CloudSyncModal';
import ContainerHistoryModal from './components/ContainerHistoryModal';
import { LanguageProvider } from './contexts/LanguageContext';
import { NotificationProvider, useNotifications } from './components/Notifications';
import { LogoProvider } from './contexts/LogoContext';
import { generateDefaultRules } from './services/dataService';
import { uploadData, downloadData } from './services/cloudService';
import { 
  LocationRule, LogEntry, DestContainerMap, UserRole, 
  Accounts, CloudConfig, ExceptionEntry, FullBackup 
} from './types';

const STORAGE_KEYS = {
  RULES: "la_location_rules_v14",
  LOGS: "la_logs_v14",
  DEST_MAP: "la_dest_container_map_v14",
  ACCOUNTS: "la_accounts_v14",
  EXCEPTIONS: "la_exceptions_v14",
  CLOUD: "la_cloud_config_v14",
  USER: "la_user_role_v14"
};

const DEFAULT_ACCOUNTS: Accounts = {
  'Mike': { password: '123', role: 'Mike' }
};

const AppContent = () => {
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [rules, setRules] = useState<LocationRule[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [destContainerMap, setDestContainerMap] = useState<DestContainerMap>({});
  const [accounts, setAccounts] = useState<Accounts>(DEFAULT_ACCOUNTS);
  const [exceptions, setExceptions] = useState<ExceptionEntry[]>([]);
  const [cloudConfig, setCloudConfig] = useState<CloudConfig>({ url: '', apiKey: '' });
  
  const [isAssistantOpen, setIsAssistantOpen] = useState(false);
  const [isCloudModalOpen, setIsCloudModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const { addNotification } = useNotifications();

  // Load Initial Data
  useEffect(() => {
    const loadData = () => {
      const savedRules = localStorage.getItem(STORAGE_KEYS.RULES);
      if (savedRules) {
        setRules(JSON.parse(savedRules));
      } else {
        setRules(generateDefaultRules());
      }

      const savedLogs = localStorage.getItem(STORAGE_KEYS.LOGS);
      if (savedLogs) setLogs(JSON.parse(savedLogs));

      const savedDestMap = localStorage.getItem(STORAGE_KEYS.DEST_MAP);
      if (savedDestMap) setDestContainerMap(JSON.parse(savedDestMap));

      const savedAccounts = localStorage.getItem(STORAGE_KEYS.ACCOUNTS);
      if (savedAccounts) {
          try {
              const parsed = JSON.parse(savedAccounts);
              // Ensure DEFAULT_ACCOUNTS (Admin) always exists and overrides to recover from lockouts
              setAccounts({ ...parsed, ...DEFAULT_ACCOUNTS });
          } catch (e) {
              setAccounts(DEFAULT_ACCOUNTS);
          }
      } else {
          setAccounts(DEFAULT_ACCOUNTS);
      }

      const savedExceptions = localStorage.getItem(STORAGE_KEYS.EXCEPTIONS);
      if (savedExceptions) setExceptions(JSON.parse(savedExceptions));

      const savedCloud = localStorage.getItem(STORAGE_KEYS.CLOUD);
      if (savedCloud) setCloudConfig(JSON.parse(savedCloud));
      
      const savedUser = localStorage.getItem(STORAGE_KEYS.USER);
      if (savedUser) setUserRole(savedUser as UserRole);
    };
    loadData();
  }, []);

  // Persistence Effects
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.RULES, JSON.stringify(rules)); }, [rules]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.LOGS, JSON.stringify(logs)); }, [logs]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.DEST_MAP, JSON.stringify(destContainerMap)); }, [destContainerMap]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.ACCOUNTS, JSON.stringify(accounts)); }, [accounts]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.EXCEPTIONS, JSON.stringify(exceptions)); }, [exceptions]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.CLOUD, JSON.stringify(cloudConfig)); }, [cloudConfig]);
  useEffect(() => { 
      if(userRole) localStorage.setItem(STORAGE_KEYS.USER, userRole);
      else localStorage.removeItem(STORAGE_KEYS.USER);
  }, [userRole]);

  // Actions
  const addLog = useCallback((text: string, location?: string, containerNo?: string) => {
    const newLog: LogEntry = {
      time: new Date().toLocaleString(),
      text,
      location,
      containerNo
    };
    setLogs(prev => [newLog, ...prev].slice(0, 1000)); // Keep last 1000 logs
  }, []);

  const handleLogin = (role: UserRole) => {
    setUserRole(role);
    addNotification(`Welcome back, ${role}!`, 'success');
  };

  const handleLogout = () => {
    setUserRole(null);
  };

  const handleAddLocation = (code: string) => {
    if (rules.some(r => r.range === code)) {
      addNotification(`Location ${code} already exists`, 'error');
      return;
    }
    const newRule: LocationRule = {
      range: code,
      type: 'suspense',
      note: '',
      allowedDest: 2,
      currentDest: 0,
      destinations: '',
      maxPallet: 20,
      curPallet: 0,
      curCartons: 0,
      tasks: []
    };
    setRules(prev => [...prev, newRule]);
    addLog(`Added location ${code}`, code);
    addNotification(`Location ${code} added`, 'success');
  };

  const handleDeleteLocation = (code: string) => {
    const rule = rules.find(r => r.range === code);
    if (rule && (rule.curPallet || 0) > 0) {
      addNotification(`Cannot delete ${code} because it is not empty.`, 'error');
      return;
    }
    setRules(prev => prev.filter(r => r.range !== code));
    addLog(`Deleted location ${code}`, code);
    addNotification(`Location ${code} deleted`, 'success');
  };

  const handleUpdateRule = (updatedRule: LocationRule) => {
    setRules(prev => prev.map(r => r.range === updatedRule.range ? updatedRule : r));
  };

  const handleAddUser = (user: { username: string; pass: string; role: UserRole }) => {
    if (accounts[user.username]) {
      addNotification('User already exists', 'error');
      return;
    }
    setAccounts(prev => ({
      ...prev,
      [user.username]: { password: user.pass, role: user.role }
    }));
    addNotification(`User ${user.username} added`, 'success');
  };

  const handleDeleteUser = (username: string) => {
    if (username === 'Mike') {
      addNotification('Cannot delete admin user', 'error');
      return;
    }
    const newAccounts = { ...accounts };
    delete newAccounts[username];
    setAccounts(newAccounts);
    addNotification(`User ${username} deleted`, 'success');
  };

  const handleAddException = (entry: Omit<ExceptionEntry, 'id' | 'time'>) => {
    const newException: ExceptionEntry = {
      ...entry,
      id: Date.now().toString(),
      time: new Date().toLocaleString()
    };
    setExceptions(prev => [newException, ...prev]);
    addNotification('Exception recorded', 'success');
  };

  const handleQueryContainerHistory = () => {
    setIsHistoryModalOpen(true);
  };

  const handleCloudUpload = async () => {
      const backupData: FullBackup = {
          rules,
          logs,
          exceptions,
          destContainerMap,
          accounts,
          version: '1.0',
          timestamp: Date.now(),
          backupDate: new Date().toLocaleString()
      };
      await uploadData(cloudConfig, backupData);
  };

  const handleCloudDownload = async () => {
      const data = await downloadData(cloudConfig);
      if (data) {
          if (data.rules) setRules(data.rules);
          if (data.logs) setLogs(data.logs);
          if (data.exceptions) setExceptions(data.exceptions);
          if (data.destContainerMap) setDestContainerMap(data.destContainerMap);
          if (data.accounts) setAccounts(data.accounts);
          addLog("Restored data from cloud backup");
      }
  };

  if (!userRole) {
    return <Login onLogin={handleLogin} accounts={accounts} />;
  }

  return (
    <Layout 
      userRole={userRole} 
      onLogout={handleLogout} 
      onQueryContainerHistory={handleQueryContainerHistory}
      onOpenCloudSync={() => setIsCloudModalOpen(true)}
    >
      <Routes>
        <Route path="/" element={<Dashboard rules={rules} />} />
        <Route 
            path="/rules" 
            element={
                <Rules 
                    rules={rules} 
                    setRules={setRules} 
                    userRole={userRole} 
                    addLog={addLog} 
                    logs={logs} 
                    destContainerMap={destContainerMap} 
                    setDestContainerMap={setDestContainerMap}
                    addNotification={addNotification}
                    onOpenAssistant={() => setIsAssistantOpen(true)}
                />
            } 
        />
        <Route path="/stocktaking" element={<MobileStocktaking rules={rules} onUpdateRule={handleUpdateRule} addLog={addLog} />} />
        <Route 
            path="/adjustment" 
            element={<StockAdjustment rules={rules} setRules={setRules} addLog={addLog} userRole={userRole} />} 
        />
        <Route path="/bi" element={userRole === 'Mike' ? <BI rules={rules} logs={logs} /> : <Navigate to="/" />} />
        <Route path="/cost" element={(userRole === 'Mike' || userRole === 'stock_adj') ? <CostControl /> : <Navigate to="/" />} />
        <Route path="/exceptions" element={userRole === 'Mike' ? <Exceptions exceptions={exceptions} onAddException={handleAddException} /> : <Navigate to="/" />} />
        
        {/* Pass rules to WMS for native inventory handling */}
        <Route path="/wms" element={userRole === 'Mike' ? <WMS rules={rules} addLog={addLog} /> : <Navigate to="/" />} />
        
        <Route path="/users" element={userRole === 'Mike' ? <Users accounts={accounts} onAddUser={handleAddUser} onDeleteUser={handleDeleteUser} /> : <Navigate to="/" />} />
        <Route 
            path="/locations" 
            element={
                (userRole === 'Mike' || userRole === 'operator' || userRole === 'staff' || userRole === 'bulk_cargo') 
                ? <LocationManager rules={rules} onAddLocation={handleAddLocation} onDeleteLocation={handleDeleteLocation} onUpdateRule={handleUpdateRule} /> 
                : <Navigate to="/" />
            } 
        />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>

      <GeminiAssistant 
        isOpen={isAssistantOpen} 
        onClose={() => setIsAssistantOpen(false)} 
        rules={rules} 
        logs={logs}
        onAddException={handleAddException}
      />
      
      <CloudSyncModal 
        isOpen={isCloudModalOpen} 
        onClose={() => setIsCloudModalOpen(false)}
        config={cloudConfig}
        onSaveConfig={setCloudConfig}
        onUpload={handleCloudUpload}
        onDownload={handleCloudDownload}
      />

      <ContainerHistoryModal 
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        logs={logs}
      />
    </Layout>
  );
};

export default function App() {
  return (
    <LanguageProvider>
      <NotificationProvider>
        <LogoProvider>
          <Router>
            <AppContent />
          </Router>
        </LogoProvider>
      </NotificationProvider>
    </LanguageProvider>
  );
}
