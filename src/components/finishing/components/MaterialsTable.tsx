import { useState } from 'react';
import { MaterialItem } from '../FinishingWizardContext';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Edit2, Trash2, RotateCcw, Plus, Search } from 'lucide-react';
import { formatPrice } from '@/lib/calculations';
import { cn } from '@/lib/utils';
import { useProducts } from '@/hooks/useProducts';

interface MaterialsTableProps {
  materials: MaterialItem[];
  onUpdateMaterial: (id: string, updates: Partial<MaterialItem>) => void;
  onRemoveMaterial: (id: string) => void;
  onAddMaterial: (material: MaterialItem) => void;
}

export function MaterialsTable({
  materials,
  onUpdateMaterial,
  onRemoveMaterial,
  onAddMaterial,
}: MaterialsTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: searchResults, isLoading: searchLoading } = useProducts(searchQuery, 10);
  
  const handleEditStart = (material: MaterialItem) => {
    setEditingId(material.id);
    setEditValue((material.manualQty ?? material.suggestedQty).toString());
  };
  
  const handleEditSave = (id: string) => {
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue) && numValue > 0) {
      onUpdateMaterial(id, { manualQty: numValue });
    }
    setEditingId(null);
  };
  
  const handleReset = (id: string) => {
    onUpdateMaterial(id, { manualQty: null });
  };
  
  const handleAddProduct = (product: any) => {
    const newMaterial: MaterialItem = {
      id: `manual-${Date.now()}`,
      name: product.name,
      symbol: product.symbol,
      unit: 'szt',
      suggestedQty: 1,
      manualQty: 1,
      pricePerUnit: product.price,
      productId: product.id,
      isManual: true,
    };
    onAddMaterial(newMaterial);
    setShowAddDialog(false);
    setSearchQuery('');
  };
  
  return (
    <div className="space-y-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Materiał</TableHead>
            <TableHead className="w-[100px] text-right">Ilość</TableHead>
            <TableHead className="w-[80px]">Jed.</TableHead>
            <TableHead className="w-[100px] text-right">Cena/jed.</TableHead>
            <TableHead className="w-[120px] text-right">Razem</TableHead>
            <TableHead className="w-[100px]">Akcje</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {materials.map((material) => {
            const qty = material.manualQty ?? material.suggestedQty;
            const total = qty * material.pricePerUnit;
            const isEditing = editingId === material.id;
            const isModified = material.manualQty !== null;
            
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
                      onKeyDown={(e) => e.key === 'Enter' && handleEditSave(material.id)}
                      className="w-20 text-right"
                      autoFocus
                      min="0"
                      step="0.1"
                    />
                  ) : (
                    <span
                      className={cn(
                        "cursor-pointer hover:underline",
                        isModified && "text-primary font-medium"
                      )}
                      onClick={() => handleEditStart(material)}
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
                      className="h-8 w-8"
                      onClick={() => handleEditStart(material)}
                      title="Edytuj ilość"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    {isModified && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleReset(material.id)}
                        title="Przywróć sugerowaną ilość"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </Button>
                    )}
                    {material.isManual && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onRemoveMaterial(material.id)}
                        title="Usuń materiał"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      
      {/* Add material button */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm">
            <Plus className="w-4 h-4 mr-2" />
            Dodaj materiał
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dodaj materiał</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj produktu..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {searchQuery.length >= 2 && (
              <div className="max-h-[300px] overflow-y-auto space-y-2">
                {searchLoading ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Szukam...
                  </p>
                ) : searchResults && searchResults.length > 0 ? (
                  searchResults.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-3 rounded-lg hover:bg-muted cursor-pointer"
                      onClick={() => handleAddProduct(product)}
                    >
                      <div>
                        <p className="font-medium">{product.name}</p>
                        <p className="text-xs text-muted-foreground">{product.symbol}</p>
                      </div>
                      <span className="font-medium">{formatPrice(product.price)} zł</span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nie znaleziono produktów
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
