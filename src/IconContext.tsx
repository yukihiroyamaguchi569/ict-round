import { createContext, useContext, useState, useEffect } from 'react';
import type { IconName, IconConfig } from './icons';
import { icons, loadIcon, saveIcon } from './icons';

interface IconContextValue {
  icon: IconConfig;
  iconName: IconName;
  setIcon: (name: IconName) => void;
}

const IconContext = createContext<IconContextValue | null>(null);

export function IconProvider({ children }: { children: React.ReactNode }) {
  const [iconName, setIconName] = useState<IconName>(loadIcon);

  useEffect(() => {
    saveIcon(iconName);
  }, [iconName]);

  const value: IconContextValue = {
    icon: icons[iconName],
    iconName,
    setIcon: setIconName,
  };

  return (
    <IconContext.Provider value={value}>
      {children}
    </IconContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useIcon() {
  const ctx = useContext(IconContext);
  if (!ctx) throw new Error('useIcon must be inside IconProvider');
  return ctx;
}
