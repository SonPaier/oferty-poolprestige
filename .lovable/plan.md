
# Zmiana opcji "Osłonięcie basenu" — dodanie K=0,5 i rozróżnienie nazw

## Co się zmienia

Obecna lista opcji `WindExposure`:

| Klucz | K | Etykieta |
|---|---|---|
| `wewnetrzny` | 1 | Wewnętrzny / zadaszony |
| `osloniety3` | 1.5 | Osłonięty z 3 stron |
| `osloniety2` | 2 | Osłonięty z 2 stron |
| `nieosloniety` | 3 | Nieosłonięty |
| `ekstremalny` | 4 | Ekstremalny |

Docelowa lista:

| Klucz | K | Etykieta |
|---|---|---|
| `wewnetrzny` | **0.5** | **Basen wewnętrzny (K=0,5)** |
| `zadaszony` (nowy) | **1** | **Basen pod zadaszeniem (K=1)** |
| `osloniety3` | 1.5 | Osłonięty z 3 stron (K=1,5) |
| `osloniety2` | 2 | Osłonięty z 2 stron (K=2) |
| `nieosloniety` | 3 | Nieosłonięty (K=3) |
| `ekstremalny` | 4 | Ekstremalny — morze, skarpa (K=4) |

## Szczegóły techniczne

### 1. `src/types/configurator.ts`

Typ `WindExposure` rozszerzony o nowy klucz `'zadaszony'`:

```typescript
export type WindExposure =
  | 'wewnetrzny'   // K=0.5 (basen wewnętrzny)
  | 'zadaszony'    // K=1   (basen pod zadaszeniem) — NOWY
  | 'osloniety3'   // K=1.5
  | 'osloniety2'   // K=2
  | 'nieosloniety' // K=3
  | 'ekstremalny'; // K=4
```

### 2. `src/lib/poolEngineeringCalcs.ts`

- `WIND_EXPOSURE_COEFFICIENTS` — zmiana wartości `wewnetrzny` z `1` na `0.5`, dodanie `zadaszony: 1`
- `WIND_EXPOSURE_LABELS` — zmiana etykiety `wewnetrzny`, dodanie `zadaszony`
- `getDefaultEngineeringParams()` — domyślny `windExposure` dla basenu wewnętrznego pozostaje `'wewnetrzny'` (nowa wartość K=0,5 jest bardziej precyzyjna)

## Brak zmian w UI

`EngineeringCalcsPanel.tsx` renderuje opcje dynamicznie przez `Object.keys(WIND_EXPOSURE_LABELS)`, więc nowa pozycja pojawi się automatycznie bez żadnej edycji tego pliku.

## Kolejność wyświetlania

JavaScript `Object.keys()` zachowuje kolejność wstawiania, więc kolejność w obiekcie `WIND_EXPOSURE_LABELS` wyznacza kolejność w dropdownie — nowy klucz `zadaszony` będzie na drugiej pozycji (po `wewnetrzny`).
