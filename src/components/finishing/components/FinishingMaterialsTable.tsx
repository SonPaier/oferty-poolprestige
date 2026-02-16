import { useState } from 'react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Edit2, RotateCcw, Check, Save } from 'lucide-react';
import { formatPrice } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { CalculatedMaterial, FoilLineItem, FINISHING_MATERIALS, UnderlayType } from '@/lib/finishingMaterials';
import { ExtraLineItem, ExtraLineItemRows, AddItemRow } from '@/components/groundworks/ExtraLineItems';

interface FinishingMaterialsTableProps {
  foilLineItem: FoilLineItem;
  structuralFoilLineItem?: FoilLineItem | null;
  materials: CalculatedMaterial[];
  onUpdateMaterial: (id: string, manualQty: number | null) => void;
  onUpdateMaterialPrice: (id: string, price: number) => void;
  onUpdateFoilQuantity: (qty: number | null) => void;
  manualFoilQty: number | null;
  onSavePriceToSettings?: (materialId: string, price: number) => Promise<void>;
  savedRates?: Record<string, number>;
  underlayType: UnderlayType;
  onUnderlayTypeChange: (type: UnderlayType) => void;
  extraItems: ExtraLineItem[];
  onAddExtraItem: (item: ExtraLineItem) => void;
  onRemoveExtraItem: (id: string) => void;
}

