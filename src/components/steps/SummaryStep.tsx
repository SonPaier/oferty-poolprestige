import { useConfigurator } from '@/context/ConfiguratorContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  ArrowLeft, 
  FileText, 
  Download, 
  User, 
  Ruler, 
  Palette, 
  Gauge, 
  Filter, 
  Lightbulb, 
  Cpu,
  Trash2,
  Shovel,
  Save,
  Loader2,
  Mail,
  Percent,
  Edit2,
  Package
} from 'lucide-react';
import { getPriceInPLN, products } from '@/data/products';
import { formatPrice } from '@/lib/calculations';
import { OfferItem, ConfiguratorSection } from '@/types/configurator';
import { ExcavationSettings, calculateExcavation, generateOfferNumber, saveOffer, SavedOffer } from '@/types/offers';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState, useEffect, useMemo } from 'react';
import logoImage from '@/assets/logo.png';

interface OptionItem {
  name: string;
  quantity: number;
  priceDifference: number;
}

interface SummaryStepProps {
  onBack: () => void;
  onReset: () => void;
  excavationSettings: ExcavationSettings;
}

// Base prices for "INNE" items (for 77.6 m³ reference volume)
const BASE_VOLUME = 77.6;
const INNE_BASE_ITEMS = [
  { id: 'inne-materialy', name: 'Materiały instalacyjne', unit: 'szt', basePrice: 11000, baseQuantity: 1 },
  { id: 'inne-elektryka', name: 'Rozdzielnia elektryczna – prace elektryczne', unit: 'usł', basePrice: 3000, baseQuantity: 1 },
  { id: 'inne-foliowanie', name: 'Foliowanie niecki', unit: 'm²', basePricePerUnit: 140, quantityFromArea: true },
  { id: 'inne-foliowanie-schodow', name: 'Foliowanie schodów', unit: 'usł', basePrice: 3500, baseQuantity: 1 },
  { id: 'inne-prace', name: 'Prace instalacyjne', unit: 'usł', basePrice: 25000, baseQuantity: 1 },
  { id: 'inne-zestaw', name: 'Zestaw startowy – akcesoria, chemia', unit: 'szt', basePrice: 800, baseQuantity: 1 },
];

interface InneItem {
  id: string;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

const sectionIcons: Record<string, React.ReactNode> = {
  wykonczenie: <Palette className="w-4 h-4" />,
  uzbrojenie: <Gauge className="w-4 h-4" />,
  filtracja: <Filter className="w-4 h-4" />,
  oswietlenie: <Lightbulb className="w-4 h-4" />,
  automatyka: <Cpu className="w-4 h-4" />,
  atrakcje: <Gauge className="w-4 h-4" />,
  dodatki: <Gauge className="w-4 h-4" />,
};

const sectionLabels: Record<string, string> = {
  wykonczenie: 'Wykończenie basenu',
  uzbrojenie: 'Uzbrojenie niecki',
  filtracja: 'Filtracja',
  oswietlenie: 'Oświetlenie',
  automatyka: 'Automatyka',
  atrakcje: 'Atrakcje',
  dodatki: 'Dodatki',
};

export function SummaryStep({ onBack, onReset, excavationSettings }: SummaryStepProps) {
  const { state, dispatch, companySettings } = useConfigurator();
  const { customerData, dimensions, calculations, sections, poolType, foilCalculation } = state;
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);
  
  // VAT rate state (23% default, can change to 8%)
  const [vatRate, setVatRate] = useState<number>(0.23);
  
  // Item discounts (100% = full price)
  const [itemDiscounts, setItemDiscounts] = useState<Record<string, number>>({});
  
  // Custom prices for items
  const [customPrices, setCustomPrices] = useState<Record<string, number>>({});
  
  // Notes and payment terms
  const [notes, setNotes] = useState(companySettings.notesTemplate || '');
  const [paymentTerms, setPaymentTerms] = useState(companySettings.paymentTermsTemplate || '');
  
  // INNE section items with volume-based calculation
  const volume = calculations?.volume || 0;
  const wallArea = calculations?.wallArea || 0;
  const bottomArea = calculations?.bottomArea || 0;
  const totalPoolArea = wallArea + bottomArea;
  const volumeCoefficient = companySettings.volumeCoefficientPercent || 3;
  
