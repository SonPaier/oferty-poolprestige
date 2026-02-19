
# Wdrożenie nowego wzoru strat ciepła (Magnus + ASHRAE)

## Zakres zmian

Zastępujemy stary uproszczony wzór:
```
q2 = A × 0.012 × ΔT × K_wiatru
```
nowym fizykalnym modelem opartym na ciśnieniach par (Magnus) i normie ASHRAE. K z `WIND_EXPOSURE_COEFFICIENTS` (0.5, 1, 1.5, 2, 3, 4) jest użyte bezpośrednio jako prędkość wiatru [m/s].

---

## 1. `src/types/configurator.ts` — rozszerzenie `EngineeringResults`

Do interfejsu `EngineeringResults` (linie 542–560) dodajemy 6 nowych pól wynikowych:

```typescript
// Parowanie (model Magnus/ASHRAE)
evaporationLH: number;       // odparowana woda przy pełnym odkryciu [l/h]
evaporationLDay: number;     // ważona dobowo [l/dobę]
pSatWaterHPa: number;        // P_sat(T_wody) [hPa]
pPartialAirHPa: number;      // P_sat(T_powietrza) × RH/100 [hPa]
deltaPHPa: number;           // ΔP = P_w − P_a [hPa]
q2MaxKW: number;             // strata maks. bez przykrycia [kW]
```

---

## 2. `src/lib/poolEngineeringCalcs.ts` — nowa logika

### 2a. Nowy interfejs i funkcja `calculateEvaporation()`

Dodajemy przed `calculateHeating()`:

```typescript
export interface EvaporationResult {
  pSatWaterHPa: number;
  pPartialAirHPa: number;
  deltaPHPa: number;
  evaporationLH: number;    // W_odkryty [l/h]
  evaporationLDay: number;  // ważone godzinami [l/dobę]
  q2MaxKW: number;          // strata bez przykrycia
  q2kW: number;             // strata ważona dobowo
}

function calculateEvaporation(
  targetTemp: number,
  airTemp: number,
  surfaceAreaM2: number,
  windExposure: WindExposure,
  poolCover: PoolCover,
  hoursOpenPerDay: number,
  hoursCoveredPerDay: number
): EvaporationResult
```

**Logika wewnętrzna:**

```
Wilgotność RH:
  wewnetrzny lub zadaszony → RH = 60%
  pozostałe               → RH = 55%

Magnus:
  getPsat(T) = 6.11 × exp(17.62 × T / (243.12 + T))
  P_w = getPsat(targetTemp)
  P_a = getPsat(airTemp) × RH/100
  ΔP  = max(0, P_w − P_a)

Prędkość wiatru:
  v = WIND_EXPOSURE_COEFFICIENTS[windExposure]   (0.5 … 4)

Parowanie odkryte [l/h]:
  W_odkryty = A × ΔP × (0.045 + 0.041 × v)

Konwekcja:
  Q_conv = A × 0.005 × (targetTemp − airTemp)
  (max 0 — basen nie pobiera ciepła z powietrza przy doborze grzałki)

Straty odkryte:
  q2_max = W_odkryty × 0.68 + max(0, Q_conv)

Straty ważone dobowo:
  K_cover = COVER_COEFFICIENTS[poolCover]   (brak=1.0 … roleta=0.15)
  q2 = q2_max × (hoursOpenPerDay/24)
     + q2_max × K_cover × (hoursCoveredPerDay/24)
  q2 = max(0, q2)

Parowanie l/dobę (ważone):
  W_day = W_odkryty × hoursOpenPerDay
        + W_odkryty × K_cover × hoursCoveredPerDay
```

### 2b. Refaktoryzacja `calculateHeating()`

Obecna funkcja `calculateHeating()` (linie 127–172) zastępuje swój własny wzór `q2` wywołaniem `calculateEvaporation()`. Zwraca to samo `{ q1kW, q2kW, heatingPowerKW }`, plus nowe pole `evaporation: EvaporationResult`.

```typescript
export interface HeatingResult {
  q1kW: number;
  q2kW: number;
  heatingPowerKW: number;
  evaporation: EvaporationResult;   // ← nowe
}
```

### 2c. Aktualizacja `calculateAllEngineering()`

Funkcja główna (linie 274–298) przekazuje `heating.evaporation` w zwracanym obiekcie:

```typescript
return { freshWater, heating, filtration, overflow };
// heating.evaporation zawiera wszystkie dane o parowaniu
```

---

## 3. `src/components/steps/EngineeringCalcsPanel.tsx`

### 3a. Dispatch — nowe pola w `SET_ENGINEERING_RESULTS` (linie 140–163)

Dodajemy do payloadu:
```typescript
evaporationLH: results.heating.evaporation.evaporationLH,
evaporationLDay: results.heating.evaporation.evaporationLDay,
pSatWaterHPa: results.heating.evaporation.pSatWaterHPa,
pPartialAirHPa: results.heating.evaporation.pPartialAirHPa,
deltaPHPa: results.heating.evaporation.deltaPHPa,
q2MaxKW: results.heating.evaporation.q2MaxKW,
```

### 3b. Nowe ResultBoxy w sekcji "Grzanie wody" (po liniach 334–345)

Obecny grid `q1 / q2 / heatingPower` zostaje. Poniżej niego, po linii zamykającej `</div>`, dodajemy nowy blok z opisem i wynikami parowania:

```
─── Parowanie wody (Magnus / ASHRAE) ───────────────────────
[ ΔP [hPa]       ]  [ P_wody [hPa]  ]  [ P_powietrza [hPa] ]
[ Parowanie [l/h]]  [ Parowanie [l/dobę]       ]
[ q2 maks. [kW]  ]  — strata przy 24h odkrytym
```

Etykieta nad blokiem: mały nagłówek `"Parowanie wody (model Magnus/ASHRAE)"` w stylu `text-xs text-muted-foreground`.

Blok jest widoczny wyłącznie gdy `res` nie jest null (tak samo jak istniejące ResultBoxy).

---

## Kolejność implementacji

```
1. src/types/configurator.ts
   └── dodaj 6 pól do EngineeringResults

2. src/lib/poolEngineeringCalcs.ts
   ├── dodaj EvaporationResult + calculateEvaporation()
   ├── zrefaktoryzuj calculateHeating() → wywołuje calculateEvaporation()
   └── calculateAllEngineering() bez zmian (evaporation jest w heating)

3. src/components/steps/EngineeringCalcsPanel.tsx
   ├── dispatch: dodaj 6 nowych pól
   └── UI: nowy blok ResultBoxów pod q1/q2/heatingPower
```

---

## Techniczne szczegóły wzorów

```text
Magnus (ciśnienie pary nasyconej):
  P_sat(T) = 6.11 × exp(17.62 × T / (243.12 + T))   [hPa]

RH:
  wewnetrzny / zadaszony → 60%
  zewnętrzny             → 55%

Parowanie odkryte [l/h]:
  W = A × ΔP × (0.045 + 0.041 × K)

Konwekcja [kW]:
  Q_conv = A × 0.005 × (T_wody − T_powietrza)

Straty odkryte [kW]:
  q2_max = W × 0.68 + max(0, Q_conv)

Straty ważone [kW]:
  q2 = q2_max × (h_open/24) + q2_max × K_cover × (h_covered/24)
```
