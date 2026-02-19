import { PoolType, PoolLocation, WindExposure, PoolCover, EngineeringParams } from '@/types/configurator';

// ─── Współczynniki wiatru ────────────────────────────────────────────────────
export const WIND_EXPOSURE_COEFFICIENTS: Record<WindExposure, number> = {
  wewnetrzny: 0.5,
  zadaszony: 1,
  osloniety3: 1.5,
  osloniety2: 2,
  nieosloniety: 3,
  ekstremalny: 4,
};

export const WIND_EXPOSURE_LABELS: Record<WindExposure, string> = {
  wewnetrzny: 'Basen wewnętrzny (K=0,5)',
  zadaszony: 'Basen pod zadaszeniem (K=1)',
  osloniety3: 'Osłonięty z 3 stron (K=1,5)',
  osloniety2: 'Osłonięty z 2 stron (K=2)',
  nieosloniety: 'Nieosłonięty (K=3)',
  ekstremalny: 'Ekstremalny — morze, skarpa (K=4)',
};

// ─── Współczynniki przykrycia ─────────────────────────────────────────────────
// Wartości = współczynnik redukcji strat (ile strat POZOSTAJE gdy basen jest przykryty)
export const COVER_COEFFICIENTS: Record<PoolCover, number> = {
  brak: 1.00,
  folia_komorkowa: 0.35,
  pianka_izolacyjna: 0.25,
  roleta_pvc: 0.15,
};

export const COVER_LABELS: Record<PoolCover, string> = {
  brak: 'Brak przykrycia',
  folia_komorkowa: 'Folia komórkowa (bąbelkowa) — redukcja ~60%',
  pianka_izolacyjna: 'Pianka izolacyjna (GeoBubble) — redukcja ~75%',
  roleta_pvc: 'Roleta profilowa PVC / Poliwęglan — redukcja ~80%',
};

// ─── Domyślne wartości parametrów ────────────────────────────────────────────
export function getDefaultEngineeringParams(
  poolType: PoolType,
  location: PoolLocation
): EngineeringParams {
  const isIndoor = location === 'wewnetrzny';

  const base: EngineeringParams = {
    // Woda świeża
    fillingTimeH: 24,

    // Grzanie
    targetTemp: 28,
    initialTemp: 10,
    airTemp: 20,
    heatingTimeH: 96,
    windExposure: isIndoor ? 'wewnetrzny' : 'nieosloniety',
    hoursOpenPerDay: isIndoor ? 0 : 24,
    poolCover: 'brak',
    hoursCoveredPerDay: 0,

    // Filtracja DIN
    surfaceCoeffA: 4.5,
    assistedDisinfection: false,
    manualPersonCount: undefined,
    filterCount: 1,
    filtrationSpeedMH: 30,

    // Zbiornik przelewowy
    overflowReservePercent: 20,
    flushFromPoolPercent: 0,
  };

  switch (poolType) {
    case 'prywatny':
      return {
        ...base,
        fillingTimeH: 24,
        surfaceCoeffA: 4.5,
        airTemp: isIndoor ? 28 : 20,
      };

    case 'polprywatny':
      return {
        ...base,
        fillingTimeH: 48,
        targetTemp: 28,
        initialTemp: 9,
        airTemp: 28,
        surfaceCoeffA: 2.7,
        windExposure: isIndoor ? 'wewnetrzny' : 'nieosloniety',
      };

    case 'hotelowy':
      return {
        ...base,
        fillingTimeH: 48,
        targetTemp: 28,
        initialTemp: 9,
        airTemp: 28,
        surfaceCoeffA: 2.7,
        windExposure: isIndoor ? 'wewnetrzny' : 'nieosloniety',
      };

    default:
      return base;
  }
}

// ─── Woda świeża ──────────────────────────────────────────────────────────────
export interface FreshWaterResult {
  minFlowM3H: number; // min. wydajność przyłącza [m³/h]
}

export function calculateFreshWater(
  volumeM3: number,
  fillingTimeH: number
): FreshWaterResult {
  const minFlowM3H = volumeM3 / Math.max(fillingTimeH, 0.1);
  return { minFlowM3H };
}

// ─── Parowanie wody (Magnus + ASHRAE) ────────────────────────────────────────
export interface EvaporationResult {
  pSatWaterHPa: number;
  pPartialAirHPa: number;
  deltaPHPa: number;
  evaporationLH: number;    // W_odkryty [l/h]
  evaporationLDay: number;  // ważone godzinami [l/dobę]
  q2MaxKW: number;          // strata bez przykrycia [kW]
  q2kW: number;             // strata ważona dobowo [kW]
}

