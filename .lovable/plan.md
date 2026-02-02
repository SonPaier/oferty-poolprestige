
# Plan: Rozszerzone szczegóły kalkulacji folii

## Podsumowanie zmian

Naprawa i rozbudowa dialogu "Szczegóły kalkulacji" w module wykończenia:
- **Wszystkie 4 ściany** zamiast 2 (2× długa + 2× krótka)
- **Ilość rolek + odpad** (podsumowanie + rozwijana tabela szczegółów)
- **Konfigurator MIX** z automatyczną optymalizacją i możliwością ręcznej korekty per powierzchnia
- **Przełączane widoki** (Tabs): 3D i 2D osobno
- **Tabela formuł materiałów** (prosta tabela z wzorem i wynikiem)

---

## Zmiany w kodzie

### 1. Naprawa FoilLayoutVisualization - wszystkie ściany

**Plik:** `src/components/FoilLayoutVisualization.tsx`

**Problem:** Aktualnie renderowane są tylko 3 powierzchnie:
- Dno basenu (OK)
- Ściana boczna (tylko 1 zamiast 2)
- Ściana czołowa (tylko 1 zamiast 2)

**Rozwiązanie:** Renderowanie wszystkich 5 powierzchni:

```text
Przed:
- Dno basenu
- Ściana boczna (1×)
- Ściana czołowa (1×)

Po:
- Dno basenu (1×)
- Ściana długa lewa (1×)
- Ściana długa prawa (1×)
- Ściana krótka przednia (1×)
- Ściana krótka tylna (1×)
```

---

### 2. Nowa sekcja: Podsumowanie rolek i odpadu

**Lokalizacja:** `CalculationDetailsDialog.tsx`

**Nowa sekcja po wizualizacji:**

```text
┌─────────────────────────────────────────────────────────────────┐
│ 📦 PODSUMOWANIE ROLEK                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Potrzebne rolki:                                               │
│  ┌───────────────┐ ┌───────────────┐                            │
│  │ 3× rolka      │ │ 2× rolka      │     Łącznie: 5 rolek       │
│  │ 1.65m × 25m   │ │ 2.05m × 25m   │                            │
│  └───────────────┘ └───────────────┘                            │
│                                                                 │
│  Wykorzystanie:  [=================------] 78%                  │
│  Odpad:          18.5 m² (22%)                                  │
│                                                                 │
│  [▼ Pokaż szczegóły rolek]                                      │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Rolka # │ Szerokość │ Wykorzystane │ Odpad │ Pasy          │ │
│  │─────────────────────────────────────────────────────────── │ │
│  │ 1       │ 2.05m     │ 18.5m        │ 6.5m  │ Dno 1-2       │ │
│  │ 2       │ 2.05m     │ 22.0m        │ 3.0m  │ Dno 3, Ściana │ │
│  │ 3       │ 1.65m     │ 16.2m        │ 8.8m  │ Ściany krótkie│ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3. Konfigurator MIX rolek

**Lokalizacja:** Nowa sekcja w `CalculationDetailsDialog.tsx`

**Logika:**
1. System automatycznie oblicza optymalny rozkład (najmniejszy odpad)
2. Użytkownik może ręcznie zmienić szerokość rolki dla każdej powierzchni

```text
┌─────────────────────────────────────────────────────────────────┐
│ ⚙️ KONFIGURACJA ROLEK                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Tryb: [Auto-optymalizacja ▾] / Ręczna konfiguracja             │
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ Powierzchnia        │ Szerokość rolki │ Pasy │ Odpad       │ │
│  │─────────────────────────────────────────────────────────── │ │
│  │ Dno                 │ [2.05m ▾]       │ 2    │ 0.3m²       │ │
│  │ Ściany długie (2×)  │ [1.65m ▾]       │ 4    │ 0.8m²       │ │
│  │ Ściany krótkie (2×) │ [1.65m ▾]       │ 2    │ 0.2m²       │ │
│  │ Schody              │ [1.65m ▾]       │ 1    │ 0.1m²       │ │
│  └────────────────────────────────────────────────────────────┘ │
│                                                                 │
│  [Przywróć automatyczną optymalizację]                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4. Widoki 3D / 2D w zakładkach (Tabs)

**Lokalizacja:** Sekcja wizualizacji w `CalculationDetailsDialog.tsx`

**Struktura:**

