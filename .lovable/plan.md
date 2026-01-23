

# Plan: Automatyczne wykrywanie odcienia folii z obrazka (HEX) - wersja uproszczona

## Podsumowanie zmian

Implementuję automatyczną ekstrakcję dominującego koloru z obrazków produktów z:
1. **Uproszczoną paletą** - 8 podstawowych odcieni zamiast szczegółowych gradacji
2. **Hierarchią źródeł** - priorytet dla danych producenta

---

## Uproszczona paleta kolorów

Zamiast wielu podobnych odcieni (beżowy/piaskowy/kremowy, szary/ciemnoszary/jasnoszary), używam 8 podstawowych kategorii:

| Odcień | Obejmuje | Przykładowy HEX |
|--------|----------|-----------------|
| biały | biały, kremowy, perłowy | #FFFFFF, #FFFDD0 |
| beżowy | beżowy, piaskowy, kremowy, cappuccino | #C2B280, #F5F5DC |
| szary | szary, jasnoszary, ciemnoszary, antracyt | #808080, #A9A9A9, #404040 |
| czarny | czarny, grafitowy | #000000, #1a1a1a |
| niebieski | niebieski, jasnoniebieski, adriatycki, grecki | #0000FF, #87CEEB, #1E90FF |
| turkusowy | turkusowy, morski, aqua | #008080, #40E0D0 |
| zielony | zielony, oliwkowy, karaibski | #008000, #6B8E23 |
| brązowy | brązowy, czekoladowy, terakota | #8B4513, #A0522D |

---

## Hierarchia źródeł odcienia

System określa odcień w następującej kolejności priorytetów:

```text
┌─────────────────────────────────────────────────────────────┐
│  1. DANE PRODUCENTA (najwyższy priorytet)                   │
│     - Kolor/shade z metadanych strony                       │
│     - Nazwa kolekcji sugerująca kolor (np. "Blue Line")     │
│     - Opis produktu zawierający nazwę koloru                │
├─────────────────────────────────────────────────────────────┤
│  2. EKSTRAKCJA Z OBRAZKA                                    │
│     - Analiza dominującego koloru pikseli                   │
│     - Mapowanie HEX na uproszczoną paletę                   │
├─────────────────────────────────────────────────────────────┤
│  3. MAPOWANIE Z NAZWY PRODUKTU (fallback)                   │
│     - Słownik SHADE_MAPPING                                 │
│     - Wykrywanie słów kluczowych (blue, grey, sand...)      │
├─────────────────────────────────────────────────────────────┤
│  4. null - brak możliwości określenia                       │
└─────────────────────────────────────────────────────────────┘
```

---

## Szczegóły implementacji

### 1. Nowa Edge Function: `extract-dominant-color`

```typescript
// Uproszczona paleta - 8 kolorów bazowych
const SIMPLIFIED_PALETTE = [
  { hex: '#FFFFFF', shade: 'biały', range: ['white', 'cream', 'pearl'] },
  { hex: '#D2B48C', shade: 'beżowy', range: ['beige', 'sand', 'cappuccino', 'cream'] },
  { hex: '#808080', shade: 'szary', range: ['grey', 'gray', 'anthracite', 'stone'] },
  { hex: '#000000', shade: 'czarny', range: ['black', 'graphite'] },
  { hex: '#4169E1', shade: 'niebieski', range: ['blue', 'adriatic', 'greek', 'azure'] },
  { hex: '#20B2AA', shade: 'turkusowy', range: ['turquoise', 'aqua', 'teal', 'caribbean'] },
  { hex: '#228B22', shade: 'zielony', range: ['green', 'olive'] },
  { hex: '#8B4513', shade: 'brązowy', range: ['brown', 'chocolate', 'terracotta'] },
];

// Funkcja mapująca HEX na uproszczony odcień
function mapHexToSimplifiedShade(hex: string): string {
  const rgb = hexToRgb(hex);
  let closest = { shade: 'nieznany', distance: Infinity };
  
  for (const color of SIMPLIFIED_PALETTE) {
    const dist = colorDistance(rgb, hexToRgb(color.hex));
    if (dist < closest.distance) {
      closest = { shade: color.shade, distance: dist };
    }
  }
  return closest.shade;
}
```

### 2. Wykrywanie koloru producenta

Rozszerzenie scrapera o ekstrakcję danych producenta:

