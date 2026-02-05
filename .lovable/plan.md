
# Plan: Zbrojenie w sekcji Prace budowlane

## Podsumowanie
Dodanie konfiguracji zbrojenia do tabeli "Zapotrzebowanie materiałowe" z wyborem między zbrojeniem tradycyjnym (12mm, 6mm) a kompozytowym (8mm). Każdy typ zbrojenia będzie miał rozwijalną listę pozycji (dno, słupy, wieniec, brodzik, schody) z automatycznymi obliczeniami. Na podglądzie 2D zostanie naniesione rozmieszczenie słupów.

---

## Sekcja techniczna

### 1. Nowe typy i stan
```typescript
type ReinforcementType = 'traditional' | 'composite';
type MeshSize = '15x15' | '20x20' | '25x25';
type ReinforcementUnit = 'mb' | 'kg';

interface ReinforcementPosition {
  id: string;
  name: string;
  enabled: boolean;
  quantity: number;      // mb lub kg
  customOverride: boolean;
}

interface ReinforcementItem {
  id: string;            // 'rebar_12mm', 'rebar_6mm', 'composite_8mm'
  name: string;
  diameter: number;
  unit: ReinforcementUnit;
  rate: number;
  positions: ReinforcementPosition[];
  totalQuantity: number;
  netValue: number;
}
```

### 2. Formuły obliczeniowe

**Dno (podwójna siatka):**
```
powierzchnia_dna = (długość + 0.48) * (szerokość + 0.48)
oczka_X = Math.ceil((długość + 0.48) / oczko)
oczka_Y = Math.ceil((szerokość + 0.48) / oczko)

// Jedna warstwa siatki
pręty_wzdłuż_X = oczka_Y + 1  // ilość prętów
długość_pręta_X = długość + 0.48

pręty_wzdłuż_Y = oczka_X + 1
długość_pręta_Y = szerokość + 0.48

mb_jedna_warstwa = (pręty_wzdłuż_X * długość_pręta_X) + (pręty_wzdłuż_Y * długość_pręta_Y)
mb_dno = mb_jedna_warstwa * 2  // podwójna siatka
```

**Słupy (basen murowany):**
```
// Rozstaw co 2m
słupy_długość = Math.floor(długość / 2) - 1  // wewnętrzne słupy
słupy_szerokość = Math.floor(szerokość / 2) - 1
ilość_słupów = (słupy_długość * 2) + (słupy_szerokość * 2)

// 4 pręty na słup, długość = głębokość + grubość płyty
długość_pręta = głębokość + grubość_płyty
mb_słupy = ilość_słupów * 4 * długość_pręta
```

**Wieniec (basen murowany):**
```
obwód = 2 * (długość + szerokość)
mb_wieniec = 4 * obwód  // 4 pręty dookoła
```

**Brodzik:**
```
pow_brodzika = brodzik.width * brodzik.length
// Analogicznie do dna - podwójna siatka
```

**Schody:**
```
// 2x suma długości wszystkich stopni
łączna_długość_stopni = szerokość_schodów * ilość_stopni
mb_schody = 2 * łączna_długość_stopni
```

**Przelicznik kg/mb:**
| Średnica | kg/mb |
|----------|-------|
| 6mm      | 0.222 |
| 8mm      | 0.395 |
| 12mm     | 0.888 |

### 3. Komponenty UI

**A. Wybór typu zbrojenia:**
- RadioGroup: "Tradycyjne" / "Kompozytowe"
- Domyślnie: "Tradycyjne"

**B. Wybór jednostki:**
- RadioGroup: "Metry bieżące (mb)" / "Kilogramy (kg)"
- Domyślnie: "mb"

**C. Wybór oczka siatki:**
- Select: 15x15 / 20x20 / 25x25 cm
- Domyślnie: 20x20

**D. Tabela zbrojenia:**
```
+----------------------------------+----------+------+-------+-------------+
| Pozycja                          | Ilość    | Jdn. | Stawka| Wartość     |
+----------------------------------+----------+------+-------+-------------+
| ▼ Zbrojenie 12mm                 |          |      |       |             |
|   └ Dno                          | 245.6    | mb   | 8.50  | 2,087.60 zł |
|   └ Słupy                        | 48.0     | mb   | 8.50  |   408.00 zł |
|   └ Wieniec                      | 96.0     | mb   | 8.50  |   816.00 zł |
|   └ Brodzik                      | 32.4     | mb   | 8.50  |   275.40 zł |
|   └ Schody                       | 12.0     | mb   | 8.50  |   102.00 zł |
|   Razem 12mm                     | 434.0    | mb   |       | 3,689.00 zł |
+----------------------------------+----------+------+-------+-------------+
| Zbrojenie 6mm (strzemiona)       | 0        | mb   | 5.00  |     0.00 zł |
+----------------------------------+----------+------+-------+-------------+
```

### 4. Wizualizacja słupów na 2D

**Nowy komponent:** `ColumnPositions2D`
- Renderuje kółka (24x24cm) w miejscach słupów
- Rozstaw: co 2m od narożników
- Kolor: pomarańczowy z etykietą "S1", "S2", itd.

**Lokalizacja słupów:**
```typescript
function calculateColumnPositions(length: number, width: number): Point[] {
  const positions: Point[] = [];
  const spacing = 2; // 2m
  
  // Ściany wzdłuż długości (górna i dolna)
  for (let x = spacing; x < length; x += spacing) {
    positions.push({ x: x - length/2, y: -width/2 }); // górna
    positions.push({ x: x - length/2, y: width/2 });  // dolna
  }
  
  // Ściany wzdłuż szerokości (lewa i prawa)
  for (let y = spacing; y < width; y += spacing) {
    positions.push({ x: -length/2, y: y - width/2 }); // lewa
    positions.push({ x: length/2, y: y - width/2 });  // prawa
  }
  
  return positions;
}
```

### 5. Zmiany w plikach

| Plik | Zmiana |
|------|--------|
| `src/components/steps/GroundworksStep.tsx` | Dodanie sekcji zbrojenia z wyborem typu, jednostki, oczka siatki i rozwijalną tabelą pozycji |
| `src/components/Pool2DPreview.tsx` | Dodanie renderowania pozycji słupów (opcjonalnie, gdy basen murowany) |
| `src/types/configurator.ts` | Rozszerzenie typów o konfigurację zbrojenia (opcjonalne) |

### 6. Logika warunkowa

- **Słupy i Wieniec**: widoczne tylko gdy `constructionTechnology === 'masonry'`
- **Brodzik**: widoczny tylko gdy `dimensions.wadingPool?.enabled === true`
- **Schody**: widoczne tylko gdy `dimensions.stairs?.enabled === true`
- **Zbrojenie 6mm**: zawsze widoczne, domyślnie ilość = 0, edytowalne ręcznie
- **Kompozytowe 8mm**: widoczne tylko gdy typ zbrojenia = "kompozytowe"

---

## Następne kroki (logika basenu lanego)

Gdy podasz wzory dla technologii lanej, dodam:
- Pozycja "Ściany" zamiast "Słupy"
- Inne współczynniki lub formuły obliczeniowe
