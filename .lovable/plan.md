
# Faza 7: Aktualizacja Wizualizacji 2D/3D Układu Folii o Schody i Brodzik

## Stan obecny

### Komponent FoilLayoutVisualization.tsx
Istnieje komponent `FoilLayoutVisualization.tsx`, który:
- Generuje wizualizację SVG układu pasów folii
- Pokazuje 3 typy powierzchni: dno basenu, ściana boczna (długa), ściana czołowa (krótka)
- Wyświetla pasy folii z zakładkami (overlap) jako przerywane linie
- **NIE jest nigdzie zaimportowany ani używany w aplikacji**

### Problem
1. Komponent nie uwzględnia schodów ani brodzika
2. Komponent nie jest zintegrowany z dialogiem "Szczegóły kalkulacji" w CoveringStep
3. Brak wizualizacji dla powierzchni antypoślizgowych vs regularnych

---

## Cel Fazy 7

1. **Rozszerzyć FoilLayoutVisualization** o nowe powierzchnie:
   - Stopnie schodów (poziome) - oznaczone jako antypoślizgowe
   - Podstopnie schodów (pionowe) - regularna folia
   - Dno brodzika - antypoślizgowe
   - Ściany brodzika (3 strony) - regularna folia
   - Murek rozdzielający (3 powierzchnie) - regularna folia

2. **Zintegrować wizualizację** z dialogiem szczegółów w CoveringStep

3. **Dodać oznaczenia kolorystyczne** dla typów folii (regularna vs antypoślizgowa)

---

## Zmiany do wprowadzenia

### Plik 1: src/components/FoilLayoutVisualization.tsx

#### Rozszerzenie interfejsu props
```typescript
interface FoilLayoutVisualizationProps {
  dimensions: PoolDimensions;
  rollWidth: number;
  label: string;
  // Nowe pola:
  stairsPlan?: StairsPlanResult;
  paddlingPlan?: PaddlingPlanResult;
  showAntiSlipIndicators?: boolean;
}
```

#### Nowe typy powierzchni w layouts
```typescript
// Aktualne:
- 'Dno basenu'
- 'Ściana boczna'
- 'Ściana czołowa'

// Nowe do dodania:
- 'Schody - stopnie (antypoślizgowa)' [jeśli stairs.enabled]
- 'Schody - podstopnie' [jeśli stairs.enabled]
- 'Brodzik - dno (antypoślizgowa)' [jeśli wadingPool.enabled]
- 'Brodzik - ściany zewnętrzne' [jeśli wadingPool.enabled]
- 'Murek rozdzielający' [jeśli hasDividingWall]
```

#### Oznaczenia kolorystyczne
- Powierzchnie antypoślizgowe: obramowanie pomarańczowe + badge 🟧
- Powierzchnie regularne: standardowe niebieskie + badge 🟦

### Plik 2: src/components/steps/CoveringStep.tsx

#### Import i użycie FoilLayoutVisualization
```typescript
import { FoilLayoutVisualization } from '@/components/FoilLayoutVisualization';
```

#### Lokalizacja: Sekcja 5 lub 6 w dialogu szczegółów
Po sekcji "5. Układ pasów" dodać nową sekcję:
```text
6. Wizualizacja układu folii
   ┌────────────────────────────────────────────┐
   │ [FoilLayoutVisualization component]        │
   │   - Dno basenu + pasy                      │
   │   - Ściany                                 │
   │   - Schody (jeśli enabled)                 │
   │   - Brodzik (jeśli enabled)                │
   └────────────────────────────────────────────┘
```

---

## Szczegółowy Layout Wizualizacji

### Dla schodów prostokątnych
```text
┌─────────────────────────────────────────────┐
│  Schody - stopnie (antypoślizgowa)          │
│  ┌─────────────────────────────────────┐    │
│  │ ╔══════════════════════════════════╗│ 1.5m │
│  │ ║ Stopień 1  ║ Stopień 2 ║ ... ║   ║│(width)│
│  │ ╚══════════════════════════════════╝│    │
│  └─────────────────────────────────────┘    │
│  Wymiary: 0.30m × 1.5m × 5 stopni = 2.25 m² │
│  [🟧 Powierzchnia antypoślizgowa]            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Schody - podstopnie                        │
│  ┌───────────────────────────────┐          │
│  │ Podstopień (pion)            ││ 0.20m   │
│  │ × 5 sztuk × 1.5m szer.       ││ (height)│
│  └───────────────────────────────┘          │
│  Wymiary: 0.20m × 1.5m × 5 = 1.50 m²        │
│  [🟦 Folia regularna]                        │
└─────────────────────────────────────────────┘
```

