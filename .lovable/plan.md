
# Plan: Uproszczona logika tworzenia schodów

## Podsumowanie

Wprowadzenie zunifikowanego systemu schodów jako niezależnego bloku graficznego, który:
- Zawsze startuje od wybranego narożnika basenu (A, B, C, D...)
- Obsługuje 4 typy kształtów: prostokąt, trójkąt 45°, L-kształt, trójkąt nierównoramienny
- Umożliwia dwukierunkową synchronizację między parametrami liczbowymi a grafiką
- Działa identycznie dla basenów prostokątnych i nieregularnych

---

## Faza 1: Rozszerzenie modelu danych

### Plik: `src/types/configurator.ts`

Dodanie nowych typów i rozszerzenie interfejsu `StairsConfig`:

```text
Nowe typy:
- StairsShapeType = 'rectangular' | 'diagonal-45' | 'l-shape' | 'triangle'

Rozszerzony StairsConfig:
- shapeType: StairsShapeType (zastępuje "placement")
- cornerIndex: number (indeks narożnika 0=A, 1=B...)
- vertices?: Point[] (wierzchołki kształtu)

Parametry dla L-kształtu:
- legA?: number (długość ramienia A)
- legB?: number (długość ramienia B)
- legWidth?: number (szerokość ramion)

Parametry dla trójkąta nierównoramiennego:
- sideA?: number, sideB?: number, sideC?: number

Przyszłość:
- cornerRadius?: number (zaokrąglenia)
```

---

## Faza 2: Generator kształtów schodów

### Nowy plik: `src/lib/stairsShapeGenerator.ts`

Moduł generujący wierzchołki i linie stopni dla każdego typu schodów:

**Funkcje eksportowane:**
1. `generateRectangularStairs(cornerPos, poolCornerAngle, width, stepCount, stepDepth)` → vertices[]
2. `generateDiagonal45Stairs(cornerPos, poolCornerAngle, stepCount, stepDepth)` → vertices[]
3. `generateLShapeStairs(cornerPos, poolCornerAngle, legA, legB, legWidth)` → vertices[]
4. `generateTriangleStairs(cornerPos, poolCornerAngle, sideA, sideB, sideC)` → vertices[]
5. `calculateStepLines(vertices, stepCount, shapeType)` → stepLines[]

**Algorytm linii stopni dla L-kształtu:**
```text
      ┌───────────────┐
      │   Ramię A     │
      │  ─────────    │ ← stopnie równoległe do krótkiego boku
      │  ─────────    │
      ├────┬──────────┘
      │ 45°│ Zakręt trójkątny
      │ R  │  ───      
      │ a  │  ───      ← stopnie równoległe do krótkiego boku
      │ m  │  
      │ B  │
      └────┘
```

**Algorytm linii stopni dla trójkąta nierównoramiennego:**
- Identyfikacja najdłuższego boku
- Linie stopni równoległe do najdłuższego boku
- Podział odległości od wierzchołka do najdłuższego boku na stepCount części

---

## Faza 3: Aktualizacja edytora graficznego

### Plik: `src/components/CustomPoolDrawer.tsx`

**Zmiany:**

1. **Panel szablonów schodów** - rozszerzenie istniejącego UI:
   - 4 przyciski z ikonami: Prostokąt, 45°, L-kształt, Trójkąt
   - Dodatkowy tryb "Własny" dla pełnej edycji wierzchołków

2. **Wybór narożnika startowego:**
   - Dropdown z literami narożników (A, B, C, D...)
   - Alternatywnie: kliknięcie na narożnik basenu

3. **Parametry zależne od typu:**
   - Prostokąt: szerokość, liczba stopni, głębokość stopnia
   - 45°: liczba stopni, głębokość stopnia
   - L-kształt: ramię A, ramię B, szerokość ramion, liczba stopni, głębokość stopnia
   - Trójkąt: 3 boki, liczba stopni, głębokość stopnia

4. **Automatyczne generowanie kształtu:**
   - Przy wyborze szablonu i narożnika → automatyczna generacja wierzchołków
   - Wierzchołki pozycjonowane względem wybranego narożnika basenu
   - Kierunek zawsze do wewnątrz bryły basenu

5. **Dwukierunkowa synchronizacja:**
   - Zmiana parametrów → regeneracja wierzchołków z zachowaniem pozycji narożnika
   - Przeciąganie wierzchołków → przeliczenie parametrów (dla prostych kształtów)

---

## Faza 4: Aktualizacja wizualizacji 2D

### Plik: `src/components/pool/StairsPath2D.tsx`

