import { useState, useEffect, useMemo } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ProductCard } from '@/components/ProductCard';
import { Filter, Droplets, Info, Zap, Calculator, Gauge, Settings2 } from 'lucide-react';
import { products, Product } from '@/data/products';
import { selectPump, selectFilter, formatPrice } from '@/lib/calculations';
import { OfferItem, nominalLoadByType, poolTypeLabels } from '@/types/configurator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface FiltrationStepProps {
  onNext: () => void;
  onBack: () => void;
}

type VoltageType = '230V' | '400V';
type FilterMediaType = 'piaskowe' | 'piaskowo-weglowe' | 'szklane' | 'afm';

const filterMediaLabels: Record<FilterMediaType, string> = {
  'piaskowe': 'Piaskowe',
  'piaskowo-weglowe': 'Piaskowo-węglowe',
  'szklane': 'Szklane',
  'afm': 'AFM',
};

export function FiltrationStep({ onNext, onBack }: FiltrationStepProps) {
  const { state, dispatch } = useConfigurator();
  const { calculations, sections, dimensions, poolType } = state;
  
  const requiredFlow = calculations?.requiredFlow || 15;
  const volume = calculations?.volume || 0;
  const nominalLoad = nominalLoadByType[poolType];
  const attractions = poolType === 'hotelowy' ? dimensions.attractions : 0;
  
  // Settings
  const [pumpVoltage, setPumpVoltage] = useState<VoltageType>('400V');
  const [pumpCount, setPumpCount] = useState(1);
  const [filterCount, setFilterCount] = useState(1);
  const [filterMediaType, setFilterMediaType] = useState<FilterMediaType>('szklane');
  
  // Calculate flow per unit
  const flowPerPump = requiredFlow / pumpCount;
  const flowPerFilter = requiredFlow / filterCount;
  
  // Get pump/filter suggestions based on voltage and flow per unit
  const pumpSelection = useMemo(() => selectPump(flowPerPump), [flowPerPump]);
  const filterSelection = useMemo(() => selectFilter(flowPerFilter), [flowPerFilter]);
  
  // Filter pumps by voltage from product name/description
  const filterByVoltage = (pump: Product | null, voltage: VoltageType): boolean => {
    if (!pump) return false;
    const name = pump.name.toLowerCase();
    const desc = (pump.description || '').toLowerCase();
    const text = name + ' ' + desc;
    
    if (voltage === '230V') {
      return text.includes('230v') || text.includes('230 v') || 
             text.includes('jednofazow') || (!text.includes('400v') && !text.includes('trójfazow'));
    } else {
      return text.includes('400v') || text.includes('400 v') || text.includes('trójfazow');
    }
  };
  
  // Get variable speed pumps (zmiennoobrotowe)
  const variableSpeedPumps = useMemo(() => {
    return products.filter(p => {
      const name = p.name.toLowerCase();
      const desc = (p.description || '').toLowerCase();
      const text = name + ' ' + desc;
      return (p.category === 'pompy' || p.subcategory === 'pompy') &&
             (text.includes('zmiennoobrotow') || text.includes('inverter') || 
              text.includes('variable') || text.includes('vsd') || text.includes('vs '));
    });
  }, []);
  
  // Filter regular pumps by voltage
  const regularPumps = useMemo(() => {
    const allPumps = [pumpSelection.suggested, ...pumpSelection.alternatives].filter(Boolean) as Product[];
    return allPumps.filter(p => filterByVoltage(p, pumpVoltage));
  }, [pumpSelection, pumpVoltage]);
  
  // Filter media products by type
  const filterMedia = useMemo(() => {
    return products.filter(p => {
      if (p.category !== 'materialy' || p.subcategory !== 'zloze') return false;
      const name = p.name.toLowerCase();
      
      switch (filterMediaType) {
        case 'piaskowe':
          return name.includes('piasek') || name.includes('kwarc');
        case 'piaskowo-weglowe':
          return name.includes('węgl') || name.includes('carbon');
        case 'szklane':
          return name.includes('szkl') || name.includes('glass');
        case 'afm':
          return name.includes('afm');
        default:
          return true;
      }
    });
  }, [filterMediaType]);
  
  const [selectedPump, setSelectedPump] = useState<Product | null>(null);
  const [selectedVariablePump, setSelectedVariablePump] = useState<Product | null>(null);
  const [selectedFilter, setSelectedFilter] = useState<Product | null>(
    filterSelection.suggested || null
  );
  const [selectedMedia, setSelectedMedia] = useState<Product | null>(filterMedia[0] || null);
  const [mediaQuantity, setMediaQuantity] = useState(Math.ceil(filterSelection.filterMediaKg / 25));

  // Update pump selection when voltage or regular pumps change
  useEffect(() => {
    if (regularPumps.length > 0 && !selectedPump) {
      setSelectedPump(regularPumps[0]);
    } else if (regularPumps.length > 0 && selectedPump && !regularPumps.find(p => p.id === selectedPump.id)) {
      setSelectedPump(regularPumps[0]);
    }
  }, [regularPumps, pumpVoltage]);

  // Update filter selection when filter selection changes
  useEffect(() => {
    if (filterSelection.suggested && (!selectedFilter || selectedFilter.id !== filterSelection.suggested.id)) {
      setSelectedFilter(filterSelection.suggested);
    }
  }, [filterSelection.suggested]);

  // Update media quantity when filter count changes
  useEffect(() => {
    const totalMediaKg = filterSelection.filterMediaKg * filterCount;
    setMediaQuantity(Math.ceil(totalMediaKg / 25));
  }, [filterSelection.filterMediaKg, filterCount]);

  // Auto-save section when selections change
  useEffect(() => {
    const items: OfferItem[] = [];
    
    if (selectedPump) {
      items.push({
        id: `pump-${selectedPump.id}`,
        product: selectedPump,
        quantity: pumpCount,
      });
    }
    
    if (selectedVariablePump) {
      items.push({
        id: `varpump-${selectedVariablePump.id}`,
        product: selectedVariablePump,
        quantity: 1,
      });
    }
    
    if (selectedFilter) {
      items.push({
        id: `filter-${selectedFilter.id}`,
        product: selectedFilter,
        quantity: filterCount,
      });
    }
    
    if (selectedMedia) {
      items.push({
        id: `media-${selectedMedia.id}`,
        product: selectedMedia,
        quantity: Math.ceil(mediaQuantity),
      });
    }
    
    dispatch({
      type: 'SET_SECTION',
      payload: {
        section: 'filtracja',
        data: { ...sections.filtracja, items },
      },
    });
  }, [selectedPump, selectedVariablePump, selectedFilter, selectedMedia, mediaQuantity, pumpCount, filterCount]);

  // Build formula string for display
  const formulaBase = `(0,37 × ${volume.toFixed(1)}) / ${nominalLoad}`;
  const formulaAttractions = attractions > 0 ? ` + (6 × ${attractions})` : '';
  const formulaResult = requiredFlow.toFixed(1);

  return (
    <div className="animate-slide-up">
      <div className="section-header">
        <Filter className="w-5 h-5 text-primary" />
        Filtracja
      </div>

      <div className="mb-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
        <div className="flex items-start gap-2">
          <Droplets className="w-5 h-5 text-primary mt-0.5" />
          <div className="flex-1">
            <p className="font-medium">Wymagana wydajność: {requiredFlow.toFixed(1)} m³/h</p>
            <p className="text-sm text-muted-foreground">
              Złoże filtracyjne: ~{filterSelection.filterMediaKg * filterCount} kg
            </p>
            
            {/* Formula display */}
            <div className="mt-2 pt-2 border-t border-primary/20">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Calculator className="w-3 h-3" />
                <span>Formuła DIN:</span>
              </div>
              <p className="text-xs font-mono text-muted-foreground mt-1">
                {formulaBase}{formulaAttractions} = <span className="text-primary font-semibold">{formulaResult} m³/h</span>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Typ basenu: {poolTypeLabels[poolType]} (obciążenie: {nominalLoad})
                {attractions > 0 && ` | Atrakcje: ${attractions}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Pump settings */}
      <div className="glass-card p-6 mb-6">
        <h3 className="text-base font-medium mb-4 flex items-center gap-2">
          <Settings2 className="w-4 h-4 text-primary" />
          Ustawienia pomp i filtrów
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Voltage selection */}
          <div className="space-y-2">
            <Label>Napięcie zasilania pompy</Label>
            <RadioGroup
              value={pumpVoltage}
              onValueChange={(v) => setPumpVoltage(v as VoltageType)}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="230V" id="v230" />
                <Label htmlFor="v230" className="cursor-pointer">230V (1-faz)</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="400V" id="v400" />
                <Label htmlFor="v400" className="cursor-pointer">400V (3-faz)</Label>
              </div>
            </RadioGroup>
          </div>
          
          {/* Pump count */}
          <div className="space-y-2">
            <Label htmlFor="pumpCount">Liczba pomp</Label>
            <div className="flex items-center gap-2">
              <Input
                id="pumpCount"
                type="number"
                min={1}
                max={4}
                value={pumpCount}
                onChange={(e) => setPumpCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="input-field w-20"
              />
              <span className="text-sm text-muted-foreground">
                ({flowPerPump.toFixed(1)} m³/h każda)
              </span>
            </div>
          </div>
          
          {/* Filter count */}
          <div className="space-y-2">
            <Label htmlFor="filterCount">Liczba filtrów</Label>
            <div className="flex items-center gap-2">
              <Input
                id="filterCount"
                type="number"
                min={1}
                max={4}
                value={filterCount}
                onChange={(e) => setFilterCount(Math.max(1, parseInt(e.target.value) || 1))}
                className="input-field w-20"
              />
              <span className="text-sm text-muted-foreground">
                ({flowPerFilter.toFixed(1)} m³/h każdy)
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Regular Pump selection */}
        <div className="glass-card p-6">
          <h3 className="text-base font-medium mb-4 flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            Pompa obiegowa ({pumpVoltage})
          </h3>
          
          {regularPumps.length > 0 ? (
            <div className="space-y-3">
              {regularPumps.slice(0, 5).map((product, index) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isSelected={selectedPump?.id === product.id}
                  isSuggested={index === 0}
                  quantity={pumpCount}
                  onSelect={() => setSelectedPump(product)}
                  onQuantityChange={(qty) => setPumpCount(qty)}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Brak pomp dla napięcia {pumpVoltage}</p>
            </div>
          )}
        </div>

        {/* Variable speed pumps */}
        <div className="glass-card p-6">
          <h3 className="text-base font-medium mb-4 flex items-center gap-2">
            <Gauge className="w-4 h-4 text-accent" />
            Pompy zmiennoobrotowe (opcjonalnie)
          </h3>
          
          <div className="mb-3 p-2 rounded bg-accent/10 border border-accent/20">
            <p className="text-xs text-muted-foreground">
              Pompy zmiennoobrotowe oszczędzają energię i są cichsze. Mogą zastąpić pompę standardową.
            </p>
          </div>
          
          {variableSpeedPumps.length > 0 ? (
            <div className="space-y-3">
              {variableSpeedPumps.slice(0, 5).map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isSelected={selectedVariablePump?.id === product.id}
                  onSelect={() => setSelectedVariablePump(
                    selectedVariablePump?.id === product.id ? null : product
                  )}
                  compact
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <p>Brak pomp zmiennoobrotowych w bazie</p>
            </div>
          )}
        </div>
      </div>

      {/* Filter selection */}
      <div className="glass-card p-6 mt-6">
        <h3 className="text-base font-medium mb-4 flex items-center gap-2">
          <Filter className="w-4 h-4 text-primary" />
          Filtr (wydajność: {flowPerFilter.toFixed(1)} m³/h na filtr)
        </h3>
        
        {filterSelection.suggested && (
          <div className="mb-4">
            <p className="text-xs text-accent mb-2 uppercase tracking-wide">Sugerowany</p>
            <ProductCard
              product={filterSelection.suggested}
              isSelected={selectedFilter?.id === filterSelection.suggested.id}
              isSuggested
              quantity={filterCount}
              onSelect={() => setSelectedFilter(filterSelection.suggested!)}
              onQuantityChange={(qty) => setFilterCount(qty)}
            />
          </div>
        )}
        
        {filterSelection.alternatives.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 uppercase tracking-wide">Alternatywy</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filterSelection.alternatives.map(product => (
                <ProductCard
                  key={product.id}
                  product={product}
                  isSelected={selectedFilter?.id === product.id}
                  quantity={filterCount}
                  onSelect={() => setSelectedFilter(product)}
                  onQuantityChange={(qty) => setFilterCount(qty)}
                  compact
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filter media */}
      <div className="glass-card p-6 mt-6">
        <h3 className="text-base font-medium mb-4">Złoże filtracyjne</h3>
        
        {/* Media type selection */}
        <div className="mb-4">
          <Label className="mb-2 block">Rodzaj złoża</Label>
          <RadioGroup
            value={filterMediaType}
            onValueChange={(v) => setFilterMediaType(v as FilterMediaType)}
            className="flex flex-wrap gap-4"
          >
            {(Object.keys(filterMediaLabels) as FilterMediaType[]).map((type) => (
              <div key={type} className="flex items-center space-x-2">
                <RadioGroupItem value={type} id={`media-${type}`} />
                <Label htmlFor={`media-${type}`} className="cursor-pointer">
                  {filterMediaLabels[type]}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        
        <div className="flex items-center gap-2 mb-4">
          <Info className="w-4 h-4 text-accent" />
          <span className="text-sm text-muted-foreground">
            Wymagane: ~{filterSelection.filterMediaKg * filterCount} kg ({Math.ceil((filterSelection.filterMediaKg * filterCount) / 25)} worków 25kg)
          </span>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {filterMedia.length > 0 ? (
            filterMedia.map((product, index) => (
              <ProductCard
                key={product.id}
                product={product}
                isSelected={selectedMedia?.id === product.id}
                isSuggested={index === 0}
                quantity={mediaQuantity}
                onSelect={() => setSelectedMedia(product)}
                onQuantityChange={setMediaQuantity}
                compact
              />
            ))
          ) : (
            <div className="col-span-full text-center py-4 text-muted-foreground">
              Brak produktów dla wybranego rodzaju złoża
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
