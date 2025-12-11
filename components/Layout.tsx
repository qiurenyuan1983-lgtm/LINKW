
import React, { useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, ClipboardList, AlertTriangle, Search, Menu, X, Users, Languages, Warehouse, RefreshCw, HardDrive, Cloud, ChevronDown, ChevronUp, Globe, ArrowLeftRight, Download, DollarSign, ScanLine } from 'lucide-react';
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
  const navigate = useNavigate();
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});
  
  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Update UI notify the user they can install the PWA
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
    } else {
      console.log('User dismissed the install prompt');
    }
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  // Fix BarChart2 import for BI link
  const BarChart2 = ({ size }: { size: number }) => (
     <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
  );

  interface NavItem {
      to?: string;
      labelKey: string;
      icon: React.ElementType;
      roles: string[];
      children?: { to: string; labelKey: string }[];
  }

  // Definition of roles:
  // Admin: Mike
  // Warehouse Admin (Administrative): stock_adj
  // Others: operator, staff, bulk_cargo

  const navLinks: NavItem[] = [
    // Dashboard: All roles
    { to: '/', labelKey: 'dashboard', icon: LayoutDashboard, roles: ['Mike', 'stock_adj', 'operator', 'staff', 'bulk_cargo'] },
    
    // Mobile Stocktaking: Added for Operators & Staff mostly, but available to all relevant
    { to: '/stocktaking', labelKey: 'mobileStocktaking', icon: ScanLine, roles: ['Mike', 'stock_adj', 'operator', 'staff', 'bulk_cargo'] },

    // Rules: All roles
    { to: '/rules', labelKey: 'rulesOps', icon: ClipboardList, roles: ['Mike', 'stock_adj', 'operator', 'staff', 'bulk_cargo'] },
    
    // Stock Adjustment: All roles
    { to: '/adjustment', labelKey: 'stockAdjustment', icon: ArrowLeftRight, roles: ['Mike', 'stock_adj', 'operator', 'staff', 'bulk_cargo'] },
    
    // BI: Admin Only
    { to: '/bi', labelKey: 'biSystem', icon: BarChart2, roles: ['Mike'] },
    
    // Cost Control: Admin & Warehouse Admin
    { to: '/cost', labelKey: 'costControl', icon: DollarSign, roles: ['Mike', 'stock_adj'] },
    
    // Exceptions: Admin Only
    { to: '/exceptions', labelKey: 'exceptionsTitle', icon: AlertTriangle, roles: ['Mike'] },
    
    // WMS: Admin Only
    { to: '/wms', labelKey: 'wms', icon: Globe, roles: ['Mike'] },
    
    // User Management: Admin Only
    { to: '/users', labelKey: 'userManagement', icon: Users, roles: ['Mike'] },
    
    // Location Management: Admin & Others (operator, staff, bulk_cargo)
    // Excluded 'stock_adj' based on "Other accounts permissions: Location Management" vs "Warehouse Admin: ...Cost Control"
    { to: '/locations', labelKey: 'locationManagement', icon: Warehouse, roles: ['Mike', 'operator', 'staff', 'bulk_cargo'] },
  ];

  const filteredNavLinks = navLinks.filter(link => userRole && link.roles.includes(userRole as string));

  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location]);

  const toggleMenu = (key: string) => {
      setOpenMenus(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
      <nav className="flex-1 px-2 py-4 space-y-2 overflow-y-auto">
        {filteredNavLinks.map(link => {
          if (link.children) {
             const isOpen = openMenus[link.labelKey];
             // Simple active check for children
             const isActiveParent = link.children.some(child => location.pathname === child.to);
             
             return (
                 <div key={link.labelKey} className="space-y-1">
                     <button
                        onClick={() => toggleMenu(link.labelKey)}
                        className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                            isActiveParent || isOpen ? 'text-white' : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                        }`}
                     >
                        <div className="flex items-center gap-3">
                            <link.icon size={20} />
                            {t(link.labelKey as any)}
                        </div>
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                     </button>
                     {isOpen && (
                         <div className="pl-4 space-y-1 animate-fade-in-down">
                             {link.children.map(child => (
                                 <NavLink
                                    key={child.to}
                                    to={child.to}
                                    className={({ isActive }) => {
                                        return `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                            isActive
                                            ? 'bg-blue-600 text-white'
                                            : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'
                                        }`;
                                    }}
                                 >
                                     <div className="w-1.5 h-1.5 rounded-full bg-current opacity-60"></div>
                                     {t(child.labelKey as any)}
                                 </NavLink>
                             ))}
                         </div>
                     )}
                 </div>
             )
          }

          return (
            <NavLink
              key={link.to}
              to={link.to!}
              className={({ isActive }) => {
                return `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:bg-slate-700/50 hover:text-white'
                }`;
              }}
            >
              <link.icon size={20} />
              {t(link.labelKey as any)}
            </NavLink>
          );
        })}
      </nav>
      <div className="px-4 py-4 border-t border-slate-700/50">
        {/* Add Cloud Sync Button here for mobile/sidebar access */}
        <button 
            onClick={onOpenCloudSync}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-700/50 hover:text-white mb-2 transition-colors"
        >
            <Cloud size={20} />
            {t('cloudSync')}
        </button>
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

      <div className="flex-1 flex flex-col overflow-hidden relative">
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
               {/* Install App Button - Header Version (Desktop mainly) */}
               {showInstallBtn && (
                   <button 
                      onClick={handleInstallClick} 
                      className="hidden lg:flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full text-xs font-medium shadow-md hover:shadow-lg transition-all animate-fade-in-right"
                   >
                      <Download size={14} />
                      <span>{t('installApp')}</span>
                   </button>
               )}

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

        {/* PWA Install Banner (Fixed Bottom) */}
        {showInstallBtn && (
          <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:w-96 bg-white border border-slate-200 p-4 rounded-xl shadow-2xl flex items-center justify-between animate-fade-in-up">
             <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl shadow-sm">
                   LW
                </div>
                <div>
                   <h4 className="font-bold text-slate-800 text-sm">{t('installApp')}</h4>
                   <p className="text-xs text-slate-500 leading-tight mt-0.5">{t('installAppDesc')}</p>
                </div>
             </div>
             <div className="flex items-center gap-2 pl-2">
                <button 
                   onClick={() => setShowInstallBtn(false)}
                   className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                   <X size={18} />
                </button>
                <button 
                   onClick={handleInstallClick}
                   className="px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-lg hover:bg-blue-700 shadow-md transition-all whitespace-nowrap"
                >
                   {t('install')}
                </button>
             </div>
          </div>
        )}
      </div>
      <style>{`
        @keyframes fade-in-down {
          from { opacity: 0; transform: translateY(-0.5rem); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-down { animation: fade-in-down 0.2s ease-out; }
      `}</style>
    </div>
  );
};

export default Layout;
