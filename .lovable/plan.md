

# Plan: Automatyczne obliczanie strzemion (słupy + wieniec)

## Obecny stan
Strzemiona 18x18 mają w kodzie `positions: []` i `totalQuantity: 0` - nie sa automatycznie obliczane. Uzytkownik musi recznie wpisac ilosc.

## Nowa logika obliczen

Strzemiona rozmieszczone co **20 cm** (0.20m) wzdluz:

### 1. Slupy
- Wysokosc slupa = glebokosc basenu - wysokosc wienca
- Strzemiona na 1 slup = ceil(wysokosc slupa / 0.20)
- Laczna ilosc = strzemiona na slup x liczba slupow

### 2. Wieniec
- Obwod wienca = 2 x (dlugosc + szerokosc)
- Strzemiona na wieniec = ceil(obwod / 0.20)

### 3. Suma
```
Strzemiona = (ceil(wys_slupa / 0.20) x ilosc_slupow) + ceil(obwod / 0.20)
```

### Przyklad (basen 8x4x1.5m, wieniec 0.18m, 8 slupow)
- Wysokosc slupa: 1.5 - 0.18 = 1.32m
- Strzemiona/slup: ceil(1.32 / 0.20) = 7
- Strzemiona slupy: 7 x 8 = 56 szt.
- Obwod: 2 x (8 + 4) = 24m
- Strzemiona wieniec: ceil(24 / 0.20) = 120 szt.
- **Razem: 176 szt.**

## Zmiany w kodzie

### Plik: `src/components/groundworks/ReinforcementSection.tsx`

1. **Dodanie nowej funkcji obliczeniowej** `calculateStirrups`:
   - Parametry: length, width, depth, crownHeight, columnCount
   - Zwraca: { columnsQty, crownQty, total }

2. **Rozszerzenie `calculatedPositions`** o dane strzemion (ilosc dla slupow i wienca)

3. **Zmiana inicjalizacji strzemion** w `useEffect`:
   - Dodanie `positions` z dwoma pozycjami: "Slupy" i "Wieniec"
   - Automatyczne obliczanie `totalQuantity`
   - Ustawienie `isExpanded: true` aby pokazac obliczenia

4. **Aktualizacja `useEffect` synchronizacji** (meshSize/unit) aby uwzgledniac strzemiona przy przeliczaniu

5. Strzemiona widoczne tylko dla technologii **murowanej** (masonry) - przy lanej nie ma slupow ani wienca z bloczkow

## Wyswietlanie obliczen

Po rozwinieciu wiersza "Strzemiona 18x18" uzytkownik zobaczy:
- **Slupy**: ceil(1.32 / 0.20) x 8 = 56 szt.
- **Wieniec**: ceil(24 / 0.20) = 120 szt.

Kazda podpozycja z mozliwoscia recznej edycji i resetu (tak jak pozostale pozycje zbrojenia).

