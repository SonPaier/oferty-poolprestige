import { useConfigurator } from '@/context/ConfiguratorContext';
import { Button } from '@/components/ui/button';
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
  Mail
} from 'lucide-react';
import { getPriceInPLN } from '@/data/products';
import { formatPrice } from '@/lib/calculations';
import { OfferItem, ConfiguratorSection } from '@/types/configurator';
import { ExcavationSettings, calculateExcavation, generateOfferNumber, saveOffer, SavedOffer } from '@/types/offers';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useState } from 'react';

interface SummaryStepProps {
  onBack: () => void;
  onReset: () => void;
  excavationSettings: ExcavationSettings;
}

const VAT_RATE = 0.08; // 8% VAT

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

  const excavation = calculateExcavation(dimensions, excavationSettings);

  const removeItem = (sectionKey: keyof typeof sections, itemId: string) => {
    dispatch({
      type: 'REMOVE_ITEM',
      payload: { section: sectionKey, itemId },
    });
  };

  const calculateSectionTotal = (items: OfferItem[]): number => {
    return items.reduce((sum, item) => {
      const price = item.customPrice || getPriceInPLN(item.product);
      return sum + price * item.quantity;
    }, 0);
  };

  const productsTotal = Object.values(sections).reduce(
    (sum, section) => sum + calculateSectionTotal(section.items),
    0
  );

  const excavationTotal = excavation.excavationTotal + excavation.removalFixedPrice;
  const grandTotalNet = productsTotal + excavationTotal;
  const vatAmount = grandTotalNet * VAT_RATE;
  const grandTotalGross = grandTotalNet + vatAmount;

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

  const handleGeneratePDF = async () => {
    const offerNumber = handleSaveOffer();
    setIsGeneratingPDF(true);

    try {
      // Prepare data for backend
      const pdfData = {
        offerNumber,
        companySettings,
        customerData,
        poolParams: {
          type: poolType,
          length: dimensions.length,
          width: dimensions.width,
          depthShallow: dimensions.depthShallow,
          depthDeep: dimensions.depthDeep,
          volume: calculations?.volume || 0,
          requiredFlow: calculations?.requiredFlow || 0,
          isIrregular: dimensions.isIrregular,
          irregularSurcharge: companySettings.irregularSurchargePercent,
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
              unitPrice: item.customPrice || getPriceInPLN(item.product),
            })),
          })),
        excavation: {
          volume: excavation.excavationVolume,
          pricePerM3: excavation.excavationPricePerM3,
          excavationTotal: excavation.excavationTotal,
          removalFixedPrice: excavation.removalFixedPrice,
        },
        totals: {
          productsTotal,
          excavationTotal,
          grandTotalNet,
          vatAmount,
          grandTotalGross,
        },
      };

      const { data, error } = await supabase.functions.invoke('generate-pdf', {
        body: pdfData,
      });

      if (error) {
        console.error('PDF generation error:', error);
        toast.error('Błąd generowania PDF', {
          description: error.message || 'Spróbuj ponownie',
        });
        return;
      }

      // Download PDF
      if (data?.pdf) {
        const link = document.createElement('a');
        link.href = data.pdf;
        link.download = `Oferta_${offerNumber.replace(/\//g, '-')}_${customerData.contactPerson.replace(/\s+/g, '_')}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast.success('PDF wygenerowany!', {
          description: 'Plik został pobrany na dysk.',
        });
      }
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
      // First generate PDF
      const pdfData = {
        offerNumber,
        companySettings,
        customerData,
        poolParams: {
          type: poolType,
          length: dimensions.length,
          width: dimensions.width,
          depthShallow: dimensions.depthShallow,
          depthDeep: dimensions.depthDeep,
          volume: calculations?.volume || 0,
          requiredFlow: calculations?.requiredFlow || 0,
          isIrregular: dimensions.isIrregular,
          irregularSurcharge: companySettings.irregularSurchargePercent,
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
              unitPrice: item.customPrice || getPriceInPLN(item.product),
            })),
          })),
        excavation: {
          volume: excavation.excavationVolume,
          pricePerM3: excavation.excavationPricePerM3,
          excavationTotal: excavation.excavationTotal,
          removalFixedPrice: excavation.removalFixedPrice,
        },
        totals: {
          productsTotal,
          excavationTotal,
          grandTotalNet,
          vatAmount,
          grandTotalGross,
        },
      };

      const { data: pdfResult, error: pdfError } = await supabase.functions.invoke('generate-pdf', {
        body: pdfData,
      });

      if (pdfError) {
        console.error('PDF generation error:', pdfError);
        toast.error('Błąd generowania PDF');
        return;
      }

      // Build email content from template
      const template = companySettings.emailTemplate;
      const emailBody = `${template.greeting}\n\n${template.body}\n\n${template.signature}`;

      // Send email
      const { data: emailResult, error: emailError } = await supabase.functions.invoke('send-offer-email', {
        body: {
          to: customerData.email,
          cc: template.ccEmail,
          subject: `Oferta ${offerNumber} - Pool Prestige`,
          body: emailBody,
          pdfBase64: pdfResult?.pdf,
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
          {section.items.map(item => (
            <div 
              key={item.id}
              className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm"
            >
              <div className="flex-1 min-w-0">
                <p className="truncate">{item.product.name}</p>
                <p className="text-xs text-muted-foreground">
                  {item.quantity} × {formatPrice(getPriceInPLN(item.product))}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {formatPrice(getPriceInPLN(item.product) * item.quantity)}
                </span>
                <button
                  onClick={() => removeItem(key, item.id)}
                  className="p-1 hover:bg-destructive/20 rounded text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
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
                <p className="font-medium">{dimensions.depthShallow} - {dimensions.depthDeep} m</p>
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
        </div>

        {/* Middle: Sections */}
        <div className="lg:col-span-2 space-y-4">
          {Object.entries(sections).map(([key, section]) => 
            renderSection(key as keyof typeof sections, section)
          )}

          {/* Grand total */}
          <div className="glass-card p-6 bg-primary/5 border-primary/30">
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Produkty i usługi</span>
                <span>{formatPrice(productsTotal)}</span>
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
                  <span>+ VAT 8%</span>
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
