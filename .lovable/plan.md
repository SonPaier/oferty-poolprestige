
# Wyliczenia wstępne basenu — Grzanie, Woda świeża, Filtracja DIN, Zbiornik przelewowy

## Zakres implementacji

Na podstawie przesłanego skoroszytu i doprecyzowanych wzorów wdrożone zostaną cztery sekcje wyliczeń:
1. **Woda świeża** — minimalny przepływ przyłącza wodnego
2. **Grzanie wody** — moc grzewcza (q1 nagrzewanie + q2 straty z uwzgl. osłonięcia i przykrycia)
3. **Filtracja wg DIN** — nowy wzór, liczba osób N, czas obiegu, powierzchnia filtra
4. **Zbiornik przelewowy** — tylko dla `overflowType === 'rynnowy'`

Wyniki będą widoczne w zakładce "Obliczenia" w kroku Wymiary (prawa kolumna, tab "Obliczenia") oraz zostaną zapisane w stanie konfiguratora i przekazane do podsumowania/PDF.

---

## Nowe typy i interfejsy — `src/types/configurator.ts`

### Nowy interfejs `EngineeringParams` (parametry wejściowe, edytowalne przez użytkownika)

```typescript
export type WindExposure =
  | 'wewnetrzny'        // K=1 (wewnętrzny lub zadaszony)
  | 'osloniety3'        // K=1.5 (osłonięty z 3 stron)
  | 'osloniety2'        // K=2 (osłonięty z 2 stron)
  | 'nieosloniety'      // K=3 (nieosłonięty)
  | 'ekstremalny';      // K=4 (morze, wzgórze, skarpa)

export type PoolCover =
  | 'brak'              // brak przykrycia
  | 'folia_solarna'     // K_przykryty=0.3
  | 'roleta_pvc';       // K_przykryty=0.15

export interface EngineeringParams {
  // Woda świeża
  fillingTimeH: number;           // czas napełniania [h]
  
  // Grzanie
  targetTemp: number;             // temperatura zadana [°C]
  initialTemp: number;            // temperatura startowa wody [°C]
  airTemp: number;                // temperatura powietrza [°C]
  heatingTimeH: number;           // zakładany czas podgrzewu [h]
  windExposure: WindExposure;     // osłoniecie basenu (K_odkryty)
  hoursOpenPerDay: number;        // h/dobę bez przykrycia
  poolCover: PoolCover;           // typ przykrycia (lub brak)
  hoursCoveredPerDay: number;     // h/dobę pod przykryciem
  
  // Filtracja DIN
  surfaceCoeffA: number;          // współczynnik "a" pow. użytk. (2.7/4.5/2.2)
  assistedDisinfection: boolean;  // dezynfekcja wspomagająca → K=0.6 vs 0.5
  manualPersonCount?: number;     // ręczne nadpisanie liczby osób N
  filterCount: number;            // liczba filtrów
  filtrationSpeedMH: number;      // prędkość filtracji [m/h], domyślnie 30
  
  // Zbiornik przelewowy (tylko rynnowy)
  overflowReservePercent: number; // zapas w zb. przelewowym [%], domyślnie 20
  flushFromPoolPercent: number;   // % wody płukania pobranej z niecki, domyślnie 0
}
```

### Nowy interfejs `EngineeringResults` (wyniki obliczeń, wyliczane automatycznie)

```typescript
export interface EngineeringResults {
  // Woda świeża
  freshWaterFlowM3H: number;      // min. wydajność przyłącza [m3/h]
  
  // Grzanie
  q1kW: number;                   // ciepło do nagrzania wody [kW]
  q2kW: number;                   // straty ciepła [kW]
  heatingPowerKW: number;         // minimalna moc grzewcza (ceil(q1+q2)) [kW]
  
  // Filtracja DIN
  personCount: number;            // N = A / a (lub manualPersonCount)
  dinFlowM3H: number;             // Q_DIN = N / K + Q_atrakcje [m3/h]
  circulationTimeH: number;       // V / Q_DIN [h]
  cyclesPerDay: number;           // 24 / circulationTimeH
  totalFilterAreaM2: number;      // Q_DIN / prędkość_filtracji [m2]
  filterAreaEachM2: number;       // totalFilterAreaM2 / filterCount [m2]
  
  // Zbiornik przelewowy (tylko gdy rynnowy)
  overflow?: {
    displacedWaterM3: number;     // N × 0.75 / 1000 [m3]
    overflowWaterM3: number;      // 0.052 × A × 10^(-0.144 × Q/L) [m3]
    flushWaterPerFilterM3: number; // powierzchnia filtra [m2] × 6 [m3]
    minTankVolumeM3: number;      // suma + zapas
  };
}
```

### Rozszerzenie `ConfiguratorState`

W `src/context/ConfiguratorContext.tsx` stan `ExtendedConfiguratorState` otrzyma dwa nowe pola:

