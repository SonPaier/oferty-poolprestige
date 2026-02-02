
# Plan: Uproszczony moduł wykończenia wnętrza basenu

## Cel

Całkowite przeprojektowanie modułu wykończenia na jednokrokowy interfejs z:
- Wybór podtypu folii (jednokolorowe/z nadrukiem/strukturalne) z domyślnymi cenami
- Tabela folii z filtrami na jednym ekranie
- Automatyczne obliczanie ilości materiałów z możliwością ręcznej edycji
- Galeria kolorów dla oferty bez wybranej konkretnej folii
- 3 warianty cenowe: jednokolorowe = Standard, z nadrukiem = Standard Plus, strukturalne = Premium

---

## Zmiany w bazie danych

### 1. Aktualizacja kategorii folii
Zamiana `antyposlizgowa` na `strukturalna` w tabeli products:

```sql
UPDATE products 
SET foil_category = 'strukturalna' 
WHERE foil_category = 'antyposlizgowa';
```

---

## Zmiany w kodzie

### 1. Usunięcie wyboru typu wykończenia z DimensionsStep

**Plik:** `src/components/steps/DimensionsStep.tsx`

**Zmiana:**
- Usunięcie sekcji "Typ wykończenia" (linie ~794-821)
- Wybór foliowany/ceramiczny będzie teraz w dedykowanym kroku Wykończenie

---

### 2. Przeprojektowanie FinishingWizardContext

**Plik:** `src/components/finishing/FinishingWizardContext.tsx`

**Nowy state:**
```typescript
interface FinishingWizardState {
  // Główny wybór
  finishingType: 'foil' | 'ceramic' | null;
  
  // Podtyp folii (3 warianty cenowe)
  selectedSubtype: 'jednokolorowa' | 'nadruk' | 'strukturalna' | null;
  subtypePrices: {
    jednokolorowa: number; // 107 zł domyślnie
    nadruk: number;        // 145 zł domyślnie  
    strukturalna: number;  // 210 zł domyślnie
  };
  
  // Konkretny produkt (opcjonalnie)
  selectedProductId: string | null;
  selectedProductName: string | null;
  
  // Filtry tabeli
  filters: {
    manufacturer: string | null;
    shade: string | null; // kolor wiodący
    searchQuery: string;
  };
  
  // Ilość folii i materiały (w kodzie, nie w bazie)
  foilQuantity: {
    totalArea: number;     // obliczone automatycznie
    manualArea: number | null; // ręczna edycja
  };
  
  materials: MaterialItem[];
  
  // Flagi
  showColorGallery: boolean;
  requiresRecalculation: boolean;
}
```

**Domyślne ceny podtypów:**
- Jednokolorowa: 107 zł/m² netto
- Z nadrukiem: 145 zł/m² netto
- Strukturalna: 210 zł/m² netto

---

### 3. Nowy jednokrokowy FinishingModuleWizard

**Plik:** `src/components/finishing/FinishingModuleWizard.tsx`

**Struktura jednokrokowa:**

