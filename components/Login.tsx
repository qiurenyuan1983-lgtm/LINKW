import React, { useState } from 'react';
import { UserRole, Accounts } from '../types';
import { Lock, Warehouse } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface Props {
  onLogin: (role: UserRole) => void;
  accounts: Accounts;
}

const Login: React.FC<Props> = ({ onLogin, accounts }) => {
  const [user, setUser] = useState('Mike');
  const [pass, setPass] = useState('');
  const [error, setError] = useState('');
  const { t } = useLanguage();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const account = accounts[user.trim()];
    if (account && account.password === pass.trim()) {
      onLogin(account.role);
    } else {
      setError(t('invalidCredentials'));
    }
  };

  return (
    <div 
      className="min-h-screen bg-cover bg-center flex items-center justify-center p-4 relative"
      style={{
        backgroundImage: `url('https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?q=80&w=2070&auto=format&fit=crop')`
      }}
    >
      {/* Overlay to ensure text readability and create a "dimmed" cartoonish feel */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"></div>

      <div className="bg-white/95 backdrop-blur rounded-2xl p-8 max-w-md w-full shadow-2xl relative z-10 border border-white/20">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-blue-600 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white shadow-lg font-bold text-3xl tracking-tighter">
            LW
          </div>
          <h1 className="text-2xl font-bold text-slate-800">{t('loginTitle')}</h1>
          <p className="text-slate-500 text-sm">{t('loginSubtitle')}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('username')}</label>
            <input 
              type="text" 
              value={user} 
              onChange={e => setUser(e.target.value)} 
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">{t('password')}</label>
            <input 
              type="password" 
              value={pass} 
              onChange={e => setPass(e.target.value)} 
              placeholder="••••••"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none transition-shadow"
            />
          </div>
          
          {error && <p className="text-red-500 text-sm text-center font-medium bg-red-50 py-1 rounded">{error}</p>}

          <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 hover:shadow-blue-300 transform hover:-translate-y-0.5">
            {t('signIn')}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;