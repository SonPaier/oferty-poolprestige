import { supabase } from '@/integrations/supabase/client';
import { CompanySettings, defaultCompanySettings } from '@/types/configurator';
import { ExcavationSettings, defaultExcavationSettings } from '@/types/offers';
import { Json } from '@/integrations/supabase/types';

const SETTINGS_ID = 'default';

interface DbSettings {
  id: string;
  company_settings: CompanySettings;
  excavation_settings: ExcavationSettings;
  created_at: string;
  updated_at: string;
}

// Get all settings from database
export async function getSettingsFromDb(): Promise<{
  companySettings: CompanySettings;
  excavationSettings: ExcavationSettings;
} | null> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', SETTINGS_ID)
    .single();

  if (error) {
    // If no settings exist yet, return null
    if (error.code === 'PGRST116') {
      return null;
    }
    console.error('Error fetching settings:', error);
    return null;
  }

  const dbSettings = data as unknown as DbSettings;
  
  return {
    companySettings: {
      ...defaultCompanySettings,
      ...(dbSettings.company_settings || {}),
    },
    excavationSettings: {
      ...defaultExcavationSettings,
      ...(dbSettings.excavation_settings || {}),
    },
  };
}

// Save all settings to database
export async function saveSettingsToDb(
  companySettings: CompanySettings,
  excavationSettings: ExcavationSettings
): Promise<boolean> {
  const { error } = await supabase
    .from('settings')
    .upsert({
      id: SETTINGS_ID,
      company_settings: companySettings as unknown as Json,
      excavation_settings: excavationSettings as unknown as Json,
    }, {
      onConflict: 'id',
    });

  if (error) {
    console.error('Error saving settings:', error);
    return false;
  }

  return true;
}

// Save only company settings
export async function saveCompanySettingsToDb(companySettings: CompanySettings): Promise<boolean> {
  const existing = await getSettingsFromDb();
  const excavationSettings = existing?.excavationSettings || defaultExcavationSettings;
  
  return saveSettingsToDb(companySettings, excavationSettings);
}

// Save only excavation settings
export async function saveExcavationSettingsToDb(excavationSettings: ExcavationSettings): Promise<boolean> {
  const existing = await getSettingsFromDb();
  const companySettings = existing?.companySettings || defaultCompanySettings;
  
  return saveSettingsToDb(companySettings, excavationSettings);
}
