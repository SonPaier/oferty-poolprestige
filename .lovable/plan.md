
# Plan naprawy pobierania zdjęć dla brakujących folii

## Diagnoza

Odkryto, że format `links` w Firecrawl **nie zwraca obrazków dla niektórych kolekcji** (Alive, Kolos, Ceramics Evolve, Vogue Nordic), ponieważ te strony ładują obrazki przez JavaScript (lazy-loading).

**Rozwiazanie**: Format `markdown` zawiera obrazki w formie `![alt](url)` - Firecrawl renderuje stronę i konwertuje do markdown, wliczając obrazki.

Przykład odpowiedzi dla `/collections/alive/chandra`:
```markdown
![](https://renolit-alkorplan.com/fileadmin/_processed_/0/c/csm_DSC_0002_6af9569512.jpg)
![](https://renolit-alkorplan.com/fileadmin/_processed_/3/7/csm_DSC_0003_13479525a2.jpg)
...
```

---

## Plan zmian

### 1. Zmiana strategii scrape na dwuetapową

**Plik**: `src/lib/api/firecrawl.ts`

Zmienić logikę `scrapeProductDetails`:

```typescript
// Krok 1: Najpierw sprobuj format 'links' (szybki, dziala dla wiekszosci)
const result = await firecrawlApi.scrape(product.url, {
  formats: ['links'],
  onlyMainContent: false,
});

// Wyciagnij imageUrl z links
let imageUrl = extractImageFromLinks(scrapeData.links);

// Krok 2: Jesli brak obrazka, uzyj formatu 'markdown' (fallback)
if (!imageUrl) {
  const mdResult = await firecrawlApi.scrape(product.url, {
    formats: ['markdown'],
    onlyMainContent: true,
  });
  imageUrl = extractImageFromMarkdown(mdResult.data?.markdown);
}
```

### 2. Nowa funkcja ekstrakcji obrazka z markdown

```typescript
function extractImageFromMarkdown(markdown: string): string | undefined {
  if (!markdown) return undefined;
  
  // Szukaj wzorca ![alt](url) lub ![](url)
  const imgRegex = /!\[[^\]]*\]\((https?:\/\/[^)]+\.(?:jpg|jpeg|png|webp))\)/gi;
  const matches = [...markdown.matchAll(imgRegex)];
  
  // Filtruj obrazki produktowe (z fileadmin/_processed_)
  const productImage = matches.find(m => m[1].includes('/fileadmin/_processed_/'));
  if (productImage) return productImage[1];
  
  // Fallback: pierwszy obrazek ktory nie jest favicon/logo
  const anyImage = matches.find(m => 
    !m[1].includes('favicon') && 
    !m[1].includes('logo') && 
    !m[1].includes('icon')
  );
  return anyImage?.[1];
}
```

### 3. Zachowanie istniejącej logiki jako pierwszego kroku

Obecna logika z formatem `links` pozostaje jako **pierwszy krok** - działa dla 33 z 43 produktów. Format `markdown` będzie tylko **fallback** dla brakujących 10 produktów.

---

## Podsumowanie zmian

| Plik | Zmiana |
|------|--------|
| `src/lib/api/firecrawl.ts` | Dodanie fallback do formatu `markdown` gdy `links` nie zawiera obrazka |

## Oczekiwany rezultat

- **33 produkty**: obrazek z formatu `links` (jak dotychczas)
- **10 produktow** (Alive, Kolos, Ceramics Evolve, Vogue Nordic): obrazek z formatu `markdown`
- **Logi konsoli**: `[scrape] SYMBOL -> markdown image: URL`
- **Zapis**: 43 produkty z obrazkami

## Koszty

- Dodatkowe 10 requestow do Firecrawl (tylko dla produktow bez obrazka)
- Lekko wolniejszy import dla tych 10 produktow (2 requesty zamiast 1)
