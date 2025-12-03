import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const LOGO_KEY = "la_system_logo_v14";
const DEFAULT_LOGO_URL = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAMgAAADICAYAAACtWK6eAAAABGdBTUEAALGPC/xhBQAAACBjSFJNAAB6JgAAgIQAAPoAAACA6AAAdTAAAOpgAAA6mAAAF3CculE8AAAABlBMVEUAAADaN3sfSO5gAAAAAnRSTlMAAQGU/a4AAAAJcEhZcwAADsMAAA7DAcdvqGQAAARJSURBVHja7d1rctMwFIDhZqFqgQoiFbBCoAJCBVICpAQqACpQAVQAD5T8KZO2tD072x7b2f6+5KST3M3m3uwmEUnE9RgzjBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl/jBl';

interface LogoContextType {
  logoUrl: string;
  setLogoUrl: (url: string | null) => void;
}

const LogoContext = createContext<LogoContextType | undefined>(undefined);

export const LogoProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [logoUrl, setLogoState] = useState<string>(DEFAULT_LOGO_URL);

  useEffect(() => {
    const savedLogo = localStorage.getItem(LOGO_KEY);
    if (savedLogo) {
      setLogoState(savedLogo);
    }
  }, []);

  const setLogoUrl = (url: string | null) => {
    if (url) {
      localStorage.setItem(LOGO_KEY, url);
      setLogoState(url);
    } else {
      localStorage.removeItem(LOGO_KEY);
      setLogoState(DEFAULT_LOGO_URL);
    }
  };

  return (
    <LogoContext.Provider value={{ logoUrl, setLogoUrl }}>
      {children}
    </LogoContext.Provider>
  );
};

export const useLogo = () => {
  const context = useContext(LogoContext);
  if (!context) {
    throw new Error('useLogo must be used within a LogoProvider');
  }
  return context;
};