export function FinishingMaterialsTable({
  foilLineItem,
  structuralFoilLineItem,
  materials,
  onUpdateMaterial,
  onUpdateMaterialPrice,
  onUpdateFoilQuantity,
  manualFoilQty,
  onSavePriceToSettings,
  savedRates,
  underlayType,
  onUnderlayTypeChange,
  extraItems,
  onAddExtraItem,
  onRemoveExtraItem,
}: FinishingMaterialsTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [changedPrices, setChangedPrices] = useState<Record<string, number>>({});
  const [showRateDialog, setShowRateDialog] = useState(false);
  const [pendingRateChange, setPendingRateChange] = useState<{
    materialId: string; materialName: string; oldRate: number; newRate: number;
  } | null>(null);

  const handleEditStart = (id: string, currentQty: number) => {
    setEditingId(id);
    setEditValue(currentQty.toString());
  };

  const handleEditSave = (id: string, isFoil: boolean = false) => {
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue) && numValue >= 0) {
      if (isFoil) {
        onUpdateFoilQuantity(numValue);
      } else {
        onUpdateMaterial(id, numValue);
      }
    }
    setEditingId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent, id: string, isFoil: boolean = false) => {
    if (e.key === 'Enter') handleEditSave(id, isFoil);
    else if (e.key === 'Escape') setEditingId(null);
  };

  const getDefaultPrice = (materialId: string): number => {
    if (savedRates?.[materialId] !== undefined) return savedRates[materialId];
    const def = FINISHING_MATERIALS.find(m => m.id === materialId);
    return def?.getPrice({ selectedSubtype: null, underlayType: 'zwykly', materialQtys: {} }) ?? 0;
  };

  const handlePriceChange = (materialId: string, newPrice: number) => {
    onUpdateMaterialPrice(materialId, newPrice);
    const defaultPrice = getDefaultPrice(materialId);
    if (newPrice !== defaultPrice) {
      setChangedPrices(prev => ({ ...prev, [materialId]: newPrice }));
    } else {
      setChangedPrices(prev => { const { [materialId]: _, ...rest } = prev; return rest; });
    }
  };

  const confirmPriceChange = (materialId: string, materialName: string) => {
    const newRate = changedPrices[materialId];
    if (newRate !== undefined) {
      setPendingRateChange({ materialId, materialName, oldRate: getDefaultPrice(materialId), newRate });
      setShowRateDialog(true);
    }
  };

  const handleSaveRateToSettings = async () => {
    if (pendingRateChange && onSavePriceToSettings) {
      await onSavePriceToSettings(pendingRateChange.materialId, pendingRateChange.newRate);
      setChangedPrices(prev => { const { [pendingRateChange.materialId]: _, ...rest } = prev; return rest; });
    }
    setShowRateDialog(false);
    setPendingRateChange(null);
  };

  const handleKeepRateLocal = () => {
    if (pendingRateChange) {
      setChangedPrices(prev => { const { [pendingRateChange.materialId]: _, ...rest } = prev; return rest; });
    }
    setShowRateDialog(false);
    setPendingRateChange(null);
  };

  const foilQty = manualFoilQty ?? foilLineItem.quantity;
  const foilTotal = foilQty * foilLineItem.pricePerUnit;
  const structuralTotal = structuralFoilLineItem?.total ?? 0;
  const materialsTotal = materials.reduce((sum, m) => {
    const qty = m.manualQty ?? m.suggestedQty;
    return sum + qty * m.pricePerUnit;
  }, 0);
  const extraTotal = extraItems.reduce((sum, i) => sum + i.netValue, 0);
  const grandTotal = foilTotal + structuralTotal + materialsTotal + extraTotal;

  return (
    <div className="space-y-4">
      {/* Underlay type selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium">Typ podkładu:</span>
        <Select value={underlayType} onValueChange={(v) => onUnderlayTypeChange(v as UnderlayType)}>
          <SelectTrigger className="w-[220px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="zwykly">Zwykły (rolka 2m) — 16 zł/m²</SelectItem>
            <SelectItem value="impregnowany">Impregnowany (1.5m+2m) — 32 zł/m²</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Materiał</TableHead>
            <TableHead className="w-[100px] text-right">Ilość</TableHead>
            <TableHead className="w-[60px]">Jed.</TableHead>
            <TableHead className="w-[120px] text-right">Cena/jed.</TableHead>
            <TableHead className="w-[120px] text-right">Razem</TableHead>
            <TableHead className="w-[80px]">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {/* Foil line item */}
          <TableRow className="bg-primary/5">
            <TableCell>
              <div>
                <p className="font-medium">{foilLineItem.name}</p>
                <p className="text-xs text-muted-foreground">Folia basenowa</p>
              </div>
            </TableCell>
            <TableCell className="text-right">
              {editingId === 'foil' ? (
                <Input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                  onBlur={() => handleEditSave('foil', true)} onKeyDown={(e) => handleKeyDown(e, 'foil', true)}
                  className="w-20 h-8 text-right" autoFocus min="0" step="0.01" />
              ) : (
                <span className={cn('cursor-pointer hover:underline', manualFoilQty !== null && 'text-primary font-medium')}
                  onClick={() => handleEditStart('foil', foilQty)}>
                  {foilQty}
                  {manualFoilQty !== null && <Badge variant="outline" className="ml-1 text-xs px-1">ręczna</Badge>}
                </span>
              )}
            </TableCell>
            <TableCell>{foilLineItem.unit}</TableCell>
            <TableCell className="text-right">{formatPrice(foilLineItem.pricePerUnit)}</TableCell>
            <TableCell className="text-right font-medium">{formatPrice(foilTotal)}</TableCell>
            <TableCell>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditStart('foil', foilQty)}>
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                {manualFoilQty !== null && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onUpdateFoilQuantity(null)} title="Przywróć automatyczną ilość">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>

          {/* Structural foil */}
          {structuralFoilLineItem && (
            <TableRow className="bg-accent/30">
              <TableCell>
                <div>
                  <p className="font-medium">{structuralFoilLineItem.name}</p>
                  <p className="text-xs text-muted-foreground">Folia antypoślizgowa</p>
                </div>
              </TableCell>
              <TableCell className="text-right">{structuralFoilLineItem.quantity}</TableCell>
              <TableCell>{structuralFoilLineItem.unit}</TableCell>
              <TableCell className="text-right">{formatPrice(structuralFoilLineItem.pricePerUnit)}</TableCell>
              <TableCell className="text-right font-medium">{formatPrice(structuralFoilLineItem.total)}</TableCell>
              <TableCell />
            </TableRow>
          )}

          {/* Materials */}
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
                    <Input type="number" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => handleEditSave(material.id)} onKeyDown={(e) => handleKeyDown(e, material.id)}
                      className="w-20 h-8 text-right" autoFocus min="0" step="0.1" />
                  ) : (
                    <span className={cn('cursor-pointer hover:underline', isModified && 'text-primary font-medium')}
                      onClick={() => handleEditStart(material.id, qty)}>
                      {qty}
                      {isModified && <Badge variant="outline" className="ml-1 text-xs px-1">ręczna</Badge>}
                    </span>
                  )}
                </TableCell>
                <TableCell>{material.unit}</TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Input type="number" min="0" step="0.5" value={material.pricePerUnit}
                      onChange={(e) => handlePriceChange(material.id, parseFloat(e.target.value) || 0)}
                      className="w-[80px] h-8 text-right" />
                    {changedPrices[material.id] !== undefined && (
                      <Button type="button" variant="ghost" size="icon"
                        className="h-7 w-7 text-success hover:text-success/80 hover:bg-success/10"
                        onClick={() => confirmPriceChange(material.id, material.name)} title="Zatwierdź zmianę ceny">
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">{formatPrice(total)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEditStart(material.id, qty)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                    {isModified && (
                      <Button variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => onUpdateMaterial(material.id, null)} title="Przywróć sugerowaną ilość">
                        <RotateCcw className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}

          {/* Extra line items */}
          <ExtraLineItemRows items={extraItems} onRemove={onRemoveExtraItem} />
          <AddItemRow onAdd={onAddExtraItem} />
        </TableBody>
      </Table>

      {/* Totals */}
      <div className="flex justify-end">
        <div className="w-72 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Folia główna:</span>
            <span className="font-medium">{formatPrice(foilTotal)}</span>
          </div>
          {structuralFoilLineItem && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Folia strukturalna:</span>
              <span className="font-medium">{formatPrice(structuralTotal)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-muted-foreground">Materiały:</span>
            <span className="font-medium">{formatPrice(materialsTotal)}</span>
          </div>
          {extraTotal > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pozycje dodatkowe:</span>
              <span className="font-medium">{formatPrice(extraTotal)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 border-t text-base">
            <span className="font-semibold">RAZEM NETTO:</span>
            <span className="font-bold text-primary">{formatPrice(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Rate change dialog */}
      <AlertDialog open={showRateDialog} onOpenChange={setShowRateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Zmiana ceny materiału</AlertDialogTitle>
            <AlertDialogDescription>
              Zmieniłeś cenę dla <strong>{pendingRateChange?.materialName}</strong> z{' '}
              <strong>{formatPrice(pendingRateChange?.oldRate ?? 0)}</strong> na{' '}
              <strong>{formatPrice(pendingRateChange?.newRate ?? 0)}</strong>.
              <br /><br />
              Czy chcesz zapisać tę cenę jako domyślną dla wszystkich przyszłych ofert?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel onClick={handleKeepRateLocal}>Tylko w tej ofercie</AlertDialogCancel>
            <AlertDialogAction onClick={handleSaveRateToSettings} className="flex items-center gap-2">
              <Save className="w-4 h-4" />
              Zapisz na stałe
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
