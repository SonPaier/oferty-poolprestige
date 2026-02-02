import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { FoilSubtype, SUBTYPE_NAMES, VARIANT_LABELS } from '@/lib/finishingMaterials';
import { formatPrice } from '@/lib/calculations';

interface SubtypeCardProps {
  subtype: FoilSubtype;
  price: number;
  isSelected: boolean;
  onSelect: () => void;
  onPriceChange: (newPrice: number) => void;
}

export function SubtypeCard({
  subtype,
  price,
  isSelected,
  onSelect,
  onPriceChange,
}: SubtypeCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(price.toString());

  const handleEditStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(price.toString());
    setIsEditing(true);
  };

  const handleEditSave = () => {
    const numValue = parseFloat(editValue);
    if (!isNaN(numValue) && numValue > 0) {
      onPriceChange(numValue);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleEditSave();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const variantColors: Record<FoilSubtype, string> = {
    jednokolorowa: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    nadruk: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
    strukturalna: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  };

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md',
        isSelected && 'ring-2 ring-primary border-primary'
      )}
      onClick={onSelect}
    >
      <CardContent className="p-4 text-center">
        {/* Selection indicator */}
        {isSelected && (
          <div className="absolute top-2 right-2">
            <Check className="w-5 h-5 text-primary" />
          </div>
        )}

        {/* Subtype name */}
        <h3 className="font-semibold text-lg mb-2">{SUBTYPE_NAMES[subtype]}</h3>

        {/* Variant badge */}
        <Badge className={cn('mb-3', variantColors[subtype])}>
          {VARIANT_LABELS[subtype]}
        </Badge>

        {/* Price */}
        <div className="mt-3">
          {isEditing ? (
            <div className="flex items-center gap-1 justify-center" onClick={(e) => e.stopPropagation()}>
              <Input
                type="number"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={handleEditSave}
                onKeyDown={handleKeyDown}
                className="w-24 h-8 text-center text-lg font-bold"
                autoFocus
                min="0"
                step="1"
              />
              <span className="text-sm text-muted-foreground">zł/m²</span>
            </div>
          ) : (
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-bold text-primary">
                {formatPrice(price)}
              </span>
              <span className="text-sm text-muted-foreground">zł/m²</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleEditStart}
              >
                <Edit2 className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-2">cena netto</p>
      </CardContent>
    </Card>
  );
}
