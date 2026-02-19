import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Droplets, Flame, Filter, Container, RotateCcw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useConfigurator } from '@/context/ConfiguratorContext';
import {
  EngineeringParams,
  WindExposure,
  PoolCover,
} from '@/types/configurator';
import {
  calculateAllEngineering,
  WIND_EXPOSURE_LABELS,
  COVER_LABELS,
  getDefaultEngineeringParams,
} from '@/lib/poolEngineeringCalcs';

// ─── Mały pomocnik: wyróżniony box z wynikiem ─────────────────────────────────
function ResultBox({
  label,
  value,
  unit,
  highlight,
}: {
  label: string;
  value: string | number;
  unit?: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`p-3 rounded-lg border ${
        highlight
          ? 'bg-primary/10 border-primary/30'
          : 'bg-muted/30 border-border'
      }`}
    >
      <p className="text-xs text-muted-foreground uppercase tracking-wide leading-tight mb-1">
        {label}
      </p>
      <p className={`text-lg font-bold ${highlight ? 'text-primary' : ''}`}>
        {value}
        {unit && (
          <span className="text-xs font-normal text-muted-foreground ml-1">
            {unit}
          </span>
        )}
      </p>
    </div>
  );
}

// ─── Wiersz param + input ─────────────────────────────────────────────────────
function ParamRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <Label className="text-xs text-muted-foreground flex-1 leading-tight">
        {label}
      </Label>
      <div className="w-36 shrink-0">{children}</div>
    </div>
  );
}

