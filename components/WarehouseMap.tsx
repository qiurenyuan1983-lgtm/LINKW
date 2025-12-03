import React, { useState, useMemo, useRef, useEffect } from 'react';
import { LocationRule, LOCATION_TYPES } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { X, MapPin } from 'lucide-react';

const locationCodes = [
  "Office1",
  "A00","A01","A02","A03","A04","A05","A06","A07","A08","A09", "A10","A11","A12","A13","A14","A15","A16","A17","A18","A19", "A20","A21","A22","A23","A24","A25","A26","A27","A28","A29", "A30","A31","A32","A33","A34","A35","A36","A37","A38","A39", "A40","A41","A42","A43","A44","A45","A46","A47","A48","A49", "A50","A51","A52","A53","A54",
  "B00","B01","B02","B03","B04","B05","B06","B07","B08","B09", "B10","B11","B12","B13","B14","B15","B16","B17","B18","B19", "B20","B21","B22","B23","B24","B25","B26","B27","B28","B29", "B30","B31","B32","B33",
  "C00","C01","C02","C03","C04","C05","C06","C07","C08","C09", "C10","C11","C12","C13","C14","C15","C16","C17","C18","C19", "C20","C21","C22","C23","C24","C25","C26","C27","C28","C29", "C30","C31","C32","C33",
  "D00","D01","D02","D03","D04","D05","D06","D07","D08","D09", "D10","D11","D12","D13","D14","D15","D16","D17","D18","D19", "D20","D21","D22","D23","D24","D25","D26","D27","D28","D29", "D30","D31","D32","D33",
  "E01","E02","E03","E04","E05","E06","E07","E08","E09", "E10","E11","E12","E13","E14","E15","E16","E17",
  "F00","F01","F02","F03","F04","F05","F06","F07","F08","F09","F10","F11",
  "G00","G01","G02","G03","G04","G05","G06","G07","G08","G09", "G10","G11","G12","G13","G14","G15","G16","G17","G18",
  "H01","H02","H03","H04","H05","H06","H07","H08","H09","H10","H11","H12","H13","H14", "H15","H16","H17","H18","H19","H20","H21","H22","H23","H24","H25","H26","H27","H28","H29","H30","H31","H32","H33","H34", "H35","H36","H37","H38","H39","H40","H41","H42",
  "V09","V10","V11","V12","V13","V14","V15","V16","V17","V18","V19","V20", "V21","V22","V23","V24","V25","V26","V27","V28","V29","V30","V31","V32", "V33","V34","V35","V36","V37","V38","V39","V40","V41","V42","V43","V44", "V45","V46","V47","V48","V49","V50","V51","V52","V53","V54","V55","V56", "V57","V58","V59","V60","V61","V62","V63","V64","V65",
  "R34","R35","R36","R37","R38","R39","R40","R41","R42"
].map(c => c === 'T02' ? 'H02' : c); // Correct H02 from the start

const warehouseLayout = locationCodes.reduce((acc, code) => {
    const prefix = code.match(/^[A-Z]/)?.[0] || (code === 'Office1' ? 'Office' : 'Other');
    let zone = acc.find(z => z.zone === prefix);
    if (!zone) {
        zone = { zone: prefix, locations: [] };
        acc.push(zone);
    }
    zone.locations.push(code);
    return acc;
}, [] as { zone: string; locations: string[] }[]);

// Sort zones alphabetically, with Office first
warehouseLayout.sort((a, b) => {
    if (a.zone === 'Office') return -1;
    if (b.zone === 'Office') return 1;
    return a.zone.localeCompare(b.zone);
});

const getUtilColorAndClass = (utilization: number): string => {
  if (utilization >= 0.95) return 'bg-red-500 hover:bg-red-600 border-red-700';
  if (utilization >= 0.8) return 'bg-orange-500 hover:bg-orange-600 border-orange-700';
  if (utilization < 0.5 && utilization > 0) return 'bg-emerald-500 hover:bg-emerald-600 border-emerald-700';
  if (utilization > 0) return 'bg-blue-500 hover:bg-blue-600 border-blue-700';
  return 'bg-slate-200 hover:bg-slate-300 border-slate-400';
};

const Legend: React.FC = () => {
    const { t } = useLanguage();
    const items = [
        { label: 'Empty (0%)', color: 'bg-slate-200' },
        { label: 'Low (1-49%)', color: 'bg-emerald-500' },
        { label: 'Moderate (50-79%)', color: 'bg-blue-500' },
        { label: 'High (80-94%)', color: 'bg-orange-500' },
        { label: 'Critical (95%+)', color: 'bg-red-500' },
    ];
    return (
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-xs">
            {items.map(item => (
                <div key={item.label} className="flex items-center gap-1.5">
                    <div className={`w-3 h-3 rounded-sm ${item.color}`}></div>
                    <span className="text-slate-500">{item.label}</span>
                </div>
            ))}
        </div>
    );
};

interface TooltipProps {
    rule: LocationRule;
    position: { top: number; left: number };
    onClose: () => void;
}

