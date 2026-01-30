import { useEffect, useMemo } from 'react';
import { useFinishingWizard, MaterialItem, ServiceItem } from '../FinishingWizardContext';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { MaterialsTable } from '../components/MaterialsTable';
import { ServicesTable } from '../components/ServicesTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Package, Wrench, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { formatPrice, calculateFoilOptimization } from '@/lib/calculations';
import { useSettings } from '@/context/SettingsContext';

export function Step5InstallationMaterials() {
  const { state, dispatch } = useFinishingWizard();
  const { state: configuratorState } = useConfigurator();
  const { companySettings } = useSettings();
  const { finishingType, materials, services, selectedRollWidth } = state;
  const { dimensions, foilType } = configuratorState;
  
  // Fetch installation materials
  const { data: dbMaterials, isLoading: materialsLoading } = useQuery({
    queryKey: ['installation-materials', finishingType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_materials')
        .select(`
          id,
          product_id,
          calculation_rule,
          is_default,
          is_optional,
          material_category,
          variant_level,
          sort_order,
          products(id, name, symbol, price, currency)
        `)
        .eq('finishing_type', finishingType === 'foil' ? 'folia' : 'ceramika')
        .eq('is_default', true)
        .order('sort_order');
      
      if (error) throw error;
      return data;
    },
    enabled: finishingType !== null,
  });
  
  // Fetch installation services
  const { data: dbServices, isLoading: servicesLoading } = useQuery({
    queryKey: ['installation-services', finishingType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('installation_services')
        .select('*')
        .eq('finishing_type', finishingType === 'foil' ? 'folia' : 'ceramika')
        .eq('is_default', true)
        .order('sort_order');
      
      if (error) throw error;
      return data;
    },
    enabled: finishingType !== null,
  });
  
  // Calculate pool areas for quantity calculations
  const poolAreas = useMemo(() => {
    const foilCalc = calculateFoilOptimization(
      dimensions,
      foilType,
      companySettings.irregularSurchargePercent
    );
    
    return {
      totalArea: foilCalc?.totalArea || 0,
      bottomArea: dimensions.length * dimensions.width,
      wallArea: 2 * (dimensions.length + dimensions.width) * dimensions.depth,
      perimeter: 2 * (dimensions.length + dimensions.width),
    };
  }, [dimensions, foilType, companySettings.irregularSurchargePercent, selectedRollWidth]);
  
  // Calculate quantity based on rule
  const calculateQuantity = (rule: any, areas: typeof poolAreas): number => {
    if (!rule || typeof rule !== 'object') {
      return 1;
    }
    
    const ruleType = rule.type as string;
    
    switch (ruleType) {
      case 'area_coverage':
        const wasteFactor = (rule.waste_factor as number) || 1.1;
        return Math.ceil(areas.totalArea * wasteFactor);
      
      case 'perimeter':
        const unitLength = (rule.unit_length as number) || 1;
        return Math.ceil(areas.perimeter / unitLength) * unitLength;
      
      case 'per_area':
        const kgPer100 = (rule.kg_per_100m2 as number) || 1;
        return Math.ceil((areas.totalArea / 100) * kgPer100);
      
      case 'per_m2':
        const unitsPerM2 = (rule.units_per_m2 as number) || 1;
        return Math.ceil(areas.totalArea * unitsPerM2);
      
      case 'fixed':
        return (rule.quantity as number) || 1;
      
      default:
        return 1;
    }
  };
  
  // Initialize materials from database
  useEffect(() => {
    if (dbMaterials && materials.length === 0) {
      const calculatedMaterials: MaterialItem[] = dbMaterials.map((m) => {
        const product = m.products;
        const quantity = calculateQuantity(m.calculation_rule, poolAreas);
        
        return {
          id: m.id,
          name: product?.name || 'Nieznany produkt',
          symbol: product?.symbol || '',
          unit: 'm²',
          suggestedQty: quantity,
          manualQty: null,
          pricePerUnit: product?.price || 0,
          productId: m.product_id,
          category: m.material_category,
        };
      });
      
      dispatch({ type: 'SET_MATERIALS', payload: calculatedMaterials });
    }
  }, [dbMaterials, materials.length, poolAreas, dispatch]);
  
  // Initialize services from database
  useEffect(() => {
    if (dbServices && services.length === 0) {
      const calculatedServices: ServiceItem[] = dbServices.map((s) => {
        // Calculate quantity based on pool areas
        let quantity = poolAreas.totalArea;
        const appliesTo = s.applies_to as any[];
        
        if (Array.isArray(appliesTo) && !appliesTo.includes('all')) {
          // Specific area calculation based on applies_to
          if (appliesTo.includes('bottom')) quantity = poolAreas.bottomArea;
          if (appliesTo.includes('walls')) quantity = poolAreas.wallArea;
          if (appliesTo.includes('perimeter')) quantity = poolAreas.perimeter;
        }
        
        return {
          id: s.id,
          name: s.name,
          unit: s.unit,
          quantity: Math.ceil(quantity),
          pricePerUnit: s.price_per_unit,
          total: Math.ceil(quantity) * s.price_per_unit,
          category: s.service_category,
          isOptional: s.is_optional,
          isEnabled: true,
        };
      });
      
      dispatch({ type: 'SET_SERVICES', payload: calculatedServices });
    }
  }, [dbServices, services.length, poolAreas, dispatch]);
  
  // Calculate totals
  const materialsTotalNet = useMemo(() => {
    return materials.reduce((sum, m) => {
      const qty = m.manualQty ?? m.suggestedQty;
      return sum + qty * m.pricePerUnit;
    }, 0);
  }, [materials]);
  
  const servicesTotalNet = useMemo(() => {
    return services
      .filter(s => s.isEnabled)
      .reduce((sum, s) => sum + s.total, 0);
  }, [services]);
  
  const isLoading = materialsLoading || servicesLoading;
  
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
        <Package className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Materiały instalacyjne</h2>
      </div>
      
      {/* Materials table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Materiały</CardTitle>
            <span className="text-sm text-muted-foreground">
              Suma: <strong className="text-foreground">{formatPrice(materialsTotalNet)} zł</strong>
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <MaterialsTable
            materials={materials}
            onUpdateMaterial={(id, updates) => 
              dispatch({ type: 'UPDATE_MATERIAL', payload: { id, updates } })
            }
            onRemoveMaterial={(id) => 
              dispatch({ type: 'REMOVE_MATERIAL', payload: id })
            }
            onAddMaterial={(material) =>
              dispatch({ type: 'ADD_MATERIAL', payload: material })
            }
          />
        </CardContent>
      </Card>
      
      <Separator />
      
      {/* Services table */}
      <div className="flex items-center gap-2">
        <Wrench className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Usługi montażowe</h2>
      </div>
      
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Usługi</CardTitle>
            <span className="text-sm text-muted-foreground">
              Suma: <strong className="text-foreground">{formatPrice(servicesTotalNet)} zł</strong>
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <ServicesTable
            services={services}
            onUpdateService={(id, updates) =>
              dispatch({ type: 'UPDATE_SERVICE', payload: { id, updates } })
            }
          />
        </CardContent>
      </Card>
      
      {/* Total summary */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <span className="font-medium">Razem materiały i usługi:</span>
            <span className="text-xl font-bold text-primary">
              {formatPrice(materialsTotalNet + servicesTotalNet)} zł netto
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
