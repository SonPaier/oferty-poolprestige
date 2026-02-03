
# Plan: Elastyczna optymalizacja rozkładu pasów folii

## Status: ✅ ZAIMPLEMENTOWANO

## Cel
Przebudować logikę optymalizacji folii tak, aby algorytm **dynamicznie wybierał optymalną liczbę pasów** (1, 2, 3, 4 lub więcej) zamiast sztywno zakładać 2 lub 4. Zakład pionowy ma być rozdzielany nierówno między pasy, gdy to poprawia wykorzystanie rolek.

---

## Zrealizowane zmiany

### 1. Nowy moduł: `src/lib/foil/wallStripOptimizer.ts`

Zawiera:
- `generateWallStripConfigurations()` - generuje wszystkie możliwe konfiguracje pasów (1, 2, 3, 4)
- `distributeVerticalOverlap()` - rozkłada zakład pionowy nierówno między pasy
- `selectOptimalWallPlan()` - wybiera najlepszą konfigurację wg priorytetu
- `getOptimalWallStripPlan()` - główna funkcja do użycia w mixPlanner

### 2. Zmodyfikowany: `src/lib/foil/mixPlanner.ts`

- `calculateSurfaceDetails()` - teraz używa elastycznego optymalizatora dla ścian
- `packStripsIntoRolls()` - teraz używa elastycznego optymalizatora dla ścian
- Import nowego modułu `wallStripOptimizer`

---

## Logika wyboru konfiguracji

### Dla obu trybów (minWaste i minRolls):

1. Wygeneruj wszystkie sensowne partycje ścian (od 1 do 4 pasów dla basenu prostokątnego)
2. Dla każdej partycji:
   - Oblicz długości bazowe (suma ścian w grupie)
   - Rozłóż zakład pionowy nierówno (preferuj krótsze pasy)
   - Przypisz szerokości rolek (uwzględnij parowanie z dnem)
   - Oblicz m² folii i odpad

3. Wybierz najlepszą konfigurację:
   - **minWaste**: minimalizuj odpad, potem liczbę pasów, potem m² folii
   - **minRolls**: minimalizuj m² folii, potem odpad, potem liczbę pasów

---

## Przykład dla basenu 10×5×1.5m

### Oczekiwane konfiguracje:

| # pasów | Rozkład długości | Szerokości |
|---------|------------------|------------|
| 1 | 30.1m | ❌ (>25m) |
| 2 | 15.0 + 15.2 | 1.65 + 1.65 |
| 3 | 10.1 + 10.1 + 10.1 | 1.65 × 3 |
| 4 | 10.1 + 5.1 + 10.1 + 5.1 | mieszane |

### Preferowana dla minRolls (wg użytkownika):
- Dno: 2.05×10 + 1.65×10 + 1.65×10 (3 pasy)
- Ściany: 1.65×5 + 2.05×5.1 + 1.65×10.2 + 1.65×10.2 (4 pasy)
- Rolki: 1× 2.05m + 2× 1.65m = 3 rolki

---

## Weryfikacja

Do przetestowania:
1. Basen 10×5×1.5m - sprawdź czy optymalizator wybiera właściwą liczbę pasów
2. Porównaj tryb Min. odpad vs Min. rolek
3. Sprawdź czy zakład jest rozłożony nierówno