  // Calculate volume scaling factor
  const volumeScaleFactor = 1 + ((volume - BASE_VOLUME) / BASE_VOLUME) * (volumeCoefficient / 100) * (volume > BASE_VOLUME ? 1 : -1);
  const actualScaleFactor = 1 + ((volume - BASE_VOLUME) * volumeCoefficient / 100);
  
  // Initialize INNE items
  const [inneItems, setInneItems] = useState<InneItem[]>(() => {
    return INNE_BASE_ITEMS.map(item => {
      let quantity = item.baseQuantity || 1;
      let unitPrice = item.basePrice || 0;
      
      if (item.quantityFromArea) {
        quantity = Math.ceil(totalPoolArea);
        unitPrice = item.basePricePerUnit || 0;
      } else {
        // Scale price by volume
        unitPrice = Math.round(item.basePrice! * actualScaleFactor);
      }
      
      return {
        id: item.id,
        name: item.name,
        unit: item.unit,
        quantity,
        unitPrice,
        discount: 100,
      };
    });
  });

  // Update INNE items when pool dimensions change
  useEffect(() => {
    setInneItems(prev => prev.map((item, index) => {
      const baseItem = INNE_BASE_ITEMS[index];
      if (baseItem.quantityFromArea) {
        return { ...item, quantity: Math.ceil(totalPoolArea) };
      }
      return {
        ...item,
        unitPrice: Math.round(baseItem.basePrice! * actualScaleFactor),
      };
    }));
  }, [volume, totalPoolArea, actualScaleFactor]);

  // Convert logo to base64 on mount
  useEffect(() => {
    const convertLogoToBase64 = async () => {
      try {
        const response = await fetch(logoImage);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
          setLogoBase64(reader.result as string);
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.error('Failed to convert logo to base64:', err);
      }
    };
    convertLogoToBase64();
  }, []);

  const excavation = calculateExcavation(dimensions, excavationSettings);

  const removeItem = (sectionKey: keyof typeof sections, itemId: string) => {
    dispatch({
      type: 'REMOVE_ITEM',
      payload: { section: sectionKey, itemId },
    });
  };

  const getItemDiscount = (itemId: string) => itemDiscounts[itemId] ?? 100;
  const getCustomPrice = (itemId: string, originalPrice: number) => customPrices[itemId] ?? originalPrice;

  const calculateItemTotal = (item: OfferItem): number => {
    const basePrice = getPriceInPLN(item.product);
    const customPrice = getCustomPrice(item.id, basePrice);
    const discount = getItemDiscount(item.id) / 100;
    return customPrice * item.quantity * discount;
  };

  const calculateSectionTotal = (items: OfferItem[]): number => {
    return items.reduce((sum, item) => sum + calculateItemTotal(item), 0);
  };

  const calculateInneTotal = (): number => {
    return inneItems.reduce((sum, item) => {
      return sum + (item.unitPrice * item.quantity * (item.discount / 100));
    }, 0);
  };

  const productsTotal = Object.values(sections).reduce(
    (sum, section) => sum + calculateSectionTotal(section.items),
    0
  );

  const inneTotal = calculateInneTotal();
  const excavationTotal = excavation.excavationTotal + excavation.removalFixedPrice;
  const grandTotalNet = productsTotal + excavationTotal + inneTotal;
  const vatAmount = grandTotalNet * vatRate;
  const grandTotalGross = grandTotalNet + vatAmount;

