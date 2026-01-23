
# Plan: Import bazy folii Alkorplan z renolit-alkorplan.com

## Cel
Automatyczne pobieranie bazy folii basenowych Renolit Alkorplan ze strony producenta, z uwzględnieniem że Alkorplan 3000 to folia z nadrukiem (nie strukturalna).

## Architektura rozwiązania

### Krok 1: Edge Functions Firecrawl

**Plik: `supabase/functions/firecrawl-map/index.ts`**
- Mapowanie URLi strony producenta
- Wywołuje API Firecrawl `/v1/map`
- Zwraca listę wszystkich podstron z kolekcjami folii

**Plik: `supabase/functions/firecrawl-scrape/index.ts`**
- Scrapowanie pojedynczej strony produktu
- Pobiera markdown i HTML z danymi produktu
- Ekstrahuje zdjęcia i opisy

### Krok 2: Główna funkcja importu

**Plik: `supabase/functions/import-foils-from-web/index.ts`**
- Trzy akcje: `map`, `scrape`, `save`
- Mapowanie kolekcji na typy folii:

| Kolekcja | Typ folii | Grubość |
|----------|-----------|---------|
| Touch | strukturalna | 2.0mm |
| Vogue | strukturalna | 2.0mm |
| Ceramics Evolve | strukturalna | 2.0mm |
| Ceramics | strukturalna | 1.5mm |
| Alive | strukturalna | 1.5mm |
| **Alkorplan 3000** | **nadruk** | 1.5mm |
| Alkorplan 2000 | jednokolorowa | 1.5mm |
| Relief | antyposlizgowa | 1.5mm |
| Kolos | strukturalna | 2.0mm |
| Natural Pool | jednokolorowa | 1.5mm |

### Krok 3: Frontend API Client

**Plik: `src/lib/api/firecrawl.ts`**
- `firecrawlApi.map()` - mapowanie URLi
- `firecrawlApi.scrape()` - scrapowanie pojedynczej strony
- `foilImportApi.mapProducts()` - mapowanie produktów folii
- `foilImportApi.scrapeProducts(urls)` - pobieranie szczegółów
- `foilImportApi.saveProducts(products)` - zapis do bazy

### Krok 4: Strona administracyjna

**Plik: `src/pages/ImportFoils.tsx`**
- Interfejs 3-krokowy:
  1. **Mapuj stronę** - skanowanie renolit-alkorplan.com
  2. **Pobierz dane** - scrapowanie szczegółów produktów
  3. **Zapisz** - wybór produktów i zapis do bazy
- Podgląd produktów z obrazkami, typami i grubościami
- Możliwość wyboru które produkty zaimportować
- Progress bar i obsługa błędów

### Krok 5: Aktualizacje konfiguracji

**Plik: `supabase/config.toml`**
- Dodanie funkcji: `firecrawl-map`, `firecrawl-scrape`, `import-foils-from-web`
- Wszystkie z `verify_jwt = false`

**Plik: `src/App.tsx`**
- Import `ImportFoils` component
- Nowa ścieżka `/import-foils`

## Mapowanie danych produktu

| Pole w bazie | Źródło |
|--------------|--------|
| `symbol` | `ALKORPLAN-{KOLEKCJA}-{PRODUKT}` |
| `name` | `ALKORPLAN {Kolekcja} - {Nazwa}` |
| `category` | `'folia'` |
| `foil_category` | `'jednokolorowa'` / `'strukturalna'` / `'nadruk'` / `'antyposlizgowa'` |
| `subcategory` | Nazwa kolekcji |
| `foil_width` | `1.65` (domyślnie) |
| `description` | Opis z mapowania + nazwa produktu |
| `image_id` | URL obrazu ze strony |
| `price` | `0` (wymaga ręcznego uzupełnienia) |

## Pliki do utworzenia/modyfikacji

1. `supabase/functions/firecrawl-map/index.ts` - NOWY
2. `supabase/functions/firecrawl-scrape/index.ts` - NOWY
3. `supabase/functions/import-foils-from-web/index.ts` - NOWY
4. `src/lib/api/firecrawl.ts` - NOWY
5. `src/pages/ImportFoils.tsx` - NOWY
6. `supabase/config.toml` - EDYCJA (dodanie funkcji)
7. `src/App.tsx` - EDYCJA (dodanie ścieżki)

## Uwagi techniczne

- Firecrawl API Key już skonfigurowany w konektorze
- Scrapowanie w partiach po 10 produktów (rate limiting 500ms)
- Obrazy linkowane bezpośrednio z serwera Renolit
- Ceny wymagają ręcznego uzupełnienia po imporcie
- Przewidywana liczba produktów: ~70
