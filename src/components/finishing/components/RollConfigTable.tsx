import { Info, Package, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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
  isNarrowOnlyFoil,
  partitionSurfacesByFoilType,
  SurfaceRollConfig,
} from '@/lib/foil/mixPlanner';
import { FoilSubtype } from '@/lib/finishingMaterials';

interface RollConfigTableProps {
  config: MixConfiguration;
  foilSubtype?: FoilSubtype | null;
}

interface SurfaceTableProps {
  surfaces: SurfaceRollConfig[];
  title: string;
  icon: React.ReactNode;
  colorClass: string;
  isStructuralPool?: boolean;
}

function SurfaceTable({ 
  surfaces, 
  title, 
  icon, 
  colorClass, 
  isStructuralPool = false,
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
              <TableHead className="w-28">Szerokość</TableHead>
              <TableHead className="text-right w-20">Pasy</TableHead>
              <TableHead className="text-right w-24">Powierzchnia</TableHead>
              <TableHead className="text-right w-24">Odpad</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {surfaces.map((surface) => (
              <TableRow key={surface.surface}>
                <TableCell>
                  <span className="font-medium">{surface.surfaceLabel}</span>
                </TableCell>
                <TableCell>
                  <span className="px-3 py-1.5 text-sm bg-muted rounded inline-flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${surface.rollWidth === 2.05 ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                    {surface.rollWidth}m
                  </span>
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
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function RollConfigTable({ 
  config, 
  foilSubtype,
}: RollConfigTableProps) {
  const narrowOnly = isNarrowOnlyFoil(foilSubtype);
  const isMainStructural = foilSubtype === 'strukturalna';
  
  const { main, structural } = partitionSurfacesByFoilType(config.surfaces);

  return (
    <div className="space-y-6">
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
        />
      ) : (
        <>
          {/* Main pool surfaces */}
          <SurfaceTable
            surfaces={main}
            title="Folia główna (dno + ściany + murek)"
            icon={<Package className="h-4 w-4 text-blue-600 dark:text-blue-400" />}
            colorClass="bg-blue-50/50 dark:bg-blue-900/10"
          />

          {/* Structural surfaces */}
          {structural.length > 0 && (
            <SurfaceTable
              surfaces={structural}
              title="Folia strukturalna (schody + brodzik)"
              icon={<Layers className="h-4 w-4 text-amber-600 dark:text-amber-400" />}
              colorClass="bg-amber-50/50 dark:bg-amber-900/10"
              isStructuralPool={true}
            />
          )}
        </>
      )}

      {/* Info note */}
      <p className="text-xs text-muted-foreground">
        💡 System automatycznie wybiera optymalną szerokość rolki minimalizującą odpad. 
        {!isMainStructural && ' Folia strukturalna (schody, brodzik) zawsze używa szerokości 1.65m.'}
      </p>
    </div>
  );
}
