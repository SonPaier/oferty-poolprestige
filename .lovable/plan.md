
# Plan: Elastyczna optymalizacja rozkładu pasów folii

## Cel
Przebudować logikę optymalizacji folii tak, aby algorytm **dynamicznie wybierał optymalną liczbę pasów** (1, 2, 3, 4 lub więcej) zamiast sztywno zakładać 2 lub 4. Zakład pionowy ma być rozdzielany nierówno między pasy, gdy to poprawia wykorzystanie rolek.

---

## Analiza problemu

### Obecny stan (błędny)
Plik `src/lib/foil/mixPlanner.ts` obecnie:
- **minWaste**: Sztywno używa 2 ciągłych pasów wokół obwodu (funkcja `computeWallStripPlanFromPerimeter`)
- **minRolls**: Sztywno używa 4 osobnych pasów (po jednym na ścianę)

### Wymagany stan
Dla obu trybów algorytm powinien:
1. Wygenerować wszystkie sensowne konfiguracje pasów (od 1 do n pasów)
2. Dla każdej konfiguracji obliczyć:
   - Łączny m² folii do zamówienia (brutto)
   - Odpad nieużytkowy (m²)
   - Liczbę rolek
3. Wybrać najlepszą konfigurację według priorytetu:
   - **minWaste**: minimalizuj odpad
   - **minRolls**: minimalizuj m² do zamówienia (mniej rolek × szerokość × 25m)

---

## Rozwiązanie techniczne

### 1. Nowa struktura danych dla konfiguracji ścian

Zmiana podejścia z "2 lub 4 pasów" na generyczną reprezentację:

```typescript
interface WallStripPlan {
  strips: Array<{
    wallLabels: string[];      // np. ['A-B'] lub ['A-B-C']
    length: number;            // długość pasa wraz z zakładem
    rollWidth: RollWidth;      // 1.65 lub 2.05
  }>;
  totalVerticalOverlap: number; // suma zakładów pionowych
  totalFoilArea: number;        // suma pasów × szerokość
  wasteArea: number;            // odpad nieużytkowy
}
```

### 2. Generator wszystkich konfiguracji pasów ścian

Nowa funkcja `generateWallStripConfigurations()`:

```typescript
function generateWallStripConfigurations(
  walls: WallSegment[],             // 4 ściany: A-B, B-C, C-D, D-A
  depth: number,
  availableWidths: RollWidth[],     // [1.65] lub [1.65, 2.05]
  bottomStrips: BottomStripInfo[]   // do parowania rolek
): WallStripPlan[] {
  const configs: WallStripPlan[] = [];
  const perimeter = walls.reduce((s, w) => s + w.length, 0);
  
  // Generuj konfiguracje od 1 do max pasów
  // Max pasów = liczba ścian (4 dla prostokąta)
  // Możliwe podziały:
  // - 1 pas: cały obwód (jeśli <= 25m)
  // - 2 pasy: różne podziały (połowa + połowa, lub A-B + B-C-D-A)
  // - 3 pasy: np. A-B, B-C-D, D-A
  // - 4 pasy: osobno każda ściana
  
  // Dla każdego podziału:
  // - przydziel szerokości (1.65/2.05) na podstawie głębokości i parowania
  // - rozdystrybuuj zakład pionowy nierówno (żeby lepiej domykać rolki)
  
  return configs;
}
```

### 3. Nierówny rozkład zakładu pionowego

Zamiast stałego +0.10m na każdy pas:

```typescript
function distributeVerticalOverlap(
  strips: StripInfo[],
  totalOverlap: number,         // np. 0.40m dla 4 pasów
  bottomOffcuts: OffcutInfo[]   // pozostałości z dna do parowania
): StripInfo[] {
  // Strategia: przydziel więcej zakładu do pasów, które mogą
  // lepiej wykorzystać pozostałość z rolki
  // 
  // Przykład dla 10×5 (obwód 30m):
  // - pas 1: 10.0m (ściana A-B)
  // - pas 2: 5.2m  (ściana B-C z całym zakładem)
  // - pas 3: 10.0m (ściana C-D)
  // - pas 4: 5.2m  (ściana D-A z całym zakładem)
  // 
  // Lub inny rozkład: 10.2, 5.0, 10.2, 5.0
  
  return stripsWithOptimalOverlap;
}
```

