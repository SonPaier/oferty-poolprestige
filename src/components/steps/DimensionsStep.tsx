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
import { Alert, AlertDescription } from '@/components/ui/alert';
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
  Baby,
  AlertTriangle
} from 'lucide-react';
import { Pool3DVisualization, DimensionDisplay } from '@/components/Pool3DVisualization';
import Pool2DPreview from '@/components/Pool2DPreview';
import { 
  PoolType, 
  PoolShape, 
  PoolOverflowType, 
  PoolLiningType,
  PoolLocation,
  poolTypeLabels, 
  poolShapeLabels, 
  overflowTypeLabels, 
  liningTypeLabels,
  poolLocationLabels,
  nominalLoadByType, 
  CustomPoolVertex,
  StairsConfig,
  WadingPoolConfig,
  PoolCorner,
  PoolWall,
  WallDirection,
  StairsPosition,
  StairsPlacement,
  poolCornerLabels,
  poolWallLabels,
  wallDirectionLabels,
  stairsPositionLabels,
  stairsPlacementLabels
} from '@/types/configurator';
import { calculatePoolMetrics, calculateFoilOptimization } from '@/lib/calculations';
import { CustomPoolDrawer } from '@/components/CustomPoolDrawer';
import { usePoolGeometryValidation } from '@/hooks/usePoolGeometryValidation';

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
    case 'nieregularny':
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
  const [dimensionDisplay, setDimensionDisplay] = useState<DimensionDisplay>('pool');
  
  // Geometry validation
  const geometryWarnings = usePoolGeometryValidation(dimensions);

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

  // Calculate step height from step count and depth
  // Each step has equal height = poolDepth / stepCount
  // First step starts at -stepHeight (below pool edge)
  const calculateStepHeight = (poolDepth: number, stepCount: number) => {
    if (stepCount <= 0) return 0.20;
    return poolDepth / stepCount;
  };

  // Calculate actual step depth based on pool dimensions and step count
  // Step depth should be at least the configured minimum, but may be larger
  const calculateActualStepDepth = (minStepDepth: number, stairsConfig: StairsConfig, poolLength: number, poolWidth: number) => {
    if (!stairsConfig.enabled) return minStepDepth;
    
    const stepCount = stairsConfig.stepCount || 4;
    const placement = stairsConfig.placement || 'wall';
    const wall = stairsConfig.wall || 'back';
    const corner = stairsConfig.corner || 'back-left';
    const direction = stairsConfig.direction || 'along-width';
    
    // Calculate available depth based on placement
    let availableDepth = 0;
    
    if (placement === 'wall') {
      // For wall placement, stairs go into the pool perpendicular to the wall
      if (wall === 'back' || wall === 'front') {
        availableDepth = poolWidth;
      } else {
        availableDepth = poolLength;
      }
    } else if (placement === 'corner') {
      // For corner placement, depth depends on direction
      if (direction === 'along-length') {
        availableDepth = poolLength;
      } else {
        availableDepth = poolWidth;
      }
    } else if (placement === 'diagonal') {
      // For diagonal, use the smaller of length/width
      availableDepth = Math.min(poolLength, poolWidth);
    }
    
    // Calculate step depth to fill available space
    const calculatedDepth = availableDepth / stepCount;
    
    // Return at least the minimum configured depth
    return Math.max(minStepDepth, calculatedDepth);
  };

  // Get available corner labels based on pool vertices
  const getCornerLabels = () => {
    if (dimensions.customVertices && dimensions.customVertices.length >= 3) {
      return dimensions.customVertices.map((_, index) => ({
        value: String.fromCharCode(65 + index), // A, B, C, D...
        label: `Narożnik ${String.fromCharCode(65 + index)}`
      }));
    }
    // For rectangular pools, default to A, B, C, D
    return [
      { value: 'A', label: 'Narożnik A (tylny lewy)' },
      { value: 'B', label: 'Narożnik B (tylny prawy)' },
      { value: 'C', label: 'Narożnik C (przedni prawy)' },
      { value: 'D', label: 'Narożnik D (przedni lewy)' }
    ];
  };

  // Update stairs config
  const updateStairs = (updates: Partial<StairsConfig>) => {
    const newStairs = { ...dimensions.stairs, ...updates };
    // Auto-calculate stepHeight when stepCount changes
    if (updates.stepCount !== undefined) {
      newStairs.stepHeight = calculateStepHeight(dimensions.depth, updates.stepCount);
    }
    // Set default stepCount when enabling if not set
    if (updates.enabled && !newStairs.stepCount) {
      newStairs.stepCount = 4; // Default to 4 steps
      newStairs.stepHeight = calculateStepHeight(dimensions.depth, 4);
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

  // Recalculate step height when depth changes (keeping step count)
  useEffect(() => {
    if (dimensions.stairs?.enabled && dimensions.stairs.stepCount) {
      const newStepHeight = calculateStepHeight(dimensions.depth, dimensions.stairs.stepCount);
      if (Math.abs(newStepHeight - (dimensions.stairs.stepHeight || 0)) > 0.001) {
        updateStairs({ stepHeight: newStepHeight });
      }
    }
  }, [dimensions.depth]);

  const isCustomShape = dimensions.shape === 'nieregularny';

  const handleShapeSelect = (shape: PoolShape) => {
    if (shape === 'nieregularny') {
      // When switching to irregular shape, open drawer immediately
      // and clear rectangle dimensions so they don't show in visualization
      setShowCustomDrawer(true);
    } else if (shape === 'prostokatny' && dimensions.shape !== 'prostokatny') {
      // When switching to rectangular, generate vertices from length/width
      generateRectangularVertices();
    }
    updateDimension('shape', shape);
  };

  // Generate rectangular vertices from current length/width
  const generateRectangularVertices = () => {
    const { length, width } = dimensions;
    const vertices = [
      { x: 0, y: 0 },
      { x: length, y: 0 },
      { x: length, y: width },
      { x: 0, y: width }
    ];
    dispatch({
      type: 'SET_DIMENSIONS',
      payload: {
        ...dimensions,
        customVertices: vertices,
        customArea: length * width,
        customPerimeter: 2 * (length + width)
      }
    });
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
        shape: 'nieregularny',
        customVertices: poolVertices,
        customArea: area,
        customPerimeter: perimeter,
        customStairsVertices: stairsArray,
        customStairsRotations: rotationsArray,
        customWadingPoolVertices: wadingArray,
        // isIrregular left unchanged - user can manually toggle it
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
              {dimensions.shape === 'nieregularny' ? 'Edytuj kształt nieregularny' : 'Edytuj kształt basenu'}
            </DialogTitle>
          </DialogHeader>
          <CustomPoolDrawer
            onComplete={handleCustomShapeComplete}
            onCancel={() => setShowCustomDrawer(false)}
            initialPoolVertices={dimensions.customVertices}
            initialStairsVertices={dimensions.customStairsVertices?.[0]}
            initialWadingPoolVertices={dimensions.customWadingPoolVertices?.[0]}
            initialStairsRotation={dimensions.customStairsRotations?.[0]}
            initialLength={dimensions.length}
            initialWidth={dimensions.width}
            shape={dimensions.shape === 'nieregularny' ? 'nieregularny' : 'prostokatny'}
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
                  <span className="text-sm">Nieregularny kształt: {dimensions.customArea.toFixed(1)} m², obwód: {dimensions.customPerimeter?.toFixed(1)} m</span>
                  <Button variant="outline" size="sm" onClick={() => setShowCustomDrawer(true)}>
                    <Pencil className="w-3 h-3 mr-1" />
                    Edytuj
                  </Button>
                </div>
              </div>
            )}
            {/* Edit shape button for rectangular pools */}
            {dimensions.shape === 'prostokatny' && (
              <div className="mt-3">
                <Button variant="outline" size="sm" onClick={() => setShowCustomDrawer(true)}>
                  <Pencil className="w-3 h-3 mr-1" />
                  Edytuj w edytorze kształtu
                </Button>
                <p className="text-xs text-muted-foreground mt-1">
                  Otwórz graficzny edytor z oznaczeniem narożników (A, B, C, D)
                </p>
              </div>
            )}
          </div>

          {/* Info and edit button for custom shapes */}
          {isCustomShape && (
            <div className="mt-4 p-4 rounded-lg bg-primary/10 border border-primary/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <Info className="w-4 h-4 text-primary" />
                  <span>Kształt nieregularny - edytuj w graficznym edytorze.</span>
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowCustomDrawer(true)}>
                  <Pencil className="w-3 h-3 mr-1" />
                  Edytuj kształt
                </Button>
              </div>
              <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                {dimensions.customStairsVertices && dimensions.customStairsVertices.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Footprints className="w-3 h-3" />
                    Schody: ✓
                  </span>
                )}
                {dimensions.customWadingPoolVertices && dimensions.customWadingPoolVertices.length > 0 && (
                  <span className="flex items-center gap-1">
                    <Baby className="w-3 h-3" />
                    Brodzik: ✓
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Pool Lining Type (Ceramic/Foil) */}
          <div>
            <Label className="text-base font-medium mb-4 block">Typ wykończenia</Label>
            <RadioGroup
              value={dimensions.liningType}
              onValueChange={(value) => updateDimension('liningType', value as PoolLiningType)}
              className="grid grid-cols-2 gap-3"
            >
              {(Object.keys(liningTypeLabels) as PoolLiningType[]).map((type) => (
                <div key={type} className="relative">
                  <RadioGroupItem
                    value={type}
                    id={`lining-${type}`}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={`lining-${type}`}
                    className="flex flex-col items-center justify-center p-4 rounded-lg border border-border bg-muted/30 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 hover:bg-muted/50"
                  >
                    <span className="font-medium">{liningTypeLabels[type]}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {type === 'foliowany' ? 'Wykończenie folią PVC' : 'Płytki ceramiczne'}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
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

          {/* Pool Location (Indoor/Outdoor) */}
          <div>
            <Label className="text-base font-medium mb-4 block">Lokalizacja basenu</Label>
            <RadioGroup
              value={dimensions.location || 'zewnetrzny'}
              onValueChange={(value) => updateDimension('location', value as PoolLocation)}
              className="grid grid-cols-2 gap-3"
            >
              {(Object.keys(poolLocationLabels) as PoolLocation[]).map((loc) => (
                <div key={loc} className="relative">
                  <RadioGroupItem
                    value={loc}
                    id={`location-${loc}`}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={`location-${loc}`}
                    className="flex flex-col items-center justify-center p-4 rounded-lg border border-border bg-muted/30 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 hover:bg-muted/50"
                  >
                    <span className="font-medium">{poolLocationLabels[loc]}</span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {loc === 'wewnetrzny' ? 'W budynku / hala' : 'Na zewnątrz / ogród'}
                    </span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

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
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="length">Długość (m)</Label>
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
                <Label htmlFor="width">Szerokość (m)</Label>
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

              <div className="space-y-2">
                <Label htmlFor="depth">Głębokość (m)</Label>
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
            </div>
          )}

          {/* Slope, Deep Depth and Attractions section */}
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

            <div className={`grid gap-4 ${dimensions.hasSlope ? 'grid-cols-2' : 'grid-cols-1'}`}>
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

              {/* Attractions - now available for ALL pool types */}
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
            </div>
          </div>

          {/* Stairs configuration - available for all shapes */}
          <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Footprints className="w-5 h-5 text-primary" />
                  <div>
                    <Label htmlFor="stairsEnabled" className="font-medium">Schody</Label>
                    <p className="text-xs text-muted-foreground">
                      Dodaj schody do basenu
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
                <div className="space-y-4 pt-3 border-t border-border">
                  {/* Placement type */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Typ umiejscowienia</Label>
                    <RadioGroup
                      value={dimensions.stairs.placement || 'wall'}
                      onValueChange={(value) => updateStairs({ placement: value as StairsPlacement })}
                      className="grid grid-cols-2 gap-2"
                    >
                      {(Object.keys(stairsPlacementLabels) as StairsPlacement[]).map((pl) => (
                        <div key={pl} className="relative">
                          <RadioGroupItem
                            value={pl}
                            id={`placement-${pl}`}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={`placement-${pl}`}
                            className="flex flex-col items-center justify-center p-3 rounded-lg border border-border bg-background cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 hover:bg-muted/50 text-sm"
                          >
                            {stairsPlacementLabels[pl]}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                  
                  {/* Wall selection - visible when placement === 'wall' */}
                  {dimensions.stairs.placement === 'wall' && (
                    <div>
                      <Label className="text-sm font-medium mb-2 block">Ściana</Label>
                      <Select
                        value={dimensions.stairs.wall || 'back'}
                        onValueChange={(value) => updateStairs({ wall: value as PoolWall })}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.keys(poolWallLabels) as PoolWall[]).map((w) => (
                            <SelectItem key={w} value={w}>
                              {poolWallLabels[w]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  
                  {/* Corner selection with labels (A, B, C...) - visible when placement === 'corner' or 'diagonal' */}
                  {(dimensions.stairs.placement === 'corner' || dimensions.stairs.placement === 'diagonal') && (
                    <>
                      <div>
                        <Label className="text-sm font-medium mb-2 block">Narożnik (A, B, C...)</Label>
                        <Select
                          value={dimensions.stairs.cornerLabel || 'A'}
                          onValueChange={(value) => {
                            // Map letter to PoolCorner for backward compatibility
                            const cornerMap: Record<string, PoolCorner> = {
                              'A': 'back-left',
                              'B': 'back-right',
                              'C': 'front-right',
                              'D': 'front-left'
                            };
                            updateStairs({ 
                              cornerLabel: value,
                              corner: cornerMap[value] || 'back-left'
                            });
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Wybierz narożnik" />
                          </SelectTrigger>
                          <SelectContent>
                            {getCornerLabels().map((corner) => (
                              <SelectItem key={corner.value} value={corner.value}>
                                {corner.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {dimensions.stairs.placement === 'corner' && (
                        <div>
                          <Label className="text-sm font-medium mb-2 block">Kierunek</Label>
                          <Select
                            value={dimensions.stairs.direction || 'along-width'}
                            onValueChange={(value) => updateStairs({ direction: value as WallDirection })}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {(Object.keys(wallDirectionLabels) as WallDirection[]).map((d) => (
                                <SelectItem key={d} value={d}>
                                  {wallDirectionLabels[d]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}
                  
                  {/* Stairs width */}
                  <div>
                    <Label htmlFor="stairsWidth" className="text-sm font-medium mb-2 block">
                      Szerokość schodów (m)
                    </Label>
                    <Input
                      id="stairsWidth"
                      type="number"
                      step="0.1"
                      min="0.5"
                      max={dimensions.stairs.placement === 'wall' 
                        ? (dimensions.stairs.wall === 'left' || dimensions.stairs.wall === 'right' ? dimensions.width : dimensions.length)
                        : 5}
                      value={typeof dimensions.stairs.width === 'number' ? dimensions.stairs.width : 1.5}
                      onChange={(e) => updateStairs({ width: parseFloat(e.target.value) || 1.5 })}
                      className="input-field"
                    />
                  </div>
                  
                  {/* Step count and depth */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="stepCount" className="text-sm font-medium mb-2 block">
                        Liczba stopni
                      </Label>
                      <Input
                        id="stepCount"
                        type="number"
                        step="1"
                        min="2"
                        max="15"
                        value={dimensions.stairs.stepCount || 4}
                        onChange={(e) => {
                          const count = parseInt(e.target.value) || 4;
                          updateStairs({ stepCount: Math.max(2, Math.min(15, count)) });
                        }}
                        className="input-field"
                      />
                      <p className="text-xs text-muted-foreground mt-1">2-15 stopni</p>
                    </div>
                    <div>
                      <Label htmlFor="stepDepth" className="text-sm font-medium mb-2 block">
                        Głęb. stopnia (cm)
                      </Label>
                      <Input
                        id="stepDepth"
                        type="number"
                        step="1"
                        min="20"
                        max="50"
                        value={Math.round((dimensions.stairs.stepDepth || 0.30) * 100)}
                        onChange={(e) => {
                          const cm = parseFloat(e.target.value) || 30;
                          updateStairs({ stepDepth: cm / 100 });
                        }}
                        className="input-field"
                      />
                      <p className="text-xs text-muted-foreground mt-1">zalecane 30 cm</p>
                    </div>
                  </div>
                  
                  {/* Calculated step info */}
                  <div className="p-2 rounded bg-muted/50 text-xs text-muted-foreground space-y-1">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-3 h-3" />
                      <span>
                        Wysokość stopnia: {Math.round((dimensions.depth / (dimensions.stairs.stepCount || 4)) * 100)} cm
                      </span>
                    </div>
                    <div className="text-muted-foreground/70">
                      Pierwszy stopień zaczyna się {Math.round((dimensions.depth / (dimensions.stairs.stepCount || 4)) * 100)} cm poniżej krawędzi basenu
                    </div>
                    <div className="text-muted-foreground/70">
                      Głębokość stopnia (min): {Math.round((dimensions.stairs.stepDepth || 0.30) * 100)} cm
                      {' '}→{' '}
                      Faktyczna: {Math.round(calculateActualStepDepth(dimensions.stairs.stepDepth || 0.30, dimensions.stairs, dimensions.length, dimensions.width) * 100)} cm
                    </div>
                  </div>
                  
                  {/* Position (inside/outside) */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Pozycja</Label>
                    <RadioGroup
                      value={dimensions.stairs.position || 'inside'}
                      onValueChange={(value) => updateStairs({ position: value as StairsPosition })}
                      className="grid grid-cols-2 gap-2"
                    >
                      {(Object.keys(stairsPositionLabels) as StairsPosition[]).map((pos) => (
                        <div key={pos} className="relative">
                          <RadioGroupItem
                            value={pos}
                            id={`position-${pos}`}
                            className="peer sr-only"
                          />
                          <Label
                            htmlFor={`position-${pos}`}
                            className="flex flex-col items-center justify-center p-2 rounded-lg border border-border bg-background cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 hover:bg-muted/50 text-xs"
                          >
                            {stairsPositionLabels[pos]}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              )}
            </div>

          {/* Wading pool configuration for non-custom shapes */}
          {!isCustomShape && (
            <div className="space-y-4 p-4 rounded-lg bg-muted/30 border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Baby className="w-5 h-5 text-primary" />
                  <div>
                    <Label htmlFor="wadingPoolEnabled" className="font-medium">Brodzik</Label>
                    <p className="text-xs text-muted-foreground">
                      Dodaj brodzik dla dzieci
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
                <div className="space-y-4 pt-3 border-t border-border">
                  {/* Corner selection */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Narożnik</Label>
                    <Select
                      value={dimensions.wadingPool.corner || 'back-left'}
                      onValueChange={(value) => updateWadingPool({ corner: value as PoolCorner })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(poolCornerLabels) as PoolCorner[]).map((c) => (
                          <SelectItem key={c} value={c}>
                            {poolCornerLabels[c]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Direction */}
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Kierunek</Label>
                    <Select
                      value={dimensions.wadingPool.direction || 'along-width'}
                      onValueChange={(value) => updateWadingPool({ direction: value as WallDirection })}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(wallDirectionLabels) as WallDirection[]).map((d) => (
                          <SelectItem key={d} value={d}>
                            {wallDirectionLabels[d]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Size inputs */}
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="wadingWidth" className="text-xs">Szerokość (m)</Label>
                      <Input
                        id="wadingWidth"
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="10"
                        value={dimensions.wadingPool.width || 2}
                        onChange={(e) => updateWadingPool({ width: parseFloat(e.target.value) || 2 })}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <Label htmlFor="wadingLength" className="text-xs">Długość (m)</Label>
                      <Input
                        id="wadingLength"
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="10"
                        value={dimensions.wadingPool.length || 1.5}
                        onChange={(e) => updateWadingPool({ length: parseFloat(e.target.value) || 1.5 })}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <Label htmlFor="wadingDepth" className="text-xs">Głębokość (m)</Label>
                      <Input
                        id="wadingDepth"
                        type="number"
                        step="0.1"
                        min="0.2"
                        max="1"
                        value={dimensions.wadingPool.depth || 0.4}
                        onChange={(e) => updateWadingPool({ depth: parseFloat(e.target.value) || 0.4 })}
                        className="input-field"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Geometry validation warnings */}
          {geometryWarnings.length > 0 && (
            <div className="space-y-2">
              {geometryWarnings.map((warning, index) => (
                <Alert 
                  key={index} 
                  variant={warning.severity === 'error' ? 'destructive' : 'default'}
                  className={warning.severity === 'warning' ? 'border-yellow-500 bg-yellow-500/10' : ''}
                >
                  <AlertTriangle className={`h-4 w-4 ${warning.severity === 'warning' ? 'text-yellow-600' : ''}`} />
                  <AlertDescription className={warning.severity === 'warning' ? 'text-yellow-700' : ''}>
                    {warning.message}
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          )}

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
              {/* Dimension display control */}
              <div className="flex items-center gap-2 text-xs">
                <span className="font-medium">Wymiary:</span>
                <RadioGroup 
                  value={dimensionDisplay} 
                  onValueChange={(value) => setDimensionDisplay(value as DimensionDisplay)}
                  className="flex flex-wrap gap-2"
                >
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="pool" id="dim-pool-main" className="h-3 w-3" />
                    <Label htmlFor="dim-pool-main" className="text-xs cursor-pointer">Niecka</Label>
                  </div>
                  {(dimensions.stairs?.enabled || (dimensions.shape === 'nieregularny' && dimensions.customStairsVertices?.some(arr => arr.length >= 3))) && (
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="stairs" id="dim-stairs-main" className="h-3 w-3" />
                      <Label htmlFor="dim-stairs-main" className="text-xs cursor-pointer">Schody</Label>
                    </div>
                  )}
                  {(dimensions.wadingPool?.enabled || (dimensions.shape === 'nieregularny' && dimensions.customWadingPoolVertices?.some(arr => arr.length >= 3))) && (
                    <div className="flex items-center space-x-1">
                      <RadioGroupItem value="wading" id="dim-wading-main" className="h-3 w-3" />
                      <Label htmlFor="dim-wading-main" className="text-xs cursor-pointer">Brodzik</Label>
                    </div>
                  )}
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="all" id="dim-all-main" className="h-3 w-3" />
                    <Label htmlFor="dim-all-main" className="text-xs cursor-pointer">Wszystko</Label>
                  </div>
                  <div className="flex items-center space-x-1">
                    <RadioGroupItem value="none" id="dim-none-main" className="h-3 w-3" />
                    <Label htmlFor="dim-none-main" className="text-xs cursor-pointer">Brak</Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div className="flex flex-col gap-4">
                <div>
                  <Pool2DPreview 
                    dimensions={dimensions}
                    height={200}
                    dimensionDisplay={dimensionDisplay}
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    Widok z góry (2D)
                  </p>
                </div>
                <div>
                  <Pool3DVisualization 
                    dimensions={dimensions}
                    calculations={calculations}
                    showFoilLayout={false}
                    height={320}
                    dimensionDisplay={dimensionDisplay}
                    onDimensionDisplayChange={setDimensionDisplay}
                  />
                  <p className="text-xs text-muted-foreground text-center mt-1">
                    Wizualizacja 3D
                  </p>
                </div>
              </div>
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
                          {dimensions.attractions > 0 && ` + (6 × ${dimensions.attractions})`}
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