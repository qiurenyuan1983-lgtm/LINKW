
import React, { useState, useMemo, useEffect } from 'react';
import { LocationRule, UserRole, MoveSuggestion } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { ArrowRight, Move, Search, History, CheckCircle, ChevronDown, Zap, LayoutList, ArrowLeftRight, AlertCircle, Filter } from 'lucide-react';
import { useNotifications } from '../components/Notifications';

interface Props {
  rules: LocationRule[];
  setRules: (rules: LocationRule[]) => void;
  addLog: (text: string, location?: string, containerNo?: string) => void;
  userRole: UserRole;
}

const StockAdjustment: React.FC<Props> = ({ rules, setRules, addLog }) => {
  const { t } = useLanguage();
  const { addNotification } = useNotifications();

  // Tab State
  const [activeTab, setActiveTab] = useState<'manual' | 'suggestions'>('manual');

  // Manual Move State
  const [sourceSearch, setSourceSearch] = useState('');
  const [targetSearch, setTargetSearch] = useState('');
  const [movePallets, setMovePallets] = useState<number | ''>('');
  const [moveCartons, setMoveCartons] = useState<number | ''>('');
  const [manualReason, setManualReason] = useState('Blocking');
  const [customReason, setCustomReason] = useState('');
  
  const [showSourceDropdown, setShowSourceDropdown] = useState(false);
  const [showTargetDropdown, setShowTargetDropdown] = useState(false);
  
  // Suggestions State
  const [suggestions, setSuggestions] = useState<MoveSuggestion[]>([]);
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  
  // History
  const [history, setHistory] = useState<{time: string, source: string, target: string, pallets: number, reason: string}[]>([]);

  // Helpers to find rules
  const sourceRule = useMemo(() => rules.find(r => r.range === sourceSearch), [rules, sourceSearch]);
  const targetRule = useMemo(() => rules.find(r => r.range === targetSearch), [rules, targetSearch]);

  const maxPallets = sourceRule?.curPallet || 0;
  const maxCartons = sourceRule?.curCartons || 0;

  // Filtered Options
  const sourceOptions = useMemo(() => {
      const term = sourceSearch.toUpperCase();
      return rules
        .filter(r => r.range.includes(term))
        .sort((a,b) => {
            // Exact match first
            if (a.range === term) return -1;
            if (b.range === term) return 1;
            // Starts with
            const aStarts = a.range.startsWith(term);
            const bStarts = b.range.startsWith(term);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.range.localeCompare(b.range, undefined, {numeric: true});
        })
        .slice(0, 50);
  }, [rules, sourceSearch]);

  const targetOptions = useMemo(() => {
      const term = targetSearch.toUpperCase();
      return rules
        .filter(r => r.range.includes(term))
        .sort((a,b) => {
            if (a.range === term) return -1;
            if (b.range === term) return 1;
            const aStarts = a.range.startsWith(term);
            const bStarts = b.range.startsWith(term);
            if (aStarts && !bStarts) return -1;
            if (!aStarts && bStarts) return 1;
            return a.range.localeCompare(b.range, undefined, {numeric: true});
        })
        .slice(0, 50);
  }, [rules, targetSearch]);

  useEffect(() => {
     // Auto-fill max if source selected
     if (sourceRule) {
         setMovePallets(sourceRule.curPallet || 0);
         setMoveCartons(sourceRule.curCartons || 0);
     } else {
         setMovePallets('');
         setMoveCartons('');
     }
  }, [sourceRule]);

  const handleExecute = () => {
      if (!sourceRule || !targetRule) {
          addNotification(t('invalidMove'), 'error');
          return;
      }
      
      const pQty = Number(movePallets) || 0;
      const cQty = Number(moveCartons) || 0;
      
      if (pQty <= 0) {
          addNotification(t('quantityError'), 'error');
          return;
      }
      
      if (pQty > (sourceRule.curPallet || 0)) {
           addNotification(t('sourceEmpty'), 'error');
           return;
      }
      
      if (sourceRule.range === targetRule.range) {
          addNotification(t('sameLocationError'), 'error');
          return;
      }

      // Execute Move
      const newRules = rules.map(r => {
          if (r.range === sourceRule.range) {
              return {
                  ...r,
                  curPallet: (r.curPallet || 0) - pQty,
                  curCartons: Math.max(0, (r.curCartons || 0) - cQty),
                  destinations: ((r.curPallet || 0) - pQty) === 0 ? '' : r.destinations,
                  currentDest: ((r.curPallet || 0) - pQty) === 0 ? 0 : r.currentDest
              };
          }
          if (r.range === targetRule.range) {
              const srcTags = (sourceRule.destinations || '').split(/[,，]/).filter(Boolean);
              const tgtTags = (r.destinations || '').split(/[,，]/).filter(Boolean);
              const newTags = Array.from(new Set([...tgtTags, ...srcTags])).join('，');
              
              return {
                  ...r,
                  curPallet: (r.curPallet || 0) + pQty,
                  curCartons: (r.curCartons || 0) + cQty,
                  destinations: newTags,
                  currentDest: newTags.split(/[,，]/).filter(Boolean).length
              };
          }
          return r;
      });

      setRules(newRules);
      
      const reasonKey = `reason${manualReason}`;
      const reason = manualReason === 'Other' ? customReason : (t(reasonKey) !== reasonKey ? t(reasonKey) : manualReason);
      
      const logText = `Moved ${pQty} plts (${cQty} ctns) from ${sourceRule.range} to ${targetRule.range}. Reason: ${reason}`;
      addLog(logText, sourceRule.range);
      
      setHistory(prev => [{
          time: new Date().toLocaleTimeString(),
          source: sourceRule.range,
          target: targetRule.range,
          pallets: pQty,
          reason
      }, ...prev]);

      addNotification(t('executionSuccess'), 'success');
      
      // Reset
      setSourceSearch('');
      setTargetSearch('');
      setMovePallets('');
      setMoveCartons('');
      setCustomReason('');
      setManualReason('Blocking');
  };

  const generateSuggestions = () => {
      const generated: MoveSuggestion[] = [];
      
      // 1. Identify Candidates (Sources)
      const sources = rules.filter(r => {
          if (!r.curPallet || r.curPallet <= 0) return false;
          
          const util = r.curPallet / (r.maxPallet || 1);
          
          // Condition A: Fragmentation (Low utilization)
          if (util < 0.30) return true;
          
          // Condition B: Overflow/Rules Violation (Too many destinations)
          if (r.allowedDest && r.currentDest && r.currentDest > r.allowedDest) return true;
          
          // Condition C: Express zone cleanup
          if (r.type === 'express') return true;

          return false;
      });

      sources.forEach(source => {
          const sourceTags = (source.destinations || '').split(/[,，]/).map(t => t.trim()).filter(Boolean);
          if (sourceTags.length === 0) return; 

          const quantityToMove = source.curPallet || 0;

          // 2. Find Targets
          const candidates = rules.filter(target => {
              if (target.range === source.range) return false;
              
              // Rule: Express locations cannot be auto-suggestion targets
              if (target.type === 'express') return false; 

              // Space Check
              const space = (target.maxPallet || 0) - (target.curPallet || 0);
              if (space < quantityToMove) return false;

              const targetTags = (target.destinations || '').split(/[,，]/).map(t => t.trim()).filter(Boolean);
              
              // Check 1: Does target ALREADY have one of the source tags?
              const sharedTags = sourceTags.filter(st => targetTags.includes(st));
              
              if (sharedTags.length > 0) {
                  // Excellent match (Consolidation) - Tag already exists, so rule count won't increase
                  return true;
              }
              
              // Check 2: If no shared tag, can we add a new tag to target?
              // Only if target is empty OR (target has space AND allowedDest is not exceeded)
              if (targetTags.length === 0) return true; 
              
              if (target.allowedDest && target.currentDest && target.currentDest < target.allowedDest) {
                  // Has room for more unique destinations
                  return true;
              }

              return false;
          });

          // Score Candidates
          const scoredCandidates = candidates.map(target => {
              let score = 0;
              const targetTags = (target.destinations || '').split(/[,，]/).map(t => t.trim()).filter(Boolean);
              const sharedTags = sourceTags.filter(st => targetTags.includes(st));
              
              // Factor: Existing Tag Match (Consolidation is best)
              if (sharedTags.length > 0) score += 20;
              
              // Factor: Type Match
              if (source.type === target.type) score += 5;
              
              // Factor: Utilization (Fill up targets to >80% is good)
              const newTargetUtil = ((target.curPallet || 0) + quantityToMove) / (target.maxPallet || 1);
              if (newTargetUtil > 0.8 && newTargetUtil <= 1.0) score += 5;
              
              return { target, score, sharedTags };
          });

          scoredCandidates.sort((a, b) => b.score - a.score);

          if (scoredCandidates.length > 0) {
              const best = scoredCandidates[0];
              
              let reason = 'Consolidate';
              let priority: 'high' | 'medium' | 'low' = 'medium';
              
              const isClearingSource = quantityToMove === (source.curPallet || 0);
              const isConsolidation = best.sharedTags.length > 0;

              // Priority Logic
              if (source.allowedDest && source.currentDest && source.currentDest > source.allowedDest) {
                  reason = 'Fix Dest Overflow';
                  priority = 'high';
              } else if (source.type === 'express') {
                  reason = 'Clear Express Zone';
                  priority = 'high';
              } else if (isConsolidation) {
                  reason = 'Merge Destinations';
                  // If we are clearing the source by merging, that's high value optimization
                  priority = isClearingSource ? 'high' : 'medium';
              } else if (best.target.curPallet === 0) {
                  reason = 'Move to Empty';
                  priority = 'low';
              } else {
                  reason = 'Optimize Space';
                  priority = 'low';
              }

              generated.push({
                  id: Math.random().toString(36).substr(2, 9),
                  source: source.range,
                  target: best.target.range,
                  dest: best.sharedTags[0] || sourceTags[0] || 'Unknown',
                  quantity: quantityToMove,
                  reason: reason,
                  priority: priority
              });
          }
      });

      // Sort all suggestions by priority (High > Medium > Low)
      generated.sort((a, b) => {
          const pOrder = { 'high': 3, 'medium': 2, 'low': 1 };
          return pOrder[b.priority] - pOrder[a.priority];
      });

      setSuggestions(generated);
      setPriorityFilter('all'); // Reset filter when regenerating
      if (generated.length > 0) {
          addNotification(t('movesGenerated', { count: generated.length }), 'success');
      } else {
          addNotification(t('noMovesFound'), 'info');
      }
  };

  const executeSuggestion = (s: MoveSuggestion) => {
      const sourceIdx = rules.findIndex(r => r.range === s.source);
      const targetIdx = rules.findIndex(r => r.range === s.target);
      
      if (sourceIdx === -1 || targetIdx === -1) {
          addNotification(t('outdatedSuggestions'), 'error');
          setSuggestions(prev => prev.filter(x => x.id !== s.id));
          return;
      }

      const source = rules[sourceIdx];
      const target = rules[targetIdx];

      // Validate again
      if ((source.curPallet || 0) < s.quantity) {
           addNotification(t('sourceChanged'), 'error');
           return;
      }

      const newRules = [...rules];
      
      // Update Source
      newRules[sourceIdx] = {
          ...source,
          curPallet: (source.curPallet || 0) - s.quantity,
          curCartons: 0, // Assumption: Moving all cleans cartons too
          destinations: '',
          currentDest: 0
      };

      // Update Target
      const srcTags = (source.destinations || '').split(/[,，]/).filter(Boolean);
      const tgtTags = (target.destinations || '').split(/[,，]/).filter(Boolean);
      const newTags = Array.from(new Set([...tgtTags, ...srcTags])).join('，');

      newRules[targetIdx] = {
          ...target,
          curPallet: (target.curPallet || 0) + s.quantity,
          // Estimate cartons if needed, or leave as is if we don't track cartons in suggestions yet
          curCartons: (target.curCartons || 0) + (source.curCartons || 0),
          destinations: newTags,
          currentDest: newTags.split(/[,，]/).filter(Boolean).length
      };

      setRules(newRules);
      addLog(`Auto-Move: ${s.quantity} plts from ${s.source} to ${s.target}. Reason: ${s.reason}`, s.source);
      setSuggestions(prev => prev.filter(x => x.id !== s.id));
      addNotification(t('suggestionExecuted'), 'success');
      
      // Add to history
      setHistory(prev => [{
          time: new Date().toLocaleTimeString(),
          source: s.source,
          target: s.target,
          pallets: s.quantity,
          reason: s.reason
      }, ...prev]);
  };

  const filteredSuggestions = useMemo(() => {
      if (priorityFilter === 'all') return suggestions;
      return suggestions.filter(s => s.priority === priorityFilter);
  }, [suggestions, priorityFilter]);

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">{t('stockAdjustment')}</h1>
                <p className="text-slate-500">{t('stockAdjustmentDesc')}</p>
            </div>
            
            <div className="flex bg-slate-100 p-1 rounded-lg">
                <button
                    onClick={() => setActiveTab('manual')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <ArrowLeftRight size={16} />
                    {t('manualExecution')}
                </button>
                <button
                    onClick={() => setActiveTab('suggestions')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'suggestions' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                    <Zap size={16} />
                    {t('smartSuggestion')}
                </button>
            </div>
       </div>

       <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {activeTab === 'manual' ? (
                /* Manual Move Card */
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm overflow-visible relative z-10 animate-fade-in-up">
                    <h2 className="text-lg font-bold text-slate-700 mb-6 flex items-center gap-2">
                        <Move className="text-blue-600" /> {t('manualExecution')}
                    </h2>

                    <div className="flex flex-col md:flex-row gap-8 items-start">
                        {/* Source */}
                        <div className="flex-1 w-full space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">{t('selectSource')}</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input 
                                        value={sourceSearch}
                                        onChange={e => {
                                            setSourceSearch(e.target.value.toUpperCase());
                                            setShowSourceDropdown(true);
                                        }}
                                        onFocus={() => setShowSourceDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowSourceDropdown(false), 200)}
                                        placeholder="e.g. A01"
                                        className={`w-full pl-9 pr-3 py-2 border rounded-lg text-lg font-mono font-bold uppercase focus:ring-2 outline-none ${sourceRule ? 'border-green-300 bg-green-50 text-green-700' : 'border-slate-300'}`}
                                    />
                                    {showSourceDropdown && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                                            {sourceOptions.length > 0 ? sourceOptions.map(r => (
                                                <div 
                                                    key={r.range}
                                                    className="px-3 py-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center group"
                                                    onMouseDown={() => {
                                                        setSourceSearch(r.range);
                                                        setShowSourceDropdown(false);
                                                    }}
                                                >
                                                    <span className="font-mono font-bold text-slate-700">{r.range}</span>
                                                    <div className="text-right text-xs">
                                                        <div className="text-slate-600">{r.curPallet || 0} {t('unitPlts')}</div>
                                                        <div className="text-slate-400 truncate max-w-[120px]">{r.destinations}</div>
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="px-3 py-2 text-slate-400 text-sm text-center">{t('noMatches')}</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {sourceRule && (
                                    <div className="mt-2 p-3 bg-slate-50 rounded-lg text-sm border border-slate-100">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-slate-500">{t('available')}:</span>
                                            <span className="font-bold">{sourceRule.curPallet} <span className="text-xs font-normal">{t('unitPlts')}</span></span>
                                        </div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-slate-500">{t('colCartons')}:</span>
                                            <span className="font-bold">{sourceRule.curCartons}</span>
                                        </div>
                                        <div className="text-xs text-slate-400 mt-2 truncate">{sourceRule.destinations}</div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center justify-center self-center pt-6">
                            <ArrowRight size={32} className="text-slate-300 md:rotate-0 rotate-90" />
                        </div>

                        {/* Target */}
                        <div className="flex-1 w-full space-y-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">{t('selectTarget')}</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                                    <input 
                                        value={targetSearch}
                                        onChange={e => {
                                            setTargetSearch(e.target.value.toUpperCase());
                                            setShowTargetDropdown(true);
                                        }}
                                        onFocus={() => setShowTargetDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowTargetDropdown(false), 200)}
                                        placeholder="e.g. B05"
                                        className={`w-full pl-9 pr-3 py-2 border rounded-lg text-lg font-mono font-bold uppercase focus:ring-2 outline-none ${targetRule ? 'border-blue-300 bg-blue-50 text-blue-700' : 'border-slate-300'}`}
                                    />
                                    {showTargetDropdown && (
                                        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-xl max-h-60 overflow-y-auto z-50">
                                            {targetOptions.length > 0 ? targetOptions.map(r => (
                                                <div 
                                                    key={r.range}
                                                    className="px-3 py-2 hover:bg-slate-50 cursor-pointer flex justify-between items-center group"
                                                    onMouseDown={() => {
                                                        setTargetSearch(r.range);
                                                        setShowTargetDropdown(false);
                                                    }}
                                                >
                                                    <span className="font-mono font-bold text-slate-700">{r.range}</span>
                                                    <div className="text-right text-xs">
                                                        <div className="text-slate-600">{(r.maxPallet || 0) - (r.curPallet || 0)} {t('space')}</div>
                                                        <div className="text-slate-400 truncate max-w-[120px]">{r.destinations || 'Empty'}</div>
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="px-3 py-2 text-slate-400 text-sm text-center">{t('noMatches')}</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                {targetRule && (
                                    <div className="mt-2 p-3 bg-slate-50 rounded-lg text-sm border border-slate-100">
                                        <div className="flex justify-between mb-1">
                                            <span className="text-slate-500">{t('current')}:</span>
                                            <span className="font-bold">{targetRule.curPallet} <span className="text-xs font-normal">{t('unitPlts')}</span></span>
                                        </div>
                                        <div className="flex justify-between mb-1">
                                            <span className="text-slate-500">{t('colMax')}:</span>
                                            <span className="font-bold">{targetRule.maxPallet}</span>
                                        </div>
                                        <div className="text-xs text-slate-400 mt-2 truncate">{targetRule.destinations || 'Empty'}</div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">{t('moveQty')} ({t('pallets')})</label>
                            <input 
                                type="number"
                                value={movePallets}
                                onChange={e => setMovePallets(e.target.value === '' ? '' : parseInt(e.target.value))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                                placeholder="0"
                            />
                            <div className="text-xs text-right text-slate-400 mt-1 cursor-pointer hover:text-blue-600" onClick={() => {if(sourceRule) setMovePallets(sourceRule.curPallet || 0)}}>
                                {t('max')}: {maxPallets}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">{t('colCartons')}</label>
                            <input 
                                type="number"
                                value={moveCartons}
                                onChange={e => setMoveCartons(e.target.value === '' ? '' : parseInt(e.target.value))}
                                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                                placeholder="0"
                            />
                            <div className="text-xs text-right text-slate-400 mt-1 cursor-pointer hover:text-blue-600" onClick={() => {if(sourceRule) setMoveCartons(sourceRule.curCartons || 0)}}>
                                {t('max')}: {maxCartons}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1 uppercase">{t('selectReason')}</label>
                            <select 
                                value={manualReason}
                                onChange={e => setManualReason(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            >
                                <option value="Blocking">{t('reasonBlocking')}</option>
                                <option value="Mixed">{t('reasonMixed')}</option>
                                <option value="Outbound">{t('reasonOutbound')}</option>
                                <option value="Inbound">{t('reasonInbound')}</option>
                                <option value="Other">{t('other')}</option>
                            </select>
                            {manualReason === 'Other' && (
                                <input 
                                    type="text"
                                    value={customReason}
                                    onChange={e => setCustomReason(e.target.value)}
                                    placeholder={t('specifyReason')}
                                    className="w-full mt-2 px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none animate-fade-in-down"
                                />
                            )}
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <button 
                            onClick={handleExecute}
                            disabled={!sourceRule || !targetRule || !movePallets}
                            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                        >
                            <CheckCircle size={20} />
                            <span className="font-bold">{t('executeMove')}</span>
                        </button>
                    </div>
                </div>
            ) : (
                /* Suggestions Panel */
                <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-slate-200 shadow-sm animate-fade-in-up">
                     <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
                                <Zap className="text-yellow-500" /> {t('smartSuggestion')}
                            </h3>
                            <p className="text-xs text-slate-500">{t('suggestionHint')}</p>
                        </div>
                        <button 
                            onClick={generateSuggestions}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors shadow-sm text-sm"
                        >
                            <Zap size={16} /> {t('generateMoves')}
                        </button>
                     </div>

                     {suggestions.length > 0 && (
                         <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                             <button 
                                onClick={() => setPriorityFilter('all')}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${priorityFilter === 'all' ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'}`}
                             >
                                {t('showAllTasks')} ({suggestions.length})
                             </button>
                             <button 
                                onClick={() => setPriorityFilter('high')}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${priorityFilter === 'high' ? 'bg-red-100 text-red-700 border-red-200' : 'bg-white text-slate-600 border-slate-200 hover:border-red-200 hover:text-red-600'}`}
                             >
                                {t('pHigh')} ({suggestions.filter(s => s.priority === 'high').length})
                             </button>
                             <button 
                                onClick={() => setPriorityFilter('medium')}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${priorityFilter === 'medium' ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-200 hover:text-blue-600'}`}
                             >
                                {t('pMedium')} ({suggestions.filter(s => s.priority === 'medium').length})
                             </button>
                             <button 
                                onClick={() => setPriorityFilter('low')}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors whitespace-nowrap ${priorityFilter === 'low' ? 'bg-gray-100 text-gray-700 border-gray-200' : 'bg-white text-slate-600 border-slate-200 hover:border-gray-300'}`}
                             >
                                {t('pLow')} ({suggestions.filter(s => s.priority === 'low').length})
                             </button>
                         </div>
                     )}

                     {suggestions.length === 0 ? (
                         <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                             <Zap size={32} className="mx-auto mb-2 opacity-30" />
                             <p>{t('noMovesFound')}</p>
                         </div>
                     ) : (
                         <div className="space-y-3">
                             {filteredSuggestions.map(s => (
                                 <div key={s.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-shadow group">
                                     <div className="flex items-center gap-4">
                                         {/* Source */}
                                         <div className="flex flex-col items-center min-w-[3rem]">
                                             <span className="font-mono font-bold text-lg text-red-600">{s.source}</span>
                                             <span className="text-[10px] text-slate-400 uppercase">{t('from')}</span>
                                         </div>
                                         <ArrowRight size={16} className="text-slate-300" />
                                         {/* Target */}
                                         <div className="flex flex-col items-center min-w-[3rem]">
                                             <span className="font-mono font-bold text-lg text-green-600">{s.target}</span>
                                             <span className="text-[10px] text-slate-400 uppercase">{t('to')}</span>
                                         </div>
                                         
                                         <div className="h-8 w-px bg-slate-200 mx-2 hidden sm:block"></div>
                                         
                                         <div>
                                             <div className="flex items-center gap-2 mb-1">
                                                 <span className={`px-2 py-0.5 rounded text-xs font-bold ${s.priority === 'high' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                                                     {s.dest}
                                                 </span>
                                                 <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium border border-slate-200">
                                                     {s.quantity} {t('unitPlts')}
                                                 </span>
                                             </div>
                                             <p className="text-xs text-slate-400 flex items-center gap-1">
                                                 {s.priority === 'high' && <AlertCircle size={12} className="text-red-500 fill-current" />}
                                                 {s.reason}
                                             </p>
                                         </div>
                                     </div>
                                     <button 
                                        onClick={() => executeSuggestion(s)}
                                        className="px-4 py-2 bg-emerald-50 text-emerald-700 text-xs font-bold rounded-lg hover:bg-emerald-100 border border-emerald-200 transition-colors"
                                     >
                                         {t('executeMove')}
                                     </button>
                                 </div>
                             ))}
                             {filteredSuggestions.length === 0 && (
                                 <div className="text-center py-8 text-slate-400 italic bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                     {t('noMatchingSuggestions')}
                                 </div>
                             )}
                         </div>
                     )}
                </div>
            )}

            {/* History Card - Always Visible */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col h-full">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                    <History className="text-slate-400" /> {t('executionHistory')}
                </h3>
                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar max-h-[500px]">
                    {history.length > 0 ? history.map((h, i) => (
                        <div key={i} className="p-3 bg-slate-50 rounded-lg border border-slate-100 text-sm animate-fade-in-down">
                            <div className="flex justify-between items-start mb-1">
                                <span className="font-bold text-slate-700">{h.source} <span className="text-slate-400 font-normal">→</span> {h.target}</span>
                                <span className="text-xs text-slate-400">{h.time}</span>
                            </div>
                            <div className="flex justify-between text-xs">
                                <span className="text-slate-600">{h.pallets} {t('pallets')}</span>
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded-full">{h.reason}</span>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-10 text-slate-400 italic">
                            {t('noRecentMoves')}
                        </div>
                    )}
                </div>
            </div>
       </div>
    </div>
  );
};

export default StockAdjustment;
