import { useState } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { User, Building, Mail, Phone, MapPin, Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CustomerStepProps {
  onNext: () => void;
}

export function CustomerStep({ onNext }: CustomerStepProps) {
  const { state, dispatch } = useConfigurator();
  const { customerData } = state;
  
  const [emailInput, setEmailInput] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);

  const updateField = (field: keyof typeof customerData, value: string) => {
    dispatch({
      type: 'SET_CUSTOMER_DATA',
      payload: { ...customerData, [field]: value },
    });
  };

  const handleExtractFromEmail = async () => {
    if (!emailInput.trim()) {
      toast.error('Wklej treść maila lub wiadomości');
      return;
    }

    setIsExtracting(true);
    try {
      const { data, error } = await supabase.functions.invoke('extract-from-email', {
        body: { emailContent: emailInput },
      });

      if (error) {
        console.error('Extraction error:', error);
        toast.error('Błąd ekstrakcji danych', { 
          description: error.message || 'Spróbuj ponownie'
        });
        return;
      }

      console.log('Extracted data:', data);

      // Update customer data with extracted info and save source email
      const extracted = data.customerData || {};
      dispatch({
        type: 'SET_CUSTOMER_DATA',
        payload: {
          ...customerData,
          companyName: extracted.companyName || customerData.companyName,
          contactPerson: extracted.contactPerson || customerData.contactPerson,
          email: extracted.email || customerData.email,
          phone: extracted.phone || customerData.phone,
          address: extracted.address || customerData.address,
          city: extracted.city || customerData.city,
          postalCode: extracted.postalCode || customerData.postalCode,
          nip: extracted.nip || customerData.nip,
          sourceEmail: emailInput, // Save original email content
        },
      });

      // Update pool dimensions if found
      if (data.poolDimensions) {
        const dims = data.poolDimensions;
        if (dims.length || dims.width) {
          dispatch({
            type: 'SET_DIMENSIONS',
            payload: {
              ...state.dimensions,
              length: dims.length || state.dimensions.length,
              width: dims.width || state.dimensions.width,
              depth: dims.depth || state.dimensions.depth,
            },
          });
        }
      }

      // Update pool type if found
      if (data.poolType) {
        dispatch({ type: 'SET_POOL_TYPE', payload: data.poolType });
      }

      toast.success('Dane wyekstrahowane', {
        description: 'Sprawdź i uzupełnij brakujące pola',
      });

      setEmailInput('');
    } catch (err) {
      console.error('Extract error:', err);
      toast.error('Błąd połączenia');
    } finally {
      setIsExtracting(false);
    }
  };

  const isValid = customerData.contactPerson;

  return (
    <div className="animate-slide-up">
      <div className="section-header">
        <User className="w-5 h-5 text-primary" />
        Dane klienta
      </div>

      {/* Saved Source Email Display */}
      {customerData.sourceEmail && (
        <div className="glass-card p-4 mb-6 border-l-4 border-l-primary/50">
          <div className="flex items-center gap-2 mb-3">
            <Mail className="w-5 h-5 text-primary" />
            <h3 className="font-medium">Treść zapytania</h3>
          </div>
          <div className="bg-muted/50 rounded-md p-3 max-h-[150px] overflow-y-auto">
            <pre className="text-sm whitespace-pre-wrap font-sans text-muted-foreground">
              {customerData.sourceEmail}
            </pre>
          </div>
        </div>
      )}

      {/* AI Extraction Input */}
      <div className="glass-card p-4 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-accent" />
          <h3 className="font-medium">Automatyczne uzupełnianie z maila</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Wklej treść maila od klienta, a AI wyekstrahuje dane kontaktowe i wymiary basenu.
        </p>
        <Textarea
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          placeholder="Wklej tutaj treść maila, wiadomości lub zapytania od klienta..."
          className="input-field min-h-[100px] mb-3"
        />
        <Button
          onClick={handleExtractFromEmail}
          disabled={isExtracting || !emailInput.trim()}
          variant="secondary"
          className="w-full sm:w-auto"
        >
          {isExtracting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analizuję...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Wyekstrahuj dane
            </>
          )}
        </Button>
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
              Telefon
            </Label>
            <Input
              id="phone"
              type="tel"
              value={customerData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+48 123 456 789"
              className="input-field"
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
