

# Zmiana logiki slupow junction -- wliczanie w pulę sciany

## Problem
Aktualnie gdy brodzik styka sie ze sciana, slup junction jest dodawany jako **dodatkowy** slup, wiec np. na scianie z 2 slupami pojawia sie 3 (2 rozlozonych + 1 junction). Powinien byc **jednym z** zdefiniowanych slupow.

## Rozwiazanie

Zmiana w funkcji `addWallColumns` w pliku `src/components/Pool2DPreview.tsx`:

1. Gdy sciana ma junction points, jeden slup z puli `totalCols` jest "zuzywany" na kazdy junction point.
2. Pozostale slupy (`totalCols - liczbaJunctions`) sa rozdzielane proporcjonalnie na segmenty miedzy junction points / naroznikami.

### Przyklad
Sciana 8m, `totalCols = 3`, 1 junction point:
- 1 slup idzie na junction -> zostaja 2 slupy
- 2 slupy rozkladane proporcjonalnie na 2 segmenty (np. segment 6m dostaje 2, segment 2m dostaje 0)

### Zmiana techniczna

W funkcji `addWallColumns` (linie ~705-760):

```
// Obecna logika (bledna):
// 1. Dodaj junction column (EXTRA)
// 2. Rozdziel totalCols proporcjonalnie na segmenty

// Nowa logika:
// 1. remainingCols = totalCols - junctionCount
// 2. Dodaj junction column (wliczone w totalCols)
// 3. Rozdziel remainingCols proporcjonalnie na segmenty
```

Konkretnie:
- Linia z `columnsForSegment(segLen, wallLen, totalCols)` zmieni sie na `columnsForSegment(segLen, wallLen, remainingCols)`
- Gdzie `remainingCols = Math.max(0, totalCols - wallJunctions.length)`
- Dodatkowe zabezpieczenie: jesli `totalCols <= junctionCount`, tylko junction columns sa umieszczane (0 dodatkowych)

### Plik do zmiany
- `src/components/Pool2DPreview.tsx` -- funkcja `addWallColumns`, ~10 linii zmian

