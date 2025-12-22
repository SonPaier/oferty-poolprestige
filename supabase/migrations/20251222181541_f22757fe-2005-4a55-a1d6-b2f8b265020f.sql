-- Add status column to offers table
ALTER TABLE public.offers 
ADD COLUMN status text NOT NULL DEFAULT 'queue';

-- Add comment for status values
COMMENT ON COLUMN public.offers.status IS 'Status: queue (W kolejce), draft (Draft), sent (Wysłana)';

-- Create index for faster status queries
CREATE INDEX idx_offers_status ON public.offers(status);
CREATE INDEX idx_offers_created_at ON public.offers(created_at);