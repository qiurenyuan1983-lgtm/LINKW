
import React, { useState, useMemo, useEffect } from 'react';
import { LocationRule, DESTINATION_OPTIONS } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Plus, Trash2, Search, Edit2, X, Save, Tag, AlertCircle } from 'lucide-react';
import { useNotifications } from '../components/Notifications';

interface Props {
  rules: LocationRule[];
  onAddLocation: (locationCode: string) => void;
  onDeleteLocation: (locationCode: string) => void;
  onUpdateRule: (rule: LocationRule) => void;
}

const getDestTagClass = (tag: string) => {
    const t = tag.toLowerCase();
    if (t.includes('amazon') || /^[a-z]{3}\d/i.test(t)) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (t.includes('shein') || t.includes('希音')) return 'bg-pink-100 text-pink-800 border-pink-200';
    if (t.includes('private') || t.includes('住宅') || t.includes('resident')) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (t.includes('fedex') || t.includes('ups')) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (t.includes('暂扣') || t.includes('中转') || t.includes('fbx')) return 'bg-purple-100 text-purple-800 border-purple-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
};

const EditLocationModal: React.FC<{ 
    isOpen: boolean; 
    onClose: () => void; 
    rule: LocationRule; 
    onSave: (updated: LocationRule) => void; 
}> = ({ isOpen, onClose, rule, onSave }) => {
    const { t } = useLanguage();
    const { addNotification } = useNotifications();
    const [destinations, setDestinations] = useState<string[]>([]);
    const [newDestInput, setNewDestInput] = useState('');
    const [note, setNote] = useState(rule.note || '');

    useEffect(() => {
        setDestinations((rule.destinations || '').split(/[,，]/).map(d => d.trim()).filter(Boolean));
        setNote(rule.note || '');
    }, [rule]);

    if (!isOpen) return null;

    const currentCount = destinations.length;
    const allowed = rule.allowedDest || 99; // Default to high number if null
    const isLimitReached = currentCount >= allowed;

    const handleSave = () => {
        onSave({
            ...rule,
            destinations: destinations.join('，'),
            currentDest: destinations.length,
            note: note
        });
        onClose();
    };

    const addDest = (d: string) => {
        const clean = d.trim();
        if (!clean) return;
        if (destinations.includes(clean)) return; // No duplicates
        
        if (currentCount >= allowed) {
            addNotification(`${t('maxAllowed')}: ${allowed}`, 'error');
            return;
        }
        
        setDestinations([...destinations, clean]);
        setNewDestInput('');
    };

    const removeDest = (d: string) => {
        setDestinations(destinations.filter(x => x !== d));
    };

    const toggleDestOption = (opt: string) => {
        if (destinations.includes(opt)) {
            removeDest(opt);
        } else {
            addDest(opt);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-[500px] max-w-[95%] flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b bg-slate-50 rounded-t-xl flex justify-between items-center">
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                        <Edit2 size={18} className="text-blue-600" />
                        {t('edit')} - <span className="font-mono">{rule.range}</span>
                    </h3>
                    <button onClick={onClose} className="p-1 rounded hover:bg-slate-200"><X size={20} /></button>
                </div>
                
                <div className="p-6 space-y-5 overflow-y-auto">
                    {/* Destinations Section */}
                    <div>
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-slate-700">{t('colDest')} (Tags)</label>
                            <span className={`text-xs font-bold ${isLimitReached ? 'text-red-500' : 'text-slate-400'}`}>
                                {currentCount} / {rule.allowedDest || '∞'}
                            </span>
                        </div>
                        
                        {/* Tag Input Area */}
                        <div className={`p-2 border rounded-lg bg-white focus-within:ring-2 focus-within:ring-blue-500 flex flex-wrap gap-2 min-h-[42px] ${isLimitReached ? 'border-red-200 bg-red-50' : 'border-slate-300'}`}>
                            {destinations.map(tag => (
                                <span key={tag} className={`px-2 py-1 rounded text-xs border font-medium flex items-center gap-1 ${getDestTagClass(tag)}`}>
                                    {tag}
                                    <button onClick={() => removeDest(tag)} className="hover:bg-black/10 rounded-full p-0.5"><X size={12} /></button>
                                </span>
                            ))}
                            <input 
                                className="flex-1 min-w-[80px] text-sm bg-transparent outline-none"
                                value={newDestInput}
                                onChange={e => setNewDestInput(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        addDest(newDestInput);
                                    }
                                    if (e.key === 'Backspace' && !newDestInput && destinations.length > 0) {
                                        removeDest(destinations[destinations.length - 1]);
                                    }
                                }}
                                placeholder={destinations.length === 0 ? "Type & Enter..." : ""}
                                disabled={isLimitReached && !newDestInput}
                            />
                        </div>
                        {isLimitReached && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={12} /> {t('maxAllowed')} reached.</p>}

                        {/* Quick Options */}
                        <p className="text-xs text-slate-500 mt-3 mb-2">Quick Select:</p>
                        <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 border rounded-lg bg-slate-50">
                            {DESTINATION_OPTIONS.map(opt => {
                                const isSelected = destinations.includes(opt);
                                return (
                                    <button 
                                        key={opt}
                                        onClick={() => toggleDestOption(opt)}
                                        disabled={!isSelected && isLimitReached}
                                        className={`px-2 py-1 text-xs rounded border transition-all ${
                                            isSelected 
                                            ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                                        } ${!isSelected && isLimitReached ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                        {opt}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                    
                    {/* Note Section */}
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">{t('colNote')}</label>
                        <input 
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm" 
                            value={note} 
                            onChange={e => setNote(e.target.value)} 
                            placeholder="Optional notes..."
                        />
                    </div>
                </div>

                <div className="p-4 border-t bg-slate-50 rounded-b-xl flex justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg text-sm font-medium">{t('cancel')}</button>
                    <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-sm font-medium flex items-center gap-2">
                        <Save size={16} /> {t('save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const LocationManager: React.FC<Props> = ({ rules, onAddLocation, onDeleteLocation, onUpdateRule }) => {
  const { t } = useLanguage();
  const { addNotification } = useNotifications();
  const [newLocationCode, setNewLocationCode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [editingRule, setEditingRule] = useState<LocationRule | null>(null);

  const locationCodesByZone = useMemo(() => {
    const zones: Record<string, LocationRule[]> = {};
    const regularRules = rules.filter(r => r.range !== 'Office1');
    const officeRule = rules.find(r => r.range === 'Office1');

    regularRules.forEach(rule => {
      const zone = rule.range.charAt(0);
      if (/[A-Z]/.test(zone)) {
        if (!zones[zone]) {
          zones[zone] = [];
        }
        zones[zone].push(rule);
      }
    });

    Object.keys(zones).forEach(zone => {
      zones[zone].sort((a, b) => {
        const numA = parseInt(a.range.slice(1), 10);
        const numB = parseInt(b.range.slice(1), 10);
        return numA - numB;
      });
    });

    let sortedEntries = Object.entries(zones).sort(([zoneA], [zoneB]) => zoneA.localeCompare(zoneB));

    if (officeRule) {
        sortedEntries.unshift(['Office', [officeRule]]);
    }

    return sortedEntries;
  }, [rules]);

  const filteredZones = useMemo(() => {
    if (!searchTerm) {
      return locationCodesByZone;
    }
    const lowerSearchTerm = searchTerm.toLowerCase();
    const filtered = locationCodesByZone
      .map(([zone, locations]) => {
        const filteredLocations = locations.filter(loc => 
            loc.range.toLowerCase().includes(lowerSearchTerm) || 
            loc.destinations?.toLowerCase().includes(lowerSearchTerm)
        );
        return [zone, filteredLocations] as [string, LocationRule[]];
      })
      .filter(([, locations]) => locations.length > 0);
    return filtered;
  }, [searchTerm, locationCodesByZone]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const code = newLocationCode.trim().toUpperCase();
    if (!code) {
      addNotification("Location code cannot be empty.", "error");
      return;
    }
    if (!/^[A-Z]\d{2,}$/.test(code) && code.toUpperCase() !== 'OFFICE1') {
      addNotification("Invalid format. Use a letter followed by numbers (e.g., A55).", "error");
      return;
    }
    onAddLocation(code);
    setNewLocationCode('');
  };

  const handleDelete = (locationCode: string) => {
    if (confirm(t('confirmDeleteLocation', { locationCode }))) {
      onDeleteLocation(locationCode);
    }
  };

  return (
    <div className="space-y-6">
      {editingRule && (
          <EditLocationModal 
            isOpen={true} 
            onClose={() => setEditingRule(null)} 
            rule={editingRule} 
            onSave={onUpdateRule} 
          />
      )}

      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('locationManagement')}</h1>
          <p className="text-slate-500">{t('locationManagementDesc')}</p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-700 mb-2">{t('addNewLocation')}</h2>
        <form onSubmit={handleAddSubmit} className="flex flex-col sm:flex-row gap-2">
          <input
            value={newLocationCode}
            onChange={e => setNewLocationCode(e.target.value)}
            placeholder={t('locationCodePlaceholder')}
            className="flex-1 w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus size={16} /> {t('addLocation')}
          </button>
        </form>
      </div>

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex flex-col sm:flex-row justify-between items-center mb-4 gap-4">
          <h2 className="text-lg font-semibold text-slate-700">{t('existingLocations')}</h2>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="text"
              placeholder={t('searchPlaceholder')}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
          {filteredZones.length > 0 ? filteredZones.map(([zone, locations]) => (
            <div key={zone}>
              <h3 className="font-bold text-slate-500 bg-slate-50 p-2 rounded-t-lg border-b sticky top-0 z-10 flex justify-between items-center">
                  <span>{`Zone ${zone}`}</span>
                  <span className="text-xs font-normal text-slate-400">{locations.length} locations</span>
              </h3>
              <ul className="divide-y divide-slate-100 bg-white border border-t-0 border-slate-100 rounded-b-lg">
                {locations.map(rule => (
                  <li key={rule.range} className="flex justify-between items-center p-3 hover:bg-slate-50 group">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <span className="font-mono text-slate-700 font-bold w-12">{rule.range}</span>
                        
                        {rule.destinations ? (
                            <div className="flex gap-1 flex-wrap">
                                {rule.destinations.split(/[,，]/).map(d => d.trim()).filter(Boolean).map((d, i) => (
                                    <span key={i} className={`text-[10px] px-1.5 py-0.5 rounded border ${getDestTagClass(d)}`}>
                                        {d}
                                    </span>
                                ))}
                            </div>
                        ) : (
                            <span className="text-xs text-slate-300 italic flex items-center gap-1">
                                <Tag size={10} /> No fixed destinations
                            </span>
                        )}
                    </div>
                    
                    <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => setEditingRule(rule)} 
                            className="p-1.5 text-blue-500 hover:bg-blue-50 rounded"
                            title="Edit Rules"
                        >
                            <Edit2 size={16} />
                        </button>
                        <button 
                            onClick={() => handleDelete(rule.range)} 
                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded" 
                            title={`${t('deleteLocation')} ${rule.range}`}
                        >
                            <Trash2 size={16} />
                        </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )) : (
             <p className="text-center py-8 text-slate-400">No locations found.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default LocationManager;
