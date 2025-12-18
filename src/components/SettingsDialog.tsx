import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Settings as SettingsIcon, 
  Building, 
  Shovel,
  Save
} from 'lucide-react';
import { CompanySettings } from '@/types/configurator';
import { ExcavationSettings, defaultExcavationSettings } from '@/types/offers';
import { toast } from 'sonner';

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  companySettings: CompanySettings;
  onSaveCompanySettings: (settings: CompanySettings) => void;
  excavationSettings: ExcavationSettings;
  onSaveExcavationSettings: (settings: ExcavationSettings) => void;
}

export function SettingsDialog({
  open,
  onClose,
  companySettings,
  onSaveCompanySettings,
  excavationSettings,
  onSaveExcavationSettings,
}: SettingsDialogProps) {
  const [company, setCompany] = useState(companySettings);
  const [excavation, setExcavation] = useState(excavationSettings);

  const handleSave = () => {
    onSaveCompanySettings(company);
    onSaveExcavationSettings(excavation);
    toast.success('Ustawienia zostały zapisane');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-primary" />
            Ustawienia
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Company Settings */}
          <div>
            <h3 className="font-medium flex items-center gap-2 mb-4">
              <Building className="w-4 h-4 text-primary" />
              Dane firmy
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Nazwa firmy</Label>
                <Input
                  id="companyName"
                  value={company.name}
                  onChange={(e) => setCompany({ ...company, name: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nip">NIP</Label>
                <Input
                  id="nip"
                  value={company.nip}
                  onChange={(e) => setCompany({ ...company, nip: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyAddress">Adres</Label>
                <Input
                  id="companyAddress"
                  value={company.address}
                  onChange={(e) => setCompany({ ...company, address: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyCity">Miasto</Label>
                <Input
                  id="companyCity"
                  value={company.city}
                  onChange={(e) => setCompany({ ...company, city: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyPhone">Telefon</Label>
                <Input
                  id="companyPhone"
                  value={company.phone}
                  onChange={(e) => setCompany({ ...company, phone: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyEmail">Email</Label>
                <Input
                  id="companyEmail"
                  value={company.email}
                  onChange={(e) => setCompany({ ...company, email: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="companyWebsite">Strona www</Label>
                <Input
                  id="companyWebsite"
                  value={company.website}
                  onChange={(e) => setCompany({ ...company, website: e.target.value })}
                  className="input-field"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="irregularSurcharge">Dopłata za kształt nieregularny (%)</Label>
                <Input
                  id="irregularSurcharge"
                  type="number"
                  min="0"
                  max="100"
                  value={company.irregularSurchargePercent}
                  onChange={(e) => setCompany({ 
                    ...company, 
                    irregularSurchargePercent: parseFloat(e.target.value) || 0 
                  })}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Excavation Settings */}
          <div>
            <h3 className="font-medium flex items-center gap-2 mb-4">
              <Shovel className="w-4 h-4 text-primary" />
              Roboty ziemne
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="pricePerM3">Cena za m³ wykopu (PLN)</Label>
                <Input
                  id="pricePerM3"
                  type="number"
                  min="0"
                  step="10"
                  value={excavation.pricePerM3}
                  onChange={(e) => setExcavation({ 
                    ...excavation, 
                    pricePerM3: parseFloat(e.target.value) || 0 
                  })}
                  className="input-field"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="removalPrice">Ryczałt za wywóz (PLN)</Label>
                <Input
                  id="removalPrice"
                  type="number"
                  min="0"
                  step="100"
                  value={excavation.removalFixedPrice}
                  onChange={(e) => setExcavation({ 
                    ...excavation, 
                    removalFixedPrice: parseFloat(e.target.value) || 0 
                  })}
                  className="input-field"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="marginWidth">Margines boczny (m)</Label>
                <Input
                  id="marginWidth"
                  type="number"
                  min="0"
                  step="0.1"
                  value={excavation.marginWidth}
                  onChange={(e) => setExcavation({ 
                    ...excavation, 
                    marginWidth: parseFloat(e.target.value) || 0 
                  })}
                  className="input-field"
                />
                <p className="text-xs text-muted-foreground">
                  Dodatkowa szerokość z każdej strony basenu
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="marginDepth">Margines głębokości (m)</Label>
                <Input
                  id="marginDepth"
                  type="number"
                  min="0"
                  step="0.1"
                  value={excavation.marginDepth}
                  onChange={(e) => setExcavation({ 
                    ...excavation, 
                    marginDepth: parseFloat(e.target.value) || 0 
                  })}
                  className="input-field"
                />
                <p className="text-xs text-muted-foreground">
                  Dodatkowa głębokość wykopu
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            Anuluj
          </Button>
          <Button onClick={handleSave} className="btn-primary">
            <Save className="w-4 h-4 mr-2" />
            Zapisz ustawienia
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
