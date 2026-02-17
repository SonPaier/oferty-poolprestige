

# Plan: Optymalizacja doboru folii na sciany (rewizja)

## Analiza problemu

Przetestowałem algorytm na basenie 10x5x1.5m z dnem 1x2.05 + 2x1.65 (każdy pas 10m).

### Problem 1: minWaste daje 15.1+15.1 zamiast 15+15.2

**Przyczyna**: Dla partycji 2-pasowej [A-B+B-C, C-D+D-A] (obie grupy = 15m), funkcja `distributeVerticalOverlap` przypisuje zakłady symetrycznie (oba pasy 15m sa rowne, wiec `>=` rozdziela po rowno). Wynik: 15.1+15.1.

**Dlaczego 15+15.2 jest lepsze**: Przy BFD packing calosciowym (dno+sciany razem):
- 15+15.2: pas 15m + dno 10m = 25m (pelna rolka!), pas 15.2m na nowej rolce (offcut 9.8m), drugie dno na osobnej rolce (offcut 15m) = **jedna rolka bez odpadu**
- 15.1+15.1: zaden pas sciany nie miesci sie z dnem na jednej rolce (15.1+10=25.1 > 25m), wiec dwa osobne rolki na sciany + jedna na oba dna = **zadna rolka w pelni wykorzystana**

Obie opcje daja 4 rolki, ale 15+15.2 daje lepsza jakosc odpadow (15m offcut = dokladnie na dno do przyszlego uzycia).

**Rozwiazanie**: Zamiast jednej dystrybucji zakladow, generowac **warianty rozkladu zakladow** (symetryczny + asymetryczne). Dla kazdego wariantu oceniac plan. Dodac do scoringu **pelne BFD packing** (dno + sciany razem) zeby ocenic ile rolek jest w pelni wykorzystanych.

### Problem 2: minRolls daje 4 rolki zamiast 3

**Oczekiwany wynik uzytkownika dla minRolls (3 rolki)**:
- Rolka 1 (2.05): dno 10m + sciana 5.1m = 15.1m (offcut 9.9m)
- Rolka 2 (1.65): 2x dno 10m + sciana 5m = 25m (pelna!)
- Rolka 3 (1.65): sciana 20.2m (offcut 4.8m)

**Przyczyna**: Optimizer generuje juz 3-pasowe partycje z mieszanymi szerokosciami, ale scoring nie korzysta z pelnego BFD. Takze rozklad zakladow jest deterministyczny i moze nie dawac optymalnych dlugosci pasow.

**Rozwiazanie**: Ten sam - pelne BFD packing w scoringu automatycznie preferuje plany dajace 3 rolki nad planami dajacymi 4.

## Zmiany techniczne

### Plik: `src/lib/foil/wallStripOptimizer.ts`

#### Zmiana 1: Generowanie wariantow zakladow

Nowa funkcja `generateOverlapVariants` zastepuje pojedyncze wywolanie `distributeVerticalOverlap`. Dla kazdej partycji/szerokosc:
- Wariant domyslny (obecna logika)
- Warianty asymetryczne: przesuniecie calego zakladu jednego joina na jeden pas (np. [0, 0.2] zamiast [0.1, 0.1] dla 2 pasow)
- Walidacja: kazdy wariant musi dawac strip.totalLength <= 25m i overlap >= MIN_VERTICAL_JOIN_OVERLAP na join

Dla 2 pasow: generuje do 3 wariantow (rowny, calkowity-do-pasa1, calkowity-do-pasa2).
Dla 3+ pasow: generuje domyslny + kilka permutacji przesuniec zakladow.

#### Zmiana 2: `buildWallStripPlan` - przyjmuje gotowe overlaps

Zamiast wyliczac overlaps wewnatrz, przyjmuje je jako parametr (wygenerowane wczesniej). `generateWallStripConfigurations` iteruje po wariantach overlap.

#### Zmiana 3: Scoring - pelne BFD packing

W `selectOptimalWallPlan`, dla kazdego planu:
1. Polacz pasy dna i sciany w jedna liste
2. Uruchom uproszczone BFD (per szerokosc) zeby obliczyc:
   - `totalPhysicalRolls` - ile rolek faktycznie trzeba zamowic
   - `fullyUsedRolls` - ile rolek jest w pelni wykorzystanych (waste < 0.5m)
   - `maxOffcutLength` - dlugosc najwiekszego odpadu

