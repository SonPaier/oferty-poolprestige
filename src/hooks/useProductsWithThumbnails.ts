import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DbProduct } from './useProducts';

export interface ProductWithThumbnail extends DbProduct {
  thumbnail_url?: string | null;
}

export type SortField = 'name' | 'price' | 'category';
export type SortOrder = 'asc' | 'desc';

interface UseProductsWithThumbnailsParams {
  searchQuery?: string;
  categoryFilter?: string;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  page?: number;
  itemsPerPage?: number;
}

export function useProductsWithThumbnails({
  searchQuery = '',
  categoryFilter = 'all',
  sortBy = 'name',
  sortOrder = 'asc',
  page = 1,
  itemsPerPage = 50,
}: UseProductsWithThumbnailsParams = {}) {
  const offset = (page - 1) * itemsPerPage;

  return useQuery({
    queryKey: ['products-with-thumbnails', searchQuery, categoryFilter, sortBy, sortOrder, page],
    queryFn: async () => {
      // Build base query
      let query = supabase
        .from('products')
        .select('*', { count: 'exact' });

      // Word splitting search - apply each word as AND condition
      if (searchQuery.trim()) {
        const words = searchQuery.trim().split(/\s+/).filter(w => w.length >= 2);
        
        for (const word of words) {
          const pattern = `%${word}%`;
          query = query.or(`name.ilike.${pattern},symbol.ilike.${pattern}`);
        }
      }

      // Category filter
      if (categoryFilter !== 'all') {
        const [filterType, filterValue] = categoryFilter.split(':');
        if (filterType === 'category') {
          query = query.eq('category', filterValue);
        } else if (filterType === 'foil_category') {
          query = query.eq('foil_category', filterValue);
        } else if (filterType === 'subcategory') {
          query = query.eq('subcategory', filterValue);
        }
      }

      // Sorting
      const sortColumn = sortBy === 'category' ? 'category' : sortBy;
      query = query.order(sortColumn, { ascending: sortOrder === 'asc' });

      // Pagination
      query = query.range(offset, offset + itemsPerPage - 1);

      const { data: products, error, count } = await query;

      if (error) {
        console.error('Error fetching products:', error);
        throw error;
      }

      // Fetch thumbnails for these products
      const productIds = (products || []).map(p => p.id);
      let thumbnailMap: Record<string, string> = {};

      if (productIds.length > 0) {
        // Get first image for each product using RPC or manual grouping
        const { data: images } = await supabase
          .from('product_images')
          .select('product_id, image_url, sort_order')
          .in('product_id', productIds)
          .order('sort_order', { ascending: true });

        // Group by product_id and take first
        const seenProducts = new Set<string>();
        (images || []).forEach(img => {
          if (!seenProducts.has(img.product_id)) {
            thumbnailMap[img.product_id] = img.image_url;
            seenProducts.add(img.product_id);
          }
        });
      }

      // Merge thumbnails with products
      const productsWithThumbnails: ProductWithThumbnail[] = (products || []).map(p => ({
        ...p,
        thumbnail_url: thumbnailMap[p.id] || null,
      })) as ProductWithThumbnail[];

      return {
        products: productsWithThumbnails,
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / itemsPerPage),
        currentPage: page,
      };
    },
    staleTime: 60 * 1000,
  });
}
