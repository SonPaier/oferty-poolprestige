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
  Trash2
} from 'lucide-react';
import { getPriceInPLN } from '@/data/products';
import { formatPrice } from '@/lib/calculations';
import { OfferItem, ConfiguratorSection } from '@/types/configurator';
import { toast } from 'sonner';

interface SummaryStepProps {
  onBack: () => void;
  onReset: () => void;
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

export function SummaryStep({ onBack, onReset }: SummaryStepProps) {
  const { state, dispatch, companySettings } = useConfigurator();
  const { customerData, dimensions, calculations, sections, poolType, foilCalculation } = state;

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

  const grandTotal = Object.values(sections).reduce(
    (sum, section) => sum + calculateSectionTotal(section.items),
    0
  );

  const handleGeneratePDF = () => {
    toast.success('Generowanie PDF...', {
      description: 'Oferta zostanie pobrana za chwilę.',
    });
    // PDF generation would be implemented here
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
        </div>

        {/* Middle: Sections */}
        <div className="lg:col-span-2 space-y-4">
          {Object.entries(sections).map(([key, section]) => 
            renderSection(key as keyof typeof sections, section)
          )}

          {/* Grand total */}
          <div className="glass-card p-6 bg-primary/5 border-primary/30">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Wartość oferty netto</p>
                <p className="text-3xl font-bold text-primary">
                  {formatPrice(grandTotal)}
                </p>
              </div>
              <div className="text-right text-sm text-muted-foreground">
                <p>Brutto (23% VAT)</p>
                <p className="text-lg font-semibold text-foreground">
                  {formatPrice(grandTotal * 1.23)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-6">
        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Wstecz
          </Button>
          <Button variant="outline" onClick={onReset} className="text-destructive hover:text-destructive">
            Nowa oferta
          </Button>
        </div>
        <Button onClick={handleGeneratePDF} className="btn-primary px-8">
          <Download className="w-4 h-4 mr-2" />
          Generuj PDF
        </Button>
      </div>
    </div>
  );
}
