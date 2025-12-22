import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { useSettings } from '@/context/SettingsContext';
import { getQueueOffers, getOffersByStatus } from '@/lib/offerDb';
import { SavedOffer } from '@/types/offers';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { SettingsDialog } from '@/components/SettingsDialog';
import logo from '@/assets/logo.png';
import { 
  Plus, 
  Waves, 
  Sparkles, 
  Clock, 
  History, 
  ArrowRight, 
  Settings, 
  LogOut,
  AlertTriangle,
  Bell,
  FileText
} from 'lucide-react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { toast } from 'sonner';

export default function Dashboard() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { companySettings, excavationSettings, setCompanySettings, setExcavationSettings, isLoading } = useSettings();
  const [queueOffers, setQueueOffers] = useState<(SavedOffer & { shareUid: string })[]>([]);
  const [sentOffers, setSentOffers] = useState<(SavedOffer & { shareUid: string })[]>([]);
  const [overdueOffers, setOverdueOffers] = useState<{ id: string; offerNumber: string; customerName: string; createdAt: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  
  const dueDays = companySettings.dueDays || 3;

  useEffect(() => {
    const loadData = async () => {
      try {
        const [queue, sent] = await Promise.all([
          getQueueOffers(),
          getOffersByStatus('sent')
        ]);
        
        setQueueOffers(queue);
        setSentOffers(sent.slice(0, 5)); // Last 5 sent offers
        
        // Calculate overdue
        const now = new Date();
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() - dueDays);
        
        const overdue = queue
          .filter(o => new Date(o.createdAt) < dueDate)
          .slice(0, 5)
          .map(o => ({
            id: o.id,
            offerNumber: o.offerNumber,
            customerName: o.customerData.contactPerson,
            createdAt: o.createdAt,
          }));
        
        setOverdueOffers(overdue);
      } catch (error) {
        console.error('Error loading dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [dueDays]);

  const handleLogout = () => {
    logout();
    toast.success('Wylogowano');
    navigate('/login', { replace: true });
  };

  const handleSaveCompanySettings = async (settings: typeof companySettings) => {
    await setCompanySettings(settings);
  };

  const handleSaveExcavationSettings = async (settings: typeof excavationSettings) => {
    await setExcavationSettings(settings);
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd MMM yyyy', { locale: pl });
  };

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-muted-foreground">Ładowanie...</div>
      </div>
    );
  }

  const totalNotifications = overdueOffers.length;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
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
                <h1 className="text-base lg:text-lg font-semibold text-header-foreground">Panel Główny</h1>
                <p className="text-xs text-header-foreground/70">Pool Prestige - Konfigurator</p>
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
                      {overdueOffers.length > 0 && (
                        <span className="text-xs text-destructive font-medium">
                          {overdueOffers.length} po terminie
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
                      Zobacz kolejkę ({queueOffers.length})
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowSettings(true)}
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

      <main className="container mx-auto px-4 py-8">
        {/* New Offer Buttons */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Nowa oferta</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button
              onClick={() => navigate('/nowa-oferta')}
              className="h-auto py-6 text-lg flex items-center justify-center gap-3"
              size="lg"
            >
              <Waves className="w-6 h-6" />
              Nowa oferta - Basen
            </Button>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  disabled
                  variant="outline"
                  className="h-auto py-6 text-lg flex items-center justify-center gap-3 opacity-50"
                  size="lg"
                >
                  <Sparkles className="w-6 h-6" />
                  Nowa oferta - Wanny SPA
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Ta funkcja będzie dostępna wkrótce</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </section>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Queue Stats */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">Kolejka ofert</h3>
              </div>
              <span className="text-2xl font-bold text-primary">{queueOffers.length}</span>
            </div>
            
            {queueOffers.length > 0 ? (
              <div className="space-y-2 mb-4">
                {queueOffers.slice(0, 3).map(offer => (
                  <div 
                    key={offer.id}
                    className="p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => navigate(`/nowa-oferta?edit=${offer.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{offer.offerNumber}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {offer.customerData.contactPerson || 'Brak nazwy'}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(offer.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">Brak ofert w kolejce</p>
            )}
            
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => navigate('/kolejka')}
            >
              Zobacz wszystkie
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Card>

          {/* Overdue Stats */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-destructive" />
                <h3 className="font-semibold">Po terminie</h3>
              </div>
              <span className="text-2xl font-bold text-destructive">{overdueOffers.length}</span>
            </div>
            
            {overdueOffers.length > 0 ? (
              <div className="space-y-2 mb-4">
                {overdueOffers.slice(0, 3).map(offer => (
                  <div 
                    key={offer.id}
                    className="p-2 rounded-lg bg-destructive/10 border border-destructive/20 cursor-pointer hover:bg-destructive/20 transition-colors"
                    onClick={() => navigate('/kolejka')}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{offer.offerNumber}</p>
                        <p className="text-xs text-muted-foreground truncate">{offer.customerName}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">Wszystko na czas!</p>
            )}
            
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => navigate('/kolejka')}
            >
              Zobacz kolejkę
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Card>

          {/* Sent Offers */}
          <Card className="p-6 md:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-green-500" />
                <h3 className="font-semibold">Ostatnio wysłane</h3>
              </div>
              <span className="text-2xl font-bold text-green-500">{sentOffers.length > 0 ? sentOffers.length + '+' : '0'}</span>
            </div>
            
            {sentOffers.length > 0 ? (
              <div className="space-y-2 mb-4">
                {sentOffers.slice(0, 3).map(offer => (
                  <div 
                    key={offer.id}
                    className="p-2 rounded-lg bg-muted/50 hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => navigate(`/oferta/${offer.shareUid}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{offer.offerNumber}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {offer.customerData.contactPerson}
                        </p>
                      </div>
                      <p className="text-xs font-medium text-green-600">
                        {formatPrice(offer.totalGross)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">Brak wysłanych ofert</p>
            )}
            
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => navigate('/historia')}
            >
              Zobacz historię
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Card>
        </div>
      </main>

      <SettingsDialog
        open={showSettings}
        onClose={() => setShowSettings(false)}
        companySettings={companySettings}
        onSaveCompanySettings={handleSaveCompanySettings}
        excavationSettings={excavationSettings}
        onSaveExcavationSettings={handleSaveExcavationSettings}
      />
    </div>
  );
}
