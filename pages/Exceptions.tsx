import React, { useState } from 'react';
import { ExceptionEntry } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { AlertTriangle, Plus, Search } from 'lucide-react';

interface Props {
  exceptions: ExceptionEntry[];
  onAddException: (entry: Omit<ExceptionEntry, 'id' | 'time'>) => void;
}

const Exceptions: React.FC<Props> = ({ exceptions, onAddException }) => {
  const { t } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [containerNo, setContainerNo] = useState('');
  const [pcNo, setPcNo] = useState('');
  const [description, setDescription] = useState('');
  const [keyword, setKeyword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description) {
      alert("Description is required.");
      return;
    }
    onAddException({ containerNo, pcNo, description });
    // Reset form
    setContainerNo('');
    setPcNo('');
    setDescription('');
    setShowForm(false);
  };

  const filteredExceptions = exceptions.filter(ex => 
      (ex.containerNo && ex.containerNo.toLowerCase().includes(keyword.toLowerCase())) ||
      (ex.pcNo && ex.pcNo.toLowerCase().includes(keyword.toLowerCase())) ||
      ex.description.toLowerCase().includes(keyword.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
            <h1 className="text-2xl font-bold text-slate-800">{t('exceptionsTitle')}</h1>
            <p className="text-slate-500">{t('exceptionsDesc')}</p>
        </div>
        <button 
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
        >
            <Plus size={16} /> {t('addException')}
        </button>
      </div>

      {showForm && (
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
              <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <input 
                          value={containerNo}
                          onChange={e => setContainerNo(e.target.value)}
                          placeholder={t('containerNo')}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                      <input 
                          value={pcNo}
                          onChange={e => setPcNo(e.target.value)}
                          placeholder={t('pcNo')}
                          className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                      />
                  </div>
                  <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder={t('description')}
                      required
                      className="w-full h-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  ></textarea>
                  <div className="flex justify-end gap-2">
                      <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">{t('cancel')}</button>
                      <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">{t('record')}</button>
                  </div>
              </form>
          </div>
      )}

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                  type="text" 
                  placeholder="Search exceptions..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
              />
          </div>
          
          {/* Mobile View */}
          <div className="md:hidden space-y-3">
            {filteredExceptions.map(ex => (
              <div key={ex.id} className="p-4 border rounded-lg bg-slate-50">
                <p className="font-medium text-slate-800 mb-2">{ex.description}</p>
                <div className="text-xs text-slate-500 space-y-1">
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-600">{t('time')}:</span>
                    <span>{ex.time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-slate-600">{t('containerNo')}:</span>
                    <span className="font-mono">{ex.containerNo || 'N/A'}</span>
                  </div>
                   <div className="flex justify-between">
                    <span className="font-medium text-slate-600">{t('pcNo')}:</span>
                    <span className="font-mono">{ex.pcNo || 'N/A'}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-500 font-medium text-xs">
                <tr>
                  <th className="px-4 py-2">{t('time')}</th>
                  <th className="px-4 py-2">{t('containerNo')}</th>
                  <th className="px-4 py-2">{t('pcNo')}</th>
                  <th className="px-4 py-2">{t('description')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExceptions.map(ex => (
                  <tr key={ex.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 whitespace-nowrap text-slate-500">{ex.time}</td>
                    <td className="px-4 py-2 font-mono">{ex.containerNo}</td>
                    <td className="px-4 py-2 font-mono">{ex.pcNo}</td>
                    <td className="px-4 py-2">{ex.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredExceptions.length === 0 && <p className="text-center py-8 text-slate-400">No exceptions found.</p>}
      </div>
    </div>
  );
};

export default Exceptions;
