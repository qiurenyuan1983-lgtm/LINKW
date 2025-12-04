
import React from 'react';
import { LocationRule } from '../types';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  rules: LocationRule[];
}

const DashboardStats: React.FC<Props> = ({ rules }) => {
  const { t } = useLanguage();
  const totalLocations = rules.length;
  let totalMax = 0;
  let totalCur = 0;
  let overCount = 0;

  const typeMap: Record<string, { count: number; cur: number; max: number }> = {};
  const destPalletMap: Record<string, number> = {};
  const destCartonMap: Record<string, number> = {};
  const zoneMap: Record<string, { count: number; cur: number; max: number }> = {};

  rules.forEach(r => {
    const maxP = r.maxPallet ?? 0;
    const curP = r.curPallet ?? 0;
    const curC = r.curCartons ?? 0;
    totalMax += maxP;
    totalCur += curP;

    if (r.allowedDest && r.currentDest && r.currentDest > r.allowedDest) {
      overCount++;
    }

    // Type Stats
    const tVal = r.type || 'other';
    if (!typeMap[tVal]) typeMap[tVal] = { count: 0, cur: 0, max: 0 };
    typeMap[tVal].count++;
    typeMap[tVal].cur += curP;
    typeMap[tVal].max += maxP;

    // Dest Pallet Stats
    if (curP > 0 || curC > 0) {
      const tags = ((r.destinations || "").split(/[，,]/).map(t => t.trim()).filter(Boolean));
      // FIX: Explicitly type `uniqueTags` as `string[]` to ensure `tag` is inferred as a string.
      const uniqueTags: string[] = Array.from(new Set(tags));
      for (const tag of uniqueTags) {
        destPalletMap[tag] = (destPalletMap[tag] || 0) + curP;
        destCartonMap[tag] = (destCartonMap[tag] || 0) + curC;
      }
    }

    // Zone Stats
    const zone = r.range.charAt(0).toUpperCase();
    if (/[A-Z]/.test(zone)) {
        if (!zoneMap[zone]) zoneMap[zone] = { count: 0, cur: 0, max: 0 };
        zoneMap[zone].count++;
        zoneMap[zone].cur += curP;
        zoneMap[zone].max += maxP;
    }
  });

  const utilization = totalMax > 0 ? Math.round((totalCur / totalMax) * 100) : 0;
  
  // Utilization Text Logic
  let utilText = t('normalLoad');
  let utilColor = "text-slate-500";
  let barColor = "bg-blue-500";

  if (utilization === 0) {
      utilText = t('emptyLoad');
      utilColor = "text-slate-400";
      barColor = "bg-slate-300";
  } else if (utilization < 50) {
      utilText = t('lowLoad');
      utilColor = "text-emerald-500";
      barColor = "bg-emerald-500";
  } else if (utilization < 80) {
      utilText = t('modLoad');
      utilColor = "text-blue-500";
      barColor = "bg-blue-500";
  } else if (utilization < 95) {
      utilText = t('highLoad');
      utilColor = "text-orange-500";
      barColor = "bg-orange-500";
  } else {
      utilText = t('critLoad');
      utilColor = "text-red-500";
      barColor = "bg-red-500";
  }

  const destData = Object.entries(destPalletMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([name, value]) => ({ 
        name, 
        value,
        cartons: destCartonMap[name] || 0
    }));

  const typeData = Object.entries(typeMap).map(([name, data]) => ({
      name,
      value: data.count,
      cur: data.cur,
      max: data.max,
      utilization: data.max > 0 ? Math.round((data.cur / data.max) * 100) : 0
  }));

  const zoneData = Object.entries(zoneMap).sort((a, b) => a[0].localeCompare(b[0])).map(([name, data]) => ({
      name,
      count: data.count,
      cur: data.cur,
      max: data.max,
      utilization: data.max > 0 ? Math.round((data.cur / data.max) * 100) : 0
  }));

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d'];

  return (
    <div className="space-y-6">
      {/* Top Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 p-4 rounded-xl shadow-sm">
          <h3 className="text-sm font-medium text-blue-800 flex justify-between">
            {t('totalLocations')} <span className="text-xs text-blue-400">{t('zones')}</span>
          </h3>
          <p className="text-3xl font-bold text-blue-600 mt-2">{totalLocations}</p>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 p-4 rounded-xl shadow-sm">
          <h3 className="text-sm font-medium text-slate-600">{t('palletCapacity')}</h3>
          <div className="flex items-end gap-2 mt-2">
            <span className="text-3xl font-bold text-slate-800">{totalCur}</span>
            <span className="text-sm text-slate-400 mb-1">/ {totalMax}</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-1.5 mt-2 overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${barColor}`} 
              style={{ width: `${Math.min(utilization, 100)}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-white to-slate-50 border border-slate-200 p-4 rounded-xl shadow-sm">
          <h3 className="text-sm font-medium text-slate-600">{t('avgUtilization')}</h3>
          <p className="text-3xl font-bold text-slate-800 mt-2">{utilization}%</p>
          <p className={`text-xs mt-1 font-medium ${utilColor}`}>
            {utilText}
          </p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-white border border-red-100 p-4 rounded-xl shadow-sm">
          <h3 className="text-sm font-medium text-red-800">{t('destConstraint')}</h3>
          <p className="text-3xl font-bold text-red-600 mt-2">{overCount}</p>
          <p className="text-xs text-red-400 mt-1">{t('locsExceeding')}</p>
        </div>
      </div>

      {/* Zone Statistics */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 mb-4">{t('zoneStats')}</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {zoneData.map(z => {
                let zoneColor = 'bg-blue-500';
                let zoneBadge = 'bg-blue-100 text-blue-700';
                if(z.utilization >= 95) { zoneColor = 'bg-red-500'; zoneBadge = 'bg-red-100 text-red-700'; }
                else if(z.utilization >= 80) { zoneColor = 'bg-orange-500'; zoneBadge = 'bg-orange-100 text-orange-700'; }
                else if(z.utilization < 50 && z.utilization > 0) { zoneColor = 'bg-emerald-500'; zoneBadge = 'bg-emerald-100 text-emerald-700'; }
                else if(z.utilization === 0) { zoneColor = 'bg-slate-300'; zoneBadge = 'bg-slate-100 text-slate-500'; }

                return (
                 <div key={z.name} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-lg text-slate-700">{z.name} <span className="text-xs font-normal text-slate-400">Zone</span></span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${zoneBadge}`}>
                            {z.utilization}%
                        </span>
                    </div>
                    <div className="text-xs text-slate-500 flex justify-between">
                        <span>{t('count')}: {z.count}</span>
                        <span className="font-mono">{z.cur}/{z.max}</span>
                    </div>
                    {/* Mini bar */}
                    <div className="w-full bg-slate-200 h-1 mt-2 rounded-full overflow-hidden">
                        <div 
                            className={`h-full ${zoneColor}`} 
                            style={{width: `${Math.min(z.utilization, 100)}%`}}
                        ></div>
                    </div>
                 </div>
            )})}
          </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Type Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
          <h3 className="text-base font-semibold text-slate-800 mb-4">{t('summaryByType')}</h3>
          <div className="overflow-x-auto">
             <table className="w-full text-xs text-left">
               <thead className="bg-slate-50 font-medium text-slate-500">
                 <tr>
                    <th className="px-2 py-2">{t('colType')}</th>
                    <th className="px-2 py-2 text-right">{t('count')}</th>
                    <th className="px-2 py-2 text-right">Cur / Max</th>
                    <th className="px-2 py-2 text-right">{t('util')}</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-slate-100">
                  {typeData.map((d, i) => {
                    let badgeClass = 'bg-blue-100 text-blue-700';
                    if(d.utilization >= 95) badgeClass = 'bg-red-100 text-red-700';
                    else if(d.utilization >= 80) badgeClass = 'bg-orange-100 text-orange-700';
                    else if(d.utilization < 50 && d.utilization > 0) badgeClass = 'bg-emerald-100 text-emerald-700';
                    else if(d.utilization === 0) badgeClass = 'bg-slate-100 text-slate-500';

                    return (
                    <tr key={i}>
                      <td className="px-2 py-2 font-medium capitalize">{t(d.name as any)}</td>
                      <td className="px-2 py-2 text-right">{d.value}</td>
                      <td className="px-2 py-2 text-right">{d.cur} / {d.max}</td>
                      <td className="px-2 py-2 text-right">
                          <span className={`px-1.5 py-0.5 rounded ${badgeClass}`}>
                              {d.utilization}%
                          </span>
                      </td>
                    </tr>
                  )})}
               </tbody>
             </table>
          </div>
        </div>

        {/* Top Destinations */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
           <h3 className="text-base font-semibold text-slate-800 mb-4">{t('topDestinations')}</h3>
           <div className="flex flex-col sm:flex-row gap-6">
              <div className="w-full sm:w-1/2 relative min-h-[250px]" style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%" debounce={50}>
                  <PieChart>
                    <Pie 
                      data={destData} 
                      cx="50%" 
                      cy="50%" 
                      innerRadius={40} 
                      outerRadius={80} 
                      paddingAngle={5} 
                      dataKey="value"
                    >
                      {destData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="w-full sm:w-1/2 overflow-y-auto max-h-48 sm:max-h-64 text-xs">
                 <table className="w-full">
                   <thead>
                     <tr className="border-b text-left text-slate-500">
                       <th className="py-1">{t('dest')}</th>
                       <th className="py-1 text-right">{t('palletCount')}</th>
                       <th className="py-1 text-right">{t('colCartons')}</th>
                     </tr>
                   </thead>
                   <tbody>
                      {destData.map((d, i) => (
                        <tr key={i} className="border-b border-slate-50">
                          <td className="py-1 truncate max-w-[80px]" title={d.name}>{d.name}</td>
                          <td className="py-1 text-right font-medium">{d.value}</td>
                          <td className="py-1 text-right text-slate-500">{d.cartons}</td>
                        </tr>
                      ))}
                   </tbody>
                 </table>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardStats;
