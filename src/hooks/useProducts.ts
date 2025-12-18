import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface DbProduct {
  id: string;
  symbol: string;
  name: string;
  price: number;
  currency: 'PLN' | 'EUR';
  description: string | null;
  stock_quantity: number | null;
  image_id: string | null;
  category: string | null;
}

const EUR_TO_PLN = 4.35;

export function useProducts(searchQuery: string = '', limit: number = 30) {
  return useQuery({
    queryKey: ['products', searchQuery, limit],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*')
        .limit(limit);

      if (searchQuery.trim()) {
        // Search by symbol or name
        const search = `%${searchQuery.trim()}%`;
        query = query.or(`symbol.ilike.${search},name.ilike.${search}`);
      }

      const { data, error } = await query.order('name');

      if (error) {
        console.error('Error fetching products:', error);
        throw error;
      }

      return (data || []) as DbProduct[];
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useProductsCount() {
  return useQuery({
    queryKey: ['products-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      if (error) {
        console.error('Error fetching products count:', error);
        throw error;
      }

      return count || 0;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function getDbProductPriceInPLN(product: DbProduct): number {
  return product.currency === 'EUR' ? product.price * EUR_TO_PLN : product.price;
}
