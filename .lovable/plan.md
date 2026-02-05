
# Plan: Dodanie edycji ilości m³ wykopu

## Opis zmiany

Aktualnie pole "Ilość" dla pozycji "Wykop" jest wyświetlane tylko do odczytu gdy jednostka to m³ - wartość jest automatycznie wyliczana z wymiarów. Dodamy możliwość ręcznej edycji tej wartości.

## Rozwiązanie

### Plik: `src/components/steps/GroundworksStep.tsx`

1. **Zmiana wyświetlania ilości w tabeli** (około linia 441-444):
   - Zamiast `<span>` z wartością tylko do odczytu, użyć `<Input>` z możliwością edycji
   - Pole będzie edytowalne niezależnie od wybranej jednostki (m³ lub ryczałt)

2. **Aktualna logika** (do zmiany):
   ```tsx
   {item.unit === 'm3' ? (
     <span>{item.quantity.toFixed(1)}</span>  // tylko odczyt
   ) : (
     <Input ... />  // edytowalny tylko dla ryczałtu
   )}
   ```

3. **Nowa logika**:
   ```tsx
   <Input
     type="number"
     min="0"
     step="0.1"
     value={item.quantity}
     onChange={(e) => updateLineItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
     className="input-field w-24 text-right"
   />
   ```

4. **Modyfikacja efektu aktualizacji** (linie 109-122):
   - Obecnie efekt automatycznie nadpisuje ilość wykopu wartością `excavationVolume` przy każdej zmianie wymiarów
   - Dodać flagę `customQuantity` do śledzenia czy użytkownik ręcznie zmienił ilość
   - Jeśli użytkownik zmienił ilość ręcznie, nie nadpisywać jej automatycznie

5. **Dodanie stanu `customQuantityOverride`**:
   ```tsx
   const [customQuantityOverride, setCustomQuantityOverride] = useState<boolean>(false);
   ```

6. **Zmodyfikowana obsługa `updateLineItem`**:
   - Gdy użytkownik zmienia ilość dla wykopu, ustawić flagę `customQuantityOverride = true`
   - Efekt aktualizujący nie będzie nadpisywać ilości gdy flaga jest ustawiona

7. **Opcjonalnie: przycisk resetu do wartości obliczonej**:
   - Mały przycisk obok pola ilości do przywrócenia wartości obliczonej z wymiarów
   - Po kliknięciu `customQuantityOverride = false` i ilość wraca do `excavationVolume`

## Efekt końcowy

- Użytkownik może ręcznie wpisać dowolną ilość m³ w polu "Ilość" dla pozycji "Wykop"
- Zmiana wymiarów wykopu (długość/szerokość/głębokość) NIE nadpisuje ręcznie wprowadzonej wartości
- Wartość netto przelicza się automatycznie: ilość × stawka