```typescript
// Sprawdź dane producenta przed ekstrakcją z obrazka
function determineShadeWithProducerData(
  productName: string,
  producerColor?: string,  // np. "Adriatic Blue" z metadanych
  description?: string,    // opis produktu
  imageUrl?: string
): { shade: string, source: 'producer' | 'image' | 'name' } {
  
  // 1. Priorytet: Dane producenta
  if (producerColor) {
    const shade = mapProducerColorToShade(producerColor);
    if (shade) return { shade, source: 'producer' };
  }
  
  // 2. Sprawdź opis produktu
  if (description) {
    const shade = extractShadeFromText(description);
    if (shade) return { shade, source: 'producer' };
  }
  
  // 3. Ekstrakcja z obrazka
  if (imageUrl) {
    const { hex, shade } = await extractColorFromImage(imageUrl);
    if (shade !== 'nieznany') return { shade, source: 'image' };
  }
  
  // 4. Fallback: mapowanie z nazwy
  const shade = determineShadeFromName(productName);
  return { shade: shade || null, source: 'name' };
}
```

### 3. Mapowanie kolorów producenta

```typescript
// Mapowanie nazw kolorów producenta na uproszczoną paletę
const PRODUCER_COLOR_MAP: Record<string, string> = {
  // Angielskie
  'white': 'biały',
  'sand': 'beżowy',
  'beige': 'beżowy', 
  'cream': 'biały',
  'grey': 'szary',
  'gray': 'szary',
  'light grey': 'szary',
  'dark grey': 'szary',
  'anthracite': 'szary',
  'black': 'czarny',
  'blue': 'niebieski',
  'light blue': 'niebieski',
  'adriatic blue': 'niebieski',
  'greek blue': 'niebieski',
  'turquoise': 'turkusowy',
  'caribbean': 'turkusowy',
  'green': 'zielony',
  'brown': 'brązowy',
  
  // Niemieckie (ELBE)
  'weiß': 'biały',
  'grau': 'szary',
  'blau': 'niebieski',
  'schwarz': 'czarny',
};

function mapProducerColorToShade(producerColor: string): string | null {
  const normalized = producerColor.toLowerCase().trim();
  
  // Bezpośrednie dopasowanie
  if (PRODUCER_COLOR_MAP[normalized]) {
    return PRODUCER_COLOR_MAP[normalized];
  }
  
  // Częściowe dopasowanie (np. "Adriatic Blue 2mm" → "niebieski")
  for (const [key, shade] of Object.entries(PRODUCER_COLOR_MAP)) {
    if (normalized.includes(key)) {
      return shade;
    }
  }
  
  return null;
}
```

### 4. Nowa kolumna w bazie danych

```sql
ALTER TABLE products ADD COLUMN extracted_hex text;
```

---

## Zmiany w plikach

| Plik | Zmiana |
|------|--------|
| `supabase/functions/extract-dominant-color/index.ts` | Nowa edge function z uproszczoną paletą |
| `supabase/functions/import-foils-from-web/index.ts` | Hierarchia źródeł: producent → obrazek → nazwa |
| `src/lib/api/firecrawl.ts` | Mapowanie kolorów producenta, uproszczona paleta |
| `supabase/config.toml` | Rejestracja nowej funkcji |
| Baza danych | Kolumna `extracted_hex` |
| `src/pages/ImportFoils.tsx` | Wizualna próbka koloru + źródło (ikona) |

---

## UI - wyświetlanie odcienia z próbką

```tsx
// W podglądzie importu i liście produktów
<div className="flex items-center gap-2">
  {product.extractedHex && (
    <div 
      className="w-4 h-4 rounded-full border border-gray-300"
      style={{ backgroundColor: product.extractedHex }}
      title={`HEX: ${product.extractedHex}`}
    />
  )}
  <Badge variant="outline">{product.shade}</Badge>
  {/* Ikona źródła */}
  {product.shadeSource === 'producer' && <Factory className="w-3 h-3" />}
  {product.shadeSource === 'image' && <Image className="w-3 h-3" />}
</div>
```

---

## Oczekiwany rezultat

- 8 podstawowych odcieni zamiast ~15 szczegółowych
- Priorytet dla danych producenta (bardziej wiarygodne)
- Wizualna próbka koloru HEX w UI
- Automatyczne wykrywanie ~95% produktów
- Informacja o źródle odcienia (producent/obrazek/nazwa)