```typescript
engineeringParams: EngineeringParams;
engineeringResults: EngineeringResults | null;
```

---

## Nowy moduł obliczeń — `src/lib/poolEngineeringCalcs.ts`

Plik zawierający czyste funkcje matematyczne:

### Stałe

```typescript
export const WIND_EXPOSURE_COEFFICIENTS: Record<WindExposure, number> = {
  wewnetrzny: 1,
  osloniety3: 1.5,
  osloniety2: 2,
  nieosloniety: 3,
  ekstremalny: 4,
};

export const COVER_COEFFICIENTS: Record<PoolCover, number> = {
  brak: 0,
  folia_solarna: 0.3,
  roleta_pvc: 0.15,
};
```

### `calculateFreshWater(volume, fillingTimeH)`
```text
minFlowRate = volume / fillingTimeH  [m3/h]
```

### `calculateHeating(params, surfaceArea, volume)`
Wzór na q2 wg specyfikacji:
```text
K_odkryty  = WIND_EXPOSURE_COEFFICIENTS[windExposure]
K_przykryty = COVER_COEFFICIENTS[poolCover]

q2 = A × 0.012 × (T_zadana - T_powietrza)
       × ((K_odkryty × h_odkryty + K_przykryty × h_przykryty) / 24)

q2 = 0 jeśli T_zadana <= T_powietrza
```

Wzór na q1 (bez zmian):
```text
q1 = V × 1.163 × (T_zadana - T_poczatkowa) / t_grzania
```

Wynik: `ceil(q1 + q2)` jako minimalna moc grzewcza.

### `calculateDINFiltration(params, surfaceArea, volume, attractions)`
```text
K = assistedDisinfection ? 0.6 : 0.5
N = manualPersonCount ?? floor(A / a)
Q_DIN = N / K + 6 × n_atrakcje   [m3/h]
circulationTimeH = V / Q_DIN
cyclesPerDay = 24 / circulationTimeH
totalFilterAreaM2 = Q_DIN / filtrationSpeedMH
filterAreaEachM2 = totalFilterAreaM2 / filterCount
```

### `calculateOverflowTank(params, N, Q, surfaceArea, perimeterLength, filterAreaEachM2)`
```text
displacedWaterM3 = N × 0.75 / 1000

L = perimeterLength (długość rynny przelewowej)
overflowWaterM3 = 0.052 × A × 10^(-0.144 × (Q / L))

flushWaterPerFilterM3 = filterAreaEachM2 × 6

baseVolume = displacedWaterM3 + overflowWaterM3
           + flushWaterPerFilterM3 × (1 - flushFromPoolPercent/100)

minTankVolumeM3 = baseVolume × (1 + overflowReservePercent/100)
```

### `getDefaultEngineeringParams(poolType, location)`
Zwraca domyślne wartości parametrów na podstawie typu basenu i lokalizacji:

```text
prywatny:
  fillingTimeH: 24
  targetTemp: 28, initialTemp: 10, airTemp: 20, heatingTimeH: 96
  windExposure: zależy od location ('wewnetrzny' → 'wewnetrzny', 'zewnetrzny' → 'nieosloniety')
  hoursOpenPerDay: 24, poolCover: 'brak', hoursCoveredPerDay: 0
  surfaceCoeffA: 4.5  (basen prywatny = rekreacyjny indywidualny)
  assistedDisinfection: false
  filterCount: 1, filtrationSpeedMH: 30
  overflowReservePercent: 20, flushFromPoolPercent: 0

polprywatny:
  fillingTimeH: 48
  targetTemp: 28, initialTemp: 9, airTemp: 28, heatingTimeH: 96
  surfaceCoeffA: 2.7

hotelowy:
  fillingTimeH: 48
  targetTemp: 28, initialTemp: 9, airTemp: 28, heatingTimeH: 96
  surfaceCoeffA: 2.7
```

---

## Nowy komponent UI — `src/components/steps/EngineeringCalcsPanel.tsx`

Panel wyświetlany w zakładce "Obliczenia" w DimensionsStep, **pod istniejącymi obliczeniami geometrycznymi**. Składa się z czterech sekcji z możliwością zwinięcia (Collapsible).

### Sekcja 1: Woda świeża
- Input: Czas napełniania [h] (edytowalny, domyślnie zależny od typu basenu)
- Wynik: Minimalna wydajność przyłącza [m3/h] — wyróżniony box

### Sekcja 2: Grzanie wody
Parametry (edytowalne):
- Temperatura zadana [°C] (default 28)
- Temperatura startowa wody [°C] (default 10)
- Temperatura powietrza [°C] (default 20/28 per typ)
- Czas podgrzewu [h] (default 96)
- Osłoniecie basenu → Select z 5 opcjami (K_odkryty)
- Godziny bez przykrycia/dobę
- Typ przykrycia → Select (brak / folia solarna / roleta PVC)
- Godziny pod przykryciem/dobę

