import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info';

interface Notification {
  id: number;
  message: string;
  type: NotificationType;
}

interface NotificationContextType {
  addNotification: (message: string, type?: NotificationType) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

const ICONS: Record<NotificationType, React.ElementType> = {
    success: CheckCircle,
    error: AlertCircle,
    info: Info,
};

const STYLES: Record<NotificationType, string> = {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    error: 'bg-red-50 text-red-700 border-red-200',
    info: 'bg-blue-50 text-blue-700 border-blue-200',
};


export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const addNotification = useCallback((message: string, type: NotificationType = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);
  
  const removeNotification = (id: number) => {
      setNotifications(prev => prev.filter(n => n.id !== id));
  }

  return (
    <NotificationContext.Provider value={{ addNotification }}>
      {children}
      <div className="fixed top-4 right-4 z-[100] w-80 space-y-2">
        {notifications.map(notification => {
          const Icon = ICONS[notification.type];
          const style = STYLES[notification.type];
          return (
            <div 
              key={notification.id} 
              className={`relative flex items-start gap-3 p-4 rounded-xl border shadow-lg animate-fade-in-right ${style}`}
            >
              <Icon className="w-5 h-5 mt-0.5 flex-shrink-0" />
              <p className="text-sm font-medium flex-1">{notification.message}</p>
              <button onClick={() => removeNotification(notification.id)} className="p-1 rounded-full hover:bg-black/10 absolute top-1 right-1">
                  <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
       <style>{`
        @keyframes fade-in-right {
          from { opacity: 0; transform: translateX(1rem); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-in-right { animation: fade-in-right 0.3s ease-out; }
      `}</style>
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