function calculateEvaporation(
  targetTemp: number,
  airTemp: number,
  surfaceAreaM2: number,
  windExposure: WindExposure,
  poolCover: PoolCover,
  hoursOpenPerDay: number,
  hoursCoveredPerDay: number
): EvaporationResult {
  // Wilgotność względna
  const RH = (windExposure === 'wewnetrzny' || windExposure === 'zadaszony') ? 0.60 : 0.55;

  // Magnus — ciśnienie pary nasyconej [hPa]
  const getPsat = (T: number) => 6.11 * Math.exp((17.62 * T) / (243.12 + T));
  const pSatWaterHPa = getPsat(targetTemp);
  const pPartialAirHPa = getPsat(airTemp) * RH;
  const deltaPHPa = Math.max(0, pSatWaterHPa - pPartialAirHPa);

  // Prędkość wiatru = K z WIND_EXPOSURE_COEFFICIENTS [m/s]
  const v = WIND_EXPOSURE_COEFFICIENTS[windExposure];

  // Parowanie odkryte [l/h]
  // Stałe ASHRAE (0.045 + 0.041×v) są skalibrowane dla ΔP w kPa → dzielimy hPa przez 10
  const deltaPkPa = deltaPHPa / 10;
  const evaporationLH = surfaceAreaM2 * deltaPkPa * (0.045 + 0.041 * v);

  // Konwekcja [kW] — tylko przy ΔT > 0 (basen cieplejszy od powietrza)
  const qConvKW = Math.max(0, surfaceAreaM2 * 0.005 * (targetTemp - airTemp));

  // Straty odkryte [kW]: latent heat of vaporization ≈ 0.68 kW·h/l
  const q2MaxKW = evaporationLH * 0.68 + qConvKW;

  // Współczynnik redukcji przykrycia
  const kCover = COVER_COEFFICIENTS[poolCover] ?? 1.0;

  // Straty ważone dobowo [kW]
  const q2kW = Math.max(
    0,
    q2MaxKW * (hoursOpenPerDay / 24) + q2MaxKW * kCover * (hoursCoveredPerDay / 24)
  );

  // Parowanie l/dobę (ważone)
  const evaporationLDay =
    evaporationLH * hoursOpenPerDay + evaporationLH * kCover * hoursCoveredPerDay;

  return {
    pSatWaterHPa: Math.round(pSatWaterHPa * 100) / 100,
    pPartialAirHPa: Math.round(pPartialAirHPa * 100) / 100,
    deltaPHPa: Math.round(deltaPHPa * 100) / 100,
    evaporationLH: Math.round(evaporationLH * 10) / 10,
    evaporationLDay: Math.round(evaporationLDay * 10) / 10,
    q2MaxKW: Math.round(q2MaxKW * 100) / 100,
    q2kW: Math.round(q2kW * 100) / 100,
  };
}

// ─── Grzanie wody ─────────────────────────────────────────────────────────────
export interface HeatingResult {
  q1kW: number;            // ciepło do nagrzania wody
  q2kW: number;            // straty ciepła z powierzchni
  heatingPowerKW: number;  // ceil(q1 + q2)
  evaporation: EvaporationResult;
}

export function calculateHeating(
  params: Pick<
    EngineeringParams,
    | 'targetTemp'
    | 'initialTemp'
    | 'airTemp'
    | 'heatingTimeH'
    | 'windExposure'
    | 'hoursOpenPerDay'
    | 'poolCover'
    | 'hoursCoveredPerDay'
  >,
  surfaceAreaM2: number,
  volumeM3: number
): HeatingResult {
  const {
    targetTemp, initialTemp, airTemp, heatingTimeH,
    windExposure, hoursOpenPerDay, poolCover, hoursCoveredPerDay,
  } = params;

  // q1 — energia do nagrzewania wody
  const q1kW =
    (volumeM3 * 1.163 * Math.max(targetTemp - initialTemp, 0)) /
    Math.max(heatingTimeH, 0.1);

  // q2 — straty ciepła (model Magnus + ASHRAE)
  const evaporation = calculateEvaporation(
    targetTemp, airTemp, surfaceAreaM2,
    windExposure, poolCover, hoursOpenPerDay, hoursCoveredPerDay
  );
  const q2kW = evaporation.q2kW;

  const heatingPowerKW = Math.ceil(q1kW + q2kW);

  return {
    q1kW: Math.round(q1kW * 100) / 100,
    q2kW,
    heatingPowerKW,
    evaporation,
  };
}

// ─── Filtracja DIN ────────────────────────────────────────────────────────────
export interface DINFiltrationResult {
  personCount: number;          // N = A/a (lub manualPersonCount)
  kCoeff: number;               // 0.5 lub 0.6
  dinFlowM3H: number;           // Q = N/K + 6×atrakcje
  circulationTimeH: number;     // V / Q
  cyclesPerDay: number;         // 24 / circulationTime
  totalFilterAreaM2: number;    // Q / v_filtracji
  filterAreaEachM2: number;     // total / filterCount
  filterDiameterEachCm: number; // D = 2×√(A/π) przeliczone na cm
}