Wyniki: q1 [kW], q2 [kW], min. moc grzewcza [kW]

### Sekcja 3: Filtracja i obieg wody (DIN)
Parametry (edytowalne):
- Współczynnik powierzchniowy "a" → Select (2.2 brodzik / 2.7 rekreacyjny / 4.5 sportowy) + możliwość ręcznego wpisania
- Dezynfekcja wspomagająca → Switch (K=0.5 lub 0.6)
- Liczba osób N → wyliczona (A/a), z możliwością ręcznego nadpisania
- Liczba filtrów → Input
- Prędkość filtracji [m/h] → Input (default 30)

Wyniki: Q_DIN [m3/h], czas obiegu [h], obiegi/dobę, pow. filtracji łącznie i na filtr

### Sekcja 4: Zbiornik przelewowy (tylko gdy `overflowType === 'rynnowy'`)
Parametry:
- Zapas [%] (default 20)
- % wody płukania z niecki (default 0)

Wyniki: woda wypierana [m3], woda przelewowa [m3], woda do płukania/filtr [m3], **minimalna pojemność czynna [m3]**

---

## Integracja w `DimensionsStep.tsx`

W zakładce `calculations` (tab "Obliczenia"), **po** istniejącym boxie z wydajnością filtracji DIN, dodany zostanie komponent `<EngineeringCalcsPanel />`.

Parametry `engineeringParams` będą przechowywane w stanie konfiguratora (nowe akcje redux: `SET_ENGINEERING_PARAMS`). Wyniki `engineeringResults` będą wyliczane reaktywnie (useEffect) po każdej zmianie `engineeringParams`, `dimensions` lub `poolType`, analogicznie do `calculatePoolMetrics`.

**Ważne**: istniejący wzór `requiredFlow` w `PoolCalculations` (0.37×V/K) zostanie **zachowany** (używany do doboru pompy/filtra w kolejnych krokach). Nowy Q_DIN wg `A/(K×a)` pojawi się **obok** jako "Filtracja DIN (nowy wzór)" w panelu inżynieryjnym. Użytkownik będzie mógł zadecydować który wzór zastosować — na razie oba będą widoczne.

---

## Zmiany w `src/context/ConfiguratorContext.tsx`

1. Import nowych typów `EngineeringParams`, `EngineeringResults`
2. Nowe akcje:
   - `SET_ENGINEERING_PARAMS` — aktualizacja parametrów wejściowych
   - `SET_ENGINEERING_RESULTS` — zapis wyników (dispatch z DimensionsStep)
3. Stan początkowy: `engineeringParams` = `getDefaultEngineeringParams('prywatny', 'zewnetrzny')`, `engineeringResults` = null
4. W akcji `LOAD_OFFER` — odtworzenie `engineeringParams` z zapisanej oferty (jeśli istnieje)
5. W akcji `RESET` — reset do wartości domyślnych

---

## Kolejność implementacji plików

```text
1. src/lib/poolEngineeringCalcs.ts         (nowy - czyste funkcje)
2. src/types/configurator.ts               (nowe interfejsy, stałe)
3. src/context/ConfiguratorContext.tsx     (nowy stan + akcje)
4. src/components/steps/EngineeringCalcsPanel.tsx  (nowy komponent UI)
5. src/components/steps/DimensionsStep.tsx (integracja panelu)
```

---

## Szczegóły techniczne — wzory do implementacji

### q2 — straty ciepła (pełny wzór)

```typescript
const kOpen  = WIND_EXPOSURE_COEFFICIENTS[windExposure];
const kCover = COVER_COEFFICIENTS[poolCover];
const deltaT = targetTemp - airTemp;

if (deltaT <= 0) {
  q2 = 0;
} else {
  q2 = surfaceArea * 0.012 * deltaT
     * ((kOpen * hoursOpenPerDay + kCover * hoursCoveredPerDay) / 24);
}
```

### Zbiornik przelewowy — woda przelewowa

```typescript
const L = perimeterLength; // długość rynny = obwód basenu
overflowWaterM3 = 0.052 * surfaceArea * Math.pow(10, -0.144 * (Q / L));
```

### Pojemność zbiornika przelewowego

```typescript
const flushUsedFromPool = flushWaterPerFilterM3 * (flushFromPoolPercent / 100);
const base = displacedWaterM3 + overflowWaterM3
           + flushWaterPerFilterM3 - flushUsedFromPool;
minTankVolumeM3 = base * (1 + overflowReservePercent / 100);
```

---

## Co NIE jest w tym zakresie

- Szacunkowy pobór energii (zależy od doboru urządzeń — osobna iteracja)
- Integracja z PDF (osobna iteracja po weryfikacji poprawności wyników)
- Nowe typy basenów (SPA, brodzik — rozszerzenie w przyszłości)