const LocationTooltip: React.FC<TooltipProps> = ({ rule, position, onClose }) => {
    const { t } = useLanguage();
    const typeDef = LOCATION_TYPES.find(lt => lt.value === rule.type) || {value: 'other', label: 'Other', class: 'bg-gray-50 text-gray-700 border-gray-200'};
    const utilization = (rule.maxPallet && rule.maxPallet > 0) ? (rule.curPallet || 0) / rule.maxPallet : 0;
    
    return (
        <div 
            style={{ top: position.top, left: position.left }} 
            className="absolute z-20 bg-white rounded-lg shadow-2xl w-64 p-4 border border-slate-200 animate-fade-in-up"
        >
            <button onClick={onClose} className="absolute top-2 right-2 p-1 text-slate-400 hover:text-slate-600"><X size={16} /></button>
            <h4 className="font-bold text-lg text-slate-800">{rule.range}</h4>
            <span className={`px-2 py-1 rounded-md text-[10px] border ${typeDef.class}`}>{t(typeDef.value as any)}</span>
            
            <div className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                    <span className="text-slate-500">{t('colCur')} / {t('colMax')}</span>
                    <span className="font-medium">{rule.curPallet || 0} / {rule.maxPallet || '-'}</span>
                </div>
                 <div className="flex justify-between items-center">
                    <span className="text-slate-500">{t('colUtil')}</span>
                    <div className="flex items-center gap-2">
                        <div className="w-20 h-2 bg-slate-200 rounded-full"><div className={`${getUtilColorAndClass(utilization).split(' ')[0]} h-2 rounded-full`} style={{width: `${utilization * 100}%`}}></div></div>
                        <span className="font-medium">{Math.round(utilization * 100)}%</span>
                    </div>
                </div>
                <div className="flex justify-between">
                    <span className="text-slate-500">{t('colDest')}</span>
                    <span className="font-medium truncate max-w-[150px]">{rule.destinations || 'N/A'}</span>
                </div>
                <div className="text-xs text-slate-400 pt-2 border-t border-slate-100">{rule.note || 'No notes'}</div>
            </div>
        </div>
    );
};

interface Props {
  rules: LocationRule[];
}

const WarehouseMap: React.FC<Props> = ({ rules }) => {
  const { t } = useLanguage();
  const [selectedLocation, setSelectedLocation] = useState<LocationRule | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const mapContainerRef = useRef<HTMLDivElement>(null);

  const rulesMap = useMemo(() => {
    return rules.reduce((acc, rule) => {
      acc[rule.range] = rule;
      return acc;
    }, {} as Record<string, LocationRule>);
  }, [rules]);

  const handleLocationClick = (e: React.MouseEvent, code: string) => {
    e.stopPropagation();
    const rule = rulesMap[code];
    if (rule) {
        if (selectedLocation && selectedLocation.range === code) {
            setSelectedLocation(null); // Toggle off if same is clicked
            return;
        }

        const target = e.currentTarget as HTMLElement;
        const container = mapContainerRef.current;
        if (container) {
            const targetRect = target.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            let top = targetRect.bottom - containerRect.top + 8; // Below the cell
            let left = targetRect.left - containerRect.left; // Align with cell
            
            // Adjust if tooltip goes off-screen
            if (left + 256 > containerRect.width) { // 256 is tooltip width
                left = targetRect.right - containerRect.left - 256;
            }
            if (top + 180 > container.clientHeight) { // 180 is approx tooltip height
                top = targetRect.top - containerRect.top - 180 - 8;
            }

            setTooltipPosition({ top, left });
            setSelectedLocation(rule);
        }
    }
  };
  
  useEffect(() => {
    const handleOutsideClick = () => setSelectedLocation(null);
    if (selectedLocation) {
        document.addEventListener('click', handleOutsideClick);
    }
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [selectedLocation]);

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-4">
        <h3 className="text-base font-semibold text-slate-800 flex items-center gap-2">
            <MapPin size={18} />
            {t('Interactive Warehouse Map')}
        </h3>
        <Legend />
      </div>

      <div ref={mapContainerRef} className="relative bg-slate-50 p-4 rounded-lg border border-slate-100 max-h-[60vh] overflow-auto space-y-6">
        {warehouseLayout.map(({ zone, locations }) => (
          <div key={zone}>
            <h4 className="font-bold text-slate-600 border-b border-slate-200 pb-1 mb-2">{`Zone ${zone}`}</h4>
            <div className="grid grid-cols-5 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-15 gap-1.5">
              {locations.map(code => {
                const rule = rulesMap[code];
                const utilization = rule ? (rule.maxPallet && rule.maxPallet > 0 ? (rule.curPallet || 0) / rule.maxPallet : 0) : 0;
                const colorClass = getUtilColorAndClass(utilization);
                const isSelected = selectedLocation?.range === code;

                return (
                  <button
                    key={code}
                    onClick={(e) => handleLocationClick(e, code)}
                    className={`h-8 rounded text-[10px] font-mono text-slate-900 font-bold flex items-center justify-center border transition-all duration-150 transform hover:scale-110 ${colorClass} ${isSelected ? 'ring-2 ring-offset-2 ring-blue-500' : ''}`}
                    title={code}
                  >
                    {code.replace(zone, '')}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
        {selectedLocation && <LocationTooltip rule={selectedLocation} position={tooltipPosition} onClose={() => setSelectedLocation(null)} />}
      </div>
       <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(0.5rem); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in-up { animation: fade-in-up 0.2s ease-out; }
        .grid-cols-15 { grid-template-columns: repeat(15, minmax(0, 1fr)); }
      `}</style>
    </div>
  );
};

export default WarehouseMap;