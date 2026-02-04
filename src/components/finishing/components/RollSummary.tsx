import { Package, Layers, Recycle, Trash2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow,
} from '@/components/ui/table';
import { 
  MixConfiguration, 
  packStripsIntoRolls, 
  partitionSurfacesByFoilType,
  SurfaceRollConfig,
  OptimizationPriority,
  ROLL_WIDTH_NARROW,
  ROLL_WIDTH_WIDE,
  SurfaceDetailedResult,
  ReusableOffcut,
  UnusableWaste,
  calculateSurfaceDetails,
  getReusableOffcutsWithDimensions,
  getUnusableWaste,
  calculateButtJointMeters,
} from '@/lib/foil/mixPlanner';
import { Badge } from '@/components/ui/badge';
import { PoolDimensions } from '@/types/configurator';
import { FoilSubtype } from '@/lib/finishingMaterials';

interface RollSummaryProps {
  config: MixConfiguration;
  dimensions: PoolDimensions;
  foilSubtype?: FoilSubtype | null;
  /** Whether main foil is structural (allows merging both pools) */
  isMainFoilStructural?: boolean;
  /** Main foil area for pricing */
  mainFoilAreaForPricing?: number;
  /** Main foil weld/overlap area */
  mainWeldArea?: number;
  /** Structural foil area for pricing */
  structuralFoilAreaForPricing?: number;
  /** Structural foil weld/overlap area */
  structuralWeldArea?: number;
  /** @deprecated Use mainFoilAreaForPricing instead */
  foilAreaForPricing?: number;
  /** Optimization priority */
  optimizationPriority: OptimizationPriority;
  /** Callback when priority changes */
  onPriorityChange: (priority: OptimizationPriority) => void;
}

interface RollCountsDisplayProps {
  totalRolls165: number;
  totalRolls205: number;
  colorClass: string;
}

function RollCountsDisplay({ totalRolls165, totalRolls205, colorClass }: RollCountsDisplayProps) {
  const totalRolls = totalRolls165 + totalRolls205;
  
  return (
    <div className={`p-4 rounded-lg border ${colorClass}`}>
      <div className="flex flex-wrap items-center gap-3">
        {totalRolls165 > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
            <span className="text-xl font-bold text-blue-700 dark:text-blue-300">
              {totalRolls165}×
            </span>
            <div className="text-sm">
              <div className="font-medium text-blue-800 dark:text-blue-200">1.65m</div>
              <div className="text-blue-600 dark:text-blue-400 text-xs">× 25m</div>
            </div>
          </div>
        )}

        {totalRolls205 > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800">
            <span className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
              {totalRolls205}×
            </span>
            <div className="text-sm">
              <div className="font-medium text-emerald-800 dark:text-emerald-200">2.05m</div>
              <div className="text-emerald-600 dark:text-emerald-400 text-xs">× 25m</div>
            </div>
          </div>
        )}

        <div className="px-3 py-2 rounded-lg bg-primary/10 border border-primary/30">
          <div className="text-xl font-bold text-primary">{totalRolls}</div>
          <div className="text-xs text-muted-foreground">rolek</div>
        </div>
      </div>
    </div>
  );
}

interface StripDetailsTableProps {
  details: SurfaceDetailedResult[];
}

