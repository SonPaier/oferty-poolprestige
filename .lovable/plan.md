

# Plan: Automatyczne określanie odcieni folii podczas importu

## Analiza problemu

Strony produktowe Alkorplan i ELBE nie zawierają ustandaryzowanych kodów kolorów (RAL/RGB). Jednak nazwy produktów i kolekcji pozwalają na automatyczne przypisanie odcienia:

| Typ produktu | Źródło odcienia | Przykład |
|--------------|-----------------|----------|
| Jednokolorowe (Alkorplan 2000) | Nazwa produktu = kolor | "White" → biały, "Sand" → piaskowy |
| Nadruk (Alkorplan 3000) | Dominujący kolor w nazwie | "Persia Blue" → niebieski |
| Strukturalne (Alive, Touch) | Mapowanie z katalogu | "Bhumi" → piaskowy, "Chandra" → szary |
| ELBE Plain Color | Nazwa produktu = kolor | "Sand Classic" → piaskowy |
| ELBE SOLID/MOTION | Drugi człon nazwy | "SOLID Amber" → beżowy |

---

## Plan zmian

### 1. Nowa kolumna w bazie danych

Dodanie kolumny `shade` (TEXT, nullable) do tabeli `products`:

```sql
ALTER TABLE products ADD COLUMN shade text;
```

### 2. Mapowanie odcieni w kodzie

Nowy słownik mapujący nazwy produktów na polskie odcienie:

```text
SHADE_MAPPING = {
  // Bezpośrednie mapowanie (jednokolorowe)
  'white': 'biały',
  'sand': 'piaskowy',
  'light blue': 'jasnoniebieski',
  'adriatic blue': 'niebieski',
  'caribbean green': 'zielony',
  'light grey': 'jasnoszary',
  'dark grey': 'ciemnoszary',
  'black': 'czarny',
  
  // Strukturalne Alkorplan (na podstawie katalogu)
  'bhumi': 'piaskowy',
  'chandra': 'szary',
  'kohinoor': 'niebieski',
  'prestige': 'czarny',
  'sublime': 'beżowy',
  'volcanic': 'ciemnoszary',
  'travertine': 'beżowy',
  'authentic': 'piaskowy',
  ...
  
  // ELBE
  'amber': 'beżowy',
  'basalt': 'ciemnoszary',
  'marble': 'biały',
  ...
}
```

### 3. Funkcja automatycznego określania odcienia

```text
function determineShade(productName, collectionSlug):
  1. Wyciągnij ostatni człon nazwy (np. "SOLID Amber" → "Amber")
  2. Sprawdź w SHADE_MAPPING
  3. Jeśli brak - spróbuj dopasować słowa kluczowe (blue, grey, white...)
  4. Fallback: null (do ręcznego uzupełnienia)
```

### 4. Modyfikacja procesu importu

**Plik: `src/lib/api/firecrawl.ts`**
- Rozszerzenie interfejsu `FoilProduct` o pole `shade?: string`
- Dodanie słownika `SHADE_MAPPING` z ~50 mapowaniami
- Funkcja `determineShade(name, collection)` do automatycznego przypisania

**Plik: `supabase/functions/import-foils-from-web/index.ts`**
- Dodanie kolumny `shade` do insert/upsert
- Przekazywanie shade z frontendu do bazy

---

## Szczegółowe mapowania kolorów

### Alkorplan - Kolekcje strukturalne

| Produkt | Odcień |
|---------|--------|
| Bhumi, Nara | piaskowy |
| Chandra, Kohinoor | szary |
| Prestige, Volcanic | czarny |
| Sublime, Travertine | beżowy |
| Authentic, Concrete | szary |
| Mediterranean Blue | niebieski |

### Alkorplan - Jednokolorowe (2000/Relief)

| Produkt | Odcień |
|---------|--------|
| White | biały |
| Sand | piaskowy |
| Light Blue | jasnoniebieski |
| Adriatic Blue, Greek Blue | niebieski |
| Caribbean Green | zielony |
| Light Grey | jasnoszary |
| Dark Grey | ciemnoszary |
| Black | czarny |

### ELBE

| Wzorzec nazwy | Odcień |
|---------------|--------|
| *White, *Pearl | biały |
| *Sand, *Beige, *Amber | beżowy/piaskowy |
| *Blue, *Adriatic | niebieski |
| *Grey, *Basalt | szary |
| *Black, *Anthracite | czarny |

---

## Podsumowanie zmian

| Komponent | Zmiana |
|-----------|--------|
| Baza danych | Nowa kolumna `shade` w tabeli `products` |
| `src/lib/api/firecrawl.ts` | Słownik SHADE_MAPPING + funkcja determineShade() |
| Edge function | Zapisywanie shade do bazy |
| Interface FoilProduct | Nowe pole `shade?: string` |

## Oczekiwany rezultat

- Import folii automatycznie przypisze odcień dla ~90% produktów
- Pozostałe ~10% (nietypowe nazwy) będzie miało `shade = null` do ręcznego uzupełnienia
- W przyszłości można dodać filtrowanie folii po odcieniu w konfiguratorze

