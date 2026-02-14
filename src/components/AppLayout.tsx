import { ReactNode, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";

import { SettingsDialog } from "./SettingsDialog";
import { useSettings } from "@/context/SettingsContext";

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [showSettings, setShowSettings] = useState(false);
  const { 
    companySettings, 
    excavationSettings, 
    setCompanySettings, 
    setExcavationSettings 
  } = useSettings();

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          
          <main className="flex-1 overflow-visible">
            {children}
          </main>
        </div>
      </div>
      <SettingsDialog 
        open={showSettings} 
        onClose={() => setShowSettings(false)}
        companySettings={companySettings}
        onSaveCompanySettings={setCompanySettings}
        excavationSettings={excavationSettings}
        onSaveExcavationSettings={setExcavationSettings}
      />
    </SidebarProvider>
  );
}
