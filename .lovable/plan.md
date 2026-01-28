
# Plan: Naprawa edycji schodów i renderowania 3D

## Zidentyfikowane problemy

### Problem 1: Panel schodów dla basenu nieregularnego nie synchronizuje renderów
W `DimensionsStep.tsx` funkcja `updateStairs()` aktualizuje tylko `dimensions.stairs`, ale dla basenu nieregularnego rendery 3D używają **customStairsVertices** (wierzchołków narysowanych ręcznie). Zmiana parametrów w panelu nie wpływa na narysowany kształt - są to dwa oddzielne źródła danych.

### Problem 2: Błędne renderowanie stopni w 3D
W `Pool3DVisualization.tsx` komponent `CustomStairsMesh` używa wartości `rotation` (strzałka kierunku) do cięcia geometrii na stopnie. Jeśli strzałka nie jest zsynchronizowana z faktyczną geometrią, stopnie renderują się nieprawidłowo.

### Problem 3: Niezgodność liczby stopni
2D i 3D pobierają `stepCount` z różnych źródeł (2D używa `dimensions.stairs.stepCount`, 3D używa `stairsConfig?.stepCount`), a logika cięcia/generowania jest niespójna.

---

## Rozwiązanie

### Część 1: Uproszczenie panelu schodów dla basenu nieregularnego

W `DimensionsStep.tsx` dla `isCustomShape`:

1. **Liczba stopni** - edytowalna (zmiana aktualizuje `stairs.stepCount`)
2. **Szerokość** - tylko do odczytu, obliczana z `customStairsVertices`
3. **Głębokość stopnia** - tylko do odczytu, obliczana jako `długość / stepCount`
4. **Ukryj** pola typ schodów i narożnik startowy (bo są nieistotne dla ręcznie rysowanych)

Gdy użytkownik zmieni liczbę stopni:
- Przelicz `stepDepth = obliczona_długość / nowa_liczba_stopni`
- NIE modyfikuj `customStairsVertices`
- Zaktualizuj tylko `stairs.stepCount` i `stairs.stepDepth`

### Część 2: Naprawa renderowania 3D - zgodnie z geometrią

W `Pool3DVisualization.tsx` / `CustomStairsMesh`:

**Nowa logika wyznaczania kierunku schodzenia:**
1. Oblicz długości wszystkich krawędzi narysowanego kształtu
2. Dla prostokąta (4 punkty): najdłuższa krawędź = kierunek "width", krótsza = kierunek "length" (schodzenia)
3. Dla trójkąta (3 punkty): znajdź narożnik (punkt gdzie spotykają się dwa ramiona), ramiona wskazują kierunek schodzenia

**Nowa logika cięcia na stopnie:**
- Dla prostokąta: dziel kształt na `stepCount` pasków wzdłuż krótszej osi (kierunek schodzenia)
- Dla trójkąta 45°: dziel metodą trapezową równolegle do przeciwprostokątnej

**Formuła wysokości podstopnia:**
```
stepHeight = poolDepth / (stepCount + 1)
```
Pierwszy stopień zaczyna się na `z = -stepHeight`, ostatni kończy się nad dnem basenu.

---

## Szczegółowe zmiany

### Plik: `src/components/steps/DimensionsStep.tsx`

**Linie ~688-844 (panel schodów dla isCustomShape):**

```text
Przed:
- Pokazuje pola: Szerokość schodów (edytowalne), Liczba stopni, Głębokość stopnia (edytowalne)

Po:
- Dodaj obliczanie wymiarów z customStairsVertices
- Szerokość schodów: tylko do odczytu, wyświetla obliczoną wartość
- Liczba stopni: edytowalna, zmiana przelicza stepDepth
- Głębokość stopnia: tylko do odczytu, wyświetla obliczoną wartość
- Ukryj typ schodów i narożnik (nie mają sensu dla ręcznie rysowanych)
```

**Dodać funkcję obliczającą wymiary z wierzchołków:**
```typescript
const calculateStairsDimensionsFromVertices = (vertices: CustomPoolVertex[]): { length: number; width: number } | null => {
  if (vertices.length === 3) {
    // Trójkąt: dłuższe ramię = length
    const v0 = vertices[0], v1 = vertices[1], v2 = vertices[2];
    const leg1 = Math.hypot(v1.x - v0.x, v1.y - v0.y);
    const leg2 = Math.hypot(v2.x - v0.x, v2.y - v0.y);
    return { length: Math.max(leg1, leg2), width: Math.min(leg1, leg2) };
  }
  if (vertices.length === 4) {
    // Prostokąt: oblicz pary przeciwległych krawędzi
    const edges = [0,1,2,3].map(i => {
      const next = (i + 1) % 4;
      return Math.hypot(vertices[next].x - vertices[i].x, vertices[next].y - vertices[i].y);
    });
    const pair1 = (edges[0] + edges[2]) / 2;
    const pair2 = (edges[1] + edges[3]) / 2;
    return { length: Math.max(pair1, pair2), width: Math.min(pair1, pair2) };
  }
  return null;
};
```

