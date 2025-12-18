import { useState, useEffect } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ProductCard } from '@/components/ProductCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Palette, Info, Calculator } from 'lucide-react';
import { products, Product, getPriceInPLN } from '@/data/products';
import { formatPrice, calculateFoilOptimization } from '@/lib/calculations';
import { OfferItem } from '@/types/configurator';
import { poolShapeLabels } from '@/types/configurator';

interface FoilStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function FoilStep({ onNext, onBack }: FoilStepProps) {
  const { state, dispatch, companySettings } = useConfigurator();
  const { foilType, foilCalculation, dimensions, sections } = state;

  const foilProducts = products.filter(p => p.category === 'folia');
  const [selectedFoil, setSelectedFoil] = useState<Product | null>(
    sections.wykonczenie.items[0]?.product || null
  );

  useEffect(() => {
    // Recalculate foil when type changes
    const calc = calculateFoilOptimization(
      dimensions, 
      foilType,
      companySettings.irregularSurchargePercent
    );
    dispatch({ type: 'SET_FOIL_CALCULATION', payload: calc });
  }, [foilType, dimensions, companySettings.irregularSurchargePercent]);

  const handleFoilSelect = (product: Product) => {
    setSelectedFoil(product);
    
    // Update section with selected foil
    const item: OfferItem = {
      id: `foil-${product.id}`,
      product,
      quantity: Math.ceil(foilCalculation?.totalArea || 0),
    };
    
    dispatch({
      type: 'SET_SECTION',
      payload: {
        section: 'wykonczenie',
        data: {
          ...sections.wykonczenie,
          items: [item],
          suggestedProduct: product,
        },
      },
    });
  };

  const traditionalFoils = foilProducts.filter(
    p => p.specs?.typ === 'tradycyjna' || !p.specs?.typ
  );
  const structuralFoils = foilProducts.filter(
    p => p.specs?.typ === 'strukturalna' || p.specs?.typ === 'antyposlizgowa'
  );

  const displayedFoils = foilType === 'tradycyjna' ? traditionalFoils : structuralFoils;

  return (
    <div className="animate-slide-up">
      <div className="section-header">
        <Palette className="w-5 h-5 text-primary" />
        Wykończenie basenu - Folia
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Foil type selection */}
        <div className="glass-card p-6">
          <h3 className="text-base font-medium mb-4">Typ folii</h3>
          
          <RadioGroup
            value={foilType}
            onValueChange={(value) => dispatch({ 
              type: 'SET_FOIL_TYPE', 
              payload: value as 'tradycyjna' | 'strukturalna' 
            })}
            className="space-y-3"
          >
            <div className="relative">
              <RadioGroupItem value="tradycyjna" id="tradycyjna" className="peer sr-only" />
              <Label
                htmlFor="tradycyjna"
                className="flex flex-col p-4 rounded-lg border border-border bg-muted/30 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 hover:bg-muted/50"
              >
                <span className="font-medium">Folia tradycyjna</span>
                <span className="text-xs text-muted-foreground mt-1">
                  Alkorplan 2000 - gładka, jednolita
                </span>
              </Label>
            </div>
            
            <div className="relative">
              <RadioGroupItem value="strukturalna" id="strukturalna" className="peer sr-only" />
              <Label
                htmlFor="strukturalna"
                className="flex flex-col p-4 rounded-lg border border-border bg-muted/30 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 hover:bg-muted/50"
              >
                <span className="font-medium">Folia strukturalna</span>
                <span className="text-xs text-muted-foreground mt-1">
                  Alkorplan 3000 - wzory, premium
                </span>
              </Label>
            </div>
          </RadioGroup>