### Dla brodzika
```text
┌─────────────────────────────────────────────┐
│  Brodzik - dno (antypoślizgowa)             │
│  ┌─────────────────────────────────────┐    │
│  │ ┌───────────────────────────────┐   │    │
│  │ │   Dno brodzika               │   │ 1.5m │
│  │ │   2.0m × 1.5m = 3.0 m²       │   │    │
│  │ └───────────────────────────────┘   │    │
│  └─────────────────────────────────────┘    │
│  [🟧 Powierzchnia antypoślizgowa]            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Brodzik - ściany zewnętrzne (3 strony)     │
│  ┌───────────────────────────────────┐      │
│  │ 2 × boczne: 1.5m × 0.4m = 1.20 m²│      │
│  │ 1 × tylna:  2.0m × 0.4m = 0.80 m²│      │
│  │ Razem: 2.00 m²                    │      │
│  └───────────────────────────────────────┘  │
│  [🟦 Folia regularna]                        │
└─────────────────────────────────────────────┘
```

### Dla murka rozdzielającego
```text
┌─────────────────────────────────────────────┐
│  Murek rozdzielający                        │
│  ┌───────────────────────────────────┐      │
│  │ Strona basenu:  2.0m × 1.0m = 2.0 m² │   │
│  │ Strona brodzika: 2.0m × 0.2m = 0.4 m²│   │
│  │ Góra murka: 2.0m × 0.15m = 0.3 m²    │   │
│  │ Razem: 2.70 m²                        │   │
│  └───────────────────────────────────────┘  │
│  [🟦 Folia regularna]                        │
└─────────────────────────────────────────────┘
```

---

## Implementacja techniczna

### Modyfikacja FoilLayoutVisualization.tsx

1. **Rozszerzenie useMemo `layouts`**:
   - Dodanie warunkowego renderowania powierzchni schodów gdy `stairsPlan` istnieje
   - Dodanie warunkowego renderowania powierzchni brodzika gdy `paddlingPlan` istnieje

2. **Nowa funkcja `getSurfaceColor`**:
```typescript
function getSurfaceColor(surfaceType: string, isAntiSlip: boolean) {
  if (isAntiSlip) {
    return 'hsl(30 95% 50% / 0.4)'; // Pomarańczowy dla antypoślizgowych
  }
  return 'hsl(var(--primary) / 0.4)'; // Niebieski dla regularnych
}
```

3. **Badge dla typu powierzchni**:
   - Dodanie indykatora 🟧/🟦 przy każdej powierzchni
   - Dodanie tooltipa z informacją o typie folii

### Integracja w CoveringStep.tsx

1. **Import komponentu**:
```typescript
import { FoilLayoutVisualization } from '@/components/FoilLayoutVisualization';
```

2. **Dodanie sekcji w dialogu** (po sekcji 5 - układ pasów):
```tsx
{/* Section 6: Visual layout */}
<div className="border-t pt-4">
  <h4 className="font-semibold mb-2">6. Wizualizacja układu</h4>
  <FoilLayoutVisualization
    dimensions={dimensions}
    rollWidth={1.65}
    label="Układ pasów folii"
    stairsPlan={stairsPlan}
    paddlingPlan={paddlingPlan}
    showAntiSlipIndicators
  />
</div>
```

---

## Legenda kolorów (w komponencie)

```text
┌─────────────────────────────────────────┐
│ Legenda:                                │
│ ▓▓▓ Folia główna (jednokolorowa/nadruk) │
│ ▓▓▓ Folia antypoślizgowa                │
│ --- Zakładka spawu (overlap)            │
│ ═══ Zgrzew doczołowy (butt joint)       │
└─────────────────────────────────────────┘
```

---

## Podsumowanie zmian

| Plik | Zmiany |
|------|--------|
| `FoilLayoutVisualization.tsx` | Rozszerzenie o schody i brodzik, oznaczenia antypoślizgowe |
| `CoveringStep.tsx` | Import i integracja wizualizacji w dialogu szczegółów |
| `.lovable/plan.md` | Aktualizacja statusu Fazy 7 |

---

## Oczekiwany wynik

Po tej fazie:
1. Dialog "Szczegóły kalkulacji" będzie zawierał wizualną reprezentację wszystkich powierzchni
2. Użytkownik zobaczy graficznie jak pasy folii są układane na każdej powierzchni
3. Powierzchnie antypoślizgowe (stopnie, dno brodzika) będą wyraźnie oznaczone pomarańczowym kolorem
4. Murek rozdzielający i jego 3 powierzchnie będą widoczne na diagramie
