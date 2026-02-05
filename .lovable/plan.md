
# Plan: Obliczanie warstw bloczków i wysokości wieńca

## Opis zadania
Dodanie inteligentnej logiki obliczania liczby warstw bloczków betonowych oraz optymalnej wysokości wieńca, tak aby nie było konieczności docinania bloczków.

## Dane wejściowe - wymiary bloczka
- Długość: **38 cm** (0.38 m)
- Szerokość: **24 cm** (0.24 m) - grubość ściany basenu
- Wysokość: **12 cm** (0.12 m) - bloczki układane "na leżąco"

## Przykład obliczeniowy

### Dane basenu:
- Długość wewnętrzna: **8 m**
- Szerokość wewnętrzna: **4 m**  
- Głębokość: **1.5 m**
- Technologia: **bloczek betonowy (murowany)**

### Krok 1: Obliczenie liczby warstw bloczków

```text
Głębokość basenu: 1.5 m = 150 cm
Wysokość bloczka: 12 cm

Warstwy bloczków = floor(150 / 12) = 12 warstw
Wysokość 12 warstw = 12 × 12 = 144 cm
```

### Krok 2: Obliczenie wysokości wieńca

```text
Pozostała wysokość = 150 - 144 = 6 cm

Wieniec musi mieć min. 18 cm, optymalnie 24 cm
6 cm < 18 cm → za mało!

Rozwiązanie: zmniejszamy liczbę warstw o 1
11 warstw × 12 cm = 132 cm
Pozostała wysokość = 150 - 132 = 18 cm ← dokładnie minimum!

Ale 18 cm to minimum - sprawdzamy opcję z 10 warstwami:
10 warstw × 12 cm = 120 cm
Pozostała wysokość = 150 - 120 = 30 cm ← za dużo (powyżej 24 cm)

Algorytm wyboru:
- Jeśli pozostała wysokość >= 18 cm i <= 24 cm → OK
- Jeśli pozostała wysokość < 18 cm → zmniejsz warstwy
- Jeśli pozostała wysokość > 24 cm → zwiększ warstwy (ale może wymagać docinania)
```

### Krok 3: Obliczenie ilości bloczków w warstwie

```text
Obwód wewnętrzny basenu = 2 × (8 + 4) = 24 m = 2400 cm
Długość bloczka = 38 cm
Szerokość słupa = 24 cm

Liczba słupów:
- Wzdłuż długości (8m): floor(8 / 2) - 1 = 3 słupy × 2 ściany = 6 słupów
- Wzdłuż szerokości (4m): floor(4 / 2) - 1 = 1 słup × 2 ściany = 2 słupy
- Razem: 8 słupów

Miejsce zajęte przez słupy w warstwie = 8 × 24 cm = 192 cm

Efektywna długość na bloczki = 2400 - 192 = 2208 cm
Bloczki w warstwie = ceil(2208 / 38) = ceil(58.1) = 59 bloczków

Całkowita ilość bloczków = 59 × 11 warstw = 649 sztuk
```

### Podsumowanie przykładu:
| Parametr | Wartość |
|----------|---------|
| Głębokość basenu | 150 cm |
| Warstwy bloczków | 11 |
| Wysokość murowanej ściany | 132 cm |
| Wysokość wieńca | 18 cm |
| Bloczki w warstwie | 59 szt. |
| **Razem bloczków** | **649 szt.** |

## Zmiany w kodzie

### 1. Rozszerzenie `ReinforcementSection.tsx`

Dodanie nowych funkcji obliczeniowych:

