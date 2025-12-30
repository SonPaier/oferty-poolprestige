import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { DbProduct } from './useProducts';

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  file_name: string;
  file_size: number | null;
  sort_order: number;
  created_at: string;
}

export interface ProductWithImages extends DbProduct {
  images: ProductImage[];
}

const ITEMS_PER_PAGE = 50;

export function useProductsPaginated(searchQuery: string = '', page: number = 1) {
  const offset = (page - 1) * ITEMS_PER_PAGE;

  return useQuery({
    queryKey: ['products-paginated', searchQuery, page],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .range(offset, offset + ITEMS_PER_PAGE - 1)
        .order('name');

      if (searchQuery.trim()) {
        const search = `%${searchQuery.trim()}%`;
        query = query.or(`symbol.ilike.${search},name.ilike.${search}`);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching products:', error);
        throw error;
      }

      return {
        products: (data || []) as DbProduct[],
        totalCount: count || 0,
        totalPages: Math.ceil((count || 0) / ITEMS_PER_PAGE),
        currentPage: page,
      };
    },
    staleTime: 60 * 1000,
  });
}

export function useProductImages(productId: string) {
  return useQuery({
    queryKey: ['product-images', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_images')
        .select('*')
        .eq('product_id', productId)
        .order('sort_order');

      if (error) {
        console.error('Error fetching product images:', error);
        throw error;
      }

      return (data || []) as ProductImage[];
    },
    enabled: !!productId,
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: Partial<DbProduct> & { id: string }) => {
      const { id, ...updateData } = product;
      const { data, error } = await supabase
        .from('products')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-count'] });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-count'] });
    },
  });
}

export function useAddProductImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ productId, file }: { productId: string; file: File }) => {
      const fileExt = file.name.split('.').pop();
      const fileName = `${productId}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      // Get max sort order
      const { data: existingImages } = await supabase
        .from('product_images')
        .select('sort_order')
        .eq('product_id', productId)
        .order('sort_order', { ascending: false })
        .limit(1);

      const nextSortOrder = (existingImages?.[0]?.sort_order ?? -1) + 1;

      const { data, error } = await supabase
        .from('product_images')
        .insert({
          product_id: productId,
          image_url: publicUrl,
          file_name: file.name,
          file_size: file.size,
          sort_order: nextSortOrder,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-images', variables.productId] });
    },
  });
}

export function useDeleteProductImage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ imageId, productId, imageUrl }: { imageId: string; productId: string; imageUrl: string }) => {
      // Extract file path from URL
      const urlParts = imageUrl.split('/product-images/');
      if (urlParts[1]) {
        await supabase.storage
          .from('product-images')
          .remove([urlParts[1]]);
      }

      const { error } = await supabase
        .from('product_images')
        .delete()
        .eq('id', imageId);

      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['product-images', variables.productId] });
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (product: Omit<DbProduct, 'id'>) => {
      const { data, error } = await supabase
        .from('products')
        .insert(product)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-paginated'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['products-count'] });
    },
  });
}
