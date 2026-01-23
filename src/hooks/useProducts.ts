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
  foil_category: string | null;
  subcategory: string | null;
  shade: string | null;
  foil_width: number | null;
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

export interface FoilOption {
  id: string;
  symbol: string;
  name: string;
  color: string;
  price: number;
  currency: 'PLN' | 'EUR';
  width: number;
  type: 'tradycyjna' | 'strukturalna';
}

// Extract color from foil name
function extractFoilColor(name: string): string {
  const colorPatterns = [
    { pattern: /niebieska/i, color: 'niebieska' },
    { pattern: /biała/i, color: 'biała' },
    { pattern: /turkus/i, color: 'turkus' },
    { pattern: /szara|szary/i, color: 'szara' },
    { pattern: /piaskow/i, color: 'piaskowa' },
    { pattern: /persja/i, color: 'persja niebieska' },
    { pattern: /bizancjum/i, color: 'bizancjum niebieska' },
    { pattern: /marble/i, color: 'marble' },
    { pattern: /vanity/i, color: 'vanity' },
    { pattern: /greek/i, color: 'greek' },
    { pattern: /carrara/i, color: 'carrara' },
    { pattern: /antracyt/i, color: 'antracyt' },
  ];

  for (const { pattern, color } of colorPatterns) {
    if (pattern.test(name)) return color;
  }
  return 'standard';
}

// Extract width from foil name
function extractFoilWidth(name: string): number {
  if (name.includes('2,05') || name.includes('2.05')) return 2.05;
  if (name.includes('1,65') || name.includes('1.65')) return 1.65;
  return 1.65; // default
}

export function useFoilProducts() {
  return useQuery({
    queryKey: ['foil-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .or('name.ilike.%Folia Alkorplan 2000%,name.ilike.%Folia Alkorplan 3000%')
        .gt('price', 0)
        .order('name');

      if (error) {
        console.error('Error fetching foil products:', error);
        throw error;
      }

      const foils: FoilOption[] = (data || []).map(row => ({
        id: row.id,
        symbol: row.symbol,
        name: row.name,
        color: extractFoilColor(row.name),
        price: row.price,
        currency: row.currency as 'PLN' | 'EUR',
        width: extractFoilWidth(row.name),
        type: row.name.includes('3000') ? 'strukturalna' : 'tradycyjna',
      }));

      return foils;
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
  });
}