function StripDetailsTable({ details }: StripDetailsTableProps) {
  if (details.length === 0) return null;
  
  // Calculate totals
  const totalCoverArea = details.reduce((sum, d) => sum + d.coverArea, 0);
  const totalFoilArea = details.reduce((sum, d) => sum + d.totalFoilArea, 0);
  const totalWeldArea = details.reduce((sum, d) => sum + d.weldArea, 0);
  const totalWasteArea = details.reduce((sum, d) => sum + d.wasteArea, 0);
  
  // Check if any surface uses butt joint (for label in total row)
  const hasButtJoint = details.some(d => d.isButtJoint);
  const weldLabel = hasButtJoint ? 'zgrzew' : 'zakł.';
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Miejsce</TableHead>
            <TableHead className="font-semibold">Rozpiska pasów</TableHead>
            <TableHead className="text-right font-semibold">Powierzchnia</TableHead>
            <TableHead className="text-right font-semibold">Pow. folii</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {details.map((detail) => {
            // Use "zgrzew" for butt joint surfaces, "zakł." for overlap
            const detailWeldLabel = detail.isButtJoint ? 'zgrzew' : 'zakł.';
            
            return (
              <TableRow key={detail.surfaceKey}>
                <TableCell className="font-medium align-top">{detail.surfaceLabel}</TableCell>
                <TableCell>
                  <div className="space-y-1">
                    {detail.strips.map((strip, idx) => (
                      <div key={idx} className="text-sm flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${strip.rollWidth === 2.05 ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                        <span>
                          {strip.count}× pas {strip.rollWidth}m × {strip.stripLength.toFixed(1)}m
                          {strip.rollNumber && (
                            <span className="text-muted-foreground ml-1">(#{strip.rollNumber})</span>
                          )}
                          {strip.wallLabels && strip.wallLabels.length > 0 && (
                            <Badge variant="outline" className="ml-2 text-xs">
                              {strip.wallLabels.join(', ')}
                            </Badge>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-right align-top">
                  {detail.coverArea} m²
                </TableCell>
                <TableCell className="text-right align-top">
                  <div className="font-medium">{detail.totalFoilArea} m²</div>
                  <div className="text-xs text-muted-foreground">
                    ({detail.coverArea} + {detail.weldArea} {detailWeldLabel} + {detail.wasteArea} odp.)
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {/* Total row */}
          <TableRow className="bg-primary/5 border-t-2 font-semibold">
            <TableCell colSpan={2} className="text-right">
              Razem
            </TableCell>
            <TableCell className="text-right">
              {Math.round(totalCoverArea * 10) / 10} m²
            </TableCell>
            <TableCell className="text-right">
              <div className="font-bold text-primary">{totalFoilArea} m²</div>
              <div className="text-xs text-muted-foreground font-normal">
                ({Math.round(totalCoverArea * 10) / 10} + {Math.round(totalWeldArea * 10) / 10} {weldLabel} + {Math.round(totalWasteArea * 10) / 10} odp.)
              </div>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

interface ReusableOffcutsTableProps {
  offcuts: ReusableOffcut[];
}

function ReusableOffcutsTable({ offcuts }: ReusableOffcutsTableProps) {
  if (offcuts.length === 0) {
    return (
      <div className="p-4 rounded-lg border bg-muted/30 text-center text-sm text-muted-foreground">
        <Recycle className="h-5 w-5 mx-auto mb-2 opacity-50" />
        Brak odpadu do ponownego wykorzystania (wszystkie odcinki &lt; 2m długości)
      </div>
    );
  }
  
  // Group by roll width
  const grouped = offcuts.reduce((acc, offcut) => {
    const key = `${offcut.rollNumber}-${offcut.rollWidth}`;
    if (!acc[key]) {
      acc[key] = { ...offcut, pieces: 1 };
    } else {
      acc[key].pieces++;
      acc[key].area += offcut.area;
    }
    return acc;
  }, {} as Record<string, ReusableOffcut & { pieces: number }>);
  
  const groupedOffcuts = Object.values(grouped);
  const totalArea = offcuts.reduce((sum, o) => sum + o.area, 0);
  
  return (
    <div className="border rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead className="font-semibold">Rolka</TableHead>
            <TableHead className="font-semibold">Wymiar</TableHead>
            <TableHead className="text-right font-semibold">Powierzchnia</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupedOffcuts.map((offcut, idx) => (
            <TableRow key={idx}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${offcut.rollWidth === 2.05 ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                  <span>#{offcut.rollNumber} ({offcut.rollWidth}m)</span>
                </div>
              </TableCell>
              <TableCell>
                {offcut.length}m × {offcut.rollWidth}m
              </TableCell>
              <TableCell className="text-right font-medium">
                {offcut.area.toFixed(2)} m²
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-green-50 dark:bg-green-900/20 border-t-2">
            <TableCell colSpan={2} className="font-semibold">
              Razem do wykorzystania
            </TableCell>
            <TableCell className="text-right font-bold text-green-600 dark:text-green-400">
              {totalArea.toFixed(2)} m²
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

interface UnusableWasteTableProps {
  wastes: UnusableWaste[];
}

function UnusableWasteTable({ wastes }: UnusableWasteTableProps) {
  if (wastes.length === 0) {
    return null; // No unusable waste - don't show the section
  }
  
  const totalArea = wastes.reduce((sum, w) => sum + w.area, 0);
  
  return (
    <div className="border rounded-lg overflow-hidden border-red-200 dark:border-red-800">
      <Table>
        <TableHeader>
          <TableRow className="bg-red-50/50 dark:bg-red-900/20">
            <TableHead className="font-semibold">Rolka</TableHead>
            <TableHead className="font-semibold">Wymiar</TableHead>
            <TableHead className="font-semibold">Źródło</TableHead>
            <TableHead className="text-right font-semibold">Powierzchnia</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {wastes.map((waste, idx) => (
            <TableRow key={idx}>
              <TableCell>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${waste.rollWidth === 2.05 ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                  <span>#{waste.rollNumber} ({waste.rollWidth}m)</span>
                </div>
              </TableCell>
              <TableCell>
                {waste.length}m × {waste.width}m
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {waste.source}
              </TableCell>
              <TableCell className="text-right font-medium">
                {waste.area.toFixed(2)} m²
              </TableCell>
            </TableRow>
          ))}
          <TableRow className="bg-red-50 dark:bg-red-900/20 border-t-2">
            <TableCell colSpan={3} className="font-semibold">
              Razem odpad nieużyteczny
            </TableCell>
            <TableCell className="text-right font-bold text-red-600 dark:text-red-400">
              {totalArea.toFixed(2)} m²
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
  );
}

export function RollSummary({ 
  config, 
  dimensions,
  foilSubtype,
  isMainFoilStructural = false, 
  mainFoilAreaForPricing,
  mainWeldArea,
  structuralFoilAreaForPricing,
  structuralWeldArea,
  foilAreaForPricing,
  optimizationPriority,
  onPriorityChange,
}: RollSummaryProps) {
  const { main, structural } = partitionSurfacesByFoilType(config.surfaces);
  
  // Pack strips SEPARATELY for each foil type (not together!)
  const mainConfig = { ...config, surfaces: main };
  const structuralConfig = { ...config, surfaces: structural };
  
  const mainRolls = packStripsIntoRolls(mainConfig, dimensions, foilSubtype, optimizationPriority);
  const structuralRolls = packStripsIntoRolls(structuralConfig, dimensions, foilSubtype, optimizationPriority);

  // Calculate roll counts per pool
  const mainRolls165 = mainRolls.filter(r => r.rollWidth === ROLL_WIDTH_NARROW).length;
  const mainRolls205 = mainRolls.filter(r => r.rollWidth === ROLL_WIDTH_WIDE).length;
  const structuralRolls165 = structuralRolls.filter(r => r.rollWidth === ROLL_WIDTH_NARROW).length;

  // Calculate detailed surface info
  const surfaceDetails = calculateSurfaceDetails(config, dimensions, foilSubtype, optimizationPriority);
  const mainDetails = surfaceDetails.filter(d => 
    d.surfaceKey === 'bottom' || d.surfaceKey === 'walls' || d.surfaceKey === 'dividing-wall'
  );
  const structuralDetails = surfaceDetails.filter(d => 
    d.surfaceKey === 'stairs' || d.surfaceKey === 'paddling'
  );
  
  // Get reusable offcuts and unusable waste
  const reusableOffcuts = getReusableOffcutsWithDimensions(config, dimensions, foilSubtype, optimizationPriority);
  const unusableWaste = getUnusableWaste(config, dimensions, foilSubtype, optimizationPriority);

  // Calculate totals
  const totalArea = config.surfaces.reduce((sum, s) => sum + s.areaM2, 0);
  const totalWaste = config.surfaces.reduce((sum, s) => sum + s.wasteM2, 0);
  const totalRollArea = config.totalRolls165 * 1.65 * 25 + config.totalRolls205 * 2.05 * 25;
  const utilizationPercent = totalRollArea > 0 ? ((totalRollArea - totalWaste) / totalRollArea) * 100 : 0;
  
  // Calculate butt joint meters for structural foil
  const buttJointMeters = calculateButtJointMeters(config, dimensions, foilSubtype);

  // If main foil is structural, show combined view
  if (isMainFoilStructural) {
    return (
      <div className="space-y-6">
        {/* Header with toggle - removed duplicate heading */}
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-3">
            <Label htmlFor="priority-toggle" className={`text-sm ${optimizationPriority === 'minWaste' ? 'font-medium' : 'text-muted-foreground'}`}>
              Min. odpad
            </Label>
            <Switch
              id="priority-toggle"
              checked={optimizationPriority === 'minRolls'}
              onCheckedChange={(checked) => onPriorityChange(checked ? 'minRolls' : 'minWaste')}
            />
            <Label htmlFor="priority-toggle" className={`text-sm ${optimizationPriority === 'minRolls' ? 'font-medium' : 'text-muted-foreground'}`}>
              Min. rolek
            </Label>
          </div>
        </div>

        {/* Badge for structural foil */}
        <Badge variant="outline" className="text-xs">Folia strukturalna</Badge>

        {/* Roll counts */}
        <RollCountsDisplay 
          totalRolls165={config.totalRolls165}
          totalRolls205={config.totalRolls205}
          colorClass="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
        />

        {/* Strip details table */}
        <div>
          <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Szczegółowa rozpiska pasów
          </h5>
          <StripDetailsTable details={surfaceDetails} />
        </div>

        {/* Reusable offcuts */}
        <div>
          <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
            <Recycle className="h-4 w-4 text-green-600" />
            Odpad do ponownego wykorzystania
          </h5>
          <ReusableOffcutsTable offcuts={reusableOffcuts} />
        </div>

        {/* Unusable waste */}
        {unusableWaste.length > 0 && (
          <div>
            <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
              <Trash2 className="h-4 w-4 text-red-600" />
              Odpad nieużyteczny (&lt;2m)
            </h5>
            <UnusableWasteTable wastes={unusableWaste} />
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-5 gap-4 p-4 rounded-lg bg-muted/30 border">
          <div>
            <span className="text-sm text-muted-foreground">Pokrycie:</span>
            <div className="font-medium">{Math.round(totalArea)} m²</div>
          </div>
          {buttJointMeters > 0 && (
            <div>
              <span className="text-sm text-muted-foreground">Zgrzew doczołowy:</span>
              <div className="font-medium">{buttJointMeters} mb</div>
            </div>
          )}
          <div>
            <span className="text-sm text-muted-foreground">Odpad:</span>
            <div className="font-medium">{totalWaste.toFixed(1)} m²</div>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Wykorzystanie:</span>
            <div className="font-medium">{utilizationPercent.toFixed(1)}%</div>
          </div>
          <div className="col-span-1">
            <Progress value={utilizationPercent} className="h-2 mt-3" />
          </div>
        </div>
      </div>
    );
  }

  // Show separate pools for main and structural foil
  return (
    <div className="space-y-6">
      {/* Header with toggle - removed duplicate heading */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-3">
          <Label htmlFor="priority-toggle" className={`text-sm ${optimizationPriority === 'minWaste' ? 'font-medium' : 'text-muted-foreground'}`}>
            Min. odpad
          </Label>
          <Switch
            id="priority-toggle"
            checked={optimizationPriority === 'minRolls'}
            onCheckedChange={(checked) => onPriorityChange(checked ? 'minRolls' : 'minWaste')}
          />
          <Label htmlFor="priority-toggle" className={`text-sm ${optimizationPriority === 'minRolls' ? 'font-medium' : 'text-muted-foreground'}`}>
            Min. rolek
          </Label>
        </div>
      </div>

      {/* Main foil section */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-blue-600" />
          <span className="font-medium text-blue-700 dark:text-blue-300">Folia główna (dno + ściany)</span>
        </div>
        <RollCountsDisplay 
          totalRolls165={mainRolls165}
          totalRolls205={mainRolls205}
          colorClass="bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
        />
        <StripDetailsTable details={mainDetails} />
      </div>

      {/* Structural foil section */}
      {structural.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-amber-600" />
            <span className="font-medium text-amber-700 dark:text-amber-300">Folia strukturalna (schody + brodzik)</span>
          </div>
          <RollCountsDisplay 
            totalRolls165={structuralRolls165}
            totalRolls205={0}
            colorClass="bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
          />
          <StripDetailsTable details={structuralDetails} />
        </div>
      )}

      {/* Reusable offcuts */}
      <div>
        <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
          <Recycle className="h-4 w-4 text-green-600" />
          Odpad do ponownego wykorzystania
        </h5>
        <ReusableOffcutsTable offcuts={reusableOffcuts} />
      </div>

      {/* Unusable waste */}
      {unusableWaste.length > 0 && (
        <div>
          <h5 className="font-medium text-sm mb-2 flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-red-600" />
            Odpad nieużyteczny (&lt;2m)
          </h5>
          <UnusableWasteTable wastes={unusableWaste} />
        </div>
      )}

      {/* Summary stats */}
      <div className="grid grid-cols-4 gap-4 p-4 rounded-lg bg-muted/30 border">
        <div>
          <span className="text-sm text-muted-foreground">Pokrycie:</span>
          <div className="font-medium">{Math.round(totalArea)} m²</div>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Odpad:</span>
          <div className="font-medium">{totalWaste.toFixed(1)} m²</div>
        </div>
        <div>
          <span className="text-sm text-muted-foreground">Wykorzystanie:</span>
          <div className="font-medium">{utilizationPercent.toFixed(1)}%</div>
        </div>
        <div className="col-span-1">
          <Progress value={utilizationPercent} className="h-2 mt-3" />
        </div>
      </div>
    </div>
  );
}
