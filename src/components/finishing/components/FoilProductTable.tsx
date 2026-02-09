import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
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
import { Card, CardContent } from '@/components/ui/card';
import { Search, X, ImageOff } from 'lucide-react';
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
  thumbnail_url?: string | null;
}

interface FoilProductTableProps {
  subtype: FoilSubtype;
  selectedProductId: string | null;
  onSelectProduct: (productId: string | null, productName: string | null) => void;
}

export function FoilProductTable({
  subtype,
  selectedProductId,
  onSelectProduct,
}: FoilProductTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [manufacturerFilter, setManufacturerFilter] = useState<string>('all');
  const [shadeFilter, setShadeFilter] = useState<string>('all');

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['foil-products', subtype],
    queryFn: async () => {
      const foilCategory = SUBTYPE_TO_FOIL_CATEGORY[subtype];

      // Check if foil_category exists
      const { data: byCategory } = await supabase
        .from('products')
        .select('id')
        .eq('category', 'Folie basenowe')
        .eq('foil_category', foilCategory)
        .limit(1);

      let rawProducts: FoilProduct[];

      if (byCategory && byCategory.length > 0) {
        const { data, error } = await supabase
          .from('products')
          .select('id, symbol, name, manufacturer, series, shade, extracted_hex, foil_width, price')
          .eq('category', 'Folie basenowe')
          .eq('foil_category', foilCategory)
          .order('name');
        if (error) throw error;
        rawProducts = data as FoilProduct[];
      } else {
        let nameFilter = '';
        if (subtype === 'jednokolorowa') nameFilter = 'Alkorplan 2000';
        else if (subtype === 'nadruk') nameFilter = 'Alkorplan 3000';
        else nameFilter = 'Relief';

        const { data, error } = await supabase
          .from('products')
          .select('id, symbol, name, manufacturer, series, shade, extracted_hex, foil_width, price')
          .or(`name.ilike.%Folia%,name.ilike.%Alkorplan%,name.ilike.%ELBE%`)
          .ilike('name', `%${nameFilter}%`)
          .order('name');
        if (error) throw error;
        rawProducts = data as FoilProduct[];
      }

      // Fetch thumbnails
      if (rawProducts.length > 0) {
        const productIds = rawProducts.map(p => p.id);
        const { data: images } = await supabase
          .from('product_images')
          .select('product_id, image_url, sort_order')
          .in('product_id', productIds)
          .order('sort_order', { ascending: true });

        const thumbnailMap: Record<string, string> = {};
        const seen = new Set<string>();
        (images || []).forEach(img => {
          if (!seen.has(img.product_id)) {
            thumbnailMap[img.product_id] = img.image_url;
            seen.add(img.product_id);
          }
        });

        rawProducts = rawProducts.map(p => ({
          ...p,
          thumbnail_url: thumbnailMap[p.id] || null,
        }));
      }

      return rawProducts;
    },
  });

  const manufacturers = useMemo(() => {
    const unique = new Set(products.map((p) => p.manufacturer).filter(Boolean));
    return Array.from(unique).sort();
  }, [products]);

  const shades = useMemo(() => {
    const unique = new Set(products.map((p) => p.shade).filter(Boolean));
    return Array.from(unique).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          product.name.toLowerCase().includes(query) ||
          product.symbol.toLowerCase().includes(query) ||
          product.manufacturer?.toLowerCase().includes(query) ||
          product.series?.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }
      if (manufacturerFilter !== 'all' && product.manufacturer !== manufacturerFilter) return false;
      if (shadeFilter !== 'all' && product.shade !== shadeFilter) return false;
      return true;
    });
  }, [products, searchQuery, manufacturerFilter, shadeFilter]);

  const handleCardClick = (product: FoilProduct) => {
    if (selectedProductId === product.id) {
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
              <SelectItem key={m} value={m!}>{m}</SelectItem>
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
              <SelectItem key={s} value={s!}>{s}</SelectItem>
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

      {/* No selection info */}
      {!selectedProductId && (
        <div className="p-3 bg-muted/50 rounded-lg">
          <p className="text-sm text-muted-foreground">
            ℹ️ Bez wyboru konkretnej folii: pozycja "Folia - kolor do sprecyzowania" z galerią kolorów w ofercie
          </p>
        </div>
      )}

      {/* Product grid */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Ładowanie...</div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">Nie znaleziono produktów</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filteredProducts.map((product) => (
            <Card
              key={product.id}
              className={cn(
                'cursor-pointer transition-all hover:shadow-md overflow-hidden',
                selectedProductId === product.id && 'ring-2 ring-primary border-primary'
              )}
              onClick={() => handleCardClick(product)}
            >
              {/* Thumbnail */}
              <div className="aspect-square bg-muted relative overflow-hidden">
                {product.thumbnail_url ? (
                  <img
                    src={product.thumbnail_url}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : product.extracted_hex ? (
                  <div
                    className="w-full h-full"
                    style={{ backgroundColor: product.extracted_hex }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                    <ImageOff className="w-8 h-8" />
                  </div>
                )}
              </div>

              <CardContent className="p-2.5">
                {/* Name */}
                <p className="text-xs font-medium line-clamp-2 min-h-[2rem] mb-1">
                  {product.name}
                </p>

                {/* Series */}
                {product.series && (
                  <p className="text-[10px] text-muted-foreground mb-1">{product.series}</p>
                )}

                {/* Color */}
                <div className="flex items-center gap-1.5 mb-1.5">
                  {product.extracted_hex && (
                    <span
                      className="w-3 h-3 rounded-full border shrink-0"
                      style={{ backgroundColor: product.extracted_hex }}
                    />
                  )}
                  <span className="text-[10px] text-muted-foreground truncate">
                    {product.shade || '-'}
                  </span>
                </div>

                {/* Price */}
                <p className="text-sm font-bold text-primary">
                  {formatPrice(product.price)} zł/m²
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Count */}
      <p className="text-xs text-muted-foreground text-right">
        {filteredProducts.length} z {products.length} produktów
      </p>

      {/* Selected product indicator */}
      {selectedProductId && (
        <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
          <div className="flex items-center gap-2">
            <Badge variant="default">Wybrany produkt</Badge>
            <span className="font-medium">
              {products.find((p) => p.id === selectedProductId)?.name}
            </span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onSelectProduct(null, null)}>
            <X className="w-4 h-4 mr-1" />
            Odznacz
          </Button>
        </div>
      )}
    </div>
  );
}
