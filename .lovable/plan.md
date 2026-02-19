
# Bilans uzupełnienia wody — moc do podgrzania wody uzupełnianej

## Cel

Do obecnego bilansu cieplnego (q1 + q2) dodajemy trzecią składową: **q3 — moc potrzebna do podgrzania wody uzupełnianej** (wody „zimnej" wchodzącej w miejsce utraconej).

Woda uzupełniana pochodzi z trzech źródeł:
- **Płukanie filtra** — raz w tygodniu, objętość już wyliczona (`flushWaterPerFilterM3` z modułu filtracji)
- **Parowanie** — objętość już wyliczona (`evaporationLDay` z modelu Magnus/ASHRAE)
- **Wychlapanie** — 2 l na osobę (N osób) × liczba godzin odkrytych / dobę

Wszystkie trzy dają dzienną objętość wody do uzupełnienia → wyliczamy moc potrzebną do jej podgrzania do temperatury zadanej.

---

## Wzory

```text
─── Objętości dobowe [m³/d] ───────────────────────────────

Płukanie (przeliczone na dobę):
  V_flush_day = flushWaterPerFilterM3 / 7        [m³/d]  (1 raz na tydzień, 1 filtr)

Parowanie:
  V_evap_day = evaporationLDay / 1000            [m³/d]  (evaporationLDay jest w [l/d])

Wychlapanie:
  V_splash_day = N × 2L × (hoursOpenPerDay / 24) / 1000  [m³/d]
  (N = personCount z filtracji, 2 l/os, ważone godzinami odkrytymi)

Łącznie:
  V_makeup_day = V_flush_day + V_evap_day + V_splash_day  [m³/d]

─── Moc do podgrzania wody uzupełnianej [kW] ──────────────

  q3kW = V_makeup_day × 1.163 × (targetTemp − initialTemp) / 24
         (1.163 kWh/(m³·K) = c_p × ρ wody; dzielimy przez 24h → kW)

─── Moc grzewcza (zaktualizowana) ─────────────────────────

  heatingPowerKW = ceil(q1 + q2 + q3)
```

> **Uwaga:** `flushWaterPerFilterM3` jest zawsze wyliczana (zarówno dla skimmerowego jak i przelewowego — taki sam filtr), więc q3 obejmuje oba typy basenów.

---

## Pliki do zmiany

### 1. `src/lib/poolEngineeringCalcs.ts`

**a) Nowy interfejs `WaterMakeupResult`** — wyniki uzupełniania wody:

```typescript
export interface WaterMakeupResult {
  flushDayM3: number;       // płukanie / dobę [m³/d]
  evapDayM3: number;        // parowanie / dobę [m³/d]
  splashDayM3: number;      // wychlapanie / dobę [m³/d]
  totalMakeupDayM3: number; // suma [m³/d]
  q3kW: number;             // moc do podgrzania [kW]
}
```

**b) Nowa funkcja `calculateWaterMakeup()`:**

```typescript
export function calculateWaterMakeup(
  personCount: number,
  evaporationLDay: number,
  flushWaterPerFilterM3: number,
  hoursOpenPerDay: number,
  targetTemp: number,
  initialTemp: number
): WaterMakeupResult
```

**c) Aktualizacja `HeatingResult`** — dodanie `q3kW` i `makeup`:

```typescript
export interface HeatingResult {
  q1kW: number;
  q2kW: number;
  q3kW: number;              // ← nowe
  heatingPowerKW: number;    // teraz ceil(q1+q2+q3)
  evaporation: EvaporationResult;
  makeup: WaterMakeupResult; // ← nowe
}
```

**d) Aktualizacja `calculateHeating()`:**
- Wymaga `personCount`, `flushWaterPerFilterM3`, `hoursOpenPerDay` jako dodatkowych parametrów
- Wylicza `calculateWaterMakeup()` i sumuje do `heatingPowerKW`

**e) Aktualizacja `calculateAllEngineering()`:**
- Przekazuje `filtration.personCount` i `filtration.filterAreaEachM2 * 6` (czyli `flushWaterPerFilterM3`) do `calculateHeating()`

### 2. `src/types/configurator.ts` — `EngineeringResults`

Dodajemy pola wynikowe q3 i szczegóły makeup:

```typescript
// Uzupełnianie wody
q3kW: number;
makeupFlushDayM3: number;
makeupEvapDayM3: number;
makeupSplashDayM3: number;
makeupTotalDayM3: number;
```

### 3. `src/components/steps/EngineeringCalcsPanel.tsx`

**a) Dispatch** — dodanie 5 nowych pól do `SET_ENGINEERING_RESULTS`

**b) Wyświetlenie q3** — w sekcji "Grzanie wody":
- Dodajemy `ResultBox` dla `q3` w istniejącym gridzie `q1 / q2 / heatingPower` → układ 2×2 lub 4-kolumnowy
- Pole `heatingPowerKW` (highlight) pozostaje jako wynik sumaryczny

**c) Nowy podblok "Uzupełnianie wody" pod "Parowanie wody (Magnus/ASHRAE)":**

```
─── Uzupełnianie wody (dobowe) ─────────────────────────────
[ Płukanie filtra ]  [ Parowanie  ]  [ Wychlapanie ]
[ Łącznie [m³/d]  ]  [ q3 moc    ]
```

---

## Kolejność implementacji

```
1. src/lib/poolEngineeringCalcs.ts
   ├── dodaj WaterMakeupResult + calculateWaterMakeup()
   ├── rozszerz HeatingResult o q3kW i makeup
   ├── zaktualizuj calculateHeating() — przyjmuje personCount + flushWaterPerFilterM3
   └── zaktualizuj calculateAllEngineering() — oblicza filtration PRZED heating
       i przekazuje personCount + flushWaterPerFilterM3

2. src/types/configurator.ts
   └── dodaj 5 pól do EngineeringResults

3. src/components/steps/EngineeringCalcsPanel.tsx
   ├── dispatch: +5 pól makeup
   └── UI: zaktualizowany grid q1/q2/q3/heatingPower + podblok makeup
```

---

## Techniczne szczegóły

```text
Kolejność obliczeń w calculateAllEngineering():
  1. filtration = calculateDINFiltration(...)   ← personCount i flushWaterPerFilterM3
  2. heating    = calculateHeating(..., filtration.personCount,
                                       filtration.filterAreaEachM2 × 6)
  3. freshWater = calculateFreshWater(...)
  4. overflow   = calculateOverflowTank(...)    (bez zmian)

Uwaga: flushWaterPerFilterM3 = filterAreaEachM2 × 6 (taki sam wzór jak w overflow tank),
ale wyliczamy go zawsze — niezależnie od tego czy basen skimmerowy czy przelewowy.
```
