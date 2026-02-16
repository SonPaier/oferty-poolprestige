
# Plan: Nowe materialy w tabeli kroku 4 (Wykonczenie)

## Zakres zmian

Kompletna przebudowa listy materialow wykoczeniowych w kroku 4. Zamiast obecnych 7 pozycji (z `finishingMaterials.ts`) pojawia sie 12 nowych pozycji z calkowicie nowa logika obliczen, plus mozliwosc recznego dodawania pozycji (jak w kroku 3).

## Nowa lista materialow

| # | Nazwa | Jedn. | Cena | Logika obliczen |
|---|-------|-------|------|-----------------|
| 1 | Folie (bez zmian) | m2 | wg podtypu | Bez zmian - obecna logika |
| 2a | Podklad zwykly (rolka 2m) | m2 | 16 zl/m2 | Dno: pasy 2m (ceil(width/2) * length * 2). Sciany: obwod * 2m |
| 2b | Podklad impregnowany (1.5m + 2m) | m2 | 32 zl/m2 | Jak wyzej ale optymalizacja miedzy szerokosciami 1.5m i 2m (minimalizacja odpadu) |
| 3 | Klej do podkladu 20kg | szt | 400 zl | ceil(totalArea / 100) |
| 4 | Pasy folii podkladowej 20m | szt | 500 zl | Tylko przy folii strukturalnej. ceil(buttJointMeters / 20) |
| 5 | Katownik PVC 2m zewnetrzny | szt | 40 zl | ceil((obwod + dlugosci stopni schodow + obwod brodzika [x2 jesli murek]) / 2) |
| 6 | Katownik PVC 2m wewnetrzny | szt | 40 zl | Domyslnie 0 - reczne |
| 7 | Plaskownik PVC 2m | szt | 30 zl | Domyslnie 0 - reczne |
| 8 | Nity 200szt | szt | 270 zl | ceil(suma katownikow i plaskownikow / 40) |
| 9 | Folia w plynie 1L | szt | 220/270 zl | 220 zl (jednokolorowa/nadruk), 270 zl (strukturalna + dopisek). ceil(totalArea / 100) |
| 10 | Usluga foliowanie niecki | m2 | 90/130 zl | 90 (jednokolorowa/nadruk), 130 (strukturalna). Powierzchnia scian + dno |
| 11 | Usluga foliowanie schodow | m2 | 500 zl | stairsArea m2 |
| 12 | Usluga foliowanie rynny | mb | 500 zl | Tylko basen rynnowy. Dlugosc = obwod basenu |
| + | Pozycja reczna / z bazy | dowolne | reczna | Reuse ExtraLineItems z kroku 3 |

## Szczegoly techniczne

### 1. Plik `src/lib/finishingMaterials.ts` - calkowita przebudowa tablicy `FINISHING_MATERIALS`

- Usunac obecne 7 materialow
- Dodac nowe 11 materialow (pozycje 2-12 z tabeli) z nowymi ID, nazwami, jednostkami, cenami i funkcjami `calculate()`
- Funkcja `calculate()` bedzie przyjmowac rozszerzony interfejs `PoolAreas` (dodane pola: `stairsStepPerimeter`, `wadingPoolPerimeter`, `hasWadingWall`, `isGutterPool`, `poolLength`, `poolWidth`)
- Nowa logika podkladu (2a/2b): osobna funkcja `calculateUnderlayStrips()` ktora oblicza pasy na dno i sciany
- Material "Podklad" bedzie mial dwa warianty - uzytkownik wybiera typ podkladu (zwykly/impregnowany) w UI

### 2. Nowy interfejs `PoolAreas` - rozszerzenie

```text
PoolAreas {
  ...existing fields...
  + poolLength: number       // dlugosc basenu (do obliczen pasow)
  + poolWidth: number        // szerokosc basenu (do obliczen pasow)
  + stairsStepPerimeter: number  // suma dlugosci krawedzi stopni
  + wadingPoolPerimeter: number  // obwod brodzika
  + hasWadingWall: boolean       // czy brodzik ma murek
  + isGutterPool: boolean        // basen rynnowy
  + selectedSubtype: FoilSubtype // wybrany podtyp folii (potrzebny do warunkowych materialow)
}
```

### 3. Plik `src/components/finishing/FinishingWizardContext.tsx`

- Rozszerzyc `poolAreas` w stanie o nowe pola
- Przekazywac `overflowType`, `stairs`, `wadingPool` z configuratorState do `calculatePoolAreas()`
- Dodac akcje `ADD_EXTRA_ITEM` i `REMOVE_EXTRA_ITEM` do reducera
- Dodac `extraItems: ExtraLineItem[]` do stanu
- Uwzgledniac `extraItems` w obliczeniu `totalNet`

### 4. Plik `src/components/finishing/components/FinishingMaterialsTable.tsx`

- Dostosowac do nowych materialow (nowe nazwy, jednostki, ceny)
- Na koncu tabeli dodac `ExtraLineItemRows` i `AddItemRow` (import z `ExtraLineItems.tsx`)
- Uwzglednic `extraItems` w sumie

### 5. Plik `src/components/finishing/FinishingModuleWizard.tsx`

- Dodac handlery `handleAddExtraItem` i `handleRemoveExtraItem`
- Przekazac je do `FinishingMaterialsTable`

### 6. Logika obliczen podkladu (kluczowa)

Podklad zwykly (rolki 2m):
- Dno: `ceil(poolWidth / 2)` pasow * `poolLength` * 2m = m2
- Sciany: `perimeter * 2m` = m2 (nawet jesli sciana ma 1.5m - 0.5m odpadu sie liczy)
- Razem: suma dna + sciany

Podklad impregnowany (rolki 1.5m i 2m):
- Optymalizacja: dla danej szerokosci basenu sprawdzamy kombinacje 1.5m i 2m aby pokryc szerokosc z minimalnym odpadem
- Np. 5m = 2+2+1.5 (5.5m, odpad 0.5m) vs 2+2+2 (6m, odpad 1m) - lepsza pierwsza opcja
- Sciany analogicznie - dobor szerokosci do glebokosci

### 7. Wybor typu podkladu w UI

Dodac prosty `Select` nad tabela materialow (lub w wierszu podkladu) do wyboru miedzy "Podklad zwykly" a "Podklad impregnowany". Domyslnie zwykly. Zmiana przelicza ilosc i cene.

## Kolejnosc implementacji

1. Rozszerzyc `PoolAreas` i `calculatePoolAreas()` o nowe pola
2. Przebudowac `FINISHING_MATERIALS` z nowa logika
3. Dodac obsluge `extraItems` w kontekscie
4. Zaktualizowac tabele materialow z nowymi pozycjami i dodawaniem recznym
5. Dodac wybor typu podkladu w UI
