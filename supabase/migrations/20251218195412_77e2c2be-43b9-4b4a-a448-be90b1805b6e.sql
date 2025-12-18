-- Create products table for the pool configurator
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  symbol TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'PLN' CHECK (currency IN ('PLN', 'EUR')),
  description TEXT,
  stock_quantity DECIMAL(12,2) DEFAULT 0,
  image_id TEXT,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster searches
CREATE INDEX idx_products_symbol ON public.products(symbol);
CREATE INDEX idx_products_name ON public.products USING gin(to_tsvector('simple', name));
CREATE INDEX idx_products_category ON public.products(category);

-- Enable RLS (public read access for products)
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Allow public read access to products (no auth needed to view products)
CREATE POLICY "Products are viewable by everyone" 
ON public.products 
FOR SELECT 
USING (true);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_products_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_products_updated_at
BEFORE UPDATE ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.update_products_updated_at();