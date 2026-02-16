import { Calculator } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PoolAreas, MaterialContext, FINISHING_MATERIALS, calculateMaterials } from '@/lib/finishingMaterials';

interface MaterialFormulasTableProps {
  poolAreas: PoolAreas;
  materialContext: MaterialContext;
}

interface FormulaDisplay {
  name: string;
  formula: string;
  inputValue: string;
  result: string;
}

function getFormulas(areas: PoolAreas, ctx: MaterialContext): FormulaDisplay[] {
  const materials = calculateMaterials(areas, ctx);
  const formulas: FormulaDisplay[] = [];

  for (const mat of materials) {
    const def = FINISHING_MATERIALS.find(m => m.id === mat.id);
    if (!def) continue;

    let formula = '';
    let inputValue = '';

    switch (mat.id) {
      case 'podklad-pod-folie':
        if (ctx.underlayType === 'impregnowany') {
          formula = 'optymalizacja pasów 1.5m+2m (dno) + ściany×głęb.';
          inputValue = `${areas.poolWidth.toFixed(1)}m szer. × ${areas.poolLength.toFixed(1)}m dł., obw. ${areas.perimeter.toFixed(1)}mb`;
        } else {
          formula = 'ceil(szer./2) × dł. × 2m (dno) + obwód × 2m (ściany)';
          inputValue = `${areas.poolWidth.toFixed(1)}m szer. × ${areas.poolLength.toFixed(1)}m dł., obw. ${areas.perimeter.toFixed(1)}mb`;
        }
        break;
      case 'klej-podklad-20kg':
        formula = 'ceil(powierzchnia / 100)';
        inputValue = `${areas.totalArea.toFixed(2)} m²`;
        break;
      case 'folia-podkladowa-20m':
        formula = 'ceil(zgrzewy doczołowe / 20)';
        inputValue = `${(areas.buttJointMeters ?? 0).toFixed(1)} mb zgrzewów`;
        break;
      case 'katownik-zewnetrzny-2m':
        formula = 'ceil((obwód + stopnie + brodzik) / 2)';
        inputValue = `obw. ${areas.perimeter.toFixed(1)} + stopnie ${areas.stairsStepPerimeter.toFixed(1)} + brodz. ${areas.wadingPoolPerimeter.toFixed(1)}mb`;
        break;
      case 'katownik-wewnetrzny-2m':
        formula = 'ręcznie';
        inputValue = '-';
        break;
      case 'plaskownik-pvc-2m':
        formula = 'ręcznie';
        inputValue = '-';
        break;
      case 'nity-200szt':
        formula = 'ceil(suma profili / 40)';
        const totalProfiles = (ctx.materialQtys['katownik-zewnetrzny-2m'] || 0) +
          (ctx.materialQtys['katownik-wewnetrzny-2m'] || 0) +
          (ctx.materialQtys['plaskownik-pvc-2m'] || 0);
        inputValue = `${totalProfiles} szt. profili`;
        break;
      case 'folia-w-plynie-1l':
        formula = 'ceil(powierzchnia / 100)';
        inputValue = `${areas.totalArea.toFixed(2)} m²`;
        break;
      case 'usluga-foliowanie-niecki':
        formula = 'dno netto + ściany';
        inputValue = `dno ${areas.netBottomArea.toFixed(2)} + ściany ${areas.wallArea.toFixed(2)} m²`;
        break;
      case 'usluga-foliowanie-schodow':
        formula = 'powierzchnia schodów';
        inputValue = `${(areas.stairsArea ?? 0).toFixed(2)} m²`;
        break;
      case 'usluga-foliowanie-rynny':
        formula = 'obwód basenu';
        inputValue = `${areas.perimeter.toFixed(2)} mb`;
        break;
      default:
        formula = '-';
        inputValue = '-';
    }

    formulas.push({
      name: mat.name,
      formula,
      inputValue,
      result: `${mat.suggestedQty} ${mat.unit}`,
    });
  }

  return formulas;
}

export function MaterialFormulasTable({ poolAreas, materialContext }: MaterialFormulasTableProps) {
  const formulas = getFormulas(poolAreas, materialContext);

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
            {formulas.map((f, idx) => (
              <TableRow key={idx}>
                <TableCell className="font-medium">{f.name}</TableCell>
                <TableCell>
                  <code className="px-2 py-1 rounded bg-muted text-sm font-mono">
                    {f.formula}
                  </code>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {f.inputValue}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {f.result}
                </TableCell>
              </TableRow>
            ))}
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
