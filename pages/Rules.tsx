
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { LocationRule, UserRole, ColumnConfig, LOCATION_TYPES, DESTINATION_OPTIONS, UnloadPlan, UnloadPlanRow, DestContainerMap, LogEntry, ContainerStats, Task } from '../types';
import * as XLSX from 'xlsx';
import { parseUnloadSheet, assignLocationsForUnload, parseOutboundSheet, parseContainerMapSheet, parseInventorySheet, normalizeDestinationCode, generateUnloadPlanSheet } from '../services/excelService';
import { Search, Plus, Download, Upload, Settings, X, Trash2, FileText, ArrowUp, ArrowDown, ArrowUpDown, History, Hand, ScanLine, CheckSquare, Square, ChevronDown, Files, Container, ArrowRight, ClipboardList, CheckCircle, Circle, Sparkles, GripVertical, AlertTriangle, Layers, MoveRight, MapPin, RotateCcw } from 'lucide-react';
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
  addLog: (text: string, location?: string, containerNo?: string) => void;
  logs: LogEntry[];
  destContainerMap: DestContainerMap;
  setDestContainerMap: React.Dispatch<React.SetStateAction<DestContainerMap>>;
  addNotification: (message: string, type?: 'success' | 'error' | 'info') => void;
  onOpenAssistant: () => void;
}

// Destination Selector Modal Component
interface DestSelectorProps {
    isOpen: boolean;
    onClose: () => void;
    currentDestinations: string;
    allowedCount: number | null;
    onSave: (newDestinations: string) => void;
    title: string;
    options: string[];
}

