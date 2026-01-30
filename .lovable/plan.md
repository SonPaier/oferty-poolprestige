
# Faza 10: Wizard Wykończenia - UI (US-3.1 do US-3.8) ✅ COMPLETED

## Status: ZREALIZOWANE

Zbudowano dedykowany 7-krokowy wizard dla modułu wykończenia basenu zastępujący CoveringStep.tsx.

## Utworzone pliki:
- `src/components/finishing/FinishingWizardContext.tsx` - Context + reducer
- `src/components/finishing/FinishingModuleWizard.tsx` - Główny kontener
- `src/components/finishing/FinishingWizardNavigation.tsx` - Nawigacja
- `src/components/finishing/steps/Step1TypeSelection.tsx` - Wybór folia/ceramika
- `src/components/finishing/steps/Step2ProductFiltering.tsx` - Filtrowanie
- `src/components/finishing/steps/Step3SelectionLevel.tsx` - Taby wyboru
- `src/components/finishing/steps/Step4FoilOptimization.tsx` - Optymalizacja
- `src/components/finishing/steps/Step5InstallationMaterials.tsx` - Materiały
- `src/components/finishing/steps/Step6VariantGeneration.tsx` - Warianty
- `src/components/finishing/steps/Step7ReviewSave.tsx` - Podsumowanie
- `src/components/finishing/components/*.tsx` - Komponenty współdzielone

---

## Architektura komponentów

```text
src/components/finishing/
├── FinishingModuleWizard.tsx       # Główny kontener z nawigacją i state
├── FinishingWizardContext.tsx      # Context dla state wizarda
├── FinishingWizardNavigation.tsx   # Breadcrumbs/stepper nawigacji
├── steps/
│   ├── Step1TypeSelection.tsx      # Wybór folia/ceramika
│   ├── Step2ProductFiltering.tsx   # Filtrowanie (podtyp, kolor)
│   ├── Step3SelectionLevel.tsx     # Taby: podtyp/seria/produkt
│   ├── Step4FoilOptimization.tsx   # Auto-optymalizacja folii + wizualizacja
│   ├── Step5InstallationMaterials.tsx  # Materiały instalacyjne
│   ├── Step6VariantGeneration.tsx  # Generowanie 3 wariantów
│   └── Step7ReviewSave.tsx         # Przegląd i zapis
├── components/
│   ├── ProductFilterBar.tsx        # Multi-select kolory, dropdown podtyp
│   ├── ProductGrid.tsx             # Grid produktów z miniaturkami
│   ├── ProductDetailModal.tsx      # Modal szczegółów produktu
│   ├── MaterialsTable.tsx          # Tabela materiałów z edycją
│   ├── MaterialEditModal.tsx       # Modal edycji ilości/materiału
│   ├── ServicesTable.tsx           # Tabela usług montażu
│   ├── VariantCard.tsx             # Karta wariantu (ekonomiczny/standard/premium)
│   └── OptimizationComparisonView.tsx  # Porównanie 1.65m vs 2.05m
└── hooks/
    ├── useFinishingWizard.ts       # Hook dla state wizarda
    ├── useInstallationMaterials.ts # Hook do pobierania i wyliczania materiałów
    └── useVariantGeneration.ts     # Hook do generowania wariantów
```

---

## Szczegółowy plan implementacji

### Krok 1: Struktura i Context (FinishingWizardContext.tsx)

**State wizarda:**
```typescript
interface FinishingWizardState {
  currentStep: number;
  finishingType: 'foil' | 'ceramic' | null;
  filters: {
    subtype: string | null;
    colors: string[];
    searchQuery: string;
  };
  selectionLevel: 'subtype' | 'series' | 'product';
  selectedSubtype: string | null;
  selectedSeries: { manufacturer: string; series: string } | null;
  selectedProductId: string | null;
  
  // Foil optimization
  optimizationResult: FoilOptimizationResult | null;
  selectedRollWidth: 1.65 | 2.05;
  
  // Materials
  materials: MaterialItem[];
  services: ServiceItem[];
  
  // Variants
  variants: {
    economy: VariantData;
    standard: VariantData;
    premium: VariantData;
  };
  defaultVariant: 'economy' | 'standard' | 'premium';
  
  isDraft: boolean;
  requiresRecalculation: boolean;
}
```

**Actions:**
- `SET_STEP` - zmiana kroku
- `SET_FINISHING_TYPE` - wybór folia/ceramika
- `SET_FILTERS` - aktualizacja filtrów
- `SET_SELECTION_LEVEL` - zmiana poziomu wyboru
- `SET_SELECTED_PRODUCT` / `SERIES` / `SUBTYPE`
- `SET_OPTIMIZATION_RESULT`
- `UPDATE_MATERIAL` / `ADD_MATERIAL` / `REMOVE_MATERIAL`
- `SET_VARIANTS`
- `SET_DEFAULT_VARIANT`
- `SAVE_AND_COMPLETE`

---

### Krok 2: Główny komponent wizarda (FinishingModuleWizard.tsx)

