import { useState } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { FinishingWizardProvider, useFinishingWizard, FinishingType } from './FinishingWizardContext';
import { SubtypeCard } from './components/SubtypeCard';
import { FoilProductTable } from './components/FoilProductTable';
import { FinishingMaterialsTable } from './components/FinishingMaterialsTable';
import { CalculationDetailsDialog } from './components/CalculationDetailsDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronLeft, ChevronRight, Layers, Grid3X3, AlertTriangle, RefreshCw, Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FoilSubtype, SUBTYPE_NAMES } from '@/lib/finishingMaterials';

interface FinishingModuleWizardProps {
  onNext: () => void;
  onBack: () => void;
}

function WizardContent({ onNext, onBack }: FinishingModuleWizardProps) {
  const { state, dispatch, foilLineItem, structuralFoilLineItem, totalNet, canProceed } = useFinishingWizard();
  const { state: configuratorState } = useConfigurator();
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  
  const subtypes: FoilSubtype[] = ['jednokolorowa', 'nadruk', 'strukturalna'];

  const handleTypeSelect = (type: FinishingType) => {
    dispatch({ type: 'SET_FINISHING_TYPE', payload: type });
  };

  const handleSubtypeSelect = (subtype: FoilSubtype) => {
    dispatch({ type: 'SET_SELECTED_SUBTYPE', payload: subtype });
  };

  const handlePriceChange = (subtype: FoilSubtype, price: number) => {
    dispatch({ type: 'SET_SUBTYPE_PRICE', payload: { subtype, price } });
  };

  const handleProductSelect = (productId: string | null, productName: string | null) => {
    dispatch({ type: 'SET_SELECTED_PRODUCT', payload: { id: productId, name: productName } });
  };

  const handleUpdateMaterial = (id: string, manualQty: number | null) => {
    dispatch({ type: 'UPDATE_MATERIAL', payload: { id, manualQty } });
  };

  const handleUpdateFoilQuantity = (qty: number | null) => {
    dispatch({ type: 'SET_MANUAL_FOIL_QTY', payload: qty });
  };

  const handleRecalculate = () => {
    dispatch({ type: 'RECALCULATE_MATERIALS' });
  };

  return (
    <div className="space-y-6">
      {/* Section 1: Finishing Type Selection */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Typ wykończenia</CardTitle>
          <CardDescription>Wybierz sposób wykończenia niecki basenu</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <Card
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                state.finishingType === 'foil' && 'ring-2 ring-primary border-primary'
              )}
              onClick={() => handleTypeSelect('foil')}
            >
              <CardContent className="p-6 flex flex-col items-center text-center">
                <Layers className="w-10 h-10 mb-3 text-primary" />
                <h3 className="font-semibold text-lg">Folia PVC</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Wodoodporna membrana foliowa
                </p>
              </CardContent>
            </Card>

            <Card
              className={cn(
                'cursor-pointer transition-all hover:shadow-md',
                state.finishingType === 'ceramic' && 'ring-2 ring-primary border-primary'
              )}
              onClick={() => handleTypeSelect('ceramic')}
            >
              <CardContent className="p-6 flex flex-col items-center text-center">
                <Grid3X3 className="w-10 h-10 mb-3 text-primary" />
                <h3 className="font-semibold text-lg">Ceramika</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Płytki ceramiczne lub mozaika
                </p>
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Foil Subtype Selection (only for foil) */}
      {state.finishingType === 'foil' && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Podtyp folii</CardTitle>
            <CardDescription>Wybierz rodzaj folii - każdy ma swoją cenę za m²</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {subtypes.map((subtype) => (
                <SubtypeCard
                  key={subtype}
                  subtype={subtype}
                  price={state.subtypePrices[subtype]}
                  isSelected={state.selectedSubtype === subtype}
                  onSelect={() => handleSubtypeSelect(subtype)}
                  onPriceChange={(price) => handlePriceChange(subtype, price)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 3: Product Table (when subtype selected) */}
      {state.finishingType === 'foil' && state.selectedSubtype && state.showProductTable && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              Dostępne folie - {SUBTYPE_NAMES[state.selectedSubtype]}
            </CardTitle>
            <CardDescription>
              Opcjonalnie wybierz konkretny produkt lub pozostaw "kolor do sprecyzowania"
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FoilProductTable
              subtype={state.selectedSubtype}
              selectedProductId={state.selectedProductId}
              onSelectProduct={handleProductSelect}
            />
          </CardContent>
        </Card>
      )}

      {/* Section 4: Materials and Quantities */}
      {state.finishingType === 'foil' && state.selectedSubtype && foilLineItem && (
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-lg">Materiały i ilości</CardTitle>
                <CardDescription>
                  Powierzchnia basenu: {state.poolAreas.totalArea.toFixed(2)} m² | 
                  Obwód: {state.poolAreas.perimeter.toFixed(2)} mb
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                {state.requiresRecalculation && (
                  <Button variant="outline" size="sm" onClick={handleRecalculate}>
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Przelicz ponownie
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setShowDetailsDialog(true)}>
                  <Calculator className="w-4 h-4 mr-2" />
                  Szczegóły kalkulacji
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {state.requiresRecalculation && (
              <Alert className="mb-4">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Wymiary basenu zostały zmienione. Kliknij "Przelicz ponownie" aby zaktualizować ilości materiałów.
                </AlertDescription>
              </Alert>
            )}
            <FinishingMaterialsTable
              foilLineItem={foilLineItem}
              structuralFoilLineItem={structuralFoilLineItem}
              materials={state.materials}
              onUpdateMaterial={handleUpdateMaterial}
              onUpdateFoilQuantity={handleUpdateFoilQuantity}
              manualFoilQty={state.manualFoilQty}
            />
          </CardContent>
        </Card>
      )}

      {/* Ceramic placeholder */}
      {state.finishingType === 'ceramic' && (
        <Card>
          <CardContent className="py-12 text-center">
            <Grid3X3 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              Konfiguracja wykończenia ceramicznego - w przygotowaniu
            </p>
          </CardContent>
        </Card>
      )}

      {/* Navigation footer */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" onClick={onBack}>
              <ChevronLeft className="w-4 h-4 mr-2" />
              Poprzedni moduł
            </Button>

            <Button onClick={onNext} disabled={!canProceed}>
              Dalej
              <ChevronRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Calculation Details Dialog */}
      {state.selectedSubtype && (
        <CalculationDetailsDialog
          open={showDetailsDialog}
          onOpenChange={setShowDetailsDialog}
          poolAreas={state.poolAreas}
          dimensions={configuratorState.dimensions}
          materials={state.materials}
          foilSubtype={state.selectedSubtype}
          foilPricePerM2={state.subtypePrices[state.selectedSubtype]}
          manualFoilQty={state.manualFoilQty}
        />
      )}
    </div>
  );
}

export function FinishingModuleWizard({ onNext, onBack }: FinishingModuleWizardProps) {
  const { state } = useConfigurator();

  // Determine initial finishing type from pool configuration
  const initialType: FinishingType =
    state.dimensions.liningType === 'ceramiczny' ? 'ceramic' : 'foil';

  return (
    <FinishingWizardProvider initialFinishingType={initialType}>
      <WizardContent onNext={onNext} onBack={onBack} />
    </FinishingWizardProvider>
  );
}
