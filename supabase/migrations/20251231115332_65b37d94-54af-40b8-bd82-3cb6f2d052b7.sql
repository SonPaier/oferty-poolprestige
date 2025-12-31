-- Rename realizations table to portfolio
ALTER TABLE public.realizations RENAME TO portfolio;

-- Rename realization_images table to portfolio_images
ALTER TABLE public.realization_images RENAME TO portfolio_images;

-- Rename the foreign key column
ALTER TABLE public.portfolio_images RENAME COLUMN realization_id TO portfolio_id;

-- Update the foreign key constraint
ALTER TABLE public.portfolio_images DROP CONSTRAINT realization_images_realization_id_fkey;
ALTER TABLE public.portfolio_images ADD CONSTRAINT portfolio_images_portfolio_id_fkey 
  FOREIGN KEY (portfolio_id) REFERENCES public.portfolio(id) ON DELETE CASCADE;

-- Update RLS policy names for portfolio table
ALTER POLICY "Realizations are viewable by everyone" ON public.portfolio RENAME TO "Portfolio is viewable by everyone";
ALTER POLICY "Authenticated users can insert realizations" ON public.portfolio RENAME TO "Authenticated users can insert portfolio";
ALTER POLICY "Authenticated users can update realizations" ON public.portfolio RENAME TO "Authenticated users can update portfolio";
ALTER POLICY "Authenticated users can delete realizations" ON public.portfolio RENAME TO "Authenticated users can delete portfolio";

-- Update RLS policy names for portfolio_images table
ALTER POLICY "Realization images are viewable by everyone" ON public.portfolio_images RENAME TO "Portfolio images are viewable by everyone";
ALTER POLICY "Authenticated users can insert realization images" ON public.portfolio_images RENAME TO "Authenticated users can insert portfolio images";
ALTER POLICY "Authenticated users can update realization images" ON public.portfolio_images RENAME TO "Authenticated users can update portfolio images";
ALTER POLICY "Authenticated users can delete realization images" ON public.portfolio_images RENAME TO "Authenticated users can delete portfolio images";

-- Rename storage bucket
UPDATE storage.buckets SET id = 'portfolio-images', name = 'portfolio-images' WHERE id = 'realization-images';

-- Update storage policies
DROP POLICY IF EXISTS "Realization images are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload realization images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update realization images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete realization images" ON storage.objects;

CREATE POLICY "Portfolio images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'portfolio-images');

CREATE POLICY "Authenticated users can upload portfolio images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'portfolio-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update portfolio images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'portfolio-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete portfolio images"
ON storage.objects FOR DELETE
USING (bucket_id = 'portfolio-images' AND auth.role() = 'authenticated');