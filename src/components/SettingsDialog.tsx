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
import { Textarea } from '@/components/ui/textarea';
import { 
  Settings as SettingsIcon, 
  Building, 
  Shovel,
  Save,
  Mail
} from 'lucide-react';
import { CompanySettings, defaultEmailTemplate } from '@/types/configurator';
import { ExcavationSettings } from '@/types/offers';
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
  const [emailTemplate, setEmailTemplate] = useState(
    companySettings.emailTemplate || defaultEmailTemplate
  );

  const handleSave = () => {
    onSaveCompanySettings({ ...company, emailTemplate });
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

          <Separator />

          {/* Email Template Settings */}
          <div>
            <h3 className="font-medium flex items-center gap-2 mb-4">
              <Mail className="w-4 h-4 text-primary" />
              Szablon wiadomości email
            </h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emailGreeting">Powitanie</Label>
                <Input
                  id="emailGreeting"
                  value={emailTemplate.greeting}
                  onChange={(e) => setEmailTemplate({ ...emailTemplate, greeting: e.target.value })}
                  className="input-field"
                  placeholder="Dzień dobry,"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailBody">Treść wiadomości</Label>
                <Textarea
                  id="emailBody"
                  value={emailTemplate.body}
                  onChange={(e) => setEmailTemplate({ ...emailTemplate, body: e.target.value })}
                  className="input-field min-h-[80px]"
                  placeholder="W odpowiedzi na Pana zapytanie ofertowe..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailSignature">Podpis</Label>
                <Textarea
                  id="emailSignature"
                  value={emailTemplate.signature}
                  onChange={(e) => setEmailTemplate({ ...emailTemplate, signature: e.target.value })}
                  className="input-field min-h-[60px]"
                  placeholder="pozdrawiam,&#10;Imię Nazwisko"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailCc">Kopia (CC) - email biura</Label>
                <Input
                  id="emailCc"
                  type="email"
                  value={emailTemplate.ccEmail}
                  onChange={(e) => setEmailTemplate({ ...emailTemplate, ccEmail: e.target.value })}
                  className="input-field"
                  placeholder="biuro@poolprestige.pl"
                />
                <p className="text-xs text-muted-foreground">
                  Kopia każdej wysłanej oferty trafi na ten adres
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