const DestinationSelectorModal: React.FC<DestSelectorProps> = ({ isOpen, onClose, currentDestinations, allowedCount, onSave, title, options }) => {
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

    const filteredOptions = options.filter(opt => 
        opt.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const isExactMatch = filteredOptions.some(opt => opt.toLowerCase() === searchTerm.toLowerCase());
    const isAlreadySelected = selected.some(s => s.toLowerCase() === searchTerm.toLowerCase());
    const showAddCustom = searchTerm.trim() !== '' && !isExactMatch && !isAlreadySelected;

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
                        {/* Custom Add Option */}
                        {showAddCustom && (
                             <div 
                                onClick={() => toggleSelection(searchTerm.trim())}
                                className="flex items-center gap-2 p-2 rounded cursor-pointer border border-dashed border-blue-300 bg-blue-50 hover:bg-blue-100 col-span-2 animate-fade-in-up"
                            >
                                <Plus size={18} className="text-blue-600" />
                                <span className="text-sm font-medium text-blue-700">{t('add')} "{searchTerm}"</span>
                            </div>
                        )}
                        
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
                    {filteredOptions.length === 0 && !showAddCustom && (
                        <p className="text-center text-slate-400 py-4">No matching destinations found.</p>
                    )}
                </div>

                <div className="p-4 border-t bg-slate-50 rounded-b-xl flex justify-between items-center">
                    <span className="text-sm font-medium text-slate-600">
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

// Delete Tag Modal Component
interface DeleteTagModalProps {
    isOpen: boolean;
    onClose: () => void;
    tag: string;
    rule: LocationRule;
    destContainerMap: DestContainerMap;
    onConfirm: (data: { deduct: boolean; pallets: number; cartons: number; containerNo?: string }) => void;
}

const DeleteTagModal: React.FC<DeleteTagModalProps> = ({ isOpen, onClose, tag, rule, destContainerMap, onConfirm }) => {
    const { t } = useLanguage();
    const [deduct, setDeduct] = useState(false);
    const [pallets, setPallets] = useState<string>('');
    const [selectedContainer, setSelectedContainer] = useState<string>('');

    // Use local container info if available, otherwise global map keys
    const containers = useMemo(() => {
        if (rule.containers && Object.keys(rule.containers).length > 0) {
            return Object.keys(rule.containers);
        }
        if (!tag || !destContainerMap[tag]) return [];
        return Object.keys(destContainerMap[tag]);
    }, [tag, destContainerMap, rule.containers]);

    useEffect(() => {
        if(isOpen) {
            const tags = rule.destinations?.split(/[,，]/).filter(Boolean) || [];
            const isSingle = tags.length === 1;
            // Default check deduct if there is stock
            const hasStock = (rule.curPallet || 0) > 0;
            setDeduct(hasStock && isSingle);
            
            // Auto-fill values if it's the only tag
            if (isSingle && hasStock) {
                setPallets(String(rule.curPallet || 0));
            } else {
                setPallets('');
            }
            setSelectedContainer('');
        }
    }, [isOpen, rule, tag]);

    const handleConfirm = () => {
        onConfirm({
            deduct,
            pallets: Number(pallets) || 0,
            cartons: 0, // Removed carton input
            containerNo: selectedContainer || undefined
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-[400px] max-w-full flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <h3 className="text-lg font-bold text-red-600 flex items-center gap-2">
                        <Trash2 size={20} /> {t('removeTag')}
                    </h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-slate-200"><X size={20} /></button>
                </div>
                
                <div className="p-6 space-y-4">
                    <div className="text-center">
                        <p className="text-slate-700 font-medium text-lg">"{tag}"</p>
                        <p className="text-sm text-slate-500">{t('locationManagement')}: {rule.range}</p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <label className="flex items-center gap-2 cursor-pointer mb-2">
                            <input 
                                type="checkbox" 
                                checked={deduct} 
                                onChange={e => setDeduct(e.target.checked)} 
                                className="w-4 h-4 text-red-600 rounded focus:ring-red-500"
                            />
                            <span className="text-sm font-bold text-slate-700">同时扣减库存? (Deduct Stock?)</span>
                        </label>
                        
                        {deduct && (
                            <div className="space-y-3 pl-6 animate-fade-in-down">
                                <div>
                                    <label className="block text-xs font-medium text-slate-500 mb-1">{t('palletCount')}</label>
                                    <input 
                                        type="number" 
                                        value={pallets} 
                                        onChange={e => setPallets(e.target.value)} 
                                        className="w-full px-2 py-1.5 border rounded text-sm"
                                        placeholder="0"
                                    />
                                </div>
                                
                                {containers.length > 0 && (
                                    <div>
                                        <label className="block text-xs font-medium text-slate-500 mb-1">
                                            对应柜号 (Container - Optional)
                                        </label>
                                        <select 
                                            value={selectedContainer} 
                                            onChange={e => setSelectedContainer(e.target.value)}
                                            className="w-full px-2 py-1.5 border rounded text-sm bg-white"
                                        >
                                            <option value="">-- {t('selectDestinations')} --</option>
                                            {containers.map(c => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                        <p className="text-[10px] text-slate-400 mt-1">
                                            选择柜号将同步扣减该柜的记录。
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t bg-slate-50 rounded-b-xl flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg">{t('cancel')}</button>
                    <button onClick={handleConfirm} className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg font-medium">{t('delete')}</button>
                </div>
            </div>
        </div>
    );
}

// Task Management Modal Component
interface TaskModalProps {
    isOpen: boolean;
    onClose: () => void;
    rule: LocationRule;
    onAddTask: (text: string, priority: 'high' | 'medium' | 'low') => void;
    onToggleTask: (taskId: string) => void;
    onDeleteTask: (taskId: string) => void;
    onClearCompleted: () => void;
}

const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, rule, onAddTask, onToggleTask, onDeleteTask, onClearCompleted }) => {
    const { t } = useLanguage();
    const [newTask, setNewTask] = useState('');
    const [newPriority, setNewPriority] = useState<'high' | 'medium' | 'low'>('medium');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen) {
            setNewTask('');
            setNewPriority('medium');
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (newTask.trim()) {
            onAddTask(newTask.trim(), newPriority);
            setNewTask('');
            setNewPriority('medium');
        }
    };

    const getPriorityColor = (p?: string) => {
        switch(p) {
            case 'high': return 'bg-red-100 text-red-700 border-red-200';
            case 'medium': return 'bg-orange-100 text-orange-700 border-orange-200';
            case 'low': return 'bg-green-100 text-green-700 border-green-200';
            default: return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    if (!isOpen) return null;

    const tasks = rule.tasks || [];
    const pendingTasks = tasks.filter(t => !t.completed).sort((a,b) => {
        const pOrder = { 'high': 3, 'medium': 2, 'low': 1, undefined: 0 };
        const scoreA = pOrder[a.priority || 'medium'];
        const scoreB = pOrder[b.priority || 'medium'];
        return scoreB - scoreA;
    });
    const completedTasks = tasks.filter(t => t.completed);

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-[500px] max-w-full flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b flex justify-between items-center bg-slate-50 rounded-t-xl">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-100 p-1.5 rounded-lg text-blue-600">
                            <ClipboardList size={18} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-slate-800">{t('manageTasks')}</h3>
                            <p className="text-xs text-slate-500 font-mono">{rule.range}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1 rounded hover:bg-slate-200"><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {/* Add Task Form */}
                    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                        <div className="flex gap-2">
                            <select 
                                value={newPriority}
                                onChange={(e) => setNewPriority(e.target.value as any)}
                                className="px-2 py-2 border rounded-lg text-xs font-medium bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="low">{t('pLow')}</option>
                                <option value="medium">{t('pMedium')}</option>
                                <option value="high">{t('pHigh')}</option>
                            </select>
                            <input 
                                ref={inputRef}
                                value={newTask}
                                onChange={e => setNewTask(e.target.value)}
                                placeholder={t('taskPlaceholder')}
                                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                            />
                        </div>
                        <button 
                            type="submit" 
                            disabled={!newTask.trim()}
                            className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                        >
                            {t('add')}
                        </button>
                    </form>

                    {tasks.length === 0 && (
                        <div className="text-center py-8 text-slate-400">
                            <ClipboardList size={32} className="mx-auto mb-2 opacity-20" />
                            <p className="text-sm">{t('noTasks')}</p>
                        </div>
                    )}

                    {/* Pending Tasks */}
                    {pendingTasks.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Pending</h4>
                            {pendingTasks.map(task => (
                                <div key={task.id} className="flex items-start gap-3 p-3 bg-white border border-slate-200 rounded-lg hover:shadow-sm transition-shadow group">
                                    <button onClick={() => onToggleTask(task.id)} className="text-slate-400 hover:text-blue-600 mt-0.5 flex-shrink-0">
                                        <Circle size={18} />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`text-[10px] px-1.5 py-0.5 rounded border uppercase font-bold ${getPriorityColor(task.priority)}`}>
                                                {task.priority ? t(`p${task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}`) : t('pMedium')}
                                            </span>
                                            <span className="text-[10px] text-slate-400">{new Date(task.createdAt).toLocaleString()}</span>
                                        </div>
                                        <div className="text-sm text-slate-700 break-words">{task.content}</div>
                                    </div>
                                    <button onClick={() => onDeleteTask(task.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Completed Tasks */}
                    {completedTasks.length > 0 && (
                        <div className="space-y-2 pt-4 border-t border-slate-100 mt-2">
                            <div className="flex justify-between items-center">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Completed</h4>
                                <button 
                                    onClick={onClearCompleted}
                                    className="text-[10px] text-red-500 hover:text-red-700 flex items-center gap-1 hover:bg-red-50 px-2 py-1 rounded transition-colors"
                                >
                                    <Trash2 size={12} /> {t('clearCompleted')}
                                </button>
                            </div>
                            {completedTasks.map(task => (
                                <div key={task.id} className="flex items-start gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg group opacity-75">
                                    <button onClick={() => onToggleTask(task.id)} className="text-emerald-500 hover:text-emerald-600 mt-0.5 flex-shrink-0">
                                        <CheckCircle size={18} />
                                    </button>
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm text-slate-500 line-through decoration-slate-400 break-words">{task.content}</div>
                                        <div className="text-[10px] text-slate-400 mt-1">{new Date(task.createdAt).toLocaleString()}</div>
                                    </div>
                                    <button onClick={() => onDeleteTask(task.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                                        <Trash2 size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


const Rules: React.FC<Props> = ({ rules, setRules, userRole, addLog, logs, destContainerMap, setDestContainerMap, addNotification, onOpenAssistant }) => {
  const { t } = useLanguage();

  const DEFAULT_COLUMNS: ColumnConfig[] = useMemo(() => [
    { id: 'range', label: t('colRange'), order: 1, visible: true },
    { id: 'destinations', label: t('colDest'), order: 2, visible: true },
    { id: 'type', label: t('colType'), order: 3, visible: true },
    { id: 'maxPallet', label: t('colMax'), order: 4, visible: true },
    { id: 'curPallet', label: t('colCur'), order: 5, visible: true },
    { id: 'curCartons', label: t('colCartons'), order: 6, visible: false },
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
  const [draggedColId, setDraggedColId] = useState<string | null>(null);
  
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
  
  // Animation state for rule updates
  const [recentlyUpdated, setRecentlyUpdated] = useState<string[]>([]);
  const prevRulesRef = useRef<LocationRule[]>([]);

  // Effect to detect rule changes and trigger animation
  useEffect(() => {
    if (prevRulesRef.current && prevRulesRef.current.length > 0 && rules.length > 0) {
      const updatedRanges: string[] = [];
      // Use map for O(1) lookup of old rules
      const prevRulesMap = new Map(prevRulesRef.current.map(r => [r.range, JSON.stringify(r)]));

      for (const newRule of rules) {
        const oldRuleJSON = prevRulesMap.get(newRule.range);
        // If it existed before and is now different (string comparison is simple for deep equality here)
        if (oldRuleJSON && oldRuleJSON !== JSON.stringify(newRule)) {
          updatedRanges.push(newRule.range);
        }
      }
      
      if (updatedRanges.length > 0) {
        setRecentlyUpdated(updatedRanges);
        // Clear highlight after animation duration
        const timer = setTimeout(() => {
          setRecentlyUpdated(current => current.filter(item => !updatedRanges.includes(item)));
        }, 2000); 
        return () => clearTimeout(timer);
      }
    }
    // Update ref for next comparison
    prevRulesRef.current = rules;
  }, [rules]);
  
  // Store the last unload plan for re-export (Round-Trip)
  const [lastUnloadPlan, setLastUnloadPlan] = useState<UnloadPlan | null>(null);

  // Modal for destination selection
  const [selectorModal, setSelectorModal] = useState<{
      isOpen: boolean;
      ruleIndex: number;
      currentDestinations: string;
      allowedCount: number | null;
      range: string;
  }>({ isOpen: false, ruleIndex: -1, currentDestinations: '', allowedCount: null, range: '' });

  // Modal for Tag Deletion
  const [deleteTagModal, setDeleteTagModal] = useState<{
      isOpen: boolean;
      ruleIndex: number;
      tag: string;
  }>({ isOpen: false, ruleIndex: -1, tag: '' });

  // Modal for Transfer
  const [transferModal, setTransferModal] = useState<{
      isOpen: boolean;
      sourceIndex: number;
      sourceRange: string;
      targetRange: string;
  }>({ isOpen: false, sourceIndex: -1, sourceRange: '', targetRange: '' });

  // Modal for Task Management
  const [taskModal, setTaskModal] = useState<{
      isOpen: boolean;
      ruleIndex: number;
  }>({ isOpen: false, ruleIndex: -1 });

  // Inventory Menu State
  const [showInventoryMenu, setShowInventoryMenu] = useState(false);
  const inventoryMenuRef = useRef<HTMLDivElement>(null);
  
  // Unload Menu State
  const [showUnloadMenu, setShowUnloadMenu] = useState(false);
  const unloadMenuRef = useRef<HTMLDivElement>(null);

  // Column Settings Ref
  const colSettingsRef = useRef<HTMLDivElement>(null);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (inventoryMenuRef.current && !inventoryMenuRef.current.contains(event.target as Node)) {
            setShowInventoryMenu(false);
        }
        if (unloadMenuRef.current && !unloadMenuRef.current.contains(event.target as Node)) {
            setShowUnloadMenu(false);
        }
        if (colSettingsRef.current && !colSettingsRef.current.contains(event.target as Node)) {
            setShowColSettings(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const prevRulesRefManual = useRef<LocationRule[]>([]);


  // Manual Unload Modal
  const [showManualUnload, setShowManualUnload] = useState(false);
  const [manualContainerNo, setManualContainerNo] = useState('');
  const [manualRows, setManualRows] = useState<{dest: string, pallets: number, cartons: number}[]>([{dest: '', pallets: 1, cartons: 0}]);
  
  // Real-time Recommendations for Manual Unload
  const [manualRecommendations, setManualRecommendations] = useState<string[]>([]);

  useEffect(() => {
      if (showManualUnload) {
          // Transform manualRows to UnloadPlanRow format
          const tempRows: UnloadPlanRow[] = manualRows.map((r, i) => ({
              dest: r.dest,
              pallets: r.pallets || 0, // Handle empty input
              cartons: r.cartons || 0,
              containerNo: manualContainerNo,
              raw: [],
              rowIndex: i
          }));

          // Run assignment logic (simulation)
          // We pass 'true' for isManual to enforce strict/manual rules if applicable
          const results = assignLocationsForUnload(tempRows, rules, true);
          
          // Ensure results map back to input rows by rowIndex to maintain order
          const sortedResults = results.sort((a, b) => a.rowIndex - b.rowIndex);
          
          // Map to recommendations array
          const recs = sortedResults.map(r => r.location || '');
          setManualRecommendations(recs);
      } else {
          setManualRecommendations([]);
      }
  }, [manualRows, rules, manualContainerNo, showManualUnload]);

  const isAdmin = userRole === 'Mike';

  const canEdit = (field: keyof LocationRule) => {
    if (isAdmin) return true;
    return ['curPallet', 'curCartons', 'destinations', 'note', 'tasks'].includes(field);
  };

  useEffect(() => {
    if (newRule.type && defaultCapacities[newRule.type]) {
        setNewRule(prev => ({ ...prev, maxPallet: defaultCapacities[newRule.type] }));
    }
  }, [newRule.type]);

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
    
    // Drag and Drop Logic for Columns
    const handleDragStart = (e: React.DragEvent, id: string) => {
        setDraggedColId(id);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData("text/plain", id); // For Firefox compatibility
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault(); // Allow drop
    };

    const handleDrop = (e: React.DragEvent, targetId: string) => {
        e.preventDefault();
        if (!draggedColId || draggedColId === targetId) return;

        setColumns(prev => {
            const visibleCols = prev.filter(c => c.visible).sort((a, b) => a.order - b.order);
            const fromIdx = visibleCols.findIndex(c => c.id === draggedColId);
            const toIdx = visibleCols.findIndex(c => c.id === targetId);
            
            if (fromIdx === -1 || toIdx === -1) return prev;
            
            const newVisible = [...visibleCols];
            const [moved] = newVisible.splice(fromIdx, 1);
            newVisible.splice(toIdx, 0, moved);
            
            // Re-assign orders
            const newOrderMap = new Map(newVisible.map((c, i) => [c.id, i + 1]));
            
            return prev.map(c => {
                if (newOrderMap.has(c.id)) {
                    return { ...c, order: newOrderMap.get(c.id)! };
                }
                return c;
            });
        });
        setDraggedColId(null);
    };

    const handleResetColumns = () => {
        if(confirm("Reset columns to default?")) {
            setColumns(DEFAULT_COLUMNS);
            localStorage.removeItem(COLUMN_SETTINGS_KEY);
        }
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

  // --- Task Management Handlers ---
  const handleAddTask = (content: string, priority: 'high' | 'medium' | 'low') => {
      const { ruleIndex } = taskModal;
      if (ruleIndex === -1) return;
      const newRules = [...rules];
      const tasks = newRules[ruleIndex].tasks || [];
      const newTask: Task = {
          id: Date.now().toString(),
          content,
          completed: false,
          createdAt: Date.now(),
          priority
      };
      newRules[ruleIndex] = { ...newRules[ruleIndex], tasks: [...tasks, newTask] };
      setRules(newRules);
      addLog(`Added task to ${newRules[ruleIndex].range}: ${content} [${priority}]`, newRules[ruleIndex].range);
  };

  const handleToggleTask = (taskId: string) => {
      const { ruleIndex } = taskModal;
      if (ruleIndex === -1) return;
      const newRules = [...rules];
      const tasks = newRules[ruleIndex].tasks || [];
      const taskIndex = tasks.findIndex(t => t.id === taskId);
      if (taskIndex > -1) {
          const updatedTasks = [...tasks];
          updatedTasks[taskIndex] = { ...updatedTasks[taskIndex], completed: !updatedTasks[taskIndex].completed };
          newRules[ruleIndex] = { ...newRules[ruleIndex], tasks: updatedTasks };
          setRules(newRules);
      }
  };

  const handleDeleteTask = (taskId: string) => {
      const { ruleIndex } = taskModal;
      if (ruleIndex === -1) return;
      const newRules = [...rules];
      const tasks = newRules[ruleIndex].tasks || [];
      newRules[ruleIndex] = { ...newRules[ruleIndex], tasks: tasks.filter(t => t.id !== taskId) };
      setRules(newRules);
  };

  const handleClearCompletedTasks = () => {
      const { ruleIndex } = taskModal;
      if (ruleIndex === -1) return;
      const newRules = [...rules];
      const tasks = newRules[ruleIndex].tasks || [];
      newRules[ruleIndex] = { 
          ...newRules[ruleIndex], 
          tasks: tasks.filter(t => !t.completed) 
      };
      setRules(newRules);
      addLog(`Cleared completed tasks for ${newRules[ruleIndex].range}`, newRules[ruleIndex].range);
  };

  const handleTransferStock = () => {
      const { sourceIndex, targetRange } = transferModal;
      if (sourceIndex === -1 || !targetRange) return;

      const targetIndex = rules.findIndex(r => r.range.toUpperCase() === targetRange.trim().toUpperCase());
      
      if (targetIndex === -1) {
          addNotification(t('locationExistsError', { locationCode: targetRange }), 'error');
          return;
      }

      if (targetIndex === sourceIndex) {
          addNotification("Target location cannot be the same as source.", 'error');
          return;
      }

      const sourceRule = rules[sourceIndex];
      const targetRule = rules[targetIndex];

      const newRules = [...rules];

      // Merge tags
      const sourceTags = sourceRule.destinations.split(/[，,]/).map(t => t.trim()).filter(Boolean);
      const targetTags = targetRule.destinations.split(/[，,]/).map(t => t.trim()).filter(Boolean);
      const uniqueTags = Array.from(new Set([...targetTags, ...sourceTags]));
      
      // Update Target
      newRules[targetIndex] = {
          ...targetRule,
          curPallet: (targetRule.curPallet || 0) + (sourceRule.curPallet || 0),
          curCartons: (targetRule.curCartons || 0) + (sourceRule.curCartons || 0),
          destinations: uniqueTags.join('，'),
          currentDest: uniqueTags.length
      };

      // Clear Source
      newRules[sourceIndex] = {
          ...sourceRule,
          curPallet: 0,
          curCartons: 0,
          destinations: '',
          currentDest: 0
      };

      setRules(newRules);
      addLog(`Transferred stock from ${sourceRule.range} to ${targetRule.range}`, sourceRule.range);
      addNotification(`Stock moved from ${sourceRule.range} to ${targetRule.range}`, 'success');
      setTransferModal({ isOpen: false, sourceIndex: -1, sourceRange: '', targetRange: '' });
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
                curCartons: null,
                tasks: []
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
            curCartons: null,
            tasks: []
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
          // Check for detailed assignments (splits) or fallback to simple location
          const splits = row.assignments || (row.location ? [{ location: row.location, pallets: row.pallets, cartons: row.cartons || 0 }] : []);
          
          splits.forEach(split => {
              if (split.location) {
                  // Handle multiple locations separated by comma (merged import)
                  const locations = split.location.split(/[,，]/).map(s => s.trim()).filter(Boolean);
                  const count = locations.length;
                  const palletsPerLoc = Math.ceil(split.pallets / count);
                  const cartonsPerLoc = split.cartons ? Math.ceil(split.cartons / count) : 0;

                  locations.forEach(locName => {
                      const rIdx = newRules.findIndex(r => r.range === locName);
                      if (rIdx >= 0) {
                          newRules[rIdx].curPallet = (newRules[rIdx].curPallet || 0) + palletsPerLoc;
                          if (cartonsPerLoc > 0) {
                              newRules[rIdx].curCartons = (newRules[rIdx].curCartons || 0) + cartonsPerLoc;
                          }

                          const tags = (newRules[rIdx].destinations || "").split(/[，,]/).map(t => t.trim()).filter(Boolean);
                          if (row.dest && !tags.includes(row.dest)) {
                              tags.push(row.dest);
                              newRules[rIdx].destinations = tags.join('，');
                              newRules[rIdx].currentDest = tags.length;
                          }
                          addLog(`Assigned ~${palletsPerLoc} pallets for ${row.dest} to ${locName}`, locName, row.containerNo);
                      }
                  });
              }
          });
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
            
            // Store plan for export (with updated assignments)
            const updatedPlan = { ...parsed, rows: assignedRows, sheetName, workbook: wb };
            setLastUnloadPlan(updatedPlan);

            // Calculate carton sum per destination for logging/verification
            const destSummary = assignedRows.reduce((acc, row) => {
                if (!acc[row.dest]) acc[row.dest] = 0;
                acc[row.dest] += (row.cartons || 0);
                return acc;
            }, {} as Record<string, number>);

            const summaryStr = Object.entries(destSummary)
                .map(([dest, count]) => `${dest}: ${count} ctns`)
                .join(', ');

            addLog(`Imported Unload Plan: ${parsed.rows.length} rows (aggregated). Carton Summary: ${summaryStr}`);
            addNotification(`${t('importSuccess')} ${assignedRows.filter(r => !!r.location).length} location groups assigned.`, 'success');

        } else {
            addNotification("Failed to parse unload sheet. Check header format.", 'error');
        }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
    setShowUnloadMenu(false);
  };
  
  const handleExportPlan = () => {
      if (!lastUnloadPlan || !lastUnloadPlan.worksheet) {
          addNotification("No active plan to export.", 'error');
          return;
      }
      try {
          // Generate updated worksheet with remark row
          const newWs = generateUnloadPlanSheet(lastUnloadPlan);
          
          // Use original workbook structure if possible
          const wb = lastUnloadPlan.workbook || XLSX.utils.book_new();
          
          // Update the sheet in the workbook
          wb.Sheets[lastUnloadPlan.sheetName || 'Sheet1'] = newWs;
          
          // Ensure sheet name is in list if new workbook
          if (!wb.SheetNames.includes(lastUnloadPlan.sheetName || 'Sheet1')) {
              XLSX.utils.book_append_sheet(wb, newWs, lastUnloadPlan.sheetName || 'Sheet1');
          }

          XLSX.writeFile(wb, `Plan_${lastUnloadPlan.containerNo || 'Unload'}.xlsx`);
          addNotification("Plan exported successfully", "success");
      } catch (e) {
          console.error(e);
          addNotification("Failed to export plan", "error");
      }
  };
  
  const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> => {
      return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
          reader.onerror = (e) => reject(e);
          reader.readAsArrayBuffer(file);
      });
  };

  const handleBatchUnloadImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      let currentRules = [...rules];
      let currentMap = { ...destContainerMap };
      let totalAssigned = 0;
      let fileCount = 0;
      
      // Process files sequentially to maintain state consistency
      for (let i = 0; i < files.length; i++) {
          const file = files[i];
          try {
              const buffer = await readFileAsArrayBuffer(file);
              const wb = XLSX.read(buffer, { type: 'array', cellStyles: true });
              const worksheet = wb.Sheets[wb.SheetNames[0]];
              const parsed = parseUnloadSheet(worksheet);

              if (parsed) {
                  // Check duplicate in currentMap
                  if (parsed.containerNo) {
                      const isDuplicate = Object.values(currentMap).some(destMap => 
                          Object.prototype.hasOwnProperty.call(destMap, parsed.containerNo)
                      );
                      
                      if (isDuplicate) {
                          addLog(`Skipped duplicate container in batch: ${parsed.containerNo}`);
                          continue; 
                      }
                  }
                  
                  // Assign locations using the current state simulation
                  const assigned = assignLocationsForUnload(parsed.rows, currentRules, false);
                  
                  // Update currentMap
                  assigned.forEach(row => {
                      if (row.dest && row.containerNo) {
                          if (!currentMap[row.dest]) currentMap[row.dest] = {};
                          const existing = currentMap[row.dest][row.containerNo];
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
                          currentMap[row.dest][row.containerNo] = {
                              pallets: currentPallets + row.pallets,
                              cartons: currentCartons + (row.cartons || 0)
                          };
                      }
                  });

                  // Update currentRules using detailed assignments
                  assigned.forEach(row => {
                      const splits = row.assignments || (row.location ? [{ location: row.location, pallets: row.pallets, cartons: row.cartons || 0 }] : []);
                      
                      splits.forEach(split => {
                          if (split.location) {
                              const locations = split.location.split(/[,，]/).map(s => s.trim()).filter(Boolean);
                              const count = locations.length;
                              const palletsPerLoc = Math.ceil(split.pallets / count);
                              const cartonsPerLoc = split.cartons ? Math.ceil(split.cartons / count) : 0;
                              
                              locations.forEach(locName => {
                                const rIdx = currentRules.findIndex(r => r.range === locName);
                                if (rIdx >= 0) {
                                    currentRules[rIdx] = { ...currentRules[rIdx] };
                                    currentRules[rIdx].curPallet = (currentRules[rIdx].curPallet || 0) + palletsPerLoc;
                                    if (cartonsPerLoc > 0) {
                                        currentRules[rIdx].curCartons = (currentRules[rIdx].curCartons || 0) + cartonsPerLoc;
                                    }
                                    const tags = (currentRules[rIdx].destinations || "").split(/[，,]/).map(t => t.trim()).filter(Boolean);
                                    if (row.dest && !tags.includes(row.dest)) {
                                        tags.push(row.dest);
                                        currentRules[rIdx].destinations = tags.join('，');
                                        currentRules[rIdx].currentDest = tags.length;
                                    }
                                }
                              });
                          }
                      });
                  });
                  
                  totalAssigned += assigned.filter(r => !!r.location).length;
                  fileCount++;
              }
          } catch (err) {
              console.error(`Error processing file ${file.name}`, err);
              addLog(`Error processing file ${file.name}`);
          }
      }
      
      setRules(currentRules);
      setDestContainerMap(currentMap);
      
      addLog(`Batch Import: Processed ${fileCount} files.`);
      addNotification(t('batchImportSuccess', { count: fileCount, locations: totalAssigned }), 'success');
      e.target.value = '';
      setShowUnloadMenu(false);
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
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const aoa = XLSX.utils.sheet_to_json(sheet, {header: 1}) as any[][];
        
        const rows = parseOutboundSheet(aoa);
        
        if(rows) {
            const newRules = [...rules];
            // Deep clone map to avoid direct mutation before set state
            const newDestMap = JSON.parse(JSON.stringify(destContainerMap)); 
            
            let deducted = 0;
            let skipped = 0;

            rows.forEach(row => {
                // 1. Validate mandatory fields
                if (!row.location || !row.dest || !row.pallets) {
                    skipped++;
                    return;
                }

                // 2. Find Location Rule
                // User requirement: 库位=库位Area
                const rule = newRules.find(r => r.range.toUpperCase() === row.location!.trim().toUpperCase());
                if (!rule) {
                    skipped++;
                    console.warn(`Skipped: Location ${row.location} not found`);
                    return;
                }

                // 3. Match Destination (Strict using normalization)
                const currentTags = (rule.destinations || "").split(/[，,]/).map(t => t.trim()).filter(Boolean);
                
                // Helper to normalize destination strings (e.g. handle Amazon- prefix)
                const normalizeDest = normalizeDestinationCode;

                // Check for match using normalized strings
                const matchedTag = currentTags.find(tag => normalizeDest(tag) === normalizeDest(row.dest!));
                
                if (!matchedTag) {
                    skipped++;
                    console.warn(`Skipped: Destination ${row.dest} not found in location ${row.location} tags [${rule.destinations}]`);
                    return;
                }

                // 4. Perform Deduction on Rule
                const qtyToDeduct = row.pallets;
                const cartonsToDeduct = row.cartons; 

                const currentPallets = rule.curPallet || 0;
                const currentCartons = rule.curCartons || 0;

                // Cannot deduct more than what's there
                const actualDeductPallets = Math.min(currentPallets, qtyToDeduct);
                
                // Calculate actual carton deduction
                let actualDeductCartons = 0;
                if (cartonsToDeduct !== undefined) {
                    actualDeductCartons = cartonsToDeduct; 
                    actualDeductCartons = Math.min(currentCartons, actualDeductCartons);
                } else {
                    // Proportional deduction if not provided in outbound
                    if (currentPallets > 0) {
                        actualDeductCartons = Math.ceil((actualDeductPallets / currentPallets) * currentCartons);
                    }
                }

                rule.curPallet = Math.max(0, currentPallets - actualDeductPallets);
                rule.curCartons = Math.max(0, currentCartons - actualDeductCartons);

                // Update deduction counter
                deducted += actualDeductPallets;

                // 4b. Tag Cleanup Logic
                // User: "当前托盘为0时删除对应的目的地标签" (When current pallet is 0 delete corresponding destination tag)
                if (rule.curPallet === 0) {
                    // Use matchedTag from the normalized search to filter it out
                    const newTags = currentTags.filter(t => t !== matchedTag);
                    
                    rule.destinations = newTags.join('，');
                    rule.currentDest = newTags.length;
                    
                    // If no tags left, ensure full clean (though curPallet is already 0)
                    if (newTags.length === 0) {
                        rule.destinations = "";
                        rule.currentDest = 0;
                        rule.curCartons = 0; // Ensure cartons 0 if empty
                    }
                }

                // 5. Update Container Map
                
                // Use normalized dest as lookup key
                const destMapKey = Object.keys(newDestMap).find(k => normalizeDest(k) === normalizeDest(row.dest!));
                
                if (destMapKey && newDestMap[destMapKey]) {
                    const containerMap = newDestMap[destMapKey];
                    
                    if (row.containerNo) {
                        const targetContainer = row.containerNo.trim();
                        // Find container key case-insensitive
                        const cKey = Object.keys(containerMap).find(k => k.toLowerCase() === targetContainer.toLowerCase());
                        
                        if (cKey && containerMap[cKey]) {
                            const stats = containerMap[cKey];
                            let cPallets = typeof stats === 'number' ? stats : stats.pallets;
                            let cCartons = typeof stats === 'number' ? 0 : stats.cartons;

                            // Deduct
                            cPallets = Math.max(0, cPallets - actualDeductPallets);
                            cCartons = Math.max(0, cCartons - actualDeductCartons);

                            if (cPallets === 0) {
                                delete containerMap[cKey];
                            } else {
                                if (typeof stats === 'number') containerMap[cKey] = cPallets;
                                else {
                                    stats.pallets = cPallets;
                                    stats.cartons = cCartons;
                                }
                            }
                        }
                    } else {
                        // FIFO deduction if no container specified in outbound
                        let remainingToDeduct = actualDeductPallets;
                        let remainingCartonsToDeduct = actualDeductCartons;

                        for (const cKey of Object.keys(containerMap)) {
                            if (remainingToDeduct <= 0 && remainingCartonsToDeduct <= 0) break;

                            const stats = containerMap[cKey];
                            let cPallets = typeof stats === 'number' ? stats : stats.pallets;
                            let cCartons = typeof stats === 'number' ? 0 : stats.cartons;

                            const pDrop = Math.min(cPallets, remainingToDeduct);
                            
                            // Distribute carton drop
                            let cDrop = 0;
                            if (cartonsToDeduct !== undefined) {
                                // If exact cartons known, we just drop until remainingCartonsToDeduct is 0
                                cDrop = Math.min(cCartons, remainingCartonsToDeduct);
                            } else {
                                // Proportional drop
                                if (cPallets > 0) cDrop = Math.ceil((pDrop / cPallets) * cCartons);
                            }
                            
                            cPallets -= pDrop;
                            cCartons -= cDrop;

                            remainingToDeduct -= pDrop;
                            remainingCartonsToDeduct -= cDrop;

                            if (cPallets <= 0) {
                                delete containerMap[cKey];
                            } else {
                                if (typeof stats === 'number') containerMap[cKey] = cPallets;
                                else {
                                    stats.pallets = cPallets;
                                    stats.cartons = cCartons;
                                }
                            }
                        }
                    }

                    // Clean up Dest Map if empty
                    if (Object.keys(containerMap).length === 0) {
                        delete newDestMap[destMapKey];
                    }
                }
            });

            setRules(newRules);
            setDestContainerMap(newDestMap);
            
            let msg = `${t('deductedPallets')} (${deducted}).`;
            if (skipped > 0) msg += ` Skipped ${skipped} rows (mismatch/invalid).`;
            
            addLog(`Outbound Import: Deducted ${deducted} pallets. Skipped ${skipped}.`);
            addNotification(msg, skipped > 0 ? 'info' : 'success');
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
                     if (item.dest !== undefined) {
                        newRules[idx].destinations = item.dest;
                        newRules[idx].currentDest = item.dest.split(/[，,]/).filter(Boolean).length;
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

  const handleInventoryExport = () => {
    const exportData = rules.map(r => ({
        'Location/库位': r.range,
        'Destination Tag/目的地标签': r.destinations,
        'Current Pallet/当前托盘': r.curPallet || 0
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    // Adjust column widths
    ws['!cols'] = [{ wch: 15 }, { wch: 30 }, { wch: 15 }];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");
    XLSX.writeFile(wb, `Inventory_${new Date().toISOString().slice(0,10)}.xlsx`);
    addLog("Exported Inventory Data");
    setShowInventoryMenu(false);
  };

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
      setDeleteTagModal({
          isOpen: true,
          ruleIndex,
          tag
      });
  }

  const handleConfirmDeleteTag = (data: { deduct: boolean; pallets: number; cartons: number; containerNo?: string }) => {
      const { ruleIndex, tag } = deleteTagModal;
      if (ruleIndex === -1 || !tag) return;

      const rule = rules[ruleIndex];
      const newRules = [...rules];
      const tags = (rule.destinations || "").split(/[，,]/).map(t=>t.trim()).filter(Boolean);
      const newTags = tags.filter(t => t !== tag);
      
      let updatedRule = {
          ...rule,
          destinations: newTags.join('，'),
          currentDest: newTags.length
      };

      if (data.deduct) {
          updatedRule.curPallet = Math.max(0, (rule.curPallet || 0) - data.pallets);
          updatedRule.curCartons = Math.max(0, (rule.curCartons || 0) - data.cartons);
      }

      newRules[ruleIndex] = updatedRule;
      setRules(newRules);

      // Handle Container Map update if requested
      if (data.deduct && data.containerNo && destContainerMap[tag] && destContainerMap[tag][data.containerNo]) {
          const newDestMap = JSON.parse(JSON.stringify(destContainerMap));
          const containerStats = newDestMap[tag][data.containerNo];
          
          if (containerStats) {
              let cPallets = typeof containerStats === 'number' ? containerStats : containerStats.pallets;
              let cCartons = typeof containerStats === 'number' ? 0 : containerStats.cartons;
              
              cPallets = Math.max(0, cPallets - data.pallets);
              cCartons = Math.max(0, cCartons - data.cartons);
              
              if (typeof containerStats === 'number') {
                  newDestMap[tag][data.containerNo] = cPallets;
              } else {
                  newDestMap[tag][data.containerNo] = { pallets: cPallets, cartons: cCartons };
              }
              
              setDestContainerMap(newDestMap);
              addLog(`Removed tag "${tag}" from ${rule.range} and deducted ${data.pallets} pallets from container ${data.containerNo}.`, rule.range);
          }
      } else {
          addLog(`Removed tag "${tag}" from ${rule.range}. ${data.deduct ? `Deducted ${data.pallets} pallets.` : ''}`, rule.range);
      }
  };

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

  const allDestinations = useMemo(() => {
      const set = new Set(DESTINATION_OPTIONS);
      rules.forEach(r => {
          if (r.destinations) {
              r.destinations.split(/[，,]/).forEach(d => {
                  const trim = d.trim();
                  if (trim) set.add(trim);
              });
          }
      });
      return Array.from(set).sort();
  }, [rules]);

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
            options={allDestinations}
        />
        
        {/* Delete Tag Modal */}
        {deleteTagModal.isOpen && deleteTagModal.ruleIndex !== -1 && (
            <DeleteTagModal
                isOpen={deleteTagModal.isOpen}
                onClose={() => setDeleteTagModal({ isOpen: false, ruleIndex: -1, tag: '' })}
                tag={deleteTagModal.tag}
                rule={rules[deleteTagModal.ruleIndex]}
                destContainerMap={destContainerMap}
                onConfirm={handleConfirmDeleteTag}
            />
        )}
        
        {/* Transfer Modal */}
        {transferModal.isOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={() => setTransferModal(prev => ({ ...prev, isOpen: false }))}>
                <div className="bg-white rounded-xl shadow-2xl p-6 w-[400px]" onClick={e => e.stopPropagation()}>
                    <h3 className="text-lg font-bold text-slate-800 mb-4">库位调整 (Move/Transfer)</h3>
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Source (源库位)</label>
                        <div className="p-2 bg-slate-100 rounded text-slate-600 font-mono">{transferModal.sourceRange}</div>
                    </div>
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Target (目标库位)</label>
                        <input 
                            value={transferModal.targetRange}
                            onChange={e => setTransferModal(prev => ({ ...prev, targetRange: e.target.value }))}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 uppercase"
                            placeholder="A01"
                            autoFocus
                        />
                    </div>
                    <div className="flex justify-end gap-2">
                        <button onClick={() => setTransferModal(prev => ({ ...prev, isOpen: false }))} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">{t('cancel')}</button>
                        <button onClick={handleTransferStock} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg">{t('done')}</button>
                    </div>
                </div>
            </div>
        )}

        {/* Task Management Modal */}
        {taskModal.isOpen && taskModal.ruleIndex !== -1 && (
            <TaskModal
                isOpen={taskModal.isOpen}
                onClose={() => setTaskModal({ isOpen: false, ruleIndex: -1 })}
                rule={rules[taskModal.ruleIndex]}
                onAddTask={handleAddTask}
                onToggleTask={handleToggleTask}
                onDeleteTask={handleDeleteTask}
                onClearCompleted={handleClearCompletedTasks}
            />
        )}

        {/* Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col xl:flex-row gap-4 justify-between items-start xl:items-center z-30 relative flex-none">
            <div className="flex gap-2 w-full xl:w-auto">
                <button 
                    onClick={onOpenAssistant}
                    className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg hover:from-violet-700 hover:to-indigo-700 shadow-md transition-all font-medium text-sm mr-2"
                >
                    <Sparkles size={16} />
                    {t('assistantTitle')}
                </button>
                <div className="relative flex-1 xl:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder={t('searchPlaceholder')} className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500" value={keyword} onChange={e => setKeyword(e.target.value)} />
                </div>
                <button onClick={() => setIsScannerOpen(true)} className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600" title="Scan Barcode/QR Code"><ScanLine size={20} /></button>
                <button onClick={() => setShowColSettings(!showColSettings)} className={`p-2 border rounded-lg transition-colors ${showColSettings ? 'bg-blue-50 border-blue-300 text-blue-600' : 'border-slate-300 hover:bg-slate-50 text-slate-600'}`} title="Column Settings"><Settings size={20} /></button>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
                <button onClick={() => setShowManualUnload(true)} className="flex items-center gap-2 px-3 py-2 bg-fuchsia-50 text-fuchsia-700 rounded-lg hover:bg-fuchsia-100 border border-fuchsia-200 text-sm font-medium transition-colors"><Hand size={16} /> {t('manualUnload')}</button>
                <button onClick={exportXLSX} className="flex items-center gap-2 px-3 py-2 bg-emerald-50 text-emerald-700 rounded-lg hover:bg-emerald-100 border border-emerald-200 text-sm font-medium transition-colors"><Download size={16} /> {t('rules')}</button>
                
                {/* Inventory Button with Dropdown */}
                <div className="relative" ref={inventoryMenuRef}>
                    <button 
                        onClick={() => setShowInventoryMenu(!showInventoryMenu)} 
                        className={`flex items-center gap-2 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 border border-purple-200 text-sm font-medium transition-colors ${showInventoryMenu ? 'ring-2 ring-purple-300' : ''}`}
                    >
                        <FileText size={16} /> {t('inventory')} <ChevronDown size={14} className={`transition-transform ${showInventoryMenu ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {showInventoryMenu && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in-up">
                            <label className="flex items-center gap-3 px-4 py-3 hover:bg-purple-50 hover:text-purple-700 cursor-pointer text-slate-600 text-sm border-b border-slate-100 transition-colors">
                                <Upload size={16} />
                                <span>{t('importInventory')}</span>
                                <input type="file" className="hidden" accept=".xlsx,.xls" onChange={(e) => { handleInventoryImport(e); setShowInventoryMenu(false); }} />
                            </label>
                            <button
                                onClick={handleInventoryExport}
                                className="flex items-center gap-3 px-4 py-3 hover:bg-purple-50 hover:text-purple-700 cursor-pointer text-slate-600 text-sm w-full text-left transition-colors"
                            >
                                <Download size={16} />
                                <span>{t('downloadData')}</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Unload Button with Dropdown */}
                <div className="relative" ref={unloadMenuRef}>
                     <button 
                        onClick={() => setShowUnloadMenu(!showUnloadMenu)} 
                        className={`flex items-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 border border-blue-200 text-sm font-medium transition-colors ${showUnloadMenu ? 'ring-2 ring-blue-300' : ''}`}
                    >
                        <Upload size={16} /> {t('unload')} <ChevronDown size={14} className={`transition-transform ${showUnloadMenu ? 'rotate-180' : ''}`} />
                    </button>

                    {showUnloadMenu && (
                        <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden animate-fade-in-up">
                            <label className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 hover:text-blue-700 cursor-pointer text-slate-600 text-sm border-b border-slate-100 transition-colors">
                                <FileText size={16} />
                                <span>{t('uploadFile')}</span>
                                <input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleUnloadImport} />
                            </label>
                            <label className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 hover:text-blue-700 cursor-pointer text-slate-600 text-sm border-b border-slate-100 transition-colors">
                                <Files size={16} />
                                <span>{t('batchUpload')}</span>
                                <input type="file" className="hidden" accept=".xlsx,.xls" multiple onChange={handleBatchUnloadImport} />
                            </label>
                            {lastUnloadPlan && (
                                <button
                                    onClick={handleExportPlan}
                                    className="flex items-center gap-3 px-4 py-3 hover:bg-blue-50 hover:text-blue-700 cursor-pointer text-slate-600 text-sm w-full text-left transition-colors border-b border-slate-100"
                                    title={t('exportPlanTooltip')}
                                >
                                    <Download size={16} />
                                    <span>{t('exportPlan')}</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <label className="flex items-center gap-2 px-3 py-2 bg-orange-50 text-orange-700 rounded-lg hover:bg-orange-100 border border-orange-200 text-sm font-medium cursor-pointer transition-colors"><Upload size={16} /> {t('outbound')}<input type="file" className="hidden" accept=".xlsx,.xls" onChange={handleOutboundImport} /></label>
            </div>
        </div>

        {/* ... Rest of the component (Manual Unload Modal, History Modal, Settings, Table) ... */}
        {showManualUnload && (
             <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
                <div className="bg-white rounded-xl shadow-2xl p-6 w-[800px] max-w-full">
                    <h3 className="text-lg font-bold text-slate-800 mb-4">{t('manualUnloadTitle')}</h3>
                    <div className="space-y-2">
                        <input value={manualContainerNo} onChange={e => setManualContainerNo(e.target.value)} placeholder={t('containerNo')} className="w-full px-3 py-2 border rounded-lg" />
                        <div className="max-h-64 overflow-y-auto space-y-2 p-1">
                        {manualRows.map((row, i) => (
                            <div key={i} className="flex gap-2 items-center">
                                <input 
                                    value={row.dest} 
                                    onChange={e => { 
                                        const newRows = [...manualRows]; 
                                        newRows[i].dest = e.target.value; 
                                        setManualRows(newRows); 
                                    }} 
                                    placeholder={t('colDest')} 
                                    className="flex-1 px-3 py-2 border rounded-lg" 
                                />
                                <input 
                                    type="number" 
                                    value={row.pallets} 
                                    onChange={e => { 
                                        const newRows = [...manualRows]; 
                                        newRows[i].pallets = Number(e.target.value); 
                                        setManualRows(newRows); 
                                    }} 
                                    placeholder={t('colCur')} 
                                    className="w-20 px-3 py-2 border rounded-lg" 
                                    title="Pallets" 
                                />
                                
                                {/* Recommended Location Display */}
                                <div className="w-32 px-2 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs flex items-center gap-1 text-blue-700 font-mono">
                                    <MapPin size={12} className="flex-shrink-0" />
                                    <span className="truncate" title={manualRecommendations[i] || 'Calculating...'}>
                                        {manualRecommendations[i] ? (manualRecommendations[i].length > 15 ? manualRecommendations[i].substring(0,15)+'...' : manualRecommendations[i]) : '...'}
                                    </span>
                                </div>

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
                                            <div className="mb-1">{log.text}</div>
                                            {log.containerNo && (
                                                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-200 text-slate-600 text-xs font-mono">
                                                    <Container size={10} />
                                                    {log.containerNo}
                                                </div>
                                            )}
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
          <div ref={colSettingsRef} className="absolute top-20 right-4 w-64 bg-slate-50 p-4 rounded-xl border border-slate-200 text-sm z-30 shadow-2xl animate-fade-in-up">
            <div className="flex justify-between items-center mb-3">
                <h4 className="font-bold text-slate-700">{t('columnSettings')}</h4>
                <button onClick={() => setShowColSettings(false)} className="p-1 rounded-full hover:bg-slate-200"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-1 gap-4 max-h-[60vh] overflow-y-auto">
                <div>
                    <h5 className="font-semibold text-slate-600 mb-2 border-b pb-1">Visible Columns</h5>
                    <ul className="space-y-1 min-h-[50px]">
                        {columns.filter(c => c.visible).sort((a,b) => a.order - b.order).map((col) => (
                            <li 
                                key={col.id} 
                                draggable
                                onDragStart={(e) => handleDragStart(e, col.id as string)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, col.id as string)}
                                className={`flex items-center justify-between p-2 rounded bg-white border cursor-grab active:cursor-grabbing ${draggedColId === col.id ? 'opacity-50 border-blue-400 bg-blue-50' : 'hover:bg-slate-100'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <GripVertical size={14} className="text-slate-400" />
                                    <span className="font-medium">{col.label}</span>
                                </div>
                                <div className="flex items-center gap-1 text-slate-500">
                                    <button onClick={() => handleColumnVisibilityToggle(col.id as string, false)} className="p-1 text-red-500 hover:text-red-700" title="Hide column"><Trash2 size={16} /></button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
                <div>
                    <h5 className="font-semibold text-slate-600 mb-2 border-b pb-1">Hidden Columns</h5>
                    <div className="flex flex-wrap gap-2">
                        {columns.filter(c => !c.visible).map(col => (
                             <button key={col.id} onClick={() => handleColumnVisibilityToggle(col.id as string, true)} className="px-2 py-1 bg-white border border-dashed border-slate-300 rounded hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 text-slate-500 flex items-center gap-1">
                                 <Plus size={14} /> {col.label}
                             </button>
                        ))}
                    </div>
                </div>
                
                <div className="pt-2 border-t mt-2">
                    <button 
                        onClick={handleResetColumns} 
                        className="w-full flex items-center justify-center gap-2 py-1.5 text-xs text-slate-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                    >
                        <RotateCcw size={14} /> Reset Defaults
                    </button>
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
                              <button onClick={() => handleSort(col.id)} className="flex items-center gap-1 hover:text-slate-800 font-semibold focus:outline-none w-full">
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
                         
                         // Check for recent update
                         const isRecentlyUpdated = recentlyUpdated.includes(rule.range);
                         const pendingTaskCount = (rule.tasks || []).filter(t => !t.completed).length;
                         const hasHighPriorityTask = (rule.tasks || []).some(t => !t.completed && t.priority === 'high');
                         
                         return (
                             <tr key={rule.range} className={`hover:bg-slate-50 transition-colors duration-500 ${isOverflow ? 'bg-red-50/50' : ''} ${isRecentlyUpdated ? 'animate-update-row' : ''}`}>
                                 {sortedColumns.map(col => (
                                     <td 
                                        key={col.id} 
                                        className="px-4 py-2 align-middle border-r border-transparent last:border-0"
                                        onDoubleClick={() => col.id === 'destinations' && canEdit('destinations') && openDestSelector(realIndex, rule)}
                                     >
                                         {col.id === 'range' && (
                                            <div className="flex items-center gap-2">
                                                <span className="font-mono font-bold text-slate-700">{rule.range}</span>
                                                {hasHighPriorityTask && (
                                                    <div className="text-red-500 animate-pulse" title="High Priority Task Pending">
                                                        <AlertTriangle size={14} />
                                                    </div>
                                                )}
                                                <button onClick={() => setHistoryModalLocation(rule.range)} className="text-slate-300 hover:text-blue-500"><History size={14} /></button>
                                            </div>
                                         )}
                                         {col.id === 'destinations' && (
                                            <div className="flex flex-wrap gap-1 max-w-xs cursor-pointer min-h-[24px]">
                                                {(rule.destinations || "").split(/[，,]/).map(t => t.trim()).filter(Boolean).map((tag, i) => (
                                                    <span 
                                                        key={i} 
                                                        className={`px-2 py-0.5 rounded-full text-xs border font-medium flex items-center gap-1 ${getDestTagClass(tag)}`}
                                                        title={getDestTooltip(tag)}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        {tag}
                                                        {canEdit('destinations') && (
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); handleDeleteTag(realIndex, tag); }}
                                                                className="hover:bg-black/10 rounded-full p-0.5 transition-colors"
                                                            >
                                                                <X size={10} />
                                                            </button>
                                                        )}
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
                                                className="w-16 px-2 py-1 text-right border rounded border-slate-200 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
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
                                         {col.id === 'actions' && (
                                            <div className="flex gap-1">
                                                <button 
                                                    onClick={() => setHistoryModalLocation(rule.range)}
                                                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                    title={t('history')}
                                                >
                                                    <History size={16} />
                                                </button>
                                                {canEdit('destinations') && (
                                                    <button 
                                                        onClick={() => setTransferModal({ isOpen: true, sourceIndex: realIndex, sourceRange: rule.range, targetRange: '' })}
                                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                        title="库位调整 (Move/Transfer)"
                                                    >
                                                        <ArrowRight size={16} />
                                                    </button>
                                                )}
                                                {canEdit('tasks') && (
                                                    <button 
                                                        onClick={() => setTaskModal({ isOpen: true, ruleIndex: realIndex })}
                                                        className={`p-1.5 rounded transition-colors relative ${pendingTaskCount > 0 ? 'text-blue-600 bg-blue-50' : 'text-slate-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                                        title={t('manageTasks')}
                                                    >
                                                        <ClipboardList size={16} />
                                                        {pendingTaskCount > 0 && (
                                                            <span className="absolute -top-1 -right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] text-white font-bold ring-1 ring-white">
                                                                {pendingTaskCount}
                                                            </span>
                                                        )}
                                                    </button>
                                                )}
                                                {isAdmin && (
                                                    <button onClick={() => handleDeleteRule(realIndex)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
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
        <style>{`
            @keyframes row-highlight {
                0% { background-color: rgba(250, 204, 21, 0.2); } /* yellow-400 at 20% */
                50% { background-color: rgba(250, 204, 21, 0.4); } /* yellow-400 at 40% */
                100% { background-color: transparent; }
            }
            .animate-update-row {
                animation: row-highlight 1.5s ease-out forwards;
            }
        `}</style>
    </div>
  );
};

export default Rules;
