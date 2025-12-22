-- Create offers table with share UID
CREATE TABLE public.offers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  share_uid TEXT NOT NULL UNIQUE,
  offer_number TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  customer_data JSONB NOT NULL,
  pool_type TEXT NOT NULL,
  dimensions JSONB NOT NULL,
  calculations JSONB,
  sections JSONB NOT NULL,
  excavation JSONB NOT NULL,
  total_net NUMERIC NOT NULL DEFAULT 0,
  total_gross NUMERIC NOT NULL DEFAULT 0
);

-- Create unique index on share_uid for fast lookups
CREATE INDEX idx_offers_share_uid ON public.offers (share_uid);

-- Enable RLS
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Offers are publicly viewable by share_uid (for client access)
CREATE POLICY "Offers are viewable by everyone via share link"
ON public.offers
FOR SELECT
USING (true);

-- Anyone can insert offers (for now, no auth required)
CREATE POLICY "Anyone can create offers"
ON public.offers
FOR INSERT
WITH CHECK (true);

-- Anyone can update offers (for now)
CREATE POLICY "Anyone can update offers"
ON public.offers
FOR UPDATE
USING (true);

-- Anyone can delete offers (for now)
CREATE POLICY "Anyone can delete offers"
ON public.offers
FOR DELETE
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_offers_updated_at
BEFORE UPDATE ON public.offers
FOR EACH ROW
EXECUTE FUNCTION public.update_products_updated_at();