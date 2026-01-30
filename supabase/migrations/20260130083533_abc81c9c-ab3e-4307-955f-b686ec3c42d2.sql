-- Etap 1.2: Tabela installation_materials - mapowanie produktów do reguł instalacyjnych
-- Ta tabela łączy istniejące produkty z regułami automatycznego wyliczania ilości

CREATE TABLE public.installation_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  finishing_type TEXT NOT NULL CHECK (finishing_type IN ('foil', 'ceramic')),
  material_category TEXT NOT NULL CHECK (material_category IN ('substrate', 'profile', 'glue', 'rivet', 'sealant', 'underlayment', 'other')),
  calculation_rule JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT false,
  variant_level TEXT NOT NULL CHECK (variant_level IN ('economy', 'standard', 'premium', 'all')) DEFAULT 'all',
  is_optional BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Komentarze
COMMENT ON TABLE public.installation_materials IS 'Mapowanie produktów do reguł obliczania materiałów instalacyjnych';
COMMENT ON COLUMN public.installation_materials.product_id IS 'FK do tabeli products';
COMMENT ON COLUMN public.installation_materials.finishing_type IS 'Typ wykończenia: foil (folia) lub ceramic (ceramika)';
COMMENT ON COLUMN public.installation_materials.material_category IS 'Kategoria materiału: substrate, profile, glue, rivet, sealant, underlayment, other';
COMMENT ON COLUMN public.installation_materials.calculation_rule IS 'Reguły JSON do automatycznego wyliczania ilości';
COMMENT ON COLUMN public.installation_materials.is_default IS 'Czy domyślnie zaznaczony w ofercie';
COMMENT ON COLUMN public.installation_materials.variant_level IS 'Poziom wariantu: economy, standard, premium lub all (dla wszystkich)';
COMMENT ON COLUMN public.installation_materials.is_optional IS 'Czy opcjonalny (można odznaczyć w ofercie)';
COMMENT ON COLUMN public.installation_materials.sort_order IS 'Kolejność wyświetlania';

-- Indeksy
CREATE INDEX idx_installation_materials_product_id ON public.installation_materials(product_id);
CREATE INDEX idx_installation_materials_finishing_type ON public.installation_materials(finishing_type);
CREATE INDEX idx_installation_materials_variant_level ON public.installation_materials(variant_level);

-- Trigger dla updated_at
CREATE TRIGGER update_installation_materials_updated_at
  BEFORE UPDATE ON public.installation_materials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_products_updated_at();

-- RLS
ALTER TABLE public.installation_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Installation materials are viewable by everyone"
  ON public.installation_materials FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert installation materials"
  ON public.installation_materials FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update installation materials"
  ON public.installation_materials FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can delete installation materials"
  ON public.installation_materials FOR DELETE
  USING (true);