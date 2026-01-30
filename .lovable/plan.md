
# Faza 5: Naprawa i Implementacja Obsługi Folii Strukturalnej (Butt Joint)

## Problem zidentyfikowany

Migracja z Fazy 1 nie zaktualizowała poprawnie `joint_type` dla folii strukturalnych, ponieważ warunek `category = 'Folia basenowa'` nie pasuje do faktycznej wartości w bazie (`'folia'`).

Wynik zapytania:
- Wszystkie folie strukturalne mają `joint_type = NULL` zamiast `'butt'`
- Wszystkie folie jednokolorowe i nadrukowe mają `joint_type = NULL` zamiast `'overlap'`

---

## Część 1: Naprawa danych w bazie

### Migracja korygująca
Utworzenie nowej migracji SQL:
- UPDATE folii strukturalnych: `joint_type = 'butt'` WHERE `foil_category = 'strukturalna'`
- UPDATE folii pozostałych: `joint_type = 'overlap'` WHERE `foil_category IN ('jednokolorowa', 'nadruk')`
- Usunięcie warunku `category = 'Folia basenowa'` (niepotrzebny skoro filtrujemy po `foil_category`)

---

## Część 2: Integracja butt joint w CoveringStep.tsx

### Wykrywanie folii butt joint
Dodanie nowej logiki w `CoveringStep.tsx`:
- Import funkcji `isButtJointFoil` i `calculateButtJointLength`
- Sprawdzanie czy wybrana folia ma `joint_type === 'butt'`
- Obliczanie długości zgrzewów doczołowych

### Nowe elementy UI
1. **Wskaźnik typu folii** - badge informujący że wybrana folia jest strukturalna/butt joint
2. **Obliczenie długości zgrzewów** - wyświetlenie w sekcji "Zapotrzebowanie"
3. **Usługa zgrzewania doczołowego** - automatyczne dodanie do materiałów (15 zł/mb)
4. **Materiał: folia podkładowa** - automatyczne dodanie dla Touch/Ceramics

### Modyfikacja materiałów
Aktualna lista materiałów:
- foil-main, underlay, rivets, glue, profiles, antislip

Nowe materiały dla folii butt joint:
- `butt-welding-service` - Usługa zgrzewania doczołowego (mb)
- `structural-underlay` - Folia podkładowa pod Touch/Ceramics (m²)

### Logika warunkowa
```
Jeśli selectedFoil.joint_type === 'butt':
  ├── Oblicz buttJointLength z calculateButtJointLength()
  ├── Dodaj materiał: Zgrzewanie doczołowe × buttJointLength mb × 15 zł
  ├── Dodaj materiał: Folia podkładowa × bottomArea m²
  └── Wyświetl badge "Zgrzewanie doczołowe"
W przeciwnym razie:
  └── Standardowa lista materiałów
```

---

## Część 3: Rozszerzenie typu produktu

### Mapowanie danych z bazy
Funkcja `useFoilProducts` musi zwracać `joint_type`:
- Sprawdzenie czy hook już pobiera tę kolumnę
- Jeśli nie - rozszerzenie query

### Aktualizacja interfejsu FoilProduct
Upewnienie się że `FoilProduct` w `types.ts` zawiera:
- `joint_type?: 'overlap' | 'butt' | null`

---

## Pliki do modyfikacji

| Plik | Zmiany |
|------|--------|
| Nowa migracja SQL | Naprawa `joint_type` dla istniejących produktów |
| `src/components/steps/CoveringStep.tsx` | Import `isButtJointFoil`, `calculateButtJointLength`, logika UI dla butt joint |
| `src/hooks/useProducts.ts` | Sprawdzenie czy `joint_type` jest pobierane (prawdopodobnie tak, bo select *) |
| `.lovable/plan.md` | Aktualizacja statusu Fazy 5 |

---

## Szczegóły techniczne

### Obliczanie długości zgrzewów doczołowych
Funkcja `calculateButtJointLength` już istnieje w `src/lib/foil/helpers.ts`:
- Zlicza długość spawów między sąsiednimi pasami na dnie
- Suma = (liczba pasów - 1) × długość pasa

### Ceny usług i materiałów
Z tabeli `installation_services`:
- Zgrzewanie doczołowe: 15 zł/mb

Potrzebne materiały (z bazy lub hardcoded):
- Folia podkładowa pod Touch/Ceramics - szukamy produktu z symbolem zawierającym "podkład" i "Touch"

---

## Kolejność implementacji

1. Migracja SQL - naprawa `joint_type`
2. Sprawdzenie hooka `useFoilProducts`
3. Rozszerzenie logiki w `CoveringStep.tsx`:
   - Wykrywanie butt joint
   - Obliczanie długości zgrzewów
   - Dodawanie usługi zgrzewania
   - Dodawanie folii podkładowej
4. UI: badge/info o typie zgrzewania
5. Aktualizacja planu

---

## Oczekiwany wynik

Po wybraniu folii strukturalnej (Touch, Ceramics, Pearl, itp.):
- UI pokazuje badge "Zgrzewanie doczołowe"
- W sekcji Zapotrzebowanie pojawia się długość zgrzewów (np. "12.5 mb")
- W liście materiałów automatycznie:
  - Usługa: Zgrzewanie doczołowe 12.5 mb × 15 zł = 187.50 zł
  - Materiał: Folia podkładowa X m² × Y zł
