
# Plan: Uproszczenie kalkulacji folii na murek brodzika

## Opis zmiany

Zamiast trzech oddzielnych powierzchni (pool side, paddling side, top), murek będzie liczony jako **jeden pas folii** pokrywający wewnętrzny obwód brodzika.

## Nowy wzór kalkulacji

```text
Powierzchnia murka = obwód_brodzika × (wysokość_murka + zakład_góra + zakład_dół)
```

Gdzie:
- **obwód_brodzika** = 2 × szerokość + 2 × długość (np. 2×2 + 2×2 = 8m)
- **wysokość_murka** = głębokość_brodzika − obniżenie_murka (np. 0.4m − 0.1m = 0.3m)
- **zakład_góra** = 0.07m (OVERLAP_WALL_TOP)
- **zakład_dół** = 0.07m (OVERLAP_WALL_BOTTOM)

### Przykład obliczenia (brodzik 2×2m, głębokość 0.4m, obniżenie 0.1m)

```text
obwód = 2 × 2m + 2 × 2m = 8m
wysokość_murka = 0.4m - 0.1m = 0.3m
zakład_góra = 0.07m
zakład_dół = 0.07m

szerokość_pasa = 0.3m + 0.07m + 0.07m = 0.44m
powierzchnia = 8m × 0.44m = 3.52 m²
zaokrąglone = 4 m²
```

## Zmiany techniczne

### Plik: `src/lib/foil/paddlingPlanner.ts`

1. **Usunąć** tworzenie trzech osobnych powierzchni dla murka:
   - `dividing-wall-pool`
   - `dividing-wall-paddling`
   - `dividing-wall-top`

2. **Zastąpić** jedną powierzchnią:
   - Typ: `dividing-wall-inner` (lub użyć istniejącego `dividing-wall-paddling`)
   - Długość pasa: obwód brodzika (2 × width + 2 × length)
   - Szerokość pasa: wysokość_murka + OVERLAP_WALL_TOP + OVERLAP_WALL_BOTTOM

3. **Zaktualizować** `DividingWallPlan`:
   - Uprościć do: `innerPerimeter`, `wallHeight`, `totalOverlap`, `area`
   - Usunąć: `poolSideArea`, `paddlingSideArea`, `topArea`, `poolSideHeight`, `paddlingSideHeight`

### Plik: `src/lib/foil/types.ts`

1. **Zaktualizować** `DividingWallPlan` interface:
   ```typescript
   interface DividingWallPlan {
     innerPerimeter: number;  // 2×szerokość + 2×długość
     wallHeight: number;      // głębokość_brodzika - obniżenie
     stripWidth: number;      // wallHeight + overlaps
     area: number;            // innerPerimeter × stripWidth
   }
   ```

2. Opcjonalnie dodać nowy typ powierzchni `dividing-wall-inner` lub użyć istniejącego

### Plik: `src/lib/foil/mixPlanner.ts`

1. **Zaktualizować** obsługę powierzchni murka w funkcji `calculateSurfaceDetails`:
   - Wyświetlić jako jedną pozycję "Murek brodzika (wewn.)"
   - Pokazać wymiary: obwód × (wysokość + zakłady)

## Wpływ na UI

- Tabela folii głównej pokaże jedną linię dla murka zamiast trzech
- Etykieta: "Murek brodzika (8.0m × 0.44m)" lub podobna
- Wartości: netto 3.52 m² → do zamówienia 4 m²

## Zgodność wsteczna

Ta zmiana wpływa tylko na sposób obliczania powierzchni murka. Nie zmienia:
- Logiki pakowania w rolki
- Numeracji rolek
- Rozdziału folia główna / strukturalna
