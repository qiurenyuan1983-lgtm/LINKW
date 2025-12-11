
import React, { useState, useEffect } from 'react';
import { LogEntry } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { X, Search, Container, MapPin, Calendar } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  logs: LogEntry[];
}

const ContainerHistoryModal: React.FC<Props> = ({ isOpen, onClose, logs }) => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<LogEntry[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setSearchTerm('');
        setResults([]);
        setHasSearched(false);
    }
  }, [isOpen]);

  const handleSearch = () => {
    if (!searchTerm.trim()) return;
    
    const termUpper = searchTerm.trim().toUpperCase();
    const filtered = logs.filter(l => 
        (l.containerNo && l.containerNo.toUpperCase().includes(termUpper)) || 
        (l.text && l.text.toUpperCase().includes(termUpper))
    );
    
    setResults(filtered);
    setHasSearched(true);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col m-4 overflow-hidden animate-fade-in-up" onClick={e => e.stopPropagation()}>
        
        <div className="p-4 border-b flex justify-between items-center bg-slate-50">
            <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Container className="text-blue-600" size={20} />
                {t('containerHistoryTitle')}
            </h3>
            <button onClick={onClose} className="p-1 rounded hover:bg-slate-200 text-slate-500"><X size={20} /></button>
        </div>

        <div className="p-4 border-b bg-white">
            <div className="flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearch()}
                        placeholder={t('searchContainer')}
                        className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        autoFocus
                    />
                </div>
                <button 
                    onClick={handleSearch}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium transition-colors"
                >
                    {t('search')}
                </button>
            </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-slate-50 custom-scrollbar">
            {results.length > 0 ? (
                <div className="space-y-3">
                    {results.map((log, i) => (
                        <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded w-fit border border-slate-200">
                                    <Calendar size={12} />
                                    {log.time}
                                </div>
                                {log.location && (
                                    <div className="flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                        <MapPin size={12} />
                                        {log.location}
                                    </div>
                                )}
                            </div>
                            
                            <div className="text-sm text-slate-700 leading-relaxed pl-1">
                                {log.text}
                            </div>

                            {log.containerNo && (
                                <div className="flex items-center gap-2 mt-1 pt-2 border-t border-slate-50">
                                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold">Container</span>
                                    <span className="text-xs font-mono font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">{log.containerNo}</span>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-slate-400 min-h-[200px]">
                    <Search size={48} className="mb-4 opacity-10" />
                    <p className="text-sm">{hasSearched ? t('noContainerFound') : t('enterContainerToSearch')}</p>
                </div>
            )}
        </div>
        
        <div className="p-3 border-t bg-white rounded-b-xl flex justify-between items-center text-xs text-slate-500">
            <span>{t('total')}: {results.length}</span>
            <button onClick={onClose} className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors font-medium">
                {t('close')}
            </button>
        </div>
      </div>
    </div>
  );
};

export default ContainerHistoryModal;
