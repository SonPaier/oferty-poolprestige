import { useState, useEffect } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Shovel, HardHat, Info, AlertCircle, Wrench, Building } from 'lucide-react';
import { ExcavationSettings, ExcavationData, calculateExcavation } from '@/types/offers';
import { formatPrice } from '@/lib/calculations';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface GroundworksStepProps {
  onNext: () => void;
  onBack: () => void;
  excavationSettings: ExcavationSettings;
}

type ScopeType = 'our' | 'investor';

export function GroundworksStep({ onNext, onBack, excavationSettings }: GroundworksStepProps) {
  const { state, dispatch } = useConfigurator();
  const { dimensions, sections } = state;
  
  // Excavation state
  const [excavationScope, setExcavationScope] = useState<ScopeType>(
    (sections.roboty_ziemne?.scope as ScopeType) || 'our'
  );
  const [excavation, setExcavation] = useState<ExcavationData>(() => 
    calculateExcavation(dimensions, excavationSettings)
  );
  const [customRemovalPrice, setCustomRemovalPrice] = useState(excavationSettings.removalFixedPrice);

  // Construction state
  const [constructionScope, setConstructionScope] = useState<ScopeType>(
    (sections.prace_budowlane?.scope as ScopeType) || 'our'
  );
  const [constructionNotes, setConstructionNotes] = useState('');
  const [constructionCost, setConstructionCost] = useState(0);

  // Calculate excavation
  useEffect(() => {
    const calc = calculateExcavation(dimensions, excavationSettings);
    setExcavation({
      ...calc,
      removalFixedPrice: customRemovalPrice,
    });
  }, [dimensions, excavationSettings, customRemovalPrice]);

  // Save excavation scope to sections
  useEffect(() => {
    dispatch({
      type: 'SET_SECTION',
      payload: {
        section: 'roboty_ziemne',
        data: {
          ...sections.roboty_ziemne,
          scope: excavationScope,
          excavation: excavationScope === 'our' ? excavation : null,
          items: [],
        },
      },
    });
  }, [excavationScope, excavation]);

  // Save construction scope to sections
  useEffect(() => {
    dispatch({
      type: 'SET_SECTION',
      payload: {
        section: 'prace_budowlane',
        data: {
          ...sections.prace_budowlane,
          scope: constructionScope,
          notes: constructionNotes,
          estimatedCost: constructionScope === 'our' ? constructionCost : 0,
          items: [],
        },
      },
    });
  }, [constructionScope, constructionNotes, constructionCost]);

  const excavationDimensions = {
    length: dimensions.length + (excavationSettings.marginWidth * 2),
    width: dimensions.width + (excavationSettings.marginWidth * 2),
    depth: dimensions.depth + excavationSettings.marginDepth,
  };

  const totalExcavationCost = excavation.excavationTotal + excavation.removalFixedPrice;

  return (
    <div className="animate-slide-up">
      <div className="section-header">
        <Shovel className="w-5 h-5 text-primary" />
        Roboty ziemne i prace budowlane
      </div>

      <Tabs defaultValue="excavation" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-6">
          <TabsTrigger value="excavation" className="flex items-center gap-2">
            <Shovel className="w-4 h-4" />
            Roboty ziemne
          </TabsTrigger>
          <TabsTrigger value="construction" className="flex items-center gap-2">
            <HardHat className="w-4 h-4" />
            Prace budowlane
          </TabsTrigger>
        </TabsList>

        {/* EXCAVATION TAB */}
        <TabsContent value="excavation">
          {/* Scope selection */}
          <div className="glass-card p-6 mb-6">
            <h3 className="text-base font-medium mb-4">Zakres prac</h3>
            <RadioGroup
              value={excavationScope}
              onValueChange={(v) => setExcavationScope(v as ScopeType)}
              className="flex flex-col gap-4"
            >
              <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
                   onClick={() => setExcavationScope('our')}>
                <RadioGroupItem value="our" id="excavation-scope-our" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="excavation-scope-our" className="cursor-pointer font-medium">
                    W naszym zakresie
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Wykonamy roboty ziemne zgodnie z kalkulacją poniżej
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
                   onClick={() => setExcavationScope('investor')}>
                <RadioGroupItem value="investor" id="excavation-scope-investor" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="excavation-scope-investor" className="cursor-pointer font-medium">
                    W zakresie inwestora
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    Roboty ziemne po stronie klienta - nie wliczane do oferty
                  </p>
                </div>
              </div>
            </RadioGroup>
          </div>

          {excavationScope === 'investor' ? (
            <div className="glass-card p-6">
              <div className="flex items-start gap-3 p-4 rounded-lg bg-accent/10 border border-accent/20">
                <AlertCircle className="w-5 h-5 text-accent mt-0.5" />
                <div>
                  <p className="font-medium">Roboty ziemne w zakresie inwestora</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Na ofercie pojawi się informacja, że roboty ziemne są po stronie klienta.
                    Poniższe wymiary wykopu mają charakter informacyjny.
                  </p>
                </div>
              </div>
              
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-3 text-muted-foreground">
                  Wymagane wymiary wykopu (informacyjnie):
                </h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">Długość</p>
                    <p className="text-lg font-bold">{excavationDimensions.length.toFixed(1)} m</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">Szerokość</p>
                    <p className="text-lg font-bold">{excavationDimensions.width.toFixed(1)} m</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">Głębokość</p>
                    <p className="text-lg font-bold">{excavationDimensions.depth.toFixed(1)} m</p>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground mt-3 text-center">
                  Objętość wykopu: <strong>{excavation.excavationVolume.toFixed(1)} m³</strong>
                </p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Excavation info */}
              <div className="glass-card p-6">
                <h3 className="text-base font-medium mb-4">Wymiary wykopu</h3>
                
                <div className="p-4 rounded-lg bg-accent/10 border border-accent/20 mb-4">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-accent mt-0.5" />
                    <div className="text-sm">
                      <p className="font-medium">Kalkulacja wykopu</p>
                      <p className="text-muted-foreground">
                        Basen: {dimensions.length}×{dimensions.width}m + margines {excavationSettings.marginWidth}m z każdej strony
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">Długość</p>
                    <p className="text-lg font-bold">{excavationDimensions.length.toFixed(1)} m</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">Szerokość</p>
                    <p className="text-lg font-bold">{excavationDimensions.width.toFixed(1)} m</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30 text-center">
                    <p className="text-xs text-muted-foreground">Głębokość</p>
                    <p className="text-lg font-bold">{excavationDimensions.depth.toFixed(1)} m</p>
                  </div>
                </div>

                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-muted-foreground">Objętość wykopu</p>
                      <p className="text-2xl font-bold text-primary">
                        {excavation.excavationVolume.toFixed(1)} m³
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Stawka</p>
                      <p className="text-lg font-semibold">
                        {formatPrice(excavation.excavationPricePerM3)}/m³
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Pricing */}
              <div className="glass-card p-6">
                <h3 className="text-base font-medium mb-4">Koszt robót ziemnych</h3>

                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="font-medium">Wykop</p>
                      <p className="text-xs text-muted-foreground">
                        {excavation.excavationVolume.toFixed(1)} m³ × {formatPrice(excavation.excavationPricePerM3)}
                      </p>
                    </div>
                    <span className="text-lg font-semibold">
                      {formatPrice(excavation.excavationTotal)}
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="removalPrice">Ryczałt za wywóz ziemi (PLN)</Label>
                    <Input
                      id="removalPrice"
                      type="number"
                      min="0"
                      step="100"
                      value={customRemovalPrice}
                      onChange={(e) => setCustomRemovalPrice(parseFloat(e.target.value) || 0)}
                      className="input-field"
                    />
                  </div>

                  <div className="border-t border-border pt-4">
                    <div className="flex justify-between items-center">
                      <p className="font-medium">Razem roboty ziemne (netto)</p>
                      <p className="text-2xl font-bold text-primary">
                        {formatPrice(totalExcavationCost)}
                      </p>
                    </div>
                    <div className="flex justify-between items-center mt-1 text-sm text-muted-foreground">
                      <p>+ VAT 8%</p>
                      <p>{formatPrice(totalExcavationCost * 0.08)}</p>
                    </div>
                    <div className="flex justify-between items-center mt-1">
                      <p className="font-medium">Brutto</p>
                      <p className="font-bold">{formatPrice(totalExcavationCost * 1.08)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* CONSTRUCTION TAB */}
        <TabsContent value="construction">
          {/* Scope selection */}
          <div className="glass-card p-6 mb-6">
            <h3 className="text-base font-medium mb-4">Zakres prac budowlanych</h3>
            <RadioGroup
              value={constructionScope}
              onValueChange={(v) => setConstructionScope(v as ScopeType)}
              className="flex flex-col gap-4"
            >
              <div className="flex items-start space-x-3 p-4 rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
                   onClick={() => setConstructionScope('our')}>
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
                   onClick={() => setConstructionScope('investor')}>
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

          {constructionScope === 'investor' ? (
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
                    value={constructionNotes}
                    onChange={(e) => setConstructionNotes(e.target.value)}
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
                      value={constructionCost}
                      onChange={(e) => setConstructionCost(parseFloat(e.target.value) || 0)}
                      className="input-field mt-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Wpisz szacowany koszt lub zostaw 0 jeśli wycena będzie indywidualna
                    </p>
                  </div>

                  {constructionCost > 0 && (
                    <div className="border-t border-border pt-4">
                      <div className="flex justify-between items-center">
                        <p className="font-medium">Razem prace budowlane (netto)</p>
                        <p className="text-2xl font-bold text-primary">
                          {formatPrice(constructionCost)}
                        </p>
                      </div>
                      <div className="flex justify-between items-center mt-1 text-sm text-muted-foreground">
                        <p>+ VAT 8%</p>
                        <p>{formatPrice(constructionCost * 0.08)}</p>
                      </div>
                      <div className="flex justify-between items-center mt-1">
                        <p className="font-medium">Brutto</p>
                        <p className="font-bold">{formatPrice(constructionCost * 1.08)}</p>
                      </div>
                    </div>
                  )}

                  <div className="mt-4">
                    <Label htmlFor="construction-notes">Uwagi</Label>
                    <Textarea
                      id="construction-notes"
                      value={constructionNotes}
                      onChange={(e) => setConstructionNotes(e.target.value)}
                      placeholder="Dodatkowe uwagi dotyczące prac budowlanych..."
                      className="mt-2"
                      rows={3}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
