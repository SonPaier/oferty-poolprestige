

# Plan: Naprawa kalkulacji ścian z optymalizacją cross-surface rolek

## Podsumowanie zmian

Ten plan obejmuje trzy kluczowe poprawki:
1. **Poprawne zakłady na ścianach** (pionowe i poziome)
2. **Elastyczny zakład pionowy** (0.2m może być na jednym pasie zamiast 0.1m + 0.1m)
3. **Cross-surface roll optimization** (resztka z dna może być użyta na ścianę)

---

## 1. Poprawna kalkulacja zakładów na ścianach

### Zakład poziomy (góra/dół)
```
nadmiar = szerokość_folii - głębokość_basenu
zakład_na_stronę = nadmiar / 2
```

| Zakład na stronę | Działanie |
|------------------|-----------|
| 5-10 cm | OK - zakład (weld area) |
| > 10 cm | Max 10cm zakład, reszta = odpad |
| < 5 cm | Min 5cm zakład |

**Przykład (basen 10×5×1.5m):**
- Folia 1.65m, głębokość 1.5m
- Nadmiar = 0.15m → 7.5cm góra + 7.5cm dół ✓

### Zakład pionowy (łączenia pasów)
- Zakład 0.1m na każde łączenie pasów
- Przy 2 pasach = 2 łączenia (A→C i C→A) = 0.2m × 1.65m = 0.33m²

---

## 2. Elastyczny zakład pionowy - przypisanie do jednego pasa

### Problem
Aktualnie: Pas 1 = 15.1m, Pas 2 = 15.1m (każdy +0.1m)
Ale: Czasem lepiej zrobić Pas 1 = 15m, Pas 2 = 15.2m (całe 0.2m na jednym pasie)

### Kiedy to jest lepsze?
Gdy resztka z innej rolki (np. dno) może pokryć jeden pas ściany:
- Rolka dna: 25m - 10m (dno) = **15m resztki**
- Jeśli pas ściany = 15m (bez zakładu) → wykorzystujemy resztkę
- Drugi pas = 15.2m (z całym zakładem 0.2m) → z nowej rolki

### Logika
```typescript
// Opcja A: równy podział zakładu
const option1 = { strip1: perimeter/2 + 0.1, strip2: perimeter/2 + 0.1 };

// Opcja B: cały zakład na jednym pasie
const option2 = { strip1: perimeter/2, strip2: perimeter/2 + 0.2 };

// Wybierz opcję z mniejszym zużyciem rolek
```

---

## 3. Cross-surface roll optimization

### Cel
Wykorzystanie resztek z rolek dna na ściany (jeśli ta sama szerokość folii).

### Przykład dla basenu 10×5×1.5m

**BEZ optymalizacji:**
- Dno: 3 pasy × 10m = 30m → 2 rolki (używamy 30m z 50m)
- Ściany: 2 pasy × 15.1m = 30.2m → 2 rolki
- **RAZEM: 4 rolki, ~45m odpadu**

**Z optymalizacją:**
- Dno: 3 pasy × 10m = 30m → 2 rolki (resztka z drugiej rolki = 15m)
- Ściany: Pas 1 = 15m (z resztki dna), Pas 2 = 15.2m (z nowej rolki)
- **RAZEM: 3 rolki, ~20m odpadu**

### Warunek
Optymalizacja możliwa tylko gdy:
- Szerokość folii na dno = szerokość folii na ściany (np. obie 1.65m)
- Resztka z rolki ≥ długość pasa ściany

---

## Szczegóły techniczne

### Plik: `src/lib/foil/mixPlanner.ts`

#### A. Nowe stałe
```typescript
const DEPTH_THRESHOLD_FOR_WIDE = 1.55; // Próg dla folii 2.05m na ściany
const MIN_HORIZONTAL_OVERLAP = 0.05;   // 5cm min zakład góra/dół
const MAX_HORIZONTAL_OVERLAP = 0.10;   // 10cm max zakład góra/dół
```

#### B. Nowa funkcja: `calculateWallOverlaps()`
```typescript
function calculateWallOverlaps(
  rollWidth: RollWidth,
  depth: number,
  perimeter: number,
  totalFoilLength: number
): { horizontalWeldArea: number; wasteArea: number } {
  const overhang = rollWidth - depth;
  const overlapPerSide = overhang / 2;
  
  let actualOverlap: number;
  let edgeWaste: number;
  
  if (overlapPerSide >= MIN_HORIZONTAL_OVERLAP && overlapPerSide <= MAX_HORIZONTAL_OVERLAP) {
    actualOverlap = overlapPerSide;
    edgeWaste = 0;
  } else if (overlapPerSide > MAX_HORIZONTAL_OVERLAP) {
    actualOverlap = MAX_HORIZONTAL_OVERLAP;
    edgeWaste = overlapPerSide - MAX_HORIZONTAL_OVERLAP;
  } else {
    actualOverlap = MIN_HORIZONTAL_OVERLAP;
    edgeWaste = 0;
  }
  
  const horizontalWeldArea = actualOverlap * 2 * totalFoilLength;
  const wasteArea = edgeWaste * 2 * totalFoilLength;
  
  return { horizontalWeldArea, wasteArea };
}
```

