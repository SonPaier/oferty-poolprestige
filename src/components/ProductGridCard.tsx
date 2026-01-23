import { DbProduct, getDbProductPriceInPLN } from '@/hooks/useProducts';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, ImageOff } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export interface ProductWithThumbnail extends DbProduct {
  thumbnail_url?: string | null;
}

interface ProductGridCardProps {
  product: ProductWithThumbnail;
  onEdit: (product: DbProduct) => void;
  onDelete: (productId: string) => void;
}

export function ProductGridCard({ product, onEdit, onDelete }: ProductGridCardProps) {
  const pricePLN = getDbProductPriceInPLN(product);

  const getCategoryBadge = () => {
    if (product.category === 'folia') return { label: 'Folia', variant: 'default' as const };
    if (product.category === 'attraction') return { label: 'Atrakcja', variant: 'secondary' as const };
    if (product.foil_category) return { label: product.foil_category, variant: 'outline' as const };
    return null;
  };

  const categoryBadge = getCategoryBadge();

  return (
    <Card className="group overflow-hidden hover:shadow-lg transition-shadow">
      {/* Image */}
      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
        {product.thumbnail_url ? (
          <img
            src={product.thumbnail_url}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ImageOff className="w-12 h-12" />
          </div>
        )}
        {categoryBadge && (
          <Badge 
            variant={categoryBadge.variant} 
            className="absolute top-2 left-2"
          >
            {categoryBadge.label}
          </Badge>
        )}
      </div>

      <CardContent className="p-4">
        {/* Symbol */}
        <p className="text-xs font-mono text-muted-foreground mb-1">{product.symbol}</p>
        
        {/* Name */}
        <h3 className="font-medium text-sm line-clamp-2 min-h-[2.5rem] mb-2">
          {product.name}
        </h3>

        {/* Price */}
        <p className="text-lg font-bold text-primary mb-3">
          {pricePLN.toFixed(2)} PLN
        </p>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={() => onEdit(product)}
          >
            <Edit className="w-4 h-4 mr-1" />
            Edytuj
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="icon" className="shrink-0">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Usuń produkt?</AlertDialogTitle>
                <AlertDialogDescription>
                  Czy na pewno chcesz usunąć produkt "{product.name}"? Ta operacja jest nieodwracalna.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Anuluj</AlertDialogCancel>
                <AlertDialogAction onClick={() => onDelete(product.id)}>
                  Usuń
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </CardContent>
    </Card>
  );
}
