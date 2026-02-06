

# Dodanie uwag do robót ziemnych + dodatkowe pozycje wyceny w obu tabelach

## 1. Uwagi w robotach ziemnych

Dodanie pola tekstowego "Uwagi" pod tabelą kosztów robót ziemnych, analogicznie do istniejącego pola w pracach budowlanych (linie 3050-3061). Nowy stan `excavationNotes` zapisywany do sekcji `roboty_ziemne`.

## 2. Dodatkowe pozycje wyceny (obie tabele)

### Mechanizm
- W obu tabelach (roboty ziemne i prace budowlane) za ostatnią pozycją pojawi się wiersz "Dodaj pozycję"
- Po kliknięciu/wypełnieniu wiersza, nowa pozycja zostaje dodana do listy, a wiersz dodawania przesuwa się niżej
- Kazda dodana pozycja ma przycisk usuwania (ikona kosza)

### Dodawanie pozycji -- dwa tryby
1. **Wyszukaj z bazy produktów** -- pole tekstowe z wyszukiwaniem (Popover/Command z listy produktów z bazy danych). Po wybraniu produktu nazwa i cena zostają wstawione automatycznie
2. **Wpisz recznie** -- wpisanie nazwy, ilości, jednostki, stawki recznie

### UI wiersza dodawania
- Kolumna "Nazwa" -- input z autouzupelnianiem (wyszukiwanie produktów) lub wolny tekst
- Kolumna "Ilość" -- input numeryczny (domyslnie 1)
- Kolumna "Jednostka" -- select (szt./m2/m3/mb/kpl/ryczalt)
- Kolumna "Stawka" -- input numeryczny (auto z produktu lub reczna)
- Kolumna "Wartość netto" -- obliczana automatycznie
- Przycisk "+" do zatwierdzenia pozycji

### Stan danych
- Nowy stan `extraExcavationItems` (tablica dodatkowych pozycji robót ziemnych)
- Nowy stan `extraConstructionItems` (tablica dodatkowych pozycji prac budowlanych)
- Kazda pozycja: `{ id, name, quantity, unit, rate, netValue, productId? }`
- Sumy tabel uwzgledniaja dodatkowe pozycje

## Zmiany techniczne

### Plik: `src/components/steps/GroundworksStep.tsx`

1. **Nowe stany**:
   - `excavationNotes: string` -- uwagi do robót ziemnych
   - `extraExcavationItems: ExtraLineItem[]` -- dodatkowe pozycje w tabeli robót ziemnych
   - `extraConstructionItems: ExtraLineItem[]` -- dodatkowe pozycje w tabeli prac budowlanych
   - `excSearchQuery / constSearchQuery` -- zapytania wyszukiwania produktów

2. **Nowy interface** `ExtraLineItem`:
   ```
   { id: string, name: string, quantity: number, unit: string, rate: number, netValue: number, productId?: string }
   ```

3. **Nowy komponent wewnetrzny** `AddItemRow` -- wiersz dodawania pozycji z wyszukiwaniem produktów (Popover + Command z wynikami z bazy)

4. **Tabela robót ziemnych** (linie ~1921-1964):
   - Po ostatnim `TableRow` w `TableBody` (przed `TableFooter`) -- dodanie renderowania `extraExcavationItems` + wiersza `AddItemRow`
   - Aktualizacja `totalNet` o sume `extraExcavationItems`

5. **Tabela prac budowlanych** (linie ~3004-3006):
   - Po ostatnim wierszu labor (przed `TableFooter`) -- dodanie renderowania `extraConstructionItems` + wiersza `AddItemRow`
   - Aktualizacja `constructionTotalNet` o sume `extraConstructionItems`

6. **Pole uwag robót ziemnych**:
   - Pod tabelą kosztów (po zamknieciu `</Table>`, przed zamknieciem glass-card) -- Textarea analogicznie do linii 3050-3061

7. **Zapis do sekcji**:
   - `roboty_ziemne` -- dodanie `notes: excavationNotes`, `extraItems: extraExcavationItems`
   - `prace_budowlane` -- dodanie `extraItems: extraConstructionItems`

### Wyszukiwanie produktów
- Wykorzystanie istniejacego hooka `useProducts` z `src/hooks/useProducts.ts` do wyszukiwania
- Popover z listą wyników (nazwa, symbol, cena) -- uzytkownik klika aby wstawic
- Jesli brak wyników lub uzytkownik wpisze tekst bez wyboru -- traktowane jako pozycja reczna

