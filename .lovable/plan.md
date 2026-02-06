

# Nowa logika rozmieszczania slupow konstrukcyjnych

## Obecny problem
Slupy sa rozmieszczone rownomiernie na calej dlugosci sciany, co powoduje:
- Zbyt duza odleglosc miedzy slupem S1 a S9 (naroznik do naroznika po dlugosci)
- Brak uwzglednienia polowy odstepow przy naroznikach
- Brak slupow w miejscach styku brodzika ze sciana

## Nowe zasady rozmieszczania

### 1. Ilosc slupow na sciane
- Sciana 5m -> 2 slupy
- Sciana 10m -> 4 slupy
- Ogolna formula: `Math.round(wallLength / 2.5)` (ok. co 2.5m, zaokraglone)

### 2. Rozmieszczenie z polowa odstepem przy naroznikach
Odleglosc od naroznika do pierwszego slupa = polowa odleglosci miedzy slupami.

Przyklad dla sciany 5m z 2 slupami:
- Odstep miedzy slupami: `5 / (2 + 1 * 0.5 + 0.5) = 5 / 3 = ~1.67m` (ale precyzyjniej)
- Formula: `spacing = wallLength / (n + 1)`, pozycje: `spacing * 0.5`, `spacing * 1.5`, ..., `spacing * (n - 0.5)`

Uproszczone: jesli n slupow na scianie dlugosci L:
- `spacing = L / (n + 1)` (rownomierny podzial na n+1 segmentow)  
- Pozycja i-tego slupa: `spacing * 0.5 + (i * spacing)` for i=0..n-1
- To daje polowe odstep od krawedzi, pelny odstep miedzy slupami

Faktycznie lepiej: podzial na `n` rownych segmentow + 2 polowki na brzegach:
- `spacing = L / (n + 1)` -> **NIE**, to rowne rozmieszczenie
- Chcemy: `halfSpacing + (n-1) * fullSpacing + halfSpacing = L`
- Wiec: `fullSpacing = L / n`, `halfSpacing = L / (2*n)`
- Pozycja i-tego slupa (0-based): `halfSpacing + i * fullSpacing = L/(2n) + i * L/n`

### 3. Slupy w miejscu styku brodzika
Gdy brodzik jest wlaczony, w miejscach gdzie sciana brodzika styka sie ze sciana basenu (punkty E, F) dodawane sa slupy. Te slupy sa stale i nie wliczane do rownomiernego rozmieszczenia -- odcinki sciany sa dzielone osobno.

## Zmiany techniczne

### Plik: `src/components/Pool2DPreview.tsx`

1. **Nowa formula `calculateDefaultColumnCounts`**:
   - Zmiana z `Math.floor(length / 2) - 1` na `Math.round(length / 2.5)` (lub podobna formula dajaca 2 na 5m, 4 na 10m)

2. **Nowa logika `columnPositions` w useMemo**:
   - Wykrycie punktow styku brodzika ze scianami basenu (na podstawie `wadingPoolPoints` i `poolPoints`)
   - Umieszczenie slupow-junkci w tych punktach
   - Podzial pozostalych odcinkow scian na segmenty z zasada "polowa odstepem od konca"
   - Numeracja slupow S1, S2, ... po kolei (obwodowo)

3. **Interface `CustomColumnCounts`** -- rozszerzenie lub zachowanie kompatybilnosci z reczna edycja liczby slupow w GroundworksStep

### Plik: `src/components/steps/GroundworksStep.tsx`
- Aktualizacja `calculateDefaultColumnCounts` aby pasowalo do nowej formuly
- Bez zmian w UI recznej edycji

## Przyklad wizualny (basen 8x4m, brodzik back-left)

```text
  Naroznik A -------- S1 ---- S2 ---- S3 -------- Naroznik B
  |                                                         |
  S8                                                       S4
  |                                                         |
  Naroznik D --- S7(junction) --- S6 ---- S5 --- Naroznik C
                  |              |
                  |   brodzik   |
                  |_____________|
```

- S7 jest w miejscu styku brodzika ze sciana (junction)
- Odleglosc Naroznik A -> S1 = polowa odleglosci S1 -> S2
- Slupy S5, S6 rozmieszczone rownomiernie na odcinku od Naroznika C do S7 (junction)

