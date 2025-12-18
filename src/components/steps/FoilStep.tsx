import { useState, useEffect, useMemo } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { ProductCard } from '@/components/ProductCard';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Palette, Info, Calculator, CheckCircle, Eye } from 'lucide-react';
import { products, Product, getPriceInPLN } from '@/data/products';
import { formatPrice, calculateFoilOptimization, FoilRollSimulation, FoilOptimizationResult } from '@/lib/calculations';
import { OfferItem } from '@/types/configurator';
import { poolShapeLabels } from '@/types/configurator';
import { FoilLayoutVisualization } from '@/components/FoilLayoutVisualization';

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
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Kalkulacja folii basenowej</DialogTitle>
                      </DialogHeader>
                      
                      <Tabs defaultValue="calculations" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="calculations" className="gap-2">
                            <Calculator className="w-4 h-4" />
                            Kalkulacje
                          </TabsTrigger>
                          <TabsTrigger value="visualization" className="gap-2">
                            <Eye className="w-4 h-4" />
                            Wizualizacja
                          </TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="calculations" className="mt-4">
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
                          const calc = foilCalculation as FoilOptimizationResult | null;
                          
                          // Get foil prices from products
                          const foil165 = products.find(p => p.specs?.szerokosc === 1.65 && p.category === 'folia');
                          const foil205 = products.find(p => p.specs?.szerokosc === 2.05 && p.category === 'folia');
                          const pricePerM2_165 = foil165 ? getPriceInPLN(foil165) : 50;
                          const pricePerM2_205 = foil205 ? getPriceInPLN(foil205) : 50;
                          
                          const sim165 = calc?.simulation165;
                          const sim205 = calc?.simulation205;
                          
                          const cost165 = sim165 ? sim165.totalRollArea * pricePerM2_165 : 0;
                          const cost205 = sim205 ? sim205.totalRollArea * pricePerM2_205 : 0;
                          
                          return (
                            <>
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

                              {/* Waste and surcharge */}
                              <div className="p-3 rounded-lg bg-muted/50">
                                <h4 className="font-medium mb-2">Naddatki</h4>
                                <div className="space-y-1 text-muted-foreground">
                                  <p>Naddatek na spawy (~10%): <span className="text-foreground font-medium">+ {(totalBase * 0.1).toFixed(2)} m²</span></p>
                                  {calc && calc.irregularSurcharge > 0 && (
                                    <p>Nieregularny kształt (+{calc.irregularSurcharge}%): <span className="text-foreground font-medium">+ {(calc.baseAreaWithMargin * calc.irregularSurcharge / 100).toFixed(2)} m²</span></p>
                                  )}
                                  <div className="border-t border-border mt-2 pt-2">
                                    <p className="font-medium text-foreground">
                                      Powierzchnia do pokrycia: {calc?.totalArea.toFixed(2)} m²
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Two simulations comparison */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Simulation 1.65m */}
                                <div className={`p-3 rounded-lg border-2 transition-all ${calc?.suggestedRoll === '165' ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium">Rolki 1,65m</h4>
                                    {calc?.suggestedRoll === '165' && (
                                      <span className="flex items-center gap-1 text-xs text-primary font-medium">
                                        <CheckCircle className="w-3 h-3" />
                                        Sugerowane
                                      </span>
                                    )}
                                  </div>
                                  {sim165 && (
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Rozmiar rolki:</span>
                                        <span className="font-medium">1,65m × 25m</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Pow. rolki:</span>
                                        <span className="font-medium">{sim165.rollArea.toFixed(2)} m²</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Ilość rolek:</span>
                                        <span className="font-bold text-lg">{sim165.rollsNeeded} szt.</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Całk. powierzchnia:</span>
                                        <span className="font-medium">{sim165.totalRollArea.toFixed(2)} m²</span>
                                      </div>
                                      <div className="flex justify-between text-destructive">
                                        <span>Odpad:</span>
                                        <span className="font-medium">{sim165.wasteArea.toFixed(2)} m² ({sim165.wastePercentage.toFixed(1)}%)</span>
                                      </div>
                                      <div className="border-t border-border mt-2 pt-2 flex justify-between">
                                        <span className="font-medium">Szac. koszt:</span>
                                        <span className="font-bold">{formatPrice(cost165)}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Simulation 2.05m */}
                                <div className={`p-3 rounded-lg border-2 transition-all ${calc?.suggestedRoll === '205' ? 'border-primary bg-primary/10' : 'border-border bg-muted/30'}`}>
                                  <div className="flex items-center justify-between mb-2">
                                    <h4 className="font-medium">Rolki 2,05m</h4>
                                    {calc?.suggestedRoll === '205' && (
                                      <span className="flex items-center gap-1 text-xs text-primary font-medium">
                                        <CheckCircle className="w-3 h-3" />
                                        Sugerowane
                                      </span>
                                    )}
                                  </div>
                                  {sim205 && (
                                    <div className="space-y-2 text-sm">
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Rozmiar rolki:</span>
                                        <span className="font-medium">2,05m × 25m</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Pow. rolki:</span>
                                        <span className="font-medium">{sim205.rollArea.toFixed(2)} m²</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Ilość rolek:</span>
                                        <span className="font-bold text-lg">{sim205.rollsNeeded} szt.</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-muted-foreground">Całk. powierzchnia:</span>
                                        <span className="font-medium">{sim205.totalRollArea.toFixed(2)} m²</span>
                                      </div>
                                      <div className="flex justify-between text-destructive">
                                        <span>Odpad:</span>
                                        <span className="font-medium">{sim205.wasteArea.toFixed(2)} m² ({sim205.wastePercentage.toFixed(1)}%)</span>
                                      </div>
                                      <div className="border-t border-border mt-2 pt-2 flex justify-between">
                                        <span className="font-medium">Szac. koszt:</span>
                                        <span className="font-bold">{formatPrice(cost205)}</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Summary */}
                              {calc && sim165 && sim205 && (
                                <div className="p-3 rounded-lg bg-accent/10 border border-accent/20">
                                  <h4 className="font-medium mb-2 flex items-center gap-2">
                                    <Info className="w-4 h-4 text-accent" />
                                    Podsumowanie
                                  </h4>
                                  <p className="text-sm text-muted-foreground">
                                    {calc.suggestedRoll === '165' ? (
                                      <>
                                        Sugerujemy <span className="font-bold text-foreground">rolki 1,65m</span> - mniejszy całkowity odpad 
                                        ({sim165.wasteArea.toFixed(1)} m² vs {sim205.wasteArea.toFixed(1)} m²) 
                                        i niższy koszt (o {formatPrice(cost205 - cost165)} taniej).
                                      </>
                                    ) : (
                                      <>
                                        Sugerujemy <span className="font-bold text-foreground">rolki 2,05m</span> - mniejszy całkowity odpad 
                                        ({sim205.wasteArea.toFixed(1)} m² vs {sim165.wasteArea.toFixed(1)} m²) 
                                        i niższy koszt (o {formatPrice(cost165 - cost205)} taniej).
                                      </>
                                    )}
                                  </p>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                        </TabsContent>
                        
                        <TabsContent value="visualization" className="mt-4">
                          <div className="space-y-6">
                            <p className="text-sm text-muted-foreground">
                              Poniżej wizualizacja rozkładu folii na poszczególnych powierzchniach basenu.
                              Przerywana linia oznacza zakładkę (spaw) między pasami folii.
                            </p>
                            
                            <Tabs defaultValue="165" className="w-full">
                              <TabsList className="grid w-full grid-cols-2 mb-4">
                                <TabsTrigger value="165" className={(() => {
                                  const calc = foilCalculation as FoilOptimizationResult | null;
                                  return calc?.suggestedRoll === '165' ? 'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground' : '';
                                })()}>
                                  Rolki 1,65m
                                  {(() => {
                                    const calc = foilCalculation as FoilOptimizationResult | null;
                                    return calc?.suggestedRoll === '165' ? (
                                      <CheckCircle className="w-3 h-3 ml-1" />
                                    ) : null;
                                  })()}
                                </TabsTrigger>
                                <TabsTrigger value="205" className={(() => {
                                  const calc = foilCalculation as FoilOptimizationResult | null;
                                  return calc?.suggestedRoll === '205' ? 'data-[state=active]:bg-primary data-[state=active]:text-primary-foreground' : '';
                                })()}>
                                  Rolki 2,05m
                                  {(() => {
                                    const calc = foilCalculation as FoilOptimizationResult | null;
                                    return calc?.suggestedRoll === '205' ? (
                                      <CheckCircle className="w-3 h-3 ml-1" />
                                    ) : null;
                                  })()}
                                </TabsTrigger>
                              </TabsList>
                              
                              <TabsContent value="165">
                                <FoilLayoutVisualization
                                  dimensions={dimensions}
                                  rollWidth={1.65}
                                  label="Rozkład folii - rolki 1,65m"
                                />
                              </TabsContent>
                              
                              <TabsContent value="205">
                                <FoilLayoutVisualization
                                  dimensions={dimensions}
                                  rollWidth={2.05}
                                  label="Rozkład folii - rolki 2,05m"
                                />
                              </TabsContent>
                            </Tabs>
                          </div>
                        </TabsContent>
                      </Tabs>
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
