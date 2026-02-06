import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Shovel, Hammer } from 'lucide-react';
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
            <Label htmlFor="rateStyrodur5">Styrodur 5cm (PLN/m²)</Label>
            <Input
              id="rateStyrodur5"
              type="number"
              min="0"
              step="1"
              value={materialRates.styrodur5cm}
              onChange={(e) => updateMaterialRate('styrodur5cm', parseFloat(e.target.value) || 0)}
              className="input-field"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rateStyrodur10">Styrodur 10cm (PLN/m²)</Label>
            <Input
              id="rateStyrodur10"
              type="number"
              min="0"
              step="1"
              value={materialRates.styrodur10cm}
              onChange={(e) => updateMaterialRate('styrodur10cm', parseFloat(e.target.value) || 0)}
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
    </div>
  );
}
