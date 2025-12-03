import React, { useState, useEffect, useMemo } from 'react';
import DashboardStats from '../components/DashboardStats';
import WarehouseMap from '../components/WarehouseMap';
import { LocationRule } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { LayoutGrid, Check, ArrowUp, ArrowDown } from 'lucide-react';

interface Props {
  rules: LocationRule[];
}

const DASHBOARD_LAYOUT_KEY = "la_dashboard_layout_v14";

const Dashboard: React.FC<Props> = ({ rules }) => {
  const { t } = useLanguage();
  const [componentOrder, setComponentOrder] = useState<string[]>(['stats', 'map']);
  const [isEditing, setIsEditing] = useState(false);

  const components: { [key: string]: React.ReactNode } = useMemo(() => ({
    stats: <DashboardStats rules={rules} />,
    map: <WarehouseMap rules={rules} />,
  }), [rules]);

  useEffect(() => {
    const savedOrder = localStorage.getItem(DASHBOARD_LAYOUT_KEY);
    if (savedOrder) {
      try {
        const parsedOrder = JSON.parse(savedOrder);
        // Validate saved order to ensure it matches current components
        if (Array.isArray(parsedOrder) && parsedOrder.length === Object.keys(components).length && parsedOrder.every(item => item in components)) {
          setComponentOrder(parsedOrder);
        }
      } catch (e) {
        console.error("Failed to parse dashboard layout from localStorage", e);
      }
    }
  }, [components]);

  useEffect(() => {
    localStorage.setItem(DASHBOARD_LAYOUT_KEY, JSON.stringify(componentOrder));
  }, [componentOrder]);

  const handleMove = (index: number, direction: 'up' | 'down') => {
    const newOrder = [...componentOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex >= 0 && targetIndex < newOrder.length) {
      [newOrder[index], newOrder[targetIndex]] = [newOrder[targetIndex], newOrder[index]];
      setComponentOrder(newOrder);
    }
  };

  return (
    <div className="space-y-6">
       <div className="mb-6 flex justify-between items-start">
         <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('overviewTitle')}</h1>
            <p className="text-slate-500">{t('overviewDesc')}</p>
         </div>
         <button
            onClick={() => setIsEditing(!isEditing)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
              isEditing
                ? 'bg-blue-600 text-white border-blue-700 hover:bg-blue-700'
                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
            }`}
          >
            {isEditing ? <Check size={16} /> : <LayoutGrid size={16} />}
            {isEditing ? t('done') : t('editLayout')}
          </button>
       </div>

       {componentOrder.map((key, index) => (
        <div key={key} className={`relative rounded-xl transition-all ${isEditing ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
          {isEditing && (
            <div className="absolute top-2 right-2 z-10 bg-white/80 backdrop-blur-sm rounded-lg shadow-md flex items-center border">
              <button 
                onClick={() => handleMove(index, 'up')} 
                disabled={index === 0}
                className="p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-l-md"
                title={t('moveUp')}
              >
                <ArrowUp size={16} />
              </button>
              <div className="w-px h-5 bg-slate-200"></div>
              <button 
                onClick={() => handleMove(index, 'down')} 
                disabled={index === componentOrder.length - 1}
                className="p-2 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed rounded-r-md"
                title={t('moveDown')}
              >
                <ArrowDown size={16} />
              </button>
            </div>
          )}
          {components[key]}
        </div>
      ))}
    </div>
  );
};

export default Dashboard;
