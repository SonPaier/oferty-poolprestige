import { useEffect, useState } from 'react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { useSettings } from '@/context/SettingsContext';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Ruler, 
  Droplets, 
  ArrowLeft,
  Info,
  Waves,
  Pencil,
  Box,
  Calculator,
  Footprints,
  Baby
} from 'lucide-react';
import { Pool3DVisualization } from '@/components/Pool3DVisualization';
import { 
  PoolType, 
  PoolShape, 
  PoolOverflowType, 
  poolTypeLabels, 
  poolShapeLabels, 
  overflowTypeLabels, 
  nominalLoadByType, 
  CustomPoolVertex,
  StairsConfig,
  WadingPoolConfig,
  PoolCorner,
  WallDirection,
  StairsPosition,
  poolCornerLabels,
  wallDirectionLabels,
  stairsPositionLabels
} from '@/types/configurator';
import { calculatePoolMetrics, calculateFoilOptimization } from '@/lib/calculations';
import { CustomPoolDrawer } from '@/components/CustomPoolDrawer';

interface DimensionsStepProps {
  onNext: () => void;
  onBack: () => void;
}

// SVG Pool Shape Icons
const PoolShapeIcon = ({ shape, isSelected }: { shape: PoolShape; isSelected: boolean }) => {
  const strokeColor = isSelected ? 'hsl(190 80% 42%)' : 'currentColor';
  const fillColor = isSelected ? 'hsl(190 80% 42% / 0.1)' : 'transparent';
  
  switch (shape) {
    case 'prostokatny':
      return (
        <svg viewBox="0 0 60 40" className="w-full h-12">
          <rect x="5" y="5" width="50" height="30" rx="2" fill={fillColor} stroke={strokeColor} strokeWidth="2"/>
        </svg>
      );
    case 'owalny':
      return (
        <svg viewBox="0 0 60 40" className="w-full h-12">
          <ellipse cx="30" cy="20" rx="25" ry="15" fill={fillColor} stroke={strokeColor} strokeWidth="2"/>
        </svg>
      );
    case 'litera-l':
      return (
        <svg viewBox="0 0 60 40" className="w-full h-12">
          <path d="M5 5 H35 V20 H20 V35 H5 Z" fill={fillColor} stroke={strokeColor} strokeWidth="2"/>
        </svg>
      );
    case 'prostokatny-schodki-zewnetrzne':
      return (
        <svg viewBox="0 0 60 40" className="w-full h-12">
          <rect x="5" y="5" width="50" height="30" rx="2" fill={fillColor} stroke={strokeColor} strokeWidth="2"/>
          <path d="M55 15 H65 V25 H55" fill={fillColor} stroke={strokeColor} strokeWidth="1.5" strokeLinejoin="round"/>
          <line x1="58" y1="18" x2="58" y2="22" stroke={strokeColor} strokeWidth="1"/>
          <line x1="61" y1="18" x2="61" y2="22" stroke={strokeColor} strokeWidth="1"/>
        </svg>
      );
    case 'prostokatny-schodki-narozne':
      return (
        <svg viewBox="0 0 60 40" className="w-full h-12">
          <path d="M5 5 H55 V35 H5 Z M45 5 L55 5 L55 15 L50 15 L50 10 L45 10 Z" fill={fillColor} stroke={strokeColor} strokeWidth="2" fillRule="evenodd"/>
          <path d="M47 7 L53 7 L53 13 L50 13 L50 10 L47 10 Z" fill={strokeColor} fillOpacity="0.3"/>
        </svg>
      );
    case 'wlasny':
      return (
        <svg viewBox="0 0 60 40" className="w-full h-12">
          <path d="M10 30 L15 10 L30 5 L45 10 L50 25 L40 35 L20 35 Z" fill={fillColor} stroke={strokeColor} strokeWidth="2"/>
          <circle cx="15" cy="10" r="2" fill={strokeColor}/>
          <circle cx="30" cy="5" r="2" fill={strokeColor}/>
          <circle cx="45" cy="10" r="2" fill={strokeColor}/>
          <circle cx="50" cy="25" r="2" fill={strokeColor}/>
        </svg>
      );
    default:
      return null;
  }
};