### 4. Funkcja wyboru optymalnej konfiguracji

```typescript
function selectOptimalWallConfig(
  configs: WallStripPlan[],
  priority: OptimizationPriority
): WallStripPlan {
  if (priority === 'minWaste') {
    // Sortuj po wasteArea rosnąco, potem po liczbie pasów rosnąco
    configs.sort((a, b) => {
      const wasteDiff = a.wasteArea - b.wasteArea;
      if (Math.abs(wasteDiff) > 0.1) return wasteDiff;
      return a.strips.length - b.strips.length;
    });
  } else {
    // minRolls: sortuj po totalFoilArea rosnąco (mniej m² = mniej rolek)
    configs.sort((a, b) => {
      const areaDiff = a.totalFoilArea - b.totalFoilArea;
      if (Math.abs(areaDiff) > 0.1) return areaDiff;
      return a.strips.length - b.strips.length;
    });
  }
  
  return configs[0];
}
```

### 5. Integracja z istniejącymi funkcjami

Zmiany w następujących funkcjach:
- `autoOptimizeMixConfig()` - używa nowego generatora konfiguracji
- `calculateSurfaceDetails()` - wyświetla wybrany rozkład pasów
- `packStripsIntoRolls()` - pakuje pasy według wybranej konfiguracji

---

## Zmiany w plikach

### src/lib/foil/mixPlanner.ts

1. **Nowe funkcje** (~100 linii):
   - `generateWallStripConfigurations()`
   - `distributeVerticalOverlap()`
   - `selectOptimalWallConfig()`

2. **Modyfikacja `calculateSurfaceDetails()`** (~50 linii):
   - Usunięcie warunkowego `if (priority === 'minRolls') ... else ...`
   - Użycie jednej ścieżki z dynamicznym wyborem konfiguracji

3. **Modyfikacja `packStripsIntoRolls()`** (~30 linii):
   - Analogiczne usunięcie warunkowej logiki
   - Użycie wybranej konfiguracji

4. **Modyfikacja `autoOptimizeMixConfig()`** (~20 linii):
   - Generowanie konfiguracji ścian za pomocą nowej funkcji

---

## Przypadki testowe

### Basen 10×5×1.5m (obwód 30m)

**Konfiguracje do porównania:**
| # pasów | Rozkład | Szerokości | m² folii | Odpad |
|---------|---------|------------|----------|-------|
| 2 | 15+15.2 | 1.65+1.65 | 49.83 | ~2m² |
| 4 | 10+5+10+5 | 1.65×4 | ~50m² | ~1.5m² |
| 4 | 10+5+10+5 | 1.65+2.05+1.65+1.65 | ~52m² | mniej |
| 3 | ... | ... | ... | ... |

**Oczekiwany wynik dla minRolls:**
- Dno: 2.05×10 + 1.65×10 + 1.65×10 (3 pasy)
- Ściany: 1.65×5 + 2.05×5.1 + 1.65×10.2 + 1.65×10.2 (4 pasy)
- Rolki: 1× 2.05m + 2× 1.65m = 3 rolki

**Oczekiwany wynik dla minWaste:**
- Dno: najbardziej optymalny podział minimalizujący odpad
- Ściany: liczba pasów zależna od tego, co daje mniej odpadu

---

## Harmonogram implementacji

1. **Krok 1**: Refaktor generatora konfiguracji ścian
2. **Krok 2**: Implementacja nierównego rozkładu zakładu
3. **Krok 3**: Aktualizacja `calculateSurfaceDetails` i `packStripsIntoRolls`
4. **Krok 4**: Testy dla basenu 10×5×1.5m i weryfikacja UI

---

## Ryzyka i mitygacje

| Ryzyko | Mitygacja |
|--------|-----------|
| Duża liczba kombinacji do sprawdzenia | Ograniczenie max pasów do liczby ścian + inteligentne przycinanie |
| Regresja w istniejących obliczeniach | Zachowanie testów porównawczych przed/po refaktorze |
| Złożoność kodu | Dokumentacja i komentarze wyjaśniające logikę optymalizacji |
