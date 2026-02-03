
# Plan: Przebudowa zakładki "Podsumowanie rolek" z etykietami ścian

## Cel
Przebudowa zakładki z:
1. Podsumowaniem rolek (bez zmian)
2. Tabelą szczegółową z rozpiskę pasów i etykietami ścian (A-B, B-C-D)
3. Tabelą odpadu do ponownego wykorzystania (pogrupowane na rolki)
4. Przełącznikiem priorytetu optymalizacji (odpad vs ilość rolek)

## Kluczowa zmiana: Etykiety ścian zamiast "długie/krótkie"

Zamiast podziału na "Ściany długie (2x)" i "Ściany krótkie (2x)", używam:
- Jedna pozycja "Ściany" z rozpisą pasów
- Każdy pas ma oznaczenie ścian: "A-B", "B-C", lub "A-B-C" (gdy pokrywa wiele ścian)
- Dla basenów nieregularnych - działa automatycznie z dowolną liczbą ścian

## Struktura nowej tabeli

```text
| Miejsce      | Rozpiska pasów                  | Pow. do pokrycia | Pow. folii (pokrycie + zgrzew + odpad) |
|--------------|---------------------------------|------------------|----------------------------------------|
| Dno          | 2× pas 2.05m × 8.0m (rolka #1)  | 32.0 m²          | 33 m² (32.0 + 0.8 + 0.2)               |
| Ściany       | 1× pas 1.65m × 19.0m (A-B-C-D)  | 26.6 m²          | 32 m² (...)                            |
|              | 1× pas 1.65m × 5.0m (A-B)       |                  |                                        |
| Schody       | 1× pas 1.65m × 2.5m             | 3.75 m²          | 4 m² (...)                             |
```

---

## Szczegóły techniczne

### 1. Nowy typ `OptimizationPriority` w `mixPlanner.ts`

```typescript
export type OptimizationPriority = 'minWaste' | 'minRolls';
```

### 2. Zmiana modelu powierzchni ścian

Zamiast `wall-long` i `wall-short`:
```typescript
export type SurfaceKey = 'bottom' | 'walls' | 'stairs' | 'paddling' | 'dividing-wall';

interface WallStripAssignment {
  stripIndex: number;
  rollWidth: RollWidth;
  stripLength: number;
  wallLabels: string[]; // np. ['A-B'], ['B-C', 'C-D'], ['A-B-C-D']
}
```

### 3. Nowy interfejs dla szczegółowej rozpiski

```typescript
interface SurfaceDetailedResult {
  surfaceKey: SurfaceKey;
  surfaceLabel: string;
  strips: Array<{
    count: number;
    rollWidth: RollWidth;
    stripLength: number;
    rollNumber?: number; // z której rolki
    wallLabels?: string[]; // tylko dla ścian: A-B, B-C itd.
  }>;
  coverArea: number;       // powierzchnia netto do pokrycia
  totalFoilArea: number;   // pełna pow. folii (zaokrąglona w górę)
  weldArea: number;        // zakład/zgrzew
  wasteArea: number;       // odpad nieużyteczny
}
```

### 4. Interfejs dla odpadu do ponownego wykorzystania

```typescript
interface ReusableOffcut {
  rollNumber: number;
  rollWidth: RollWidth;
  length: number;  // długość odpadu (m)
  area: number;    // powierzchnia (m²)
}
```

### 5. Logika przypisywania pasów do ścian

Dla basenu prostokątnego (4 ściany):
- Obwód: 2×(L+W), głębokość: D+0.15 (fold at bottom)
- Pasy mogą pokrywać ściany w różnych kombinacjach zależnie od ich długości

Przykład 8×4m, głębokość 1.5m:
- Obwód: 24m
- Pas 25m pokrywa cały obwód: "A-B-C-D-A" (z powrotem)
- Lub 2 pasy po 12m: "A-B-C" i "C-D-A"

Funkcja `assignWallLabelsToStrips()`:
```typescript
function assignWallLabelsToStrips(
  dimensions: PoolDimensions,
  strips: StripInfo[]
): WallStripAssignment[] {
  // Pobierz listę ścian z ich długościami
  const walls = getWallSegments(dimensions);
  // walls = [{ label: 'A-B', length: 8 }, { label: 'B-C', length: 4 }, ...]
  
  // Przypisz pasy do ścian sekwencyjnie
  // ...
}
```

### 6. Funkcja `getWallSegments()` dla różnych kształtów

```typescript
function getWallSegments(dimensions: PoolDimensions): WallSegment[] {
  if (dimensions.shape === 'nieregularny' && dimensions.customVertices) {
    // Użyj customVertices i getWallLabel() z configurator.ts
    return dimensions.customVertices.map((_, i) => ({
      label: getWallLabel(i, dimensions.customVertices!.length),
      length: calculateEdgeLength(i, dimensions.customVertices!)
    }));
  }
  
  // Prostokąt: 4 ściany (A-B, B-C, C-D, D-A)
  return [
    { label: 'A-B', length: dimensions.length },
    { label: 'B-C', length: dimensions.width },
    { label: 'C-D', length: dimensions.length },
    { label: 'D-A', length: dimensions.width },
  ];
}
```

---

## Zmiany w plikach

