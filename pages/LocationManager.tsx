import React, { useState, useMemo } from 'react';
import { LocationRule } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Plus, Trash2, Search } from 'lucide-react';
import { useNotifications } from '../components/Notifications';

interface Props {
  rules: LocationRule[];
  onAddLocation: (locationCode: string) => void;
  onDeleteLocation: (locationCode: string) => void;
}

const LocationManager: React.FC<Props> = ({ rules, onAddLocation, onDeleteLocation }) => {
  const { t } = useLanguage();
  const { addNotification } = useNotifications();
  const [newLocationCode, setNewLocationCode] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const locationCodesByZone = useMemo(() => {
    const zones: Record<string, string[]> = {};
    const regularRules = rules.filter(r => r.range !== 'Office1');
    const officeRule = rules.find(r => r.range === 'Office1');

    regularRules.forEach(rule => {
      const zone = rule.range.charAt(0);
      if (/[A-Z]/.test(zone)) {
        if (!zones[zone]) {
          zones[zone] = [];
        }
        zones[zone].push(rule.range);
      }
    });

    Object.keys(zones).forEach(zone => {
      zones[zone].sort((a, b) => {
        const numA = parseInt(a.slice(1), 10);
        const numB = parseInt(b.slice(1), 10);
        return numA - numB;
      });
    });

    let sortedEntries = Object.entries(zones).sort(([zoneA], [zoneB]) => zoneA.localeCompare(zoneB));

    if (officeRule) {
        sortedEntries.unshift(['Office', ['Office1']]);
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
        const filteredLocations = locations.filter(loc => loc.toLowerCase().includes(lowerSearchTerm));
        return [zone, filteredLocations] as [string, string[]];
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

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
          {filteredZones.length > 0 ? filteredZones.map(([zone, locations]) => (
            <div key={zone}>
              <h3 className="font-bold text-slate-500 bg-slate-50 p-2 rounded-t-lg border-b sticky top-0 z-10">{`Zone ${zone}`}</h3>
              <ul className="divide-y divide-slate-100 bg-slate-50/50 rounded-b-lg">
                {locations.map(loc => (
                  <li key={loc} className="flex justify-between items-center p-2 hover:bg-slate-100">
                    <span className="font-mono text-slate-700">{loc}</span>
                    <button onClick={() => handleDelete(loc)} className="text-slate-400 hover:text-red-500 p-1" title={`${t('deleteLocation')} ${loc}`}>
                      <Trash2 size={16} />
                    </button>
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
