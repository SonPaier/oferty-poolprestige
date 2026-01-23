
# Plan naprawy pobierania zdjęć folii

## Diagnoza problemu

Przeprowadzono szczegółową analizę i znaleziono przyczynę:

1. **Strona Renolit Alkorplan NIE zawiera tagu `og:image`** w metadanych
2. Obecny kod w `scrapeProductDetails` szuka `metadata.ogImage`, którego nie ma
3. Fallback do HTML regex też nie działa, bo szuka specyficznych wzorców których ta strona nie używa
4. **Rozwiązanie**: Firecrawl zwraca format `links` z pełną listą URLi - wśród nich są obrazki produktów

### Dowód z testu API

Wywołanie Firecrawl z `formats: ['links']` zwraca m.in.:
```
https://renolit-alkorplan.com/fileadmin/_processed_/7/4/csm_1_RENOLIT_Persia_Blue-_013_751748a086.jpg
https://renolit-alkorplan.com/fileadmin/_processed_/9/6/csm_Swimming_pool_RENOLIT_ALKORPLAN3000_Persia_Blue__1__fe54e92865.jpg
...
```

Pierwszy obrazek z `fileadmin/_processed_` to główne zdjęcie produktu.

---

## Plan zmian

### 1. Zmiana formatu scrape na `links` (zamiast `html`)

**Plik**: `src/lib/api/firecrawl.ts`

Zmienić wywołanie:
```typescript
const result = await firecrawlApi.scrape(product.url, {
  formats: ['links'],  // Zamiast ['html']
  onlyMainContent: false,
});
```

### 2. Nowa logika ekstrakcji obrazka

Zamiast szukać `metadata.ogImage`, wybrać pierwszy link kończący się na rozszerzenie obrazka z katalogu `fileadmin/_processed_`:

```typescript
// Szukaj pierwszego obrazka z fileadmin/_processed_
const links: string[] = scrapeData.links || [];
const imageLink = links.find((link: string) => 
  link.includes('/fileadmin/_processed_/') && 
  /\.(jpg|jpeg|png|webp)$/i.test(link)
);

if (imageLink) {
  updated.imageUrl = imageLink;
  console.log(`[scrape] ${product.symbol} -> found image: ${updated.imageUrl}`);
}
```

### 3. Fallback do ogólnego wyszukiwania obrazka

Jeśli nie znajdzie w `fileadmin/_processed_`, szuka dowolnego pierwszego `.jpg/.png`:

```typescript
if (!imageLink) {
  const anyImage = links.find((link: string) => 
    /\.(jpg|jpeg|png|webp)$/i.test(link) && 
    !link.includes('favicon') && 
    !link.includes('logo')
  );
  if (anyImage) {
    updated.imageUrl = anyImage;
  }
}
```

---

## Podsumowanie zmian

| Plik | Zmiana |
|------|--------|
| `src/lib/api/firecrawl.ts` | Zmiana formatu z `html` na `links`, nowa logika ekstrakcji URL obrazka z listy linków |

## Po wdrożeniu

1. Przejdź do `/import-foils`
2. Kliknij "Rozpocznij skanowanie"
3. Kliknij "Pobierz zdjęcia" - teraz powinny się pojawić miniatury
4. Kliknij "Zapisz" - obrazki zostaną zapisane do `product_images`
5. W `/produkty` zdjęcia będą widoczne

## Oczekiwany rezultat

W konsoli zobaczysz:
```
[scrape] ALKORPLAN-ALKORPLAN3000-PERSIA-BLUE -> found image: https://renolit-alkorplan.com/fileadmin/_processed_/.../csm_1_RENOLIT_Persia_Blue-_013_751748a086.jpg
[scrapeProductDetails] Total with images: 43
```
