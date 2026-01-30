import { useEffect, useMemo } from 'react';
import { useFinishingWizard, VariantLevel, VariantData } from '../FinishingWizardContext';
import { VariantCard } from '../components/VariantCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, Loader2, Info } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice } from '@/lib/calculations';

export function Step6VariantGeneration() {
  const { state, dispatch } = useFinishingWizard();
  const { 
    finishingType, 
    selectionLevel, 
    selectedSubtype, 
    selectedSeries, 
    selectedProductId,
    materials,
    services,
    variants,
    defaultVariant,
  } = state;
  
  // Fetch products for variant generation
  const { data: products, isLoading } = useQuery({
    queryKey: ['variant-products', finishingType, selectionLevel, selectedSubtype, selectedSeries, selectedProductId],
    queryFn: async () => {
      const category = finishingType === 'foil' ? 'folia' : 'ceramika';
      
      let query = supabase
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
          foil_category
        `)
        .eq('category', category)
        .order('price', { ascending: true });
      
      // Filter based on selection level
      if (selectionLevel === 'subtype' && selectedSubtype) {
        query = query.eq('foil_category', selectedSubtype);
      } else if (selectionLevel === 'series' && selectedSeries) {
        query = query
          .eq('manufacturer', selectedSeries.manufacturer)
          .eq('series', selectedSeries.series);
      } else if (selectionLevel === 'product' && selectedProductId) {
        query = query.eq('id', selectedProductId);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: finishingType !== null && (
      (selectionLevel === 'subtype' && selectedSubtype !== null) ||
      (selectionLevel === 'series' && selectedSeries !== null) ||
      (selectionLevel === 'product' && selectedProductId !== null)
    ),
  });
  
  // Generate variants when products are loaded
  useEffect(() => {
    if (!products || products.length === 0 || materials.length === 0) return;
    
    const VAT_RATE = 1.23;
    
    // Calculate total material cost
    const materialsCost = materials.reduce((sum, m) => {
      const qty = m.manualQty ?? m.suggestedQty;
      return sum + qty * m.pricePerUnit;
    }, 0);
    
    // Calculate total service cost
    const servicesCost = services
      .filter(s => s.isEnabled)
      .reduce((sum, s) => sum + s.total, 0);
    
    // Generate three variants based on selection level
    const createVariant = (product: typeof products[0], level: VariantLevel): VariantData => {
      // Adjust materials based on variant level
      const adjustedMaterials = materials.map(m => {
        let priceMultiplier = 1;
        if (level === 'economy') priceMultiplier = 0.9;
        if (level === 'premium') priceMultiplier = 1.15;
        
        return {
          ...m,
          pricePerUnit: m.pricePerUnit * priceMultiplier,
        };
      });
      
      const adjustedServices = services.map(s => ({
        ...s,
        pricePerUnit: level === 'premium' ? s.pricePerUnit * 1.1 : s.pricePerUnit,
        total: level === 'premium' ? s.total * 1.1 : s.total,
      }));
      
      const totalMaterialsNet = adjustedMaterials.reduce((sum, m) => {
        const qty = m.manualQty ?? m.suggestedQty;
        return sum + qty * m.pricePerUnit;
      }, 0);
      
      const totalServicesNet = adjustedServices
        .filter(s => s.isEnabled)
        .reduce((sum, s) => sum + s.total, 0);
      
      // Add product cost (assume some quantity)
      const productQuantity = materials.find(m => m.id === 'foil-main')?.suggestedQty || 50;
      const productCost = product.price * productQuantity;
      
      const totalNet = totalMaterialsNet + totalServicesNet + productCost;
      const totalGross = totalNet * VAT_RATE;
      
      return {
        productId: product.id,
        productName: product.name,
        productPrice: product.price,
        materials: adjustedMaterials,
        services: adjustedServices,
        totalMaterialsNet,
        totalServicesNet,
        totalNet,
        totalGross,
      };
    };
    
    if (selectionLevel === 'product' && products.length === 1) {
      // Single product - vary materials
      const product = products[0];
      dispatch({
        type: 'SET_VARIANTS',
        payload: {
          economy: createVariant(product, 'economy'),
          standard: createVariant(product, 'standard'),
          premium: createVariant(product, 'premium'),
        },
      });
    } else {
      // Multiple products - pick min/mid/max
      const sortedProducts = [...products].sort((a, b) => a.price - b.price);
      const minProduct = sortedProducts[0];
      const maxProduct = sortedProducts[sortedProducts.length - 1];
      const midIndex = Math.floor(sortedProducts.length / 2);
      const midProduct = sortedProducts[midIndex];
      
      dispatch({
        type: 'SET_VARIANTS',
        payload: {
          economy: createVariant(minProduct, 'economy'),
          standard: createVariant(midProduct, 'standard'),
          premium: createVariant(maxProduct, 'premium'),
        },
      });
    }
  }, [products, materials, services, selectionLevel, dispatch]);
  
  const handleSetDefault = (level: VariantLevel) => {
    dispatch({ type: 'SET_DEFAULT_VARIANT', payload: level });
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  
  const hasVariants = variants.economy || variants.standard || variants.premium;
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Layers className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Warianty cenowe</h2>
      </div>
      
      <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border">
        <Info className="w-5 h-5 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-sm text-muted-foreground">
          System wygenerował 3 warianty cenowe. Wybierz wariant domyślny, 
          który zostanie pokazany klientowi jako sugerowany. Klient będzie mógł 
          porównać wszystkie warianty w ofercie.
        </p>
      </div>
      
      {hasVariants ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {variants.economy && (
            <VariantCard
              level="economy"
              variant={variants.economy}
              isDefault={defaultVariant === 'economy'}
              onSetDefault={() => handleSetDefault('economy')}
            />
          )}
          {variants.standard && (
            <VariantCard
              level="standard"
              variant={variants.standard}
              isDefault={defaultVariant === 'standard'}
              onSetDefault={() => handleSetDefault('standard')}
            />
          )}
          {variants.premium && (
            <VariantCard
              level="premium"
              variant={variants.premium}
              isDefault={defaultVariant === 'premium'}
              onSetDefault={() => handleSetDefault('premium')}
            />
          )}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <p>Nie można wygenerować wariantów.</p>
            <p className="text-sm mt-2">
              Upewnij się, że wybrałeś produkt/serię/podtyp i dodałeś materiały.
            </p>
          </CardContent>
        </Card>
      )}
      
      {/* Comparison summary */}
      {hasVariants && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Porównanie wariantów</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              {(['economy', 'standard', 'premium'] as VariantLevel[]).map((level) => {
                const variant = variants[level];
                if (!variant) return null;
                
                const labels = {
                  economy: 'Ekonomiczny',
                  standard: 'Standard',
                  premium: 'Premium',
                };
                
                return (
                  <div key={level}>
                    <p className="text-xs text-muted-foreground mb-1">{labels[level]}</p>
                    <p className="text-lg font-bold">
                      {formatPrice(variant.totalGross)} zł
                    </p>
                    {level === defaultVariant && (
                      <Badge className="mt-1">Domyślny</Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
