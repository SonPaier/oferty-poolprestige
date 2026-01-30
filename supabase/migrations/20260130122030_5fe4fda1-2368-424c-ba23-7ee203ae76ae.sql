-- US-1.4: Tabela pool_configurations - przechowywanie obliczonych powierzchni basenu
CREATE TABLE public.pool_configurations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID REFERENCES public.offers(id) ON DELETE CASCADE,
  pool_type TEXT NOT NULL,
  dimensions JSONB NOT NULL,
  calculated_areas JSONB NOT NULL DEFAULT '{}',
  stairs_config JSONB,
  paddling_pool_config JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- US-1.5: Tabela foil_optimization_results - przechowywanie wyników optymalizacji
CREATE TABLE public.foil_optimization_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pool_configuration_id UUID REFERENCES public.pool_configurations(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id),
  roll_width NUMERIC NOT NULL,
  cutting_plan JSONB NOT NULL DEFAULT '{}',
  waste_pieces JSONB NOT NULL DEFAULT '[]',
  total_area_m2 NUMERIC NOT NULL DEFAULT 0,
  waste_percentage NUMERIC NOT NULL DEFAULT 0,
  score INTEGER NOT NULL DEFAULT 0,
  is_recommended BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- US-1.6: Tabela offer_variants - system wariantów cenowych
CREATE TABLE public.offer_variants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID REFERENCES public.offers(id) ON DELETE CASCADE,
  variant_level TEXT NOT NULL CHECK (variant_level IN ('economy', 'standard', 'premium')),
  foil_product_id UUID REFERENCES public.products(id),
  materials JSONB NOT NULL DEFAULT '[]',
  services JSONB NOT NULL DEFAULT '[]',
  total_materials_net NUMERIC NOT NULL DEFAULT 0,
  total_services_net NUMERIC NOT NULL DEFAULT 0,
  total_net NUMERIC NOT NULL DEFAULT 0,
  total_gross NUMERIC NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(offer_id, variant_level)
);

-- US-1.7: Tabela offer_changes_log - śledzenie zmian w ofercie
CREATE TABLE public.offer_changes_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID REFERENCES public.offers(id) ON DELETE CASCADE,
  change_type TEXT NOT NULL,
  field_name TEXT,
  old_value JSONB,
  new_value JSONB,
  changed_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- US-1.8: Tabela offer_comments - komentarze do oferty
CREATE TABLE public.offer_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID REFERENCES public.offers(id) ON DELETE CASCADE,
  comment_text TEXT NOT NULL,
  author TEXT,
  is_internal BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- US-1.9: Rozszerzenie tabeli offers o pola rabatowe
ALTER TABLE public.offers 
ADD COLUMN IF NOT EXISTS discount_percentage NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_per_module JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS margin_percentage NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS notes_internal TEXT;

-- US-1.10: Tabela subiekt_sync_log - przygotowanie pod Subiekt Nexo
CREATE TABLE public.subiekt_sync_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  offer_id UUID REFERENCES public.offers(id) ON DELETE CASCADE,
  sync_status TEXT NOT NULL DEFAULT 'pending' CHECK (sync_status IN ('pending', 'synced', 'error')),
  subiekt_document_id TEXT,
  sync_started_at TIMESTAMP WITH TIME ZONE,
  sync_completed_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.pool_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.foil_optimization_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_changes_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offer_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subiekt_sync_log ENABLE ROW LEVEL SECURITY;

-- RLS policies for pool_configurations
CREATE POLICY "Pool configurations are viewable by everyone" ON public.pool_configurations FOR SELECT USING (true);
CREATE POLICY "Anyone can insert pool configurations" ON public.pool_configurations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update pool configurations" ON public.pool_configurations FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete pool configurations" ON public.pool_configurations FOR DELETE USING (true);

-- RLS policies for foil_optimization_results
CREATE POLICY "Foil optimization results are viewable by everyone" ON public.foil_optimization_results FOR SELECT USING (true);
CREATE POLICY "Anyone can insert foil optimization results" ON public.foil_optimization_results FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update foil optimization results" ON public.foil_optimization_results FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete foil optimization results" ON public.foil_optimization_results FOR DELETE USING (true);

-- RLS policies for offer_variants
CREATE POLICY "Offer variants are viewable by everyone" ON public.offer_variants FOR SELECT USING (true);
CREATE POLICY "Anyone can insert offer variants" ON public.offer_variants FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update offer variants" ON public.offer_variants FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete offer variants" ON public.offer_variants FOR DELETE USING (true);

-- RLS policies for offer_changes_log
CREATE POLICY "Offer changes log is viewable by everyone" ON public.offer_changes_log FOR SELECT USING (true);
CREATE POLICY "Anyone can insert offer changes log" ON public.offer_changes_log FOR INSERT WITH CHECK (true);

-- RLS policies for offer_comments
CREATE POLICY "Offer comments are viewable by everyone" ON public.offer_comments FOR SELECT USING (true);
CREATE POLICY "Anyone can insert offer comments" ON public.offer_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update offer comments" ON public.offer_comments FOR UPDATE USING (true);
CREATE POLICY "Anyone can delete offer comments" ON public.offer_comments FOR DELETE USING (true);

-- RLS policies for subiekt_sync_log
CREATE POLICY "Subiekt sync log is viewable by everyone" ON public.subiekt_sync_log FOR SELECT USING (true);
CREATE POLICY "Anyone can insert subiekt sync log" ON public.subiekt_sync_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update subiekt sync log" ON public.subiekt_sync_log FOR UPDATE USING (true);

-- Trigger for updated_at on new tables
CREATE TRIGGER update_pool_configurations_updated_at
  BEFORE UPDATE ON public.pool_configurations
  FOR EACH ROW EXECUTE FUNCTION public.update_products_updated_at();

CREATE TRIGGER update_offer_variants_updated_at
  BEFORE UPDATE ON public.offer_variants
  FOR EACH ROW EXECUTE FUNCTION public.update_products_updated_at();

CREATE TRIGGER update_offer_comments_updated_at
  BEFORE UPDATE ON public.offer_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_products_updated_at();