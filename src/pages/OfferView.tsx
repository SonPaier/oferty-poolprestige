import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOfferByShareUid } from '@/lib/offerDb';
import { getSettingsFromDb } from '@/lib/settingsDb';
import { SavedOffer } from '@/types/offers';
import { OfferItem, poolTypeLabels, PoolType, PoolCalculations, CompanySettings } from '@/types/configurator';
import { formatPrice, calculatePoolMetrics } from '@/lib/calculations';
import { getPriceInPLN } from '@/data/products';
import { useAuth } from '@/context/AuthContext';
import logo from '@/assets/logo.png';
import { 
  ChevronDown, 
  ChevronUp, 
  Package,
  Ruler,
  Mail,
  Phone,
  User,
  Building2,
  Loader2,
  MapPin,
  Pencil,
  Copy,
  ArrowLeft,
  FileDown,
  Facebook,
  Instagram
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Pool3DVisualization } from '@/components/Pool3DVisualization';
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

// Optional item from "opcje" section
interface OptionalItemData {
  name: string;
  quantity: number;
  priceDifference: number;
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
  discount: number; // 100 = full price, 50 = 50% of price
  isOptional: boolean;
}

const sectionLabels: Record<string, string> = {
  foil: 'Folia',
  filtration: 'Filtracja',
  equipment: 'Wyposażenie',
  lighting: 'Oświetlenie',
  additions: 'Dodatki',
  automation: 'Automatyka',
  automatyka: 'Automatyka',
  inne: 'Inne',
  wykonczenie: 'Wykończenie',
  uzbrojenie: 'Uzbrojenie',
  oswietlenie: 'Oświetlenie',
  atrakcje: 'Atrakcje',
  dodatki: 'Dodatki',
  filtracja: 'Filtracja',
};

