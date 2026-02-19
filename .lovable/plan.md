
# Aktualizacja przykryć basenu — 4 typy z nowymi współczynnikami

## Co się zmienia

Obecna lista `PoolCover` jest zastąpiona nową, opartą na podanych przez Ciebie danych:

| Klucz | Etykieta | Redukcja strat | wsp_przykrycia |
|---|---|---|---|
| `brak` | Brak przykrycia | 0% | **1.00** |
| `folia_komorkowa` | Folia komórkowa (bąbelkowa) | ~60–65% | **0.35** |
| `pianka_izolacyjna` | Pianka izolacyjna (GeoBubble) | ~70–75% | **0.25** |
| `roleta_pvc` | Roleta profilowa PVC / Poliwęglan | ~80–85% | **0.15** |

Stary klucz `folia_solarna` zostaje zastąpiony przez `folia_komorkowa` i `pianka_izolacyjna`. Klucz `roleta_pvc` pozostaje — zmienia się tylko etykieta i wartość współczynnika (z `0.15` na `0.15` — bez zmian).

## Uwaga: wartość COVER_COEFFICIENTS w nowym modelu

Zgodnie z planem wymiany wzoru q2 (Magnus + ASHRAE), `COVER_COEFFICIENTS` będzie teraz przechowywać **wsp_przykrycia** jako współczynnik redukcji strat (ile strat zostaje gdy basen jest przykryty), a nie dawny K do starego wzoru. Wartości już są właściwe:

```
brak:             1.00  ← 100% strat (brak redukcji)
folia_komorkowa:  0.35  ← zostaje 35% strat (60-65% redukcja)
pianka_izolacyjna: 0.25 ← zostaje 25% strat (70-75% redukcja)
roleta_pvc:       0.15  ← zostaje 15% strat (80-85% redukcja)
```

---

## Pliki do zmiany

### 1. `src/types/configurator.ts` — typ `PoolCover`

```typescript
export type PoolCover =
  | 'brak'              // brak przykrycia
  | 'folia_komorkowa'   // folia komórkowa/bąbelkowa, redukcja ~60-65%
  | 'pianka_izolacyjna' // pianka izolacyjna GeoBubble, redukcja ~70-75%
  | 'roleta_pvc';       // roleta profilowa PVC/Poliwęglan, redukcja ~80-85%
```

### 2. `src/lib/poolEngineeringCalcs.ts` — stałe

```typescript
export const COVER_COEFFICIENTS: Record<PoolCover, number> = {
  brak: 1.0,
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
```

### 3. Żadnych zmian w UI (`EngineeringCalcsPanel.tsx`)

Dropdown renderuje opcje dynamicznie przez `Object.keys(COVER_LABELS)` — nowe pozycje pojawią się automatycznie.

---

## Wpływ na istniejące oferty

Oferty zapisane w bazie z wartością `poolCover: 'folia_solarna'` będą miały nierozpoznany klucz po zmianie. Ryzyko jest niskie — to parametr inżynieryjny, a fallback w obliczeniach (nieznany klucz → `undefined` → `0`) spowoduje brak redukcji strat (zachowawcze). Można dodać mapowanie fallback w `getDefaultEngineeringParams` lub `LOAD_OFFER` — zrobię to w implementacji.

---

## Kolejność

```
1. src/types/configurator.ts          — zmiana typu PoolCover
2. src/lib/poolEngineeringCalcs.ts    — aktualizacja COVER_COEFFICIENTS i COVER_LABELS
```
