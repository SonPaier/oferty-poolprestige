import logo from '@/assets/logo.png';
import { Settings, FileText, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface HeaderProps {
  onSettingsClick?: () => void;
  onNewOffer?: () => void;
}

export function Header({ onSettingsClick, onNewOffer }: HeaderProps) {
  return (
    <header className="glass-card border-b border-border/30 sticky top-0 z-50">
      <div className="container mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img 
              src={logo} 
              alt="Pool Prestige" 
              className="h-10 w-auto object-contain"
            />
            <div className="hidden md:block">
              <h1 className="text-lg font-semibold text-foreground">Konfigurator Basenów</h1>
              <p className="text-xs text-muted-foreground">Profesjonalne wyceny i oferty</p>
            </div>
          </div>
          
          <nav className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onNewOffer}
              className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
            >
              <FileText className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Nowa oferta</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onSettingsClick}
              className="text-muted-foreground hover:text-foreground hover:bg-muted/50"
            >
              <Settings className="w-4 h-4 mr-2" />
              <span className="hidden sm:inline">Ustawienia</span>
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
}
