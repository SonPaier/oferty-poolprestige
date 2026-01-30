
# Plan Wdrożenia: Moduł Wykończenia (Folia/Ceramika) - v2

## Aktualizacja na podstawie feedbacku

### Punkt 1.1 - Folia antypoślizgowa
- Każda folia strukturalna (Touch, Relief, Ceramics, Pearl, Alive) jest automatycznie antypoślizgowa
- Usunięte kolumny `is_anti_slip` i `anti_slip_price_diff` z planu migracji
- Logika: `foil_category === 'strukturalna'` = antypoślizgowa (bez dodatkowej flagi)

### Punkt 1.2 - Istniejące materiały w bazie
Po analizie bazy danych, następujące materiały instalacyjne **już istnieją** i nie będą duplikowane:

| Kategoria | Produkty w bazie |
|-----------|------------------|
| **Podkłady** | `Podkład włóknina 400g/m2`, `Podkład włóknina 500g/m2`, `Włóknina impregnowana 1.5m/2m`, `Geowłóknina antybakteryjna 1.5m/2m` |
| **Profile** | `Kątownik PCW wewnętrzny 2m`, `Kątownik stalowy Tebas 2x5cm`, `Kątownik stalowy 3x6cm`, `Płaskownik PCW 2m` |
| **Klej** | `Klej do podkładu 5kg-20kg`, `Klej Alkorplus Contact/Thermo 5kg` |
| **Folia specjalna** | `Folia podkład pod Touch/Ceramics` (dla folii strukturalnych) |

**Brakujące materiały** (do ewentualnego importu):
- Nity aluminiowe (opakowania)
- Folia w płynie (litry)

---

## Zrewidowana Faza 1: Rozszerzenie struktury danych

### 1.1 Migracja tabeli `products` (uproszczona)
Dodanie tylko niezbędnych kolumn do folii:

| Kolumna | Typ | Opis |
|---------|-----|------|
| `manufacturer` | TEXT | Producent (np. "Renolit", "ELBE") |
| `series` | TEXT | Seria (np. "Alkorplan 2000", "Touch") - można wypełnić z `subcategory` |
| `available_widths` | JSONB | Dostępne szerokości `[1.65, 2.05]` |
| `roll_length` | DECIMAL | Długość rolki (25m) |
| `joint_type` | TEXT | `'overlap'` / `'butt'` (dla strukturalnych) |
| `overlap_width` | DECIMAL | Szerokość zakładu (0.07m) |

**Usunięte z planu** (zgodnie z feedbackiem):
- ~~is_anti_slip~~ - każda strukturalna = antypoślizgowa
- ~~anti_slip_price_diff~~ - to osobny produkt, nie wariant

### 1.2 Tabela `installation_materials` - mapowanie do istniejących produktów
Zamiast duplikować produkty, utworzymy tabelę mapującą istniejące produkty do reguł obliczania:

```text
Struktura tabeli installation_materials:
+---------------------+-------------+----------------------------------------+
| Pole                | Typ         | Opis                                   |
+---------------------+-------------+----------------------------------------+
| id                  | UUID PK     | Identyfikator                          |
| product_id          | UUID FK     | Referencja do products.id              |
| finishing_type      | TEXT        | 'foil' / 'ceramic'                     |
| material_category   | TEXT        | 'substrate', 'profile', 'glue', 'rivet'|
| calculation_rule    | JSONB       | Reguły auto-wyliczania                 |
| is_default          | BOOLEAN     | Czy domyślny dla wariantu standard     |
| variant_level       | TEXT        | 'economy' / 'standard' / 'premium'     |
| is_optional         | BOOLEAN     | Czy opcjonalny do odznaczenia          |
| sort_order          | INTEGER     | Kolejność wyświetlania                 |
+---------------------+-------------+----------------------------------------+
```

**Przykładowe mapowania:**

| Materiał w bazie | product_id | material_category | variant_level | Reguła |
|------------------|------------|-------------------|---------------|--------|
| Podkład włóknina 400g | (uuid) | substrate | economy | area_coverage: bottom+walls |
| Podkład włóknina 500g | (uuid) | substrate | standard | area_coverage: bottom+walls |
| Włóknina impregnowana 2m | (uuid) | substrate | premium | area_coverage: bottom+walls |
| Kątownik stalowy 2x5cm | (uuid) | profile | standard | perimeter: pool+stairs |
| Płaskownik PCW 2m | (uuid) | profile | standard | perimeter: pool |
| Klej do podkładu 10kg | (uuid) | glue | standard | per_area: 1kg/6.6m² |

### 1.3 Tabela `installation_services` (bez zmian)
Usługi montażu z cenami za m²:

