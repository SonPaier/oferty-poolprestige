import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { SettingsDialog } from '@/components/SettingsDialog';
import { useSettings } from '@/context/SettingsContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Clock, 
  AlertTriangle, 
  Search, 
  ArrowLeft,
  FileText,
  Trash2,
  Loader2,
  CheckCircle,
  Pencil,
  RefreshCw
} from 'lucide-react';
import { getQueueOffers, updateOfferStatus, deleteOfferFromDb } from '@/lib/offerDb';
import { SavedOffer, OfferStatus } from '@/types/offers';
import { formatPrice } from '@/lib/calculations';
import { toast } from 'sonner';
import { format, differenceInDays } from 'date-fns';
import { pl } from 'date-fns/locale';

function getStatusBadge(status: OfferStatus) {
  switch (status) {
    case 'queue':
      return <Badge variant="secondary" className="bg-blue-500/20 text-blue-400 border-blue-500/30">W kolejce</Badge>;
    case 'draft':
      return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Draft</Badge>;
    case 'sent':
      return <Badge variant="secondary" className="bg-green-500/20 text-green-400 border-green-500/30">Wysłana</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function getDueDateInfo(createdAt: string, dueDays: number) {
  const created = new Date(createdAt);
  const dueDate = new Date(created);
  dueDate.setDate(dueDate.getDate() + dueDays);
  
  const now = new Date();
  const daysUntilDue = differenceInDays(dueDate, now);
  const isOverdue = now > dueDate;
  
  return {
    dueDate,
    daysUntilDue,
    isOverdue,
  };
}

export default function OfferQueue() {
  const navigate = useNavigate();
  const { companySettings, excavationSettings, setCompanySettings, setExcavationSettings } = useSettings();
  const [offers, setOffers] = useState<(SavedOffer & { shareUid: string })[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<(SavedOffer & { shareUid: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [settingsOpen, setSettingsOpen] = useState(false);

  const fetchOffers = async () => {
    setIsLoading(true);
    const data = await getQueueOffers();
    setOffers(data);
    setFilteredOffers(data);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOffers();
  }, []);

  useEffect(() => {
    let result = [...offers];
    
    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(o => o.status === statusFilter);
    }
    
    // Filter by search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(o => 
        o.offerNumber.toLowerCase().includes(query) ||
        o.customerData.contactPerson.toLowerCase().includes(query) ||
        o.customerData.companyName?.toLowerCase().includes(query) ||
        o.customerData.email?.toLowerCase().includes(query)
      );
    }
    
    setFilteredOffers(result);
  }, [offers, statusFilter, searchQuery]);

  const handleStatusChange = async (offerId: string, newStatus: OfferStatus) => {
    const success = await updateOfferStatus(offerId, newStatus);
    if (success) {
      if (newStatus === 'sent') {
        // Remove from queue view
        setOffers(prev => prev.filter(o => o.id !== offerId));
        toast.success('Oferta oznaczona jako wysłana');
      } else {
        setOffers(prev => prev.map(o => 
          o.id === offerId ? { ...o, status: newStatus } : o
        ));
        toast.success(`Status zmieniony na: ${newStatus === 'draft' ? 'Draft' : 'W kolejce'}`);
      }
    } else {
      toast.error('Błąd zmiany statusu');
    }
  };

  const handleDelete = async (offerId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć tę ofertę?')) return;
    
    const success = await deleteOfferFromDb(offerId);
    if (success) {
      setOffers(prev => prev.filter(o => o.id !== offerId));
      toast.success('Oferta usunięta');
    } else {
      toast.error('Błąd usuwania oferty');
    }
  };

  const dueDays = companySettings.dueDays || 3;
  const overdueCount = offers.filter(o => getDueDateInfo(o.createdAt, dueDays).isOverdue).length;

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 lg:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Clock className="w-6 h-6 text-primary" />
              Kolejka ofert
            </h1>
            <p className="text-sm text-muted-foreground">
              Oferty oczekujące na wysłanie
            </p>
          </div>
          
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 px-4 py-2 bg-destructive/10 border border-destructive/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <span className="text-destructive font-medium">
                {overdueCount} {overdueCount === 1 ? 'oferta po terminie' : 'ofert po terminie'}
              </span>
            </div>
          )}
        </div>

        {/* Filters */}
        <div className="glass-card p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Szukaj po numerze, kliencie, email..."
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Wszystkie</SelectItem>
                <SelectItem value="queue">W kolejce</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <div className="glass-card overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : filteredOffers.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Brak ofert w kolejce</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nr oferty</TableHead>
                  <TableHead>Klient</TableHead>
                  <TableHead>Data zapytania</TableHead>
                  <TableHead>Termin</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Wartość</TableHead>
                  <TableHead className="text-right">Akcje</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredOffers.map((offer) => {
                  const { dueDate, daysUntilDue, isOverdue } = getDueDateInfo(offer.createdAt, dueDays);
                  
                  const visitedKey = 'poolprestige.visitedOffers.v1';
                  let isNew = false;
                  try {
                    const visited = JSON.parse(localStorage.getItem(visitedKey) || '[]') as string[];
                    isNew = !visited.includes(offer.id);
                  } catch {
                    isNew = true;
                  }

                  const markVisited = () => {
                    try {
                      const visited = JSON.parse(localStorage.getItem(visitedKey) || '[]') as string[];
                      const next = Array.from(new Set([...visited, offer.id]));
                      localStorage.setItem(visitedKey, JSON.stringify(next));
                    } catch {
                      localStorage.setItem(visitedKey, JSON.stringify([offer.id]));
                    }
                  };

                  return (
                    <TableRow 
                      key={offer.id}
                      className={isOverdue ? 'bg-destructive/5 hover:bg-destructive/10' : ''}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {isOverdue && (
                            <AlertTriangle className="w-4 h-4 text-destructive" />
                          )}
                          <span>{offer.offerNumber}</span>
                          {isNew && (
                            <Badge 
                              variant="secondary" 
                              className="bg-primary/15 text-primary border border-primary/30"
                            >
                              Nowa
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{offer.customerData.contactPerson}</p>
                          {offer.customerData.companyName && (
                            <p className="text-xs text-muted-foreground">{offer.customerData.companyName}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(new Date(offer.createdAt), 'dd MMM yyyy, HH:mm', { locale: pl })}
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-2 ${isOverdue ? 'text-destructive' : daysUntilDue <= 1 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                          <Clock className="w-4 h-4" />
                          <span>
                            {isOverdue 
                              ? `${Math.abs(daysUntilDue)} dni temu`
                              : daysUntilDue === 0 
                                ? 'Dzisiaj'
                                : `Za ${daysUntilDue} dni`
                            }
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(offer.status)}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatPrice(offer.totalGross)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              markVisited();
                              navigate(`/nowa-oferta?edit=${offer.id}`);
                            }}
                            title="Edytuj ofertę"
                            className="text-primary hover:text-primary"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              markVisited();
                              navigate(`/oferta/${offer.shareUid}`);
                            }}
                            title="Podgląd"
                          >
                            <FileText className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStatusChange(offer.id, offer.status === 'draft' ? 'queue' : 'draft')}
                            title={offer.status === 'draft' ? 'Przenieś do kolejki' : 'Zapisz jako draft'}
                          >
                            <RefreshCw className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleStatusChange(offer.id, 'sent')}
                            title="Oznacz jako wysłaną"
                            className="text-green-500 hover:text-green-400"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDelete(offer.id)}
                            title="Usuń"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}

              </TableBody>
            </Table>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 p-4 glass-card">
          <h3 className="text-sm font-medium mb-3">Legenda statusów:</h3>
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              {getStatusBadge('queue')}
              <span className="text-muted-foreground">- Nowe zapytanie z maila</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge('draft')}
              <span className="text-muted-foreground">- W trakcie przygotowania</span>
            </div>
            <div className="flex items-center gap-2">
              {getStatusBadge('sent')}
              <span className="text-muted-foreground">- Wysłana do klienta</span>
            </div>
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-muted-foreground">- Po terminie ({dueDays} dni)</span>
            </div>
          </div>
        </div>
      </main>

      <SettingsDialog 
        open={settingsOpen} 
        onClose={() => setSettingsOpen(false)}
        companySettings={companySettings}
        onSaveCompanySettings={setCompanySettings}
        excavationSettings={excavationSettings}
        onSaveExcavationSettings={setExcavationSettings}
      />
    </div>
  );
}