// Capitalize first letter of each word
function capitalize(text: string): string {
  if (!text) return text;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Helper to convert OfferItem or InneItemData to DisplayItem
function toDisplayItem(item: OfferItem | InneItemData, index: number): DisplayItem {
  // Check if it's an InneItemData (has name directly and no product)
  if ('name' in item && typeof item.name === 'string' && !('product' in item)) {
    const inneItem = item as InneItemData;
    return {
      id: inneItem.id || `inne-${index}`,
      name: inneItem.name,
      description: inneItem.description,
      quantity: inneItem.quantity || 1,
      unit: inneItem.unit || 'szt',
      unitPrice: inneItem.unitPrice || 0,
      discount: inneItem.discount ?? 100, // Default to 100 (full price)
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
    discount: 100, // OfferItems have full price (discount applied separately if needed)
    isOptional: false,
  };
}

export default function OfferView() {
  const { shareUid } = useParams<{ shareUid: string }>();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [offer, setOffer] = useState<OfferWithShareUid | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [optionalSelections, setOptionalSelections] = useState<Record<string, boolean>>({});
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

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
          // Initialize optional selections - all unchecked by default
          const initialSelections: Record<string, boolean> = {};
          // Check opcje section
          const opcjeItems = (data.sections as any)?.opcje?.items || [];
          opcjeItems.forEach((_: any, idx: number) => {
            initialSelections[`opcje-${idx}`] = false;
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

  const base64ToBlob = (base64: string, mimeType: string): Blob => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mimeType });
  };

  const handleDownloadPDF = async () => {
    if (!offer) return;
    
    setIsGeneratingPDF(true);
    try {
      // Load company settings from database
      const settings = await getSettingsFromDb();
      const companySettings = settings?.companySettings;
      
      if (!companySettings) {
        toast.error('Brak ustawień firmy', {
          description: 'Skonfiguruj ustawienia firmy w panelu administracyjnym',
        });
        return;
      }
      
      // Load logo as base64
      let logoBase64: string | undefined;
      try {
        const response = await fetch(logo);
        const blob = await response.blob();
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
      } catch (e) {
        console.warn('Could not load logo:', e);
      }
      
      const vatRate = 0.23;
      
      // Calculate pool metrics from offer data
      const poolParams = {
        type: poolTypeLabels[offer.poolType as PoolType] || offer.poolType,
        length: offer.dimensions?.length || 8,
        width: offer.dimensions?.width || 4,
        depth: offer.dimensions?.depth || 1.5,
        volume: offer.calculations?.volume || (offer.dimensions?.length || 8) * (offer.dimensions?.width || 4) * (offer.dimensions?.depth || 1.5),
        requiredFlow: offer.calculations?.requiredFlow || 0,
        isIrregular: offer.dimensions?.isIrregular || false,
        irregularSurcharge: companySettings.irregularSurchargePercent || 0,
        overflowType: offer.dimensions?.overflowType,
      };
      
      // Prepare sections for PDF in the format expected by edge function
      const sectionsForPdf: Array<{ name: string; items: Array<{
        product: { name: string; symbol: string };
        quantity: number;
        unitPrice: number;
        discount: number;
      }> }> = [];
      
      Object.entries(offer.sections).forEach(([key, section]) => {
        if (key === 'opcje') return;
        
        const sectionData = section as { name?: string; items?: any[] };
        const items = sectionData.items || [];
        if (items.length === 0) return;
        
        sectionsForPdf.push({
          name: sectionData.name || sectionLabels[key] || key,
          items: items.map((item: any, idx: number) => {
            const displayItem = toDisplayItem(item, idx);
            return {
              product: {
                name: displayItem.name,
                symbol: displayItem.symbol || '',
              },
              quantity: displayItem.quantity,
              unitPrice: displayItem.unitPrice,
              discount: displayItem.discount,
            };
          }),
        });
      });
      
      // Prepare inne items
      const inneSection = (offer.sections as any)?.inne;
      const inneItems = inneSection?.items?.map((item: any) => ({
        name: item.name || '',
        unit: item.unit || 'szt',
        quantity: item.quantity || 1,
        unitPrice: item.unitPrice || 0,
        discount: item.discount || 100,
      })) || [];
      
      const pdfData = {
        offerNumber: offer.offerNumber,
        companySettings: {
          ...companySettings,
          logoBase64: logoBase64 || undefined,
        },
        customerData: {
          companyName: offer.customerData.companyName || '',
          contactPerson: offer.customerData.contactPerson,
          email: offer.customerData.email || '',
          phone: offer.customerData.phone || '',
          address: offer.customerData.address || '',
          city: offer.customerData.city || '',
          postalCode: offer.customerData.postalCode || '',
          nip: offer.customerData.nip || '',
        },
        poolParams,
        sections: sectionsForPdf,
        inneItems,
        excavation: {
          volume: offer.excavation?.excavationVolume || 0,
          pricePerM3: offer.excavation?.excavationPricePerM3 || 0,
          excavationTotal: offer.excavation?.excavationTotal || 0,
          removalFixedPrice: offer.excavation?.removalFixedPrice || 0,
        },
        totals: {
          productsTotal: calculatedTotals.net - (offer.excavation?.excavationTotal || 0) - (offer.excavation?.removalFixedPrice || 0),
          inneTotal: 0,
          excavationTotal: (offer.excavation?.excavationTotal || 0) + (offer.excavation?.removalFixedPrice || 0),
          grandTotalNet: calculatedTotals.net,
          vatRate: vatRate * 100,
          vatAmount: calculatedTotals.net * vatRate,
          grandTotalGross: calculatedTotals.gross,
        },
        notes: '',
        paymentTerms: 30,
      };
      
      const { data, error } = await supabase.functions.invoke('generate-pdf', {
        body: pdfData,
      });
      
      if (error) {
        console.error('PDF generation error:', error);
        toast.error('Błąd generowania PDF');
        return;
      }
      
      const pdfBase64 = (data as any)?.pdfBase64;
      const filename = (data as any)?.filename;
      
      if (!pdfBase64) {
        toast.error('Błąd generowania PDF');
        return;
      }
      
      const pdfBlob = base64ToBlob(pdfBase64, 'application/pdf');
      const url = URL.createObjectURL(pdfBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = filename || `Oferta_${offer.offerNumber.replace(/\//g, '-')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('PDF pobrany');
    } catch (err) {
      console.error('PDF download error:', err);
      toast.error('Błąd pobierania PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  // Calculate total with optional selections
  const calculatedTotals = useMemo(() => {
    if (!offer) return { net: 0, gross: 0 };

    let totalNet = 0;
    
    // Add excavation
    totalNet += offer.excavation.excavationTotal + offer.excavation.removalFixedPrice;

    // Add sections (except opcje which are optional)
    Object.entries(offer.sections).forEach(([sectionKey, section]) => {
      if (sectionKey === 'opcje') return; // Handle opcje separately
      
      const items = section.items || [];
      items.forEach((item: OfferItem | InneItemData, idx: number) => {
        const displayItem = toDisplayItem(item, idx);
        const itemTotal = displayItem.unitPrice * displayItem.quantity;
        const discount = displayItem.discount || 100;
        const afterDiscount = itemTotal * (discount / 100);
        totalNet += afterDiscount;
      });
    });

    // Add selected optional items (opcje)
    const opcjeItems = (offer.sections as any)?.opcje?.items || [];
    opcjeItems.forEach((item: OptionalItemData, idx: number) => {
      const itemKey = `opcje-${idx}`;
      if (optionalSelections[itemKey]) {
        totalNet += item.priceDifference;
      }
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

  // Get optional items for rendering at the end
  const opcjeItems: OptionalItemData[] = (offer.sections as any)?.opcje?.items || [];

  // Get pool type label with proper polish characters
  const poolTypeLabel = poolTypeLabels[offer.poolType as PoolType] || offer.poolType;

  return (
    <div className="min-h-screen bg-background">
      {/* Fixed Header - same style as configurator */}
      <header className="fixed top-0 left-0 right-0 z-[100] bg-header border-b border-header/80 shadow-lg">
        <div className="container mx-auto px-4 lg:px-6 py-3 lg:py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Left: Offer info */}
            <div>
              <h1 className="text-base lg:text-lg font-semibold text-header-foreground">
                Oferta {offer.offerNumber}
              </h1>
              <p className="text-xs text-header-foreground/70">
                {new Date(offer.createdAt).toLocaleDateString('pl-PL', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                })}
              </p>
            </div>
            
            {/* Desktop: Customer data in 2 rows */}
            <div className="hidden lg:flex flex-col items-end gap-1 text-sm text-header-foreground">
              {/* Row 1: Name, company, email, phone */}
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-header-foreground/70" />
                  <span>{offer.customerData.contactPerson}</span>
                </div>
                {offer.customerData.companyName && (
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-header-foreground/70" />
                    <span>{offer.customerData.companyName}</span>
                  </div>
                )}
                {offer.customerData.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-header-foreground/70" />
                    <a href={`mailto:${offer.customerData.email}`} className="hover:underline">
                      {offer.customerData.email}
                    </a>
                  </div>
                )}
                {offer.customerData.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-header-foreground/70" />
                    <a href={`tel:${offer.customerData.phone.replace(/\s/g, '')}`} className="hover:underline">
                      {offer.customerData.phone}
                    </a>
                  </div>
                )}
              </div>
              {/* Row 2: Address and NIP */}
              <div className="flex items-center gap-4 text-header-foreground/80">
                {(offer.customerData.city || offer.customerData.address) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-header-foreground/70" />
                    <span>
                      {[offer.customerData.address, offer.customerData.postalCode, offer.customerData.city]
                        .filter(Boolean)
                        .join(', ')}
                    </span>
                  </div>
                )}
                {offer.customerData.nip && (
                  <span>NIP: {offer.customerData.nip}</span>
                )}
              </div>
            </div>
            
            {/* Right: Logo */}
            <img 
              src={logo} 
              alt="Pool Prestige" 
              className="h-8 lg:h-10 w-auto object-contain"
            />
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 pt-24 pb-32">
        {/* Customer Info for Mobile/Tablet */}
        <Card className="mb-6 lg:hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Dane klienta
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
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
                  <a href={`mailto:${offer.customerData.email}`} className="truncate text-primary hover:underline">
                    {offer.customerData.email}
                  </a>
                </div>
              )}
              {offer.customerData.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a href={`tel:${offer.customerData.phone.replace(/\s/g, '')}`} className="text-primary hover:underline">
                    {offer.customerData.phone}
                  </a>
                </div>
              )}
              {(offer.customerData.city || offer.customerData.address) && (
                <div className="flex items-center gap-2 sm:col-span-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  <span>
                    {[offer.customerData.address, offer.customerData.postalCode, offer.customerData.city]
                      .filter(Boolean)
                      .join(', ')}
                  </span>
                </div>
              )}
              {offer.customerData.nip && (
                <div className="text-muted-foreground">
                  NIP: {offer.customerData.nip}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Pool 3D Visualization */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Ruler className="w-5 h-5 text-primary" />
              Wizualizacja basenu
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Pool3DVisualization 
              dimensions={offer.dimensions}
              calculations={calculatePoolMetrics(offer.dimensions, offer.poolType as PoolType)}
              height={300}
            />
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
              Typ basenu: <span className="font-medium text-foreground">{poolTypeLabel}</span>
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

        {/* Sections (except opcje) */}
        {Object.entries(offer.sections)
          .filter(([sectionKey]) => sectionKey !== 'opcje')
          .map(([sectionKey, section]) => {
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
                    
                    const itemTotal = displayItem.unitPrice * displayItem.quantity;
                    const discount = displayItem.discount || 100;
                    const afterDiscount = itemTotal * (discount / 100);

                    return (
                      <div 
                        key={idx} 
                        className="border rounded-lg p-4 border-border"
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <h4 className="font-medium">
                                  {capitalize(displayItem.name)}
                                </h4>
                                {displayItem.symbol && (
                                  <p className="text-xs text-muted-foreground font-mono">
                                    {displayItem.symbol}
                                  </p>
                                )}
                              </div>
                              <p className="font-semibold whitespace-nowrap text-primary">
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

        {/* Optional Items (Opcje dodatkowe) - at the end with checkboxes */}
        {opcjeItems.length > 0 && (
          <Card className="mb-6 border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span>Opcje dodatkowe</span>
                <span className="text-xs font-normal text-muted-foreground">(zaznacz, aby dodać do oferty)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {opcjeItems.map((item: OptionalItemData, idx: number) => {
                const itemKey = `opcje-${idx}`;
                const isSelected = optionalSelections[itemKey] || false;

                return (
                  <div 
                    key={idx} 
                    className={`border rounded-lg p-4 transition-all cursor-pointer ${
                      isSelected 
                        ? 'border-primary/50 bg-primary/5' 
                        : 'border-dashed border-muted-foreground/30 bg-background/50 hover:border-muted-foreground/50'
                    }`}
                    onClick={() => toggleOptionalSelection(itemKey)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="pt-0.5">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOptionalSelection(itemKey)}
                          className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h4 className={`font-medium ${!isSelected ? 'text-muted-foreground' : ''}`}>
                              {capitalize(item.name)}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.quantity} szt.
                            </p>
                          </div>
                          <p className={`font-semibold whitespace-nowrap ${isSelected ? 'text-primary' : 'text-muted-foreground'}`}>
                            +{formatPrice(item.priceDifference)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Social Media Links */}
        <div className="container mx-auto px-4 py-6 flex flex-col items-center gap-4 border-t border-border/50">
          <p className="text-sm text-muted-foreground">Zobacz nasze realizacje i śledź nas w social mediach</p>
          <div className="flex items-center gap-4">
            <a
              href="https://www.facebook.com/PoolPrestige.TechnikaBasenowa"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1877F2]/10 text-[#1877F2] hover:bg-[#1877F2]/20 transition-colors"
            >
              <Facebook className="w-5 h-5" />
              <span className="text-sm font-medium">Facebook</span>
            </a>
            <a
              href="https://www.instagram.com/poolprestige_baseny/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-br from-[#F58529]/10 via-[#DD2A7B]/10 to-[#8134AF]/10 text-[#DD2A7B] hover:from-[#F58529]/20 hover:via-[#DD2A7B]/20 hover:to-[#8134AF]/20 transition-colors"
            >
              <Instagram className="w-5 h-5" />
              <span className="text-sm font-medium">Instagram</span>
            </a>
          </div>
        </div>
      </main>

      {/* Fixed Footer with Total */}
      <footer className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-sm border-t border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            {/* Actions - left side */}
            {offer && (
              <div className="flex items-center gap-2">
                {isAuthenticated && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(-1)}
                  >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Wróć
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleDownloadPDF}
                  disabled={isGeneratingPDF}
                >
                  {isGeneratingPDF ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <FileDown className="w-4 h-4 mr-2" />
                  )}
                  Pobierz PDF
                </Button>
                {isAuthenticated && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/nowa-oferta?edit=${offer.id}`)}
                    >
                      <Pencil className="w-4 h-4 mr-2" />
                      Edytuj
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // TODO: Implement duplicate - for now just navigate to new offer
                        navigate('/nowa-oferta');
                      }}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Duplikuj
                    </Button>
                  </>
                )}
              </div>
            )}
            
            {/* Amounts - right side */}
            <div className="flex items-center gap-6 ml-auto">
              <div className="hidden sm:block">
                <p className="text-sm text-muted-foreground">Suma netto</p>
                <p className="text-lg font-semibold">{formatPrice(calculatedTotals.net)}</p>
              </div>
              <div className="text-center hidden md:block">
                <p className="text-sm text-muted-foreground">VAT 23%</p>
                <p className="text-lg font-medium">{formatPrice(calculatedTotals.gross - calculatedTotals.net)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Suma brutto</p>
                <p className="text-2xl font-bold text-primary">{formatPrice(calculatedTotals.gross)}</p>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
