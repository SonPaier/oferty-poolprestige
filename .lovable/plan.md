
# Automatyczne pozycje XPS/PUR w kosztorysie budowlanym

## Cel
Przy wyborze ocieplenia dna lub scian automatycznie dodawana jest odpowiednia pozycja kosztorysowa w tabeli "Koszt budowy" (prace budowlane). Ilosc obliczana na podstawie wymiarow plyt XPS z uwzglednieniem ukladu na mijankę i mozliwosci wykorzystania odpadow.

## Dane wejsciowe

- **Plyta XPS**: 1,25 m x 0,60 m (= 0,75 m2/szt.)
- **XPS 5cm**: paczka = 6 m2 (= 8 szt.)
- **XPS 10cm**: paczka = 3 m2 (= 4 szt.)
- **PUR 5cm**: nakładany natryskiowo -- liczone w m2, nie w paczkach

## Obliczenia

### Dno (ocieplenie dna)
- Powierzchnia = plyta denna = `(length + 0.88) * (width + 0.88)`
- Uklad na mijankę: pierwszy rzad od dlugosci, drugi przesuniecie o polowe (0.625m). Oblicz ile plyt w osi X i Y, uwzgledniaj ze odpad z jednego rzedu moze dopasowac sie do nastepnego rzedu
- Wynik: ilosc plyt (szt.), zaokrąglona w gore do pelnych paczek

### Sciany (ocieplenie scian)
- Obwod zewnetrzny basenu: `2 * ((length + 0.48) + (width + 0.48))` (wymiar wewnetrzny + mury 24cm z kazdej strony)
- Wysokosc sciany: `depth` (glebokosc basenu)
- Uklad na mijankę analogicznie: oblicz ilosc plyt na obwod x wysokosc
- Wynik: ilosc plyt (szt.), zaokrąglona w gore do pelnych paczek

### Algorytm liczenia plyt (dno i sciany)
1. Oblicz ile plyt miesci sie w jednym rzedzie wzdluz dluzszego boku (ceil)
2. Oblicz ile rzedow wzdluz krotszego boku (ceil)
3. Przy ukladzie na mijankę: w rzedach nieparzystych docinamy ostatnia plyte, odpad moze byc uzyty w nastepnym rzedzie (jesli odpad >= potrzebny fragment)
4. Sumaryczna ilosc plyt -> zaokraglenie w gore do pelnych paczek
5. Jednostka w kosztorysie: **paczki** (opak.)

## Zmiany techniczne

### Plik: `src/components/steps/GroundworksStep.tsx`

1. **Nowa funkcja** `calculateXpsPanels(areaLength: number, areaWidth: number)`:
   - Oblicza ilosc plyt XPS 1.25x0.6m na mijankę z odzyskiem odpadow
   - Zwraca: `{ panels: number, area: number }`

2. **Nowa funkcja** `calculateXpsPackages(panels: number, thickness: '5cm' | '10cm')`:
   - 5cm: ceil(panels / 8) paczek
   - 10cm: ceil(panels / 4) paczek

3. **Dynamiczne pozycje w `constructionMaterials`**:
   - Gdy `floorInsulation !== 'none'`: dodaj pozycje "XPS dno 5cm" lub "XPS dno 10cm" z obliczona iloscia paczek i stawka z `materialRates.styrodur5cm` / `materialRates.styrodur10cm`
   - Gdy `wallInsulation !== 'none'`:
     - XPS: dodaj pozycje "XPS sciany 5cm" lub "XPS sciany 10cm" z iloscia paczek
     - PUR: dodaj pozycje "Piana PUR 5cm" z iloscia w m2 i stawka `materialRates.purFoam5cm`

4. **useEffect aktualizujacy constructionMaterials**: rozszerzyc o logike dodawania/usuwania pozycji ocieplenia gdy zmieni sie `floorInsulation` lub `wallInsulation`

5. **Pozycje ocieplenia w tabeli**: renderowane pomiedzy istniejacymi materialami a zbrojeniem, z mozliwoscia edycji ilosci i stawki (tak jak inne pozycje)

6. **Aktualizacja sumy**: pozycje ocieplenia wliczone do `materialsTotalNet` automatycznie (bo sa w `constructionMaterials`)

### Plik: `src/types/configurator.ts`
- Stawki `styrodur5cm` i `styrodur10cm` juz istnieja (dla dna). Stawki `xpsWall5cm`, `xpsWall10cm` i `purFoam5cm` tez juz istnieja. Brak zmian.
