
# Faza 6: Aktualizacja Dialogu Szczegółów Kalkulacji Folii

## Cel

Rozszerzenie istniejącego dialogu "Szczegóły kalkulacji" (przycisk "Szczegóły" przy karcie "Zapotrzebowanie") o informacje dotyczące schodów, brodzika i murka rozdzielającego.

---

## Stan obecny

Dialog zawiera 5 sekcji:
1. Obliczenie powierzchni (dno, ściany długie, ściany krótkie)
2. Naddatki (zakładki spawów, kształt nieregularny)
3. Optymalizacja rolek (szerokości, długość, zakładka)
4. Wynik kalkulacji (całkowita powierzchnia, odpad, liczba rolek)
5. Układ pasów (lista pasów z wymiarami)

---

## Zmiany do wprowadzenia

### Sekcja 1a (nowa): Schody
Warunek: wyświetlana tylko gdy `dimensions.stairs.enabled === true`

Zawartość:
```
📐 Schody
├── Liczba stopni: {stairs.stepCount}
├── Wymiary stopnia: {stepDepth}m × {stepHeight}m
├── Szerokość schodów: {stairsWidth}m
├── Kształt: {rectangular/diagonal-45}
│
├── Powierzchnia stopni (pozioma): {stairsPlan.stepArea} m²
│   └── Wymaga folii antypoślizgowej*
├── Powierzchnia podstopni (pionowa): {stairsPlan.riserArea} m²
│   └── Folia główna (regularna)
└── Razem schody: {stepArea + riserArea} m²
```

### Sekcja 1b (nowa): Brodzik
Warunek: wyświetlana tylko gdy `dimensions.wadingPool.enabled === true`

Zawartość:
```
🌊 Brodzik
├── Wymiary: {width}m × {length}m × {depth}m
│
├── Dno brodzika: {paddlingPlan.bottomArea} m²
│   └── Wymaga folii antypoślizgowej*
├── Ściany zewnętrzne (3 strony): {paddlingPlan.wallsArea} m²
│   └── Folia główna (regularna)
│
└── [Jeśli hasDividingWall]
    Murek rozdzielający:
    ├── Strona basenu (wys. {poolSideHeight}m): {poolSideArea} m²
    ├── Strona brodzika (wys. {paddlingSideHeight}m): {paddlingSideArea} m²
    ├── Góra murka (szer. 0.15m): {topArea} m²
    └── Razem murek: {poolSideArea + paddlingSideArea + topArea} m²
```

### Sekcja 4 (rozszerzona): Wynik kalkulacji
Dodanie podsumowania z podziałem na typy folii:

```
4. Wynik kalkulacji
├── Folia główna (niecki): {foilCalc.totalArea} m²
├── Dodatkowa folia regularna: {antiSlipBreakdown.totalRegularExtra} m²
│   └── (podstopnie + ściany brodzika + murek)
├── Folia antypoślizgowa: {antiSlipBreakdown.totalAntiSlip} m²
│   └── (stopnie schodów + dno brodzika)
├── RAZEM folia regularna: {foilCalc.totalArea + totalRegularExtra} m²
├── RAZEM antypoślizgowa: {totalAntiSlip} m²
│
├── [Jeśli folia strukturalna]
│   * Folia strukturalna jest antypoślizgowa - jedna folia na wszystko
│
├── Rolki 1,65m: X szt.
├── Rolki 2,05m: X szt.
└── Odpad: X%
```

### Wskaźnik wizualny
Dodanie legendy kolorów/ikon:
- 🟦 Folia regularna (główna)
- 🟧 Folia antypoślizgowa (strukturalna)

---

## Implementacja techniczna

### Plik: `src/components/steps/CoveringStep.tsx`

#### Lokalizacja: linie 571-649 (obecny dialog)

Zmiany w DialogContent:
1. Po sekcji "1. Obliczenie powierzchni" dodać nowe sekcje warunkowe dla schodów i brodzika
2. Rozszerzyć sekcję "4. Wynik kalkulacji" o podsumowanie typów folii
3. Dodać ikonę/badge przy powierzchniach wymagających antypoślizgowej

