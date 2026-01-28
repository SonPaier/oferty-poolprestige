
# Plan: Naprawienie kierunku generowania stopni 45° w 3D

## Problem

Schody ukośne (45°) są generowane w odwrotnym kierunku w widoku 3D:
- **Aktualnie**: Pierwszy stopień (i=0, najwyższy pod wodą) jest **największy** (przy przekątnej)
- **Oczekiwane**: Pierwszy stopień powinien być **najmniejszy** (przy narożniku), ostatni największy

W widoku 2D schody renderują się poprawnie - najmniejszy stopień jest przy narożniku A.

## Przyczyna

W komponencie `DiagonalStairs3D` (StairsMesh3D.tsx), logika obliczania trapezów jest odwrócona:

```typescript
// Aktualnie (źle):
const outerRatio = i / stepCount;     // step 0 → 0
const innerRatio = (i + 1) / stepCount;
// Potem: (1 - outerRatio) = 1.0 dla step 0 → pełny rozmiar trójkąta
```

## Rozwiązanie

Odwrócić kierunek generowania - pierwszy stopień (i=0) powinien zaczynać od narożnika (najmniejszy), ostatni przy przekątnej (największy):

```typescript
// Poprawnie:
// step 0 → innerRatio = 1/stepCount (mały trójkąt przy narożniku)
// step N-1 → innerRatio = 1.0 (pełny rozmiar przy przekątnej)
const innerRatio = (i + 1) / stepCount;  // step 0 → 0.25 dla 4 stopni
const outerRatio = i / stepCount;        // step 0 → 0

// Zamiast (1 - ratio), używamy samego ratio:
// inner1x = v0.x + dx1 * innerRatio * diagonalSize
// outer1x = v0.x + dx1 * outerRatio * diagonalSize
```

## Zmiany w plikach

### 1. `src/components/pool/StairsMesh3D.tsx`

**Funkcja `DiagonalStairs3D`** (linie ~298-375):

Zmiana logiki obliczania pozycji wierzchołków trapezów:

- **Przed**: `(1 - outerRatio)` i `(1 - innerRatio)` - odliczanie od hypotenuse do narożnika
- **Po**: `outerRatio` i `innerRatio` - odliczanie od narożnika do hypotenuse

Konkretne zmiany:
- Linia 331-334: Zamiana `(1 - outerRatio)` na `outerRatio`
- Linia 337-340: Zamiana `(1 - innerRatio)` na `innerRatio`

To sprawi, że:
- Step 0 (najwyższy, Z = -stepHeight): mały trapez przy narożniku
- Step N-1 (najgłębszy, Z = -N*stepHeight): duży trapez przy hypotenuse

## Efekt końcowy

Po zmianie schody 45° w 3D będą renderowane identycznie jak w 2D:
- Najmniejszy stopień przy narożniku basenu (najwyżej)
- Największy stopień przy przekątnej (najgłębiej)
