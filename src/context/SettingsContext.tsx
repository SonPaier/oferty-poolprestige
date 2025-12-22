import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CompanySettings, defaultCompanySettings } from '@/types/configurator';
import { ExcavationSettings, defaultExcavationSettings } from '@/types/offers';
import { getSettingsFromDb, saveSettingsToDb } from '@/lib/settingsDb';

interface SettingsContextType {
  companySettings: CompanySettings;
  excavationSettings: ExcavationSettings;
  setCompanySettings: (settings: CompanySettings) => Promise<void>;
  setExcavationSettings: (settings: ExcavationSettings) => Promise<void>;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [companySettings, setCompanySettingsState] = useState<CompanySettings>(defaultCompanySettings);
  const [excavationSettings, setExcavationSettingsState] = useState<ExcavationSettings>(defaultExcavationSettings);
  const [isLoading, setIsLoading] = useState(true);

  // Load settings from database on mount
  useEffect(() => {
    const loadSettings = async () => {
      const dbSettings = await getSettingsFromDb();
      if (dbSettings) {
        setCompanySettingsState(dbSettings.companySettings);
        setExcavationSettingsState(dbSettings.excavationSettings);
      }
      setIsLoading(false);
    };
    loadSettings();
  }, []);

  const setCompanySettings = async (settings: CompanySettings) => {
    setCompanySettingsState(settings);
    await saveSettingsToDb(settings, excavationSettings);
  };

  const setExcavationSettings = async (settings: ExcavationSettings) => {
    setExcavationSettingsState(settings);
    await saveSettingsToDb(companySettings, settings);
  };

  return (
    <SettingsContext.Provider value={{
      companySettings,
      excavationSettings,
      setCompanySettings,
      setExcavationSettings,
      isLoading,
    }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
