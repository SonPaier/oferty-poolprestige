import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Shovel, Hammer, HardHat } from 'lucide-react';
import { CompanySettings, ConstructionMaterialRates, defaultConstructionMaterialRates } from '@/types/configurator';
import { ExcavationSettings } from '@/types/offers';

interface DefaultRatesSettingsProps {
  excavation: ExcavationSettings;
  onExcavationChange: (settings: ExcavationSettings) => void;
  company: CompanySettings;
  onCompanyChange: (settings: CompanySettings) => void;
}

export function DefaultRatesSettings({
  excavation,
  onExcavationChange,
  company,
  onCompanyChange,
}: DefaultRatesSettingsProps) {
  const materialRates = company.constructionMaterialRates || defaultConstructionMaterialRates;

  const updateMaterialRate = (key: keyof ConstructionMaterialRates, value: number) => {
    onCompanyChange({
      ...company,
      constructionMaterialRates: {
        ...materialRates,
        [key]: value,
      },
    });
  };

  return (
    <div className="space-y-6">
      {/* Excavation Rates */}
      <div>
        <h3 className="font-medium flex items-center gap-2 mb-4">
          <Shovel className="w-4 h-4 text-primary" />
          Roboty ziemne
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rateExcavation">Wykop (PLN/m³)</Label>
            <Input
              id="rateExcavation"
              type="number"
              min="0"
              step="1"
              value={excavation.pricePerM3}
              onChange={(e) => onExcavationChange({ 
                ...excavation, 
                pricePerM3: Math.round(parseFloat(e.target.value) || 0)
              })}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rateRemoval">Wywóz ziemi (PLN/m³)</Label>
            <Input
              id="rateRemoval"
              type="number"
              min="0"
              step="1"
              value={excavation.removalFixedPrice}
              onChange={(e) => onExcavationChange({ 
                ...excavation, 
                removalFixedPrice: Math.round(parseFloat(e.target.value) || 0)
              })}
              className="input-field"
            />
            <p className="text-xs text-muted-foreground">
              Domyślna stawka za m³ (ryczałt wybierany ręcznie)
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ratePodsypka">Podsypka piaskowa (PLN/m³)</Label>
            <Input
              id="ratePodsypka"
              type="number"
              min="0"
              step="1"
              value={excavation.podsypkaRate}
              onChange={(e) => onExcavationChange({ 
                ...excavation, 
                podsypkaRate: parseFloat(e.target.value) || 0
              })}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rateDrainage">Drenaż opaskowy (PLN/mb)</Label>
            <Input
              id="rateDrainage"
              type="number"
              min="0"
              step="1"
              value={excavation.drainageRate}
              onChange={(e) => onExcavationChange({ 
                ...excavation, 
                drainageRate: parseFloat(e.target.value) || 0
              })}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rateBackfill">Zakopanie-koparka (PLN/m³)</Label>
            <Input
              id="rateBackfill"
              type="number"
              min="0"
              step="1"
              value={excavation.backfillRate}
              onChange={(e) => onExcavationChange({ 
                ...excavation, 
                backfillRate: Math.round(parseFloat(e.target.value) || 0)
              })}
              className="input-field"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Construction Material Rates */}
      <div>
        <h3 className="font-medium flex items-center gap-2 mb-4">
          <Hammer className="w-4 h-4 text-primary" />
          Materiały budowlane
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rateBetonB15">Beton B15 (PLN/m³)</Label>
            <Input
              id="rateBetonB15"
              type="number"
              min="0"
              step="10"
              value={materialRates.betonB15}
              onChange={(e) => updateMaterialRate('betonB15', parseFloat(e.target.value) || 0)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rateBetonB25">Beton B25 (PLN/m³)</Label>
            <Input
              id="rateBetonB25"
              type="number"
              min="0"
              step="10"
              value={materialRates.betonB25}
              onChange={(e) => updateMaterialRate('betonB25', parseFloat(e.target.value) || 0)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rateBloczek">Bloczek betonowy (PLN/szt.)</Label>
            <Input
              id="rateBloczek"
              type="number"
              min="0"
              step="0.1"
              value={materialRates.bloczek}
              onChange={(e) => updateMaterialRate('bloczek', parseFloat(e.target.value) || 0)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rateZbrojenie12">Zbrojenie 12mm (PLN/kg)</Label>
            <Input
              id="rateZbrojenie12"
              type="number"
              min="0"
              step="0.1"
              value={materialRates.zbrojenie12mm}
              onChange={(e) => updateMaterialRate('zbrojenie12mm', parseFloat(e.target.value) || 0)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rateZbrojenie6">Zbrojenie 6mm (PLN/kg)</Label>
            <Input
              id="rateZbrojenie6"
              type="number"
              min="0"
              step="0.1"
              value={materialRates.zbrojenie6mm}
              onChange={(e) => updateMaterialRate('zbrojenie6mm', parseFloat(e.target.value) || 0)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rateStrzemiona">Strzemiona (PLN/szt.)</Label>
            <Input
              id="rateStrzemiona"
              type="number"
              min="0"
              step="0.1"
              value={materialRates.strzemiona}
              onChange={(e) => updateMaterialRate('strzemiona', parseFloat(e.target.value) || 0)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rateXpsFloor5">XPS 500 dno 5cm (PLN/opak.)</Label>
            <Input
              id="rateXpsFloor5"
              type="number"
              min="0"
              step="1"
              value={materialRates.xpsFloor5cm}
              onChange={(e) => updateMaterialRate('xpsFloor5cm', parseFloat(e.target.value) || 0)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rateXpsFloor10">XPS 500 dno 10cm (PLN/opak.)</Label>
            <Input
              id="rateXpsFloor10"
              type="number"
              min="0"
              step="1"
              value={materialRates.xpsFloor10cm}
              onChange={(e) => updateMaterialRate('xpsFloor10cm', parseFloat(e.target.value) || 0)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rateXpsWall5">XPS 300 ściany 5cm (PLN/opak.)</Label>
            <Input
              id="rateXpsWall5"
              type="number"
              min="0"
              step="1"
              value={materialRates.xpsWall5cm}
              onChange={(e) => updateMaterialRate('xpsWall5cm', parseFloat(e.target.value) || 0)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rateXpsWall10">XPS 300 ściany 10cm (PLN/opak.)</Label>
            <Input
              id="rateXpsWall10"
              type="number"
              min="0"
              step="1"
              value={materialRates.xpsWall10cm}
              onChange={(e) => updateMaterialRate('xpsWall10cm', parseFloat(e.target.value) || 0)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ratePurFoam">Piana PUR 5cm ściany (PLN/m²)</Label>
            <Input
              id="ratePurFoam"
              type="number"
              min="0"
              step="1"
              value={materialRates.purFoam5cm}
              onChange={(e) => updateMaterialRate('purFoam5cm', parseFloat(e.target.value) || 0)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rateZbrojenieKompozytowe">Zbrojenie kompozytowe (PLN/mb)</Label>
            <Input
              id="rateZbrojenieKompozytowe"
              type="number"
              min="0"
              step="0.1"
              value={materialRates.zbrojenieKompozytowe}
              onChange={(e) => updateMaterialRate('zbrojenieKompozytowe', parseFloat(e.target.value) || 0)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ratePompogruszka">Pompogruszka (PLN/szt.)</Label>
            <Input
              id="ratePompogruszka"
              type="number"
              min="0"
              step="10"
              value={materialRates.pompogruszka}
              onChange={(e) => updateMaterialRate('pompogruszka', parseFloat(e.target.value) || 0)}
              className="input-field"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Labor Rates */}
      <div>
        <h3 className="font-medium flex items-center gap-2 mb-4">
          <HardHat className="w-4 h-4 text-primary" />
          Koszt budowy (robocizna)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="rateLaborPool">Prace budowlane – basen (PLN/m²)</Label>
            <Input
              id="rateLaborPool"
              type="number"
              min="0"
              step="10"
              value={materialRates.laborPoolRate}
              onChange={(e) => updateMaterialRate('laborPoolRate', parseFloat(e.target.value) || 0)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rateLaborStairs">Prace budowlane – schody (PLN/m²)</Label>
            <Input
              id="rateLaborStairs"
              type="number"
              min="0"
              step="10"
              value={materialRates.laborStairsRate}
              onChange={(e) => updateMaterialRate('laborStairsRate', parseFloat(e.target.value) || 0)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rateLaborWading">Prace budowlane – brodzik (PLN/m²)</Label>
            <Input
              id="rateLaborWading"
              type="number"
              min="0"
              step="10"
              value={materialRates.laborWadingRate}
              onChange={(e) => updateMaterialRate('laborWadingRate', parseFloat(e.target.value) || 0)}
              className="input-field"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
