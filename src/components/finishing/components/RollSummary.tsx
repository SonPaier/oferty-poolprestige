import { useState } from 'react';
import { ChevronDown, ChevronUp, Package, Layers } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
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
  RollAllocation, 
  packStripsIntoRolls, 
  partitionSurfacesByFoilType,
  SurfaceRollConfig,
} from '@/lib/foil/mixPlanner';
import { Badge } from '@/components/ui/badge';

interface RollSummaryProps {
  config: MixConfiguration;
  /** Whether main foil is structural (allows merging both pools) */
  isMainFoilStructural?: boolean;
}

interface FoilPoolSummaryProps {
  title: string;
  surfaces: SurfaceRollConfig[];
  rolls: RollAllocation[];
  totalRolls165: number;
  totalRolls205: number;
  colorClass: string;
  icon: React.ReactNode;
}

function FoilPoolSummary({ 
  title, 
  surfaces, 
  rolls, 
  totalRolls165, 
  totalRolls205, 
  colorClass,
  icon,
}: FoilPoolSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  const totalArea = surfaces.reduce((sum, s) => sum + s.areaM2, 0);
  const totalWaste = surfaces.reduce((sum, s) => sum + s.wasteM2, 0);
  const totalRolls = totalRolls165 + totalRolls205;
  const totalRollArea = totalRolls165 * 1.65 * 25 + totalRolls205 * 2.05 * 25;
  const utilizationPercent = totalRollArea > 0 ? ((totalRollArea - totalWaste) / totalRollArea) * 100 : 0;

  if (surfaces.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className={`p-4 rounded-lg border ${colorClass}`}>
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <h4 className="font-semibold">{title}</h4>
        </div>

        {/* Roll counts */}
        <div className="flex flex-wrap items-center gap-3 mb-3">
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

        {/* Surface breakdown */}
        <div className="grid grid-cols-3 gap-2 text-sm mb-3">
          <div>
            <span className="text-muted-foreground">Pokrycie:</span>
            <span className="ml-1 font-medium">{totalArea.toFixed(1)} m²</span>
          </div>
          <div>
            <span className="text-muted-foreground">Odpad:</span>
            <span className="ml-1 font-medium">{totalWaste.toFixed(1)} m²</span>
          </div>
          <div>
            <span className="text-muted-foreground">Wykorzystanie:</span>
            <span className="ml-1 font-medium">{utilizationPercent.toFixed(1)}%</span>
          </div>
        </div>

        {/* Utilization bar */}
        <Progress value={utilizationPercent} className="h-2" />
      </div>

      {/* Collapsible roll details */}
      {rolls.length > 0 && (
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between">
              <span className="flex items-center gap-2">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                {isOpen ? 'Ukryj szczegóły' : 'Pokaż szczegóły rolek'}
              </span>
              <span className="text-xs text-muted-foreground">{rolls.length} rolek</span>
            </Button>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <div className="border rounded-lg overflow-hidden mt-2">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead className="w-16">Rolka</TableHead>
                    <TableHead className="w-20">Szer.</TableHead>
                    <TableHead className="w-24">Użyte</TableHead>
                    <TableHead className="w-20">Odpad</TableHead>
                    <TableHead>Pasy</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rolls.map((roll) => (
                    <TableRow key={roll.rollNumber}>
                      <TableCell className="font-medium">#{roll.rollNumber}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={
                          roll.rollWidth === 1.65
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300'
                        }>
                          {roll.rollWidth}m
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={(roll.usedLength / 25) * 100} className="h-1.5 w-12" />
                          <span className="text-sm">{roll.usedLength.toFixed(1)}m</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {roll.wasteLength.toFixed(1)}m
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {roll.strips.slice(0, 3).map((s, i) => (
                          <span key={i}>
                            {s.surface} #{s.stripIndex}
                            {i < Math.min(roll.strips.length - 1, 2) ? ', ' : ''}
                          </span>
                        ))}
                        {roll.strips.length > 3 && <span> +{roll.strips.length - 3}</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

export function RollSummary({ config, isMainFoilStructural = false }: RollSummaryProps) {
  const { main, structural } = partitionSurfacesByFoilType(config.surfaces);
  
  // Pack strips SEPARATELY for each foil type (not together!)
  const mainConfig = { ...config, surfaces: main };
  const structuralConfig = { ...config, surfaces: structural };
  
  const mainRolls = packStripsIntoRolls(mainConfig);
  const structuralRolls = packStripsIntoRolls(structuralConfig);

  // Calculate roll counts per pool
  const mainRolls165 = mainRolls.filter(r => r.rollWidth === 1.65).length;
  const mainRolls205 = mainRolls.filter(r => r.rollWidth === 2.05).length;
  const structuralRolls165 = structuralRolls.filter(r => r.rollWidth === 1.65).length;

  // If main foil is structural, show combined view (pack all together)
  if (isMainFoilStructural) {
    const allRolls = packStripsIntoRolls(config);
    
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Package className="h-5 w-5 text-primary" />
          <h4 className="font-semibold">Podsumowanie rolek</h4>
          <Badge variant="outline" className="text-xs">Folia strukturalna</Badge>
        </div>
        
        <FoilPoolSummary
          title="Wszystkie powierzchnie (strukturalna)"
          surfaces={config.surfaces}
          rolls={allRolls}
          totalRolls165={config.totalRolls165}
          totalRolls205={config.totalRolls205}
          colorClass="bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800"
          icon={<Layers className="h-5 w-5 text-purple-600 dark:text-purple-400" />}
        />
      </div>
    );
  }

  // Show separate pools for main and structural foil
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Package className="h-5 w-5 text-primary" />
        <h4 className="font-semibold">Podsumowanie rolek</h4>
      </div>

      {/* Main pool foil */}
      <FoilPoolSummary
        title="Folia główna (dno + ściany + murek)"
        surfaces={main}
        rolls={mainRolls}
        totalRolls165={mainRolls165}
        totalRolls205={mainRolls205}
        colorClass="bg-blue-50/50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800"
        icon={<Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />}
      />

      {/* Structural foil */}
      {structural.length > 0 && (
        <FoilPoolSummary
          title="Folia strukturalna (schody + brodzik)"
          surfaces={structural}
          rolls={structuralRolls}
          totalRolls165={structuralRolls165}
          totalRolls205={0}
          colorClass="bg-amber-50/50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800"
          icon={<Layers className="h-5 w-5 text-amber-600 dark:text-amber-400" />}
        />
      )}
    </div>
  );
}