```text
┌─────────────────────────────────────────────────────────────────┐
│ WYKOŃCZENIE BASENU                                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [Folia PVC]  [Ceramika]     ← wybór typu (duże karty)          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ PODTYP FOLII                                                    │
│                                                                 │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐          │
│  │ Jednokolorowa │ │ Z nadrukiem   │ │ Strukturalna  │          │
│  │    STANDARD   │ │ STANDARD PLUS │ │   PREMIUM     │          │
│  │   107 zł/m²   │ │   145 zł/m²   │ │   210 zł/m²   │          │
│  │   [Edytuj]    │ │   [Edytuj]    │ │   [Edytuj]    │          │
│  └───────────────┘ └───────────────┘ └───────────────┘          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ DOSTĘPNE FOLIE (po kliknięciu podtypu)                          │
│                                                                 │
│  Producent: [Wszystkie ▾]  Kolor: [Wszystkie ▾]  Szukaj: [____] │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Symbol     │ Nazwa           │ Producent │ Kolor  │ Cena   │ │
│  │─────────────────────────────────────────────────────────── │ │
│  │ ALK-2000   │ Alkorplan Blue  │ Renolit   │ 🔵 niebieski   │ │
│  │ ALK-3000   │ Alkorplan White │ Renolit   │ ⚪ biały       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ℹ️ Bez wyboru konkretnej folii: pozycja "Folia jednokolorowa  │
│     - kolor do sprecyzowania" [Zobacz dostępne kolory]          │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│ MATERIAŁY I ILOŚCI                                              │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Materiał          │ Ilość  │ Jedn. │ Cena/jed │ Razem     │ │
│  │───────────────────────────────────────────────────────────│ │
│  │ Folia jednokolorowa│ 86.4  │ m²    │ 107 zł   │ 9,244 zł  │ │
│  │ Podkład zwykły     │ 86    │ m²    │ 12.50    │ 1,075 zł  │ │
│  │ Kątownik PVC       │ 24    │ mb    │ 8.00     │ 192 zł    │ │
│  │ Klej kontaktowy    │ 5     │ kg    │ 45.00    │ 225 zł    │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  ⚠️ Rozmiar basenu zmieniony - [Przelicz ponownie]              │
│                                                                 │
│                            RAZEM NETTO: 10,736 zł               │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4. Komponenty do utworzenia/modyfikacji

#### 4.1 SubtypeCard (nowy)
**Plik:** `src/components/finishing/components/SubtypeCard.tsx`

Karta podtypu z:
- Nazwa (Jednokolorowa/Z nadrukiem/Strukturalna)
- Etykieta wariantu (STANDARD/STANDARD PLUS/PREMIUM)
- Cena za m² z możliwością edycji
- Stan zaznaczenia

#### 4.2 FoilProductTable (nowy)
**Plik:** `src/components/finishing/components/FoilProductTable.tsx`

Tabela z:
- Kolumny: Symbol, Nazwa, Producent, Seria, Kolor (z kółkiem), Szerokość rolki, Cena
- Filtrowanie: dropdown producent, dropdown kolor, search nazwa
- Zaznaczanie wiersza = wybór konkretnego produktu
- Możliwość odznaczenia (powrót do "kolor do sprecyzowania")

#### 4.3 ColorGalleryModal (nowy)
**Plik:** `src/components/finishing/components/ColorGalleryModal.tsx`

Modal z galerią miniaturek folii danego podtypu:
- Grid zdjęć produktów z kolorowymi etykietami
- Do wydruku w ofercie PDF jako załącznik
- Generowanie obrazu/PDF z galerią

#### 4.4 MaterialsCalculationTable (modyfikacja)
**Plik:** `src/components/finishing/components/MaterialsTable.tsx`

Zmodyfikowana tabela materiałów:
- Materiały hardcoded w kodzie (nie z bazy)
- Automatyczne wyliczanie ilości na podstawie powierzchni
- Edycja ręczna z oznaczeniem "ręcznie zmienione"
- Przycisk "Przywróć automatyczne"

---

### 5. Logika wyliczania materiałów (w kodzie)

**Plik:** `src/lib/finishingMaterials.ts` (nowy)

```typescript
// Definicje materiałów (hardcoded)
export const FINISHING_MATERIALS = {
  foil: [
    {
      id: 'podklad-zwykly',
      name: 'Podkład pod folię',
      unit: 'm²',
      calculate: (poolAreas) => Math.ceil(poolAreas.totalArea * 1.1), // +10% zapas
      pricePerUnit: 12.50,
    },
    {
      id: 'katownik-pvc',
      name: 'Kątownik PVC',
      unit: 'mb',
      calculate: (poolAreas) => Math.ceil(poolAreas.perimeter),
      pricePerUnit: 8.00,
    },
    {
      id: 'klej-kontaktowy',
      name: 'Klej kontaktowy',
      unit: 'kg',
      calculate: (poolAreas) => Math.ceil(poolAreas.totalArea / 20), // 1kg na 20m²
      pricePerUnit: 45.00,
    },
    {
      id: 'nity-montazowe',
      name: 'Nity montażowe',
      unit: 'szt',
      calculate: (poolAreas) => Math.ceil(poolAreas.perimeter * 4), // 4 nity na mb
      pricePerUnit: 0.50,
    },
  ],
};
```

---

### 6. Ostrzeżenie o zmianie wymiarów

**Mechanizm:**
1. W `ConfiguratorContext` dodanie flagi `dimensionsChangedSinceFinishing`
2. Przy zmianie wymiarów po wypełnieniu kroku wykończenia - ustawienie flagi
3. W module wykończenia - wyświetlenie ostrzeżenia z przyciskiem "Przelicz ponownie"
4. Opcjonalnie: automatyczne przeliczenie przy powrocie do kroku

---

### 7. Integracja z ofertą PDF

**Zmiany:**
1. Pozycja w ofercie: 
   - Jeśli wybrano produkt: "Folia [nazwa produktu] - [symbol]"
   - Jeśli nie wybrano: "Folia jednokolorowa - kolor do sprecyzowania wg załącznika"
   
2. Załącznik PDF z galerią kolorów:
   - Grid miniaturek produktów danego podtypu
   - Nazwa i kolor każdego produktu

---

## Pliki do utworzenia

| Plik | Opis |
|------|------|
| `src/lib/finishingMaterials.ts` | Definicje materiałów i logika obliczeń |
| `src/components/finishing/components/SubtypeCard.tsx` | Karta podtypu folii |
| `src/components/finishing/components/FoilProductTable.tsx` | Tabela produktów z filtrami |
| `src/components/finishing/components/ColorGalleryModal.tsx` | Modal galerii kolorów |

## Pliki do modyfikacji

| Plik | Zakres zmian |
|------|--------------|
| `src/components/finishing/FinishingWizardContext.tsx` | Nowy uproszczony state |
| `src/components/finishing/FinishingModuleWizard.tsx` | Jednokrokowy layout |
| `src/components/finishing/components/MaterialsTable.tsx` | Obsługa hardcoded materiałów |
| `src/components/steps/DimensionsStep.tsx` | Usunięcie wyboru liningType |
| `src/context/ConfiguratorContext.tsx` | Flaga dimensionsChanged |

## Pliki do usunięcia

| Plik | Powód |
|------|-------|
| `src/components/finishing/steps/Step1TypeSelection.tsx` | Zintegrowane w głównym komponencie |
| `src/components/finishing/steps/Step2ProductFiltering.tsx` | Zastąpione FoilProductTable |
| `src/components/finishing/steps/Step3SelectionLevel.tsx` | Niepotrzebne |
| `src/components/finishing/steps/Step4FoilOptimization.tsx` | Uproszczone |
| `src/components/finishing/steps/Step6VariantGeneration.tsx` | Warianty = podtypy |
| `src/components/finishing/steps/Step7ReviewSave.tsx` | Zintegrowane |
| `src/components/finishing/FinishingWizardNavigation.tsx` | Jednokrokowy = bez nawigacji |

---

## Migracja bazy danych

```sql
-- Zamiana antyposlizgowa na strukturalna
UPDATE products 
SET foil_category = 'strukturalna' 
WHERE foil_category = 'antyposlizgowa';
```

---

## Szczegóły techniczne

### Domyślne ceny podtypów

```typescript
const DEFAULT_SUBTYPE_PRICES = {
  jednokolorowa: 107,  // Standard
  nadruk: 145,         // Standard Plus  
  strukturalna: 210,   // Premium
};
```

### Etykiety wariantów

```typescript
const VARIANT_LABELS = {
  jednokolorowa: 'STANDARD',
  nadruk: 'STANDARD PLUS',
  strukturalna: 'PREMIUM',
};
```

### Materiały hardcoded

Lista materiałów w kodzie (nie w bazie):
1. **Folia** - ilość = powierzchnia całkowita, cena = cena podtypu
2. **Podkład pod folię** - ilość = powierzchnia × 1.1, cena = 12.50 zł/m²
3. **Kątownik PVC** - ilość = obwód, cena = 8.00 zł/mb
4. **Klej kontaktowy** - ilość = powierzchnia / 20, cena = 45.00 zł/kg
5. **Nity montażowe** - ilość = obwód × 4, cena = 0.50 zł/szt

### Formuły obliczeniowe

```typescript
// Powierzchnia całkowita (dno + ściany)
totalArea = bottomArea + wallArea + stairsArea + wadingPoolArea

