
# Poprawka logiki UI — Sekcja "Grzanie wody" w EngineeringCalcsPanel

## Problem

Obecna kolejność pól i ich widoczność jest logicznie niepoprawna:

1. "Godzin odkrytego / dobę" wyświetla się **zawsze** — nawet gdy nie ma przykrycia (wtedy jest to zbędne, bo zawsze = 24h i nie wpływa na q2 bez przykrycia).
2. "Typ przykrycia" pojawia się **po** polu z godzinami — powinno być odwrotnie (typ przykrycia warunkuje resztę).
3. "Godzin pod przykryciem / dobę" jest edytowalne — powinno być **automatycznie wyliczane** jako `24 − hoursOpenPerDay` i wyświetlone jako informacja, nie input.

## Nowa logika UI — kolejność i warunkowe wyświetlanie

```text
Temperatura zadana [°C]         ← zawsze
Temperatura startowa wody [°C]  ← zawsze
Temperatura powietrza [°C]      ← zawsze
Czas podgrzewu [h]              ← zawsze
Osłonięcie basenu               ← zawsze (Select, K_odkryty)

Typ przykrycia                  ← zawsze (brak / folia solarna / roleta PVC)

  [jeśli poolCover !== 'brak']
  Godzin odkrytego / dobę       ← pojawia się TYLKO gdy jest przykrycie
  Godzin pod przykryciem / dobę ← WYLICZANE AUTOMATYCZNIE: 24 − hoursOpenPerDay
                                   wyświetlone jako tylko-do-odczytu info-box

  [jeśli poolCover === 'brak']
  — brak dodatkowych pól (odkryty = 24h/dobę = domyślne)
```

## Zmiany w `q2` obliczeniu

Gdy `poolCover === 'brak'`:
- `hoursOpenPerDay` = 24 (cały dzień odkryty)
- `hoursCoveredPerDay` = 0
- q2 = A × 0.012 × ΔT × (K_odkryty × 24 / 24) = A × 0.012 × ΔT × K_odkryty

Gdy jest przykrycie:
- użytkownik wpisuje `hoursOpenPerDay` (ile godzin bez przykrycia)
- `hoursCoveredPerDay` = 24 − hoursOpenPerDay (wyliczone automatycznie)
- q2 = A × 0.012 × ΔT × ((K_odkryty × h_open + K_cover × h_covered) / 24)

## Szczegóły implementacji

### Plik: `src/components/steps/EngineeringCalcsPanel.tsx`

**Sekcja grzania wody** — zmiany kolejności i warunkowego renderowania:

1. Kolejność pól: temperatury → czas podgrzewu → osłoniecie → **typ przykrycia** → (warunkowo) godziny odkrytego → (info) godziny pod przykryciem
2. Pole "Godzin odkrytego / dobę" pokazuje się **tylko gdy** `poolCover !== 'brak'`
3. Pole "Godzin pod przykryciem / dobę" zastąpione przez info-box tylko do odczytu: `"= 24 − {hoursOpenPerDay} = {24 - hoursOpenPerDay} h"` — widoczne tylko gdy jest przykrycie
4. Gdy `poolCover` zmienia się na `'brak'`, dispatch aktualizuje `hoursOpenPerDay = 24` i `hoursCoveredPerDay = 0`
5. Gdy użytkownik zmienia `hoursOpenPerDay`, automatycznie aktualizuje `hoursCoveredPerDay = 24 − hoursOpenPerDay` (obcinając do 0 jeśli ujemne)

### Przykład renderowania (z przykryciem = folia solarna, hoursOpen = 8)

```
Typ przykrycia:        [Folia solarna ▼]
Godzin odkrytego/dobę: [8            ]
Godzin pod przykryciem/dobę:  = 24 − 8 = 16 h  (info, nieedytowalne)
```

### Przykład renderowania (bez przykrycia)

```
Typ przykrycia:        [Brak         ▼]
(brak dodatkowych pól — odkryty cały czas)
```

## Tylko jeden plik do zmiany

`src/components/steps/EngineeringCalcsPanel.tsx` — wyłącznie sekcja sekcji "Grzanie wody" (linie ~260–340), bez zmian w logice obliczeń ani pozostałych sekcjach.