// ─── Nagłówek sekcji collapsible ──────────────────────────────────────────────
function SectionHeader({
  icon,
  title,
  open,
}: {
  icon: React.ReactNode;
  title: string;
  open: boolean;
}) {
  return (
    <div className="flex items-center justify-between w-full py-2">
      <div className="flex items-center gap-2 text-sm font-semibold">
        {icon}
        {title}
      </div>
      {open ? (
        <ChevronUp className="w-4 h-4 text-muted-foreground" />
      ) : (
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function EngineeringCalcsPanel() {
  const { state, dispatch } = useConfigurator();
  const { engineeringParams, calculations, dimensions, poolType } = state;

  // Local open/close per section
  const [openFreshWater, setOpenFreshWater] = useState(true);
  const [openHeating, setOpenHeating] = useState(true);
  const [openFiltration, setOpenFiltration] = useState(true);
  const [openOverflow, setOpenOverflow] = useState(true);

  const isOverflow = dimensions.overflowType === 'rynnowy';

  // ── Update single param ──────────────────────────────────────────────────
  function updateParam<K extends keyof EngineeringParams>(
    key: K,
    value: EngineeringParams[K]
  ) {
    dispatch({
      type: 'SET_ENGINEERING_PARAMS',
      payload: { ...engineeringParams, [key]: value },
    });
  }

  // ── Re-calculate whenever params or pool geometry changes ─────────────────
  useEffect(() => {
    if (!calculations) return;
    const results = calculateAllEngineering(
      engineeringParams,
      calculations.surfaceArea,
      calculations.volume,
      calculations.perimeterLength,
      dimensions.attractions,
      isOverflow
    );
    const evap = results.heating.evaporation;
    dispatch({
      type: 'SET_ENGINEERING_RESULTS',
      payload: {
        freshWaterFlowM3H: results.freshWater.minFlowM3H,
        q1kW: results.heating.q1kW,
        q2kW: results.heating.q2kW,
        heatingPowerKW: results.heating.heatingPowerKW,
        personCount: results.filtration.personCount,
        dinFlowM3H: results.filtration.dinFlowM3H,
        circulationTimeH: results.filtration.circulationTimeH,
        cyclesPerDay: results.filtration.cyclesPerDay,
        totalFilterAreaM2: results.filtration.totalFilterAreaM2,
        filterAreaEachM2: results.filtration.filterAreaEachM2,
        filterDiameterEachCm: results.filtration.filterDiameterEachCm,
        // Parowanie (model Magnus/ASHRAE)
        evaporationLH: evap.evaporationLH,
        evaporationLDay: evap.evaporationLDay,
        pSatWaterHPa: evap.pSatWaterHPa,
        pPartialAirHPa: evap.pPartialAirHPa,
        deltaPHPa: evap.deltaPHPa,
        q2MaxKW: evap.q2MaxKW,
        overflow: results.overflow
          ? {
              displacedWaterM3: results.overflow.displacedWaterM3,
              overflowWaterM3: results.overflow.overflowWaterM3,
              flushWaterPerFilterM3: results.overflow.flushWaterPerFilterM3,
              minTankVolumeM3: results.overflow.minTankVolumeM3,
            }
          : undefined,
      },
    });
  }, [engineeringParams, calculations, dimensions.attractions, isOverflow]);

  // ── Reset params when pool type or location changes ───────────────────────
  useEffect(() => {
    const defaults = getDefaultEngineeringParams(poolType, dimensions.location);
    dispatch({ type: 'SET_ENGINEERING_PARAMS', payload: defaults });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poolType, dimensions.location]);

  if (!calculations) return null;

  const res = state.engineeringResults;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3 mt-4 border-t border-border pt-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Wyliczenia wstępne
      </p>

      {/* ── 1. Woda świeża ──────────────────────────────────────────────── */}
      <Collapsible open={openFreshWater} onOpenChange={setOpenFreshWater}>
        <CollapsibleTrigger className="w-full hover:bg-muted/30 rounded-lg px-2">
          <SectionHeader
            icon={<Droplets className="w-4 h-4 text-accent" />}
            title="Woda świeża"
            open={openFreshWater}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 px-1 pb-3">
          <ParamRow label="Czas napełniania [h]">
            <Input
              type="number"
              min={1}
              value={engineeringParams.fillingTimeH}
              onChange={(e) =>
                updateParam('fillingTimeH', Math.max(1, Number(e.target.value)))
              }
              className="h-8 text-sm"
            />
          </ParamRow>
          {res && (
            <ResultBox
              label="Min. wydajność przyłącza"
              value={res.freshWaterFlowM3H.toFixed(2)}
              unit="m³/h"
              highlight
            />
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* ── 2. Grzanie wody ─────────────────────────────────────────────── */}
      <Collapsible open={openHeating} onOpenChange={setOpenHeating}>
        <CollapsibleTrigger className="w-full hover:bg-muted/30 rounded-lg px-2">
          <SectionHeader
            icon={<Flame className="w-4 h-4 text-destructive" />}
            title="Grzanie wody"
            open={openHeating}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 px-1 pb-3">
          <ParamRow label="Temperatura zadana [°C]">
            <Input
              type="number"
              value={engineeringParams.targetTemp}
              onChange={(e) => updateParam('targetTemp', Number(e.target.value))}
              className="h-8 text-sm"
            />
          </ParamRow>
          <ParamRow label="Temperatura startowa wody [°C]">
            <Input
              type="number"
              value={engineeringParams.initialTemp}
              onChange={(e) => updateParam('initialTemp', Number(e.target.value))}
              className="h-8 text-sm"
            />
          </ParamRow>
          <ParamRow label="Temperatura powietrza [°C]">
            <Input
              type="number"
              value={engineeringParams.airTemp}
              onChange={(e) => updateParam('airTemp', Number(e.target.value))}
              className="h-8 text-sm"
            />
          </ParamRow>
          {/* Wilgotność powietrza RH */}
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground flex-1 leading-tight">
              Wilgotność powietrza [%]
              <br />
              <span className="text-[10px]">
                domyślnie:{' '}
                {(engineeringParams.windExposure === 'wewnetrzny' || engineeringParams.windExposure === 'zadaszony') ? '60%' : '55%'}
              </span>
            </Label>
            <div className="flex items-center gap-1 w-36 shrink-0">
              <Input
                type="number"
                min={10}
                max={100}
                value={engineeringParams.airHumidityPercent}
                onChange={(e) =>
                  updateParam('airHumidityPercent', Math.min(100, Math.max(10, Number(e.target.value))))
                }
                className="h-8 text-sm flex-1 min-w-0"
              />
              <button
                type="button"
                title="Przywróć wartość domyślną"
                onClick={() => {
                  const defaultRH = (engineeringParams.windExposure === 'wewnetrzny' || engineeringParams.windExposure === 'zadaszony') ? 60 : 55;
                  updateParam('airHumidityPercent', defaultRH);
                }}
                className="h-8 w-8 flex items-center justify-center rounded-md border border-border hover:bg-muted/50 text-muted-foreground hover:text-foreground shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <ParamRow label="Czas podgrzewu [h]">
            <Input
              type="number"
              min={1}
              value={engineeringParams.heatingTimeH}
              onChange={(e) =>
                updateParam('heatingTimeH', Math.max(1, Number(e.target.value)))
              }
              className="h-8 text-sm"
            />
          </ParamRow>
          <ParamRow label="Osłonięcie basenu">
            <Select
              value={engineeringParams.windExposure}
              onValueChange={(v) => updateParam('windExposure', v as WindExposure)}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(WIND_EXPOSURE_LABELS) as WindExposure[]).map((k) => (
                  <SelectItem key={k} value={k} className="text-xs">
                    {WIND_EXPOSURE_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ParamRow>
          <ParamRow label="Typ przykrycia">
            <Select
              value={engineeringParams.poolCover}
              onValueChange={(v) => {
                const cover = v as PoolCover;
                if (cover === 'brak') {
                  dispatch({
                    type: 'SET_ENGINEERING_PARAMS',
                    payload: { ...engineeringParams, poolCover: cover, hoursOpenPerDay: 24, hoursCoveredPerDay: 0 },
                  });
                } else {
                  updateParam('poolCover', cover);
                }
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(COVER_LABELS) as PoolCover[]).map((k) => (
                  <SelectItem key={k} value={k} className="text-xs">
                    {COVER_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ParamRow>
          {engineeringParams.poolCover !== 'brak' && (
            <>
              <ParamRow label="Godzin odkrytego / dobę">
                <Input
                  type="number"
                  min={0}
                  max={24}
                  value={engineeringParams.hoursOpenPerDay}
                  onChange={(e) => {
                    const open = Math.min(24, Math.max(0, Number(e.target.value)));
                    dispatch({
                      type: 'SET_ENGINEERING_PARAMS',
                      payload: { ...engineeringParams, hoursOpenPerDay: open, hoursCoveredPerDay: Math.max(0, 24 - open) },
                    });
                  }}
                  className="h-8 text-sm"
                />
              </ParamRow>
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground flex-1 leading-tight">
                  Godzin pod przykryciem / dobę
                </Label>
                <div className="w-36 shrink-0 h-8 flex items-center px-3 rounded-md border border-border bg-muted/30 text-sm text-muted-foreground">
                  = 24 − {engineeringParams.hoursOpenPerDay} = <span className="font-semibold text-foreground ml-1">{Math.max(0, 24 - engineeringParams.hoursOpenPerDay)} h</span>
                </div>
              </div>
            </>
          )}

          {res && (
            <>
              <div className="grid grid-cols-3 gap-2 mt-1">
                <ResultBox label="q1 (nagrzewanie)" value={res.q1kW.toFixed(1)} unit="kW" />
                <ResultBox label="q2 (straty)" value={res.q2kW.toFixed(1)} unit="kW" />
                <ResultBox
                  label="Min. moc grzewcza"
                  value={res.heatingPowerKW}
                  unit="kW"
                  highlight
                />
              </div>
              {/* Parowanie — szczegóły modelu Magnus/ASHRAE */}
              <p className="text-xs text-muted-foreground uppercase tracking-wide mt-3 mb-1">
                Parowanie wody (Magnus / ASHRAE)
              </p>
              <div className="grid grid-cols-3 gap-2">
                <ResultBox
                  label="P_wody"
                  value={res.pSatWaterHPa.toFixed(2)}
                  unit="hPa"
                />
                <ResultBox
                  label="P_powietrza"
                  value={res.pPartialAirHPa.toFixed(2)}
                  unit="hPa"
                />
                <ResultBox
                  label="ΔP"
                  value={res.deltaPHPa.toFixed(2)}
                  unit="hPa"
                  highlight
                />
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                <ResultBox
                  label="Parowanie (odkryte)"
                  value={res.evaporationLH.toFixed(1)}
                  unit="l/h"
                />
                <ResultBox
                  label="Parowanie / dobę"
                  value={res.evaporationLDay.toFixed(0)}
                  unit="l/d"
                />
                <ResultBox
                  label="q2 maks."
                  value={res.q2MaxKW.toFixed(2)}
                  unit="kW"
                />
              </div>
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* ── 3. Filtracja DIN ────────────────────────────────────────────── */}
      <Collapsible open={openFiltration} onOpenChange={setOpenFiltration}>
        <CollapsibleTrigger className="w-full hover:bg-muted/30 rounded-lg px-2">
          <SectionHeader
            icon={<Filter className="w-4 h-4 text-primary" />}
            title="Filtracja i obieg wody (DIN)"
            open={openFiltration}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 px-1 pb-3">
          {/* Współczynnik "a" */}
          <ParamRow label='Wsp. pow. użytkowej "a"'>
            <Select
              value={String(engineeringParams.surfaceCoeffA)}
              onValueChange={(v) => {
                const num = Number(v);
                if (!isNaN(num)) updateParam('surfaceCoeffA', num);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="2.2" className="text-xs">2,2 – brodzik</SelectItem>
                <SelectItem value="2.7" className="text-xs">2,7 – rekreacyjny</SelectItem>
                <SelectItem value="4.5" className="text-xs">4,5 – sportowy/prywatny</SelectItem>
              </SelectContent>
            </Select>
          </ParamRow>
          {/* Ręczne "a" */}
          <ParamRow label='Własna wartość "a" (ręcznie)'>
            <Input
              type="number"
              step={0.1}
              min={0.5}
              value={engineeringParams.surfaceCoeffA}
              onChange={(e) => {
                const val = Number(e.target.value);
                if (val > 0) updateParam('surfaceCoeffA', val);
              }}
              className="h-8 text-sm"
            />
          </ParamRow>

          {/* Dezynfekcja wspomagająca */}
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs text-muted-foreground flex-1 leading-tight">
              Dezynfekcja wspomagająca
              <br />
              <span className="text-[10px]">(węgiel, UV, ozon → K=0,6)</span>
            </Label>
            <Switch
              checked={engineeringParams.assistedDisinfection}
              onCheckedChange={(v) => updateParam('assistedDisinfection', v)}
            />
          </div>

          {/* Liczba osób N */}
          <div className="p-2 rounded bg-muted/20 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                Maks. liczba osób N (A/a = {calculations.surfaceArea.toFixed(1)}/{engineeringParams.surfaceCoeffA})
              </span>
              <span className="font-semibold">
                {res?.personCount ?? Math.floor(calculations.surfaceArea / engineeringParams.surfaceCoeffA)}
              </span>
            </div>
          </div>
          <ParamRow label="Ręczne nadpisanie N (0 = auto)">
            <Input
              type="number"
              min={0}
              value={engineeringParams.manualPersonCount ?? 0}
              onChange={(e) => {
                const val = Number(e.target.value);
                updateParam('manualPersonCount', val > 0 ? val : undefined);
              }}
              className="h-8 text-sm"
            />
          </ParamRow>

          <ParamRow label="Liczba filtrów">
            <Input
              type="number"
              min={1}
              value={engineeringParams.filterCount}
              onChange={(e) =>
                updateParam('filterCount', Math.max(1, Number(e.target.value)))
              }
              className="h-8 text-sm"
            />
          </ParamRow>
          <ParamRow label="Prędkość filtracji [m/h]">
            <Input
              type="number"
              min={5}
              max={100}
              value={engineeringParams.filtrationSpeedMH}
              onChange={(e) =>
                updateParam('filtrationSpeedMH', Math.max(5, Number(e.target.value)))
              }
              className="h-8 text-sm"
            />
          </ParamRow>

          {res && (
            <div className="grid grid-cols-2 gap-2 mt-1">
              <ResultBox
                label="Q_DIN (wydajność)"
                value={res.dinFlowM3H.toFixed(1)}
                unit="m³/h"
                highlight
              />
              <ResultBox
                label="Czas obiegu"
                value={res.circulationTimeH.toFixed(2)}
                unit="h"
              />
              <ResultBox
                label="Obiegi / dobę"
                value={res.cyclesPerDay.toFixed(1)}
              />
              <ResultBox
                label="Pow. filtracji łącznie"
                value={res.totalFilterAreaM2.toFixed(3)}
                unit="m²"
              />
              {engineeringParams.filterCount > 1 ? (
                <>
                  <ResultBox
                    label={`Pow. 1 filtra (/${engineeringParams.filterCount})`}
                    value={res.filterAreaEachM2.toFixed(3)}
                    unit="m²"
                  />
                  <ResultBox
                    label={`Śr. 1 filtra (/${engineeringParams.filterCount})`}
                    value={res.filterDiameterEachCm.toFixed(1)}
                    unit="cm"
                    highlight
                  />
                </>
              ) : (
                <ResultBox
                  label="Śr. zalecana filtra"
                  value={res.filterDiameterEachCm.toFixed(1)}
                  unit="cm"
                  highlight
                />
              )}
            </div>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* ── 4. Zbiornik przelewowy (tylko rynnowy) ──────────────────────── */}
      {isOverflow && (
        <Collapsible open={openOverflow} onOpenChange={setOpenOverflow}>
          <CollapsibleTrigger className="w-full hover:bg-muted/30 rounded-lg px-2">
            <SectionHeader
              icon={<Container className="w-4 h-4 text-secondary-foreground" />}
              title="Zbiornik przelewowy"
              open={openOverflow}
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 px-1 pb-3">
            <ParamRow label="Zapas objętości [%]">
              <Input
                type="number"
                min={0}
                max={100}
                value={engineeringParams.overflowReservePercent}
                onChange={(e) =>
                  updateParam(
                    'overflowReservePercent',
                    Math.max(0, Number(e.target.value))
                  )
                }
                className="h-8 text-sm"
              />
            </ParamRow>
            <ParamRow label="Woda płukania z niecki [%]">
              <Input
                type="number"
                min={0}
                max={100}
                value={engineeringParams.flushFromPoolPercent}
                onChange={(e) =>
                  updateParam(
                    'flushFromPoolPercent',
                    Math.min(100, Math.max(0, Number(e.target.value)))
                  )
                }
                className="h-8 text-sm"
              />
            </ParamRow>

            {res?.overflow && (
              <div className="grid grid-cols-2 gap-2 mt-1">
                <ResultBox
                  label="Woda wypierana"
                  value={res.overflow.displacedWaterM3.toFixed(3)}
                  unit="m³"
                />
                <ResultBox
                  label="Woda przelewowa"
                  value={res.overflow.overflowWaterM3.toFixed(3)}
                  unit="m³"
                />
                <ResultBox
                  label="Woda płukania / filtr"
                  value={res.overflow.flushWaterPerFilterM3.toFixed(3)}
                  unit="m³"
                />
                <ResultBox
                  label="Min. pojemność czynna"
                  value={res.overflow.minTankVolumeM3.toFixed(2)}
                  unit="m³"
                  highlight
                />
              </div>
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
