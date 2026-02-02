# Plan: Rozszerzone szczegóły kalkulacji folii

## Status: ✅ ZAIMPLEMENTOWANO

## Podsumowanie zmian

Naprawa i rozbudowa dialogu "Szczegóły kalkulacji" w module wykończenia:
- ✅ **Wszystkie 4 ściany** zamiast 2 (2× długa + 2× krótka)
- ✅ **Ilość rolek + odpad** (podsumowanie + rozwijana tabela szczegółów)
- ✅ **Konfigurator MIX** z automatyczną optymalizacją i możliwością ręcznej korekty per powierzchnia
- ✅ **Przełączane widoki** (Tabs): 3D i 2D osobno
- ✅ **Tabela formuł materiałów** (prosta tabela z wzorem i wynikiem)

---

## Zaimplementowane pliki

### Nowe pliki:
| Plik | Opis |
|------|------|
| `src/lib/foil/mixPlanner.ts` | Logika planowania MIX rolek z auto-optymalizacją |
| `src/components/finishing/components/RollSummary.tsx` | Podsumowanie rolek z rozwijalnymi szczegółami |
| `src/components/finishing/components/RollConfigTable.tsx` | Tabela konfiguracji MIX z dropdownami per powierzchnia |
| `src/components/finishing/components/Foil3DVisualization.tsx` | Widok 3D pasów folii (Canvas z React Three Fiber) |
| `src/components/finishing/components/MaterialFormulasTable.tsx` | Prosta tabela formuł materiałów |

### Zmodyfikowane pliki:
| Plik | Zakres zmian |
|------|--------------|
| `src/components/FoilLayoutVisualization.tsx` | Dodanie wszystkich 4 ścian (2× długa + 2× krótka) |
| `src/components/finishing/components/CalculationDetailsDialog.tsx` | Nowe sekcje: rolki, MIX config, tabs, formuły |
| `src/lib/foil/index.ts` | Eksport nowych typów i funkcji z mixPlanner |

---

## Funkcjonalności

### 1. Wizualizacja wszystkich 5 powierzchni
- Dno basenu
- Ściana długa 1 (przód)
- Ściana długa 2 (tył)
- Ściana krótka 1 (lewa)
- Ściana krótka 2 (prawa)

### 2. Podsumowanie rolek (RollSummary)
- Liczba rolek 1.65m i 2.05m
- Pasek wykorzystania materiału (%)
- Odpad w m² i %
- Rozwijalna tabela szczegółów każdej rolki

### 3. Konfigurator MIX (RollConfigTable)
- Auto-optymalizacja domyślnie włączona
- Możliwość ręcznej zmiany szerokości rolki per powierzchnia
- Przycisk "Przywróć optymalizację"
- Wskaźnik trybu (auto/ręczny)

### 4. Zakładki wizualizacji
- **Widok 3D**: Interaktywny widok basenu z pasami folii
- **2D Rozłożone**: Wszystkie powierzchnie jako osobne diagramy
- **Rolka 1.65m**: Porównanie dla węższej rolki
- **Rolka 2.05m**: Porównanie dla szerszej rolki

### 5. Tabela formuł materiałów
- Materiał | Formuła | Wartość wejściowa | Wynik
- Podkład, Kątownik PVC, Klej, Nity, Silikon, Taśma
