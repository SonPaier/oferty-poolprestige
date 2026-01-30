import { useState } from 'react';
import { useFinishingWizard, VariantLevel } from '../FinishingWizardContext';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Check, 
  Save, 
  FileText, 
  Loader2, 
  CheckCircle2,
  Package,
  Wrench,
  Layers
} from 'lucide-react';
import { formatPrice } from '@/lib/calculations';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Step7ReviewSaveProps {
  onComplete: () => void;
}

export function Step7ReviewSave({ onComplete }: Step7ReviewSaveProps) {
  const { state, dispatch } = useFinishingWizard();
  const { state: configuratorState, dispatch: configuratorDispatch } = useConfigurator();
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  
  const {
    finishingType,
    selectionLevel,
    selectedSubtype,
    selectedSeries,
    selectedProductId,
    selectedRollWidth,
    optimizationResults,
    materials,
    services,
    variants,
    defaultVariant,
  } = state;
  
  const selectedOptimization = optimizationResults.find(r => r.rollWidth === selectedRollWidth);
  
  // Get selection description
  const getSelectionDescription = () => {
    switch (selectionLevel) {
      case 'subtype':
        return `Podtyp: ${selectedSubtype}`;
      case 'series':
        return `Seria: ${selectedSeries?.manufacturer} - ${selectedSeries?.series}`;
      case 'product':
        return `Produkt ID: ${selectedProductId}`;
      default:
        return 'Nie wybrano';
    }
  };
  
  // Calculate totals
  const materialsTotalNet = materials.reduce((sum, m) => {
    const qty = m.manualQty ?? m.suggestedQty;
    return sum + qty * m.pricePerUnit;
  }, 0);
  
  const servicesTotalNet = services
    .filter(s => s.isEnabled)
    .reduce((sum, s) => sum + s.total, 0);
  
  const defaultVariantData = variants[defaultVariant];
  
  const handleSaveAsDraft = async () => {
    dispatch({ type: 'SET_IS_DRAFT', payload: true });
    toast.success('Zapisano jako draft');
  };
  
  const handleSaveAndContinue = async () => {
    setIsSaving(true);
    
    try {
      // Prepare data for configurator context
      const finishingData = {
        type: finishingType,
        selectionLevel,
        selectedSubtype,
        selectedSeries,
        selectedProductId,
        rollWidth: selectedRollWidth,
        materials: materials.map(m => ({
          ...m,
          finalQty: m.manualQty ?? m.suggestedQty,
        })),
        services: services.filter(s => s.isEnabled),
        variants: {
          economy: variants.economy ? {
            ...variants.economy,
            isDefault: defaultVariant === 'economy',
          } : null,
          standard: variants.standard ? {
            ...variants.standard,
            isDefault: defaultVariant === 'standard',
          } : null,
          premium: variants.premium ? {
            ...variants.premium,
            isDefault: defaultVariant === 'premium',
          } : null,
        },
        defaultVariant,
        totalMaterialsNet: materialsTotalNet,
        totalServicesNet: servicesTotalNet,
      };
      
      // Update configurator state with finishing data
      configuratorDispatch({
        type: 'SET_SECTION',
        payload: {
          section: 'wykonczenie',
          data: {
            id: 'wykonczenie',
            name: 'Wykończenie basenu',
            items: [], // Will be populated from variants
            notes: JSON.stringify(finishingData), // Store config as notes temporarily
          },
        },
      });
      
      setIsSaved(true);
      toast.success('Zapisano konfigurację wykończenia');
      
      // Wait a moment before proceeding
      setTimeout(() => {
        onComplete();
      }, 500);
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('Wystąpił błąd podczas zapisywania');
    } finally {
      setIsSaving(false);
    }
  };
  
  const variantLabels: Record<VariantLevel, string> = {
    economy: 'Ekonomiczny',
    standard: 'Standard',
    premium: 'Premium',
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <FileText className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Podsumowanie i zapis</h2>
      </div>
      
      {/* Success state */}
      {isSaved && (
        <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
          <CheckCircle2 className="w-6 h-6 text-green-600" />
          <div>
            <p className="font-medium text-green-900 dark:text-green-100">Zapisano pomyślnie!</p>
            <p className="text-sm text-green-700 dark:text-green-300">
              Przechodzenie do następnego modułu...
            </p>
          </div>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column: Configuration summary */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Layers className="w-4 h-4" />
                Konfiguracja wykończenia
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Typ wykończenia</span>
                <Badge variant="outline">
                  {finishingType === 'foil' ? 'Folia' : 'Ceramika'}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Poziom wyboru</span>
                <span className="text-sm font-medium">{getSelectionDescription()}</span>
              </div>
              {finishingType === 'foil' && selectedOptimization && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Szerokość rolki</span>
                    <span className="text-sm font-medium">{selectedRollWidth}m</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Powierzchnia folii</span>
                    <span className="text-sm font-medium">
                      {selectedOptimization.totalAreaM2.toFixed(2)} m²
                    </span>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          
          {/* Materials summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="w-4 h-4" />
                Materiały ({materials.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {materials.slice(0, 5).map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-sm">
                    <span className="truncate mr-2">{m.name}</span>
                    <span className="text-muted-foreground shrink-0">
                      {m.manualQty ?? m.suggestedQty} {m.unit}
                    </span>
                  </div>
                ))}
                {materials.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    ...i {materials.length - 5} więcej
                  </p>
                )}
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between font-medium">
                <span>Suma materiałów</span>
                <span>{formatPrice(materialsTotalNet)} zł</span>
              </div>
            </CardContent>
          </Card>
          
          {/* Services summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                Usługi ({services.filter(s => s.isEnabled).length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-[150px] overflow-y-auto">
                {services.filter(s => s.isEnabled).slice(0, 4).map((s) => (
                  <div key={s.id} className="flex items-center justify-between text-sm">
                    <span className="truncate mr-2">{s.name}</span>
                    <span className="text-muted-foreground shrink-0">
                      {formatPrice(s.total)} zł
                    </span>
                  </div>
                ))}
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between font-medium">
                <span>Suma usług</span>
                <span>{formatPrice(servicesTotalNet)} zł</span>
              </div>
            </CardContent>
          </Card>
        </div>
        
        {/* Right column: Variants summary */}
        <div className="space-y-4">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Wariant domyślny</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <Badge className="text-base px-3 py-1">
                  {variantLabels[defaultVariant]}
                </Badge>
                <span className="text-2xl font-bold text-primary">
                  {defaultVariantData ? formatPrice(defaultVariantData.totalGross) : 0} zł
                </span>
              </div>
              {defaultVariantData && (
                <div className="text-sm text-muted-foreground">
                  <p>Produkt: {defaultVariantData.productName}</p>
                  <p>Cena jednostkowa: {formatPrice(defaultVariantData.productPrice)} zł/m²</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* All variants comparison */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Wszystkie warianty</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(['economy', 'standard', 'premium'] as VariantLevel[]).map((level) => {
                  const variant = variants[level];
                  if (!variant) return null;
                  
                  const isDefault = level === defaultVariant;
                  
                  return (
                    <div
                      key={level}
                      className={`flex items-center justify-between p-3 rounded-lg ${
                        isDefault ? 'bg-primary/10 border border-primary/30' : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isDefault && <Check className="w-4 h-4 text-primary" />}
                        <span className={isDefault ? 'font-medium' : ''}>
                          {variantLabels[level]}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold">{formatPrice(variant.totalGross)} zł</p>
                        <p className="text-xs text-muted-foreground">
                          ({formatPrice(variant.totalNet)} zł netto)
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Action buttons */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={handleSaveAsDraft}
              disabled={isSaving || isSaved}
            >
              <Save className="w-4 h-4 mr-2" />
              Zapisz jako draft
            </Button>
            
            <Button
              onClick={handleSaveAndContinue}
              disabled={isSaving || isSaved}
              size="lg"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Zapisywanie...
                </>
              ) : isSaved ? (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Zapisano
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Zapisz i kontynuuj
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