```typescript
// Wymiary bloczka betonowego
const BLOCK_DIMENSIONS = {
  length: 0.38, // 38 cm
  width: 0.24,  // 24 cm (grubość ściany)
  height: 0.12, // 12 cm (układany na leżąco)
};

// Oblicz optymalną liczbę warstw i wysokość wieńca
function calculateBlockLayers(poolDepth: number): {
  layers: number;
  wallHeight: number;
  crownHeight: number;
} {
  const blockHeight = BLOCK_DIMENSIONS.height; // 0.12m
  const minCrownHeight = 0.18; // 18 cm minimum
  const optimalCrownHeight = 0.24; // 24 cm optimal
  
  // Maksymalna liczba warstw (gdyby nie było wieńca)
  const maxLayers = Math.floor(poolDepth / blockHeight);
  
  // Szukamy optymalnej liczby warstw
  for (let layers = maxLayers; layers >= 1; layers--) {
    const wallHeight = layers * blockHeight;
    const crownHeight = poolDepth - wallHeight;
    
    // Wieniec musi być min. 18 cm, max ~30 cm (optymalnie 24 cm)
    if (crownHeight >= minCrownHeight && crownHeight <= 0.30) {
      return { layers, wallHeight, crownHeight };
    }
  }
  
  // Fallback - użyj minimalnej wysokości wieńca
  const layers = Math.floor((poolDepth - minCrownHeight) / blockHeight);
  return {
    layers,
    wallHeight: layers * blockHeight,
    crownHeight: poolDepth - (layers * blockHeight),
  };
}

// Oblicz ilość bloczków w warstwie
function calculateBlocksPerLayer(
  poolLength: number,
  poolWidth: number,
  columnCount: number
): number {
  const perimeter = 2 * (poolLength + poolWidth); // m
  const columnWidth = BLOCK_DIMENSIONS.width; // 0.24m
  const blockLength = BLOCK_DIMENSIONS.length; // 0.38m
  
  // Odejmij miejsce zajęte przez słupy
  const effectiveLength = perimeter - (columnCount * columnWidth);
  
  return Math.ceil(effectiveLength / blockLength);
}
```

### 2. Modyfikacja UI w `GroundworksStep.tsx`

Dodanie do zakładki "Parametry budowy" (tylko dla technologii murowanej):

```text
┌─────────────────────────────────────────────────┐
│ Konstrukcja murowana                            │
├─────────────────────────────────────────────────┤
│ Warstwy bloczków:  [11] (wyliczone: 11)        │
│ Wysokość ściany:   132 cm                       │
│ Wysokość wieńca:   [18] cm (min. 18, opt. 24)  │
│                                                 │
│ ℹ️ Bloczek 38×24×12 cm, słupy co 2m            │
└─────────────────────────────────────────────────┘
```

### 3. Nowa pozycja w tabeli materiałów

| Nazwa materiału | Ilość | Jednostka | Stawka | Wartość |
|-----------------|-------|-----------|--------|---------|
| Bloczek betonowy 38×24×12 | 649 | szt. | 8.50 | 5 516,50 zł |

### 4. Rozszerzenie stanu komponentu

Nowe zmienne stanu:
- `blockLayers` - liczba warstw (edytowalna)
- `crownHeight` - wysokość wieńca (edytowalna, min. 18 cm)
- `blocksPerLayer` - bloczki w warstwie (wyliczane)
- `totalBlocks` - całkowita ilość (warstwy × bloczki)

### 5. Walidacja i feedback

- Ostrzeżenie gdy wieniec < 18 cm
- Info gdy wysokość wieńca = 24 cm (optymalna)
- Przeliczenie przy zmianie głębokości basenu

## Pliki do modyfikacji
1. `src/components/groundworks/ReinforcementSection.tsx` - nowe funkcje obliczeniowe
2. `src/components/steps/GroundworksStep.tsx` - UI, stan, nowa pozycja materiału

## Rezultat
- Automatyczne obliczanie optymalnej liczby warstw bloczków
- Wyświetlanie wyliczonej wysokości wieńca z możliwością edycji
- Nowa pozycja "Bloczek betonowy" w tabeli kosztów materiałów
- Uwzględnienie słupów (24 cm) przy obliczaniu ilości bloczków w warstwie
