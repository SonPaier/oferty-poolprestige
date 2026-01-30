import { useState, useMemo } from 'react';
import { useFinishingWizard, SelectionLevel } from '../FinishingWizardContext';
import { ProductGrid, ProductGridItem } from '../components/ProductGrid';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Layers, Package, Grid3X3, Check, Info, Loader2, ImageOff } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface SubtypeOption {
  value: string;
  label: string;
  count: number;
  minPrice: number;
  maxPrice: number;
}

interface SeriesGroup {
  manufacturer: string;
  series: { name: string; count: number; minPrice: number; maxPrice: number; imageUrl?: string }[];
}

export function Step3SelectionLevel() {
  const { state, dispatch } = useFinishingWizard();
  const { finishingType, selectionLevel, selectedSubtype, selectedSeries, selectedProductId, filters } = state;
  
  // Fetch products
  const { data: products, isLoading } = useQuery({
    queryKey: ['finishing-products-all', finishingType],
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
  
  // Apply filters from step 2
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    
    return products.filter((p) => {
      if (filters.subtype && p.foil_category !== filters.subtype) return false;
      if (filters.colors.length > 0 && !filters.colors.includes(p.shade || '')) return false;
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase();
        const searchFields = [p.name, p.symbol, p.manufacturer, p.series, p.shade]
          .filter(Boolean)
          .map(s => s!.toLowerCase());
        if (!searchFields.some(field => field.includes(query))) return false;
      }
      return true;
    });
  }, [products, filters]);
  
  // Group by subtype
  const subtypeOptions = useMemo((): SubtypeOption[] => {
    const groups = new Map<string, { count: number; minPrice: number; maxPrice: number }>();
    
    filteredProducts.forEach((p) => {
      const subtype = p.foil_category || 'Inne';
      const existing = groups.get(subtype);
      if (existing) {
        existing.count++;
        existing.minPrice = Math.min(existing.minPrice, p.price);
        existing.maxPrice = Math.max(existing.maxPrice, p.price);
      } else {
        groups.set(subtype, { count: 1, minPrice: p.price, maxPrice: p.price });
      }
    });
    
    return Array.from(groups.entries()).map(([value, data]) => ({
      value,
      label: value.charAt(0).toUpperCase() + value.slice(1),
      ...data,
    }));
  }, [filteredProducts]);
  
  // Group by series
  const seriesGroups = useMemo((): SeriesGroup[] => {
    const manufacturers = new Map<string, Map<string, { count: number; minPrice: number; maxPrice: number; imageUrl?: string }>>();
    
    filteredProducts.forEach((p) => {
      const manufacturer = p.manufacturer || 'Inne';
      const series = p.series || 'Bez serii';
      
      if (!manufacturers.has(manufacturer)) {
        manufacturers.set(manufacturer, new Map());
      }
      const seriesMap = manufacturers.get(manufacturer)!;
      
      const existing = seriesMap.get(series);
      if (existing) {
        existing.count++;
        existing.minPrice = Math.min(existing.minPrice, p.price);
        existing.maxPrice = Math.max(existing.maxPrice, p.price);
      } else {
        seriesMap.set(series, {
          count: 1,
          minPrice: p.price,
          maxPrice: p.price,
          imageUrl: p.product_images?.[0]?.image_url,
        });
      }
    });
    
    return Array.from(manufacturers.entries()).map(([manufacturer, seriesMap]) => ({
      manufacturer,
      series: Array.from(seriesMap.entries()).map(([name, data]) => ({ name, ...data })),
    }));
  }, [filteredProducts]);
  
  // Products for grid
  const gridProducts = useMemo((): ProductGridItem[] => {
    return filteredProducts.map((p) => ({
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
  }, [filteredProducts]);
  
  const handleTabChange = (value: string) => {
    dispatch({ type: 'SET_SELECTION_LEVEL', payload: value as SelectionLevel });
  };
  
  const handleSubtypeSelect = (subtype: string) => {
    dispatch({ type: 'SET_SELECTED_SUBTYPE', payload: subtype === selectedSubtype ? null : subtype });
  };
  
  const handleSeriesSelect = (manufacturer: string, series: string) => {
    const isSame = selectedSeries?.manufacturer === manufacturer && selectedSeries?.series === series;
    dispatch({
      type: 'SET_SELECTED_SERIES',
      payload: isSame ? null : { manufacturer, series },
    });
  };
  
  const handleProductSelect = (productId: string) => {
    dispatch({ type: 'SET_SELECTED_PRODUCT', payload: productId });
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Layers className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Poziom szczegółowości wyboru</h2>
      </div>
      
      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border">
        <Info className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground mb-1">Jak chcesz określić produkt w ofercie?</p>
          <ul className="space-y-1 list-disc list-inside">
            <li><strong>Podtyp</strong> - elastyczne, klient wybiera z zakresu</li>
            <li><strong>Seria</strong> - określony producent i seria, różne kolory</li>
            <li><strong>Produkt</strong> - konkretny produkt z dokładną ceną</li>
          </ul>
        </div>
      </div>
      
      <Tabs value={selectionLevel} onValueChange={handleTabChange}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="subtype" className="gap-2">
            <Grid3X3 className="w-4 h-4" />
            Podtyp
          </TabsTrigger>
          <TabsTrigger value="series" className="gap-2">
            <Package className="w-4 h-4" />
            Seria
          </TabsTrigger>
          <TabsTrigger value="product" className="gap-2">
            <Layers className="w-4 h-4" />
            Produkt
          </TabsTrigger>
        </TabsList>
        
        {/* Subtype Tab */}
        <TabsContent value="subtype" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subtypeOptions.map((option) => (
              <Card
                key={option.value}
                className={cn(
                  "cursor-pointer transition-all hover:shadow-md",
                  selectedSubtype === option.value && "ring-2 ring-primary bg-primary/5"
                )}
                onClick={() => handleSubtypeSelect(option.value)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium">{option.label}</h4>
                    {selectedSubtype === option.value && (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p>{option.count} produktów</p>
                    <p className="font-medium text-foreground">
                      {formatPrice(option.minPrice)} - {formatPrice(option.maxPrice)} zł/m²
                    </p>
                  </div>
                  <Badge variant="outline" className="mt-2 text-xs">
                    Cena w ofercie: MAX
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
        
        {/* Series Tab */}
        <TabsContent value="series" className="mt-6">
          <Accordion type="multiple" className="space-y-2">
            {seriesGroups.map((group) => (
              <AccordionItem key={group.manufacturer} value={group.manufacturer} className="border rounded-lg">
                <AccordionTrigger className="px-4 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{group.manufacturer}</span>
                    <Badge variant="secondary">{group.series.length} serii</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {group.series.map((series) => {
                      const isSelected =
                        selectedSeries?.manufacturer === group.manufacturer &&
                        selectedSeries?.series === series.name;
                      
                      return (
                        <Card
                          key={series.name}
                          className={cn(
                            "cursor-pointer transition-all hover:shadow-md",
                            isSelected && "ring-2 ring-primary bg-primary/5"
                          )}
                          onClick={() => handleSeriesSelect(group.manufacturer, series.name)}
                        >
                          <CardContent className="p-3 flex gap-3">
                            <div className="w-16 h-16 rounded bg-muted shrink-0 overflow-hidden">
                              {series.imageUrl ? (
                                <img
                                  src={series.imageUrl}
                                  alt={series.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                  <ImageOff className="w-6 h-6 text-muted-foreground" />
                                </div>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <h5 className="font-medium truncate">{series.name}</h5>
                                {isSelected && (
                                  <Check className="w-4 h-4 text-primary shrink-0" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{series.count} produktów</p>
                              <p className="text-sm font-medium mt-1">
                                {formatPrice(series.minPrice)} - {formatPrice(series.maxPrice)} zł
                              </p>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </TabsContent>
        
        {/* Product Tab */}
        <TabsContent value="product" className="mt-6">
          <ProductGrid
            products={gridProducts}
            selectedProductId={selectedProductId}
            onSelect={handleProductSelect}
            columns={3}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
