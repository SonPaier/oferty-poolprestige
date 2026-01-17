-- Add subcategory column to products table for attraction categorization
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS subcategory text;

-- Create index for faster queries on category + subcategory
CREATE INDEX IF NOT EXISTS idx_products_category_subcategory ON public.products(category, subcategory);