### `src/lib/foil/mixPlanner.ts`

1. Dodaj typ `OptimizationPriority`
2. Zmień `SurfaceKey` - usuń `wall-long`/`wall-short`, dodaj `walls`
3. Nowa funkcja `getWallSegments(dimensions)` - zwraca listę ścian z etykietami
4. Nowa funkcja `assignWallLabelsToStrips()` - przypisuje pasy do ścian
5. Nowa funkcja `calculateSurfaceDetails()` - zwraca pełne dane per powierzchnię
6. Nowa funkcja `getReusableOffcuts()` - lista odpadów do ponownego użycia
7. Modyfikacja `autoOptimizeMixConfig()` - dodaj parametr `priority`
8. Rozszerz interfejsy o nowe pola

### `src/components/finishing/components/RollSummary.tsx`

Przebudowa komponentu:

1. Import `Switch`, `Table` i nowych typów
2. Props: dodaj `optimizationPriority`, `onPriorityChange`, `dimensions`
3. Nowy subkomponent `StripDetailsTable` - tabela z rozpiską pasów
4. Nowy subkomponent `ReusableOffcutsTable` - tabela odpadu
5. Przełącznik priorytetu w nagłówku

### `src/components/finishing/components/CalculationDetailsDialog.tsx`

1. Dodaj state dla `optimizationPriority`
2. Przekaż nowe propsy do `RollSummary`
3. Przekaż `dimensions` do `RollSummary`

---

## Wizualizacja struktury

```text
┌──────────────────────────────────────────────────────────────────────┐
│  📦 Podsumowanie rolek              [Min. odpad] ○──● [Min. rolek]   │
├──────────────────────────────────────────────────────────────────────┤
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                               │
│  │ 2× 1.65m│  │ 1× 2.05m│  │ 3 rolek │  (istniejąca sekcja)          │
│  │  × 25m  │  │  × 25m  │  │  razem  │                               │
│  └─────────┘  └─────────┘  └─────────┘                               │
├──────────────────────────────────────────────────────────────────────┤
│  TABELA: Szczegółowa rozpiska pasów                                  │
│  ┌──────────┬─────────────────────────────┬──────────┬──────────────┐│
│  │ Miejsce  │ Rozpiska pasów              │ Pokrycie │ Pow. folii   ││
│  ├──────────┼─────────────────────────────┼──────────┼──────────────┤│
│  │ Dno      │ 2× pas 2.05m × 8.0m (#1)    │ 32 m²    │ 33 m²        ││
│  │          │                             │          │(32+0.8+0.2)  ││
│  ├──────────┼─────────────────────────────┼──────────┼──────────────┤│
│  │ Ściany   │ 1× pas 1.65m × 20.0m (A-B-C)│ 28 m²    │ 32 m²        ││
│  │          │ 1× pas 1.65m × 4.0m (D-A)   │          │              ││
│  ├──────────┼─────────────────────────────┼──────────┼──────────────┤│
│  │ Schody   │ 1× pas 1.65m × 2.5m         │ 3.75 m²  │ 4 m²         ││
│  └──────────┴─────────────────────────────┴──────────┴──────────────┘│
├──────────────────────────────────────────────────────────────────────┤
│  TABELA: Odpad do ponownego wykorzystania                            │
│  ┌────────────────┬────────────────┬─────────────┐                   │
│  │ Rolka          │ Wymiar         │ Powierzchnia│                   │
│  ├────────────────┼────────────────┼─────────────┤                   │
│  │ #1 (1.65m)     │ 3.5m × 1.65m   │ 5.78 m²     │                   │
│  │ #2 (2.05m)     │ 2.0m × 2.05m   │ 4.10 m²     │                   │
│  └────────────────┴────────────────┴─────────────┘                   │
│  (jeśli brak odpadu do wykorzystania: "Brak odpadu do ponownego...)  │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Logika przełącznika priorytetu

**Minimalny odpad (domyślnie):**
- Istniejąca logika - wybór szerokości rolki minimalizującej odpad
- Sortowanie: najpierw mniej odpadu, potem mniej rolek

**Minimalna ilość rolek:**
- Preferuje szersze rolki (2.05m) gdy obie opcje dają podobny wynik
- Grupuje pasy tak aby wypełnić rolki maksymalnie
- Sortowanie: najpierw mniej rolek, potem mniej odpadu

---

## Obsługa basenów nieregularnych

Dla `shape === 'nieregularny'`:
- Funkcja `getWallSegments()` używa `customVertices` i `getWallLabel()` z `configurator.ts`
- Generuje etykiety np. A-B, B-C, C-D, D-E, E-F, F-A dla 6-kątnego basenu
- Logika przypisywania pasów działa identycznie - sekwencyjnie przez obwód

---

## Podsumowanie zmian

| Plik | Rodzaj zmiany |
|------|---------------|
| `src/lib/foil/mixPlanner.ts` | Nowe typy, funkcje, zmiana modelu ścian |
| `src/components/finishing/components/RollSummary.tsx` | Przebudowa UI, nowe tabele, przełącznik |
| `src/components/finishing/components/CalculationDetailsDialog.tsx` | Stan priorytetu, przekazanie propów |
| `src/types/configurator.ts` | Bez zmian - już ma `getWallLabel()` |
