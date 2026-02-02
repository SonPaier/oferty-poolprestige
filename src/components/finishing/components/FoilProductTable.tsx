import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, X, Palette } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatPrice } from '@/lib/calculations';
import { FoilSubtype, SUBTYPE_TO_FOIL_CATEGORY } from '@/lib/finishingMaterials';

interface FoilProduct {
  id: string;
  symbol: string;
  name: string;
  manufacturer: string | null;
  series: string | null;
  shade: string | null;
  extracted_hex: string | null;
  foil_width: number | null;
  price: number;
}

interface FoilProductTableProps {
  subtype: FoilSubtype;
  selectedProductId: string | null;
  onSelectProduct: (productId: string | null, productName: string | null) => void;
  onOpenGallery: () => void;
}

export function FoilProductTable({
  subtype,
  selectedProductId,
  onSelectProduct,
  onOpenGallery,
}: FoilProductTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState<string>('all');
  const [shadeFilter, setShadeFilter] = useState<string>('all');

  // Fetch foil products for this subtype
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['foil-products', subtype],
    queryFn: async () => {
      const foilCategory = SUBTYPE_TO_FOIL_CATEGORY[subtype];
      const { data, error } = await supabase
        .from('products')
        .select('id, symbol, name, manufacturer, series, shade, extracted_hex, foil_width, price')
        .eq('category', 'Folie basenowe')
        .eq('foil_category', foilCategory)
        .order('name');

      if (error) throw error;
      return data as FoilProduct[];
    },
  });

  // Get unique manufacturers and shades for filters
  const manufacturers = useMemo(() => {
    const unique = new Set(products.map((p) => p.manufacturer).filter(Boolean));
    return Array.from(unique).sort();
  }, [products]);

  const shades = useMemo(() => {
    const unique = new Set(products.map((p) => p.shade).filter(Boolean));
    return Array.from(unique).sort();
  }, [products]);

  // Filter products
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Search query filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          product.name.toLowerCase().includes(query) ||
          product.symbol.toLowerCase().includes(query) ||
          product.manufacturer?.toLowerCase().includes(query) ||
          product.series?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Manufacturer filter
      if (manufacturerFilter !== 'all' && product.manufacturer !== manufacturerFilter) {
        return false;
      }

      // Shade filter
      if (shadeFilter !== 'all' && product.shade !== shadeFilter) {
        return false;
      }

      return true;
    });
  }, [products, searchQuery, manufacturerFilter, shadeFilter]);

  const handleRowClick = (product: FoilProduct) => {
    if (selectedProductId === product.id) {
      // Deselect
      onSelectProduct(null, null);
    } else {
      onSelectProduct(product.id, product.name);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setManufacturerFilter('all');
    setShadeFilter('all');
  };

  const hasFilters = searchQuery || manufacturerFilter !== 'all' || shadeFilter !== 'all';

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Szukaj po nazwie, symbolu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={manufacturerFilter} onValueChange={setManufacturerFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Producent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszyscy producenci</SelectItem>
            {manufacturers.map((m) => (
              <SelectItem key={m} value={m!}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={shadeFilter} onValueChange={setShadeFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Kolor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Wszystkie kolory</SelectItem>
            {shades.map((s) => (
              <SelectItem key={s} value={s!}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4 mr-1" />
            Wyczyść
          </Button>
        )}
      </div>

      {/* Info about no selection */}
      {!selectedProductId && (
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            ℹ️ Bez wyboru konkretnej folii: pozycja "Folia - kolor do sprecyzowania"
          </p>
          <Button variant="outline" size="sm" onClick={onOpenGallery}>
            <Palette className="w-4 h-4 mr-2" />
            Zobacz dostępne kolory
          </Button>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[120px]">Symbol</TableHead>
              <TableHead>Nazwa</TableHead>
              <TableHead className="w-[120px]">Producent</TableHead>
              <TableHead className="w-[100px]">Seria</TableHead>
              <TableHead className="w-[120px]">Kolor</TableHead>
              <TableHead className="w-[80px] text-right">Szer.</TableHead>
              <TableHead className="w-[100px] text-right">Cena/m²</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Ładowanie...
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  Nie znaleziono produktów
                </TableCell>
              </TableRow>
            ) : (
              filteredProducts.map((product) => (
                <TableRow
                  key={product.id}
                  className={cn(
                    'cursor-pointer transition-colors',
                    selectedProductId === product.id
                      ? 'bg-primary/10 hover:bg-primary/15'
                      : 'hover:bg-muted/50'
                  )}
                  onClick={() => handleRowClick(product)}
                >
                  <TableCell className="font-mono text-sm">{product.symbol}</TableCell>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell>{product.manufacturer || '-'}</TableCell>
                  <TableCell>{product.series || '-'}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {product.extracted_hex && (
                        <span
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: product.extracted_hex }}
                        />
                      )}
                      <span>{product.shade || '-'}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {product.foil_width ? `${product.foil_width} m` : '-'}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPrice(product.price)} zł
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Selected product indicator */}
      {selectedProductId && (
        <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="default">Wybrany produkt</Badge>
            <span className="font-medium">
              {filteredProducts.find((p) => p.id === selectedProductId)?.name}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onSelectProduct(null, null)}
          >
            <X className="w-4 h-4 mr-1" />
            Odznacz
          </Button>
        </div>
      )}
    </div>
  );
}
