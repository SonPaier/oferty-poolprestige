import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { 
  Search, 
  Calendar as CalendarIcon, 
  Copy, 
  Eye, 
  Trash2,
  FileText,
  User,
  Phone,
  Mail,
  Link2,
  ExternalLink,
  X,
  ArrowLeft,
  Package,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Filter,
  Pencil
} from 'lucide-react';
import { SavedOffer } from '@/types/offers';
import { getOffersFromDb, deleteOfferFromDb } from '@/lib/offerDb';
import { formatPrice } from '@/lib/calculations';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Header } from '@/components/Header';

type OfferWithShare = SavedOffer & { shareUid?: string };

const RESULTS_PER_PAGE_OPTIONS = [10, 15, 25, 50, 100];

export default function OfferHistory() {
  const navigate = useNavigate();
  
  // State
  const [offers, setOffers] = useState<OfferWithShare[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [productSearch, setProductSearch] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [resultsPerPage, setResultsPerPage] = useState(15);

  useEffect(() => {
    loadOffers();
  }, []);

  const loadOffers = async () => {
    setLoading(true);
    const dbOffers = await getOffersFromDb();
    setOffers(dbOffers);
    setLoading(false);
  };

  // All products from all offers for autocomplete
  const allProducts = useMemo(() => {
    const productSet = new Set<string>();
    offers.forEach(offer => {
      Object.values(offer.sections || {}).forEach(section => {
        (section.items || []).forEach((item: any) => {
          const name = item.product?.name || item.name;
          if (name) productSet.add(name);
        });
      });
    });
    return Array.from(productSet).sort();
  }, [offers]);

  // Filtered products for autocomplete dropdown
  const filteredProductSuggestions = useMemo(() => {
    if (!productSearch.trim()) return [];
    const lower = productSearch.toLowerCase();
    return allProducts.filter(p => p.toLowerCase().includes(lower)).slice(0, 10);
  }, [productSearch, allProducts]);

  // Filter offers
  const filteredOffers = useMemo(() => {
    let result = [...offers];
    
    // Text search
    if (searchQuery.trim()) {
      const lowerQuery = searchQuery.toLowerCase().trim();
      result = result.filter(offer => {
        const { customerData, offerNumber, createdAt } = offer;
        return (
          offerNumber.toLowerCase().includes(lowerQuery) ||
          customerData.contactPerson.toLowerCase().includes(lowerQuery) ||
          customerData.companyName?.toLowerCase().includes(lowerQuery) ||
          customerData.email?.toLowerCase().includes(lowerQuery) ||
          customerData.phone?.includes(lowerQuery) ||
          createdAt.includes(lowerQuery)
        );
      });
    }
    
    // Amount range
    if (minAmount) {
      const min = parseFloat(minAmount);
      if (!isNaN(min)) {
        result = result.filter(offer => offer.totalNet >= min);
      }
    }
    if (maxAmount) {
      const max = parseFloat(maxAmount);
      if (!isNaN(max)) {
        result = result.filter(offer => offer.totalNet <= max);
      }
    }
    
    // Date range
    if (dateFrom) {
      const fromTime = dateFrom.setHours(0, 0, 0, 0);
      result = result.filter(offer => {
        const offerTime = new Date(offer.createdAt).getTime();
        return offerTime >= fromTime;
      });
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      const toTime = toDate.getTime();
      result = result.filter(offer => {
        const offerTime = new Date(offer.createdAt).getTime();
        return offerTime <= toTime;
      });
    }
    
    // Product search
    if (productSearch.trim()) {
      const lowerProduct = productSearch.toLowerCase().trim();
      result = result.filter(offer => {
        return Object.values(offer.sections || {}).some(section => 
          (section.items || []).some((item: any) => {
            const name = item.product?.name || item.name;
            return name?.toLowerCase().includes(lowerProduct);
          })
        );
      });
    }
    
    return result;
  }, [offers, searchQuery, minAmount, maxAmount, dateFrom, dateTo, productSearch]);

  // Summary stats (for all filtered, not just current page)
  const totalFilteredCount = filteredOffers.length;
  const totalFilteredNetAmount = useMemo(() => {
    return filteredOffers.reduce((sum, offer) => sum + (offer.totalNet || 0), 0);
  }, [filteredOffers]);

  // Pagination
  const totalPages = Math.ceil(filteredOffers.length / resultsPerPage);
  const paginatedOffers = useMemo(() => {
    const startIndex = (currentPage - 1) * resultsPerPage;
    return filteredOffers.slice(startIndex, startIndex + resultsPerPage);
  }, [filteredOffers, currentPage, resultsPerPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, minAmount, maxAmount, dateFrom, dateTo, productSearch, resultsPerPage]);

  const handleDelete = async (id: string) => {
    if (confirm('Czy na pewno chcesz usunąć tę ofertę?')) {
      const success = await deleteOfferFromDb(id);
      if (success) {
        await loadOffers();
        toast.success('Oferta została usunięta');
      } else {
        toast.error('Błąd usuwania oferty');
      }
    }
  };

  const copyOfferLink = (shareUid: string) => {
    const url = `${window.location.origin}/oferta/${shareUid}`;
    navigator.clipboard.writeText(url);
    toast.success('Link skopiowany do schowka');
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

  const clearFilters = () => {
    setSearchQuery('');
    setMinAmount('');
    setMaxAmount('');
    setDateFrom(undefined);
    setDateTo(undefined);
    setProductSearch('');
  };

  const hasActiveFilters = searchQuery || minAmount || maxAmount || dateFrom || dateTo || productSearch;

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <main className="container mx-auto px-4 py-6 space-y-6">
        {/* Filters */}
        <div className="glass-card p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
            <Filter className="w-4 h-4" />
            Filtry
            {hasActiveFilters && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={clearFilters}
                className="text-xs h-6 px-2 ml-auto"
              >
                <X className="w-3 h-3 mr-1" />
                Wyczyść filtry
              </Button>
            )}
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Text search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Numer, klient, email, telefon..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 input-field"
              />
            </div>

            {/* Amount range */}
            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Kwota od (netto)"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="input-field"
              />
              <Input
                type="number"
                placeholder="Kwota do (netto)"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="input-field"
              />
            </div>

            {/* Date range */}
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !dateFrom && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateFrom ? format(dateFrom, "dd.MM.yyyy") : "Data od"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateFrom}
                    onSelect={setDateFrom}
                    locale={pl}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "flex-1 justify-start text-left font-normal",
                      !dateTo && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateTo ? format(dateTo, "dd.MM.yyyy") : "Data do"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dateTo}
                    onSelect={setDateTo}
                    locale={pl}
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Product search */}
            <div className="relative md:col-span-2 lg:col-span-3">
              <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj ofert zawierających produkt..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="pl-10 input-field"
              />
              {filteredProductSuggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                  {filteredProductSuggestions.map((product, i) => (
                    <button
                      key={i}
                      onClick={() => setProductSearch(product)}
                      className="w-full px-3 py-2 text-left text-sm hover:bg-muted/50 transition-colors"
                    >
                      {product}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Summary bar */}
        <div className="glass-card p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <div className="text-sm">
              <span className="text-muted-foreground">Liczba wyników:</span>
              <span className="font-semibold ml-2">{totalFilteredCount}</span>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Suma netto:</span>
              <span className="font-semibold text-primary ml-2">{formatPrice(totalFilteredNetAmount)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Wyników na stronę:</span>
            <Select
              value={resultsPerPage.toString()}
              onValueChange={(value) => setResultsPerPage(parseInt(value))}
            >
              <SelectTrigger className="w-20 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESULTS_PER_PAGE_OPTIONS.map(option => (
                  <SelectItem key={option} value={option.toString()}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results */}
        <div className="space-y-3">
          {loading ? (
            <div className="text-center py-12 text-muted-foreground">
              Ładowanie...
            </div>
          ) : paginatedOffers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Brak ofert spełniających kryteria</p>
              {hasActiveFilters && (
                <Button 
                  variant="link" 
                  onClick={clearFilters}
                  className="mt-2"
                >
                  Wyczyść filtry
                </Button>
              )}
            </div>
          ) : (
            paginatedOffers.map((offer) => (
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
                        <CalendarIcon className="w-3 h-3" />
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
                          <a 
                            href={`tel:${offer.customerData.phone}`}
                            className="hover:text-primary transition-colors"
                          >
                            {offer.customerData.phone}
                          </a>
                        </div>
                      )}
                      
                      {offer.customerData.email && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Mail className="w-4 h-4" />
                          <a 
                            href={`mailto:${offer.customerData.email}`}
                            className="truncate hover:text-primary transition-colors"
                          >
                            {offer.customerData.email}
                          </a>
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex items-center gap-4 text-sm">
                      <span className="text-muted-foreground">
                        Basen: {offer.dimensions.length}×{offer.dimensions.width}m
                      </span>
                      <span className="text-muted-foreground">
                        Netto: {formatPrice(offer.totalNet)}
                      </span>
                      <span className="font-semibold text-primary">
                        Brutto: {formatPrice(offer.totalGross)}
                      </span>
                    </div>

                    {offer.shareUid && (
                      <div className="mt-2 flex items-center gap-2">
                        <Link2 className="w-3 h-3 text-muted-foreground" />
                        <a 
                          href={`/oferta/${offer.shareUid}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          Podgląd online <ExternalLink className="w-3 h-3" />
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => copyOfferLink(offer.shareUid!)}
                        >
                          Kopiuj link
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/nowa-oferta?edit=${offer.id}`)}
                      className="text-primary hover:text-primary"
                      title="Edytuj ofertę"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/oferta/${offer.shareUid}`)}
                      className="text-muted-foreground hover:text-foreground"
                      title="Zobacz ofertę"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(offer.id)}
                      className="text-muted-foreground hover:text-destructive"
                      title="Usuń ofertę"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
            >
              <ChevronsLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            
            <div className="flex items-center gap-1 px-2">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="w-8 h-8 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
            >
              <ChevronsRight className="w-4 h-4" />
            </Button>
            
            <span className="text-sm text-muted-foreground ml-2">
              Strona {currentPage} z {totalPages}
            </span>
          </div>
        )}
      </main>
    </div>
  );
}
