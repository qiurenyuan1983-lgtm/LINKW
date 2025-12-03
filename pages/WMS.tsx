import React, { useState, useEffect } from 'react';
import { Package, Truck, AlertTriangle, Database, ExternalLink } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

const WMS_URL_STORAGE_KEY_PREFIX = "la_wms_url_";

const WMS: React.FC = () => {
  const [activeTab, setActiveTab] = useState('inventory');
  const [iframeUrl, setIframeUrl] = useState('');
  const [inputUrl, setInputUrl] = useState('');
  const { t } = useLanguage();

  const getStorageKey = (tabId: string) => `${WMS_URL_STORAGE_KEY_PREFIX}${tabId}`;

  useEffect(() => {
    const key = getStorageKey(activeTab);
    const saved = localStorage.getItem(key);
    if (saved) {
      setIframeUrl(saved);
      setInputUrl(saved);
    } else {
      setIframeUrl('');
      setInputUrl('');
    }
  }, [activeTab]);

  const handleSaveUrl = () => {
    const key = getStorageKey(activeTab);
    setIframeUrl(inputUrl);
    localStorage.setItem(key, inputUrl);
  };

  const tabs = [
    { id: 'inventory', labelKey: 'tabInventory', icon: Package, descKey: 'descInventory' },
    { id: 'inbound', labelKey: 'tabInbound', icon: Truck, descKey: 'descInbound' },
    { id: 'outbound', labelKey: 'tabOutbound', icon: ExternalLink, descKey: 'descOutbound' },
    { id: 'master', labelKey: 'tabMaster', icon: Database, descKey: 'descMaster' },
  ];

  return (
    <div className="flex flex-col h-full space-y-4">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Left Nav */}
        <div className="w-full md:w-64 flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-visible">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-start p-3 rounded-xl border transition-all min-w-[140px] md:min-w-0 ${
                activeTab === tab.id
                  ? 'bg-white border-blue-500 shadow-md ring-1 ring-blue-500'
                  : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-500'
              }`}
            >
              <div className={`flex items-center gap-2 font-medium ${activeTab === tab.id ? 'text-blue-600' : 'text-slate-700'}`}>
                <tab.icon size={18} />
                {t(tab.labelKey as any)}
              </div>
              <div className="text-[10px] mt-1 text-slate-400">{t(tab.descKey as any)}</div>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 bg-white rounded-xl border border-slate-200 shadow-sm p-4 min-h-[500px] flex flex-col">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {t(tabs.find(t=>t.id===activeTab)?.labelKey as any)} {t('wmsModule')}
                <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{t('wmsIntegration')}</span>
            </h2>
            <p className="text-sm text-slate-500 mt-1">
                {t(tabs.find(t=>t.id===activeTab)?.descKey as any)}
            </p>
          </div>

          <div className="flex-1 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden relative">
             {iframeUrl ? (
                 <iframe src={iframeUrl} className="w-full h-full border-none" title="WMS" />
             ) : (
                 <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 p-8 text-center">
                    <Database size={48} className="mb-4 opacity-20" />
                    <p>{t('noWmsUrl')}</p>
                    <p className="text-xs mt-2">{t('enterWmsUrl')}</p>
                 </div>
             )}
          </div>
          
          <div className="mt-4 flex gap-2">
            <input 
                type="text" 
                className="flex-1 border border-slate-300 rounded px-3 py-2 text-sm"
                placeholder="https://wms.yourcompany.com"
                value={inputUrl}
                onChange={e => setInputUrl(e.target.value)}
            />
            <button onClick={handleSaveUrl} className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
                {t('loadWms')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WMS;