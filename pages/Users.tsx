import React, { useState } from 'react';
import { Accounts, UserRole } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { Plus, Trash2, UserCircle, Eye, EyeOff } from 'lucide-react';
import { useNotifications } from '../components/Notifications';

interface Props {
  accounts: Accounts;
  onAddUser: (user: { username: string; pass: string; role: UserRole }) => void;
  onDeleteUser: (username: string) => void;
}

const Users: React.FC<Props> = ({ accounts, onAddUser, onDeleteUser }) => {
  const { t } = useLanguage();
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('operator');
  const [passwordVisibility, setPasswordVisibility] = useState<Record<string, boolean>>({});
  const { addNotification } = useNotifications();


  const togglePasswordVisibility = (username: string) => {
    setPasswordVisibility(prev => ({ ...prev, [username]: !prev[username] }));
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password || !role) {
      addNotification("All fields are required.", "error");
      return;
    }
    onAddUser({ username, pass: password, role });
    setUsername('');
    setPassword('');
    setRole('operator');
    setShowForm(false);
  };

  const handleDelete = (username: string) => {
    if (confirm(t('confirmDeleteUser'))) {
      onDeleteUser(username);
    }
  };

  const availableRoles: UserRole[] = ['operator', 'staff'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">{t('userManagement')}</h1>
          <p className="text-slate-500">{t('manageUsersDesc')}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
        >
          <Plus size={16} /> {t('addUser')}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <form onSubmit={handleAddSubmit} className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder={t('username')}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={t('password')}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                required
              />
              <select
                value={role || ''}
                onChange={e => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-blue-500"
              >
                {availableRoles.map(r => (
                  r && <option key={r} value={r} className="capitalize">{r}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">{t('cancel')}</button>
              <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">{t('addUser')}</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        {/* Mobile View */}
        <div className="md:hidden space-y-3">
            {Object.keys(accounts).map((name) => {
                const account = accounts[name];
                return (
                    <div key={name} className="p-3 border rounded-lg bg-slate-50">
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                                <UserCircle size={24} className="text-slate-400" />
                                <div>
                                    <p className="font-medium text-slate-800">{name}</p>
                                    <p className="text-xs text-slate-500 capitalize">{account.role}</p>
                                </div>
                            </div>
                            {name !== 'Mike' && (
                                <button onClick={() => handleDelete(name)} className="text-slate-400 hover:text-red-500 p-2">
                                    <Trash2 size={16} />
                                </button>
                            )}
                        </div>
                        <div className="mt-2 pt-2 border-t border-slate-200">
                             <div className="text-xs text-slate-500">{t('password')}</div>
                             <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-mono text-slate-700">
                                    {passwordVisibility[name] ? account.password : '••••••••'}
                                </span>
                                <button onClick={() => togglePasswordVisibility(name)} className="text-slate-500 hover:text-slate-800">
                                    {passwordVisibility[name] ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                             </div>
                        </div>
                    </div>
                );
            })}
        </div>
        
        {/* Desktop View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-slate-500 font-medium text-xs">
              <tr>
                <th className="px-4 py-2">{t('username')}</th>
                <th className="px-4 py-2">{t('role')}</th>
                <th className="px-4 py-2">{t('password')}</th>
                <th className="px-4 py-2">{t('colActions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {Object.keys(accounts).map((name) => {
                const account = accounts[name];
                return (
                  <tr key={name} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium">{name}</td>
                    <td className="px-4 py-2 capitalize">{account.role}</td>
                    <td className="px-4 py-2">
                       <div className="flex items-center gap-2">
                           <span className="font-mono text-slate-600">
                               {passwordVisibility[name] ? account.password : '••••••••'}
                           </span>
                           <button onClick={() => togglePasswordVisibility(name)} className="text-slate-400 hover:text-slate-700">
                               {passwordVisibility[name] ? <EyeOff size={16} /> : <Eye size={16} />}
                           </button>
                       </div>
                    </td>
                    <td className="px-4 py-2">
                      {name !== 'Mike' && (
                        <button onClick={() => handleDelete(name)} className="text-slate-400 hover:text-red-500 p-1">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Users;