#### C. Nowa funkcja: `optimizeStripLengthsWithRemainder()`
```typescript
interface StripOptimizationResult {
  stripLengths: number[];
  totalLength: number;
  rollsUsed: { rollNumber: number; usedLength: number }[];
  canReuseFromBottom?: boolean;
}

function optimizeStripLengthsWithRemainder(
  perimeter: number,
  joinOverlap: number,
  bottomRemainder: number | null, // Resztka z rolki dna
  bottomRollWidth: RollWidth | null,
  wallRollWidth: RollWidth
): StripOptimizationResult {
  const stripCount = Math.ceil((perimeter + joinOverlap) / ROLL_LENGTH);
  
  if (stripCount === 1) {
    return {
      stripLengths: [perimeter + joinOverlap],
      totalLength: perimeter + joinOverlap,
      rollsUsed: [{ rollNumber: 1, usedLength: perimeter + joinOverlap }],
    };
  }
  
  // Sprawdź czy można wykorzystać resztkę z dna
  const canReuseFromBottom = 
    bottomRemainder !== null &&
    bottomRollWidth === wallRollWidth &&
    bottomRemainder >= perimeter / stripCount;
  
  if (canReuseFromBottom && stripCount === 2) {
    // Opcja: Pas 1 = resztka (bez zakładu), Pas 2 = reszta + cały zakład
    const strip1Length = Math.min(bottomRemainder!, perimeter / 2);
    const strip2Length = perimeter - strip1Length + joinOverlap * 2;
    
    return {
      stripLengths: [strip1Length, strip2Length],
      totalLength: strip1Length + strip2Length,
      rollsUsed: [
        { rollNumber: 0, usedLength: strip1Length }, // 0 = reuse
        { rollNumber: 1, usedLength: strip2Length },
      ],
      canReuseFromBottom: true,
    };
  }
  
  // Domyślnie: równy podział
  const baseLength = perimeter / stripCount;
  const stripLengths = Array(stripCount).fill(0).map((_, i) => 
    i === 0 ? baseLength + joinOverlap : baseLength + joinOverlap
  );
  
  return {
    stripLengths,
    totalLength: stripLengths.reduce((a, b) => a + b, 0),
    rollsUsed: stripLengths.map((len, i) => ({ rollNumber: i + 1, usedLength: len })),
  };
}
```

#### D. Aktualizacja `calculateSurfaceDetails()` dla ścian (~linie 782-935)

1. Zmiana progu głębokości: `1.50m → 1.55m`
2. Nowa logika zakładów poziomych (góra/dół)
3. Wykorzystanie `optimizeStripLengthsWithRemainder()` dla optymalizacji rolek
4. Poprawne etykiety narożników (A-B-C i C-D-A)

#### E. Aktualizacja `packStripsIntoRolls()` 
Dodanie obsługi cross-surface packing (dno + ściany na tej samej rolce).

---

## Weryfikacja dla basenu 10×5×1.5m

| Parametr | Wartość |
|----------|---------|
| Obwód | 30m |
| Głębokość | 1.5m |
| Szerokość folii ściany | 1.65m (bo 1.5m ≤ 1.55m) |
| Nadmiar | 0.15m |
| **Zakład góra/dół** | 7.5cm + 7.5cm |
| Liczba pasów | 2 |
| **Opcja równy podział** | 15.1m + 15.1m |
| **Opcja z resztką dna** | 15m (resztka) + 15.2m (nowa) |
| **Zakład pionowy** | 2 × 0.1m × 1.65m = 0.33m² |
| **Zakład poziomy** | 0.15m × 30.2m = 4.53m² |
| **RAZEM zakład** | ~4.86m² |
| Powierzchnia folii | ~50m² |
| Oznaczenie | **A-B-C** i **C-D-A** |

---

## Kolejność implementacji

1. Dodać nowe stałe `DEPTH_THRESHOLD_FOR_WIDE`, `MIN_HORIZONTAL_OVERLAP`, `MAX_HORIZONTAL_OVERLAP`
2. Zaimplementować `calculateWallOverlaps()` 
3. Zaimplementować `optimizeStripLengthsWithRemainder()`
4. Zaktualizować `calculateSurfaceDetails()` dla sekcji ścian
5. Zaktualizować `packStripsIntoRolls()` dla cross-surface optimization
6. Naprawić logikę etykiet narożników (A-B-C, C-D-A)

