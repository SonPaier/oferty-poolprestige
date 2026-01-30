import { useEffect, useMemo, useState } from 'react';
import { useFinishingWizard } from '../FinishingWizardContext';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calculator, Loader2, Check, Info, Layers, Scissors } from 'lucide-react';
import { formatPrice, calculateFoilOptimization } from '@/lib/calculations';
import { FoilLayoutVisualization } from '@/components/FoilLayoutVisualization';
import { useSettings } from '@/context/SettingsContext';

export function Step4FoilOptimization() {
  const { state, dispatch } = useFinishingWizard();
  const { state: configuratorState } = useConfigurator();
  const { companySettings } = useSettings();
  const { dimensions, foilType } = configuratorState;
  const { isOptimizing, optimizationResults, selectedRollWidth } = state;
  const [showDetails, setShowDetails] = useState(false);
  
  // Run optimization on mount
  useEffect(() => {
    const runOptimization = async () => {
      dispatch({ type: 'SET_IS_OPTIMIZING', payload: true });
      
      try {
        // Calculate for both roll widths
        const result165 = calculateFoilOptimization(
          dimensions,
          foilType,
          companySettings.irregularSurchargePercent
        );
        
        const result205 = calculateFoilOptimization(
          dimensions,
          foilType,
          companySettings.irregularSurchargePercent
        );
        
        const results = [];
        
        if (result165) {
          results.push({
            rollWidth: 1.65 as const,
            totalAreaM2: result165.totalArea,
            wastePercentage: result165.wastePercentage,
            score: 0,
            cuttingPlan: result165.strips || [],
            wastePieces: [],
            isRecommended: true,
          });
        }
        
        if (result205) {
          results.push({
            rollWidth: 2.05 as const,
            totalAreaM2: result205.totalArea,
            wastePercentage: result205.wastePercentage,
            score: 0,
            cuttingPlan: result205.strips || [],
            wastePieces: [],
            isRecommended: result205.wastePercentage < (result165?.wastePercentage || 100),
          });
        }
        
        dispatch({ type: 'SET_OPTIMIZATION_RESULTS', payload: results });
        
        // Auto-select recommended
        const recommended = results.find(r => r.isRecommended);
        if (recommended) {
          dispatch({ type: 'SET_SELECTED_ROLL_WIDTH', payload: recommended.rollWidth });
        }
      } catch (error) {
        console.error('Optimization failed:', error);
      } finally {
        dispatch({ type: 'SET_IS_OPTIMIZING', payload: false });
      }
    };
    
    if (optimizationResults.length === 0) {
      runOptimization();
    }
  }, [dimensions, foilType, companySettings.irregularSurchargePercent, dispatch, optimizationResults.length]);
  
  const selectedResult = useMemo(() => {
    return optimizationResults.find(r => r.rollWidth === selectedRollWidth);
  }, [optimizationResults, selectedRollWidth]);
  
  const handleRollWidthChange = (value: string) => {
    dispatch({ type: 'SET_SELECTED_ROLL_WIDTH', payload: parseFloat(value) as 1.65 | 2.05 });
  };
  
  if (isOptimizing) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <div className="text-center">
          <h3 className="font-medium">Optymalizuję rozkład folii...</h3>
          <p className="text-sm text-muted-foreground">
            Obliczam najefektywniejsze ułożenie pasów
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Calculator className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Optymalizacja rozkładu folii</h2>
      </div>
      
      {/* Roll width comparison */}
      {optimizationResults.length > 1 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Porównanie szerokości rolek</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={selectedRollWidth.toString()}
              onValueChange={handleRollWidthChange}
              className="grid grid-cols-1 md:grid-cols-2 gap-4"
            >
              {optimizationResults.map((result) => (
                <div key={result.rollWidth} className="relative">
                  <RadioGroupItem
                    value={result.rollWidth.toString()}
                    id={`roll-${result.rollWidth}`}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={`roll-${result.rollWidth}`}
                    className="flex flex-col p-4 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-lg">{result.rollWidth}m</span>
                      <div className="flex items-center gap-2">
                        {result.isRecommended && (
                          <Badge className="bg-green-500">Zalecana</Badge>
                        )}
                        {selectedRollWidth === result.rollWidth && (
                          <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-3 h-3 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">Powierzchnia:</span>
                        <span className="ml-1 font-medium">{result.totalAreaM2.toFixed(2)} m²</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Odpady:</span>
                        <span className="ml-1 font-medium">{result.wastePercentage.toFixed(1)}%</span>
                      </div>
                    </div>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>
      )}
      
      {/* Selected result details */}
      {selectedResult && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Wynik optymalizacji</CardTitle>
              <Dialog open={showDetails} onOpenChange={setShowDetails}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Scissors className="w-4 h-4 mr-2" />
                    Szczegóły cięcia
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Plan cięcia folii - rolka {selectedRollWidth}m</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {/* Legend */}
                    <div className="flex items-center gap-4 p-2 rounded-lg bg-muted/30 border">
                      <span className="text-xs font-medium">Legenda:</span>
                      <span className="flex items-center gap-1 text-xs">
                        <span className="w-3 h-3 rounded-sm bg-blue-500" />
                        Folia regularna
                      </span>
                      <span className="flex items-center gap-1 text-xs">
                        <span className="w-3 h-3 rounded-sm bg-orange-500" />
                        Folia antypoślizgowa
                      </span>
                    </div>
                    
                    <FoilLayoutVisualization
                      dimensions={dimensions}
                      rollWidth={selectedRollWidth}
                      label={`Plan cięcia ${selectedRollWidth}m`}
                    />
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold text-primary">{selectedResult.totalAreaM2.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">m² folii</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{selectedResult.wastePercentage.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">odpady</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{Array.isArray(selectedResult.cuttingPlan) ? selectedResult.cuttingPlan.length : 0}</p>
                <p className="text-xs text-muted-foreground">pasów</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{selectedRollWidth}m</p>
                <p className="text-xs text-muted-foreground">szerokość</p>
              </div>
            </div>
            
            <Separator />
            
            {/* Preview visualization */}
            <div className="rounded-lg border overflow-hidden">
              <FoilLayoutVisualization
                dimensions={dimensions}
                rollWidth={selectedRollWidth}
                label={`Rozkład folii ${selectedRollWidth}m`}
              />
            </div>
            
            {/* Structural foil info */}
            {foilType === 'strukturalna' && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <Info className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-900 dark:text-amber-100">Folia strukturalna</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Wymaga zgrzewania doczołowego. Dodatkowe pozycje zostaną dodane do materiałów.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