**Zmiana obsługi `updateStairs` dla nieregularnych:**
```typescript
// Gdy zmienia się stepCount dla nieregularnego basenu
if (isCustomShape && updates.stepCount !== undefined) {
  const vertices = dimensions.customStairsVertices?.[0];
  if (vertices) {
    const dims = calculateStairsDimensionsFromVertices(vertices);
    if (dims) {
      newStairs.stepDepth = dims.length / updates.stepCount;
    }
  }
}
```

### Plik: `src/components/Pool3DVisualization.tsx`

**Linie ~1120-1350 (CustomStairsMesh):**

Przepisać logikę generowania stopni aby:

1. **Ignorować `rotation` prop** dla kierunku schodzenia
2. **Wyznaczać kierunek z geometrii:**
   - Dla 4 wierzchołków: znajdź krótszą parę krawędzi - to kierunek schodzenia
   - Dla 3 wierzchołków: znajdź narożnik (vertex 0 w konwencji rysowania), schodzenie idzie od narożnika wzdłuż ramion

3. **Poprawić cięcie na stopnie:**
   - Dla prostokąta: używaj `slicePolygonY` lub `slicePolygonX` zgodnie z kierunkiem krótszej osi
   - Dla trójkąta: użyj logiki trapezowej (dziel równolegle do przeciwprostokątnej)

4. **Poprawić wysokości:**
   - stepHeight = depth / (stepCount + 1)
   - Stopień `i` ma górę na `z = -(i + 1) * stepHeight`
   - Stopień `i` ma wysokość ciała: `depth - (i + 1) * stepHeight`

**Kluczowa zmiana w logice:**
```typescript
// Zastąp:
const isHorizontal = rotation === 90 || rotation === 270;
const isDiagonal = rotation === 45 || rotation === 135 || ...

// Na:
// Oblicz kierunek schodzenia z geometrii
const { descentDirection, stairsLength, stairsWidth } = calculateDescentFromGeometry(transformedVertices);
// descentDirection: 'x' | 'y' | 'diagonal'
```

### Plik: `src/components/Pool2DPreview.tsx`

**Linie ~240-275 (generowanie linii stopni):**

Upewnić się, że logika jest spójna z 3D:
- Dla trójkąta: linie równoległe do przeciwprostokątnej
- Dla prostokąta: linie prostopadłe do kierunku schodzenia (krótszej osi)

---

## Przepływ danych po zmianach

```text
Edytor kształtu (CustomPoolDrawer)
       │
       ▼
customStairsVertices (wierzchołki narysowane ręcznie)
       │
       ▼
┌─────────────────────────────────────┐
│ DimensionsStep - Panel schodów      │
│ • Oblicz wymiary z vertices         │
│ • Wyświetl Szerokość (read-only)    │
│ • Liczba stopni (edytowalna)        │
│ • Głębokość stopnia (calculated)    │
└─────────────────────────────────────┘
       │
       ▼ Aktualizuje stairs.stepCount, stairs.stepDepth
       │
┌─────────────────────────────────────┐
│ Pool3DVisualization / Pool2DPreview │
│ • Używa customStairsVertices        │
│ • Używa stairs.stepCount            │
│ • Oblicza kierunek z geometrii      │
│ • Renderuje stopnie poprawnie       │
└─────────────────────────────────────┘
```

---

## Pliki do modyfikacji

| Plik | Zakres zmian |
|------|--------------|
| `src/components/steps/DimensionsStep.tsx` | Panel schodów dla isCustomShape - pola read-only, obliczenia z vertices |
| `src/components/Pool3DVisualization.tsx` | CustomStairsMesh - nowa logika kierunku z geometrii, poprawne cięcie |
| `src/components/Pool2DPreview.tsx` | Synchronizacja logiki generowania linii stopni |

## Oczekiwany rezultat

1. Panel schodów dla basenu nieregularnego pokazuje wymiary z rysunku (read-only)
2. Zmiana liczby stopni przelicza głębokość stopnia bez zmiany kształtu
3. Renderowanie 3D poprawnie dzieli schody na stopnie zgodnie z geometrią
4. Liczba widocznych stopni zgadza się z ustawioną wartością
5. Wysokości podstopni są równe i zgodne ze wzorem `depth / (stepCount + 1)`
