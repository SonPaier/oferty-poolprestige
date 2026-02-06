

# Plan: Ocieplenie basenu, głębokość wykopu i zasypka

## Cel
1. Dodanie w sekcji **Prace budowlane** opcji ocieplenia:
   - **Dno**: brak / XPS fundamentowy 5cm / XPS fundamentowy 10cm
   - **Ściany**: brak / Hydropian 10cm / Styrodur 10cm / Piana PUR 5cm
2. **Poprawienie formuły głębokości wykopu** - obecnie nie uwzględnia wszystkich warstw
3. Dodanie w sekcji **Roboty ziemne** pozycji **"Zasypka"** - ilość ziemi do zakopania wykopu

## Poprawiona formuła głębokości wykopu

### Obecna (błędna):
```
Głębokość wykopu = głębokość basenu + margines (1m)
```

### Poprawna formuła:
```
Głębokość wykopu = głębokość basenu + płyta denna + ocieplenie dna + chudziak + podsypka
```

| Warstwa | Grubość domyślna |
|---------|------------------|
| Głębokość basenu | 1.5m (zmienna) |
| Płyta denna | 20cm |
| Ocieplenie dna (opcja) | 0 / 5cm / 10cm |
| Chudziak (B15) | 10cm |
| Podsypka piaskowa | 10cm |

### Dla basenu 8×4×1.5m bez ocieplenia:
```
Głębokość wykopu = 1.5 + 0.2 + 0 + 0.1 + 0.1 = 1.9m
```

### Z ociepleniem XPS 5cm:
```
Głębokość wykopu = 1.5 + 0.2 + 0.05 + 0.1 + 0.1 = 1.95m
```

## Obliczenia dla basenu 8×4×1.5m

### Wymiary wykopu (z marginesem 1m na boki)
- Długość wykopu: 8 + 2 = **10m**
- Szerokość wykopu: 4 + 2 = **6m**
- Głębokość wykopu (bez ocieplenia): 1.5 + 0.2 + 0.1 + 0.1 = **1.9m**

### Objętości

| Element | Wzór | Wynik |
|---------|------|-------|
| **Objętość wykopu** | 10 × 6 × 1.9 | **114 m³** |
| **Podsypka piaskowa** | 10 × 6 × 0.1 | **6 m³** |

### Wymiary zewnętrzne konstrukcji basenu
- Grubość ścian (bloczek): 0.24m
- Grubość płyty dennej: 0.20m
- Grubość chudziaka: 0.10m

**Bez ocieplenia:**
- Długość zewn.: 8 + (0.24 × 2) = **8.48m**
- Szerokość zewn.: 4 + (0.24 × 2) = **4.48m**
- Wysokość konstrukcji: 1.5 + 0.2 + 0.1 = **1.8m** (głębokość + płyta + chudziak)

**Objętość konstrukcji:** 8.48 × 4.48 × 1.8 = **68.4 m³**

### Obliczenie zasypki
```
Zasypka = Objętość wykopu - Podsypka - Konstrukcja
Zasypka = 114 - 6 - 68.4 = 39.6 m³
```

### Z ociepleniem (XPS dno 5cm + Styrodur ściany 10cm)
- Głębokość wykopu: 1.5 + 0.2 + 0.05 + 0.1 + 0.1 = **1.95m**
- Objętość wykopu: 10 × 6 × 1.95 = **117 m³**
- Wymiary zewn. konstrukcji: 8.68 × 4.68 × 1.85m
- Objętość konstrukcji: **75.1 m³**
- **Zasypka: 117 - 6 - 75.1 = 35.9 m³**

## Szczegóły techniczne

### 1. Nowe typy w `src/types/offers.ts`

```
FloorInsulationType: 'none' | 'xps-5cm' | 'xps-10cm'
WallInsulationType: 'none' | 'hydropian-10cm' | 'styrodur-10cm' | 'pur-5cm'

Grubości:
- XPS 5cm = 0.05m
- XPS 10cm = 0.10m
- Hydropian/Styrodur 10cm = 0.10m
- PUR 5cm = 0.05m
```

### 2. Modyfikacja `src/components/steps/GroundworksStep.tsx`

**Nowe stany:**
- `floorInsulation` - typ ocieplenia dna
- `wallInsulation` - typ ocieplenia ścian

**Zmiana formuły głębokości wykopu:**
```typescript
// Poprawiona formuła głębokości wykopu
const floorInsThickness = floorInsulationThickness[floorInsulation];
const excDepth = dimensions.depth + floorSlabThickness + floorInsThickness + leanConcreteHeight + sandBeddingHeight;
```

**Nowa pozycja "Zasypka" w tabeli robót ziemnych:**
- Automatycznie obliczana na podstawie objętości wykopu, podsypki i konstrukcji

**UI - sekcja ocieplenia w zakładce "Prace budowlane":**
- Select dla ocieplenia dna (XPS 5cm / 10cm / brak)
- Select dla ocieplenia ścian (Hydropian / Styrodur / PUR / brak)

### 3. Nowe stawki materiałowe

Rozszerzenie `ConstructionMaterialRates` o:
- `hydropian10cm` - stawka za m²
- `purFoam5cm` - stawka za m²
(XPS już istnieje jako `styrodur5cm` i `styrodur10cm`)

## Pliki do modyfikacji

1. **`src/types/offers.ts`** - typy ocieplenia i ich grubości
2. **`src/types/configurator.ts`** - nowe stawki w ConstructionMaterialRates
3. **`src/components/steps/GroundworksStep.tsx`**:
   - Nowe stany ocieplenia
   - Poprawiona formuła głębokości wykopu
   - Pozycja "Zasypka" w tabeli robót ziemnych
   - UI dla wyboru ocieplenia
   - Pozycje materiałowe dla ocieplenia

## Kroki implementacji

1. Rozszerzenie typów o typy ocieplenia i grubości
2. Dodanie nowych stawek materiałowych (hydropian, PUR)
3. Poprawienie formuły głębokości wykopu w GroundworksStep
4. Dodanie stanów ocieplenia i ich UI w sekcji Prace budowlane
5. Dodanie pozycji "Zasypka" do tabeli robót ziemnych
6. Dodanie pozycji materiałowych dla ocieplenia

