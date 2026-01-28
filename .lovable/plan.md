
# Plan: Automatyczne obliczanie głębokości stopnia dla ręcznie rysowanych schodów

## Podsumowanie problemu
Przy ręcznym rysowaniu schodów w edytorze basenu nieregularnego:
- Wyświetlana długość schodów nie zgadza się z faktycznie narysowanym kształtem
- Głębokość stopnia powinna być automatycznie wyliczana z wzoru: `długość / liczba_stopni`
- System nie wie, która krawędź to "długość" (kierunek schodzenia)

## Rozwiązanie

### 1. Funkcja obliczająca długość z wierzchołków

Dodanie funkcji `calculateStairsLengthFromVertices()` w `CustomPoolDrawer.tsx`:

```text
Dla prostokąta (4 punkty):
├── Oblicz długości wszystkich 4 krawędzi
├── Znajdź dłuższą krawędź → to jest "długość schodów" (kierunek schodzenia)
└── Krótsza krawędź → to jest "szerokość schodów"

Dla trójkąta 45° (3 punkty):
├── Krawędź od punktu 0 do 1 → ramię 1
├── Krawędź od punktu 0 do 2 → ramię 2  
└── Dłuższa z nich → "długość" schodów
```

### 2. Automatyczna aktualizacja parametrów po narysowaniu

W momencie zamknięcia kształtu schodów (gdy użytkownik kliknie pierwszy punkt):
```text
1. Oblicz całkowitą długość z geometrii
2. Zachowaj aktualną liczbę stopni
3. Przelicz głębokość stopnia: stepDepth = obliczona_długość / stepCount
4. Zaktualizuj również szerokość (krótsza krawędź)
5. Wyświetl toast z informacją o obliczonych wymiarach
```

### 3. Aktualizacja przy przesuwaniu wierzchołków

Gdy użytkownik przeciągnie wierzchołek:
```text
1. Po zakończeniu przeciągania (object:modified event)
2. Jeśli modyfikowane są schody → przelicz długość z nowych wierzchołków
3. Przelicz stepDepth = nowa_długość / stepCount
4. Zaktualizuj UI w czasie rzeczywistym
```

### 4. Zmiana liczby stopni → przelicz tylko głębokość

Gdy użytkownik zmieni liczbę stopni w polu input:
```text
1. Oblicz aktualną długość z wierzchołków (nie zmieniaj kształtu!)
2. Przelicz: stepDepth = aktualna_długość / nowa_liczba_stopni
3. Zaktualizuj wyświetlanie stopni na rysunku
```

### 5. Poprawa renderowania linii stopni

Linie stopni będą teraz generowane na podstawie:
```text
Prostokąt:
├── Znajdź kierunek "długości" (dłuższa krawędź)
├── Dziel tę krawędź równomiernie na stepCount części
└── Rysuj linie prostopadłe do kierunku długości

Trójkąt 45°:
├── Znajdź punkt startowy (narożnik basenu)
├── Dziel każde ramię proporcjonalnie (i/stepCount)
└── Rysuj linie równoległe do przeciwprostokątnej
```

---

## Szczegóły techniczne

### Zmiany w `CustomPoolDrawer.tsx`

**Nowa funkcja:**
```typescript
const calculateDimensionsFromVertices = (vertices: Point[], type: 'rectangular' | 'diagonal'): {
  stairsLength: number;  // długość w kierunku schodzenia
  stairsWidth: number;   // szerokość schodów
  stepDepth: number;     // obliczona głębokość stopnia
} => {
  // Dla prostokąta: znajdź dłuższą i krótszą krawędź
  // Dla trójkąta: znajdź dłuższe ramię
  // Oblicz stepDepth = stairsLength / stairsStepCount
}
```

**Zmiany w obsłudze zdarzeń:**
1. `handleMouseDown` (zamknięcie kształtu) → wywołaj `calculateDimensionsFromVertices`
2. `handleObjectModified` (przeciągnięcie wierzchołka) → przelicz wymiary dla schodów
3. `handleStairsParamsChange` (zmiana stepCount) → NIE regeneruj kształtu, tylko przelicz stepDepth

**Zmiany w UI:**
- Wyświetlaj "Obliczona długość" zamiast "Długość schodów" gdy rysujesz ręcznie
- Pole "Głęb. stopnia" staje się tylko do odczytu (automatycznie obliczane)

### Zmiany w `Pool2DPreview.tsx`

Linie stopni dla basenów nieregularnych będą korzystać z nowej logiki:
```typescript
// Oblicz kierunek "długości" z dłuższej krawędzi
// Generuj linie stopni proporcjonalnie do stepCount
```

### Przepływ danych

```text
Użytkownik rysuje punkty
        ↓
Zamknięcie kształtu
        ↓
┌─────────────────────────────────┐
│ calculateDimensionsFromVertices │
│ ├── stairsLength = dłuższa krawędź
│ ├── stairsWidth = krótsza krawędź  
│ └── stepDepth = length / stepCount
└─────────────────────────────────┘
        ↓
Aktualizacja state: setStairsWidth, setStairsStepDepth
        ↓
Wyświetlenie w UI + toast
        ↓
Renderowanie stopni z nowymi parametrami
```

---

## Pliki do modyfikacji

| Plik | Zmiany |
|------|--------|
| `src/components/CustomPoolDrawer.tsx` | Dodanie `calculateDimensionsFromVertices`, modyfikacja obsługi zdarzeń |
| `src/components/Pool2DPreview.tsx` | Poprawa generowania linii stopni dla nieregularnych basenów |

## Oczekiwany rezultat

1. Po narysowaniu schodów ręcznie → system automatycznie wyliczy głębokość stopnia
2. Wyświetlana "Długość schodów" będzie zgadzać się z faktycznym kształtem
3. Zmiana liczby stopni → kształt pozostaje, zmienia się tylko głębokość stopnia
4. Linie stopni renderują się poprawnie, równomiernie rozłożone
