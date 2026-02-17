
# Plan: Optymalizacja doboru folii na sciany

## Problemy do rozwiazania

### Problem 1: Nierownomierny podzial pasow scian (tryb minWaste)
Obecne scoring w `selectOptimalWallPlan` (minWaste) faworyzuje rownomierne pasy (np. 15.1m + 15.1m) przez kare za "imbalance". Ale podzial 15.0m + 15.2m bylby lepszy, bo pas 15.0m miesci sie w resztce z rolki dna (25m - 10m = 15m), co eliminuje potrzebe osobnej rolki na sciane.

**Przyczyna**: `actualRollsNeeded` w scoring liczy tylko rolki scianowe (bez uwzglednienia resztek z dna). `pairedLeftover` istnieje, ale ma zbyt niski priorytet (`*100`).

**Rozwiazanie**: Zastapic `actualRollsNeeded` (z lokalnego pakowania scian) metoda `calculateAdditionalWallOrderedArea`, ktora juz poprawnie uwzglednia konsumpcje resztek z rolek dna. Uzyc jej jako glownego kryterium w minWaste - mniej dodatkowej zamawianej powierzchni = mniej rolek do kupienia.

### Problem 2: minRolls niepotrzebnie zwieksza zuzycie folii
Przelaczenie na minRolls nie zmniejsza ilosci rolek (nadal 4), ale zwieksza powierzchnie folii (109 -> 112 m2) przez uzycie folii 2.05m na scianie zamiast 1.65m.

**Przyczyna**: Wall optimizer dla minRolls wybiera plan z 4 pasami (w tym 2.05m), bo `additionalOrderedArea` moze wychodzic nizsza dla tego planu (pas 5m miesci sie w resztce z dna). Jednak calosciowo to nie obniza ilosci rolek.

**Rozwiazanie**: Dodac guardrail na poziomie koncowej konfiguracji - jesli minRolls daje tyle samo lub wiecej rolek niz minWaste ORAZ wieksza powierzchnie folii, to uzyj wyniku minWaste.

## Szczegoly techniczne

### Plik: `src/lib/foil/wallStripOptimizer.ts`

**Zmiana 1: Scoring minWaste - uwzglednienie resztek z dna**

W funkcji `selectOptimalWallPlan`, dla `priority === 'minWaste'`:
- Zamiast `actualRollsNeeded * 100_000_000` uzyc `additionalWallOrderedArea * 1_000_000` jako glowne kryterium
- To sprawia, ze plany gdzie pasy scian mieszcza sie w restkach z rolek dna sa silnie preferowane
- Nastepnie `totalFoilArea` (minimalizacja calkowitej powierzchni folii scianowej)
- Potem `totalStripCount` (mniej pasow = mniej spoin)
- Na koncu `imbalance` jako tie-break

**Zmiana 2: Scoring minRolls - silniejsza kara za szerokosc**

Upewnic sie, ze `widthWaste` jest wystarczajaco silny, aby zapobiec uzyciu 2.05m gdy 1.65m wystarcza i daje te sama ilosc rolek.

### Plik: `src/lib/foil/mixPlanner.ts`

**Zmiana 3: Guardrail w `autoOptimizeMixConfig` lub `calculateSurfaceDetails`**

Dodac logike porownawcza: po wygenerowaniu konfiguracji w trybie minRolls, porownac z minWaste:
- Jesli minRolls daje `totalRolls >= minWaste.totalRolls` ORAZ `totalFoilArea > minWaste.totalFoilArea` -> uzyj minWaste
- Ta logika powinna byc w funkcji `packStripsIntoRolls` lub w warstwie wyzej (np. `calculateSurfaceDetails`)

Alternatywnie, guardrail mozna dodac bezposrednio w `getOptimalWallStripPlan`: po wybraniu optymalnego planu dla minRolls, porownac go z najlepszym planem minWaste - jesli minRolls nie daje lepszego wyniku, zwrocic plan minWaste.

### Zmiana w scoring (pseudo-kod)

```text
// BEFORE (minWaste):
score = actualRollsNeeded * 100_000_000
      + wasteSignificance
      + totalStripCount * 10_000
      + imbalance * 1_000
      + pairedLeftover * 100
      + totalFoilArea * 0.01

// AFTER (minWaste):
additionalArea = calculateAdditionalWallOrderedArea(strips, bottomStrips)
score = additionalArea * 1_000_000       // Primary: minimize new rolls needed for walls
      + plan.totalFoilArea * 10_000      // Secondary: minimize total wall foil area
      + plan.totalStripCount * 1_000     // Tertiary: fewer welds
      + wasteArea * 100                  // Less waste
      + imbalance * 10                   // Balanced splits as tie-break only
```

### Guardrail (pseudo-kod)

```text
// In getOptimalWallStripPlan or higher:
if (priority === 'minRolls') {
  const minRollsPlan = selectOptimalWallPlan(plans, 'minRolls', ...)
  const minWastePlan = selectOptimalWallPlan(plans, 'minWaste', ...)
  
  if (minRollsPlan.totalFoilArea > minWastePlan.totalFoilArea 
      && minRollsPlan does not reduce actual total rolls) {
    return minWastePlan  // minRolls is worse, fallback
  }
}
```

## Kolejnosc implementacji

1. Zmiana scoring w `selectOptimalWallPlan` (minWaste) - uzycie `calculateAdditionalWallOrderedArea`
2. Dodanie guardrail w `getOptimalWallStripPlan` (minRolls fallback)
3. Weryfikacja z testem `packStripsIntoRolls.test.ts` - upewnienie sie ze istniejacy test nadal przechodzi