```text
┌─────────────────────────────────────────────────────────────────┐
│ 🔧 WIZUALIZACJA PASÓW FOLII                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  [3D Widok]  [2D Rozłożone]  [Rolka 1.65m]  [Rolka 2.05m]       │
│  ───────────────────────────────────────────────────────────    │
│                                                                 │
│  // Zawartość zależna od wybranej zakładki:                     │
│                                                                 │
│  3D Widok:                                                      │
│    - Widok 3D basenu z nałożonymi pasami folii (różne kolory)   │
│    - Interaktywny (rotate/zoom jak w kroku Wymiary)             │
│                                                                 │
│  2D Rozłożone:                                                  │
│    - Wszystkie 5 powierzchni jako osobne diagramy 2D            │
│    - Dno, 2× ściana długa, 2× ściana krótka                     │
│                                                                 │
│  Rolka 1.65m / Rolka 2.05m:                                     │
│    - Porównanie dla wybranej szerokości rolki                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### 5. Prosta tabela formuł materiałów

**Lokalizacja:** Sekcja materiałów w `CalculationDetailsDialog.tsx`

**Format tabeli:**

| Materiał | Formuła | Wartość wejściowa | Wynik |
|----------|---------|-------------------|-------|
| Podkład | powierzchnia × 1.1 | 86.4 m² | 96 m² |
| Kątownik PVC | obwód | 24.0 mb | 24 mb |
| Klej | powierzchnia / 20 | 86.4 m² | 5 kg |
| Nity | obwód × 4 | 24.0 mb | 96 szt |
| Silikon | obwód / 8 | 24.0 mb | 3 szt |
| Taśma | obwód × 1.05 | 24.0 mb | 26 mb |

---

## Pliki do modyfikacji

| Plik | Zakres zmian |
|------|--------------|
| `src/components/FoilLayoutVisualization.tsx` | Dodanie wszystkich 4 ścian, poprawa logiki |
| `src/components/finishing/components/CalculationDetailsDialog.tsx` | Nowe sekcje: rolki, MIX config, tabs, formuły |
| `src/lib/foilPlanner.ts` | Rozszerzenie funkcji o możliwość MIX config |

---

## Pliki do utworzenia

| Plik | Opis |
|------|------|
| `src/components/finishing/components/RollSummary.tsx` | Komponent podsumowania rolek z rozwijalnymi szczegółami |
| `src/components/finishing/components/RollConfigTable.tsx` | Tabela konfiguracji MIX z dropdownami per powierzchnia |
| `src/components/finishing/components/Foil3DVisualization.tsx` | Widok 3D pasów folii (Canvas z React Three Fiber) |
| `src/components/finishing/components/MaterialFormulasTable.tsx` | Prosta tabela formuł materiałów |

---

## Szczegóły techniczne

### Struktura danych dla MIX config

```typescript
interface SurfaceRollConfig {
  surface: 'bottom' | 'wall-long' | 'wall-short' | 'stairs' | 'paddling';
  rollWidth: 1.65 | 2.05;
  stripCount: number;
  wasteArea: number;
  isManualOverride: boolean;
}

interface MixConfiguration {
  surfaces: SurfaceRollConfig[];
  totalRolls165: number;
  totalRolls205: number;
  totalWaste: number;
  wastePercentage: number;
  isOptimized: boolean;
}
```

### Algorytm auto-optymalizacji

1. Dla każdej powierzchni oblicz odpad dla obu szerokości rolek
2. Wybierz szerokość z mniejszym odpadem
3. Dla ścian sprawdź też, która szerokość lepiej pasuje do wysokości (z fałdą 15cm)
4. Optymalizuj pakowanie pasów w rolki (first-fit decreasing)

### Formuły materiałów (prosta tabela)

```typescript
const MATERIAL_FORMULAS = [
  { name: 'Podkład', formula: 'powierzchnia × 1.1', inputField: 'totalArea' },
  { name: 'Kątownik PVC', formula: 'obwód', inputField: 'perimeter' },
  { name: 'Klej kontaktowy', formula: 'powierzchnia / 20', inputField: 'totalArea' },
  { name: 'Nity', formula: 'obwód × 4', inputField: 'perimeter' },
  { name: 'Silikon', formula: 'obwód / 8', inputField: 'perimeter' },
  { name: 'Taśma', formula: 'obwód × 1.05', inputField: 'perimeter' },
];
```

---

## Przepływ użytkownika

1. **Otworzenie "Szczegóły kalkulacji"**
   - Wyświetlenie podsumowania rolek (ile, jaki odpad)
   - Domyślnie widoczna auto-optymalizacja

2. **Zmiana konfiguracji MIX (opcjonalnie)**
   - Rozwinięcie sekcji konfiguracji
   - Zmiana szerokości rolki dla wybranej powierzchni
   - Natychmiastowe przeliczenie odpadu

3. **Przegląd wizualizacji**
   - Przełączanie między zakładkami 3D / 2D / 1.65m / 2.05m
   - W 2D widoczne wszystkie 5 powierzchni z pasami

4. **Sprawdzenie formuł materiałów**
   - Prosta tabela: materiał → wzór → wartość wejściowa → wynik

---

## Szacowany nakład pracy

| Element | Czas |
|---------|------|
| Naprawa FoilLayoutVisualization (4 ściany) | 1h |
| RollSummary z rozwijalnymi szczegółami | 1.5h |
| RollConfigTable (MIX konfigurator) | 2h |
| Foil3DVisualization (widok 3D pasów) | 2.5h |
| Tabs w CalculationDetailsDialog | 1h |
| MaterialFormulasTable (prosta tabela) | 0.5h |
| Integracja i testy | 1h |
| **SUMA** | **~9.5h** |
