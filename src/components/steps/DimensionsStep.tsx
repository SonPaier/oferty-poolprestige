import { useEffect } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Ruler, 
  Droplets, 
  ArrowLeft,
  Info,
  Waves
} from 'lucide-react';
import { PoolType, poolTypeLabels, cycleTimeByType } from '@/types/configurator';
import { calculatePoolMetrics, calculateFoilOptimization } from '@/lib/calculations';
import { formatPrice } from '@/lib/calculations';

interface DimensionsStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function DimensionsStep({ onNext, onBack }: DimensionsStepProps) {
  const { state, dispatch, companySettings } = useConfigurator();
  const { dimensions, poolType, calculations } = state;

  useEffect(() => {
    // Recalculate when dimensions or pool type change
    const calcs = calculatePoolMetrics(dimensions, poolType);
    dispatch({ type: 'SET_CALCULATIONS', payload: calcs });
    
    const foilCalc = calculateFoilOptimization(
      dimensions, 
      state.foilType,
      companySettings.irregularSurchargePercent
    );
    dispatch({ type: 'SET_FOIL_CALCULATION', payload: foilCalc });
  }, [dimensions, poolType, state.foilType, companySettings.irregularSurchargePercent]);

  const updateDimension = (field: keyof typeof dimensions, value: number | boolean) => {
    dispatch({
      type: 'SET_DIMENSIONS',
      payload: { ...dimensions, [field]: value },
    });
  };

  return (
    <div className="animate-slide-up">
      <div className="section-header">
        <Ruler className="w-5 h-5 text-primary" />
        Wymiary i typ basenu
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input form */}
        <div className="glass-card p-6 space-y-6">
          <div>
            <Label className="text-base font-medium mb-4 block">Typ basenu</Label>
            <RadioGroup
              value={poolType}
              onValueChange={(value) => dispatch({ type: 'SET_POOL_TYPE', payload: value as PoolType })}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              {(Object.keys(poolTypeLabels) as PoolType[]).map((type) => (
                <div key={type} className="relative">
                  <RadioGroupItem
                    value={type}
                    id={type}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={type}
                    className="flex flex-col items-center justify-center p-4 rounded-lg border border-border bg-muted/30 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 hover:bg-muted/50"
                  >
                    <span className="font-medium">{poolTypeLabels[type]}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      Cykl: {cycleTimeByType[type]}h
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="length">Długość (m)</Label>
              <Input
                id="length"
                type="number"
                step="0.1"
                min="2"
                max="50"
                value={dimensions.length}
                onChange={(e) => updateDimension('length', parseFloat(e.target.value) || 0)}
                className="input-field"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="width">Szerokość (m)</Label>
              <Input
                id="width"
                type="number"
                step="0.1"
                min="2"
                max="25"
                value={dimensions.width}
                onChange={(e) => updateDimension('width', parseFloat(e.target.value) || 0)}
                className="input-field"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="depthShallow">Głębokość płytka (m)</Label>
              <Input
                id="depthShallow"
                type="number"
                step="0.1"
                min="0.5"
                max="3"
                value={dimensions.depthShallow}
                onChange={(e) => updateDimension('depthShallow', parseFloat(e.target.value) || 0)}
                className="input-field"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="depthDeep">Głębokość głęboka (m)</Label>
              <Input
                id="depthDeep"
                type="number"
                step="0.1"
                min="0.5"
                max="5"
                value={dimensions.depthDeep}
                onChange={(e) => updateDimension('depthDeep', parseFloat(e.target.value) || 0)}
                className="input-field"
              />
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-3">
              <Waves className="w-5 h-5 text-primary" />
              <div>
                <Label htmlFor="irregular" className="font-medium">Kształt nieregularny</Label>
                <p className="text-xs text-muted-foreground">
                  Dopłata {companySettings.irregularSurchargePercent}% do folii
                </p>
              </div>
            </div>
            <Switch
              id="irregular"
              checked={dimensions.isIrregular}
              onCheckedChange={(checked) => updateDimension('isIrregular', checked)}
            />
          </div>
        </div>

        {/* Right: Calculations summary */}
        <div className="glass-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <Droplets className="w-5 h-5 text-primary" />
            <h3 className="text-base font-medium">Obliczenia</h3>
          </div>

          {calculations && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Objętość</p>
                  <p className="text-2xl font-bold text-primary">
                    {calculations.volume.toFixed(1)} <span className="text-sm font-normal">m³</span>
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-muted/50 border border-border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Powierzchnia lustra</p>
                  <p className="text-2xl font-bold">
                    {calculations.surfaceArea.toFixed(1)} <span className="text-sm font-normal">m²</span>
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-muted-foreground">Powierzchnia ścian</span>
                  <span className="font-medium">{calculations.wallArea.toFixed(1)} m²</span>
                </div>
                <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-muted-foreground">Obwód</span>
                  <span className="font-medium">{calculations.perimeterLength.toFixed(1)} m</span>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 text-accent mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-accent">Wymagana wydajność filtracji</p>
                    <p className="text-2xl font-bold mt-1">
                      {calculations.requiredFlow.toFixed(1)} <span className="text-sm font-normal">m³/h</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Cykl wymiany wody: {calculations.cycleTime}h ({poolTypeLabels[poolType]})
                    </p>
                  </div>
                </div>
              </div>

              {state.foilCalculation && (
                <div className="p-4 rounded-lg bg-muted/30 border border-border">
                  <p className="text-sm font-medium mb-2">Szacunkowe zapotrzebowanie folii</p>
                  <p className="text-lg font-bold">
                    {state.foilCalculation.totalArea.toFixed(1)} m²
                  </p>
                  {dimensions.isIrregular && (
                    <p className="text-xs text-warning mt-1">
                      + {companySettings.irregularSurchargePercent}% za kształt nieregularny
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Wstecz
        </Button>
        <Button onClick={onNext} className="btn-primary px-8">
          Dalej: Wykończenie
        </Button>
      </div>
    </div>
  );
}