  // Generate options (more expensive alternatives) for PDF
  const generateOptions = useMemo((): OptionItem[] => {
    const options: OptionItem[] = [];
    
    // Check lighting section for alternatives
    const lightingItems = sections.oswietlenie?.items || [];
    for (const item of lightingItems) {
      // Find more expensive lamps in the same category
      const isLamp = item.product.name.toLowerCase().includes('lampa');
      const isBulb = item.product.name.toLowerCase().includes('żarówka');
      
      if (isLamp || isBulb) {
        const selectedPrice = getPriceInPLN(item.product);
        const alternatives = products.filter(p => 
          p.category === 'oswietlenie' &&
          ((isLamp && p.name.toLowerCase().includes('lampa')) ||
           (isBulb && p.name.toLowerCase().includes('żarówka'))) &&
          getPriceInPLN(p) > selectedPrice
        );
        
        // Add the most expensive alternative as an option
        if (alternatives.length > 0) {
          const sorted = alternatives.sort((a, b) => getPriceInPLN(b) - getPriceInPLN(a));
          const mostExpensive = sorted[0];
          const priceDiff = (getPriceInPLN(mostExpensive) - selectedPrice) * item.quantity;
          
          if (priceDiff > 0) {
            options.push({
              name: mostExpensive.name,
              quantity: item.quantity,
              priceDifference: priceDiff,
            });
          }
        }
      }
    }
    
    // Check automation section for heat pump alternatives
    const automationItems = sections.automatyka?.items || [];
    for (const item of automationItems) {
      const isHeatPump = item.product.name.toLowerCase().includes('pompa ciepła');
      
      if (isHeatPump) {
        const selectedPrice = getPriceInPLN(item.product);
        const alternatives = products.filter(p => 
          p.category === 'automatyka' &&
          p.name.toLowerCase().includes('pompa ciepła') &&
          getPriceInPLN(p) > selectedPrice
        );
        
        if (alternatives.length > 0) {
          const sorted = alternatives.sort((a, b) => getPriceInPLN(b) - getPriceInPLN(a));
          const mostExpensive = sorted[0];
          const priceDiff = (getPriceInPLN(mostExpensive) - selectedPrice) * item.quantity;
          
          if (priceDiff > 0) {
            options.push({
              name: mostExpensive.name,
              quantity: item.quantity,
              priceDifference: priceDiff,
            });
          }
        }
      }
    }
    
    return options;
  }, [sections.oswietlenie?.items, sections.automatyka?.items]);

  const handleSaveOffer = () => {
    const offerNumber = generateOfferNumber();
    const offer: SavedOffer = {
      id: crypto.randomUUID(),
      offerNumber,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      customerData,
      poolType,
      dimensions,
      calculations,
      sections: Object.fromEntries(
        Object.entries(sections).map(([key, section]) => [key, { items: section.items }])
      ),
      excavation,
      totalNet: grandTotalNet,
      totalGross: grandTotalGross,
    };

    saveOffer(offer);
    toast.success('Oferta została zapisana', {
      description: `Numer: ${offer.offerNumber}`,
    });
    
    return offerNumber;
  };

