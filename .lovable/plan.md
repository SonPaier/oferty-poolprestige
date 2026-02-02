
# Plan: Algorytm obliczania folii - zaktualizowany

## Poprawka: Murek brodzika

**Zmiana**: Murek oddzielający brodzik od głównej niecki będzie liczony z **folii głównej** (tej samej co dno i ściany), a nie z folii strukturalnej.

```text
┌─────────────────────────────────────────────────────────────────┐
│ PODZIAŁ FOLII                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ FOLIA GŁÓWNA (wybrana przez użytkownika)                        │
│ ├── Dno basenu                                                  │
│ ├── Ściany basenu                                               │
│ └── Murek brodzika (3 powierzchnie):                            │
│     ├── strona basenu (poolSide)                                │
│     ├── strona brodzika (paddlingSide)                          │
│     └── góra murka (top)                                        │
│                                                                 │
│ FOLIA STRUKTURALNA (zawsze osobna)                              │
│ ├── Schody (stopnie + podstopnice)                              │
│ └── Dno brodzika (antypoślizgowe)                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Zaktualizowana logika brodzika

### Przed (błędnie)
Wszystkie powierzchnie brodzika (dno + murek) traktowane jako folia strukturalna.

### Po (poprawnie)
```text
Brodzik dzieli się na:
1. DNO BRODZIKA → folia strukturalna (antypoślizgowa)
2. MUREK BRODZIKA → folia główna (jak ściany basenu)
```

---

## Przykład: basen 10x5x1.5m z brodzikiem 2x2x0.4m (murek 0.2m)

```text
FOLIA GŁÓWNA (jednokolorowa):
┌────────────────────────────────────────────────────────────────┐
│ Powierzchnia         │ Pokrycie │ Zgrzewy │ Odpad │ Razem     │
├────────────────────────────────────────────────────────────────┤
│ Dno basenu           │ 50.0 m²  │ 2.0 m²  │ 1.5 m²│ 53.5 m²   │
│ Ściany basenu        │ 45.0 m²  │ 4.2 m²  │ 0.3 m²│ 49.5 m²   │
│ Murek brodzika       │  1.6 m²  │ 0.1 m²  │ 0.0 m²│  1.7 m²   │
│  ├─ strona basenu    │  0.8 m²  │         │       │           │
│  ├─ strona brodzika  │  0.4 m²  │         │       │           │
│  └─ góra murka       │  0.4 m²  │         │       │           │
├────────────────────────────────────────────────────────────────┤
│ SUMA                 │ 96.6 m²  │ 6.3 m²  │ 1.8 m²│ 104.7 m²  │
└────────────────────────────────────────────────────────────────┘

FOLIA STRUKTURALNA:
┌────────────────────────────────────────────────────────────────┐
│ Powierzchnia         │ Pokrycie │ Zgrzewy │ Odpad │ Razem     │
├────────────────────────────────────────────────────────────────┤
│ Schody               │  4.2 m²  │ 0.0 m²  │ 0.3 m²│  4.5 m²   │
│ Dno brodzika         │  4.0 m²  │ 0.0 m²  │ 0.0 m²│  4.0 m²   │
├────────────────────────────────────────────────────────────────┤
│ SUMA                 │  8.2 m²  │ 0.0 m²  │ 0.3 m²│  8.5 m²   │
└────────────────────────────────────────────────────────────────┘
```

---

## Zmiany w kodzie

### 1. Aktualizacja typów (`src/lib/foil/types.ts`)

Dodanie flagi wskazującej typ folii dla każdej powierzchni:

```typescript
// Nowy typ określający przypisanie folii
export type FoilAssignment = 'main' | 'structural';

export interface ExtendedSurfacePlan {
  type: ExtendedSurfaceType;
  width: number;
  length: number;
  area: number;
  strips: FoilStrip[];
  recommendedRollWidth: RollWidth;
  foilAssignment: FoilAssignment;  // NOWE: która folia
}