export function calculateDINFiltration(
  params: Pick<
    EngineeringParams,
    | 'surfaceCoeffA'
    | 'assistedDisinfection'
    | 'manualPersonCount'
    | 'filterCount'
    | 'filtrationSpeedMH'
  >,
  surfaceAreaM2: number,
  volumeM3: number,
  attractionsCount: number
): DINFiltrationResult {
  const { surfaceCoeffA, assistedDisinfection, manualPersonCount, filterCount, filtrationSpeedMH } = params;

  const kCoeff = assistedDisinfection ? 0.6 : 0.5;
  const personCount =
    manualPersonCount != null && manualPersonCount > 0
      ? manualPersonCount
      : Math.floor(surfaceAreaM2 / Math.max(surfaceCoeffA, 0.1));

  const dinFlowM3H = personCount / kCoeff + 6 * attractionsCount;

  const circulationTimeH = volumeM3 / Math.max(dinFlowM3H, 0.01);
  const cyclesPerDay = 24 / Math.max(circulationTimeH, 0.01);
  const totalFilterAreaM2 = dinFlowM3H / Math.max(filtrationSpeedMH, 1);
  const safeFilterCount = Math.max(filterCount, 1);
  const filterAreaEachM2 = totalFilterAreaM2 / safeFilterCount;
  // Średnica filtra: D = 2 × √(A / π), przeliczona na cm
  const filterDiameterEachCm = 2 * Math.sqrt(filterAreaEachM2 / Math.PI) * 100;

  return {
    personCount,
    kCoeff,
    dinFlowM3H: Math.round(dinFlowM3H * 100) / 100,
    circulationTimeH: Math.round(circulationTimeH * 100) / 100,
    cyclesPerDay: Math.round(cyclesPerDay * 100) / 100,
    totalFilterAreaM2: Math.round(totalFilterAreaM2 * 1000) / 1000,
    filterAreaEachM2: Math.round(filterAreaEachM2 * 1000) / 1000,
    filterDiameterEachCm: Math.round(filterDiameterEachCm * 10) / 10,
  };
}

// ─── Zbiornik przelewowy ──────────────────────────────────────────────────────
export interface OverflowTankResult {
  displacedWaterM3: number;       // N × 0.75 / 1000 [m³]  (0.75L/os)
  overflowWaterM3: number;        // 0.052 × A × 10^(-0.144 × Q/L)
  flushWaterPerFilterM3: number;  // filterAreaEach × 6
  minTankVolumeM3: number;        // suma + zapas
}

export function calculateOverflowTank(
  params: Pick<EngineeringParams, 'overflowReservePercent' | 'flushFromPoolPercent'>,
  personCount: number,
  dinFlowM3H: number,
  surfaceAreaM2: number,
  perimeterLengthM: number,
  filterAreaEachM2: number
): OverflowTankResult {
  const { overflowReservePercent, flushFromPoolPercent } = params;

  // Woda wypierana przez kąpiących (0.75L/os = 0.00075m³/os)
  const displacedWaterM3 = personCount * 0.75 / 1000;

  // Woda przelewowa
  const L = Math.max(perimeterLengthM, 0.1);
  const overflowWaterM3 =
    0.052 * surfaceAreaM2 * Math.pow(10, -0.144 * (dinFlowM3H / L));

  // Woda do płukania 1 filtra
  const flushWaterPerFilterM3 = filterAreaEachM2 * 6;

  // Woda do płukania pomniejszona o pobraną z niecki
  const flushFromPool = flushWaterPerFilterM3 * (flushFromPoolPercent / 100);
  const base =
    displacedWaterM3 + overflowWaterM3 + flushWaterPerFilterM3 - flushFromPool;

  const minTankVolumeM3 = base * (1 + overflowReservePercent / 100);

  return {
    displacedWaterM3: Math.round(displacedWaterM3 * 1000) / 1000,
    overflowWaterM3: Math.round(overflowWaterM3 * 1000) / 1000,
    flushWaterPerFilterM3: Math.round(flushWaterPerFilterM3 * 1000) / 1000,
    minTankVolumeM3: Math.round(minTankVolumeM3 * 100) / 100,
  };
}

// ─── Główna funkcja wyliczająca wszystko ─────────────────────────────────────
export function calculateAllEngineering(
  params: EngineeringParams,
  surfaceAreaM2: number,
  volumeM3: number,
  perimeterLengthM: number,
  attractionsCount: number,
  isOverflow: boolean
) {
  const freshWater = calculateFreshWater(volumeM3, params.fillingTimeH);
  const heating = calculateHeating(params, surfaceAreaM2, volumeM3);
  const filtration = calculateDINFiltration(
    params, surfaceAreaM2, volumeM3, attractionsCount
  );
  const overflow = isOverflow
    ? calculateOverflowTank(
        params,
        filtration.personCount,
        filtration.dinFlowM3H,
        surfaceAreaM2,
        perimeterLengthM,
        filtration.filterAreaEachM2
      )
    : undefined;

  return { freshWater, heating, filtration, overflow };
}
