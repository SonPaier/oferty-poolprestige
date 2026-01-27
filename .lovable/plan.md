
# Plan naprawy wizualizacji 3D schodów

## Podsumowanie problemów

Na podstawie analizy kodu i przesłanych zrzutów ekranu zidentyfikowano następujące problemy:

1. **Schody 45° są odwrócone** - geometria trójkątna nie renderuje się poprawnie
2. **Schody w 3D mają nieprawidłowe wymiary** - widoczne na zrzucie: 2.80m × 1.60m zamiast rzeczywistych wartości
3. **Zmiana ilości stopni nie aktualizuje rozmiaru schodów 45°** - dla schodów od ściany/narożnika działa poprawnie, ale dla 45° logika jest inna
4. **Linie wymiarowe pokazują złe wartości** - używają starego obliczenia opartego na wysokości stopnia zamiast `stepCount`

---

## Planowane zmiany

### 1. Naprawa obliczeń rozmiaru schodów 45° w 3D

**Plik:** `src/components/Pool3DVisualization.tsx`

**Problem:** Schody 45° używają stałej wartości `actualStairsWidth` zamiast dynamicznie obliczonej wielkości bazującej na ilości stopni i głębokości stopnia.

**Rozwiązanie:** Dla schodów 45° (trójkątnych), każdy bok trójkąta powinien być równy:
```
diagonalSize = stepCount × stepDepth
```

Gdzie:
- `stepCount` = ilość stopni wybrana przez użytkownika (2-15)
- `stepDepth` = głębokość stopnia (domyślnie 30cm)

Każdy następny stopień będzie mniejszym trójkątem, gdzie rozmiar zmniejsza się proporcjonalnie.

### 2. Naprawa linii wymiarowych dla schodów

**Plik:** `src/components/Pool3DVisualization.tsx` (funkcja `StairsDimensionLines`)

**Problem:** Obecny kod używa:
```javascript
const stepCount = Math.ceil(depth / (stairs.stepHeight || 0.29));
const stairsLength = stepCount * (stairs.stepDepth || 0.29);
```

**Rozwiązanie:** Zmiana na używanie `stairs.stepCount` z konfiguracji:
```javascript
const stepCount = stairs.stepCount || 4;
const stairsLength = stepCount * (stairs.stepDepth || 0.30);
```

### 3. Synchronizacja wymiarów 2D i 3D dla schodów 45°

**Plik:** `src/components/Pool2DPreview.tsx`

**Problem:** W 2D używany jest `stairsWidth` jako rozmiar trójkąta, ale dla schodów 45° rozmiar powinien zależeć od `stepCount × stepDepth`.

**Rozwiązanie:** Dla `placement === 'diagonal'`:
```javascript
const diagonalSize = stepCount * stepDepth;
outline = [
  { x: baseX, y: baseY },
  { x: baseX + xDir * diagonalSize, y: baseY },
  { x: baseX, y: baseY + yDir * diagonalSize }
];
```

### 4. Naprawa generowania stopni trójkątnych

**Plik:** `src/components/Pool3DVisualization.tsx` (sekcja diagonal w `StairsMesh`)

**Problem:** Obecna logika używa `remainingSize = actualStairsWidth * (1 - stepProgress)`, co nie skaluje się poprawnie z ilością stopni.

**Rozwiązanie:** Zmiana logiki na:
```javascript
const diagonalSize = actualStepCount * actualStepDepth;
// Każdy stopień jest mniejszym trójkątem
for (let i = 0; i < actualStepCount; i++) {
  const progress = (i + 1) / actualStepCount;
  const remainingSize = diagonalSize * (1 - progress);
  // ... generowanie geometrii
}
```

---

## Szczegóły techniczne

### Zmiana w Pool3DVisualization.tsx - StairsMesh (diagonal)

```text
Przed (linie ~549-619):
- actualStairsWidth używane jako baza rozmiaru trójkąta
- remainingSize = actualStairsWidth * (1 - stepProgress)

Po:
- diagonalSize = actualStepCount * actualStepDepth
- remainingSize = diagonalSize * (1 - (i+1)/actualStepCount)
```

### Zmiana w Pool3DVisualization.tsx - StairsDimensionLines

```text
Przed (linie ~1155-1156):
const stepCount = Math.ceil(depth / (stairs.stepHeight || 0.29));
const stairsLength = stepCount * (stairs.stepDepth || 0.29);

Po:
const stepCount = stairs.stepCount || 4;
const stairsLength = stepCount * (stairs.stepDepth || 0.30);
```

### Zmiana w Pool2DPreview.tsx - getRegularStairsData (diagonal)

```text
Przed (linie ~97-120):
- Używa stairsWidth jako rozmiar boku trójkąta

Po:
- Dla diagonal: diagonalSize = stepCount * stepDepth
- Trójkąt o bokach diagonalSize × diagonalSize
```

---

## Weryfikacja

Po wprowadzeniu zmian:

1. ✅ Zmiana ilości stopni (np. z 4 na 6) powinna zwiększać rozmiar schodów 45° zarówno w 2D jak i 3D
2. ✅ Linie wymiarowe powinny pokazywać prawidłowe wartości odpowiadające konfiguracji
3. ✅ Schody prostokątne (od ściany, z narożnika) powinny działać bez zmian
4. ✅ Geometria trójkątna powinna być poprawnie zorientowana (nie do góry nogami)