// Obwód
perimeter = 2 × (length + width) + stairsPerimeter + wadingPoolPerimeter

// Ilość folii w m²
foilQuantity = totalArea
```

---

## Przepływ użytkownika

1. **Wejście do kroku "Wykończenie"**
   - Wyświetlenie wyboru: Folia PVC / Ceramika

2. **Wybór "Folia PVC"**
   - Wyświetlenie 3 kart podtypów z cenami
   - Możliwość edycji ceny każdego podtypu

3. **Kliknięcie na podtyp (np. Jednokolorowa)**
   - Rozwinięcie tabeli folii tego podtypu
   - Filtry: producent, kolor, szukaj
   - Możliwość wyboru konkretnego produktu LUB pozostawienie "do sprecyzowania"

4. **Bez wyboru konkretnej folii**
   - Pozycja: "Folia jednokolorowa - kolor do sprecyzowania"
   - Przycisk "Zobacz dostępne kolory" → modal z galerią

5. **Sekcja "Materiały i ilości"**
   - Automatyczne wyliczenie na podstawie wymiarów
   - Możliwość ręcznej edycji każdej ilości
   - Ostrzeżenie przy zmianie wymiarów basenu

6. **Przejście do następnego kroku**
   - Zapisanie wyborów w stanie konfiguratora

---

## Szacowany nakład pracy

| Element | Czas |
|---------|------|
| Migracja bazy (antyposlizgowa → strukturalna) | 0.5h |
| Nowy state i context | 1h |
| SubtypeCard + główny layout | 1.5h |
| FoilProductTable z filtrami | 2h |
| MaterialsCalculationTable (hardcoded) | 1.5h |
| ColorGalleryModal | 1h |
| Usunięcie liningType z DimensionsStep | 0.5h |
| Ostrzeżenie o zmianie wymiarów | 0.5h |
| Integracja i testy | 1h |
| **SUMA** | **~9.5h** |
