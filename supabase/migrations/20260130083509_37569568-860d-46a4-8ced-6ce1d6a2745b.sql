-- Etap 1.1: Rozszerzenie tabeli products o kolumny dla folii
-- Dodajemy kolumny potrzebne do optymalizacji rozkładu folii

ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS manufacturer TEXT,
ADD COLUMN IF NOT EXISTS series TEXT,
ADD COLUMN IF NOT EXISTS available_widths JSONB DEFAULT '[1.65, 2.05]'::jsonb,
ADD COLUMN IF NOT EXISTS roll_length DECIMAL DEFAULT 25,
ADD COLUMN IF NOT EXISTS joint_type TEXT CHECK (joint_type IN ('overlap', 'butt')),
ADD COLUMN IF NOT EXISTS overlap_width DECIMAL DEFAULT 0.07;

-- Komentarze do kolumn
COMMENT ON COLUMN public.products.manufacturer IS 'Producent folii (np. Renolit, ELBE)';
COMMENT ON COLUMN public.products.series IS 'Seria produktu (np. Alkorplan 2000, Touch)';
COMMENT ON COLUMN public.products.available_widths IS 'Dostępne szerokości rolek w metrach [1.65, 2.05]';
COMMENT ON COLUMN public.products.roll_length IS 'Długość rolki w metrach (domyślnie 25m)';
COMMENT ON COLUMN public.products.joint_type IS 'Typ łączenia: overlap (zakładka) lub butt (doczołowe dla strukturalnych)';
COMMENT ON COLUMN public.products.overlap_width IS 'Szerokość zakładu w metrach (domyślnie 0.07m = 7cm)';

-- Aktualizacja istniejących folii strukturalnych - ustawienie joint_type = 'butt'
UPDATE public.products 
SET joint_type = 'butt'
WHERE category = 'Folia basenowa' 
  AND foil_category = 'strukturalna';

-- Aktualizacja istniejących folii jednokolorowych i nadrukowych - ustawienie joint_type = 'overlap'
UPDATE public.products 
SET joint_type = 'overlap'
WHERE category = 'Folia basenowa' 
  AND foil_category IN ('jednokolorowa', 'nadruk');

-- Wypełnienie kolumny series na podstawie subcategory dla folii
UPDATE public.products
SET series = subcategory
WHERE category = 'Folia basenowa' 
  AND subcategory IS NOT NULL
  AND series IS NULL;

-- Ustawienie producenta Renolit dla Alkorplan
UPDATE public.products
SET manufacturer = 'Renolit'
WHERE category = 'Folia basenowa' 
  AND (subcategory LIKE 'Alkorplan%' OR name LIKE '%Alkorplan%');

-- Ustawienie szerokości dla różnych typów folii
-- Jednokolorowa: obie szerokości
UPDATE public.products
SET available_widths = '[1.65, 2.05]'::jsonb
WHERE category = 'Folia basenowa' 
  AND foil_category = 'jednokolorowa';

-- Nadruk i strukturalna: tylko 1.65m
UPDATE public.products
SET available_widths = '[1.65]'::jsonb
WHERE category = 'Folia basenowa' 
  AND foil_category IN ('nadruk', 'strukturalna');