#### Wykorzystane dane (już dostępne w komponencie):
- `dimensions.stairs` - konfiguracja schodów
- `dimensions.wadingPool` - konfiguracja brodzika
- `stairsPlan` - wynik `planStairsSurface()`
- `paddlingPlan` - wynik `planPaddlingPoolSurface()`
- `antiSlipBreakdown` - podział na typy folii
- `selectedFoilIsStructural` - czy wybrana folia jest strukturalna

---

## Nowy layout dialogu

```text
┌─────────────────────────────────────────────────────────────┐
│ Sposób kalkulacji rolek folii                      [×]     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ 1. Obliczenie powierzchni niecki                            │
│   • Dno basenu: 8.0 × 4.0 = 32.00 m²                        │
│   • Ściany długie: 2 × 8.0 × 1.5 = 24.00 m²                 │
│   • Ściany krótkie: 2 × 4.0 × 1.5 = 12.00 m²                │
│   • Suma podstawowa: 68.00 m²                               │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ 📐 1a. Schody                          [widoczne gdy enabled]│
│   • Konfiguracja: 5 stopni, prostokątne                     │
│   • Wymiary stopnia: 0.29m × 0.20m                          │
│   • Szerokość schodów: 1.5m                                 │
│   ┌──────────────────────────────────────────────────────┐  │
│   │ Stopnie (poziome)    │  2.18 m² │ 🟧 antypoślizgowa  │  │
│   │ Podstopnie (pionowe) │  1.50 m² │ 🟦 regularna       │  │
│   │ Razem schody         │  3.68 m² │                    │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ 🌊 1b. Brodzik                         [widoczne gdy enabled]│
│   • Wymiary: 2.0m × 1.5m × 0.4m                             │
│   ┌──────────────────────────────────────────────────────┐  │
│   │ Dno brodzika         │  3.00 m² │ 🟧 antypoślizgowa  │  │
│   │ Ściany zewnętrzne    │  2.00 m² │ 🟦 regularna       │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                             │
│   Murek rozdzielający:                [widoczne gdy enabled]│
│   ┌──────────────────────────────────────────────────────┐  │
│   │ Strona basenu (1.0m) │  2.00 m² │ 🟦 regularna       │  │
│   │ Strona brodzika      │  0.40 m² │ 🟦 regularna       │  │
│   │ Góra murka (0.15m)   │  0.30 m² │ 🟦 regularna       │  │
│   │ Razem murek          │  2.70 m² │                    │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ 2. Naddatki                                                 │
│   • Zakładki spawów: +10%                                   │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ 3. Optymalizacja rolek                                      │
│   • (bez zmian)                                             │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ 4. Podsumowanie                                             │
│   ┌─────────────────────────────────────────────────────┐   │
│   │           Typ             │   m²   │    Rolki      │   │
│   ├───────────────────────────┼────────┼───────────────┤   │
│   │ 🟦 Folia główna           │  72.5  │ 1,65m: 2 szt. │   │
│   │ 🟧 Folia antypoślizgowa   │   5.2  │ 1,65m: 1 szt. │   │
│   ├───────────────────────────┼────────┼───────────────┤   │
│   │ Odpad łączny              │        │     8.5%      │   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
│   * Folia strukturalna jest antypoślizgowa                  │
│     (nie wymaga osobnej folii na schody/dno brodzika)       │
│                                                             │
│ ─────────────────────────────────────────────────────────── │
│                                                             │
│ 5. Układ pasów                                              │
│   • (bez zmian - lista pasów)                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Efekt końcowy

Po tej fazie użytkownik będzie mógł:
1. Zobaczyć dokładny podział powierzchni dla schodów (stopnie vs podstopnie)
2. Zobaczyć podział dla brodzika (dno, ściany, murek z 3 stronami)
3. Zrozumieć które powierzchnie wymagają folii antypoślizgowej
4. Wiedzieć że folia strukturalna eliminuje potrzebę osobnej folii antypoślizgowej