          {foilCalculation && (
            <div className="mt-6 p-4 rounded-lg bg-accent/10 border border-accent/20">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-accent mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Zapotrzebowanie</p>
                  <p className="text-xl font-bold mt-1">
                    {foilCalculation.totalArea.toFixed(1)} m²
                  </p>
                  <div className="text-xs text-muted-foreground mt-2 space-y-1">
                    <p>Rolki 1,65m: ~{foilCalculation.rolls165}</p>
                    <p>Rolki 2,05m: ~{foilCalculation.rolls205}</p>
                    {foilCalculation.irregularSurcharge > 0 && (
                      <p className="text-warning">
                        + {foilCalculation.irregularSurcharge}% nieregularny kształt
                      </p>
                    )}
                  </div>
                  
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="mt-3 w-full">
                        <Calculator className="w-4 h-4 mr-2" />
                        Zobacz kalkulacje
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Kalkulacja folii basenowej</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 text-sm">
                        {/* Pool dimensions */}
                        <div className="p-3 rounded-lg bg-muted/50">
                          <h4 className="font-medium mb-2">Wymiary basenu</h4>
                          <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                            <p>Długość: <span className="text-foreground font-medium">{dimensions.length} m</span></p>
                            <p>Szerokość: <span className="text-foreground font-medium">{dimensions.width} m</span></p>
                            <p>Głębokość płytka: <span className="text-foreground font-medium">{dimensions.depthShallow} m</span></p>
                            <p>Głębokość głęboka: <span className="text-foreground font-medium">{dimensions.depthDeep} m</span></p>
                            <p>Kształt: <span className="text-foreground font-medium">{poolShapeLabels[dimensions.shape]}</span></p>
                          </div>
                        </div>

                        {/* Surface calculation */}
                        {(() => {
                          const avgDepth = (dimensions.depthShallow + dimensions.depthDeep) / 2;
                          const bottomArea = dimensions.length * dimensions.width;
                          const wallsLength = 2 * dimensions.length * avgDepth;
                          const wallsWidth = 2 * dimensions.width * avgDepth;
                          const totalBase = bottomArea + wallsLength + wallsWidth;
                          
                          return (
                            <div className="p-3 rounded-lg bg-muted/50">
                              <h4 className="font-medium mb-2">Obliczenie powierzchni</h4>
                              <div className="space-y-1 text-muted-foreground">
                                <p>Dno basenu: <span className="text-foreground font-medium">{bottomArea.toFixed(2)} m²</span></p>
                                <p>Ściany boczne (dł.): <span className="text-foreground font-medium">2 × {dimensions.length} × {avgDepth.toFixed(2)} = {wallsLength.toFixed(2)} m²</span></p>
                                <p>Ściany boczne (szer.): <span className="text-foreground font-medium">2 × {dimensions.width} × {avgDepth.toFixed(2)} = {wallsWidth.toFixed(2)} m²</span></p>
                                <p className="text-xs italic">* Średnia głębokość: ({dimensions.depthShallow} + {dimensions.depthDeep}) / 2 = {avgDepth.toFixed(2)} m</p>
                                <div className="border-t border-border mt-2 pt-2">
                                  <p className="font-medium text-foreground">
                                    Suma podstawowa: {totalBase.toFixed(2)} m²
                                  </p>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Waste and surcharge */}
                        <div className="p-3 rounded-lg bg-muted/50">
                          <h4 className="font-medium mb-2">Naddatki i odpady</h4>
                          <div className="space-y-1 text-muted-foreground">
                            <p>Naddatek na spawy (~10%): <span className="text-foreground font-medium">+ {(foilCalculation.totalArea * 0.1 / 1.1).toFixed(2)} m²</span></p>
                            {foilCalculation.irregularSurcharge > 0 && (
                              <p>Nieregularny kształt (+{foilCalculation.irregularSurcharge}%): <span className="text-foreground font-medium">+ {(foilCalculation.totalArea * foilCalculation.irregularSurcharge / 100 / (1 + foilCalculation.irregularSurcharge / 100)).toFixed(2)} m²</span></p>
                            )}
                            <p>Szacowany odpad: <span className="text-foreground font-medium">~{foilCalculation.wastePercentage.toFixed(1)}%</span></p>
                          </div>
                        </div>

                        {/* Roll calculation */}
                        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                          <h4 className="font-medium mb-2">Potrzebne rolki</h4>
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Rolki 1,65m × 25m (41,25 m²):</span>
                              <span className="font-bold text-primary">{foilCalculation.rolls165} szt.</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">Rolki 2,05m × 25m (51,25 m²):</span>
                              <span className="font-bold text-primary">{foilCalculation.rolls205} szt.</span>
                            </div>
                            <div className="border-t border-border mt-2 pt-2">
                              <div className="flex justify-between items-center">
                                <span className="font-medium">Całkowita powierzchnia:</span>
                                <span className="font-bold text-lg">{foilCalculation.totalArea.toFixed(1)} m²</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right: Foil products */}
        <div className="lg:col-span-2 glass-card p-6">
          <h3 className="text-base font-medium mb-4">Wybierz folię</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {displayedFoils.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                isSelected={selectedFoil?.id === product.id}
                isSuggested={index === 0}
                onSelect={() => handleFoilSelect(product)}
              />
            ))}
          </div>

          {selectedFoil && foilCalculation && (
            <div className="mt-6 p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-muted-foreground">Szacunkowy koszt folii</p>
                  <p className="text-sm">{selectedFoil.name}</p>
                </div>
                <p className="text-2xl font-bold text-primary">
                  {formatPrice(getPriceInPLN(selectedFoil) * foilCalculation.totalArea)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between mt-6">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Wstecz
        </Button>
        <Button 
          onClick={onNext} 
          className="btn-primary px-8"
          disabled={!selectedFoil}
        >
          Dalej: Uzbrojenie
        </Button>
      </div>
    </div>
  );
}