| Usługa | Typ | Stawka |
|--------|-----|--------|
| Montaż folii - standardowy | foil | 45 zł/m² |
| Montaż folii - schody | foil | 60 zł/m² |
| Zgrzewanie doczołowe | foil | 15 zł/mb |
| Montaż ceramiki - standardowy | ceramic | 80 zł/m² |

### 1.4 Logika antypoślizgowej folii (w kodzie, nie w bazie)

```typescript
// W algorytmie optymalizacji:
const isAntiSlip = (product: Product): boolean => {
  return product.foil_category === 'strukturalna';
};

// Automatyczne przypisanie na schody i brodzik:
const getAntiSlipFoilForStairs = (selectedProduct: Product, allProducts: Product[]): Product | null => {
  if (isAntiSlip(selectedProduct)) {
    return selectedProduct; // strukturalna = OK na schody
  }
  // Dla folii niestrukturalnej - szukaj Relief w tym samym kolorze
  const colorMatch = selectedProduct.shade;
  return allProducts.find(p => 
    p.subcategory === 'Relief' && p.shade === colorMatch
  ) || null;
};
```

---

## Faza 2: Algorytm optymalizacji (bez zmian)

### 2.1 Rozszerzenie `foilPlanner.ts`
- `planStairs()` - rozkład folii na schodach
- `planPaddling()` - rozkład folii w brodziku
- `scoreCuttingPlan()` - punktacja planów
- Logika automatycznego doboru folii strukturalnej na schody

### 2.2 Obsługa folii strukturalnej
- Wykrywanie `foil_category === 'strukturalna'`
- Zgrzewanie doczołowe (bez zakładów na dnie)
- Dodatkowe materiały: folia podkładowa (product symbol: 069978)

---

## Faza 3: UI (bez zmian koncepcyjnych)

### 3.1 Wizard wewnętrzny w CoveringStep

```text
CoveringStep.tsx (rozbudowany)
├── [Tab 1] Wybór typu          
├── [Tab 2] Filtrowanie (podtyp + kolor)
├── [Tab 3] Wybór produktu (podtyp/seria/konkretny)
├── [Tab 4] Optymalizacja + wizualizacja 2D
├── [Tab 5] Materiały instalacyjne (auto-dobrane z bazy)
├── [Tab 6] Warianty cenowe (3 kolumny)
└── [Tab 7] Podsumowanie
```

### 3.2 Auto-wyliczanie materiałów
Hook `useMaterialCalculation` będzie:
1. Pobierał mapowania z `installation_materials` 
2. Szukał odpowiednich produktów w `products` po `product_id`
3. Aplikował reguły `calculation_rule` na podstawie powierzchni basenu

---

## Kolejność implementacji (zaktualizowana)

```text
Etap 1 (baza danych):
  1. Migracja products (manufacturer, series, widths, joint_type)
  2. Tabela installation_materials z FK do products
  3. Seed: mapowanie istniejących produktów do reguł
  4. Tabela installation_services + seed
  5. Rozszerzenie offers.finishing_variant

Etap 2 (algorytm):
  6. Logika isAntiSlip() w foilPlanner
  7. Funkcje planStairs(), planPaddling()
  8. Auto-dobór folii strukturalnej na schody

Etap 3 (UI):
  9-15. Jak w poprzednim planie
```

---

## Szczegóły techniczne

### Reguły calculation_rule (przykłady JSONB):

```json
// Podkład - pokrycie powierzchni
{
  "type": "area_coverage",
  "applies_to": ["bottom", "walls", "stairs"],
  "product_width": 2.0,
  "waste_factor": 1.05
}

// Profile - obwód
{
  "type": "perimeter",
  "locations": ["pool_edge", "stairs_edge"],
  "unit_length": 2.0,
  "round_up": true
}

// Klej - na powierzchnię podkładu
{
  "type": "per_area",
  "base": "substrate_area",
  "kg_per_100m2": 15,
  "package_sizes": [5, 7, 10, 15, 20]
}

// Nity - na długość profili
{
  "type": "per_length",
  "base": "profile_length",
  "pcs_per_meter": 4,
  "package_size": 100
}
```

### Mapowanie wariantów do produktów:

| Wariant | Podkład | Profil | Folia |
|---------|---------|--------|-------|
| Ekonomiczny | 400g/m² zwykły | Kątownik PCW | Najtańsza z podtypu |
| Standard | 500g/m² zwykły | Kątownik stalowy | Średnia cena |
| Premium | Impregnowany 2m | Kątownik stalowy | Najdroższa strukturalna |

---

## Poza zakresem (bez zmian)
- Osobna tabela na wyniki optymalizacji (w sesji)
- Historia zmian oferty
- Komentarze klienta

