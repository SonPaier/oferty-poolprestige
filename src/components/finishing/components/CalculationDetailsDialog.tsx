import { useState, useMemo } from 'react';
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
import { RollConfigTable } from './RollConfigTable';
import { MaterialFormulasTable } from './MaterialFormulasTable';
import { Foil3DVisualization } from './Foil3DVisualization';
import { 
  autoOptimizeMixConfig, 
  updateSurfaceRollWidth,
  MixConfiguration,
  SurfaceKey,
  RollWidth
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
  const foilQty = manualFoilQty ?? poolAreas.totalArea;
  const foilTotal = foilQty * foilPricePerM2;

  // Initialize MIX configuration with auto-optimization
  const [mixConfig, setMixConfig] = useState<MixConfiguration>(() => 
    autoOptimizeMixConfig(dimensions)
  );

  // Handle surface roll width change
  const handleSurfaceRollWidthChange = (surfaceKey: SurfaceKey, newWidth: RollWidth) => {
    setMixConfig(prev => updateSurfaceRollWidth(prev, surfaceKey, newWidth, dimensions));
  };

  // Handle reset to optimal
  const handleResetToOptimal = () => {
    setMixConfig(autoOptimizeMixConfig(dimensions));
  };

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
                      <span className="text-muted-foreground">Dno:</span>
                      <span>{poolAreas.bottomArea.toFixed(2)} m²</span>
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
                        <span className="text-muted-foreground">Powierzchnia schodów:</span>
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
                        <span className="text-muted-foreground">Powierzchnia brodzika:</span>
                        <span>{(poolAreas.wadingPoolArea || 0).toFixed(2)} m²</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="p-4 rounded-lg bg-primary/10 border border-primary/30 col-span-2">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Powierzchnia całkowita:</span>
                    <span className="text-xl font-bold">{poolAreas.totalArea.toFixed(2)} m²</span>
                  </div>
                  <div className="flex justify-between text-sm text-muted-foreground mt-1">
                    <span>Obwód basenu:</span>
                    <span>{poolAreas.perimeter.toFixed(2)} mb</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Foil calculation */}
            {foilSubtype && (
              <section>
                <h3 className="font-semibold text-lg mb-3">🎨 Folia {SUBTYPE_NAMES[foilSubtype]}</h3>
                <div className="p-4 rounded-lg border bg-muted/30">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold">{foilQty.toFixed(2)} m²</div>
                      <div className="text-sm text-muted-foreground">
                        Ilość folii
                        {manualFoilQty && (
                          <span className="ml-1 text-xs text-amber-600">(ręcznie)</span>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold">{formatPrice(foilPricePerM2)} zł</div>
                      <div className="text-sm text-muted-foreground">Cena za m²</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-primary">{formatPrice(foilTotal)} zł</div>
                      <div className="text-sm text-muted-foreground">Razem folia</div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Roll Summary */}
            <section>
              <h3 className="font-semibold text-lg mb-3">📦 Podsumowanie rolek</h3>
              <RollSummary config={mixConfig} />
            </section>

            {/* Roll Configuration (MIX) */}
            <section>
              <RollConfigTable 
                config={mixConfig}
                onSurfaceRollWidthChange={handleSurfaceRollWidthChange}
                onResetToOptimal={handleResetToOptimal}
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
                  <div className="relative">
                    <Foil3DVisualization dimensions={dimensions} config={mixConfig} />
                    <p className="text-xs text-muted-foreground mt-2">
                      💡 Kliknij i przeciągnij, aby obracać. Scroll, aby powiększyć/pomniejszyć.
                    </p>
                  </div>
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
