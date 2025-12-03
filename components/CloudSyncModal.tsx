import React, { useState, useEffect } from 'react';
import { CloudConfig, FullBackup } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { X, Cloud, Upload, Download, Settings, Save, AlertCircle, CheckCircle } from 'lucide-react';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    config: CloudConfig;
    onSaveConfig: (config: CloudConfig) => void;
    onUpload: () => Promise<void>;
    onDownload: () => Promise<void>;
    lastSyncTime?: string;
}

const CloudSyncModal: React.FC<Props> = ({ isOpen, onClose, config, onSaveConfig, onUpload, onDownload, lastSyncTime }) => {
    const { t } = useLanguage();
    const [url, setUrl] = useState('');
    const [apiKey, setApiKey] = useState('');
    const [showSettings, setShowSettings] = useState(false);
    const [status, setStatus] = useState<{type: 'idle' | 'loading' | 'success' | 'error', message: string}>({ type: 'idle', message: '' });

    useEffect(() => {
        if (isOpen) {
            setUrl(config.url || '');
            setApiKey(config.apiKey || '');
            setShowSettings(!config.url); // Show settings if no URL configured
            setStatus({ type: 'idle', message: '' });
        }
    }, [isOpen, config]);

    const handleSaveSettings = () => {
        if (!url.trim()) {
            setStatus({ type: 'error', message: t('urlRequired') || 'URL is required' });
            return;
        }
        onSaveConfig({ url: url.trim(), apiKey: apiKey.trim() });
        setShowSettings(false);
        setStatus({ type: 'success', message: t('settingsSaved') || 'Settings saved' });
        setTimeout(() => setStatus({ type: 'idle', message: '' }), 2000);
    };

    const handleAction = async (action: 'upload' | 'download') => {
        if (!config.url && !url) {
            setShowSettings(true);
            return;
        }
        
        setStatus({ type: 'loading', message: action === 'upload' ? 'Uploading...' : 'Downloading...' });
        
        try {
            if (action === 'upload') await onUpload();
            else await onDownload();
            setStatus({ type: 'success', message: t('syncSuccess') });
        } catch (e: any) {
            setStatus({ type: 'error', message: e.message || t('syncError') });
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-[500px] max-w-full flex flex-col overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b bg-gradient-to-r from-blue-600 to-blue-700 text-white flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <Cloud size={24} />
                        <div>
                            <h3 className="text-lg font-bold">{t('cloudSync')}</h3>
                            <p className="text-xs text-blue-100">{t('cloudDesc')}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-white/20 transition-colors"><X size={20} /></button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Status Message */}
                    {status.message && (
                        <div className={`p-3 rounded-lg flex items-start gap-2 text-sm ${
                            status.type === 'error' ? 'bg-red-50 text-red-700' : 
                            status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 
                            'bg-blue-50 text-blue-700'
                        }`}>
                            {status.type === 'error' ? <AlertCircle size={16} className="mt-0.5" /> : 
                             status.type === 'success' ? <CheckCircle size={16} className="mt-0.5" /> : 
                             <div className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin mt-0.5" />}
                            {status.message}
                        </div>
                    )}

                    {/* Main Actions */}
                    <div className="grid grid-cols-2 gap-4">
                        <button 
                            onClick={() => handleAction('upload')}
                            disabled={status.type === 'loading' || (!config.url && !showSettings)}
                            className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Upload size={24} />
                            </div>
                            <span className="font-bold text-slate-700">{t('pushToCloud')}</span>
                            <span className="text-xs text-slate-400 mt-1">Local ➔ Server</span>
                        </button>

                        <button 
                            onClick={() => handleAction('download')}
                            disabled={status.type === 'loading' || (!config.url && !showSettings)}
                            className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-xl hover:border-emerald-500 hover:bg-emerald-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                                <Download size={24} />
                            </div>
                            <span className="font-bold text-slate-700">{t('pullFromCloud')}</span>
                            <span className="text-xs text-slate-400 mt-1">Server ➔ Local</span>
                        </button>
                    </div>

                    {lastSyncTime && (
                        <div className="text-center text-xs text-slate-400">
                            {t('lastSync')} <span className="font-medium text-slate-600">{lastSyncTime}</span>
                        </div>
                    )}

                    {/* Settings Toggle */}
                    <div className="border-t pt-4">
                        <button 
                            onClick={() => setShowSettings(!showSettings)} 
                            className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-800 transition-colors"
                        >
                            <Settings size={16} />
                            {t('cloudSettings')}
                        </button>
                    </div>

                    {/* Settings Form */}
                    {showSettings && (
                        <div className="bg-slate-50 p-4 rounded-lg space-y-3 animate-fade-in-up">
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">{t('serverUrl')}</label>
                                <input 
                                    type="text" 
                                    value={url} 
                                    onChange={e => setUrl(e.target.value)} 
                                    placeholder="https://api.example.com/data" 
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-slate-600 mb-1">{t('apiKey')}</label>
                                <input 
                                    type="password" 
                                    value={apiKey} 
                                    onChange={e => setApiKey(e.target.value)} 
                                    placeholder="Optional (Bearer Token)" 
                                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 outline-none" 
                                />
                            </div>
                            <button 
                                onClick={handleSaveSettings}
                                className="w-full py-2 bg-slate-800 text-white text-sm rounded hover:bg-slate-700 transition-colors flex items-center justify-center gap-2"
                            >
                                <Save size={14} /> {t('done')}
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CloudSyncModal;