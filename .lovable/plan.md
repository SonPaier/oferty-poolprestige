

## Plan: Domyslny bloczek 14cm + bloczki brodzik/schody + plyta brodzika

### 1. Domyslna wysokosc bloczka: 14cm

**Plik:** `src/components/steps/GroundworksStep.tsx`, linia 244

Zmiana:
```typescript
// PRZED:
const [blockHeight, setBlockHeight] = useState<BlockHeight>(12);
// PO:
const [blockHeight, setBlockHeight] = useState<BlockHeight>(14);
```

### 2. Nowy stan: grubosc plyty brodzika

**Plik:** `src/components/steps/GroundworksStep.tsx`, po linii 244

Dodanie nowych zmiennych stanu:
```typescript
const [wadingPoolSlabHeight, setWadingPoolSlabHeight] = useState<number>(0.20);
const [wadingPoolSlabOverride, setWadingPoolSlabOverride] = useState(false);
```

### 3. Obliczenie warstw bloczkow brodzika i plyty brodzika

**Plik:** `src/components/steps/GroundworksStep.tsx`

Nowy `useMemo` obliczajacy bloczki brodzika:
- Uzywa `calculateBlockLayers(wadingPool.depth, blockHeight)` -- ten sam algorytm co basen
- Wynik `crownHeight` z algorytmu = grubosc plyty brodzika (18-30cm)
- Obwod wewnetrzny (sciany nie wspolne z basenem) = `width + length` (2 sciany, bo brodzik w narozyniku dzieli 2 sciany z basenem)
- Bloczki brodzika = `layers * Math.ceil((width + length) / 0.38)`

Automatyczna aktualizacja `wadingPoolSlabHeight` gdy nie ma recznego override:
```typescript
const wpBlockCalc = calculateBlockLayers(wadingPool.depth, blockHeight);
if (!wadingPoolSlabOverride) {
  setWadingPoolSlabHeight(wpBlockCalc.crownHeight);
}
```

### 4. Obliczenie bloczkow za schody

**Plik:** `src/components/steps/GroundworksStep.tsx`

```typescript
const stairsBlocks = dimensions.stairs?.enabled
  ? Math.ceil((stairs.stepCount * stairsWidth) / BLOCK_DIMENSIONS.length)
  : 0;
```

Gdzie `stairsWidth` = `stairs.width === 'full' ? dimensions.width : stairs.width` (lub odpowiedni bok).

### 5. Aktualizacja sumy bloczkow

**Plik:** `src/components/steps/GroundworksStep.tsx`, useEffect aktualizujacy constructionMaterials (~linia 402)

Zmiana ilosci bloczkow z `blockCalculation.totalBlocks` na:
```typescript
const totalBlocks = (blockCalculation?.totalBlocks || 0) + wadingPoolBlocks + stairsBlocks;
```

Dotyczy zarowno tworzenia nowej pozycji jak i aktualizacji istniejacej.

### 6. Aktualizacja getExpectedMaterialQuantity('bloczek')

**Plik:** `src/components/steps/GroundworksStep.tsx`, linia 572-573

Zmiana:
```typescript
case 'bloczek':
  return (blockCalculation?.totalBlocks || 0) + wadingPoolBlocks + stairsBlocks;
```

### 7. Beton B25 brodzik -- uzycie plyty brodzika

**Plik:** `src/components/steps/GroundworksStep.tsx`, linia 531

Zmiana wzoru z `floorSlabThickness` na `wadingPoolSlabHeight`:
```typescript
// PRZED:
const wpVolume = (wadingPool.width || 0) * (wadingPool.length || 0) * floorSlabThickness;
// PO:
const wpVolume = (wadingPool.width || 0) * (wadingPool.length || 0) * wadingPoolSlabHeight;
```

Analogicznie w `getExpectedB25SubItemQuantity` (linia 597).

### 8. UI: pole grubosci plyty brodzika

**Plik:** `src/components/steps/GroundworksStep.tsx`, w sekcji parametrow budowy (obok selektora wysokosci bloczka, ~linia 1976)

Gdy brodzik wlaczony, wyswietlic:
- Label: "Grub. plyty brodzika (cm)"
- Input z wartoscia `wadingPoolSlabHeight * 100`
- Walidacja: 18-30cm
- Przycisk reset gdy `wadingPoolSlabOverride === true`

### Podsumowanie zmian

| Plik | Zmiany |
|------|--------|
| `src/components/steps/GroundworksStep.tsx` | Domyslny blockHeight=14, stan wadingPoolSlabHeight, obliczenia bloczkow brodzik+schody, suma bloczkow, B25 brodzik z plyta brodzika, UI pole grubosci plyty brodzika, reset |

