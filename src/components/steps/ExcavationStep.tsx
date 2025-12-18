import { useState, useEffect } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProductCard } from '@/components/ProductCard';
import { ArrowLeft, Shovel, Info } from 'lucide-react';
import { ExcavationSettings, ExcavationData, calculateExcavation } from '@/types/offers';
import { formatPrice } from '@/lib/calculations';

interface ExcavationStepProps {
  onNext: () => void;
  onBack: () => void;
  excavationSettings: ExcavationSettings;
}

export function ExcavationStep({ onNext, onBack, excavationSettings }: ExcavationStepProps) {
  const { state, dispatch } = useConfigurator();
  const { dimensions, calculations } = state;
  
  const [excavation, setExcavation] = useState<ExcavationData>(() => 
    calculateExcavation(dimensions, excavationSettings)
  );
  
  const [customRemovalPrice, setCustomRemovalPrice] = useState(excavationSettings.removalFixedPrice);

  useEffect(() => {
    const calc = calculateExcavation(dimensions, excavationSettings);
    setExcavation({
      ...calc,
      removalFixedPrice: customRemovalPrice,
    });
  }, [dimensions, excavationSettings, customRemovalPrice]);

  const excavationDimensions = {
    length: dimensions.length + (excavationSettings.marginWidth * 2),
    width: dimensions.width + (excavationSettings.marginWidth * 2),
    depth: dimensions.depth + excavationSettings.marginDepth,
  };

  const totalExcavationCost = excavation.excavationTotal + excavation.removalFixedPrice;

  return (
    <div className="animate-slide-up">
      <div className="section-header">
        <Shovel className="w-5 h-5 text-primary" />
        Roboty ziemne
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Excavation info */}
        <div className="glass-card p-6">
          <h3 className="text-base font-medium mb-4">Wymiary wykopu</h3>
          
          <div className="p-4 rounded-lg bg-accent/10 border border-accent/20 mb-4">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-accent mt-0.5" />
              <div className="text-sm">
                <p className="font-medium">Kalkulacja wykopu</p>
                <p className="text-muted-foreground">
                  Basen: {dimensions.length}×{dimensions.width}m + margines {excavationSettings.marginWidth}m z każdej strony
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Długość</p>
              <p className="text-lg font-bold">{excavationDimensions.length.toFixed(1)} m</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Szerokość</p>
              <p className="text-lg font-bold">{excavationDimensions.width.toFixed(1)} m</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/30 text-center">
              <p className="text-xs text-muted-foreground">Głębokość</p>
              <p className="text-lg font-bold">{excavationDimensions.depth.toFixed(1)} m</p>
            </div>
          </div>

          <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-xs text-muted-foreground">Objętość wykopu</p>
                <p className="text-2xl font-bold text-primary">
                  {excavation.excavationVolume.toFixed(1)} m³
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Stawka</p>
                <p className="text-lg font-semibold">
                  {formatPrice(excavation.excavationPricePerM3)}/m³
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Pricing */}
        <div className="glass-card p-6">
          <h3 className="text-base font-medium mb-4">Koszt robót ziemnych</h3>

          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
              <div>
                <p className="font-medium">Wykop</p>
                <p className="text-xs text-muted-foreground">
                  {excavation.excavationVolume.toFixed(1)} m³ × {formatPrice(excavation.excavationPricePerM3)}
                </p>
              </div>
              <span className="text-lg font-semibold">
                {formatPrice(excavation.excavationTotal)}
              </span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="removalPrice">Ryczałt za wywóz ziemi (PLN)</Label>
              <Input
                id="removalPrice"
                type="number"
                min="0"
                step="100"
                value={customRemovalPrice}
                onChange={(e) => setCustomRemovalPrice(parseFloat(e.target.value) || 0)}
                className="input-field"
              />
            </div>

            <div className="border-t border-border pt-4">
              <div className="flex justify-between items-center">
                <p className="font-medium">Razem roboty ziemne (netto)</p>
                <p className="text-2xl font-bold text-primary">
                  {formatPrice(totalExcavationCost)}
                </p>
              </div>
              <div className="flex justify-between items-center mt-1 text-sm text-muted-foreground">
                <p>+ VAT 8%</p>
                <p>{formatPrice(totalExcavationCost * 0.08)}</p>
              </div>
              <div className="flex justify-between items-center mt-1">
                <p className="font-medium">Brutto</p>
                <p className="font-bold">{formatPrice(totalExcavationCost * 1.08)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Wstecz
        </Button>
        <Button onClick={onNext} className="btn-primary px-8">
          Dalej: Podsumowanie
        </Button>
      </div>
    </div>
  );
}
