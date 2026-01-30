-- Etap 1.3: Tabela installation_services - usługi montażowe
-- Przechowuje stawki za usługi instalacji folii/ceramiki

CREATE TABLE public.installation_services (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  finishing_type TEXT NOT NULL CHECK (finishing_type IN ('foil', 'ceramic')),
  service_category TEXT NOT NULL CHECK (service_category IN ('installation', 'welding', 'preparation', 'other')),
  price_per_unit DECIMAL NOT NULL DEFAULT 0,
  unit TEXT NOT NULL CHECK (unit IN ('m2', 'mb', 'szt', 'h')) DEFAULT 'm2',
  applies_to JSONB NOT NULL DEFAULT '["all"]'::jsonb,
  is_default BOOLEAN NOT NULL DEFAULT true,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Komentarze
COMMENT ON TABLE public.installation_services IS 'Usługi instalacyjne dla wykończenia basenu';
COMMENT ON COLUMN public.installation_services.name IS 'Nazwa usługi';
COMMENT ON COLUMN public.installation_services.finishing_type IS 'Typ wykończenia: foil lub ceramic';
COMMENT ON COLUMN public.installation_services.service_category IS 'Kategoria usługi';
COMMENT ON COLUMN public.installation_services.price_per_unit IS 'Cena za jednostkę';
COMMENT ON COLUMN public.installation_services.unit IS 'Jednostka: m2, mb, szt, h';
COMMENT ON COLUMN public.installation_services.applies_to IS 'Do jakich powierzchni: ["bottom", "walls", "stairs", "paddling", "all"]';
COMMENT ON COLUMN public.installation_services.is_default IS 'Czy domyślnie wliczone w ofertę';
COMMENT ON COLUMN public.installation_services.is_optional IS 'Czy opcjonalna (można odznaczyć)';

-- Indeksy
CREATE INDEX idx_installation_services_finishing_type ON public.installation_services(finishing_type);

-- Trigger dla updated_at
CREATE TRIGGER update_installation_services_updated_at
  BEFORE UPDATE ON public.installation_services
  FOR EACH ROW
  EXECUTE FUNCTION public.update_products_updated_at();

-- RLS
ALTER TABLE public.installation_services ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Installation services are viewable by everyone"
  ON public.installation_services FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert installation services"
  ON public.installation_services FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update installation services"
  ON public.installation_services FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can delete installation services"
  ON public.installation_services FOR DELETE
  USING (true);

-- Seed data: domyślne usługi montażowe dla folii
INSERT INTO public.installation_services (name, finishing_type, service_category, price_per_unit, unit, applies_to, is_default, sort_order, description) VALUES
  ('Montaż folii - powierzchnia standardowa', 'foil', 'installation', 45.00, 'm2', '["bottom", "walls"]'::jsonb, true, 1, 'Montaż folii basenowej na dno i ściany'),
  ('Montaż folii - schody i brodzik', 'foil', 'installation', 60.00, 'm2', '["stairs", "paddling"]'::jsonb, true, 2, 'Montaż folii na schodach i brodziku (wyższa stawka)'),
  ('Zgrzewanie doczołowe', 'foil', 'welding', 15.00, 'mb', '["bottom"]'::jsonb, false, 3, 'Zgrzewanie doczołowe dla folii strukturalnych (Touch, Relief, Ceramics)'),
  ('Przygotowanie podłoża', 'foil', 'preparation', 20.00, 'm2', '["all"]'::jsonb, false, 4, 'Szlifowanie i przygotowanie podłoża betonowego'),
  ('Montaż ceramiki - powierzchnia standardowa', 'ceramic', 'installation', 80.00, 'm2', '["bottom", "walls"]'::jsonb, true, 10, 'Układanie płytek ceramicznych na dno i ściany'),
  ('Montaż ceramiki - schody', 'ceramic', 'installation', 100.00, 'm2', '["stairs"]'::jsonb, true, 11, 'Układanie płytek na schodach (wyższa stawka)'),
  ('Fugowanie', 'ceramic', 'other', 25.00, 'm2', '["all"]'::jsonb, true, 12, 'Fugowanie płytek ceramicznych');