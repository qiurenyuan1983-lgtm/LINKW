import React, { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, Package, AlertTriangle, Search, Menu, X, Users, Languages, Warehouse, RefreshCw, HardDrive, Cloud } from 'lucide-react';
import { UserRole } from '../types';
import { useLanguage } from '../contexts/LanguageContext';

interface LayoutProps {
  children: React.ReactNode;
  userRole: UserRole;
  onLogout: () => void;
  onQueryContainerHistory: () => void;
  onOpenCloudSync: () => void;
}

const Layout: React.FC<LayoutProps> = ({ children, userRole, onLogout, onQueryContainerHistory, onOpenCloudSync }) => {
  const { t, language, setLanguage } = useLanguage();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const location = useLocation();

  // Fix BarChart2 import for BI link
  const BarChart2 = ({ size }: { size: number }) => (
     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
  );

  const navLinks = [
    { to: '/', labelKey: 'dashboard', icon: LayoutDashboard, roles: ['Mike', 'operator', 'staff'] },
    { to: '/rules', labelKey: 'rulesOps', icon: ClipboardList, roles: ['Mike', 'operator', 'staff'] },
    { to: '/bi', labelKey: 'biSystem', icon: BarChart2, roles: ['Mike', 'operator'] },
    { to: '/exceptions', labelKey: 'exceptionsTitle', icon: AlertTriangle, roles: ['Mike', 'operator', 'staff'] },
    { to: '/wms', labelKey: 'wmsSystem', icon: Package, roles: ['Mike', 'operator'] },
    { to: '/users', labelKey: 'userManagement', icon: Users, roles: ['Mike'] },
    { to: '/locations', labelKey: 'locationManagement', icon: Warehouse, roles: ['Mike'] },
  ];

  const filteredNavLinks = navLinks.filter(link => userRole && link.roles.includes(userRole as string));

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location]);

  const SidebarContent = () => (
    <>
      <div className="flex items-center gap-3 px-4 py-4 border-b border-slate-700/50">
        <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-xl tracking-tighter">
            LW
        </div>
        <div>
          <h1 className="font-bold text-white">{t('appTitle')}</h1>
          <p className="text-xs text-slate-400">{t('appSubtitle')}</p>
        </div>
      </div>
      <nav className="flex-1 px-2 py-4 space-y-2">
        {filteredNavLinks.map(link => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
              }`
            }
          >
            <link.icon size={20} />
            {t(link.labelKey as any)}
          </NavLink>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-slate-700/50">
        <div className="flex items-center justify-between text-slate-400 text-xs">
          <span>{t('user')}: <span className="font-semibold text-white">{userRole}</span></span>
          <button onClick={onLogout} className="underline hover:text-white">{t('signOut')}</button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-slate-100">
      <aside className="hidden md:flex md:flex-col md:w-64 bg-slate-800">
        <SidebarContent />
      </aside>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div className="fixed inset-0 bg-black/60" onClick={() => setIsSidebarOpen(false)}></div>
          <aside className="relative flex flex-col w-64 bg-slate-800">
            <button onClick={() => setIsSidebarOpen(false)} className="absolute top-3 right-3 text-slate-400 hover:text-white p-1">
                <X size={24} />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 shadow-sm">
          <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="md:hidden p-2 -ml-2 text-slate-500 hover:text-slate-800"
            >
              <Menu size={24} />
            </button>
            <div className="hidden md:block"></div> {/* Spacer */}
            <div className="flex items-center gap-4">
               {/* Sync Status Indicator */}
               <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-slate-100 text-slate-600 rounded-full text-xs font-medium border border-slate-200" title="Data is stored locally in this browser. Use Import/Export to move data between devices.">
                  <HardDrive size={12} />
                  <span>Local Data</span>
                  <div className="w-px h-3 bg-slate-300 mx-1"></div>
                  <RefreshCw size={12} className="animate-spin-slow text-green-600" style={{animationDuration: '3s'}} />
                  <span>Tab Sync</span>
               </div>
               
               {/* Cloud Sync Button */}
               <button onClick={onOpenCloudSync} className="hidden lg:flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-medium border border-blue-200 hover:bg-blue-100 transition-colors" title={t('cloudSync')}>
                  <Cloud size={12} />
                  <span>{t('cloudSync')}</span>
               </button>

               <button onClick={onQueryContainerHistory} className="flex items-center gap-2 text-sm text-slate-500 hover:text-blue-600">
                 <Search size={18} /> <span className="hidden sm:inline">{t('queryContainerHistory')}</span>
               </button>

               <div className="flex items-center gap-1 text-sm border-l pl-4">
                 <Languages size={16} className="text-slate-400" />
                 <button onClick={() => setLanguage('en')} className={`px-2 py-1 rounded ${language === 'en' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}>EN</button>
                 <button onClick={() => setLanguage('zh')} className={`px-2 py-1 rounded ${language === 'zh' ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}>中文</button>
               </div>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-100">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;