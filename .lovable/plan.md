
# Faza 2: Rozbudowa Algorytmu Optymalizacji Folii

## Zmiany względem poprzedniego planu

### Folia antypoślizgowa - poprawione reguły
1. **Schody**: antypoślizgowa tylko na stopniach (powierzchnie POZIOME), podstopnie (powierzchnie PIONOWE) = zwykła folia
2. **Brodzik**: antypoślizgowa tylko na DNIE, ściany brodzika = zwykła folia
3. **Wyjątek**: jeśli wybrana folia na cały basen jest strukturalna → wszędzie ta sama folia

### Murek rozdzielający - poprawiona geometria
Dla przykładu: basen 1.4m, brodzik 0.4m, murek 0.2m:

```text
Poziom wody (0m)
├── Góra murka: -0.2m (powierzchnia pozioma)
│
├── Od strony BRODZIKA: ściana murka 0.2m
│   (od dna brodzika -0.4m do góry murka -0.2m)
│
├── Dno brodzika: -0.4m
│
├── Od strony BASENU: ściana podniesiona 1.0m
│   (od dna basenu -1.4m do góry murka -0.2m → NIE DO DNA BRODZIKA!)
│   czyli: głębokość_basenu - głębokość_brodzika = 1.4m - 0.4m = 1.0m
│   UWAGA: Wysokość murka (0.2m) NIE jest dodawana - murek wystaje ponad dno brodzika
│
└── Dno basenu: -1.4m
```

Schemat przekroju:
```text
                0m ─────────────────────────────────────────
                   │                      │ góra murka (0.2m poziomo)
              -0.2m├──────────────────────┼────────────────
                   │                      │
              -0.4m│    BRODZIK (0.4m)    │ ściana murka 0.2m (od strony brodzika)
         dno brodzika ────────────────────┘
                   │
                   │       BASEN GŁÓWNY
                   │    ściana podniesiona 1.0m (od strony basenu)
                   │    (1.4m - 0.4m = 1.0m)
              -1.4m│
          dno basenu ─────────────────────────────────────────
```

---

## Struktura implementacji

### 1. Nowe typy powierzchni

```typescript
// Rozszerzenie SurfaceType
type ExtendedSurfaceType = SurfaceType | 
  'stairs-step' |        // Poziome stopnie (antypoślizgowa)
  'stairs-riser' |       // Pionowe podstopnie (zwykła)
  'paddling-bottom' |    // Dno brodzika (antypoślizgowa)
  'paddling-wall' |      // Ściany brodzika (zwykła)
  'dividing-wall-pool' | // Murek od strony basenu (zwykła)
  'dividing-wall-paddling' | // Murek od strony brodzika (zwykła)
  'dividing-wall-top';   // Góra murka (pozioma, jak stopień)
```

### 2. Nowy interfejs ExtendedFoilPlanResult

```typescript
interface ExtendedFoilPlanResult extends FoilPlanResult {
  // Dane dla schodów
  stairsPlan?: {
    surfaces: SurfacePlan[];
    stepArea: number;      // Powierzchnia stopni (antypoślizgowa)
    riserArea: number;     // Powierzchnia podstopni (zwykła)
    antiSlipProductId?: string;
  };
  
  // Dane dla brodzika
  paddlingPlan?: {
    surfaces: SurfacePlan[];
    bottomArea: number;    // Dno (antypoślizgowa)
    wallsArea: number;     // Ściany (zwykła)
    dividingWall?: {
      poolSideArea: number;     // Od strony basenu
      paddlingSideArea: number; // Od strony brodzika
      topArea: number;          // Góra murka
    };
  };
  
  // Flagi dla folii strukturalnej
  isStructural: boolean;
  buttJointLength: number;
  score: number;
}
```

### 3. Funkcje pomocnicze

```typescript
// Sprawdzenie czy folia jest strukturalna/antypoślizgowa
function isStructuralFoil(product: Product): boolean {
  return product.foil_category === 'strukturalna';
}

// Automatyczny dobór folii antypoślizgowej
function getAntiSlipFoilForStairs(
  selectedProduct: Product, 
  allProducts: Product[]
): Product | null {
  if (isStructuralFoil(selectedProduct)) {
    return selectedProduct; // strukturalna = OK wszędzie
  }
  // Szukaj Relief/Touch w tym samym kolorze
  return allProducts.find(p => 
    p.foil_category === 'strukturalna' && 
    p.shade === selectedProduct.shade
  ) || null;
}
```

### 4. Funkcja planStairsSurface()

