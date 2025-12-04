



import React, { useState } from 'react';
import { ExceptionEntry } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { AlertTriangle, Plus, Search, Camera, X, Image as ImageIcon } from 'lucide-react';

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
  const [photos, setPhotos] = useState<string[]>([]);
  const [keyword, setKeyword] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          const maxWidth = 800;
          const maxHeight = 800;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxWidth) {
              height *= maxWidth / width;
              width = maxWidth;
            }
          } else {
            if (height > maxHeight) {
              width *= maxHeight / height;
              height = maxHeight;
            }
          }
          canvas.width = width;
          canvas.height = height;
          if(ctx){
              ctx.drawImage(img, 0, 0, width, height);
              // Compress to JPEG at 0.6 quality
              resolve(canvas.toDataURL('image/jpeg', 0.6));
          } else {
              resolve(e.target?.result as string); // Fallback
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files) as File[];
      const newPhotos: string[] = [];
      for (const file of files) {
          const compressed = await compressImage(file);
          newPhotos.push(compressed);
      }
      setPhotos(prev => [...prev, ...newPhotos]);
    }
    e.target.value = ''; // Reset input to allow re-selection of same file
  };

  const removePhoto = (index: number) => {
      setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description) {
      alert("Description is required.");
      return;
    }
    onAddException({ containerNo, pcNo, description, photos });
    // Reset form
    setContainerNo('');
    setPcNo('');
    setDescription('');
    setPhotos([]);
    setShowForm(false);
  };

  const filteredExceptions = exceptions.filter(ex => 
      (ex.containerNo && ex.containerNo.toLowerCase().includes(keyword.toLowerCase())) ||
      (ex.pcNo && ex.pcNo.toLowerCase().includes(keyword.toLowerCase())) ||
      ex.description.toLowerCase().includes(keyword.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {previewImage && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={() => setPreviewImage(null)}>
            <div className="relative max-w-[90vw] max-h-[90vh]">
                <img src={previewImage} alt="Preview" className="max-w-full max-h-full rounded-lg shadow-2xl" />
                <button onClick={() => setPreviewImage(null)} className="absolute -top-4 -right-4 bg-white rounded-full p-2 text-black hover:bg-slate-200">
                    <X size={20} />
                </button>
            </div>
        </div>
      )}

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
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm animate-fade-in-up">
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

                  {/* Photo Upload Area */}
                  <div>
                      <span className="block text-sm font-medium text-slate-700 mb-2">{t('photos')}</span>
                      <div className="flex gap-2 flex-wrap">
                          {photos.map((p, i) => (
                             <div key={i} className="relative w-20 h-20 border rounded-lg overflow-hidden group">
                               <img src={p} className="w-full h-full object-cover" alt={`Upload ${i}`} />
                               <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                   <button type="button" onClick={() => removePhoto(i)} className="bg-red-500 text-white p-1 rounded-full"><X size={14} /></button>
                               </div>
                             </div>
                          ))}
                          <label className="w-20 h-20 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 cursor-pointer hover:border-blue-500 hover:text-blue-500 hover:bg-blue-50 transition-all">
                             <Camera size={24} />
                             <span className="text-[10px] mt-1">{t('uploadPhoto')}</span>
                             <input type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelect} />
                          </label>
                      </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                      <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">{t('cancel')}</button>
                      <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2">
                          <AlertTriangle size={16} /> {t('record')}
                      </button>
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
                {ex.photos && ex.photos.length > 0 && (
                    <div className="flex gap-2 mb-3 overflow-x-auto pb-2">
                        {ex.photos.map((p, i) => (
                            <img 
                                key={i} 
                                src={p} 
                                alt="Evid" 
                                className="w-16 h-16 object-cover rounded border bg-white flex-shrink-0" 
                                onClick={() => setPreviewImage(p)}
                            />
                        ))}
                    </div>
                )}
                <div className="text-xs text-slate-500 space-y-1 border-t border-slate-200 pt-2">
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
                  <th className="px-4 py-2">{t('colPhotos')}</th>
                  <th className="px-4 py-2">{t('description')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExceptions.map(ex => (
                  <tr key={ex.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 whitespace-nowrap text-slate-500">{ex.time}</td>
                    <td className="px-4 py-2 font-mono">{ex.containerNo}</td>
                    <td className="px-4 py-2 font-mono">{ex.pcNo}</td>
                    <td className="px-4 py-2">
                        {ex.photos && ex.photos.length > 0 ? (
                             <div className="flex -space-x-2 overflow-hidden hover:space-x-1 transition-all p-1">
                                {ex.photos.map((p, i) => (
                                    <img 
                                        key={i} 
                                        src={p} 
                                        className="inline-block h-8 w-8 rounded-full ring-2 ring-white object-cover cursor-pointer hover:scale-150 transition-transform z-0 hover:z-10" 
                                        onClick={() => setPreviewImage(p)}
                                        alt="Thumbnail"
                                    />
                                ))}
                            </div>
                        ) : (
                            <span className="text-slate-300 text-xs italic">No photos</span>
                        )}
                    </td>
                    <td className="px-4 py-2 max-w-xs truncate" title={ex.description}>{ex.description}</td>
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