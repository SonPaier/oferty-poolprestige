
# Plan: Naprawa edycji schodów i renderowania 3D

## Status: ✅ ZAIMPLEMENTOWANO

### Zmiany wprowadzone:

#### 1. DimensionsStep.tsx - Panel schodów dla basenu nieregularnego
- **Liczba stopni** - edytowalna, zmiana automatycznie przelicza `stepDepth`
- **Szerokość** - tylko do odczytu, wyświetla wartość obliczoną z `customStairsVertices`
- **Długość** - tylko do odczytu, obliczona z wierzchołków
- **Głębokość stopnia** - tylko do odczytu, wyliczona jako `długość / stepCount`
- **Ukryto** typ schodów i narożnik startowy (nieistotne dla ręcznie rysowanych)

#### 2. Pool3DVisualization.tsx - CustomStairsMesh
- **Ignoruje `rotation` prop** - kierunek schodzenia wyznaczany jest z geometrii
- **Dla trójkąta (3 wierzchołki)**: trapezoidalne cięcie równolegle do przeciwprostokątnej
  - v0 = narożnik (kąt prosty), v1 i v2 na przeciwprostokątnej
  - Stopnie generowane jako trapezy od narożnika do przeciwprostokątnej
- **Dla prostokąta (4 wierzchołki)**: cięcie wzdłuż krótszej osi
  - Automatyczne wykrywanie kierunku schodzenia na podstawie długości krawędzi
- **Poprawna formuła wysokości**: `stepHeight = depth / (stepCount + 1)`

#### 3. Usunięto nieużywaną funkcję `slicePolygonDiagonal`

### Przepływ danych:

```
CustomPoolDrawer (edytor kształtu)
       │
       ▼
customStairsVertices (wierzchołki narysowane ręcznie)
       │
       ├──► DimensionsStep: oblicza wymiary, wyświetla read-only, pozwala edytować stepCount
       │
       └──► Pool3DVisualization: używa vertices + stairs.stepCount, oblicza kierunek z geometrii
```

### Oczekiwany rezultat:
1. ✅ Panel schodów pokazuje wymiary z rysunku (read-only)
2. ✅ Zmiana liczby stopni przelicza głębokość stopnia bez zmiany kształtu
3. ✅ Renderowanie 3D dzieli schody na stopnie zgodnie z geometrią
4. ✅ Liczba widocznych stopni zgadza się z ustawioną wartością
5. ✅ Wysokości podstopni są równe: `depth / (stepCount + 1)`
