
# Plan: Naprawa optymalizatora ścian + inteligentny rozkład zakładów

## Cel
Naprawić algorytm optymalizacji pasów ścian, aby:
1. Tryb **Min. odpad** wybierał 2 ciągłe pasy (15m + 15.2m) zamiast 3-4
2. Tryb **Min. rolek** używał 4 pasów z mieszanymi szerokościami (1.65×5, 2.05×5, 1.65×10.2, 1.65×10.2)
3. Zakłady były przypisywane do **tańszych** pasów (1.65m zamiast 2.05m)

---

## Zmiany w pliku `src/lib/foil/wallStripOptimizer.ts`

### Zmiana 1: Naprawienie generatora partycji (linie 113-185)

**Problem:** Funkcja `generateWallPartitions` ma błąd w logice "wrap around" - nie generuje prawidłowej partycji 2-pasowej [[0,1], [2,3]] dla basenu prostokątnego.

**Rozwiązanie:** Uprościć generator do generowania wszystkich ciągłych podziałów:

```typescript
function generateWallPartitions(wallCount: number): number[][][] {
  const partitions: number[][][] = [];
  
  // 1 grupa: wszystkie ściany razem
  partitions.push([Array.from({ length: wallCount }, (_, i) => i)]);
  
  // 4 grupy: każda ściana osobno
  partitions.push(Array.from({ length: wallCount }, (_, i) => [i]));
  
  // 2 grupy: wszystkie możliwe podziały na dwie ciągłe części
  for (let splitPoint = 1; splitPoint < wallCount; splitPoint++) {
    const group1 = Array.from({ length: splitPoint }, (_, i) => i);
    const group2 = Array.from({ length: wallCount - splitPoint }, (_, i) => i + splitPoint);
    partitions.push([group1, group2]);
  }
  
  // 3 grupy: wszystkie możliwe podziały na trzy ciągłe części
  for (let split1 = 1; split1 < wallCount - 1; split1++) {
    for (let split2 = split1 + 1; split2 < wallCount; split2++) {
      const group1 = Array.from({ length: split1 }, (_, i) => i);
      const group2 = Array.from({ length: split2 - split1 }, (_, i) => i + split1);
      const group3 = Array.from({ length: wallCount - split2 }, (_, i) => i + split2);
      partitions.push([group1, group2, group3]);
    }
  }
  
  return partitions;
}
```

### Zmiana 2: Poprawka rozkładu zakładów (linie 213-290)

**Problem:** Zakłady są przypisywane do najkrótszych pasów, co jest błędne.

**Nowa logika:**
1. Dla każdego łączenia między sąsiednimi pasami przypisz zakład do **jednego** pasa
2. Kryteria wyboru:
   - Jeśli pasy mają **różne szerokości** → zakład do **węższego** (1.65m tańszy niż 2.05m)
   - Jeśli pasy mają **tę samą szerokość** → zakład do **dłuższego** (i tak potrzebuje własnej rolki)

```typescript
function distributeVerticalOverlap(
  strips: Array<{ wallIndices: number[]; baseLength: number; rollWidth: RollWidth }>,
  totalOverlap: number,
  bottomStrips: BottomStripInfo[],
  availableWidths: RollWidth[]
): number[] {
  const stripCount = strips.length;
  if (stripCount === 0) return [];
  if (stripCount === 1) return [totalOverlap];
  
  const overlapsPerStrip = new Array(stripCount).fill(0);
  const overlapPerJoin = DEFAULT_VERTICAL_JOIN_OVERLAP; // 0.1m
  
  // Dla każdego łączenia (cyklicznie)
  for (let i = 0; i < stripCount; i++) {
    const idx1 = i;
    const idx2 = (i + 1) % stripCount;
    
    const strip1 = strips[idx1];
    const strip2 = strips[idx2];
    
    // Przypisz zakład do tańszego pasa (węższa rolka = tańsza)
    // Przy równych szerokościach - do dłuższego pasa
    let targetIdx: number;
    
    if (strip1.rollWidth !== strip2.rollWidth) {
      // Różne szerokości - zakład do węższego (tańszego)
      targetIdx = strip1.rollWidth < strip2.rollWidth ? idx1 : idx2;
    } else {
      // Ta sama szerokość - zakład do dłuższego
      targetIdx = strip1.baseLength >= strip2.baseLength ? idx1 : idx2;
    }
    
    overlapsPerStrip[targetIdx] += overlapPerJoin;
  }
  
  return overlapsPerStrip;
}
```

### Zmiana 3: Poprawka scoringu (linie 491-521)

**Problem:** Scoring nie rozróżnia poprawnie konfiguracji gdy odpad = 0.

```typescript
export function selectOptimalWallPlan(
  plans: WallStripPlan[],
  priority: OptimizationPriority
): WallStripPlan | null {
  if (plans.length === 0) return null;
  
  const scoredPlans = plans.map(plan => {
    let score: number;
    
    if (priority === 'minWaste') {
      // 1. Minimalizuj odpad
      // 2. Minimalizuj liczbę pasów (= mniej rolek)
      // 3. Mniejsza powierzchnia folii
      score = plan.wasteArea * 100000 
            + plan.totalStripCount * 1000 
            + plan.totalFoilArea * 0.01;
    } else {
      // minRolls:
      // 1. Minimalizuj całkowite m² folii
      // 2. Minimalizuj odpad
      // 3. Mniej pasów = prostsza instalacja
      score = plan.totalFoilArea * 1000 
            + plan.wasteArea * 10 
            + plan.totalStripCount;
    }
    
    return { ...plan, score };
  });
  
  scoredPlans.sort((a, b) => a.score - b.score);
  return scoredPlans[0];
}
```

---

## Weryfikacja dla basenu 10×5×1.5m

### Tryb Min. odpad

| Ściana | Szerokość | Długość | Zakład |
|--------|-----------|---------|--------|
| A-B-C | 1.65m | 15.0m | 0 |
| C-D-A | 1.65m | 15.2m | 0.2m (2 zakłady) |

Razem: 2 pasy, 2 rolki

### Tryb Min. rolek

| Ściana | Szerokość | Długość | Zakład |
|--------|-----------|---------|--------|
| A-B | 1.65m | 10.2m | 0.2m (2 zakłady) |
| B-C | 2.05m | 5.0m | 0 (droższy pas) |
| C-D | 1.65m | 10.2m | 0.2m (2 zakłady) |
| D-A | 1.65m | 5.0m | 0 |

Razem: 4 pasy z mieszanymi szerokościami, parowane z resztkami z dna

---

## Sekcja techniczna

### Szczegóły implementacji

1. **Generator partycji** - uproszczony do iteracyjnego tworzenia podziałów bez rekursji
2. **Rozkład zakładów** - nowa funkcja uwzględnia zarówno szerokość rolki jak i długość pasa
3. **Scoring** - wyraźniejsze wagi dla różnych kryteriów

### Pliki do zmiany

| Plik | Funkcja | Zmiana |
|------|---------|--------|
| `src/lib/foil/wallStripOptimizer.ts` | `generateWallPartitions` | Uproszczenie generatora |
| `src/lib/foil/wallStripOptimizer.ts` | `distributeVerticalOverlap` | Nowa logika zakładów |
| `src/lib/foil/wallStripOptimizer.ts` | `selectOptimalWallPlan` | Poprawka scoringu |
| `src/lib/foil/wallStripOptimizer.ts` | `buildWallStripPlan` | Przekazanie rollWidth do distributeVerticalOverlap |
