import { useState, useEffect } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { HardHat, AlertCircle, Wrench, Building } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface ConstructionStepProps {
  onNext: () => void;
  onBack: () => void;
}

type ScopeType = 'our' | 'investor';

export function ConstructionStep({ onNext, onBack }: ConstructionStepProps) {
  const { state, dispatch } = useConfigurator();
  const { sections } = state;
  
  const [scope, setScope] = useState<ScopeType>(
    (sections.prace_budowlane?.scope as ScopeType) || 'our'
  );
  const [notes, setNotes] = useState('');
  const [estimatedCost, setEstimatedCost] = useState(0);

  // Save to sections
  useEffect(() => {
    dispatch({
      type: 'SET_SECTION',
      payload: {
        section: 'prace_budowlane',
        data: {
          ...sections.prace_budowlane,
          scope,
          notes,
          estimatedCost: scope === 'our' ? estimatedCost : 0,
          items: [],
        },
      },
    });
  }, [scope, notes, estimatedCost]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
    }).format(price);
  };

  return (
    <div className="animate-slide-up">
      <div className="section-header">
        <HardHat className="w-5 h-5 text-primary" />
        Prace budowlane
      </div>

      {/* Scope selection */}
      <div className="glass-card p-6 mb-6">
        <h3 className="text-base font-medium mb-4">Zakres prac budowlanych</h3>
        <RadioGroup
          value={scope}
          onValueChange={(v) => setScope(v as ScopeType)}
          className="flex flex-col gap-4"
        >
          <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
               onClick={() => setScope('our')}>
            <RadioGroupItem value="our" id="construction-our" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="construction-our" className="cursor-pointer font-medium flex items-center gap-2">
                <Wrench className="w-4 h-4" />
                W naszym zakresie
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Wykonamy prace budowlane (szalunki, zbrojenie, betonowanie, izolacje)
              </p>
            </div>
          </div>
          
          <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
               onClick={() => setScope('investor')}>
            <RadioGroupItem value="investor" id="construction-investor" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="construction-investor" className="cursor-pointer font-medium flex items-center gap-2">
                <Building className="w-4 h-4" />
                W zakresie inwestora
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Prace budowlane po stronie klienta - nie wliczane do oferty
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>

      {scope === 'investor' ? (
        <div className="glass-card p-6">
          <div className="flex items-start gap-3 p-4 rounded-lg bg-accent/10 border border-accent/20">
            <AlertCircle className="w-5 h-5 text-accent mt-0.5" />
            <div>
              <p className="font-medium">Prace budowlane w zakresie inwestora</p>
              <p className="text-sm text-muted-foreground mt-1">
                Na ofercie pojawi się informacja, że prace budowlane są po stronie klienta.
                Klient odpowiedzialny jest za przygotowanie niecki betonowej zgodnie z projektem.
              </p>
            </div>
          </div>
          
          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="investor-notes">Uwagi dla inwestora</Label>
              <Textarea
                id="investor-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Dodatkowe informacje dla inwestora dotyczące wymagań budowlanych..."
                className="mt-2"
                rows={4}
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Work scope */}
          <div className="glass-card p-6">
            <h3 className="text-base font-medium mb-4">Zakres prac budowlanych</h3>
            
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-muted/30 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div>
                  <p className="font-medium">Szalunki</p>
                  <p className="text-sm text-muted-foreground">Wykonanie szalunków pod nieczkę basenu</p>
                </div>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/30 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div>
                  <p className="font-medium">Zbrojenie</p>
                  <p className="text-sm text-muted-foreground">Wykonanie zbrojenia ścian i dna basenu</p>
                </div>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/30 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div>
                  <p className="font-medium">Betonowanie</p>
                  <p className="text-sm text-muted-foreground">Zalewanie betonem klasy min. C25/30</p>
                </div>
              </div>
              
              <div className="p-3 rounded-lg bg-muted/30 flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-primary mt-2" />
                <div>
                  <p className="font-medium">Izolacje</p>
                  <p className="text-sm text-muted-foreground">Izolacja przeciwwodna i termiczna</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Pricing */}
          <div className="glass-card p-6">
            <h3 className="text-base font-medium mb-4">Wycena prac budowlanych</h3>

            <div className="space-y-4">
              <div>
                <Label htmlFor="construction-cost">Szacowany koszt (PLN netto)</Label>
                <Input
                  id="construction-cost"
                  type="number"
                  min="0"
                  step="1000"
                  value={estimatedCost}
                  onChange={(e) => setEstimatedCost(parseFloat(e.target.value) || 0)}
                  className="input-field mt-2"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Wpisz szacowany koszt lub zostaw 0 jeśli wycena będzie indywidualna
                </p>
              </div>

              {estimatedCost > 0 && (
                <div className="border-t border-border pt-4">
                  <div className="flex justify-between items-center">
                    <p className="font-medium">Razem prace budowlane (netto)</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatPrice(estimatedCost)}
                    </p>
                  </div>
                  <div className="flex justify-between items-center mt-1 text-sm text-muted-foreground">
                    <p>+ VAT 8%</p>
                    <p>{formatPrice(estimatedCost * 0.08)}</p>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                    <p className="font-medium">Brutto</p>
                    <p className="font-bold">{formatPrice(estimatedCost * 1.08)}</p>
                  </div>
                </div>
              )}

              <div className="mt-4">
                <Label htmlFor="construction-notes">Uwagi</Label>
                <Textarea
                  id="construction-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Dodatkowe uwagi dotyczące prac budowlanych..."
                  className="mt-2"
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
