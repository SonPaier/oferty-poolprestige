
# Plan: Dodanie mozliwosci zmiany ilosci slupow na rzucie 2D basenu

## Cel
Umozliwienie uzytkownikowi recznej zmiany ilosci slupow konstrukcyjnych (S1, S2, itd.) wyswietlanych na wizualizacji 2D basenu w sekcji Prace budowlane. Zmiana ilosci slupow bedzie wplywala na obliczenia materialow (beton na slupy, zbrojenie slupow, ilosc bloczkow).

## Obecny stan
- Slupy sa automatycznie rozmieszczane co 2m wzdluz scian basenu
- Ilosc slupow jest obliczana wg formuly: `floor(length/2) - 1` dla kazdej sciany
- Uzytkownik nie ma mozliwosci zmiany tej ilosci
- Wizualizacja 2D pokazuje slupy jako pomaranczowe kwadraty 24x24cm

## Proponowane rozwiazanie

### 1. Nowy interfejs kontroli slupow
Dodanie panelu pod wizualizacja 2D z:
- Slajderem lub inputem do zmiany ilosci slupow dla kazdej pary scian (dlugosc/szerokosc)
- Wyswietlanie aktualnej ilosci slupow
- Przycisk resetu do wartosci obliczonej automatycznie

### 2. Modyfikacja Pool2DPreview
Rozszerzenie props komponentu:
```text
interface Pool2DPreviewProps {
  dimensions: PoolDimensions;
  height?: number;
  dimensionDisplay?: DimensionDisplay;
  showColumns?: boolean;
  customColumnCounts?: { // NOWE
    lengthWalls: number;  // slupy na scianach dlugosci (gora/dol)
    widthWalls: number;   // slupy na scianach szerokosci (lewa/prawa)
  };
  onColumnCountsChange?: (counts: { lengthWalls: number; widthWalls: number }) => void; // NOWE - callback zmiany
}
```

### 3. Logika rozmieszczenia slupow
Nowa funkcja `calculateColumnPositionsWithCount()` ktora:
- Przyjmuje liczbe slupow na sciany dlugosci i szerokosci
- Rozmieszcza slupy rownomiernie wzdluz scian
- Zachowuje minimalna/maksymalna odleglosc od naroznikow

### 4. Integracja z obliczeniami materialow
Stan `customColumnCounts` w GroundworksStep bedzie przekazywany do:
- `Pool2DPreview` - dla wizualizacji
- `calculateColumnsConcreteVolume()` - dla betonu na slupy
- `calculateBlocksPerLayer()` - dla ilosci bloczkow (minus miejsce zajete przez slupy)
- `useReinforcement` hook - dla zbrojenia slupow

## Szczegoly techniczne

### Pliki do modyfikacji

**1. `src/components/Pool2DPreview.tsx`**
- Rozszerzenie interfejsu props o `customColumnCounts` i `onColumnCountsChange`
- Modyfikacja `useMemo` dla `columnPositions` aby uwzglednic niestandardowe ilosci
- Nowa funkcja `distributeColumnsEvenly()` dla rownego rozmieszczenia

**2. `src/components/steps/GroundworksStep.tsx`**
- Nowy stan `customColumnCounts` z domyslnymi wartosciami obliczonymi automatycznie
- Panel kontroli ilosci slupow pod wizualizacja 2D
- Przekazanie stanu do Pool2DPreview i funkcji obliczeniowych
- Aktualizacja `blockCalculation` z niestandardowa iloscia slupow

**3. `src/components/groundworks/ReinforcementSection.tsx`**
- Modyfikacja `calculateColumns()` aby przyjmowala opcjonalna niestandardowa ilosc
- Modyfikacja `calculateColumnsConcreteVolume()` aby przyjmowala niestandardowa ilosc
- Modyfikacja `calculateBlocksPerLayer()` dla niestandardowej ilosci slupow

### Nowy komponent UI
Dodanie do sekcji wizualizacji 2D:
```text
+------------------------------------------+
| Rozmieszczenie slupow (widok 2D)         |
+------------------------------------------+
|   [Wizualizacja 2D basenu ze slupami]    |
+------------------------------------------+
| Slupy na scianach dlugosci: [3] [-][+]   |
| Slupy na scianach szerokosci: [1] [-][+] |
| Razem slupow: 8                          |
| [Przywroc domyslne]                      |
+------------------------------------------+
```

### Walidacja
- Minimalna ilosc slupow: 0 (brak slupow)
- Maksymalna ilosc: `floor(wallLength / 1.5)` - max co 1.5m
- Wartosc domyslna: automatycznie obliczona wg obecnej logiki (co 2m)

## Wplyw na obliczenia

| Element | Obecne | Po zmianie |
|---------|--------|------------|
| Beton na slupy | column_count * 0.24 * 0.24 * height | Uzywac customColumnCount |
| Zbrojenie slupow | column_count * 4 * bar_length | Uzywac customColumnCount |
| Bloczki na warstwe | (perimeter - column_count * 0.24) / 0.38 | Uzywac customColumnCount |

## Kroki implementacji

1. Rozszerzenie interfejsu Pool2DPreviewProps o nowe propsy
2. Modyfikacja logiki rozmieszczenia slupow w Pool2DPreview
3. Dodanie stanu i kontroli w GroundworksStep
4. Aktualizacja funkcji obliczeniowych w ReinforcementSection
5. Synchronizacja ilosci slupow z obliczeniami materialow
