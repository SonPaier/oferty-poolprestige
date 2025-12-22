import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { getOfferByShareUid } from '@/lib/offerDb';
import { SavedOffer } from '@/types/offers';
import { OfferItem } from '@/types/configurator';
import { formatPrice } from '@/lib/calculations';
import { getPriceInPLN } from '@/data/products';
import { 
  ChevronDown, 
  ChevronUp, 
  Package,
  Ruler,
  Mail,
  Phone,
  User,
  Building2,
  Loader2
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface OfferWithShareUid extends SavedOffer {
  shareUid: string;
}

// Extended item interface for INNE section items stored in DB
interface InneItemData {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  isCustom?: boolean;
  isOptional?: boolean;
  description?: string;
}

// Unified item for display
interface DisplayItem {
  id: string;
  name: string;
  symbol?: string;
  description?: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  discount: number;
  isOptional: boolean;
}

const sectionLabels: Record<string, string> = {
  foil: 'Folia',
  filtration: 'Filtracja',
  equipment: 'Wyposażenie',
  lighting: 'Oświetlenie',
  additions: 'Dodatki',
  automation: 'Automatyka',
  inne: 'Inne',
  wykonczenie: 'Wykończenie',
  uzbrojenie: 'Uzbrojenie',
  oswietlenie: 'Oświetlenie',
  atrakcje: 'Atrakcje',
  dodatki: 'Dodatki',
};

// Helper to convert OfferItem or InneItemData to DisplayItem
function toDisplayItem(item: OfferItem | InneItemData, index: number): DisplayItem {
  // Check if it's an InneItemData (has name directly)
  if ('name' in item && typeof item.name === 'string' && !('product' in item)) {
    const inneItem = item as InneItemData;
    return {
      id: inneItem.id || `inne-${index}`,
      name: inneItem.name,
      description: inneItem.description,
      quantity: inneItem.quantity || 1,
      unit: inneItem.unit || 'szt',
      unitPrice: inneItem.unitPrice || 0,
      discount: inneItem.discount || 0,
      isOptional: inneItem.isOptional || false,
    };
  }
  
  // It's an OfferItem with product
  const offerItem = item as OfferItem;
  const product = offerItem.product;
  const price = offerItem.customPrice ?? getPriceInPLN(product);
  
  return {
    id: offerItem.id,
    name: product?.name || 'Produkt',
    symbol: product?.symbol,
    description: product?.description,
    quantity: offerItem.quantity || 1,
    unit: 'szt',
    unitPrice: price,
    discount: 0,
    isOptional: false,
  };
}

export default function OfferView() {
  const { shareUid } = useParams<{ shareUid: string }>();
  const [offer, setOffer] = useState<OfferWithShareUid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [optionalSelections, setOptionalSelections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loadOffer = async () => {
      if (!shareUid) {
        setError('Brak identyfikatora oferty');
        setLoading(false);
        return;
      }

      try {
        const data = await getOfferByShareUid(shareUid);
        if (data) {
          setOffer(data);
          // Initialize optional selections
          const initialSelections: Record<string, boolean> = {};
          Object.entries(data.sections).forEach(([sectionKey, section]) => {
            const items = section.items || [];
            items.forEach((item: OfferItem | InneItemData, idx: number) => {
              const displayItem = toDisplayItem(item, idx);
              if (displayItem.isOptional) {
                initialSelections[`${sectionKey}-${idx}`] = false;
              }
            });
          });
          setOptionalSelections(initialSelections);
        } else {
          setError('Nie znaleziono oferty');
        }
      } catch (err) {
        console.error('Error loading offer:', err);
        setError('Błąd ładowania oferty');
      } finally {
        setLoading(false);
      }
    };

    loadOffer();
  }, [shareUid]);

  const toggleExpanded = (key: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const toggleOptionalSelection = (key: string) => {
    setOptionalSelections(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Calculate total with optional selections
  const calculatedTotals = useMemo(() => {
    if (!offer) return { net: 0, gross: 0 };

    let totalNet = 0;
    
    // Add excavation
    totalNet += offer.excavation.excavationTotal + offer.excavation.removalFixedPrice;

    // Add sections
    Object.entries(offer.sections).forEach(([sectionKey, section]) => {
      const items = section.items || [];
      items.forEach((item: OfferItem | InneItemData, idx: number) => {
        const displayItem = toDisplayItem(item, idx);
        const itemKey = `${sectionKey}-${idx}`;
        
        // Skip optional items that are not selected
        if (displayItem.isOptional && !optionalSelections[itemKey]) {
          return;
        }

        const itemTotal = displayItem.unitPrice * displayItem.quantity;
        const discount = displayItem.discount || 0;
        const afterDiscount = itemTotal * (discount / 100); // discount is percentage to pay (100 = full price)
        totalNet += afterDiscount;
      });
    });

    return {
      net: totalNet,
      gross: totalNet * 1.23
    };
  }, [offer, optionalSelections]);

  const renderItemDetails = (displayItem: DisplayItem) => {
    const description = displayItem.description || 'Szczegółowy opis produktu będzie dostępny wkrótce.';
    
    return (
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="prose prose-sm max-w-none text-muted-foreground">
          <p>{description}</p>
        </div>
        {/* Placeholder for future youtube videos and images */}
        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm">
            Zdjęcie produktu
          </div>
          <div className="aspect-video bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm">
            Film produktu
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
          <p className="text-muted-foreground">Ładowanie oferty...</p>
        </div>
      </div>
    );
  }

  if (error || !offer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h2 className="text-xl font-semibold mb-2">Oferta niedostępna</h2>
            <p className="text-muted-foreground">{error || 'Nie znaleziono oferty'}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img 
                src="/logo.png" 
                alt="Pool Prestige" 
                className="h-10 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
              <div>
                <h1 className="text-lg font-semibold">
                  Oferta {offer.offerNumber}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {new Date(offer.createdAt).toLocaleDateString('pl-PL', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
            
            <div className="hidden md:flex items-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{offer.customerData.contactPerson}</span>
              </div>
              {offer.customerData.companyName && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span>{offer.customerData.companyName}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 pt-24 pb-32">
        {/* Customer Info for Mobile */}
        <Card className="mb-6 md:hidden">
          <CardContent className="pt-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                <span>{offer.customerData.contactPerson}</span>
              </div>
              {offer.customerData.companyName && (
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span>{offer.customerData.companyName}</span>
                </div>
              )}
              {offer.customerData.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="truncate">{offer.customerData.email}</span>
                </div>
              )}
              {offer.customerData.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span>{offer.customerData.phone}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pool Dimensions */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Ruler className="w-5 h-5 text-primary" />
              Parametry basenu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{offer.dimensions.length}m</p>
                <p className="text-xs text-muted-foreground">Długość</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{offer.dimensions.width}m</p>
                <p className="text-xs text-muted-foreground">Szerokość</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{offer.dimensions.depth}m</p>
                <p className="text-xs text-muted-foreground">Głębokość</p>
              </div>
            </div>
            <p className="text-center mt-3 text-sm text-muted-foreground">
              Typ basenu: <span className="font-medium text-foreground">{offer.poolType}</span>
            </p>
          </CardContent>
        </Card>

        {/* Excavation */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Wykopy i wywóz</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Wykopy ({offer.excavation.excavationVolume.toFixed(1)} m³)</span>
                <span className="font-medium">{formatPrice(offer.excavation.excavationTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Wywóz ziemi</span>
                <span className="font-medium">{formatPrice(offer.excavation.removalFixedPrice)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Sections */}
        {Object.entries(offer.sections).map(([sectionKey, section]) => {
          const items = section.items || [];
          if (items.length === 0) return null;
          
          return (
            <Card key={sectionKey} className="mb-6">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  {sectionLabels[sectionKey] || sectionKey}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map((item: OfferItem | InneItemData, idx: number) => {
                  const displayItem = toDisplayItem(item, idx);
                  const itemKey = `${sectionKey}-${idx}`;
                  const isExpanded = expandedItems.has(itemKey);
                  const isOptional = displayItem.isOptional;
                  const isSelected = !isOptional || optionalSelections[itemKey];
                  
                  const itemTotal = displayItem.unitPrice * displayItem.quantity;
                  const discount = displayItem.discount || 100;
                  const afterDiscount = itemTotal * (discount / 100);

                  return (
                    <div 
                      key={idx} 
                      className={`border rounded-lg p-4 transition-all ${
                        isOptional 
                          ? isSelected 
                            ? 'border-primary/50 bg-primary/5' 
                            : 'border-dashed border-muted-foreground/30 bg-muted/30 opacity-75'
                          : 'border-border'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {isOptional && (
                          <div className="pt-1">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleOptionalSelection(itemKey)}
                              className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                            />
                          </div>
                        )}
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className={`font-medium ${!isSelected && isOptional ? 'text-muted-foreground' : ''}`}>
                                {displayItem.name}
                                {isOptional && (
                                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-600">
                                    Opcjonalne
                                  </span>
                                )}
                              </h4>
                              {displayItem.symbol && (
                                <p className="text-xs text-muted-foreground font-mono">
                                  {displayItem.symbol}
                                </p>
                              )}
                            </div>
                            <p className={`font-semibold whitespace-nowrap ${!isSelected && isOptional ? 'text-muted-foreground' : 'text-primary'}`}>
                              {formatPrice(afterDiscount)}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                            <span>{displayItem.quantity} {displayItem.unit}</span>
                            <span>×</span>
                            <span>{formatPrice(displayItem.unitPrice)}</span>
                            {discount < 100 && (
                              <span className="text-green-600">-{100 - discount}%</span>
                            )}
                          </div>

                          <Collapsible open={isExpanded} onOpenChange={() => toggleExpanded(itemKey)}>
                            <CollapsibleTrigger className="flex items-center gap-1 mt-3 text-sm text-primary hover:underline">
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="w-4 h-4" />
                                  Ukryj szczegóły
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="w-4 h-4" />
                                  Zobacz szczegóły
                                </>
                              )}
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                              {renderItemDetails(displayItem)}
                            </CollapsibleContent>
                          </Collapsible>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </main>

      {/* Fixed Footer with Total */}
      <footer className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Suma netto</p>
              <p className="text-lg font-semibold">{formatPrice(calculatedTotals.net)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Suma brutto (23% VAT)</p>
              <p className="text-2xl font-bold text-primary">{formatPrice(calculatedTotals.gross)}</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
