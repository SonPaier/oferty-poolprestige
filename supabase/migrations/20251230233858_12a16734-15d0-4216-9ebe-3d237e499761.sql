-- Create storage bucket for product images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for product-images bucket
CREATE POLICY "Product images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can upload product images" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can update product images" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'product-images');

CREATE POLICY "Authenticated users can delete product images" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'product-images');

-- Create table for product images
CREATE TABLE public.product_images (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_size INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for product_images
CREATE POLICY "Product images are viewable by everyone" 
ON public.product_images 
FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can insert product images" 
ON public.product_images 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update product images" 
ON public.product_images 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete product images" 
ON public.product_images 
FOR DELETE 
USING (true);

-- Add RLS policies for products table (INSERT, UPDATE, DELETE)
CREATE POLICY "Authenticated users can insert products" 
ON public.products 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update products" 
ON public.products 
FOR UPDATE 
USING (true);

CREATE POLICY "Authenticated users can delete products" 
ON public.products 
FOR DELETE 
USING (true);

-- Create index for better performance
CREATE INDEX idx_product_images_product_id ON public.product_images(product_id);
CREATE INDEX idx_product_images_sort_order ON public.product_images(product_id, sort_order);