-- Add foil_category column to products for foil classification
-- Values: 'jednokolorowa', 'nadruk', 'strukturalna', null (for non-foil products)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS foil_category TEXT;

-- Add foil_width column to products for foil width classification
-- Values: 1.65, 2.05, null (for non-foil products)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS foil_width NUMERIC;

-- Create index for faster foil queries
CREATE INDEX IF NOT EXISTS idx_products_foil_category ON public.products(foil_category);
CREATE INDEX IF NOT EXISTS idx_products_foil_width ON public.products(foil_width);