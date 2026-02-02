import { RotateCcw, Settings, Info, Package, Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  SurfaceKey, 
  RollWidth,
  ROLL_WIDTH_NARROW,
  ROLL_WIDTH_WIDE,
  isNarrowOnlyFoil,
  partitionSurfacesByFoilType,
  SurfaceRollConfig,
} from '@/lib/foil/mixPlanner';
import { FoilSubtype } from '@/lib/finishingMaterials';

interface RollConfigTableProps {
  config: MixConfiguration;
  foilSubtype?: FoilSubtype | null;
  onSurfaceRollWidthChange: (surfaceKey: SurfaceKey, newWidth: RollWidth) => void;
  onResetToOptimal: () => void;
}

interface SurfaceTableProps {
  surfaces: SurfaceRollConfig[];
  title: string;
  icon: React.ReactNode;
  colorClass: string;
  narrowOnly: boolean;
  isStructuralPool?: boolean;
  onSurfaceRollWidthChange: (surfaceKey: SurfaceKey, newWidth: RollWidth) => void;
}

function SurfaceTable({ 
  surfaces, 
  title, 
  icon, 
  colorClass, 
  narrowOnly,
  isStructuralPool = false,
  onSurfaceRollWidthChange,
}: SurfaceTableProps) {
  if (surfaces.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className={`flex items-center gap-2 p-2 rounded-lg ${colorClass}`}>
        {icon}
        <span className="font-medium text-sm">{title}</span>
        {isStructuralPool && (
          <Badge variant="outline" className="text-xs ml-auto">
            tylko 1.65m
          </Badge>
        )}
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Powierzchnia</TableHead>
              <TableHead className="w-36">Szerokość rolki</TableHead>
              <TableHead className="text-right w-20">Pasy</TableHead>
              <TableHead className="text-right w-24">Powierzchnia</TableHead>
              <TableHead className="text-right w-24">Odpad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {surfaces.map((surface) => {
              const isStructural = surface.foilAssignment === 'structural';
              const canChangeWidth = !narrowOnly && !isStructural;
              
              return (
                <TableRow 
                  key={surface.surface}
                  className={surface.isManualOverride ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{surface.surfaceLabel}</span>
                      {surface.isManualOverride && (
                        <span className="text-xs text-amber-600">✎</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {!canChangeWidth ? (
                      <span className="px-3 py-1.5 text-sm bg-muted rounded inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500" />
                        1.65m
                      </span>
                    ) : (
                      <Select
                        value={surface.rollWidth.toString()}
                        onValueChange={(value) => {
                          const newWidth = parseFloat(value) as RollWidth;
                          onSurfaceRollWidthChange(surface.surface, newWidth);
                        }}
                      >
                        <SelectTrigger className="w-28 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={ROLL_WIDTH_NARROW.toString()}>
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                              1.65m
                            </span>
                          </SelectItem>
                          <SelectItem value={ROLL_WIDTH_WIDE.toString()}>
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500" />
                              2.05m
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {surface.stripCount}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {surface.areaM2.toFixed(2)} m²
                  </TableCell>
                  <TableCell className="text-right">
                    <span className={surface.wasteM2 > 2 ? 'text-amber-600' : 'text-muted-foreground'}>
                      {surface.wasteM2.toFixed(2)} m²
                    </span>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function RollConfigTable({ 
  config, 
  foilSubtype,
  onSurfaceRollWidthChange, 
  onResetToOptimal 
}: RollConfigTableProps) {
  const hasManualOverrides = config.surfaces.some(s => s.isManualOverride);
  const narrowOnly = isNarrowOnlyFoil(foilSubtype);
  const isMainStructural = foilSubtype === 'strukturalna';
  
  const { main, structural } = partitionSurfacesByFoilType(config.surfaces);

  return (
    <div className="space-y-6">
      {/* Header with mode indicator */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-primary" />
          <h4 className="font-semibold">Konfiguracja rolek</h4>
        </div>

        <div className="flex items-center gap-2">
          {config.isOptimized ? (
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300">
              ✓ Auto-optymalizacja
            </Badge>
          ) : (
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300">
              ✎ Ręczna konfiguracja
            </Badge>
          )}

          {hasManualOverrides && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onResetToOptimal}
              className="text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Przywróć optymalizację
            </Button>
          )}
        </div>
      </div>

      {/* Info about width restrictions */}
      {narrowOnly && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
          <span className="text-sm text-blue-700 dark:text-blue-300">
            Folia {foilSubtype === 'nadruk' ? 'z nadrukiem' : 'strukturalna'} jest dostępna tylko w szerokości 1.65m
            {foilSubtype === 'strukturalna' && ' (dno łączone doczołowo bez zakładu)'}
          </span>
        </div>
      )}

      {/* If main foil is structural, show unified view */}
      {isMainStructural ? (
        <SurfaceTable
          surfaces={config.surfaces}
          title="Wszystkie powierzchnie (strukturalna)"
          icon={<Layers className="h-4 w-4 text-purple-600 dark:text-purple-400" />}
          colorClass="bg-purple-50 dark:bg-purple-900/20"
          narrowOnly={true}
          onSurfaceRollWidthChange={onSurfaceRollWidthChange}
        />
      ) : (
        <>
          {/* Main pool surfaces */}
          <SurfaceTable
            surfaces={main}
            title="Folia główna (dno + ściany + murek)"
            icon={<Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
            colorClass="bg-blue-50/50 dark:bg-blue-900/10"
            narrowOnly={narrowOnly}
            onSurfaceRollWidthChange={onSurfaceRollWidthChange}
          />

          {/* Structural surfaces */}
          {structural.length > 0 && (
            <SurfaceTable
              surfaces={structural}
              title="Folia strukturalna (schody + brodzik)"
              icon={<Layers className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
              colorClass="bg-amber-50/50 dark:bg-amber-900/10"
              narrowOnly={true}
              isStructuralPool={true}
              onSurfaceRollWidthChange={onSurfaceRollWidthChange}
            />
          )}
        </>
      )}

      {/* Info note */}
      <p className="text-xs text-muted-foreground">
        💡 System automatycznie wybiera szerokość rolki minimalizującą odpad. 
        {!isMainStructural && ' Folia strukturalna (schody, brodzik) zawsze używa szerokości 1.65m.'}
      </p>
    </div>
  );
}
