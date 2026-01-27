
# Plan: Ujednolicony edytor kształtu basenu z oznaczeniami narożników

## Podsumowanie

Projekt polega na integracji logiki edytora kształtu z ręcznymi parametrami wymiarów. Każdy kształt (prostokątny, owalny, własny) będzie mógł być edytowany w graficznym edytorze. Narożniki będą oznaczone literami (A, B, C, D...), co pozwoli na logiczne definiowanie ścian (np. A-B). Schody będą mogły być umieszczane pod kątem 45° z narożnika, z możliwością wyboru kierunku strzałką.

## Zmiany w interfejsie użytkownika

### 1. Wybór kształtu basenu
```text
Obecny układ:
┌─────────────────────────────────────────────────┐
│  [Prostokąt] [Owal] [Własny kształt]            │
│                                                 │
│  (Osobne pola wymiarów dla prostokąt/owal)     │
│  (Edytor rysowania tylko dla "Własny kształt")  │
└─────────────────────────────────────────────────┘

Nowy układ:
┌─────────────────────────────────────────────────┐
│  [Prostokąt] [Owal] [Nieregularny]              │
│                                                 │
│  ┌─ Wymiary bazowe ─────────────────────┐       │
│  │ Długość: [10.0] m  Szerokość: [5.0] m│       │
│  │           [Otwórz edytor kształtu]   │       │
│  └──────────────────────────────────────┘       │
│                                                 │
│  (Podgląd 2D i 3D z literami A, B, C, D)       │
└─────────────────────────────────────────────────┘
```

### 2. Oznaczenie narożników literami
- Prostokąt: 4 narożniki A, B, C, D (zgodnie z ruchem wskazówek zegara)
- Nieregularny: N narożników A, B, C, D, E, F...
- Owal: bez literowania (kształt ciągły)

### 3. Edytor kształtu (ulepszony)
- Dla prostokąta: generuje bazowy prostokąt z wymiarów, można edytować wierzchołki
- Dla nieregularnego: rysowanie dowolnego wielokąta
- Literowanie narożników widoczne na canvasie i w panelu współrzędnych
- Schody 45° z narożnika - strzałka kierunku z krokiem 45° (8 kierunków)

## Szczegóły techniczne

### Zmiany w typach (`src/types/configurator.ts`)

1. Usunięcie `PoolShape = 'prostokatny' | 'owalny' | 'wlasny'`
2. Nowy typ: `PoolShape = 'prostokatny' | 'owalny' | 'nieregularny'`
3. Dodanie pola `stairsCornerLabel?: string` (np. 'A', 'B') do `StairsConfig`
4. Dodanie pola `stairsAngle?: number` (0, 45, 90, 135, 180, 225, 270, 315) - kąt kierunku schodów

### Zmiany w edytorze (`src/components/CustomPoolDrawer.tsx`)

1. **Generowanie z wymiarów**:
   - Przyjmowanie props `initialLength` i `initialWidth`
   - Automatyczne generowanie prostokąta o podanych wymiarach jako punkt startowy
   - Synchronizacja w obie strony (zmiana wierzchołków aktualizuje wymiary)

2. **Literowanie narożników**:
   - Dodanie etykiet (A, B, C, D...) przy każdym wierzchołku basenu
   - Wyświetlanie w canvasie i w panelu edycji współrzędnych
   - Nazewnictwo ścian: "Ściana A-B", "Ściana B-C" itd.

3. **Schody 45° z narożnika**:
   - Rozszerzenie rotacji schodów z 4 do 8 kierunków (co 45°)
   - Strzałka pokazująca kierunek wejścia
   - Możliwość wyboru narożnika dla schodów (A, B, C lub D)

### Zmiany w wizualizacji (`src/components/Pool2DPreview.tsx`, `Pool3DVisualization.tsx`)

1. **Literowanie narożników w podglądzie 2D**:
   - Dodanie etykiet A, B, C, D przy wierzchołkach prostokąta/nieregularnego

2. **Literowanie w 3D**:
   - Sprite/billboardy z literami przy narożnikach

### Zmiany w kroku wymiarów (`src/components/steps/DimensionsStep.tsx`)

1. **Zunifikowany flow**:
   - Pola długość/szerokość zawsze widoczne (dla prostokąta/owalu)
   - Przycisk "Edytuj w edytorze" otwiera dialog z wstępnie wygenerowanym kształtem
   - Zmiana w edytorze aktualizuje wymiary w formularzu

2. **Zmiana nazewnictwa**:
   - "Własny kształt" -> "Nieregularny"

## Przepływ danych

```text
┌─────────────────────────────────────────────────────────────────┐
│                         DimensionsStep                          │
│  ┌─────────────────┐    ┌──────────────────────────────────┐   │
│  │ Długość: 10m    │───>│                                  │   │
│  │ Szerokość: 5m   │    │         CustomPoolDrawer         │   │
│  │ [Edytuj kształt]│    │  ┌──────────────────────────┐    │   │
│  └─────────────────┘    │  │  A─────────────────────B │    │   │
│                         │  │  │                     │ │    │   │
│         Sync            │  │  │     (basen)        │ │    │   │
│        <──────>         │  │  │                     │ │    │   │
│                         │  │  D─────────────────────C │    │   │
│  ┌─────────────────┐    │  └──────────────────────────┘    │   │
│  │ Pool2DPreview   │<───│  Narożniki: A, B, C, D            │   │
│  │ Pool3DPreview   │    │  Schody: z narożnika A, kąt 45°   │   │
│  │ (z literami)    │    └──────────────────────────────────┘   │
│  └─────────────────┘                                           │
└─────────────────────────────────────────────────────────────────┘
```

## Lista zmian w plikach

### Pliki do modyfikacji:

1. **`src/types/configurator.ts`**
   - Zmiana `PoolShape` na `'prostokatny' | 'owalny' | 'nieregularny'`
   - Dodanie `stairsAngle` (8 kierunków) do `StairsConfig`
   - Aktualizacja etykiet

2. **`src/components/CustomPoolDrawer.tsx`**
   - Dodanie props: `initialLength`, `initialWidth`, `shape`
   - Funkcja generowania bazowego prostokąta
   - Literowanie narożników (A, B, C...)
   - Rozszerzenie rotacji schodów do 8 kierunków (co 45°)
   - Synchronizacja wymiarów z wielokątem

3. **`src/components/steps/DimensionsStep.tsx`**
   - Ujednolicenie wyboru kształtu (prostokąt/owal/nieregularny)
   - Przycisk "Edytuj kształt" dla wszystkich typów (oprócz owalu)
   - Przekazywanie długości/szerokości do edytora

4. **`src/components/Pool2DPreview.tsx`**
   - Dodanie etykiet literowych przy narożnikach
   - Wsparcie dla kształtu nieregularnego

5. **`src/components/Pool3DVisualization.tsx`**
   - Dodanie billboardów z literami przy narożnikach
   - Aktualizacja schodów 45°

6. **`src/context/ConfiguratorContext.tsx`**
   - Aktualizacja `initialDimensions` z nowym typem shape

## Zachowanie wstecznej kompatybilności

- Istniejące oferty z `shape: 'wlasny'` będą automatycznie mapowane na `'nieregularny'`
- Dane `customVertices` pozostają bez zmian
- Schody z 4-kierunkową rotacją będą działać nadal (tylko rozszerzamy do 8)
