import React, { useMemo, useState } from 'react';
import { LocationRule, LogEntry } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, 
  PieChart, Pie, Cell, AreaChart, Area 
} from 'recharts';
import { TrendingUp, Activity, Package, AlertCircle, Table as TableIcon, BarChart2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';

interface Props {
  rules: LocationRule[];
  logs: LogEntry[];
}

type SortDir = 'asc' | 'desc';

const BI: React.FC<Props> = ({ rules, logs }) => {
  const { t } = useLanguage();

  // State for Zone Sorting & View
  const [zoneView, setZoneView] = useState<'chart' | 'table'>('chart');
  const [zoneSort, setZoneSort] = useState<{ key: 'name' | 'volume' | 'utilization' | 'capacity'; dir: SortDir }>({ key: 'name', dir: 'asc' });

  // State for Type Sorting
  const [typeSort, setTypeSort] = useState<{ key: 'name' | 'value'; dir: SortDir }>({ key: 'value', dir: 'desc' });

  // 1. Zone Statistics (Utilization & Volume)
  const zoneStats = useMemo(() => {
    const zones: Record<string, { total: number, used: number, max: number }> = {};
    
    rules.forEach(r => {
      const zoneChar = r.range.charAt(0).toUpperCase();
      const zone = /[A-Z]/.test(zoneChar) ? zoneChar : 'Other';
      
      if (!zones[zone]) zones[zone] = { total: 0, used: 0, max: 0 };
      zones[zone].total += 1;
      zones[zone].used += r.curPallet || 0;
      zones[zone].max += r.maxPallet || 0;
    });

    const rawData = Object.entries(zones).map(([name, data]) => ({
        name,
        utilization: data.max > 0 ? Math.round((data.used / data.max) * 100) : 0,
        volume: data.used,
        capacity: data.max
    }));

    // Apply Sorting
    return rawData.sort((a, b) => {
        const modifier = zoneSort.dir === 'asc' ? 1 : -1;
        if (zoneSort.key === 'name') return a.name.localeCompare(b.name) * modifier;
        return (a[zoneSort.key] - b[zoneSort.key]) * modifier;
    });
  }, [rules, zoneSort]);

  // 2. Inventory Type Distribution
  const typeStats = useMemo(() => {
    const counts: Record<string, number> = {};
    rules.forEach(r => {
        if ((r.curPallet || 0) > 0) {
            const typeLabel = t(r.type as any) || r.type;
            counts[typeLabel] = (counts[typeLabel] || 0) + (r.curPallet || 0);
        }
    });
    
    const rawData = Object.entries(counts).map(([name, value]) => ({ name, value }));

    // Apply Sorting
    return rawData.sort((a, b) => {
        const modifier = typeSort.dir === 'asc' ? 1 : -1;
        if (typeSort.key === 'name') return a.name.localeCompare(b.name) * modifier;
        return (a.value - b.value) * modifier;
    });
  }, [rules, t, typeSort]);

  // 3. Operational Activity
  const activityStats = useMemo(() => {
    const hours = Array(24).fill(0);
    logs.forEach(log => {
        try {
            const date = new Date(log.time);
            if (!isNaN(date.getTime())) {
                hours[date.getHours()]++;
            }
        } catch (e) {}
    });
    
    const totalParsed = hours.reduce((a,b) => a+b, 0);
    if (totalParsed < logs.length * 0.5 && logs.length > 0) {
        return logs.slice(0, 20).reverse().map((_, i) => ({
            time: `T-${20-i}`,
            count: 1
        }));
    }

    return hours.map((count, hour) => ({
        time: `${hour}:00`,
        count
    }));
  }, [logs]);

  // 4. Capacity Buckets
  const capacityBuckets = useMemo(() => {
      const buckets = {
          'Empty': 0,
          '1-50%': 0,
          '51-80%': 0,
          '81-99%': 0,
          'Full (100%+)': 0
      };
      
      rules.forEach(r => {
          const max = r.maxPallet || 0;
          if (max === 0) return;
          const pct = (r.curPallet || 0) / max;
          
          if (pct === 0) buckets['Empty']++;
          else if (pct <= 0.5) buckets['1-50%']++;
          else if (pct <= 0.8) buckets['51-80%']++;
          else if (pct < 1) buckets['81-99%']++;
          else buckets['Full (100%+)']++;
      });
      
      return Object.entries(buckets).map(([name, value]) => ({ name, value }));
  }, [rules]);

  // Helpers
  const handleZoneSort = (key: 'name' | 'volume' | 'utilization' | 'capacity') => {
      setZoneSort(prev => ({
          key,
          dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc'
      }));
  };

  const handleTypeSort = (key: 'name' | 'value') => {
      setTypeSort(prev => ({
          key,
          dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc'
      }));
  };

  const SortIcon = ({ active, dir }: { active: boolean; dir: SortDir }) => {
      if (!active) return <ArrowUpDown size={14} className="text-slate-300 ml-1" />;
      return dir === 'asc' ? <ArrowUp size={14} className="text-blue-600 ml-1" /> : <ArrowDown size={14} className="text-blue-600 ml-1" />;
  };

  // Metrics
  const totalPallets = rules.reduce((acc, r) => acc + (r.curPallet || 0), 0);
  const totalCapacity = rules.reduce((acc, r) => acc + (r.maxPallet || 0), 0);
  const globalUtilization = totalCapacity > 0 ? Math.round((totalPallets / totalCapacity) * 100) : 0;
  const activeLocations = rules.filter(r => (r.curPallet || 0) > 0).length;

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ef4444', '#f97316'];

  return (
    <div className="space-y-6 animate-fade-in-up">
        {/* Header */}
        <div className="flex justify-between items-start">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Activity className="text-blue-600" /> {t('biTitle')}
                </h1>
                <p className="text-slate-500">{t('biDesc')}</p>
            </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Package size={20} /></div>
                    <span className="text-sm text-slate-500 font-medium">{t('totalInventory')}</span>
                </div>
                <div className="text-2xl font-bold text-slate-800">{totalPallets.toLocaleString()} <span className="text-sm font-normal text-slate-400">plts</span></div>
             </div>
             
             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><TrendingUp size={20} /></div>
                    <span className="text-sm text-slate-500 font-medium">{t('globalUtilization')}</span>
                </div>
                <div className="text-2xl font-bold text-slate-800">{globalUtilization}%</div>
                <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{width: `${globalUtilization}%`}}></div>
                </div>
             </div>

             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-purple-50 text-purple-600 rounded-lg"><AlertCircle size={20} /></div>
                    <span className="text-sm text-slate-500 font-medium">{t('occupiedLocations')}</span>
                </div>
                <div className="text-2xl font-bold text-slate-800">{activeLocations} <span className="text-sm font-normal text-slate-400">/ {rules.length}</span></div>
             </div>

             <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-orange-50 text-orange-600 rounded-lg"><Activity size={20} /></div>
                    <span className="text-sm text-slate-500 font-medium">{t('recentActivity')}</span>
                </div>
                <div className="text-2xl font-bold text-slate-800">{logs.length} <span className="text-sm font-normal text-slate-400">logs</span></div>
             </div>
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Zone Performance */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm min-h-[400px] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-slate-800">{t('zonePerformance')}</h3>
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button 
                            onClick={() => setZoneView('chart')}
                            className={`p-1.5 rounded-md transition-all ${zoneView === 'chart' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            title="Chart View"
                        >
                            <BarChart2 size={16} />
                        </button>
                        <button 
                            onClick={() => setZoneView('table')}
                            className={`p-1.5 rounded-md transition-all ${zoneView === 'table' ? 'bg-white shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            title="Table View"
                        >
                            <TableIcon size={16} />
                        </button>
                    </div>
                </div>
                
                {zoneView === 'chart' ? (
                    <div className="flex-1">
                        <div className="flex justify-end gap-2 mb-2 text-xs text-slate-500">
                            <span className="flex items-center cursor-pointer hover:text-blue-600" onClick={() => handleZoneSort('name')}>
                                Sort by Name <SortIcon active={zoneSort.key === 'name'} dir={zoneSort.dir} />
                            </span>
                            <span className="flex items-center cursor-pointer hover:text-blue-600" onClick={() => handleZoneSort('utilization')}>
                                Sort by Util <SortIcon active={zoneSort.key === 'utilization'} dir={zoneSort.dir} />
                            </span>
                        </div>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={zoneStats} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis dataKey="name" tick={{fontSize: 12}} stroke="#94a3b8" />
                                <YAxis yAxisId="left" orientation="left" stroke="#94a3b8" />
                                <YAxis yAxisId="right" orientation="right" stroke="#94a3b8" unit="%" />
                                <Tooltip 
                                    contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                                />
                                <Legend />
                                <Bar yAxisId="left" dataKey="volume" name={t('palletCount')} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                <Bar yAxisId="right" dataKey="utilization" name={t('utilization')} fill="#10b981" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium">
                                <tr>
                                    <th className="px-3 py-2 cursor-pointer hover:bg-slate-100" onClick={() => handleZoneSort('name')}>
                                        Zone <SortIcon active={zoneSort.key === 'name'} dir={zoneSort.dir} />
                                    </th>
                                    <th className="px-3 py-2 text-right cursor-pointer hover:bg-slate-100" onClick={() => handleZoneSort('volume')}>
                                        {t('palletCount')} <SortIcon active={zoneSort.key === 'volume'} dir={zoneSort.dir} />
                                    </th>
                                    <th className="px-3 py-2 text-right cursor-pointer hover:bg-slate-100" onClick={() => handleZoneSort('capacity')}>
                                        Cap <SortIcon active={zoneSort.key === 'capacity'} dir={zoneSort.dir} />
                                    </th>
                                    <th className="px-3 py-2 text-right cursor-pointer hover:bg-slate-100" onClick={() => handleZoneSort('utilization')}>
                                        {t('utilization')} <SortIcon active={zoneSort.key === 'utilization'} dir={zoneSort.dir} />
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {zoneStats.map((z) => (
                                    <tr key={z.name} className="hover:bg-slate-50">
                                        <td className="px-3 py-2 font-medium">{z.name}</td>
                                        <td className="px-3 py-2 text-right">{z.volume}</td>
                                        <td className="px-3 py-2 text-right text-slate-400">{z.capacity}</td>
                                        <td className="px-3 py-2 text-right">
                                            <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                                z.utilization > 90 ? 'bg-red-100 text-red-700' :
                                                z.utilization > 50 ? 'bg-blue-100 text-blue-700' :
                                                'bg-emerald-100 text-emerald-700'
                                            }`}>{z.utilization}%</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Inventory Composition */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm min-h-[400px]">
                <h3 className="text-lg font-bold text-slate-800 mb-6">{t('inventoryComposition')}</h3>
                <div className="flex flex-col sm:flex-row gap-4 h-full">
                    <div className="w-full sm:w-1/2 min-h-[250px]" style={{ height: 300 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={typeStats}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={100}
                                    paddingAngle={2}
                                    dataKey="value"
                                >
                                    {typeStats.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="w-full sm:w-1/2 flex flex-col max-h-[300px] overflow-hidden">
                        <div className="overflow-y-auto pr-1 custom-scrollbar flex-1 border rounded-lg">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0 z-10">
                                    <tr>
                                        <th className="px-3 py-2 cursor-pointer hover:bg-slate-100" onClick={() => handleTypeSort('name')}>
                                            Type <SortIcon active={typeSort.key === 'name'} dir={typeSort.dir} />
                                        </th>
                                        <th className="px-3 py-2 text-right cursor-pointer hover:bg-slate-100" onClick={() => handleTypeSort('value')}>
                                            Count <SortIcon active={typeSort.key === 'value'} dir={typeSort.dir} />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {typeStats.map((entry, index) => (
                                        <tr key={index} className="hover:bg-slate-50">
                                            <td className="px-3 py-2 flex items-center gap-2">
                                                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                                                <span className="truncate max-w-[120px]" title={entry.name}>{entry.name}</span>
                                            </td>
                                            <td className="px-3 py-2 text-right font-medium">{entry.value}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm min-h-[400px]">
                <h3 className="text-lg font-bold text-slate-800 mb-6">{t('operationalActivity')} (24h)</h3>
                <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={activityStats} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                                <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                            </linearGradient>
                        </defs>
                        <XAxis dataKey="time" tick={{fontSize: 10}} stroke="#94a3b8" />
                        <YAxis stroke="#94a3b8" />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <Tooltip />
                        <Area type="monotone" dataKey="count" stroke="#8884d8" fillOpacity={1} fill="url(#colorCount)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>

            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm min-h-[400px]">
                 <h3 className="text-lg font-bold text-slate-800 mb-6">{t('capacityDistribution')}</h3>
                 <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                        layout="vertical"
                        data={capacityBuckets}
                        margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                    >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" stroke="#94a3b8" />
                        <YAxis dataKey="name" type="category" width={80} stroke="#64748b" tick={{fontSize: 12, fontWeight: 500}} />
                        <Tooltip cursor={{fill: 'transparent'}} />
                        <Bar dataKey="value" fill="#f59e0b" radius={[0, 4, 4, 0]} barSize={20}>
                            {capacityBuckets.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={
                                    entry.name === 'Empty' ? '#cbd5e1' :
                                    entry.name === 'Full (100%+)' ? '#ef4444' :
                                    entry.name === '81-99%' ? '#f97316' :
                                    entry.name === '1-50%' ? '#10b981' : '#3b82f6'
                                } />
                            ))}
                        </Bar>
                    </BarChart>
                 </ResponsiveContainer>
            </div>
        </div>
    </div>
  );
};

export default BI;