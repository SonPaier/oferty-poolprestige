import { useConfigurator } from '@/context/ConfiguratorContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { User, Building, Mail, Phone, MapPin } from 'lucide-react';

interface CustomerStepProps {
  onNext: () => void;
}

export function CustomerStep({ onNext }: CustomerStepProps) {
  const { state, dispatch } = useConfigurator();
  const { customerData } = state;

  const updateField = (field: keyof typeof customerData, value: string) => {
    dispatch({
      type: 'SET_CUSTOMER_DATA',
      payload: { ...customerData, [field]: value },
    });
  };

  const isValid = customerData.contactPerson && customerData.phone;

  return (
    <div className="animate-slide-up">
      <div className="section-header">
        <User className="w-5 h-5 text-primary" />
        Dane klienta
      </div>
      
      <div className="glass-card p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="companyName" className="flex items-center gap-2">
              <Building className="w-4 h-4 text-muted-foreground" />
              Nazwa firmy
            </Label>
            <Input
              id="companyName"
              value={customerData.companyName}
              onChange={(e) => updateField('companyName', e.target.value)}
              placeholder="Opcjonalnie"
              className="input-field"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="nip" className="flex items-center gap-2">
              NIP
            </Label>
            <Input
              id="nip"
              value={customerData.nip || ''}
              onChange={(e) => updateField('nip', e.target.value)}
              placeholder="Opcjonalnie"
              className="input-field"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contactPerson" className="flex items-center gap-2">
              <User className="w-4 h-4 text-muted-foreground" />
              Osoba kontaktowa *
            </Label>
            <Input
              id="contactPerson"
              value={customerData.contactPerson}
              onChange={(e) => updateField('contactPerson', e.target.value)}
              placeholder="Imię i nazwisko"
              className="input-field"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              Telefon *
            </Label>
            <Input
              id="phone"
              type="tel"
              value={customerData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+48 123 456 789"
              className="input-field"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email" className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-muted-foreground" />
              Email
            </Label>
            <Input
              id="email"
              type="email"
              value={customerData.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="email@example.com"
              className="input-field"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="city" className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              Miasto
            </Label>
            <Input
              id="city"
              value={customerData.city}
              onChange={(e) => updateField('city', e.target.value)}
              placeholder="Miejscowość"
              className="input-field"
            />
          </div>

          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="address">Adres</Label>
            <Input
              id="address"
              value={customerData.address}
              onChange={(e) => updateField('address', e.target.value)}
              placeholder="Ulica, numer domu"
              className="input-field"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="postalCode">Kod pocztowy</Label>
            <Input
              id="postalCode"
              value={customerData.postalCode}
              onChange={(e) => updateField('postalCode', e.target.value)}
              placeholder="00-000"
              className="input-field"
            />
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button 
            onClick={onNext} 
            disabled={!isValid}
            className="btn-primary px-8"
          >
            Dalej: Wymiary basenu
          </Button>
        </div>
      </div>
    </div>
  );
}