**Zmiany:**

1. **Nowe typy kształtów:**
   - Rozszerzenie funkcji `getStairsRenderData()` o obsługę `'l-shape'` i `'triangle'`

2. **Linie stopni dla L-kształtu:**
   - Obliczenie punktu zakrętu (połączenie ramion)
   - Generowanie linii równoległych do krótkiego boku każdego ramienia
   - Trójkątny element przejściowy w zakręcie (45°)

3. **Linie stopni dla trójkąta nierównoramiennego:**
   - Identyfikacja najdłuższego boku
   - Linie równoległe do tego boku

---

## Faza 5: Aktualizacja wizualizacji 3D

### Plik: `src/components/pool/StairsMesh3D.tsx`

**Zmiany:**

1. **Nowe komponenty geometrii:**
   - `LShapeStairs` - generowanie geometrii L z użyciem `ExtrudeGeometry`
   - `TriangleStairs` - generowanie geometrii trójkąta nierównoramiennego

2. **Algorytm generowania stopni 3D dla L-kształtu:**
   - Podział całkowitej długości ścieżki (legA + zakręt + legB) na segmenty
   - Każdy stopień jako osobny mesh z odpowiednią pozycją Z
   - Zakręt realizowany jako klin trójkątny

3. **Algorytm dla trójkąta nierównoramiennego:**
   - Stopnie jako równoległe plastry do najdłuższego boku
   - Każdy stopień mniejszy od poprzedniego

---

## Faza 6: Uproszczenie interfejsu DimensionsStep

### Plik: `src/components/steps/DimensionsStep.tsx`

**Zmiany dla basenów prostokątnych:**

1. **Zastąpienie osobnych dropdownów** ("placement", "wall", "corner") przez:
   - Wybór typu schodów: 4 przyciski (Prostokąt, 45°, L, Trójkąt)
   - Wybór narożnika: A, B, C, D

2. **Parametry kontekstowe:**
   - Dynamiczne wyświetlanie pól w zależności od wybranego typu
   - L-kształt: 2 pola długości ramion + szerokość
   - Trójkąt: 3 pola długości boków

**Zmiany dla basenów nieregularnych:**
- Zachowanie obecnej logiki z przyciskiem "Edytuj w edytorze kształtu"
- Parametry schodów edytowalne zarówno w DimensionsStep jak i w edytorze

---

## Kolejność implementacji

| Krok | Opis | Pliki |
|------|------|-------|
| 1 | Rozszerzenie typów i StairsConfig | `configurator.ts` |
| 2 | Generator kształtów | `stairsShapeGenerator.ts` (NOWY) |
| 3 | Aktualizacja 2D | `StairsPath2D.tsx` |
| 4 | Aktualizacja 3D | `StairsMesh3D.tsx` |
| 5 | Edytor graficzny | `CustomPoolDrawer.tsx` |
| 6 | Interfejs główny | `DimensionsStep.tsx` |
| 7 | Testy i walidacja | Wszystkie komponenty |

---

## Szczegóły algorytmów

### Pozycjonowanie schodów od narożnika

```text
Dla narożnika A (index=0) w basenie prostokątnym:
- Pozycja bazowa: (0, 0) w układzie basenu
- Kierunek do wewnątrz: zależy od kątów ścian przyległych

Algorytm:
1. Pobierz współrzędne wybranego narożnika
2. Oblicz kąty obu przyległych ścian
3. Wybierz kierunek "do wewnątrz" jako bisektrysa kątów
4. Wygeneruj wierzchołki schodów względem tej pozycji i kierunku
```

### Walidacja geometrii

Przy każdej zmianie parametrów sprawdzenie:
- Czy schody mieszczą się w obrysie basenu
- Czy nie nachodzą na brodzik (jeśli włączony)
- Ostrzeżenie gdy schody > 30% powierzchni basenu

---

## Kompatybilność wsteczna

Istniejące oferty z zapisanymi schodami będą nadal działać:
- Stare wartości `placement: 'wall' | 'corner' | 'diagonal'` będą mapowane na nowe `shapeType`
- `placement: 'diagonal'` → `shapeType: 'diagonal-45'`
- `placement: 'wall'` / `'corner'` → `shapeType: 'rectangular'`

---

## Przyszłe rozszerzenia

Po zaimplementowaniu podstawowej logiki:
1. **Zaokrąglenia** - dodanie parametru `cornerRadius` do każdego typu
2. **Schody łukowe** - nowy typ `'arc'` dla półkolistych schodów
3. **Wielokrotne schody** - obsługa wielu zestawów schodów w jednym basenie