  const blobToDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });

  const handleGeneratePDF = async () => {
    const offerNumber = handleSaveOffer();
    setIsGeneratingPDF(true);

    try {
      const pdfData = {
        offerNumber,
        companySettings: {
          ...companySettings,
          logoBase64: logoBase64 || undefined,
        },
        customerData,
        poolParams: {
          type: poolType,
          length: dimensions.length,
          width: dimensions.width,
          depth: dimensions.depth,
          volume: calculations?.volume || 0,
          requiredFlow: calculations?.requiredFlow || 0,
          isIrregular: dimensions.isIrregular,
          irregularSurcharge: companySettings.irregularSurchargePercent,
          overflowType: dimensions.overflowType,
        },
        sections: Object.entries(sections)
          .filter(([_, section]) => section.items.length > 0)
          .map(([key, section]) => ({
            name: sectionLabels[key] || key,
            items: section.items.map(item => ({
              product: {
                name: item.product.name,
                symbol: item.product.symbol,
              },
              quantity: item.quantity,
              unitPrice: getCustomPrice(item.id, getPriceInPLN(item.product)),
              discount: getItemDiscount(item.id),
            })),
          })),
        inneItems: inneItems.map(item => ({
          name: item.name,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
        })),
        excavation: {
          volume: excavation.excavationVolume,
          pricePerM3: excavation.excavationPricePerM3,
          excavationTotal: excavation.excavationTotal,
          removalFixedPrice: excavation.removalFixedPrice,
        },
        totals: {
          productsTotal,
          inneTotal,
          excavationTotal,
          grandTotalNet,
          vatRate: vatRate * 100,
          vatAmount,
          grandTotalGross,
        },
        notes,
        paymentTerms,
        options: generateOptions,
      };

      const { data, error } = await supabase.functions.invoke('generate-pdf', {
        body: pdfData,
        responseType: 'blob',
      });

      if (error) {
        console.error('PDF generation error:', error);
        toast.error('Błąd generowania PDF', {
          description: error.message || 'Spróbuj ponownie',
        });
        return;
      }

      if (!data) {
        toast.error('Błąd generowania PDF', {
          description: 'Brak danych z serwera',
        });
        return;
      }

      const pdfBlob = data instanceof Blob ? data : new Blob([data as any], { type: 'application/pdf' });
      const url = URL.createObjectURL(pdfBlob);

      const link = document.createElement('a');
      link.href = url;
      link.download = `Oferta_${offerNumber.replace(/\//g, '-')}_${customerData.contactPerson.replace(/\s+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success('PDF wygenerowany!', {
        description: 'Plik został pobrany na dysk.',
      });
    } catch (err) {
      console.error('PDF error:', err);
      toast.error('Błąd połączenia z serwerem');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleSendEmail = async () => {
    if (!customerData.email) {
      toast.error('Brak adresu email klienta', {
        description: 'Uzupełnij email w danych klienta',
      });
      return;
    }

    const offerNumber = handleSaveOffer();
    setIsSendingEmail(true);

    try {
      const pdfData = {
        offerNumber,
        companySettings: {
          ...companySettings,
          logoBase64: logoBase64 || undefined,
        },
        customerData,
        poolParams: {
          type: poolType,
          length: dimensions.length,
          width: dimensions.width,
          depth: dimensions.depth,
          volume: calculations?.volume || 0,
          requiredFlow: calculations?.requiredFlow || 0,
          isIrregular: dimensions.isIrregular,
          irregularSurcharge: companySettings.irregularSurchargePercent,
          overflowType: dimensions.overflowType,
        },
        sections: Object.entries(sections)
          .filter(([_, section]) => section.items.length > 0)
          .map(([key, section]) => ({
            name: sectionLabels[key] || key,
            items: section.items.map(item => ({
              product: {
                name: item.product.name,
                symbol: item.product.symbol,
              },
              quantity: item.quantity,
              unitPrice: getCustomPrice(item.id, getPriceInPLN(item.product)),
              discount: getItemDiscount(item.id),
            })),
          })),
        inneItems: inneItems.map(item => ({
          name: item.name,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discount: item.discount,
        })),
        excavation: {
          volume: excavation.excavationVolume,
          pricePerM3: excavation.excavationPricePerM3,
          excavationTotal: excavation.excavationTotal,
          removalFixedPrice: excavation.removalFixedPrice,
        },
        totals: {
          productsTotal,
          inneTotal,
          excavationTotal,
          grandTotalNet,
          vatRate: vatRate * 100,
          vatAmount,
          grandTotalGross,
        },
        notes,
        paymentTerms,
        options: generateOptions,
      };

      const { data: pdfResult, error: pdfError } = await supabase.functions.invoke('generate-pdf', {
        body: pdfData,
        responseType: 'blob',
      });

      if (pdfError) {
        console.error('PDF generation error:', pdfError);
        toast.error('Błąd generowania PDF');
        return;
      }

      if (!pdfResult) {
        toast.error('Błąd generowania PDF', { description: 'Brak danych z serwera' });
        return;
      }

      const pdfBlob = pdfResult instanceof Blob
        ? pdfResult
        : new Blob([pdfResult as any], { type: 'application/pdf' });
      const pdfBase64 = await blobToDataUrl(pdfBlob);

      const template = companySettings.emailTemplate;
      const emailBody = `${template.greeting}\n\n${template.body}\n\n${template.signature}`;

      const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-offer-email', {
        body: {
          to: customerData.email,
          cc: template.ccEmail,
          subject: `Oferta ${offerNumber} - Pool Prestige`,
          body: emailBody,
          pdfBase64,
          pdfFilename: `Oferta_${offerNumber.replace(/\//g, '-')}.pdf`,
        },
      });

      if (emailError) {
        console.error('Email error:', emailError);
        toast.error('Błąd wysyłki email');
        return;
      }

      if (emailResult?.mock) {
        toast.success('Email wysłany (tryb testowy)', {
          description: `Do: ${customerData.email}. Skonfiguruj RESEND_API_KEY dla prawdziwej wysyłki.`,
        });
      } else {
        toast.success('Email wysłany!', {
          description: `Oferta została wysłana do ${customerData.email}`,
        });
      }
    } catch (err) {
      console.error('Email error:', err);
      toast.error('Błąd połączenia z serwerem');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const renderSection = (key: keyof typeof sections, section: ConfiguratorSection) => {
    if (section.items.length === 0) return null;
    
    const sectionTotal = calculateSectionTotal(section.items);
    
    return (
      <div key={key} className="glass-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium flex items-center gap-2">
            {sectionIcons[key]}
            {sectionLabels[key]}
          </h4>
          <span className="text-sm font-semibold text-primary">
            {formatPrice(sectionTotal)}
          </span>
        </div>
        
        <div className="space-y-2">
          {section.items.map(item => {
            const basePrice = getPriceInPLN(item.product);
            const customPrice = getCustomPrice(item.id, basePrice);
            const discount = getItemDiscount(item.id);
            const itemTotal = calculateItemTotal(item);
            
            return (
              <div 
                key={item.id}
                className="p-3 rounded bg-muted/30 text-sm space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{item.product.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.quantity} × {formatPrice(customPrice)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium whitespace-nowrap">
                      {formatPrice(itemTotal)}
                    </span>
                    <button
                      onClick={() => removeItem(key, item.id)}
                      className="p-1 hover:bg-destructive/20 rounded text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                
                {/* Discount and custom price row */}
                <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                  <div className="flex items-center gap-1.5">
                    <Percent className="w-3 h-3 text-muted-foreground" />
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={discount}
                      onChange={(e) => setItemDiscounts(prev => ({
                        ...prev,
                        [item.id]: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                      }))}
                      className="w-16 h-7 text-xs input-field"
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Edit2 className="w-3 h-3 text-muted-foreground" />
                    <Input
                      type="number"
                      min={0}
                      step={10}
                      value={customPrice}
                      onChange={(e) => setCustomPrices(prev => ({
                        ...prev,
                        [item.id]: parseFloat(e.target.value) || 0
                      }))}
                      className="w-24 h-7 text-xs input-field"
                    />
                    <span className="text-xs text-muted-foreground">PLN</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="animate-slide-up">
      <div className="section-header">
        <FileText className="w-5 h-5 text-primary" />
        Podsumowanie oferty
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Customer & Pool info */}
        <div className="space-y-4">
          <div className="glass-card p-4">
            <h4 className="font-medium flex items-center gap-2 mb-3">
              <User className="w-4 h-4 text-primary" />
              Dane klienta
            </h4>
            <div className="space-y-1 text-sm">
              <p className="font-medium">{customerData.contactPerson}</p>
              {customerData.companyName && <p>{customerData.companyName}</p>}
              <p className="text-muted-foreground">{customerData.phone}</p>
              {customerData.email && (
                <p className="text-muted-foreground">{customerData.email}</p>
              )}
              {customerData.city && (
                <p className="text-muted-foreground">
                  {customerData.address}, {customerData.postalCode} {customerData.city}
                </p>
              )}
            </div>
          </div>

          <div className="glass-card p-4">
            <h4 className="font-medium flex items-center gap-2 mb-3">
              <Ruler className="w-4 h-4 text-primary" />
              Parametry basenu
            </h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-2 rounded bg-muted/30">
                <p className="text-xs text-muted-foreground">Wymiary</p>
                <p className="font-medium">{dimensions.length} × {dimensions.width} m</p>
              </div>
              <div className="p-2 rounded bg-muted/30">
                <p className="text-xs text-muted-foreground">Głębokość</p>
                <p className="font-medium">{dimensions.depth} m</p>
              </div>
              <div className="p-2 rounded bg-muted/30">
                <p className="text-xs text-muted-foreground">Objętość</p>
                <p className="font-medium">{calculations?.volume.toFixed(1)} m³</p>
              </div>
              <div className="p-2 rounded bg-muted/30">
                <p className="text-xs text-muted-foreground">Wydajność</p>
                <p className="font-medium">{calculations?.requiredFlow.toFixed(1)} m³/h</p>
              </div>
            </div>
            {dimensions.isIrregular && (
              <p className="text-xs text-warning mt-2">
                Kształt nieregularny (+{companySettings.irregularSurchargePercent}%)
              </p>
            )}
          </div>

          {/* Excavation summary */}
          <div className="glass-card p-4">
            <h4 className="font-medium flex items-center gap-2 mb-3">
              <Shovel className="w-4 h-4 text-primary" />
              Roboty ziemne
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Wykop ({excavation.excavationVolume.toFixed(1)} m³)</span>
                <span>{formatPrice(excavation.excavationTotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Wywóz ziemi (ryczałt)</span>
                <span>{formatPrice(excavation.removalFixedPrice)}</span>
              </div>
              <div className="flex justify-between font-medium pt-2 border-t border-border">
                <span>Razem</span>
                <span className="text-primary">{formatPrice(excavationTotal)}</span>
              </div>
            </div>
          </div>
          
          {/* VAT selector */}
          <div className="glass-card p-4">
            <h4 className="font-medium flex items-center gap-2 mb-3">
              <Percent className="w-4 h-4 text-primary" />
              Stawka VAT
            </h4>
            <Select
              value={String(vatRate * 100)}
              onValueChange={(val) => setVatRate(parseInt(val) / 100)}
            >
              <SelectTrigger className="input-field">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="23">23%</SelectItem>
                <SelectItem value="8">8%</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Middle: Sections */}
        <div className="lg:col-span-2 space-y-4">
          {Object.entries(sections).map(([key, section]) => 
            renderSection(key as keyof typeof sections, section)
          )}

          {/* INNE section */}
          <div className="glass-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium flex items-center gap-2">
                <Package className="w-4 h-4 text-primary" />
                Inne
              </h4>
              <span className="text-sm font-semibold text-primary">
                {formatPrice(inneTotal)}
              </span>
            </div>
            
            <div className="space-y-2">
              {inneItems.map((item, index) => {
                const itemTotal = item.unitPrice * item.quantity * (item.discount / 100);
                
                return (
                  <div 
                    key={item.id}
                    className="p-3 rounded bg-muted/30 text-sm space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} {item.unit} × {formatPrice(item.unitPrice)}
                        </p>
                      </div>
                      <span className="font-medium whitespace-nowrap">
                        {formatPrice(itemTotal)}
                      </span>
                    </div>
                    
                    {/* Editable fields */}
                    <div className="flex items-center gap-3 pt-2 border-t border-border/50">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Ilość:</span>
                        <Input
                          type="number"
                          min={0}
                          value={item.quantity}
                          onChange={(e) => {
                            const newItems = [...inneItems];
                            newItems[index] = { ...item, quantity: parseFloat(e.target.value) || 0 };
                            setInneItems(newItems);
                          }}
                          className="w-16 h-7 text-xs input-field"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">Cena:</span>
                        <Input
                          type="number"
                          min={0}
                          step={10}
                          value={item.unitPrice}
                          onChange={(e) => {
                            const newItems = [...inneItems];
                            newItems[index] = { ...item, unitPrice: parseFloat(e.target.value) || 0 };
                            setInneItems(newItems);
                          }}
                          className="w-24 h-7 text-xs input-field"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Percent className="w-3 h-3 text-muted-foreground" />
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={item.discount}
                          onChange={(e) => {
                            const newItems = [...inneItems];
                            newItems[index] = { 
                              ...item, 
                              discount: Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)) 
                            };
                            setInneItems(newItems);
                          }}
                          className="w-16 h-7 text-xs input-field"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grand total */}
          <div className="glass-card p-6 bg-primary/5 border-primary/30">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Produkty i usługi</span>
                <span>{formatPrice(productsTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Inne</span>
                <span>{formatPrice(inneTotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Roboty ziemne</span>
                <span>{formatPrice(excavationTotal)}</span>
              </div>
              <div className="border-t border-border pt-3">
                <div className="flex justify-between">
                  <span className="font-medium">Razem netto</span>
                  <span className="text-xl font-bold">{formatPrice(grandTotalNet)}</span>
                </div>
                <div className="flex justify-between text-sm text-muted-foreground mt-1">
                  <span>+ VAT {vatRate * 100}%</span>
                  <span>{formatPrice(vatAmount)}</span>
                </div>
                <div className="flex justify-between mt-2 pt-2 border-t border-border">
                  <span className="font-bold">Razem brutto</span>
                  <span className="text-2xl font-bold text-primary">
                    {formatPrice(grandTotalGross)}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Notes and payment terms */}
          <div className="glass-card p-4">
            <h4 className="font-medium mb-3">Uwagi i warunki płatności</h4>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Uwagi</label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Uwagi do oferty..."
                  className="input-field min-h-[60px]"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground block mb-1">Warunki płatności</label>
                <Textarea
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  placeholder="Warunki płatności..."
                  className="input-field min-h-[60px]"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="glass-card p-4 mt-6">
        <div className="flex flex-wrap justify-between gap-4">
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Wstecz
            </Button>
            <Button variant="outline" onClick={onReset} className="text-destructive hover:text-destructive">
              Nowa oferta
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => handleSaveOffer()}>
              <Save className="w-4 h-4 mr-2" />
              Zapisz ofertę
            </Button>
            <Button onClick={handleGeneratePDF} variant="outline" disabled={isGeneratingPDF}>
              {isGeneratingPDF ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generuję...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 mr-2" />
                  Pobierz PDF
                </>
              )}
            </Button>
            <Button onClick={handleSendEmail} className="btn-primary" disabled={isSendingEmail || !customerData.email}>
              {isSendingEmail ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Wysyłam...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  Wyślij email
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