**Scoring minWaste**:
```text
score = totalPhysicalRolls * 10_000_000    // 1. Minimalizuj calkowita liczbe rolek
      + plan.totalFoilArea * 100_000        // 2. Minimalizuj powierzchnie folii scianowej
      + plan.totalStripCount * 10_000       // 3. Mniej spoin
      - fullyUsedRolls * 5_000              // 4. Preferuj pelne rolki (lepsze offcuty)
      + widthWaste * 1_000                  // 5. Unikaj szerszych rolek gdy niepotrzebne
```

**Scoring minRolls**:
```text
score = totalPhysicalRolls * 10_000_000    // 1. Minimalizuj calkowita liczbe rolek
      + widthWaste * 1_000_000             // 2. Silna kara za niepotrzebna szerokosc
      + plan.totalFoilArea * 10_000        // 3. Minimalizuj powierzchnie folii
      + plan.totalStripCount * 1_000       // 4. Mniej spoin
```

#### Zmiana 4: Nowa funkcja `simulateFullBFDPacking`

Uproszczona wersja `packStripsIntoRolls` pracujaca na listach dlugosci (bez SurfaceRollConfig). Przyjmuje:
- bottomStrips: {rollWidth, length}[]
- wallStrips: {rollWidth, length}[]
- Zwraca: {totalRolls, fullyUsedRolls, maxOffcutLength}

Algorytm: BFD per szerokosc (sortuj malejaco, best-fit do istniejacych rolek lub nowa rolka 25m).

### Plik: `src/lib/foil/wallStripOptimizer.ts` - Guardrail

#### Zmiana 5: Guardrail w `getOptimalWallStripPlan`

```text
if (priority === 'minRolls') {
  const minRollsPlan = selectOptimalWallPlan(plans, 'minRolls', ...)
  const minWastePlan = selectOptimalWallPlan(plans, 'minWaste', ...)

  const rollsMinRolls = simulateFullBFDPacking(bottom, minRollsPlan.strips)
  const rollsMinWaste = simulateFullBFDPacking(bottom, minWastePlan.strips)

  if (rollsMinRolls.totalRolls >= rollsMinWaste.totalRolls
      && minRollsPlan.totalFoilArea > minWastePlan.totalFoilArea) {
    return minWastePlan
  }
  return minRollsPlan
}
```

### Testy

Istniejace testy w `wallStripOptimizer.test.ts` i `packStripsIntoRolls.test.ts` powinny zostac zaktualizowane:

1. Test "minWaste should prefer symmetric 15m + 15.2m strips" - ten juz oczekuje 15+15.2-like split. Po zmianach powinien przechodzic.
2. Test "minRolls should match minWaste for 8x4x1.5m" - guardrail powinien zapewnic fallback.
3. Test `packStripsIntoRolls` - packing 10x5x1.5m powinien dawac 3 rolki w minRolls.

Mozliwe ze trzeba bedzie zaktualizowac oczekiwane wartosci w testach po zmianach scoringu.

## Weryfikacja oczekiwanych wynikow

Dla basenu 10x5x1.5m (dno: 1x2.05@10m + 2x1.65@10m):

**minWaste - oczekiwane 4 rolki**:
- Rolka 1 (2.05): dno 10m, offcut 15m
- Rolka 2 (1.65): dno 10m + sciana 15m = 25m (pelna)
- Rolka 3 (1.65): dno 10m, offcut 15m
- Rolka 4 (1.65): sciana 15.2m, offcut 9.8m

**minRolls - oczekiwane 3 rolki**:
- Rolka 1 (2.05): dno 10m + sciana ~5.1m (2.05 szer.) = 15.1m, offcut 9.9m
- Rolka 2 (1.65): dno 2x10m + sciana 5m = 25m (pelna)
- Rolka 3 (1.65): sciana ~20.2m, offcut 4.8m

## Kolejnosc implementacji

1. Nowa funkcja `simulateFullBFDPacking` w wallStripOptimizer
2. Nowa funkcja `generateOverlapVariants` w wallStripOptimizer
3. Modyfikacja `buildWallStripPlan` - parametr overlaps
4. Modyfikacja `generateWallStripConfigurations` - iteracja po wariantach overlap
5. Modyfikacja `selectOptimalWallPlan` - nowy scoring z pelnym BFD
6. Guardrail w `getOptimalWallStripPlan`
7. Aktualizacja testow