**Struktura:**
```tsx
export function FinishingModuleWizard() {
  return (
    <FinishingWizardProvider>
      <div className="finishing-wizard">
        <FinishingWizardNavigation />
        <div className="wizard-content">
          {/* Renderowanie aktualnego kroku */}
          <WizardStepRenderer />
        </div>
        <WizardFooter />
      </div>
    </FinishingWizardProvider>
  );
}
```

**Nawigacja (7 kroków):**
1. Typ wykończenia
2. Filtrowanie
3. Poziom wyboru
4. Optymalizacja (tylko folia)
5. Materiały
6. Warianty
7. Przegląd

---

### Krok 3: Step1TypeSelection.tsx

**UI:**
- 2 duże karty (folia/ceramika) z ikonami
- Info box pokazujący typ wybrany w parametrach basenu
- Ostrzeżenie przy zmianie typu

**Logika:**
```tsx
// Jeśli typ już wybrany w dimensions.liningType
const preselectedType = dimensions.liningType === 'foliowany' ? 'foil' : 'ceramic';

// Modal ostrzeżenia przy zmianie
if (currentType && newType !== currentType) {
  showWarningModal("Zmiana typu wykończenia wymaże dotychczasowe wybory...");
}
```

---

### Krok 4: Step2ProductFiltering.tsx

**UI:**
- Dropdown "Podtyp": Wszystkie / Jednolite / Z nadrukiem / Strukturalne
- Multi-select "Kolory" z kolorowymi kółkami
- Live search input
- Grid produktów (3-4 na rząd)
- Licznik wyników

**Integracja z bazą:**
```sql
SELECT * FROM products
WHERE category = 'folia'
  AND (subtype IS NULL OR subtype = $1)
  AND (shade = ANY($2::text[]) OR $2 IS NULL)
ORDER BY price ASC
```

---

### Krok 5: Step3SelectionLevel.tsx

**3 taby:**

1. **Tab "Podtyp"**:
   - Kafelki: Jednolite, Z nadrukiem, Strukturalne
   - Zakres cen, liczba produktów
   - Info: "Cena w ofercie: MAX z podtypu"

2. **Tab "Seria"**:
   - Accordion per producent (Renolit, Haogenplast)
   - Dla każdej serii: zdjęcie, zakres cen

3. **Tab "Produkt"**:
   - Reużycie ProductGrid z kroku 2
   - Modal szczegółów przy wyborze

---

### Krok 6: Step4FoilOptimization.tsx

**Auto-trigger:** Po wejściu uruchamia algorytm optymalizacji

**UI:**
- Loading: "Optymalizuję rozkład folii..."
- Wyniki: liczba rolek, powierzchnia, zgrzewy, score
- Wizualizacja 2D (reużycie FoilLayoutVisualization)
- Porównanie 1.65m vs 2.05m (jeśli dostępne)
- Szczegóły planu cięcia (modal)

**Folia strukturalna:**
- Info box o zgrzewaniu doczołowym
- Dodatkowe pozycje (folia podkładowa, usługa zgrzewania)

---

### Krok 7: Step5InstallationMaterials.tsx

**Tabela materiałów:**
| Materiał | Ilość | Jednostka | Cena jedn. | Razem | Akcje |
|----------|-------|-----------|------------|-------|-------|
| Podkład zwykły 2m | 86 | m² | 12.50 | 1075 | Edytuj/Zmień |

**Auto-wyliczanie z calculation_rule:**
```typescript
function calculateMaterialQuantity(
  material: InstallationMaterial,
  poolAreas: CalculatedAreas
): number {
  const rule = material.calculation_rule;
  switch (rule.type) {
    case 'area_coverage':
      return Math.ceil(poolAreas.total_area * rule.waste_factor);
    case 'perimeter':
      return Math.ceil(poolAreas.perimeter / rule.unit_length) * rule.unit_length;
    case 'per_area':
      return Math.ceil((poolAreas.total_area / 100) * rule.kg_per_100m2);
    // ...
  }
}
```

**Usługi montażu:**
- Auto-dobierane z installation_services
- Podział: standardowy + schody + brodzik

---

### Krok 8: Step6VariantGeneration.tsx

**3 kolumny:**
- Ekonomiczny: najtańsza folia + podkład zwykły
- Standard: średnia cena + podkład zwykły
- Premium: strukturalna + podkład impregnowany

**Logika generowania:**
```typescript
function generateVariants(
  selectionLevel: 'subtype' | 'series' | 'product',
  materials: MaterialItem[],
  services: ServiceItem[]
): Variants {
  // Dla podtypu: wybierz 3 produkty (min/mid/max cena)
  // Dla serii: warianty z różnych serii
  // Dla produktu: ten sam produkt, różne materiały
}
```

**UI:**
- Badge "DOMYŚLNY" na wybranym wariancie
- Przycisk "Edytuj wariant" → modal
- Porównanie cen z kolorami (zielony=taniej, czerwony=drożej)

---

### Krok 9: Step7ReviewSave.tsx

