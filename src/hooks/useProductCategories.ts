import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductCategory {
  value: string;
  label: string;
  count: number;
  type: 'main' | 'foil' | 'subcategory';
}

export function useProductCategories() {
  return useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      // Fetch all categories in parallel
      const [categoryResult, foilCategoryResult, subcategoryResult] = await Promise.all([
        supabase
          .from('products')
          .select('category')
          .not('category', 'is', null),
        supabase
          .from('products')
          .select('foil_category')
          .not('foil_category', 'is', null),
        supabase
          .from('products')
          .select('subcategory')
          .not('subcategory', 'is', null),
      ]);

      // Count main categories
      const categoryCounts: Record<string, number> = {};
      (categoryResult.data || []).forEach((p) => {
        const cat = p.category as string;
        categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
      });

      // Count foil categories
      const foilCategoryCounts: Record<string, number> = {};
      (foilCategoryResult.data || []).forEach((p) => {
        const cat = p.foil_category as string;
        foilCategoryCounts[cat] = (foilCategoryCounts[cat] || 0) + 1;
      });

      // Count subcategories
      const subcategoryCounts: Record<string, number> = {};
      (subcategoryResult.data || []).forEach((p) => {
        const cat = p.subcategory as string;
        subcategoryCounts[cat] = (subcategoryCounts[cat] || 0) + 1;
      });

      // Get total count
      const { count: totalCount } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      // Build categories array
      const categories: ProductCategory[] = [
        { value: 'all', label: 'Wszystkie', count: totalCount || 0, type: 'main' },
      ];

      // Add main categories with nice labels
      const mainCategoryLabels: Record<string, string> = {
        folia: 'Folie',
        attraction: 'Atrakcje',
      };

      Object.entries(categoryCounts).forEach(([value, count]) => {
        categories.push({
          value: `category:${value}`,
          label: mainCategoryLabels[value] || value,
          count,
          type: 'main',
        });
      });

      // Add foil categories
      const foilCategoryLabels: Record<string, string> = {
        strukturalna: 'Strukturalna',
        jednokolorowa: 'Jednokolorowa',
        nadruk: 'Z nadrukiem',
        antypoślizgowa: 'Antypoślizgowa',
      };

      Object.entries(foilCategoryCounts).forEach(([value, count]) => {
        categories.push({
          value: `foil_category:${value}`,
          label: foilCategoryLabels[value] || value,
          count,
          type: 'foil',
        });
      });

      // Add subcategories (limit to top 10 by count)
      const sortedSubcategories = Object.entries(subcategoryCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      sortedSubcategories.forEach(([value, count]) => {
        categories.push({
          value: `subcategory:${value}`,
          label: value,
          count,
          type: 'subcategory',
        });
      });

      return categories;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
