import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useState, useEffect } from 'react';
import logo from '@/assets/logo.png';
import { Settings, FileText, History, LogOut, Bell, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { toast } from 'sonner';
import { getOverdueOffersCount, getQueueOffers } from '@/lib/offerDb';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

interface HeaderProps {
  onSettingsClick?: () => void;
  onNewOffer?: () => void;
}

export function Header({ onSettingsClick, onNewOffer }: HeaderProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [overdueCount, setOverdueCount] = useState(0);
  const [queueCount, setQueueCount] = useState(0);
  const [overdueOffers, setOverdueOffers] = useState<{ id: string; offerNumber: string; customerName: string; createdAt: string }[]>([]);
  
  useEffect(() => {
    const fetchNotifications = async () => {
      const count = await getOverdueOffersCount();
      setOverdueCount(count);
      
      const queueOffers = await getQueueOffers();
      setQueueCount(queueOffers.length);
      
      // Get overdue offers for notification popover
      const now = new Date();
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
      
      const overdue = queueOffers
        .filter(o => new Date(o.createdAt) < threeDaysAgo)
        .slice(0, 5)
        .map(o => ({
          id: o.id,
          offerNumber: o.offerNumber,
          customerName: o.customerData.contactPerson,
          createdAt: o.createdAt,
        }));
      
      setOverdueOffers(overdue);
    };
    
    fetchNotifications();
    
    // Refresh every 60 seconds
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, []);
  
  const handleLogout = () => {
    logout();
    toast.success('Wylogowano');
    navigate('/login', { replace: true });
  };
  
  const totalNotifications = overdueCount;
  
  return (
    <header className="bg-header border-b border-header/80 sticky top-0 z-50 shadow-lg">
      <div className="container mx-auto px-4 lg:px-6 py-3 lg:py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 lg:gap-4">
            <img 
              src={logo} 
              alt="Pool Prestige" 
              className="h-8 lg:h-10 w-auto object-contain"
            />
            <div className="hidden sm:block">
              <h1 className="text-base lg:text-lg font-semibold text-header-foreground">Konfigurator Basenów</h1>
              <p className="text-xs text-header-foreground/70">Profesjonalne wyceny i oferty</p>
            </div>
          </div>
          
          <nav className="flex items-center gap-1 lg:gap-2">
            {/* Notification Bell */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative text-header-foreground/80 hover:text-header-foreground hover:bg-header-foreground/10"
                >
                  <Bell className="w-4 h-4" />
                  {totalNotifications > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-xs font-bold rounded-full flex items-center justify-center">
                      {totalNotifications > 9 ? '9+' : totalNotifications}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold">Powiadomienia</h4>
                    {overdueCount > 0 && (
                      <span className="text-xs text-destructive font-medium">
                        {overdueCount} po terminie
                      </span>
                    )}
                  </div>
                  
                  {overdueOffers.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      Brak powiadomień
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {overdueOffers.map(offer => (
                        <div 
                          key={offer.id}
                          className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 cursor-pointer hover:bg-destructive/20 transition-colors"
                          onClick={() => navigate('/kolejka')}
                        >
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-destructive mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{offer.offerNumber}</p>
                              <p className="text-xs text-muted-foreground truncate">{offer.customerName}</p>
                              <p className="text-xs text-destructive">
                                Utworzona {format(new Date(offer.createdAt), 'dd MMM', { locale: pl })}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => navigate('/kolejka')}
                  >
                    <Clock className="w-4 h-4 mr-2" />
                    Zobacz kolejkę ({queueCount})
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/kolejka')}
              className="text-header-foreground/80 hover:text-header-foreground hover:bg-header-foreground/10"
            >
              <Clock className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">Kolejka</span>
              {queueCount > 0 && (
                <span className="ml-1 text-xs bg-primary/20 px-1.5 py-0.5 rounded">
                  {queueCount}
                </span>
              )}
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/historia')}
              className="text-header-foreground/80 hover:text-header-foreground hover:bg-header-foreground/10"
            >
              <History className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">Historia</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onNewOffer}
              className="text-header-foreground/80 hover:text-header-foreground hover:bg-header-foreground/10"
            >
              <FileText className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">Nowa oferta</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={onSettingsClick}
              className="text-header-foreground/80 hover:text-header-foreground hover:bg-header-foreground/10"
            >
              <Settings className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">Ustawienia</span>
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-header-foreground/80 hover:text-header-foreground hover:bg-header-foreground/10"
            >
              <LogOut className="w-4 h-4 lg:mr-2" />
              <span className="hidden lg:inline">Wyloguj</span>
            </Button>
          </nav>
        </div>
      </div>
    </header>
  );
}
