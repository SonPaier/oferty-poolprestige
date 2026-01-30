# Status Projektu: Kalkulacja Folii

## Ukończone Fazy

### Faza 7: Aktualizacja Wizualizacji 2D/3D Układu Folii - UKOŃCZONA

**Data ukończenia:** 2026-01-30

**Zrealizowane zmiany:**
1. Rozszerzono `FoilLayoutVisualization.tsx` o nowe powierzchnie:
   - Stopnie schodów (antypoślizgowe - pomarańczowe)
   - Podstopnie schodów (regularne - niebieskie)
   - Dno brodzika (antypoślizgowe - pomarańczowe)
   - Ściany brodzika (regularne - niebieskie)
   - Murek rozdzielający z 3 powierzchniami

2. Zintegrowano wizualizację z dialogiem "Szczegóły kalkulacji" w CoveringStep:
   - Nowa sekcja "6. Wizualizacja układu folii"
   - Grupowanie powierzchni według typu
   - Oznaczenia kolorystyczne dla folii regularnej i antypoślizgowej

3. Dodano legendę i oznaczenia kolorystyczne:
   - 🟦 Folia regularna (niebieska)
   - 🟧 Folia antypoślizgowa (pomarańczowa)

**Pliki zmodyfikowane:**
- `src/components/FoilLayoutVisualization.tsx`
- `src/components/steps/CoveringStep.tsx`

---

# Faza 7: Aktualizacja Wizualizacji 2D/3D Układu Folii o Schody i Brodzik

## Stan obecny

### Komponent FoilLayoutVisualization.tsx
Istnieje komponent `FoilLayoutVisualization.tsx`, który:
- Generuje wizualizację SVG układu pasów folii
- Pokazuje 3 typy powierzchni: dno basenu, ściana boczna (długa), ściana czołowa (krótka)
- Wyświetla pasy folii z zakładkami (overlap) jako przerywane linie
- **NIE jest nigdzie zaimportowany ani używany w aplikacji**

### Problem
1. Komponent nie uwzględnia schodów ani brodzika
2. Komponent nie jest zintegrowany z dialogiem "Szczegóły kalkulacji" w CoveringStep
3. Brak wizualizacji dla powierzchni antypoślizgowych vs regularnych

---

## Cel Fazy 7

1. **Rozszerzyć FoilLayoutVisualization** o nowe powierzchnie:
   - Stopnie schodów (poziome) - oznaczone jako antypoślizgowe
   - Podstopnie schodów (pionowe) - regularna folia
   - Dno brodzika - antypoślizgowe
   - Ściany brodzika (3 strony) - regularna folia
   - Murek rozdzielający (3 powierzchnie) - regularna folia

2. **Zintegrować wizualizację** z dialogiem szczegółów w CoveringStep

3. **Dodać oznaczenia kolorystyczne** dla typów folii (regularna vs antypoślizgowa)

---

## Szczegółowy Layout Wizualizacji

### Dla schodów prostokątnych
```text
┌─────────────────────────────────────────────┐
│  Schody - stopnie (antypoślizgowa)          │
│  ┌─────────────────────────────────────┐    │
│  │ ╔══════════════════════════════════╗│ 1.5m │
│  │ ║ Stopień 1  ║ Stopień 2 ║ ... ║   ║│(width)│
│  │ ╚══════════════════════════════════╝│    │
│  └─────────────────────────────────────┘    │
│  Wymiary: 0.30m × 1.5m × 5 stopni = 2.25 m² │
│  [🟧 Powierzchnia antypoślizgowa]            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Schody - podstopnie                        │
│  ┌───────────────────────────────┐          │
│  │ Podstopień (pion)            ││ 0.20m   │
│  │ × 5 sztuk × 1.5m szer.       ││ (height)│
│  └───────────────────────────────┘          │
│  Wymiary: 0.20m × 1.5m × 5 = 1.50 m²        │
│  [🟦 Folia regularna]                        │
└─────────────────────────────────────────────┘
```

### Dla brodzika
```text
┌─────────────────────────────────────────────┐
│  Brodzik - dno (antypoślizgowa)             │
│  ┌─────────────────────────────────────┐    │
│  │ ┌───────────────────────────────┐   │    │
│  │ │   Dno brodzika               │   │ 1.5m │
│  │ │   2.0m × 1.5m = 3.0 m²       │   │    │
│  │ └───────────────────────────────┘   │    │
│  └─────────────────────────────────────┘    │
│  [🟧 Powierzchnia antypoślizgowa]            │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│  Brodzik - ściany zewnętrzne (3 strony)     │
│  ┌───────────────────────────────────┐      │
│  │ 2 × boczne: 1.5m × 0.4m = 1.20 m²│      │
│  │ 1 × tylna:  2.0m × 0.4m = 0.80 m²│      │
│  │ Razem: 2.00 m²                    │      │
│  └───────────────────────────────────────┘  │
│  [🟦 Folia regularna]                        │
└─────────────────────────────────────────────┘
```

### Dla murka rozdzielającego
```text
┌─────────────────────────────────────────────┐
│  Murek rozdzielający                        │
│  ┌───────────────────────────────────┐      │
│  │ Strona basenu:  2.0m × 1.0m = 2.0 m² │   │
│  │ Strona brodzika: 2.0m × 0.2m = 0.4 m²│   │
│  │ Góra murka: 2.0m × 0.15m = 0.3 m²    │   │
│  │ Razem: 2.70 m²                        │   │
│  └───────────────────────────────────────┘  │
│  [🟦 Folia regularna]                        │
└─────────────────────────────────────────────┘
```

---

## Legenda kolorów (w komponencie)

```text
┌─────────────────────────────────────────┐
│ Legenda:                                │
│ ▓▓▓ Folia główna (jednokolorowa/nadruk) │
│ ▓▓▓ Folia antypoślizgowa                │
│ --- Zakładka spawu (overlap)            │
│ ═══ Zgrzew doczołowy (butt joint)       │
└─────────────────────────────────────────┘
```
