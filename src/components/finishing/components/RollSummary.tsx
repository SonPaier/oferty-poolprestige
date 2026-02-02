import { useState } from 'react';
import { ChevronDown, ChevronUp, Package } from 'lucide-react';
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
import { MixConfiguration, RollAllocation, packStripsIntoRolls } from '@/lib/foil/mixPlanner';

interface RollSummaryProps {
  config: MixConfiguration;
}

export function RollSummary({ config }: RollSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rolls = packStripsIntoRolls(config);

  const totalRolls = config.totalRolls165 + config.totalRolls205;
  const utilizationPercent = 100 - config.wastePercentage;

  return (
    <div className="space-y-4">
      {/* Summary Header */}
      <div className="p-4 rounded-lg bg-muted/50 border">
        <div className="flex items-center gap-2 mb-4">
          <Package className="h-5 w-5 text-primary" />
          <h4 className="font-semibold">Podsumowanie rolek</h4>
        </div>

        {/* Roll counts */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {config.totalRolls165 > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-blue-100 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800">
              <span className="text-2xl font-bold text-blue-700 dark:text-blue-300">
                {config.totalRolls165}×
              </span>
              <div className="text-sm">
                <div className="font-medium text-blue-800 dark:text-blue-200">Rolka 1.65m</div>
                <div className="text-blue-600 dark:text-blue-400 text-xs">× 25m</div>
              </div>
            </div>
          )}

          {config.totalRolls205 > 0 && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-800">
              <span className="text-2xl font-bold text-emerald-700 dark:text-emerald-300">
                {config.totalRolls205}×
              </span>
              <div className="text-sm">
                <div className="font-medium text-emerald-800 dark:text-emerald-200">Rolka 2.05m</div>
                <div className="text-emerald-600 dark:text-emerald-400 text-xs">× 25m</div>
              </div>
            </div>
          )}

          <div className="px-4 py-3 rounded-lg bg-primary/10 border border-primary/30">
            <div className="text-2xl font-bold text-primary">{totalRolls}</div>
            <div className="text-xs text-muted-foreground">rolek łącznie</div>
          </div>
        </div>

        {/* Utilization bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Wykorzystanie materiału:</span>
            <span className="font-medium">{utilizationPercent.toFixed(1)}%</span>
          </div>
          <Progress value={utilizationPercent} className="h-3" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Odpad: {config.totalWaste.toFixed(2)} m²</span>
            <span>({config.wastePercentage.toFixed(1)}%)</span>
          </div>
        </div>
      </div>

      {/* Collapsible details */}
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between">
            <span className="flex items-center gap-2">
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {isOpen ? 'Ukryj szczegóły rolek' : 'Pokaż szczegóły rolek'}
            </span>
            <span className="text-xs text-muted-foreground">{rolls.length} rolek</span>
          </Button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-2">
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-16">Rolka #</TableHead>
                  <TableHead className="w-24">Szerokość</TableHead>
                  <TableHead className="w-28">Wykorzystane</TableHead>
                  <TableHead className="w-20">Odpad</TableHead>
                  <TableHead>Pasy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rolls.map((roll) => (
                  <TableRow key={roll.rollNumber}>
                    <TableCell className="font-medium">{roll.rollNumber}</TableCell>
                    <TableCell>
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        roll.rollWidth === 1.65
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'
                          : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
                      }`}>
                        {roll.rollWidth}m
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress 
                          value={(roll.usedLength / 25) * 100} 
                          className="h-2 w-16"
                        />
                        <span className="text-sm">{roll.usedLength.toFixed(1)}m</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {roll.wasteLength.toFixed(1)}m
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {roll.strips.map((s, i) => (
                        <span key={i}>
                          {s.surface} #{s.stripIndex}
                          {i < roll.strips.length - 1 ? ', ' : ''}
                        </span>
                      ))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
