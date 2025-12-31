import { useState, useEffect } from "react";
import { Bell, Settings, LogOut, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/context/AuthContext";
import { getQueueOffers } from "@/lib/offerDb";
import { useSettings } from "@/context/SettingsContext";
import { toast } from "sonner";

interface OverdueOffer {
  id: string;
  offerNumber: string;
  customerName: string;
  daysOverdue: number;
}

interface AppHeaderProps {
  onSettingsClick?: () => void;
}

export function AppHeader({ onSettingsClick }: AppHeaderProps) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { companySettings } = useSettings();
  const [overdueOffers, setOverdueOffers] = useState<OverdueOffer[]>([]);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const queueOffers = await getQueueOffers();
        const dueDays = companySettings?.dueDays || 7;
        const now = new Date();

        const overdue = queueOffers
          .filter((offer) => {
            const createdAt = new Date(offer.createdAt);
            const dueDate = new Date(createdAt);
            dueDate.setDate(dueDate.getDate() + dueDays);
            return now > dueDate;
          })
          .map((offer) => {
            const createdAt = new Date(offer.createdAt);
            const dueDate = new Date(createdAt);
            dueDate.setDate(dueDate.getDate() + dueDays);
            const daysOverdue = Math.floor(
              (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
            );

            return {
              id: offer.id,
              offerNumber: offer.offerNumber,
              customerName: offer.customerData?.contactPerson || "Nieznany klient",
              daysOverdue,
            };
          });

        setOverdueOffers(overdue);
      } catch (error) {
        console.error("Failed to fetch notifications:", error);
      }
    };

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
    return () => clearInterval(interval);
  }, [companySettings?.dueDays]);

  const handleLogout = async () => {
    await logout();
    toast.success("Wylogowano pomyślnie");
    navigate("/login");
  };

  const totalNotifications = overdueOffers.length;

  return (
    <header className="h-12 border-b border-border bg-card flex items-center justify-between px-4 shrink-0">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="h-8 w-8" />
      </div>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative h-8 w-8">
              <Bell className="h-4 w-4" />
              {totalNotifications > 0 && (
                <Badge 
                  variant="destructive" 
                  className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs"
                >
                  {totalNotifications}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Powiadomienia</h4>
              {overdueOffers.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Brak zaległych ofert
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {overdueOffers.slice(0, 5).map((offer) => (
                    <div
                      key={offer.id}
                      className="p-2 bg-destructive/10 rounded-lg cursor-pointer hover:bg-destructive/20 transition-colors"
                      onClick={() => navigate("/kolejka")}
                    >
                      <p className="text-sm font-medium">{offer.offerNumber}</p>
                      <p className="text-xs text-muted-foreground">
                        {offer.customerName} • {offer.daysOverdue} dni po terminie
                      </p>
                    </div>
                  ))}
                  {overdueOffers.length > 5 && (
                    <Button
                      variant="link"
                      className="w-full text-sm"
                      onClick={() => navigate("/kolejka")}
                    >
                      Zobacz wszystkie ({overdueOffers.length})
                    </Button>
                  )}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>

        {/* Account dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <User className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">Konto</p>
            </div>
            <DropdownMenuSeparator />
            {onSettingsClick && (
              <DropdownMenuItem onClick={onSettingsClick}>
                <Settings className="mr-2 h-4 w-4" />
                Ustawienia
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              Wyloguj
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
