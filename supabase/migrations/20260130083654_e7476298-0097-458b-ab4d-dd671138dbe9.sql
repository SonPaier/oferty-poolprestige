-- Etap 1.4: Rozszerzenie tabeli offers o finishing_variant
ALTER TABLE public.offers
ADD COLUMN IF NOT EXISTS valid_until DATE,
ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS finishing_variant JSONB;

-- Komentarze
COMMENT ON COLUMN public.offers.valid_until IS 'Data ważności oferty';
COMMENT ON COLUMN public.offers.is_draft IS 'Czy oferta jest wersją roboczą';
COMMENT ON COLUMN public.offers.finishing_variant IS 'Zapisany wariant wykończenia z materiałami i usługami';

-- Seed data: mapowanie materiałów instalacyjnych do produktów
-- Podkłady (substrate)
INSERT INTO public.installation_materials (product_id, finishing_type, material_category, calculation_rule, is_default, variant_level, is_optional, sort_order) VALUES
  -- Podkład 400g - ekonomiczny
  ('18a66b2e-932f-4325-9139-0bbbf38488f6', 'foil', 'substrate', 
   '{"type": "area_coverage", "applies_to": ["bottom", "walls", "stairs"], "product_width": 2.0, "waste_factor": 1.05}'::jsonb,
   false, 'economy', false, 1),
  
  -- Podkład 500g - standard
  ('63134d00-afa8-4d8a-b9e1-7363dbdb2ca6', 'foil', 'substrate',
   '{"type": "area_coverage", "applies_to": ["bottom", "walls", "stairs"], "product_width": 2.0, "waste_factor": 1.05}'::jsonb,
   true, 'standard', false, 2),
  
  -- Włóknina impregnowana 2m - premium
  ('1acd0509-a4a6-4154-866e-5486fe57f346', 'foil', 'substrate',
   '{"type": "area_coverage", "applies_to": ["bottom", "walls", "stairs"], "product_width": 2.0, "waste_factor": 1.05}'::jsonb,
   false, 'premium', false, 3),

  -- Włóknina impregnowana 1.5m - premium alternatywa
  ('3ff4e3d3-236f-4c27-9a98-b0799889ef6e', 'foil', 'substrate',
   '{"type": "area_coverage", "applies_to": ["bottom", "walls", "stairs"], "product_width": 1.5, "waste_factor": 1.05}'::jsonb,
   false, 'premium', false, 4);

-- Profile (profile)
INSERT INTO public.installation_materials (product_id, finishing_type, material_category, calculation_rule, is_default, variant_level, is_optional, sort_order) VALUES
  -- Kątownik PCW - ekonomiczny
  ('3de6774c-03c5-43d2-89ee-c8e2cea65f04', 'foil', 'profile',
   '{"type": "perimeter", "locations": ["pool_edge"], "unit_length": 2.0, "round_up": true}'::jsonb,
   false, 'economy', false, 10),
  
  -- Kątownik stalowy Tebas 2x5 - standard/premium
  ('42760767-e4e7-4889-8b83-01fc31d23f1d', 'foil', 'profile',
   '{"type": "perimeter", "locations": ["pool_edge", "stairs_edge"], "unit_length": 2.0, "round_up": true}'::jsonb,
   true, 'standard', false, 11),
  
  -- Kątownik stalowy Tebas 3x6 - premium
  ('19ca845d-a77a-4828-95cb-53e742e793bc', 'foil', 'profile',
   '{"type": "perimeter", "locations": ["pool_edge", "stairs_edge"], "unit_length": 2.0, "round_up": true}'::jsonb,
   false, 'premium', false, 12);

-- Kleje (glue)
INSERT INTO public.installation_materials (product_id, finishing_type, material_category, calculation_rule, is_default, variant_level, is_optional, sort_order) VALUES
  -- Klej do podkładu 10kg - standard
  ('59f24aac-b05a-48fe-9abf-2d6fbad3e85c', 'foil', 'glue',
   '{"type": "per_area", "base": "substrate_area", "kg_per_100m2": 15, "package_sizes": [5, 7, 10, 15, 20]}'::jsonb,
   true, 'all', false, 20),

  -- Klej Alkorplus Contact - do folii strukturalnych
  ('105b91a5-6398-445a-8ffb-51d1f846ec49', 'foil', 'glue',
   '{"type": "per_area", "base": "seam_area", "kg_per_100m2": 5, "for_structural_only": true}'::jsonb,
   false, 'premium', true, 21);

-- Folia podkładowa pod Touch/Ceramics (underlayment)
INSERT INTO public.installation_materials (product_id, finishing_type, material_category, calculation_rule, is_default, variant_level, is_optional, sort_order) VALUES
  ('58842809-6ced-4b28-bc4c-9b6442f99a78', 'foil', 'underlayment',
   '{"type": "for_structural", "applies_to": ["bottom"], "for_structural_only": true}'::jsonb,
   true, 'premium', false, 30);

-- Geowłóknina antybakteryjna - opcja premium
INSERT INTO public.installation_materials (product_id, finishing_type, material_category, calculation_rule, is_default, variant_level, is_optional, sort_order) VALUES
  ('4b6ccc77-1e87-4e51-b2e1-1735a67bf576', 'foil', 'substrate',
   '{"type": "area_coverage", "applies_to": ["bottom", "walls"], "product_width": 2.0, "waste_factor": 1.05, "antibacterial": true}'::jsonb,
   false, 'premium', true, 5);