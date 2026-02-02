import { Calculator } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PoolAreas } from '@/lib/finishingMaterials';

interface MaterialFormulasTableProps {
  poolAreas: PoolAreas;
}

interface FormulaDefinition {
  name: string;
  formula: string;
  inputField: keyof PoolAreas | 'custom';
  multiplier?: number;
  unit: string;
  calculate: (areas: PoolAreas) => number;
}

const MATERIAL_FORMULAS: FormulaDefinition[] = [
  {
    name: 'Podkład pod folię',
    formula: 'powierzchnia × 1.1',
    inputField: 'totalArea',
    unit: 'm²',
    calculate: (areas) => Math.ceil(areas.totalArea * 1.1),
  },
  {
    name: 'Kątownik PVC',
    formula: 'obwód',
    inputField: 'perimeter',
    unit: 'mb',
    calculate: (areas) => Math.ceil(areas.perimeter),
  },
  {
    name: 'Klej kontaktowy',
    formula: 'powierzchnia / 20',
    inputField: 'totalArea',
    unit: 'kg',
    calculate: (areas) => Math.ceil(areas.totalArea / 20),
  },
  {
    name: 'Nity montażowe',
    formula: 'obwód × 4',
    inputField: 'perimeter',
    unit: 'szt',
    calculate: (areas) => Math.ceil(areas.perimeter * 4),
  },
  {
    name: 'Silikon podwodny',
    formula: 'obwód / 8',
    inputField: 'perimeter',
    unit: 'szt',
    calculate: (areas) => Math.ceil(areas.perimeter / 8),
  },
  {
    name: 'Taśma uszczelniająca',
    formula: 'obwód × 1.05',
    inputField: 'perimeter',
    unit: 'mb',
    calculate: (areas) => Math.ceil(areas.perimeter * 1.05),
  },
];

export function MaterialFormulasTable({ poolAreas }: MaterialFormulasTableProps) {
  const getInputValue = (formula: FormulaDefinition): string => {
    if (formula.inputField === 'custom') {
      return '-';
    }
    const value = poolAreas[formula.inputField];
    if (typeof value === 'number') {
      return `${value.toFixed(2)} ${formula.inputField === 'perimeter' ? 'mb' : 'm²'}`;
    }
    return '-';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Calculator className="h-5 w-5 text-primary" />
        <h4 className="font-semibold">Formuły obliczeniowe materiałów</h4>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Materiał</TableHead>
              <TableHead>Formuła</TableHead>
              <TableHead className="text-right">Wartość wejściowa</TableHead>
              <TableHead className="text-right">Wynik</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {MATERIAL_FORMULAS.map((formula, idx) => {
              const result = formula.calculate(poolAreas);
              return (
                <TableRow key={idx}>
                  <TableCell className="font-medium">{formula.name}</TableCell>
                  <TableCell>
                    <code className="px-2 py-1 rounded bg-muted text-sm font-mono">
                      {formula.formula}
                    </code>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {getInputValue(formula)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {result} {formula.unit}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        📐 Wartości zaokrąglane w górę do pełnych jednostek. 
        Obliczenia bazują na powierzchni całkowitej ({poolAreas.totalArea.toFixed(2)} m²) 
        i obwodzie ({poolAreas.perimeter.toFixed(2)} mb).
      </p>
    </div>
  );
}