// Mapowanie powierzchni do typu folii
export const SURFACE_FOIL_ASSIGNMENT: Record<ExtendedSurfaceType, FoilAssignment> = {
  // Folia główna
  'bottom': 'main',
  'bottom-slope': 'main',
  'wall-long-1': 'main',
  'wall-long-2': 'main',
  'wall-short-1': 'main',
  'wall-short-2': 'main',
  'l-arm': 'main',
  'dividing-wall-pool': 'main',      // Murek - strona basenu
  'dividing-wall-paddling': 'main',  // Murek - strona brodzika
  'dividing-wall-top': 'main',       // Murek - góra
  
  // Folia strukturalna
  'stairs-step': 'structural',
  'stairs-riser': 'structural',
  'paddling-bottom': 'structural',
  'paddling-wall': 'structural',     // Zewnętrzne ściany brodzika (bez murka)
};
```

### 2. Aktualizacja paddlingPlanner.ts

```typescript
// Zmiana: surface plans dla murka mają foilAssignment: 'main'
surfaces.push({
  type: 'dividing-wall-pool',
  width: poolSideHeight,
  length: width,
  area: poolSideArea,
  strips: [],
  recommendedRollWidth: poolSideHeight <= 1.4 ? ROLL_WIDTH_NARROW : ROLL_WIDTH_WIDE,
  foilAssignment: 'main',  // ZMIANA: murek z folii głównej
});
```

### 3. Aktualizacja mixPlanner.ts

```typescript
// Nowa struktura wyniku z podziałem na dwa typy
export interface FoilCalculationResult {
  mainPool: {
    surfaces: SurfaceRollConfig[];
    rolls: RollAllocation[];
    totalRolls165: number;
    totalRolls205: number;
    coverageArea: number;
    weldArea: number;
    wasteArea: number;
  };
  structural: {
    surfaces: SurfaceRollConfig[];
    rolls: RollAllocation[];
    totalRolls165: number;
    coverageArea: number;
    weldArea: number;
    wasteArea: number;
  };
}

// Funkcja dzieląca powierzchnie na dwa typy
function partitionSurfacesByFoilType(
  allSurfaces: ExtendedSurfacePlan[]
): { main: ExtendedSurfacePlan[]; structural: ExtendedSurfacePlan[] } {
  return {
    main: allSurfaces.filter(s => SURFACE_FOIL_ASSIGNMENT[s.type] === 'main'),
    structural: allSurfaces.filter(s => SURFACE_FOIL_ASSIGNMENT[s.type] === 'structural'),
  };
}
```

### 4. Aktualizacja UI (RollSummary.tsx)

Dwie osobne sekcje w podsumowaniu:
- "Folia główna" z dnem, ścianami i murkiem
- "Folia strukturalna" ze schodami i dnem brodzika

---

## Przypadek specjalny: główna folia = strukturalna

Jeśli użytkownik wybierze folię strukturalną jako główną:
- Wszystkie powierzchnie (w tym murek) używają tego samego typu folii
- Można optymalizować resztki między wszystkimi powierzchniami
- Jedna wspólna pula rolek 1.65m

---

## Pliki do modyfikacji

| Plik | Zakres zmian |
|------|--------------|
| `src/lib/foil/types.ts` | Dodanie `foilAssignment` i mapowania |
| `src/lib/foil/paddlingPlanner.ts` | Ustawienie `foilAssignment: 'main'` dla murka |
| `src/lib/foil/stairsPlanner.ts` | Ustawienie `foilAssignment: 'structural'` dla schodów |
| `src/lib/foil/mixPlanner.ts` | Nowa logika podziału na dwa typy folii |
| `src/components/finishing/components/RollSummary.tsx` | Dwie sekcje w UI |
| `src/components/finishing/components/RollConfigTable.tsx` | Oznaczenie typu folii |

---

## Stałe algorytmu (bez zmian)

| Stała | Wartość | Opis |
|-------|---------|------|
| `WASTE_THRESHOLD` | 0.30m | Pasek < 30cm = odpad |
| `OVERLAP_STRIPS` | 0.10m | Zakładka między pasami |
| `OVERLAP_WALL_BOTTOM` | 0.07m | Zgrzew dół ściany |
| `OVERLAP_WALL_TOP` | 0.07m | Połączenie z kątownikiem góra |
| `BUTT_JOINT_OVERLAP` | 0m | Strukturalna doczołowo |
| `DEPTH_THRESHOLD_NARROW` | 1.50m | Do tej głębokości folia 1.65m |
| `DEPTH_THRESHOLD_WIDE` | 1.95m | Do tej głębokości folia 2.05m |

