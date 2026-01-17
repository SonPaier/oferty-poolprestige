import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type AttractionSubcategory = 'prysznice' | 'przeciwprady' | 'masaz_wodny' | 'masaz_powietrzny';

export interface AttractionProduct {
  id: string;
  symbol: string;
  name: string;
  price: number;
  currency: 'PLN' | 'EUR';
  description: string | null;
  image_id: string | null;
  category: string | null;
  subcategory: string | null;
}

const EUR_TO_PLN = 4.35;

export function getAttractionPriceInPLN(product: AttractionProduct): number {
  return product.currency === 'EUR' ? product.price * EUR_TO_PLN : product.price;
}

export function useAttractionProducts(
  subcategory: AttractionSubcategory,
  searchQuery: string = '',
  limit: number = 10
) {
  return useQuery({
    queryKey: ['attraction-products', subcategory, searchQuery, limit],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, symbol, name, price, currency, description, image_id, category, subcategory')
        .eq('category', 'attraction')
        .eq('subcategory', subcategory);

      if (searchQuery.trim()) {
        const search = `%${searchQuery.trim()}%`;
        query = query.or(`symbol.ilike.${search},name.ilike.${search}`);
      }

      // When searching, show more results; otherwise limit to default
      const effectiveLimit = searchQuery.trim() ? 50 : limit;

      const { data, error } = await query
        .order('name')
        .limit(effectiveLimit);

      if (error) {
        console.error('Error fetching attraction products:', error);
        throw error;
      }

      return (data || []) as AttractionProduct[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useAttractionProductImage(productId: string | null) {
  return useQuery({
    queryKey: ['product-image', productId],
    queryFn: async () => {
      if (!productId) return null;

      const { data, error } = await supabase
        .from('product_images')
        .select('image_url')
        .eq('product_id', productId)
        .order('sort_order')
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // No rows
        console.error('Error fetching product image:', error);
        return null;
      }

      return data?.image_url || null;
    },
    enabled: !!productId,
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });
}
