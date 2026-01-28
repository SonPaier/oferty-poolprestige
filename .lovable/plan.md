
# Plan: Trapezy rozszerzające się dla trójkątnych schodów

## Cel

Dla trójkątnych schodów o nierównych ramionach:
1. Kierunek schodzenia automatycznie prostopadły do najdłuższego boku (strzałka ignorowana)
2. Stopnie jako rozszerzające się trapezy - głębokość rośnie od węższego do szerszego końca

## Koncepcja geometryczna

```
        Wierzchołek (wąski koniec)
             /\
            /  \
           /    \   ← Głębokość stopnia mała (np. 20cm)
          /------\
         /        \
        /          \ ← Głębokość stopnia średnia
       /------------\
      /              \
     /                \ ← Głębokość stopnia duża (np. 30cm)
    /==================\
   Najdłuższy bok (podstawa)
```

Stopnie są liniami równoległymi do najdłuższego boku, ale ich "głębokość" (odległość między liniami) rośnie proporcjonalnie do szerokości trójkąta w danym miejscu.

## Algorytm

### Krok 1: Identyfikacja geometrii trójkąta
```typescript
function analyzeTriangleGeometry(vertices: Point[]): {
  longestEdge: { start: Point; end: Point; length: number };
  oppositeVertex: Point;
  leftLeg: number;
  rightLeg: number;
} {
  // Znajdź najdłuższy bok (podstawa)
  // Znajdź wierzchołek naprzeciwko (szczyt)
  // Oblicz długości ramion
}
```

### Krok 2: Podział na trapezy o zmiennej głębokości
Zamiast dzielić trójkąt na równe odcinki wzdłuż wysokości, dzielimy go tak, aby:
- Głębokość przy wierzchołku (wąski koniec) = `minDepth` (np. 20cm)
- Głębokość przy podstawie (szeroki koniec) = `maxDepth` (np. 30cm)
- Stopnie pomiędzy interpolują liniowo

```typescript
function calculateTrapezoidSteps(
  triangle: TriangleGeometry,
  stepCount: number
): TrapezoidStep[] {
  const height = distanceFromVertexToBase;
  
  // Oblicz minimalną i maksymalną głębokość
  const minDepth = 0.20; // 20cm przy wierzchołku
  const maxDepth = 0.30; // 30cm przy podstawie
  
  // Dla każdego stopnia oblicz pozycję i głębokość
  let currentPosition = 0;
  for (let i = 0; i < stepCount; i++) {
    const progress = i / stepCount;
    const stepDepth = lerp(minDepth, maxDepth, progress);
    steps.push({
      position: currentPosition,
      depth: stepDepth,
      width: calculateWidthAtPosition(currentPosition)
    });
    currentPosition += stepDepth;
  }
  return steps;
}
```

### Krok 3: Normalizacja do pełnej wysokości
Suma głębokości stopni musi równać się wysokości trójkąta. Skalujemy proporcjonalnie:

```typescript
const totalDepth = steps.reduce((sum, s) => sum + s.depth, 0);
const scale = triangleHeight / totalDepth;
steps.forEach(s => s.depth *= scale);
```

## Zmiany w plikach

### `src/components/Pool3DVisualization.tsx`

W `CustomStairsMesh`:

1. **Dodaj detekcję trójkąta nierównobocznego**:
```typescript
const isTriangle = transformedVertices.length === 3;
if (isTriangle) {
  const geometry = analyzeTriangleGeometry(transformedVertices);
  const isScalene = Math.abs(geometry.leftLeg - geometry.rightLeg) > 0.1;
  
  if (isScalene) {
    // Użyj algorytmu trapezowego
    return renderScaleneTriangleStairs(geometry, stepCount, depth);
  }
}
```

2. **Nowa funkcja renderowania**:
```typescript
function renderScaleneTriangleStairs(
  geometry: TriangleGeometry,
  stepCount: number,
  poolDepth: number
): JSX.Element[] {
  const steps = calculateTrapezoidSteps(geometry, stepCount);
  const stepHeight = poolDepth / (stepCount + 1);
  
  return steps.map((step, i) => {
    // Generuj trapezoidalny mesh dla każdego stopnia
    const shape = createTrapezoidShape(step);
    return (
      <mesh key={i} position={[0, 0, -(i + 1) * stepHeight]}>
        <extrudeGeometry args={[shape, { depth: poolDepth - (i + 1) * stepHeight }]} />
        <meshStandardMaterial color="#e8e8e8" />
      </mesh>
    );
  });
}
```

### `src/components/Pool2DPreview.tsx`

1. **Aktualizacja generowania linii stopni**:
```typescript
if (isScaleneTriangle) {
  // Linie równoległe do podstawy, ale w nierównych odstępach
  const steps = calculateTrapezoidSteps(triangleGeometry, stepCount);
  return steps.map(step => createLineParallelToBase(step.position));
}
```

2. **Ukrycie/ignorowanie strzałki kierunku** dla trójkątów (lub automatyczne ustawienie)

### `src/components/CustomPoolDrawer.tsx`

1. **Automatyczne ustawienie strzałki** przy rysowaniu trójkąta:
```typescript
// Po zamknięciu trójkąta, ustaw rotation prostopadle do najdłuższego boku
const longestEdge = findLongestEdge(vertices);
const perpendicularAngle = calculatePerpendicularAngle(longestEdge);
setStairsRotation(perpendicularAngle);
```

## Parametry konfiguracyjne

Dodać do `StairsConfig`:
```typescript
interface StairsConfig {
  // ... existing fields
  
  // Nowe pola dla trójkątów nierównobocznych
  minStepDepth?: number; // Minimalna głębokość stopnia (domyślnie 0.20m)
  maxStepDepth?: number; // Maksymalna głębokość stopnia (domyślnie 0.30m)
  autoDirection?: boolean; // Czy automatycznie wykrywać kierunek z geometrii
}
```

## Wizualizacja końcowa

```
Widok z góry:
    ┌─────┐ ← Stopień 1 (głębokość ~20cm)
   ┌───────┐
  ┌─────────┐ ← Stopnie środkowe (interpolacja)
 ┌───────────┐
┌─────────────┐ ← Stopień ostatni (głębokość ~30cm)

Widok 3D:
   /\
  /──\     ← Wąskie stopnie u góry
 /────\
/──────\   ← Szerokie stopnie u dołu
```

## Pliki do modyfikacji

| Plik | Zmiany |
|------|--------|
| `src/types/configurator.ts` | Dodanie `minStepDepth`, `maxStepDepth`, `autoDirection` do StairsConfig |
| `src/components/Pool3DVisualization.tsx` | Nowa logika dla trójkątów nierównobocznych |
| `src/components/Pool2DPreview.tsx` | Synchronizacja linii stopni |
| `src/components/CustomPoolDrawer.tsx` | Auto-ustawienie kierunku strzałki |
| `src/components/steps/DimensionsStep.tsx` | Opcjonalnie: UI dla min/max głębokości stopnia |

## Oczekiwany rezultat

1. Trójkąty nierównoboczne automatycznie wykrywają kierunek schodzenia (prostopadle do najdłuższego boku)
2. Stopnie rozszerzają się od wąskiego wierzchołka do szerokiej podstawy
3. Głębokość stopni rośnie proporcjonalnie (20cm → 30cm)
4. 2D i 3D są zsynchronizowane
5. Trójkąty równoramienne (45°) działają jak dotychczas
