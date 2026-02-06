

## Plan: Wysokosc bloczka + Beton B25 na brodzik i schody

### 1. Opcja wyboru wysokosci bloczka (12cm / 14cm)

**Gdzie:** `src/components/groundworks/ReinforcementSection.tsx`

- Dodanie nowego typu `BlockHeight = 12 | 14` i zmiennej stanu w `GroundworksStep.tsx`
- Zmiana stalej `BLOCK_DIMENSIONS.height` na parametr przekazywany do funkcji obliczeniowych (`calculateBlockLayers`, `calculateTotalBlocks`, `calculateBlocksPerLayer`)
- Dodanie selektora (Select lub RadioGroup) w sekcji "Parametry budowy" w `GroundworksStep.tsx` pozwalajacego wybrac 12cm lub 14cm
- Aktualizacja nazwy pozycji w tabeli materialow: "Bloczek betonowy 38x24x12" -> "Bloczek betonowy 38x24x14" dynamicznie
- Zmiana wpływa na: liczbe warstw, wysokosc wieniec, ilosc bloczkow

### 2. Beton B25 na brodzik

**Gdzie:** `src/components/steps/GroundworksStep.tsx` (useEffect aktualizujacy `b25ConcreteGroup`)

- Dodanie nowej podpozycji `beton_brodzik` w grupie B25 gdy `dimensions.wadingPool?.enabled`
- Wzor: `wadingPool.width * wadingPool.length * floorSlabThickness`
- Wyswietlanie analogicznie do "Plyta denna", "Wieniec", "Slupy"

### 3. Beton B25 na schody

**Gdzie:** `src/components/steps/GroundworksStep.tsx` (useEffect aktualizujacy `b25ConcreteGroup`)

- Dodanie nowej podpozycji `beton_schody` w grupie B25 gdy `dimensions.stairs?.enabled`
- Wzor: `stairsProjectionArea * floorSlabThickness` (powierzchnia rzutu schodow * grubosc plyty)
- Wyswietlanie analogicznie do innych podpozycji B25

### 4. Aktualizacja `getExpectedB25SubItemQuantity`

- Dodanie case'ow `beton_brodzik` i `beton_schody` aby funkcja reset dzialala poprawnie

### Zmiany w plikach

| Plik | Zakres zmian |
|------|-------------|
| `src/components/groundworks/ReinforcementSection.tsx` | Parametryzacja `BLOCK_DIMENSIONS.height`, aktualizacja sygnatur funkcji `calculateBlockLayers`, `calculateTotalBlocks`, `calculateBlocksPerLayer` aby przyjmowaly `blockHeight` |
| `src/components/steps/GroundworksStep.tsx` | Dodanie stanu `blockHeight`, selektora UI, przekazanie do obliczen bloczków, dodanie podpozycji B25 brodzik/schody, aktualizacja nazwy bloczka |

