import React, { useState, useEffect, useRef } from 'react';
import { LocationRule } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { ScanLine, Search, Save, History, Check, X, Layers, Camera, Loader2, AlertTriangle, Package, ImageIcon, ArrowLeft } from 'lucide-react';
import BarcodeScanner from '../components/BarcodeScanner';
import { useNotifications } from '../components/Notifications';
import { WarehouseAssistant } from '../services/geminiService';
import { useNavigate } from 'react-router-dom';

interface Props {
  rules: LocationRule[];
  onUpdateRule: (updatedRule: LocationRule) => void;
  addLog: (text: string, location?: string) => void;
}

const MobileStocktaking: React.FC<Props> = ({ rules, onUpdateRule, addLog }) => {
  const { t } = useLanguage();
  const { addNotification } = useNotifications();
  const navigate = useNavigate();
  
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [searchCode, setSearchCode] = useState('');
  const [currentRule, setCurrentRule] = useState<LocationRule | null>(null);
  
  // Form State
  const [pallets, setPallets] = useState<number | ''>('');
  const [cartons, setCartons] = useState<number | ''>('');
  const [destinations, setDestinations] = useState('');
  const [containerNo, setContainerNo] = useState('');
  
  // History State
  const [history, setHistory] = useState<{code: string, time: string, desc: string}[]>([]);

  // AI Analysis State
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzedImage, setAnalyzedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const assistantRef = useRef<WarehouseAssistant | null>(null);

  useEffect(() => {
      // Lazy init the service
      if (!assistantRef.current) {
          assistantRef.current = new WarehouseAssistant();
      }
  }, []);

  const triggerHaptic = () => {
      if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleSearch = (code: string) => {
      const cleanCode = code.trim().toUpperCase();
      setSearchCode(cleanCode);
      const rule = rules.find(r => r.range === cleanCode);
      
      if (rule) {
          setCurrentRule(rule);
          setPallets(rule.curPallet || 0);
          setCartons(rule.curCartons || 0);
          setDestinations(rule.destinations || '');
          setContainerNo(''); // Reset container on new location
          setAnalyzedImage(null);
          triggerHaptic();
      } else {
          setCurrentRule(null);
          addNotification(t('locationNotFound'), 'error');
          if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
      }
  };

  const handleScan = (code: string) => {
      setIsScannerOpen(false);
      handleSearch(code);
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !assistantRef.current) return;

      // Show preview
      const objectUrl = URL.createObjectURL(file);
      setAnalyzedImage(objectUrl);
      setIsAnalyzing(true);

      try {
          const reader = new FileReader();
          reader.onload = async (ev) => {
              const base64Data = (ev.target?.result as string).split(',')[1];
              const result = await assistantRef.current!.analyzeLabelImage(base64Data);
              
              if (result) {
                  triggerHaptic();
                  // Auto-fill logic
                  if (result.destination) {
                      setDestinations(result.destination);
                      // Verify Destination if we are in a location context
                      if (currentRule && currentRule.destinations) {
                          const existingTags = currentRule.destinations.split(/[,，]/).map(t => t.trim().toUpperCase());
                          if (existingTags.length > 0 && !existingTags.includes(result.destination.toUpperCase())) {
                              addNotification(`目的地不匹配 Warning: Label says ${result.destination}, Location has ${currentRule.destinations}`, 'error');
                          } else {
                              addNotification(`目的地匹配: ${result.destination}`, 'success');
                          }
                      }
                  }
                  
                  if (result.cartons !== undefined) {
                      setCartons(result.cartons);
                      addNotification(`识别箱数: ${result.cartons}`, 'info');
                  }

                  if (result.containerNo) {
                      setContainerNo(result.containerNo);
                      addNotification(`识别柜号: ${result.containerNo}`, 'info');
                  }
                  
                  if (!result.destination && !result.containerNo && result.cartons === undefined) {
                      addNotification("未能识别有效信息", 'info');
                  }
                  
              } else {
                  addNotification("无法识别标签内容 (Unrecognized label)", 'error');
              }
              setIsAnalyzing(false);
          };
          reader.readAsDataURL(file);
      } catch (err) {
          console.error(err);
          addNotification("Image analysis failed", 'error');
          setIsAnalyzing(false);
      }
      e.target.value = ''; // Reset
  };

  const handleSave = () => {
      if (!currentRule) return;
      
      const newPallets = Number(pallets) || 0;
      const newCartons = Number(cartons) || 0;
      const newDest = destinations.trim();
      
      // Calculate changes for log
      const changes = [];
      if (newPallets !== (currentRule.curPallet || 0)) changes.push(`Pallets: ${currentRule.curPallet}->${newPallets}`);
      if (newCartons !== (currentRule.curCartons || 0)) changes.push(`Cartons: ${currentRule.curCartons}->${newCartons}`);
      if (newDest !== (currentRule.destinations || '')) changes.push(`Dest: ${currentRule.destinations}->${newDest}`);
      if (containerNo) changes.push(`Container: ${containerNo}`);
      
      if (changes.length === 0) {
          addNotification("No changes made.", 'info');
          return;
      }

      const updatedRule: LocationRule = {
          ...currentRule,
          curPallet: newPallets,
          curCartons: newCartons,
          destinations: newDest,
          currentDest: newDest.split(/[,，]/).filter(Boolean).length
      };

      onUpdateRule(updatedRule);
      
      const logText = `Stocktaking ${currentRule.range}: ${changes.join(', ')}`;
      addLog(logText, currentRule.range);
      
      // Update history
      setHistory(prev => [{
          code: currentRule.range,
          time: new Date().toLocaleTimeString(),
          desc: changes.join(', ')
      }, ...prev].slice(0, 5));

      addNotification(t('updatedLocation', { location: currentRule.range }), 'success');
      triggerHaptic();
      
      // Clear form
      setCurrentRule(null);
      setSearchCode('');
      setContainerNo('');
      setAnalyzedImage(null);
  };

  return (
    <div className="max-w-md mx-auto pb-20 px-4 pt-2">
        <BarcodeScanner 
            isOpen={isScannerOpen} 
            onClose={() => setIsScannerOpen(false)} 
            onScan={handleScan}
            addNotification={addNotification}
        />
        
        {/* Hidden File Input for Camera */}
        <input 
            type="file" 
            ref={fileInputRef} 
            accept="image/*" 
            capture="environment" 
            className="hidden" 
            onChange={handleCameraCapture}
        />

        {/* AI Analysis Overlay */}
        {isAnalyzing && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 backdrop-blur-sm flex-col">
                {analyzedImage && (
                    <img src={analyzedImage} alt="Analyzing" className="w-48 h-48 object-cover rounded-xl mb-6 border-4 border-white/20 shadow-2xl" />
                )}
                <Loader2 size={48} className="text-white animate-spin mb-4" />
                <p className="font-bold text-white text-lg">正在分析板贴...</p>
                <p className="text-sm text-slate-300">Reading Label...</p>
            </div>
        )}

        <div className="flex justify-between items-center mb-6">
            <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-slate-500 hover:text-slate-800">
                <ArrowLeft size={24} />
            </button>
            <h1 className="text-xl font-bold text-slate-800">{t('stocktakingTitle')}</h1>
            <div className="w-10"></div> {/* Spacer for center alignment */}
        </div>

        {/* Action Buttons (Top) */}
        <div className="grid grid-cols-2 gap-4 mb-6">
             <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-indigo-500 to-violet-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95"
            >
                <Camera size={32} className="mb-2" />
                <span className="text-sm font-bold">AI Analyze</span>
            </button>
            
            <button 
                onClick={() => setIsScannerOpen(true)}
                className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-blue-500 to-cyan-600 text-white rounded-xl shadow-lg hover:shadow-xl transition-all active:scale-95"
            >
                <ScanLine size={32} className="mb-2" />
                <span className="text-sm font-bold">Scan Code</span>
            </button>
        </div>

        {/* Search Input */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-6">
            <div className="relative flex gap-2">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                        value={searchCode}
                        onChange={e => setSearchCode(e.target.value.toUpperCase())}
                        onKeyDown={e => e.key === 'Enter' && handleSearch(searchCode)}
                        placeholder={t('enterLocationCode')}
                        className="w-full pl-10 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-lg text-lg font-mono font-bold uppercase focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    <button 
                        onClick={() => setIsScannerOpen(true)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-blue-600"
                        title="Scan Code"
                    >
                        <ScanLine size={20} />
                    </button>
                </div>
                <button 
                    onClick={() => handleSearch(searchCode)}
                    className="px-4 bg-slate-800 text-white rounded-lg font-bold hover:bg-slate-700 transition-colors"
                >
                    GO
                </button>
            </div>
        </div>

        {/* Edit Form */}
        {currentRule && (
            <div className="bg-white rounded-xl shadow-xl border border-blue-100 overflow-hidden animate-fade-in-up mb-6 relative ring-4 ring-blue-50/50">
                
                <div className="bg-gradient-to-r from-blue-50 to-white p-4 border-b border-blue-100 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                            {currentRule.range}
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-bold uppercase border border-blue-200">
                                {currentRule.type}
                            </span>
                            <span className="text-xs text-slate-500">Max: {currentRule.maxPallet}</span>
                        </div>
                    </div>
                    <button onClick={() => setCurrentRule(null)} className="p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"><X size={20} /></button>
                </div>
                
                <div className="p-5 space-y-5">
                    {/* Smart Fill Suggestion (if analysis happened) */}
                    {analyzedImage && (
                        <div className="relative h-24 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex items-center">
                            <img src={analyzedImage} alt="Label" className="h-full w-24 object-cover" />
                            <div className="p-3 flex-1">
                                <p className="text-xs font-bold text-slate-500 uppercase mb-1">AI Detected</p>
                                <div className="space-y-0.5">
                                    {destinations && <span className="inline-block mr-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded border border-indigo-200">{destinations}</span>}
                                    {containerNo && <span className="inline-block mr-2 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded border border-indigo-200">{containerNo}</span>}
                                    {Number(cartons) > 0 && <span className="inline-block px-1.5 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded border border-indigo-200">{cartons} ctns</span>}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                    <Layers size={14} /> {t('palletCount')}
                                </label>
                                <div className="flex items-center shadow-sm rounded-lg overflow-hidden">
                                    <button 
                                        onClick={() => setPallets(Math.max(0, (Number(pallets) || 0) - 1))}
                                        className="w-10 h-12 flex items-center justify-center bg-white text-slate-600 hover:bg-slate-50 border-r border-slate-100 active:bg-slate-200"
                                    >-</button>
                                    <input 
                                        type="number" 
                                        value={pallets}
                                        onChange={e => setPallets(e.target.value === '' ? '' : parseInt(e.target.value))}
                                        className="flex-1 w-full h-12 text-center text-2xl font-bold text-blue-600 outline-none"
                                    />
                                    <button 
                                        onClick={() => setPallets((Number(pallets) || 0) + 1)}
                                        className="w-10 h-12 flex items-center justify-center bg-white text-slate-600 hover:bg-slate-50 border-l border-slate-100 active:bg-slate-200"
                                    >+</button>
                                </div>
                            </div>
                            
                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2 flex items-center gap-1">
                                    <Package size={14} /> {t('colCartons')}
                                </label>
                                <input 
                                    type="number" 
                                    value={cartons}
                                    onChange={e => setCartons(e.target.value === '' ? '' : parseInt(e.target.value))}
                                    className="w-full h-12 text-center border-none shadow-sm rounded-lg text-xl font-bold outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="0"
                                />
                            </div>
                        </div>
                        
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                            <div className="flex justify-between items-center mb-2">
                                <label className="block text-xs font-bold text-slate-500 uppercase">{t('destinations')}</label>
                                {/* Comparison Logic */}
                                {currentRule.destinations && destinations && !currentRule.destinations.includes(destinations) && (
                                    <span className="text-[10px] text-red-500 flex items-center gap-1 font-bold animate-pulse">
                                        <AlertTriangle size={10} /> Mismatch
                                    </span>
                                )}
                            </div>
                            <input 
                                value={destinations}
                                onChange={e => setDestinations(e.target.value)}
                                className="w-full px-4 py-3 border-none shadow-sm rounded-lg text-base font-medium outline-none focus:ring-2 focus:ring-blue-500"
                                placeholder="e.g. CLT2"
                            />
                            {currentRule.destinations && (
                                <p className="text-[10px] text-slate-400 mt-2 flex items-center gap-1">
                                    <History size={10} /> Current: {currentRule.destinations}
                                </p>
                            )}
                        </div>
                    </div>

                    <button 
                        onClick={handleSave}
                        className="w-full py-4 bg-blue-600 text-white rounded-xl font-bold text-lg shadow-lg shadow-blue-200 hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <Save size={24} /> {t('confirmUpdate')}
                    </button>
                </div>
            </div>
        )}

        {/* History */}
        <div className="space-y-3">
            <h3 className="text-sm font-bold text-slate-500 uppercase flex items-center gap-2 px-1">
                <History size={16} /> {t('recentUpdates')}
            </h3>
            {history.length === 0 ? (
                <div className="text-center py-8 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    No updates yet.
                </div>
            ) : (
                history.map((h, i) => (
                    <div key={i} className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex justify-between items-center animate-fade-in-down">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-lg text-slate-800">{h.code}</span>
                                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{h.time}</span>
                            </div>
                            <p className="text-xs text-slate-500 mt-1">{h.desc}</p>
                        </div>
                        <div className="text-emerald-500 bg-emerald-50 p-1.5 rounded-full"><Check size={16} /></div>
                    </div>
                ))
            )}
        </div>
    </div>
  );
};

export default MobileStocktaking;