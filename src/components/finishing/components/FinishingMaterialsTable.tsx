import { useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit2, RotateCcw } from 'lucide-react';
import { formatPrice } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { CalculatedMaterial, FoilLineItem } from '@/lib/finishingMaterials';

interface FinishingMaterialsTableProps {
  foilLineItem: FoilLineItem;
  structuralFoilLineItem?: FoilLineItem | null;
  materials: CalculatedMaterial[];
  onUpdateMaterial: (id: string, manualQty: number | null) => void;
  onUpdateFoilQuantity: (qty: number | null) => void;
  manualFoilQty: number | null;
}

export function FinishingMaterialsTable({
  foilLineItem,
  structuralFoilLineItem,
  materials,
  onUpdateMaterial,
  onUpdateFoilQuantity,
  manualFoilQty,
}: FinishingMaterialsTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');

  const handleEditStart = (id: string, currentQty: number) => {
    setEditingId(id);
    setEditValue(currentQty.toString());
  };

  const handleEditSave = (id: string, isfoil: boolean = false) => {
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue) && numValue > 0) {
      if (isfoil) {
        onUpdateFoilQuantity(numValue);
      } else {
        onUpdateMaterial(id, numValue);
      }
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string, isFoil: boolean = false) => {
    if (e.key === 'Enter') {
      handleEditSave(id, isFoil);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  };

  const handleReset = (id: string) => {
    onUpdateMaterial(id, null);
  };

  // Calculate totals
  const foilQty = manualFoilQty ?? foilLineItem.quantity;
  const foilTotal = foilQty * foilLineItem.pricePerUnit;
  const structuralTotal = structuralFoilLineItem?.total ?? 0;
  const materialsTotal = materials.reduce((sum, m) => {
    const qty = m.manualQty ?? m.suggestedQty;
    return sum + qty * m.pricePerUnit;
  }, 0);
  const grandTotal = foilTotal + structuralTotal + materialsTotal;

  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Materiał</TableHead>
            <TableHead className="w-[100px] text-right">Ilość</TableHead>
            <TableHead className="w-[60px]">Jed.</TableHead>
            <TableHead className="w-[100px] text-right">Cena/jed.</TableHead>
            <TableHead className="w-[120px] text-right">Razem</TableHead>
            <TableHead className="w-[80px]">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Foil line item (always first) */}
          <TableRow className="bg-primary/5">
            <TableCell>
              <div>
                <p className="font-medium">{foilLineItem.name}</p>
                <p className="text-xs text-muted-foreground">Folia basenowa</p>
              </div>
            </TableCell>
            <TableCell className="text-right">
              {editingId === 'foil' ? (
                <Input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleEditSave('foil', true)}
                  onKeyDown={(e) => handleKeyDown(e, 'foil', true)}
                  className="w-20 h-8 text-right"
                  autoFocus
                  min="0"
                  step="0.01"
                />
              ) : (
                <span
                  className={cn(
                    'cursor-pointer hover:underline',
                    manualFoilQty !== null && 'text-primary font-medium'
                  )}
                  onClick={() => handleEditStart('foil', foilQty)}
                >
                  {foilQty.toFixed(2)}
                  {manualFoilQty !== null && (
                    <Badge variant="outline" className="ml-1 text-xs px-1">
                      ręczna
                    </Badge>
                  )}
                </span>
              )}
            </TableCell>
            <TableCell>{foilLineItem.unit}</TableCell>
            <TableCell className="text-right">
              {formatPrice(foilLineItem.pricePerUnit)} zł
            </TableCell>
            <TableCell className="text-right font-medium">
              {formatPrice(foilTotal)} zł
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => handleEditStart('foil', foilQty)}
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                {manualFoilQty !== null && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => onUpdateFoilQuantity(null)}
                    title="Przywróć automatyczną ilość"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>

          {/* Structural foil line item (if present) */}
          {structuralFoilLineItem && (
            <TableRow className="bg-amber-50/50 dark:bg-amber-900/10">
              <TableCell>
                <div>
                  <p className="font-medium">{structuralFoilLineItem.name}</p>
                  <p className="text-xs text-muted-foreground">Folia antypoślizgowa</p>
                </div>
              </TableCell>
              <TableCell className="text-right">
                {structuralFoilLineItem.quantity.toFixed(2)}
              </TableCell>
              <TableCell>{structuralFoilLineItem.unit}</TableCell>
              <TableCell className="text-right">
                {formatPrice(structuralFoilLineItem.pricePerUnit)} zł
              </TableCell>
              <TableCell className="text-right font-medium">
                {formatPrice(structuralFoilLineItem.total)} zł
              </TableCell>
              <TableCell>
                {/* Structural foil quantity is auto-calculated, no manual edit */}
              </TableCell>
            </TableRow>
          )}

          {/* Other materials */}
          {materials.map((material) => {
            const qty = material.manualQty ?? material.suggestedQty;
            const total = qty * material.pricePerUnit;
            const isModified = material.manualQty !== null;
            const isEditing = editingId === material.id;

            return (
              <TableRow key={material.id}>
                <TableCell>
                  <div>
                    <p className="font-medium">{material.name}</p>
                    <p className="text-xs text-muted-foreground">{material.symbol}</p>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  {isEditing ? (
                    <Input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleEditSave(material.id)}
                      onKeyDown={(e) => handleKeyDown(e, material.id)}
                      className="w-20 h-8 text-right"
                      autoFocus
                      min="0"
                      step="0.1"
                    />
                  ) : (
                    <span
                      className={cn(
                        'cursor-pointer hover:underline',
                        isModified && 'text-primary font-medium'
                      )}
                      onClick={() => handleEditStart(material.id, qty)}
                    >
                      {qty}
                      {isModified && (
                        <Badge variant="outline" className="ml-1 text-xs px-1">
                          ręczna
                        </Badge>
                      )}
                    </span>
                  )}
                </TableCell>
                <TableCell>{material.unit}</TableCell>
                <TableCell className="text-right">
                  {formatPrice(material.pricePerUnit)} zł
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatPrice(total)} zł
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleEditStart(material.id, qty)}
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    {isModified && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleReset(material.id)}
                        title="Przywróć sugerowaną ilość"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-72 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Folia główna:</span>
            <span className="font-medium">{formatPrice(foilTotal)} zł</span>
          </div>
          {structuralFoilLineItem && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Folia strukturalna:</span>
              <span className="font-medium">{formatPrice(structuralTotal)} zł</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Materiały:</span>
            <span className="font-medium">{formatPrice(materialsTotal)} zł</span>
          </div>
          <div className="flex justify-between pt-2 border-t text-base">
            <span className="font-semibold">RAZEM NETTO:</span>
            <span className="font-bold text-primary">{formatPrice(grandTotal)} zł</span>
          </div>
        </div>
      </div>
    </div>
  );
}
