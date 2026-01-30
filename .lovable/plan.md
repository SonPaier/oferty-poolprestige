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

# Faza 3: Integracja z CoveringStep.tsx ✅ ZAKOŃCZONE

## Zmiany w CoveringStep.tsx

### Import nowych plannerów
```typescript
import { 
  planStairsSurface, 
  planPaddlingPoolSurface,
  isStructuralFoil,
  getAntiSlipFoilForStairs,
  StairsPlanResult,
  PaddlingPlanResult,
  FoilProduct
} from '@/lib/foil';
```

### Nowe obliczenia
- `stairsPlan` - wynik planowania schodów z `planStairsSurface()`
- `paddlingPlan` - wynik planowania brodzika z `planPaddlingPoolSurface()`
- `antiSlipBreakdown` - rozbicie powierzchni antypoślizgowych i zwykłych

### Wyświetlanie w UI
- Szczegółowy breakdown powierzchni antypoślizgowej:
  - Stopnie schodów (m²)
  - Dno brodzika (m²)
- Szczegółowy breakdown dodatkowej folii głównej:
  - Podstopnie (m²)
  - Ściany brodzika (m²)
  - Murek rozdzielający (strona basenu, strona brodzika, góra)

### Logika antypoślizgowej
- Jeśli wybrana folia jest strukturalna → nie dodajemy osobnej pozycji antypoślizgowej
- W przeciwnym razie → automatycznie dodajemy pozycję "Folia antypoślizgowa"

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

# Następne kroki

## Faza 4: Aktualizacja wizualizacji (opcjonalne)
- [ ] Wyświetlanie pasów folii na schodach w 2D/3D
- [ ] Wyświetlanie pasów folii na brodziku w 2D/3D
- [ ] Kolorowanie powierzchni antypoślizgowych

## Faza 5: Obsługa folii strukturalnej (butt joint)
- [ ] Wykrywanie `joint_type === 'butt'` w wybranej folii
- [ ] Obliczanie długości zgrzewów doczołowych
- [ ] Dodanie usługi "Zgrzewanie doczołowe" do materiałów
