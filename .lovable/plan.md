# Faza 2: Rozbudowa Algorytmu Optymalizacji Folii ✅ ZAKOŃCZONE

## Zaimplementowane moduły

### src/lib/foil/types.ts
- `ExtendedSurfaceType` - nowe typy powierzchni (stairs-step, stairs-riser, paddling-bottom, paddling-wall, dividing-wall-*)
- `ExtendedSurfacePlan` - rozszerzony plan powierzchni
- `StairsPlanResult` - wynik planowania folii na schody
- `PaddlingPlanResult` - wynik planowania folii na brodzik
- `DividingWallPlan` - szczegóły geometrii murka rozdzielającego
- `ExtendedFoilPlanResult` - rozszerzony wynik planowania

### src/lib/foil/helpers.ts
- `isStructuralFoil()` - sprawdzenie czy folia jest strukturalna
- `isButtJointFoil()` - sprawdzenie czy folia wymaga zgrzewania doczołowego
- `getAntiSlipFoilForStairs()` - automatyczny dobór folii antypoślizgowej
- `scoreCuttingPlan()` - punktacja planu cięcia (niższy = lepszy)
- `calculateButtJointLength()` - obliczanie długości zgrzewów doczołowych

### src/lib/foil/stairsPlanner.ts
- `planStairsSurface()` - planowanie folii na schody
- `calculateTotalStairsArea()` - całkowita powierzchnia schodów

### src/lib/foil/paddlingPlanner.ts
- `planPaddlingPoolSurface()` - planowanie folii na brodzik z murkiem
- `calculateTotalPaddlingArea()` - całkowita powierzchnia brodzika

### src/lib/foil/index.ts
- Eksport wszystkich funkcji i typów

---

## Poprawione reguły folii antypoślizgowej

| Powierzchnia | Typ folii | Uwagi |
|--------------|-----------|-------|
| Dno basenu | Wybrana | Główna folia |
| Ściany basenu | Wybrana | Główna folia |
| **Stopnie schodów (poziome)** | **Antypoślizgowa*** | Strukturalna |
| Podstopnie (pionowe) | Wybrana | Główna folia |
| **Dno brodzika** | **Antypoślizgowa*** | Strukturalna |
| Ściany brodzika | Wybrana | Główna folia |
| Murek - strona basenu | Wybrana | poolDepth - paddlingDepth |
| Murek - strona brodzika | Wybrana | dividingWallOffset |
| Murek - góra | Wybrana | 15cm szerokość |

*Jeśli wybrana folia jest już strukturalna → wszędzie ta sama folia

---

## Geometria murka rozdzielającego

Przykład: basen 1.4m, brodzik 0.4m, offset murka 0.2m:

```text
                0m ─────────────────────────────────────────
                   │                      │ góra murka (0.15m szerokość)
              -0.2m├──────────────────────┼────────────────
                   │                      │
              -0.4m│    BRODZIK (0.4m)    │ ściana murka 0.2m (od strony brodzika)
         dno brodzika ────────────────────┘
                   │
                   │       BASEN GŁÓWNY
                   │    ściana podniesiona 1.0m (od strony basenu)
                   │    = poolDepth - paddlingDepth = 1.4 - 0.4
              -1.4m│
          dno basenu ─────────────────────────────────────────
```

Obliczenia:
- **Strona basenu**: 1.4m - 0.4m = **1.0m** wysokości
- **Strona brodzika**: **0.2m** wysokości (= offset murka)
- **Góra murka**: **0.15m** szerokość (stała)

---

# Następne kroki

## Faza 3: Integracja z CoveringStep.tsx
- [ ] Użycie nowych plannerów do obliczania powierzchni
- [ ] Automatyczne dodawanie folii antypoślizgowej do materiałów
- [ ] Wyświetlanie rozbicia powierzchni w dialogu szczegółów
- [ ] Obsługa folii strukturalnej (butt joints) - zgrzewanie doczołowe

## Faza 4: Aktualizacja wizualizacji
- [ ] Wyświetlanie pasów folii na schodach w 2D/3D
- [ ] Wyświetlanie pasów folii na brodziku w 2D/3D
- [ ] Kolorowanie powierzchni antypoślizgowych
