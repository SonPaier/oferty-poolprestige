import { useMemo } from 'react';
import { useFinishingWizard } from '../FinishingWizardContext';
import { ProductFilterBar } from '../components/ProductFilterBar';
import { ProductGrid, ProductGridItem } from '../components/ProductGrid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Filter, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function Step2ProductFiltering() {
  const { state, dispatch } = useFinishingWizard();
  const { finishingType, filters } = state;
  
  // Fetch products based on finishing type
  const { data: products, isLoading } = useQuery({
    queryKey: ['finishing-products', finishingType],
    queryFn: async () => {
      const category = finishingType === 'foil' ? 'folia' : 'ceramika';
      
      const { data, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          symbol,
          price,
          currency,
          shade,
          manufacturer,
          series,
          foil_category,
          foil_width,
          extracted_hex,
          product_images(image_url)
        `)
        .eq('category', category)
        .order('price', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    enabled: finishingType !== null,
  });
  
  // Extract available subtypes and colors from products
  const availableSubtypes = useMemo(() => {
    if (!products) return [];
    const subtypes = new Set<string>();
    products.forEach((p) => {
      if (p.foil_category) subtypes.add(p.foil_category);
    });
    return Array.from(subtypes).sort();
  }, [products]);
  
  const availableColors = useMemo(() => {
    if (!products) return [];
    const colorMap = new Map<string, { value: string; label: string; hex?: string }>();
    
    products.forEach((p) => {
      if (p.shade && !colorMap.has(p.shade)) {
        colorMap.set(p.shade, {
          value: p.shade,
          label: p.shade.charAt(0).toUpperCase() + p.shade.slice(1),
          hex: p.extracted_hex || undefined,
        });
      }
    });
    
    return Array.from(colorMap.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [products]);
  
  // Filter products based on current filters
  const filteredProducts = useMemo((): ProductGridItem[] => {
    if (!products) return [];
    
    return products
      .filter((p) => {
        // Filter by subtype
        if (filters.subtype && p.foil_category !== filters.subtype) {
          return false;
        }
        
        // Filter by colors
        if (filters.colors.length > 0 && !filters.colors.includes(p.shade || '')) {
          return false;
        }
        
        // Filter by search query
        if (filters.searchQuery) {
          const query = filters.searchQuery.toLowerCase();
          const searchFields = [
            p.name,
            p.symbol,
            p.manufacturer,
            p.series,
            p.shade,
          ].filter(Boolean).map(s => s!.toLowerCase());
          
          if (!searchFields.some(field => field.includes(query))) {
            return false;
          }
        }
        
        return true;
      })
      .map((p) => ({
        id: p.id,
        name: p.name,
        symbol: p.symbol,
        price: p.price,
        currency: p.currency,
        imageUrl: p.product_images?.[0]?.image_url,
        shade: p.shade || undefined,
        manufacturer: p.manufacturer || undefined,
        series: p.series || undefined,
        foilCategory: p.foil_category || undefined,
        foilWidth: p.foil_width || undefined,
        extractedHex: p.extracted_hex || undefined,
      }));
  }, [products, filters]);
  
  const handleProductSelect = (productId: string) => {
    dispatch({ type: 'SET_SELECTED_PRODUCT', payload: productId });
  };
  
  if (!finishingType) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          Najpierw wybierz typ wykończenia w poprzednim kroku.
        </CardContent>
      </Card>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Filter className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">
          Filtrowanie {finishingType === 'foil' ? 'folii' : 'płytek'}
        </h2>
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtry produktów</CardTitle>
        </CardHeader>
        <CardContent>
          <ProductFilterBar
            availableSubtypes={availableSubtypes}
            availableColors={availableColors}
            productCount={filteredProducts.length}
          />
        </CardContent>
      </Card>
      
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <ProductGrid
          products={filteredProducts}
          selectedProductId={state.selectedProductId}
          onSelect={handleProductSelect}
          columns={3}
          emptyMessage="Nie znaleziono produktów spełniających kryteria"
        />
      )}
    </div>
  );
}