```typescript
function planStairsSurface(
  stairsConfig: StairsConfig,
  poolDepth: number,
  dimensions: PoolDimensions
): { stepSurfaces: SurfacePlan[]; riserSurfaces: SurfacePlan[] } {
  const stepCount = stairsConfig.stepCount;
  const stepDepth = stairsConfig.stepDepth;
  const stepHeight = stairsConfig.stepHeight;
  const stairsWidth = typeof stairsConfig.width === 'number' 
    ? stairsConfig.width : dimensions.width;
  
  // STOPNIE (poziome) - antypoślizgowa
  const stepArea = stepCount * stepDepth * stairsWidth;
  
  // PODSTOPNIE (pionowe) - zwykła folia
  const riserArea = stepCount * stepHeight * stairsWidth;
  
  return {
    stepSurfaces: [{ type: 'stairs-step', area: stepArea, ... }],
    riserSurfaces: [{ type: 'stairs-riser', area: riserArea, ... }]
  };
}
```

### 5. Funkcja planPaddlingPoolSurface()

```typescript
function planPaddlingPoolSurface(
  wadingConfig: WadingPoolConfig,
  poolDepth: number
): PaddlingPlanResult {
  const { width, length, depth: paddlingDepth, hasDividingWall, dividingWallOffset } = wadingConfig;
  
  // DNO brodzika - antypoślizgowa
  const bottomArea = width * length;
  
  // ŚCIANY brodzika (3 zewnętrzne) - zwykła folia
  // 2 ściany wzdłuż + 1 ściana w poprzek (bez murka)
  const wallsArea = 2 * (length * paddlingDepth) + (width * paddlingDepth);
  
  // MUREK ROZDZIELAJĄCY (jeśli włączony)
  let dividingWall = undefined;
  if (hasDividingWall) {
    const wallHeight = (dividingWallOffset || 0) / 100; // cm → m
    
    // Strona BRODZIKA: wysokość murka
    const paddlingSideArea = width * wallHeight;
    
    // Strona BASENU: głębokość_basenu - głębokość_brodzika
    const poolSideHeight = poolDepth - paddlingDepth;
    const poolSideArea = width * poolSideHeight;
    
    // GÓRA murka (pozioma, jak stopień)
    const wallThickness = 0.15; // 15cm grubość murka
    const topArea = width * wallThickness;
    
    dividingWall = {
      poolSideArea,
      paddlingSideArea,
      topArea,
    };
  }
  
  return {
    surfaces: [...],
    bottomArea,    // Antypoślizgowa
    wallsArea,     // Zwykła
    dividingWall,  // Zwykła (wszystkie strony murka)
  };
}
```

### 6. Funkcja scoreCuttingPlan()

```typescript
function scoreCuttingPlan(plan: FoilPlanResult): number {
  let score = 0;
  
  // Kary
  score += plan.wastePercentage * 10;        // Odpad
  score += plan.issues.length * 50;           // Błędy
  score += plan.strips.length * 2;            // Spawy
  score += plan.rolls.length * 5;             // Rolki
  
  // Bonusy
  const uniqueWidths = new Set(plan.strips.map(s => s.rollWidth));
  if (uniqueWidths.size === 1) score -= 20;   // Jedna szerokość
  
  return score; // Mniej = lepiej
}
```

### 7. Obsługa folii strukturalnej (butt joint)

```typescript
// Wykrywanie zgrzewania doczołowego
if (selectedProduct?.joint_type === 'butt') {
  // Brak zakładów na dnie
  const adjustedOverlapBottom = 0;
  
  // Oblicz długość zgrzewów doczołowych
  const buttJointLength = calculateButtJointLength(bottomPlan);
  
  // Dodatkowe materiały/usługi
  extraMaterials.push({ name: 'Folia podkładowa', ... });
  extraServices.push({ name: 'Zgrzewanie doczołowe', rate: 15, length: buttJointLength });
}
```

---

## Pliki do modyfikacji

### src/lib/foilPlanner.ts
- Dodanie nowych typów powierzchni
- Nowe funkcje: `isStructuralFoil()`, `getAntiSlipFoilForStairs()`
- Nowe funkcje: `planStairsSurface()`, `planPaddlingPoolSurface()`
- Nowa funkcja: `scoreCuttingPlan()`
- Rozszerzenie: `planFoilLayout()` → `planExtendedFoilLayout()`
- Nowy interfejs: `ExtendedFoilPlanResult`

---

## Podsumowanie powierzchni i typów folii

| Powierzchnia | Typ folii | Uwagi |
|--------------|-----------|-------|
| Dno basenu | Wybrana | Główna folia |
| Ściany basenu | Wybrana | Główna folia |
| Stopnie schodów (poziome) | Antypoślizgowa* | Strukturalna |
| Podstopnie (pionowe) | Wybrana | Główna folia |
| Dno brodzika | Antypoślizgowa* | Strukturalna |
| Ściany brodzika | Wybrana | Główna folia |
| Murek - strona basenu | Wybrana | 1.0m dla przykładu |
| Murek - strona brodzika | Wybrana | 0.2m dla przykładu |
| Murek - góra | Wybrana | Pozioma jak stopień |

*Jeśli wybrana folia jest strukturalna → wszędzie ta sama folia