**Podsumowanie:**
- Typ wykończenia
- Wybrany produkt/seria/podtyp
- Optymalizacja folii (jeśli folia)
- Lista materiałów i usług
- 3 warianty z cenami
- Wariant domyślny

**Akcje:**
- "Zapisz jako draft"
- "Zapisz i kontynuuj" → zapisuje do offer_variants i przechodzi do następnego modułu

---

## Integracja z CoveringStep

**Opcja 1 (zalecana):** Zastąpienie CoveringStep nowym wizardem
```tsx
// W steps/CoveringStep.tsx
export function CoveringStep(props: CoveringStepProps) {
  return <FinishingModuleWizard {...props} />;
}
```

**Opcja 2:** Zachowanie CoveringStep jako wrapper
```tsx
// CoveringStep importuje i renderuje FinishingModuleWizard
```

---

## Hooki pomocnicze

### useInstallationMaterials.ts
```typescript
function useInstallationMaterials(finishingType: 'foil' | 'ceramic', poolAreas: CalculatedAreas) {
  // Pobiera materiały z tabeli installation_materials
  // Wylicza ilości na podstawie calculation_rule
  // Zwraca materiały z auto-wyliczonymi ilościami
}
```

### useVariantGeneration.ts
```typescript
function useVariantGeneration(
  selectionLevel: SelectionLevel,
  selectedItem: Product | Series | Subtype,
  materials: MaterialItem[],
  services: ServiceItem[]
) {
  // Generuje 3 warianty cenowe
  // Dla każdego wariantu: dobiera materiały odpowiedniego poziomu
}
```

---

## Pliki do utworzenia

| Plik | Opis |
|------|------|
| `src/components/finishing/FinishingWizardContext.tsx` | Context + reducer |
| `src/components/finishing/FinishingModuleWizard.tsx` | Główny kontener |
| `src/components/finishing/FinishingWizardNavigation.tsx` | Nawigacja breadcrumbs |
| `src/components/finishing/steps/Step1TypeSelection.tsx` | Krok 1 |
| `src/components/finishing/steps/Step2ProductFiltering.tsx` | Krok 2 |
| `src/components/finishing/steps/Step3SelectionLevel.tsx` | Krok 3 |
| `src/components/finishing/steps/Step4FoilOptimization.tsx` | Krok 4 |
| `src/components/finishing/steps/Step5InstallationMaterials.tsx` | Krok 5 |
| `src/components/finishing/steps/Step6VariantGeneration.tsx` | Krok 6 |
| `src/components/finishing/steps/Step7ReviewSave.tsx` | Krok 7 |
| `src/components/finishing/components/ProductFilterBar.tsx` | Filtry |
| `src/components/finishing/components/ProductGrid.tsx` | Grid produktów |
| `src/components/finishing/components/MaterialsTable.tsx` | Tabela materiałów |
| `src/components/finishing/components/VariantCard.tsx` | Karta wariantu |
| `src/components/finishing/hooks/useInstallationMaterials.ts` | Hook materiałów |
| `src/components/finishing/hooks/useVariantGeneration.ts` | Hook wariantów |

---

## Kolejność implementacji

1. **FinishingWizardContext.tsx** - state management
2. **FinishingModuleWizard.tsx** + **FinishingWizardNavigation.tsx** - struktura
3. **Step1TypeSelection.tsx** - prosty start
4. **ProductFilterBar.tsx** + **ProductGrid.tsx** - komponenty współdzielone
5. **Step2ProductFiltering.tsx** - filtrowanie
6. **Step3SelectionLevel.tsx** - taby wyboru
7. **Step4FoilOptimization.tsx** - reużycie istniejącej logiki
8. **useInstallationMaterials.ts** + **MaterialsTable.tsx**
9. **Step5InstallationMaterials.tsx**
10. **useVariantGeneration.ts** + **VariantCard.tsx**
11. **Step6VariantGeneration.tsx**
12. **Step7ReviewSave.tsx**
13. Integracja z CoveringStep

---

## Szacowany nakład

| Element | Czas |
|---------|------|
| Context + struktura | 1h |
| Krok 1-3 (wybór produktu) | 2h |
| Krok 4 (optymalizacja) | 1.5h |
| Krok 5 (materiały) | 2h |
| Krok 6 (warianty) | 2h |
| Krok 7 (przegląd) | 1h |
| Integracja + testy | 1h |
| **SUMA** | **~10-11h** |

---

## Uwagi techniczne

1. **Reużycie istniejącego kodu:**
   - `FoilLayoutVisualization` - wizualizacja 2D
   - `planStairsSurface`, `planPaddlingPoolSurface` - algorytmy
   - `ProductCard` - karty produktów

2. **Responsywność:**
   - Mobile: kroki w pionie, karty wariantów stackowane
   - Desktop: 3 kolumny dla wariantów, grid 4 produktów

3. **Persistencja:**
   - SessionStorage dla draftu
   - Zapis do offer_variants przy zakończeniu

4. **Walidacja:**
   - Każdy krok ma własną walidację przed przejściem dalej
   - Disabled "Dalej" gdy brak wymaganego wyboru
