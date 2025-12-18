import { useState, useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Search, 
  Calendar, 
  Copy, 
  Eye, 
  Trash2,
  FileText,
  User,
  Phone,
  Mail
} from 'lucide-react';
import { SavedOffer, getOffers, searchOffers, deleteOffer } from '@/types/offers';
import { formatPrice } from '@/lib/calculations';
import { toast } from 'sonner';

interface OfferHistoryDialogProps {
  open: boolean;
  onClose: () => void;
  onViewOffer: (offer: SavedOffer) => void;
  onCopyOffer: (offer: SavedOffer) => void;
}

export function OfferHistoryDialog({ 
  open, 
  onClose, 
  onViewOffer, 
  onCopyOffer 
}: OfferHistoryDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [offers, setOffers] = useState<SavedOffer[]>(getOffers());

  const filteredOffers = useMemo(() => {
    return searchOffers(searchQuery);
  }, [searchQuery, offers]);

  const handleDelete = (id: string) => {
    if (confirm('Czy na pewno chcesz usunąć tę ofertę?')) {
      deleteOffer(id);
      setOffers(getOffers());
      toast.success('Oferta została usunięta');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-primary" />
            Historia ofert
          </DialogTitle>
        </DialogHeader>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po numerze, dacie, kliencie, email lub telefonie..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 input-field"
          />
        </div>

        <div className="flex-1 overflow-y-auto space-y-3">
          {filteredOffers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Brak zapisanych ofert</p>
              {searchQuery && (
                <p className="text-sm mt-1">Spróbuj zmienić kryteria wyszukiwania</p>
              )}
            </div>
          ) : (
            filteredOffers.map((offer) => (
              <div
                key={offer.id}
                className="glass-card p-4 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono text-sm bg-primary/20 text-primary px-2 py-0.5 rounded">
                        {offer.offerNumber}
                      </span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {formatDate(offer.createdAt)}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="w-4 h-4" />
                        <span className="truncate">{offer.customerData.contactPerson}</span>
                        {offer.customerData.companyName && (
                          <span className="text-xs">({offer.customerData.companyName})</span>
                        )}
                      </div>
                      
                      {offer.customerData.phone && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="w-4 h-4" />
                          <span>{offer.customerData.phone}</span>
                        </div>
                      )}
                      
                      {offer.customerData.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          <span className="truncate">{offer.customerData.email}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Basen: {offer.dimensions.length}×{offer.dimensions.width}m
                      </span>
                      <span className="font-semibold text-primary">
                        Brutto: {formatPrice(offer.totalGross)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewOffer(offer)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onCopyOffer(offer)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(offer.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="text-xs text-muted-foreground pt-4 border-t border-border">
          Łącznie: {filteredOffers.length} ofert
        </div>
      </DialogContent>
    </Dialog>
  );
}
