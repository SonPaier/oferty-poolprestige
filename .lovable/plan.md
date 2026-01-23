
# Plan: Rozbudowa widoku produktów

## Podsumowanie zmian

Rozbuduję stronę `/produkty` o:
1. **Filtrowanie po kategoriach** - dynamiczne pobieranie kategorii z bazy
2. **Miniatury zdjęć** - wyświetlanie pierwszego zdjęcia produktu
3. **Lepsze wyszukiwanie** - dzielenie frazy na słowa (AND logic)
4. **Przełączany widok** - tabela ↔ karty (grid)
5. **Sortowanie** - po nazwie, cenie, kategorii

---

## Szczegóły implementacji

### 1. Nowy hook: `useProductCategories`

Pobiera unikalne kategorie z bazy danych do filtrowania:

```text
Źródła kategorii:
- category: "folia", "attraction", null → "Pozostałe"
- foil_category: "strukturalna", "jednokolorowa", "nadruk", "antypoślizgowa"
- subcategory: "Alkorplan 2000", "Touch", "ELBE Solid"...

Zwraca:
[
  { value: "all", label: "Wszystkie", count: 3467 },
  { value: "folia", label: "Folie", count: 76 },
  { value: "attraction", label: "Atrakcje", count: 20 },
  { value: "other", label: "Pozostałe", count: 3371 }
]
```

### 2. Ulepszone wyszukiwanie (word splitting)

Zmiana logiki w `useProductsPaginated`:

```text
Obecna logika:
  "Alkorplan Bhumi" → name.ilike.%Alkorplan Bhumi%
  (wymaga dokładnej frazy)

Nowa logika:
  "Alkorplan Bhumi" → rozdziel na ["Alkorplan", "Bhumi"]
  → name.ilike.%Alkorplan% AND name.ilike.%Bhumi%
  (znajduje nawet "Folia Alkorplan Touch Bhumi 1.65m")
```

### 3. Pobieranie miniatur wraz z produktami

Zmodyfikuję query aby pobierać pierwsze zdjęcie produktu:

```text
SELECT p.*, 
  (SELECT image_url FROM product_images 
   WHERE product_id = p.id 
   ORDER BY sort_order LIMIT 1) as thumbnail_url
FROM products p
```

Alternatywnie: LEFT JOIN z agregacją lub osobne zapytanie dla widocznych produktów.

### 4. Przełączany widok (tabela/karty)

Dodanie przycisku toggle:
- **Tabela**: obecny widok + miniatura 40x40px w pierwszej kolumnie
- **Karty**: grid 4 kolumny, każda karta zawiera zdjęcie, nazwę, cenę, kategorię

```text
┌─────────────────────────────────────────────────────────┐
│  [🔍 Szukaj...]                     [📋 Tabela] [⊞ Karty] │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                    │
│  │ Wszystkie│ │ Folie   │ │ Atrakcje│ │ Pozostałe │      │
│  └─────────┘ └─────────┘ └─────────┘                    │
│  Sortuj: [Nazwa ▼]                                      │
└─────────────────────────────────────────────────────────┘
```

### 5. Sortowanie

Dropdown z opcjami:
- Nazwa (A-Z / Z-A)
- Cena (rosnąco / malejąco)
- Kategoria

---

## Zmiany w plikach

### `src/hooks/useProductsManagement.ts`
- Dodanie parametrów: `categoryFilter`, `sortBy`, `sortOrder`
- Zmiana logiki wyszukiwania na word splitting
- Pobieranie thumbnail_url z product_images

### `src/pages/Products.tsx`
- Dodanie stanu: `selectedCategory`, `viewMode`, `sortBy`, `sortOrder`
- Nowy pasek filtrów z Badge/chips dla kategorii
- Toggle przełączania widoku (ikony Table/Grid)
- Dropdown sortowania
- Widok kart (grid) jako alternatywa dla tabeli
- Miniatura w tabeli (40x40px z fallback placeholder)

### Nowy komponent: `src/components/ProductGridCard.tsx`
- Karta produktu dla widoku grid
- Większe zdjęcie (aspect-ratio 4:3)
- Nazwa, cena, kategoria jako badge
- Przyciski akcji (edycja, usunięcie)

---

## Interfejs użytkownika

### Pasek filtrów kategorii
Chips/badges poziomo z licznikami:
```
[Wszystkie (3467)] [Folie (76)] [Atrakcje (20)] [Pozostałe (3371)]
```

### Widok tabeli z miniaturą
| Zdjęcie | Symbol | Nazwa | Cena | Waluta | Kategoria | Akcje |
|---------|--------|-------|------|--------|-----------|-------|
| 📷40x40 | ALK-01 | Folia...| 123 | PLN    | folia     | ✏️🗑️  |

### Widok kart (grid)
```
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│   [📷]     │ │   [📷]     │ │   [📷]     │ │   [📷]     │
│ Folia Alko │ │ Prysznic   │ │ Pompa      │ │ Drabinka   │
│ 123,00 PLN │ │ 456,00 PLN │ │ 789,00 PLN │ │ 99,00 PLN  │
│ [folia]    │ │ [atrakcja] │ │            │ │            │
│  ✏️   🗑️   │ │  ✏️   🗑️   │ │  ✏️   🗑️   │ │  ✏️   🗑️   │
└────────────┘ └────────────┘ └────────────┘ └────────────┘
```

---

## Szczegóły techniczne

### Word splitting w wyszukiwaniu

```typescript
// Rozdziel szukaną frazę na słowa
const words = searchQuery.trim().split(/\s+/).filter(w => w.length >= 2);

// Dla każdego słowa utwórz warunek ILIKE
// Supabase nie wspiera wielu AND w .or(), więc użyjemy textSearch lub raw filter
// Alternatywa: filtrowanie po stronie klienta dla małych zbiorów

// Rozwiązanie: wiele .ilike() z AND
let query = supabase.from('products').select('*');
for (const word of words) {
  query = query.or(`name.ilike.%${word}%,symbol.ilike.%${word}%`);
}
```

### Pobieranie miniatur

Opcja 1: Subquery (wymaga funkcji DB)
Opcja 2: Osobne zapytanie dla widocznych produktów (po paginacji)
Opcja 3: LEFT JOIN z agregacją

Rekomenduję **Opcję 2** - najprostsza, bez zmian w schemacie:
```typescript
// Po pobraniu produktów
const productIds = products.map(p => p.id);
const { data: images } = await supabase
  .from('product_images')
  .select('product_id, image_url')
  .in('product_id', productIds)
  .order('sort_order')
  .limit(1); // per product - wymaga distinct on

// Mapowanie: productId → thumbnail_url
```

### Responsywność kart

```css
/* Grid responsywny */
grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5
```

---

## Podsumowanie zmian w plikach

| Plik | Zmiana |
|------|--------|
| `src/hooks/useProductsManagement.ts` | Word splitting, filtry kategorii, sortowanie, pobieranie miniatur |
| `src/pages/Products.tsx` | Pasek filtrów, toggle widoku, dropdown sortowania, widok kart |
| `src/components/ProductGridCard.tsx` | Nowy komponent karty produktu |

## Oczekiwany rezultat

- Wyszukiwanie "Alkorplan Bhumi" znajdzie wszystkie produkty zawierające oba słowa
- Szybkie filtrowanie po kategoriach jednym kliknięciem
- Podgląd miniatur produktów w obu widokach
- Elastyczne sortowanie listy
- Przełączanie między widokiem tabeli a kartami
