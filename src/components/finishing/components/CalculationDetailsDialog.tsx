import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FoilLayoutVisualization } from '@/components/FoilLayoutVisualization';
import { PoolAreas, CalculatedMaterial, FoilSubtype, SUBTYPE_NAMES } from '@/lib/finishingMaterials';

import { formatPrice } from '@/lib/calculations';
import { PoolDimensions } from '@/types/configurator';
import { RollSummary } from './RollSummary';
import { MaterialFormulasTable } from './MaterialFormulasTable';
import { Pool3DVisualization } from '@/components/Pool3DVisualization';
import { 
  autoOptimizeMixConfig, 
  MixConfiguration,
  calculateFoilAreaForPricing,
  OptimizationPriority,
} from '@/lib/foil/mixPlanner';

interface CalculationDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  poolAreas: PoolAreas;
  dimensions: PoolDimensions;
  materials: CalculatedMaterial[];
  foilSubtype: FoilSubtype | null;
  foilPricePerM2: number;
  manualFoilQty: number | null;
}

export function CalculationDetailsDialog({
  open,
  onOpenChange,
  poolAreas,
  dimensions,
  materials,
  foilSubtype,
  foilPricePerM2,
  manualFoilQty,
}: CalculationDetailsDialogProps) {
  // Optimization priority state
  const [optimizationPriority, setOptimizationPriority] = useState<OptimizationPriority>('minWaste');
  
  // Initialize MIX configuration with auto-optimization (respecting foil type constraints)
  const [mixConfig, setMixConfig] = useState<MixConfiguration>(() => 
    autoOptimizeMixConfig(dimensions, foilSubtype, optimizationPriority)
  );

  // Re-optimize when foil subtype or priority changes
  useEffect(() => {
    setMixConfig(autoOptimizeMixConfig(dimensions, foilSubtype, optimizationPriority));
  }, [foilSubtype, dimensions, optimizationPriority]);

  const pricingResult = useMemo(
    () => calculateFoilAreaForPricing(mixConfig, dimensions, foilSubtype),
    [mixConfig, dimensions, foilSubtype]
  );

  // For unified structural foil, use totalArea; otherwise main + structural shown separately
  const mainFoilQty = manualFoilQty ?? pricingResult.mainFoilArea;
  const structuralFoilQty = pricingResult.structuralFoilArea;
  const totalFoilQty = manualFoilQty ?? pricingResult.totalArea;
  const foilTotal = mainFoilQty * foilPricePerM2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Szczegóły kalkulacji wykończenia</DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[80vh] pr-4">
          <div className="space-y-8">
            {/* Area breakdown */}
            <section>
              <h3 className="font-semibold text-lg mb-3">📐 Powierzchnie</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-lg bg-muted/50 border">
                  <h4 className="font-medium mb-2">Niecka basenu</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dno (brutto):</span>
                      <span>{poolAreas.bottomArea.toFixed(2)} m²</span>
                    </div>
                    {(poolAreas.stairsProjection || 0) > 0 && (
                      <div className="flex justify-between text-orange-600">
                        <span>− Rzut schodów:</span>
                        <span>−{(poolAreas.stairsProjection || 0).toFixed(2)} m²</span>
                      </div>
                    )}
                    {(poolAreas.wadingPoolProjection || 0) > 0 && (
                      <div className="flex justify-between text-blue-600">
                        <span>− Rzut brodzika:</span>
                        <span>−{(poolAreas.wadingPoolProjection || 0).toFixed(2)} m²</span>
                      </div>
                    )}
                    <div className="flex justify-between font-medium border-t pt-1">
                      <span>Dno (netto):</span>
                      <span>{poolAreas.netBottomArea.toFixed(2)} m²</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Ściany (4×):</span>
                      <span>{poolAreas.wallArea.toFixed(2)} m²</span>
                    </div>
                  </div>
                </div>

                {dimensions.stairs?.enabled && (
                  <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      📐 Schody
                      <span className="text-xs px-1.5 py-0.5 rounded bg-orange-100 dark:bg-orange-800 text-orange-700 dark:text-orange-300">
                        antypoślizgowe
                      </span>
                    </h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rzut (na dnie):</span>
                        <span className="text-orange-600">−{(poolAreas.stairsProjection || 0).toFixed(2)} m²</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Powierzchnia folii:</span>
                        <span>{(poolAreas.stairsArea || 0).toFixed(2)} m²</span>
                      </div>
                    </div>
                  </div>
                )}

                {dimensions.wadingPool?.enabled && (
                  <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      🌊 Brodzik
                      <span className="text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-300">
                        dno antypoślizgowe
                      </span>
                    </h4>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Rzut (na dnie):</span>
                        <span className="text-blue-600">−{(poolAreas.wadingPoolProjection || 0).toFixed(2)} m²</span>
                      </div>
                      <div className="flex justify-between font-medium">
                        <span>Powierzchnia folii:</span>
                        <span>{(poolAreas.wadingPoolArea || 0).toFixed(2)} m²</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 col-span-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Powierzchnia całkowita folii:</span>
                    <span className="text-xl font-bold">{poolAreas.totalArea.toFixed(2)} m²</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    = Dno netto ({poolAreas.netBottomArea.toFixed(2)}) + Ściany ({poolAreas.wallArea.toFixed(2)}) 
                    {(poolAreas.stairsArea || 0) > 0 && ` + Schody (${(poolAreas.stairsArea || 0).toFixed(2)})`}
                    {(poolAreas.wadingPoolArea || 0) > 0 && ` + Brodzik (${(poolAreas.wadingPoolArea || 0).toFixed(2)})`}
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground mt-2">
                    <span>Obwód basenu:</span>
                    <span>{poolAreas.perimeter.toFixed(2)} mb</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Foil calculation - separated by type */}
            {foilSubtype && (
              <section>
                <h3 className="font-semibold text-lg mb-3">🎨 Wycena folii</h3>
                
                {/* Main foil */}
                <div className="p-4 rounded-lg border bg-blue-50/50 dark:bg-blue-900/10 mb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-blue-700 dark:text-blue-300">
                      Folia główna ({SUBTYPE_NAMES[foilSubtype]})
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-xl font-bold">{mainFoilQty} m²</div>
                      <div className="text-xs text-muted-foreground">Ilość folii</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold">{pricingResult.mainWeldArea.toFixed(1)} m²</div>
                      <div className="text-xs text-muted-foreground">w tym zakład</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold">{formatPrice(foilPricePerM2)} zł</div>
                      <div className="text-xs text-muted-foreground">Cena za m²</div>
                    </div>
                    <div>
                      <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {formatPrice(mainFoilQty * foilPricePerM2)} zł
                      </div>
                      <div className="text-xs text-muted-foreground">Razem</div>
                    </div>
                  </div>
                </div>

                {/* Structural foil (only if present) */}
                {structuralFoilQty > 0 && foilSubtype !== 'strukturalna' && (
                  <div className="p-4 rounded-lg border bg-amber-50/50 dark:bg-amber-900/10 mb-3">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-amber-700 dark:text-amber-300">
                        Folia strukturalna (schody + brodzik)
                      </span>
                    </div>
                    <div className="grid grid-cols-4 gap-4 text-center">
                      <div>
                        <div className="text-xl font-bold">{structuralFoilQty} m²</div>
                        <div className="text-xs text-muted-foreground">Ilość folii</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold">{pricingResult.structuralWeldArea.toFixed(1)} m²</div>
                        <div className="text-xs text-muted-foreground">w tym zakład</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold">{formatPrice(210)} zł</div>
                        <div className="text-xs text-muted-foreground">Cena za m²</div>
                      </div>
                      <div>
                        <div className="text-xl font-bold text-amber-600 dark:text-amber-400">
                          {formatPrice(structuralFoilQty * 210)} zł
                        </div>
                        <div className="text-xs text-muted-foreground">Razem</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Total */}
                <div className="p-4 rounded-lg border bg-primary/10">
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">Razem folia:</span>
                    <span className="text-2xl font-bold text-primary">
                      {formatPrice(
                        mainFoilQty * foilPricePerM2 + 
                        (foilSubtype !== 'strukturalna' ? structuralFoilQty * 210 : 0)
                      )} zł
                    </span>
                  </div>
                  {manualFoilQty && (
                    <div className="text-xs text-amber-600 mt-1">(ilość główna ustawiona ręcznie)</div>
                  )}
                </div>
              </section>
            )}

            {/* Roll Summary */}
            <section>
              <h3 className="font-semibold text-lg mb-3">📦 Podsumowanie rolek</h3>
              <RollSummary 
                config={mixConfig} 
                dimensions={dimensions}
                foilSubtype={foilSubtype}
                isMainFoilStructural={foilSubtype === 'strukturalna'} 
                mainFoilAreaForPricing={mainFoilQty}
                mainWeldArea={pricingResult.mainWeldArea}
                structuralFoilAreaForPricing={structuralFoilQty}
                structuralWeldArea={pricingResult.structuralWeldArea}
                foilAreaForPricing={totalFoilQty}
                optimizationPriority={optimizationPriority}
                onPriorityChange={setOptimizationPriority}
              />
            </section>


            {/* Foil strip visualization with tabs */}
            <section>
              <h3 className="font-semibold text-lg mb-3">🔧 Wizualizacja rozkładu pasów folii</h3>
              <Tabs defaultValue="2d" className="w-full">
                <TabsList className="grid w-full grid-cols-4 mb-4">
                  <TabsTrigger value="3d">Widok 3D</TabsTrigger>
                  <TabsTrigger value="2d">2D Rozłożone</TabsTrigger>
                  <TabsTrigger value="1.65">Rolka 1.65m</TabsTrigger>
                  <TabsTrigger value="2.05">Rolka 2.05m</TabsTrigger>
                </TabsList>
                
                <TabsContent value="3d">
                  <div className="relative h-[400px] border rounded-lg overflow-hidden">
                    <Pool3DVisualization 
                      dimensions={dimensions}
                      calculations={null}
                      rollWidth={mixConfig.surfaces[0]?.rollWidth || 1.65}
                      showFoilLayout={true}
                      height={400}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    💡 Kliknij i przeciągnij, aby obracać. Scroll, aby powiększyć/pomniejszyć.
                  </p>
                </TabsContent>

                <TabsContent value="2d">
                  <FoilLayoutVisualization
                    dimensions={dimensions}
                    rollWidth={mixConfig.surfaces[0]?.rollWidth || 1.65}
                    label="Rozkład pasów - wszystkie powierzchnie"
                    showAntiSlipIndicators={dimensions.stairs?.enabled || dimensions.wadingPool?.enabled}
                  />
                </TabsContent>
                
                <TabsContent value="1.65">
                  <FoilLayoutVisualization
                    dimensions={dimensions}
                    rollWidth={1.65}
                    label="Rozkład pasów dla rolki 1.65m"
                    showAntiSlipIndicators={dimensions.stairs?.enabled || dimensions.wadingPool?.enabled}
                  />
                </TabsContent>
                
                <TabsContent value="2.05">
                  <FoilLayoutVisualization
                    dimensions={dimensions}
                    rollWidth={2.05}
                    label="Rozkład pasów dla rolki 2.05m"
                    showAntiSlipIndicators={dimensions.stairs?.enabled || dimensions.wadingPool?.enabled}
                  />
                </TabsContent>
              </Tabs>
            </section>

            {/* Material Formulas Table */}
            <section>
              <MaterialFormulasTable poolAreas={poolAreas} />
            </section>

            {/* Materials breakdown */}
            <section>
              <h3 className="font-semibold text-lg mb-3">📦 Materiały montażowe</h3>
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left p-3 font-medium">Materiał</th>
                      <th className="text-right p-3 font-medium">Ilość</th>
                      <th className="text-center p-3 font-medium">Jedn.</th>
                      <th className="text-right p-3 font-medium">Cena/jedn.</th>
                      <th className="text-right p-3 font-medium">Razem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materials.map((material) => {
                      const qty = material.manualQty ?? material.suggestedQty;
                      const total = qty * material.pricePerUnit;
                      return (
                        <tr key={material.id} className="border-t">
                          <td className="p-3">
                            <div className="font-medium">{material.name}</div>
                            <div className="text-xs text-muted-foreground">{material.symbol}</div>
                          </td>
                          <td className="p-3 text-right">
                            {qty}
                            {material.manualQty !== null && (
                              <span className="ml-1 text-xs text-amber-600">✎</span>
                            )}
                          </td>
                          <td className="p-3 text-center text-muted-foreground">{material.unit}</td>
                          <td className="p-3 text-right">{formatPrice(material.pricePerUnit)} zł</td>
                          <td className="p-3 text-right font-medium">{formatPrice(total)} zł</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-muted/30">
                    <tr className="border-t-2">
                      <td colSpan={4} className="p-3 font-medium">Razem materiały</td>
                      <td className="p-3 text-right font-bold">
                        {formatPrice(materials.reduce((sum, m) => {
                          const qty = m.manualQty ?? m.suggestedQty;
                          return sum + qty * m.pricePerUnit;
                        }, 0))} zł
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            {/* Note about structural foils */}
            {foilSubtype === 'strukturalna' && (
              <section className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <h4 className="font-medium mb-2 flex items-center gap-2">
                  ℹ️ Folia strukturalna
                </h4>
                <p className="text-sm text-muted-foreground">
                  Folie strukturalne (Relief, Touch) są jednocześnie antypoślizgowe, 
                  więc mogą być stosowane na schodach i dnie brodzika bez dodatkowej folii antypoślizgowej.
                  Używają zgrzewania doczołowego (butt joint), które wymaga specjalnej usługi spawania.
                </p>
              </section>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