export function DimensionsStep({ onNext, onBack }: DimensionsStepProps) {
  const { state, dispatch } = useConfigurator();
  const { companySettings } = useSettings();
  const { dimensions, poolType, calculations } = state;
  const [showCustomDrawer, setShowCustomDrawer] = useState(false);

  useEffect(() => {
    // Recalculate when dimensions or pool type change
    const calcs = calculatePoolMetrics(dimensions, poolType);
    dispatch({ type: 'SET_CALCULATIONS', payload: calcs });
    
    const foilCalc = calculateFoilOptimization(
      dimensions, 
      state.foilType,
      companySettings.irregularSurchargePercent
    );
    dispatch({ type: 'SET_FOIL_CALCULATION', payload: foilCalc });
  }, [dimensions, poolType, state.foilType, companySettings.irregularSurchargePercent]);

  const updateDimension = (field: keyof typeof dimensions, value: any) => {
    dispatch({
      type: 'SET_DIMENSIONS',
      payload: { ...dimensions, [field]: value },
    });
  };

  // Calculate step count from depth
  const calculateStepCount = (poolDepth: number, stepHeight: number = 0.29) => {
    return Math.ceil(poolDepth / stepHeight);
  };

  // Update stairs config
  const updateStairs = (updates: Partial<StairsConfig>) => {
    const newStairs = { ...dimensions.stairs, ...updates };
    // Auto-calculate stepCount when enabling or when depth changes
    if (updates.enabled || !newStairs.stepCount) {
      newStairs.stepCount = calculateStepCount(dimensions.depth, newStairs.stepHeight);
    }
    dispatch({
      type: 'SET_DIMENSIONS',
      payload: { ...dimensions, stairs: newStairs },
    });
  };

  // Update wading pool config
  const updateWadingPool = (updates: Partial<WadingPoolConfig>) => {
    dispatch({
      type: 'SET_DIMENSIONS',
      payload: { ...dimensions, wadingPool: { ...dimensions.wadingPool, ...updates } },
    });
  };

  // Recalculate step count when depth changes
  useEffect(() => {
    if (dimensions.stairs?.enabled) {
      const newStepCount = calculateStepCount(dimensions.depth, dimensions.stairs.stepHeight);
      if (newStepCount !== dimensions.stairs.stepCount) {
        updateStairs({ stepCount: newStepCount });
      }
    }
  }, [dimensions.depth, dimensions.stairs?.stepHeight]);

  const isLShape = dimensions.shape === 'litera-l';
  const isCustomShape = dimensions.shape === 'wlasny';
  const isPublicPool = poolType === 'hotelowy';

  const handleShapeSelect = (shape: PoolShape) => {
    if (shape === 'wlasny') {
      setShowCustomDrawer(true);
    }
    updateDimension('shape', shape);
  };

  const handleCustomShapeComplete = (
    poolVertices: CustomPoolVertex[], 
    area: number, 
    perimeter: number,
    stairsVertices?: CustomPoolVertex[],
    wadingPoolVertices?: CustomPoolVertex[],
    stairsRotation?: number
  ) => {
    // Convert single vertices to arrays for the new format
    const stairsArray = stairsVertices && stairsVertices.length >= 3 ? [stairsVertices] : dimensions.customStairsVertices || [];
    const rotationsArray = stairsRotation !== undefined ? [stairsRotation] : dimensions.customStairsRotations || [];
    const wadingArray = wadingPoolVertices && wadingPoolVertices.length >= 3 ? [wadingPoolVertices] : dimensions.customWadingPoolVertices || [];

    dispatch({
      type: 'SET_DIMENSIONS',
      payload: {
        ...dimensions,
        shape: 'wlasny',
        customVertices: poolVertices,
        customArea: area,
        customPerimeter: perimeter,
        customStairsVertices: stairsArray,
        customStairsRotations: rotationsArray,
        customWadingPoolVertices: wadingArray,
        isIrregular: true,
        // If custom stairs/wading pool drawn, enable them
        stairs: stairsArray.length > 0
          ? { ...dimensions.stairs, enabled: true }
          : dimensions.stairs,
        wadingPool: wadingArray.length > 0
          ? { ...dimensions.wadingPool, enabled: true }
          : dimensions.wadingPool,
      },
    });
    setShowCustomDrawer(false);
  };

  return (
    <div className="animate-slide-up">
      {/* Custom Pool Drawer Dialog */}
      <Dialog open={showCustomDrawer} onOpenChange={setShowCustomDrawer}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5 text-primary" />
              Rysuj własny kształt basenu
            </DialogTitle>
          </DialogHeader>
          <CustomPoolDrawer
            onComplete={handleCustomShapeComplete}
            onCancel={() => setShowCustomDrawer(false)}
            initialPoolVertices={dimensions.customVertices}
            initialStairsVertices={dimensions.customStairsVertices?.[0]}
            initialWadingPoolVertices={dimensions.customWadingPoolVertices?.[0]}
            initialStairsRotation={dimensions.customStairsRotations?.[0]}
          />
        </DialogContent>
      </Dialog>

      <div className="section-header">
        <Ruler className="w-5 h-5 text-primary" />
        Wymiary i kształt basenu
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input form */}
        <div className="glass-card p-6 space-y-6">
          {/* Pool Shape Selection */}
          <div>
            <Label className="text-base font-medium mb-4 block">Kształt basenu</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {(Object.keys(poolShapeLabels) as PoolShape[]).map((shape) => (
                <button
                  key={shape}
                  onClick={() => handleShapeSelect(shape)}
                  className={`flex flex-col items-center justify-center p-3 rounded-lg border transition-all ${
                    dimensions.shape === shape
                      ? 'border-primary bg-primary/10 shadow-md'
                      : 'border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/30'
                  }`}
                >
                  <PoolShapeIcon shape={shape} isSelected={dimensions.shape === shape} />
                  <span className={`text-xs mt-2 text-center leading-tight ${
                    dimensions.shape === shape ? 'text-primary font-medium' : 'text-muted-foreground'
                  }`}>
                    {poolShapeLabels[shape]}
                  </span>
                </button>
              ))}
            </div>
            {isCustomShape && dimensions.customArea && (
              <div className="mt-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Własny kształt: {dimensions.customArea.toFixed(1)} m², obwód: {dimensions.customPerimeter?.toFixed(1)} m</span>
                  <Button variant="outline" size="sm" onClick={() => setShowCustomDrawer(true)}>
                    <Pencil className="w-3 h-3 mr-1" />
                    Edytuj
                  </Button>
                </div>
              </div>
            )}

            {/* Stairs Configuration */}
            <div className="mt-4 p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Footprints className="w-5 h-5 text-primary" />
                  <div>
                    <Label htmlFor="stairsEnabled" className="font-medium">Schodki</Label>
                    <p className="text-xs text-muted-foreground">
                      {dimensions.stairs?.enabled 
                        ? `${dimensions.stairs.stepCount || 5} stopni × ${((dimensions.stairs.stepHeight || 0.29) * 100).toFixed(0)}cm`
                        : 'Dodaj schodki do basenu'
                      }
                    </p>
                  </div>
                </div>
                <Switch
                  id="stairsEnabled"
                  checked={dimensions.stairs?.enabled || false}
                  onCheckedChange={(checked) => updateStairs({ enabled: checked })}
                />
              </div>
              
              {dimensions.stairs?.enabled && (
                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
                  <div className="space-y-2">
                    <Label className="text-sm">Pozycja</Label>
                    <Select
                      value={dimensions.stairs.position}
                      onValueChange={(value: StairsPosition) => updateStairs({ position: value })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(stairsPositionLabels) as StairsPosition[]).map((pos) => (
                          <SelectItem key={pos} value={pos}>{stairsPositionLabels[pos]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Narożnik</Label>
                    <Select
                      value={dimensions.stairs.corner}
                      onValueChange={(value: PoolCorner) => updateStairs({ corner: value })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(poolCornerLabels) as PoolCorner[]).map((corner) => (
                          <SelectItem key={corner} value={corner}>{poolCornerLabels[corner]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Kierunek</Label>
                    <Select
                      value={dimensions.stairs.direction}
                      onValueChange={(value: WallDirection) => updateStairs({ direction: value })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(wallDirectionLabels) as WallDirection[]).map((dir) => (
                          <SelectItem key={dir} value={dir}>{wallDirectionLabels[dir]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Szerokość (m)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="5"
                      value={typeof dimensions.stairs.width === 'number' ? dimensions.stairs.width : 1.5}
                      onChange={(e) => updateStairs({ width: parseFloat(e.target.value) || 1.5 })}
                      className="h-9"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Wading Pool Configuration */}
            <div className="mt-3 p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <Baby className="w-5 h-5 text-primary" />
                  <div>
                    <Label htmlFor="wadingPoolEnabled" className="font-medium">Brodzik dla dzieci</Label>
                    <p className="text-xs text-muted-foreground">
                      {dimensions.wadingPool?.enabled 
                        ? `${dimensions.wadingPool.width || 2}×${dimensions.wadingPool.length || 1.5}m, głęb. ${dimensions.wadingPool.depth || 0.4}m`
                        : 'Płytka strefa w narożniku basenu'
                      }
                    </p>
                  </div>
                </div>
                <Switch
                  id="wadingPoolEnabled"
                  checked={dimensions.wadingPool?.enabled || false}
                  onCheckedChange={(checked) => updateWadingPool({ enabled: checked })}
                />
              </div>
              
              {dimensions.wadingPool?.enabled && (
                <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-border">
                  <div className="space-y-2">
                    <Label className="text-sm">Narożnik</Label>
                    <Select
                      value={dimensions.wadingPool.corner}
                      onValueChange={(value: PoolCorner) => updateWadingPool({ corner: value })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(poolCornerLabels) as PoolCorner[]).map((corner) => (
                          <SelectItem key={corner} value={corner}>{poolCornerLabels[corner]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Kierunek</Label>
                    <Select
                      value={dimensions.wadingPool.direction}
                      onValueChange={(value: WallDirection) => updateWadingPool({ direction: value })}
                    >
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(wallDirectionLabels) as WallDirection[]).map((dir) => (
                          <SelectItem key={dir} value={dir}>{wallDirectionLabels[dir]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Szerokość (m)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="1"
                      max="10"
                      value={dimensions.wadingPool.width}
                      onChange={(e) => updateWadingPool({ width: parseFloat(e.target.value) || 2 })}
                      className="h-9"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-sm">Długość (m)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0.5"
                      max="5"
                      value={dimensions.wadingPool.length}
                      onChange={(e) => updateWadingPool({ length: parseFloat(e.target.value) || 1.5 })}
                      className="h-9"
                    />
                  </div>
                  
                  <div className="space-y-2 col-span-2">
                    <Label className="text-sm">Głębokość brodzika (m)</Label>
                    <Input
                      type="number"
                      step="0.05"
                      min="0.2"
                      max="0.8"
                      value={dimensions.wadingPool.depth}
                      onChange={(e) => updateWadingPool({ depth: parseFloat(e.target.value) || 0.4 })}
                      className="h-9"
                    />
                    <p className="text-xs text-muted-foreground">Typowo 0.3-0.6m dla dzieci</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Pool Type */}
          <div>
            <Label className="text-base font-medium mb-4 block">Typ basenu</Label>
            <RadioGroup
              value={poolType}
              onValueChange={(value) => dispatch({ type: 'SET_POOL_TYPE', payload: value as PoolType })}
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              {(Object.keys(poolTypeLabels) as PoolType[]).map((type) => (
                <div key={type} className="relative">
                  <RadioGroupItem
                    value={type}
                    id={type}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={type}
                    className="flex flex-col items-center justify-center p-4 rounded-lg border border-border bg-muted/30 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 hover:bg-muted/50"
                  >
                    <span className="font-medium">{poolTypeLabels[type]}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      Obciążenie: {nominalLoadByType[type]}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Pool Overflow Type (Skimmer / Gutter) */}
          <div>
            <Label className="text-base font-medium mb-4 block">Typ przelewu</Label>
            <RadioGroup
              value={dimensions.overflowType}
              onValueChange={(value) => updateDimension('overflowType', value as PoolOverflowType)}
              className="grid grid-cols-2 gap-3"
            >
              {(Object.keys(overflowTypeLabels) as PoolOverflowType[]).map((type) => (
                <div key={type} className="relative">
                  <RadioGroupItem
                    value={type}
                    id={`overflow-${type}`}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={`overflow-${type}`}
                    className="flex flex-col items-center justify-center p-4 rounded-lg border border-border bg-muted/30 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 hover:bg-muted/50"
                  >
                    <span className="font-medium">{overflowTypeLabels[type]}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {type === 'skimmerowy' ? 'Woda -10cm od krawędzi' : 'Woda = głębokość niecki'}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Main Dimensions - hidden for custom shape */}
          {!isCustomShape && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="length">{isLShape ? 'Długość ramienia 1 (m)' : 'Długość (m)'}</Label>
                <Input
                  id="length"
                  type="number"
                  step="0.1"
                  min="2"
                  max="50"
                  value={dimensions.length}
                  onChange={(e) => updateDimension('length', parseFloat(e.target.value) || 0)}
                  className="input-field"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="width">{isLShape ? 'Szerokość ramienia 1 (m)' : 'Szerokość (m)'}</Label>
                <Input
                  id="width"
                  type="number"
                  step="0.1"
                  min="2"
                  max="25"
                  value={dimensions.width}
                  onChange={(e) => updateDimension('width', parseFloat(e.target.value) || 0)}
                  className="input-field"
                />
              </div>

              {/* L-Shape additional dimensions */}
              {isLShape && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="lLength2">Długość ramienia 2 (m)</Label>
                    <Input
                      id="lLength2"
                      type="number"
                      step="0.1"
                      min="1"
                      max="30"
                      value={dimensions.lLength2 || 3}
                      onChange={(e) => updateDimension('lLength2', parseFloat(e.target.value) || 0)}
                      className="input-field"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="lWidth2">Szerokość ramienia 2 (m)</Label>
                    <Input
                      id="lWidth2"
                      type="number"
                      step="0.1"
                      min="1"
                      max="15"
                      value={dimensions.lWidth2 || 2}
                      onChange={(e) => updateDimension('lWidth2', parseFloat(e.target.value) || 0)}
                      className="input-field"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          {/* Depth section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center gap-3">
                <Ruler className="w-5 h-5 text-primary" />
                <div>
                  <Label htmlFor="hasSlope" className="font-medium">Spadek dna</Label>
                  <p className="text-xs text-muted-foreground">
                    Różne głębokości (płytko → głęboko)
                  </p>
                </div>
              </div>
              <Switch
                id="hasSlope"
                checked={dimensions.hasSlope}
                onCheckedChange={(checked) => {
                  updateDimension('hasSlope', checked);
                  if (checked && !dimensions.depthDeep) {
                    updateDimension('depthDeep', dimensions.depth + 0.5);
                  }
                }}
              />
            </div>

            <div className={`grid gap-4 ${dimensions.hasSlope ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <div className="space-y-2">
                <Label htmlFor="depth">{dimensions.hasSlope ? 'Głębokość płytka (m)' : 'Głębokość niecki (m)'}</Label>
                <Input
                  id="depth"
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="5"
                  value={dimensions.depth}
                  onChange={(e) => updateDimension('depth', parseFloat(e.target.value) || 0)}
                  className="input-field"
                />
                <p className="text-xs text-muted-foreground">
                  Woda: {calculations?.waterDepth?.toFixed(2) || (dimensions.depth - (dimensions.overflowType === 'skimmerowy' ? 0.1 : 0)).toFixed(2)} m
                </p>
              </div>

              {dimensions.hasSlope && (
                <div className="space-y-2">
                  <Label htmlFor="depthDeep">Głębokość głęboka (m)</Label>
                  <Input
                    id="depthDeep"
                    type="number"
                    step="0.1"
                    min={dimensions.depth}
                    max="5"
                    value={dimensions.depthDeep || dimensions.depth + 0.5}
                    onChange={(e) => updateDimension('depthDeep', parseFloat(e.target.value) || 0)}
                    className="input-field"
                  />
                  <p className="text-xs text-muted-foreground">
                    Spadek: {((dimensions.depthDeep || dimensions.depth) - dimensions.depth).toFixed(2)} m
                  </p>
                </div>
              )}

              {/* Attractions - only for public pools */}
              {isPublicPool && (
                <div className="space-y-2">
                  <Label htmlFor="attractions">Ilość atrakcji</Label>
                  <Input
                    id="attractions"
                    type="number"
                    step="1"
                    min="0"
                    max="20"
                    value={dimensions.attractions}
                    onChange={(e) => updateDimension('attractions', parseInt(e.target.value) || 0)}
                    className="input-field"
                  />
                  <p className="text-xs text-muted-foreground">
                    +{6 * dimensions.attractions} m³/h do filtracji
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border border-border">
            <div className="flex items-center gap-3">
              <Waves className="w-5 h-5 text-primary" />
              <div>
                <Label htmlFor="irregular" className="font-medium">Kształt nieregularny</Label>
                <p className="text-xs text-muted-foreground">
                  Dopłata {companySettings.irregularSurchargePercent}% do folii
                </p>
              </div>
            </div>
            <Switch
              id="irregular"
              checked={dimensions.isIrregular}
              onCheckedChange={(checked) => updateDimension('isIrregular', checked)}
              disabled={isCustomShape}
            />
          </div>
        </div>

        {/* Right: 3D Visualization & Calculations */}
        <div className="glass-card p-6">
          <Tabs defaultValue="3d" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="3d" className="flex items-center gap-2">
                <Box className="w-4 h-4" />
                Wizualizacja 3D
              </TabsTrigger>
              <TabsTrigger value="calculations" className="flex items-center gap-2">
                <Calculator className="w-4 h-4" />
                Obliczenia
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="3d" className="space-y-4">
              <Pool3DVisualization 
                dimensions={dimensions}
                calculations={calculations}
                showFoilLayout={false}
              />
              <p className="text-xs text-muted-foreground text-center">
                Widok niecki basenu z liniami wymiarowymi
              </p>
            </TabsContent>
            
            <TabsContent value="calculations">
              <div className="flex items-center gap-2 mb-4">
                <Droplets className="w-5 h-5 text-primary" />
                <h3 className="text-base font-medium">Obliczenia</h3>
              </div>

              {calculations && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Objętość</p>
                      <p className="text-2xl font-bold text-primary">
                        {calculations.volume.toFixed(1)} <span className="text-sm font-normal">m³</span>
                      </p>
                    </div>
                    
                    <div className="p-4 rounded-lg bg-muted/50 border border-border">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Powierzchnia lustra</p>
                      <p className="text-2xl font-bold">
                        {calculations.surfaceArea.toFixed(1)} <span className="text-sm font-normal">m²</span>
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground">Powierzchnia ścian</span>
                      <span className="font-medium">{calculations.wallArea.toFixed(1)} m²</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground">Obwód</span>
                      <span className="font-medium">{calculations.perimeterLength.toFixed(1)} m</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground">Głębokość wody</span>
                      <span className="font-medium">{calculations.waterDepth.toFixed(2)} m</span>
                    </div>
                    <div className="flex justify-between p-3 rounded-lg bg-muted/30">
                      <span className="text-muted-foreground">Typ przelewu</span>
                      <span className="font-medium">{overflowTypeLabels[dimensions.overflowType]}</span>
                    </div>
                  </div>

                  <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
                    <div className="flex items-start gap-2">
                      <Info className="w-4 h-4 text-accent mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-accent">Wydajność filtracji (DIN)</p>
                        <p className="text-2xl font-bold mt-1">
                          {calculations.requiredFlow.toFixed(1)} <span className="text-sm font-normal">m³/h</span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Formuła: (0.37 × {calculations.volume.toFixed(1)}) / {nominalLoadByType[poolType]}
                          {isPublicPool && dimensions.attractions > 0 && ` + (6 × ${dimensions.attractions})`}
                        </p>
                      </div>
                    </div>
                  </div>

                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

    </div>
  );
}