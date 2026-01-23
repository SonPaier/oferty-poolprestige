import { supabase } from '@/integrations/supabase/client';

type FirecrawlResponse<T = any> = {
  success: boolean;
  error?: string;
  data?: T;
  links?: string[];
};

type MapOptions = {
  search?: string;
  limit?: number;
  includeSubdomains?: boolean;
};

type ScrapeOptions = {
  formats?: ('markdown' | 'html' | 'rawHtml' | 'links')[];
  onlyMainContent?: boolean;
  waitFor?: number;
};

export interface FoilProduct {
  url: string;
  name: string;
  collection: string;
  collectionSlug: string;
  foilCategory: string;
  thickness: number;
  description: string;
  imageUrl?: string;
  symbol: string;
  brand: 'alkorplan' | 'elbe';
  shade?: string;
  extractedHex?: string;
  shadeSource?: 'producer' | 'image' | 'name';
}

// Simplified palette - 8 base colors
const SIMPLIFIED_SHADE_MAP: Record<string, string> = {
  // Direct colors -> simplified palette
  'white': 'biały',
  'sand': 'beżowy',
  'beige': 'beżowy',
  'cream': 'biały',
  'light blue': 'niebieski',
  'adriatic blue': 'niebieski',
  'caribbean blue': 'turkusowy',
  'caribbean green': 'zielony',
  'greek blue': 'niebieski',
  'blue': 'niebieski',
  'light grey': 'szary',
  'dark grey': 'szary',
  'grey': 'szary',
  'gray': 'szary',
  'anthracite': 'szary',
  'black': 'czarny',
  'graphite': 'czarny',
  'green': 'zielony',
  'turquoise': 'turkusowy',
  
  // Alkorplan structural collections
  'bhumi': 'beżowy',
  'nara': 'beżowy',
  'chandra': 'szary',
  'kohinoor': 'niebieski',
  'prestige': 'czarny',
  'sublime': 'beżowy',
  'volcanic': 'szary',
  'travertine': 'beżowy',
  'authentic': 'beżowy',
  'concrete': 'szary',
  'mediterranean blue': 'niebieski',
  'malta': 'beżowy',
  'bysance': 'niebieski',
  'persia': 'niebieski',
  'persia blue': 'niebieski',
  'persia sand': 'beżowy',
  'carrara': 'biały',
  'atenea': 'niebieski',
  'byzance': 'niebieski',
  'stone': 'szary',
  'ceramic': 'biały',
  'ceramics': 'biały',
  
  // ELBE colors
  'amber': 'beżowy',
  'basalt': 'szary',
  'marble': 'biały',
  'pearl': 'biały',
  'shine': 'biały',
  'ocean': 'niebieski',
  'azure': 'niebieski',
  'sky': 'niebieski',
  'terra': 'brązowy',
  'coral': 'beżowy',
  'slate': 'szary',
  'platinum': 'szary',
  'ivory': 'biały',
  'classic': 'beżowy',
};

// Keyword-based shade detection fallback (simplified to 8 base colors)
const SHADE_KEYWORDS: Record<string, string> = {
  'blue': 'niebieski',
  'white': 'biały',
  'grey': 'szary',
  'gray': 'szary',
  'sand': 'beżowy',
  'beige': 'beżowy',
  'green': 'zielony',
  'black': 'czarny',
  'brown': 'brązowy',
  'turquoise': 'turkusowy',
};

/**
 * Determines the Polish shade name based on product name and collection.
 * Returns undefined if no shade can be determined.
 */
export function determineShade(productName: string, collectionSlug?: string): string | undefined {
  const nameLower = productName.toLowerCase();
  
  // 1. Try full product name match (for structured names like "Light Blue")
  if (SIMPLIFIED_SHADE_MAP[nameLower]) {
    return SIMPLIFIED_SHADE_MAP[nameLower];
  }
  
  // 2. Try to extract the color part from product names like "SOLID Amber" or "ALKORPLAN Touch - Bhumi"
  const parts = productName.split(/\s*[-–]\s*/);
  const lastPart = parts[parts.length - 1].trim().toLowerCase();
  
  if (SIMPLIFIED_SHADE_MAP[lastPart]) {
    return SIMPLIFIED_SHADE_MAP[lastPart];
  }
  
  // 3. Try individual words
  const words = nameLower.split(/\s+/);
  for (const word of words.reverse()) { // Start from end (color often at end)
    if (SIMPLIFIED_SHADE_MAP[word]) {
      return SIMPLIFIED_SHADE_MAP[word];
    }
  }
  
  // 4. Keyword-based detection (simplified - no modifiers)
  for (const [keyword, value] of Object.entries(SHADE_KEYWORDS)) {
    if (nameLower.includes(keyword)) {
      return value;
    }
  }
  
  return undefined;
}

// Call extract-dominant-color edge function
export async function extractColorFromImage(
  imageUrl: string, 
  productName?: string, 
  description?: string
): Promise<{ shade?: string; extractedHex?: string; source?: 'producer' | 'image' | 'name' }> {
  try {
    const { data, error } = await supabase.functions.invoke('extract-dominant-color', {
      body: { 
        imageUrl, 
        productName, 
        description 
      },
    });
    
    if (error) {
      console.warn('[extractColorFromImage] Error:', error);
      return {};
    }
    
    return {
      shade: data?.shade || undefined,
      extractedHex: data?.extractedHex || undefined,
      source: data?.source || undefined,
    };
  } catch (e) {
    console.warn('[extractColorFromImage] Exception:', e);
    return {};
  }
}

export const firecrawlApi = {
  // Map a website to discover all URLs
  async map(url: string, options?: MapOptions): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-map', {
      body: { url, options },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  // Scrape a single URL
  async scrape(url: string, options?: ScrapeOptions): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
      body: { url, options },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },
};

// Helper: Extract image URL from markdown syntax ![alt](url)
function extractImageFromMarkdown(markdown: string | undefined): string | undefined {
  if (!markdown) return undefined;
  
  // Match ![alt](url) or ![](url) patterns
  const imgRegex = /!\[[^\]]*\]\((https?:\/\/[^)]+\.(?:jpg|jpeg|png|webp))\)/gi;
  const matches = [...markdown.matchAll(imgRegex)];
  
  // Prefer images from fileadmin/_processed_ (product images)
  const productImage = matches.find(m => m[1].includes('/fileadmin/_processed_/'));
  if (productImage) return productImage[1];
  
  // Fallback: first image that's not favicon/logo/icon
  const anyImage = matches.find(m => 
    !m[1].includes('favicon') && 
    !m[1].includes('logo') && 
    !m[1].includes('icon')
  );
  return anyImage?.[1];
}

// Helper: Extract product TEXTURE image from collection page markdown
// On collection pages, each product has 2 linked images:
// 1. Realization photo (pool with foil)
// 2. Texture/pattern image (directly before product name text)
// Pattern: [![alt](IMAGE)](URL)[**ProductName**](URL)
function extractProductImageFromCollectionMarkdown(
  markdown: string | undefined, 
  productSlug: string
): string | undefined {
  if (!markdown) return undefined;
  
  // Pattern: [![alt](imageUrl)](productUrl)[**ProductName**](productUrl)
  // The texture image is the one DIRECTLY BEFORE the bold product name link
  const textureImgRegex = new RegExp(
    `\\[!\\[[^\\]]*\\]\\((https?:\\/\\/[^)]+\\.(?:jpg|jpeg|png|webp))\\)\\]\\([^)]*\\/${productSlug}\\)\\[\\*\\*[^\\]]+\\*\\*\\]`,
    'i'
  );
  
  const match = markdown.match(textureImgRegex);
  if (match) {
    console.log(`[collection] Found texture image for ${productSlug}: ${match[1]}`);
    return match[1];
  }
  
  // Fallback: get the LAST image linking to this product (usually the texture)
  const linkedImgRegex = /\[!\[[^\]]*\]\((https?:\/\/[^)]+\.(?:jpg|jpeg|png|webp))\)\]\((https?:\/\/[^)]+)\)/gi;
  const matches = [...markdown.matchAll(linkedImgRegex)];
  
  // Find all images that link to our product
  const productImages = matches.filter(m => m[2].endsWith(`/${productSlug}`));
  
  if (productImages.length > 0) {
    // Return the LAST one (texture is usually second/last)
    const lastImage = productImages[productImages.length - 1][1];
    console.log(`[collection] Found texture image (fallback) for ${productSlug}: ${lastImage}`);
    return lastImage;
  }
  
  return undefined;
}

export const foilImportApi = {
  // Step 1: Map the Renolit website to get all product URLs
  async mapProductUrls(): Promise<{ success: boolean; urls?: string[]; error?: string }> {
    const result = await firecrawlApi.map('https://renolit-alkorplan.com/collections', {
      limit: 5000,
      includeSubdomains: false,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Filter only product URLs (format: /collections/{collection}/{product})
    // Exclude collection-only URLs and sitemap
    const productUrls = (result.links || []).filter((url: string) => {
      const match = url.match(/\/collections\/([^\/]+)\/([^\/\?]+)$/);
      if (!match) return false;
      const productSlug = match[2];
      // Exclude sitemap and collection-only pages
      return productSlug && productSlug !== 'sitemap.xml';
    });

    return { success: true, urls: productUrls };
  },

  // Step 2: Parse URLs to extract product information
  async parseProductUrls(urls: string[]): Promise<{ success: boolean; products?: FoilProduct[]; error?: string }> {
    const { data, error } = await supabase.functions.invoke('import-foils-from-web', {
      body: { action: 'parse-urls', urls },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data;
  },

  // Step 3: Scrape additional details for products (images)
  async scrapeProductDetails(products: FoilProduct[]): Promise<FoilProduct[]> {
    const updatedProducts: FoilProduct[] = [];
    
    // Cache for collection pages (to avoid re-fetching the same collection)
    const collectionCache: Map<string, string | null> = new Map();
    
    // Process in batches of 5 to avoid rate limiting
    const batchSize = 5;
    
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      const promises = batch.map(async (product) => {
        // Clone so we don't mutate original
        const updated = { ...product };
        
        // Extract collection slug and product slug from URL
        const urlMatch = product.url.match(/\/collections\/([^\/]+)\/([^\/\?]+)$/);
        const collectionSlug = urlMatch?.[1];
        const productSlug = urlMatch?.[2];
        
        try {
          // Step 1: Try 'links' format first (fast, works for most products)
          const result = await firecrawlApi.scrape(product.url, {
            formats: ['links'],
            onlyMainContent: false,
          });

          const raw = result as any;
          const successFlag = raw?.success;
          const isOk = successFlag === undefined ? true : Boolean(successFlag);

          let scrapeData: any = null;
          if (isOk && raw?.data) {
            scrapeData = raw.data.data || raw.data;
          }

          let imageUrl: string | undefined;

          if (scrapeData) {
            const links: string[] = scrapeData.links || [];
            
            // First try: find image from fileadmin/_processed_ (product images)
            imageUrl = links.find((link: string) => 
              link.includes('/fileadmin/_processed_/') && 
              /\.(jpg|jpeg|png|webp)$/i.test(link)
            );
            
            // Fallback: any image that's not favicon/logo
            if (!imageUrl) {
              imageUrl = links.find((link: string) => 
                /\.(jpg|jpeg|png|webp)$/i.test(link) && 
                !link.includes('favicon') && 
                !link.includes('logo') &&
                !link.includes('icon')
              );
            }
          }

          // Step 2: If no image found, try collection page to get texture/pattern image
          if (!imageUrl && collectionSlug && productSlug) {
            console.log(`[scrape] ${product.symbol} -> no image in links, trying collection page...`);
            
            // Check cache first
            let collectionMarkdown = collectionCache.get(collectionSlug);
            
            if (collectionMarkdown === undefined) {
              // Not in cache, fetch collection page
              const collectionUrl = `https://renolit-alkorplan.com/collections/${collectionSlug}`;
              const collResult = await firecrawlApi.scrape(collectionUrl, {
                formats: ['markdown'],
                onlyMainContent: false,
              });
              
              const collRaw = collResult as any;
              const collOk = collRaw?.success === undefined ? true : Boolean(collRaw?.success);
              
              if (collOk && collRaw?.data) {
                collectionMarkdown = collRaw.data.data?.markdown || collRaw.data.markdown || null;
                collectionCache.set(collectionSlug, collectionMarkdown);
                console.log(`[scrape] Cached collection page: ${collectionSlug}`);
              } else {
                collectionCache.set(collectionSlug, null);
              }
            }
            
            // Extract product's texture image from collection page
            if (collectionMarkdown) {
              imageUrl = extractProductImageFromCollectionMarkdown(collectionMarkdown, productSlug);
            }
          }

          if (imageUrl) {
            updated.imageUrl = imageUrl;
            console.log(`[scrape] ${product.symbol} -> found image: ${updated.imageUrl}`);
          } else {
            console.warn(`[scrape] ${product.symbol} -> no image found`);
          }
        } catch (err) {
          console.warn(`Failed to scrape ${product.url}:`, err);
        }
        return updated;
      });

      const results = await Promise.all(promises);
      updatedProducts.push(...results);
      
      // Rate limiting delay between batches
      if (i + batchSize < products.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log('[scrapeProductDetails] Total with images:', updatedProducts.filter(p => p.imageUrl).length);
    return updatedProducts;
  },

  // Step 4: Save products to database
  async saveProducts(products: FoilProduct[]): Promise<{ success: boolean; inserted?: number; total?: number; errors?: string[]; error?: string }> {
    const { data, error } = await supabase.functions.invoke('import-foils-from-web', {
      body: { action: 'save', products },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data;
  },
};

// ELBE Pools collection mapping
const ELBE_COLLECTIONS: Record<string, { foilCategory: string; thickness: number; description: string }> = {
  'solid': { foilCategory: 'strukturalna', thickness: 1.5, description: 'SOLID Stone - folia z teksturą 3D imitującą kamień' },
  'unique': { foilCategory: 'strukturalna', thickness: 1.5, description: 'UNIQUE Tile - folia z teksturą 3D imitującą płytki' },
  'motion': { foilCategory: 'strukturalna', thickness: 1.5, description: 'MOTION - folia z tłoczeniem 3D i lakierowaną powierzchnią' },
  'elite': { foilCategory: 'jednokolorowa', thickness: 1.5, description: 'elite® - folia bez ftalanów z ekstremalną odpornością' },
  'pearl': { foilCategory: 'strukturalna', thickness: 1.5, description: 'PEARL - folia z efektem brokatu' },
  'plain-color': { foilCategory: 'jednokolorowa', thickness: 1.5, description: 'Jednokolorowa folia basenowa' },
  'printed': { foilCategory: 'nadruk', thickness: 1.5, description: 'Folia z nadrukiem mozaikowym' },
  'natural-pools': { foilCategory: 'jednokolorowa', thickness: 1.0, description: 'Folia do stawów i basenów naturalnych' },
};

// Helper: Parse ELBE products from collection page markdown
function parseElbeProductsFromMarkdown(
  markdown: string, 
  collectionSlug: string,
  collectionUrl: string
): FoilProduct[] {
  const products: FoilProduct[] = [];
  const collectionInfo = ELBE_COLLECTIONS[collectionSlug] || { 
    foilCategory: 'jednokolorowa', 
    thickness: 1.5, 
    description: 'Folia basenowa ELBE' 
  };
  
  // ELBE product structure in markdown:
  // [![](https://elbepools.com/app/uploads/.../PRODUCT-NAME-top-150x150.jpg)](gallery-link)
  // [code](link) [code](link) ...
  // PRODUCT NAME (e.g., "SOLID Amber", "elite® White", "PEARL Shine")
  
  // Pattern: Find 150x150 thumbnail, then skip code links, then capture product name on next line
  // Match: [![](thumbnail-150x150.jpg)](link) followed eventually by product name
  const productPattern = /\[!\[\]\((https:\/\/elbepools\.com\/app\/uploads\/[^)]+?-150x150\.(?:jpg|jpeg|png))\)\]\([^)]+\)\s*\n(?:\[[^\]]+\]\([^)]+\)\s*)+\n([A-Z][a-zA-Z®]+(?:\s+[a-zA-Z®]+)*)/g;
  
  const matches = [...markdown.matchAll(productPattern)];
  console.log(`[ELBE] ${collectionSlug}: regex found ${matches.length} matches`);
  
  for (const match of matches) {
    const thumbnailUrl = match[1];
    const productName = match[2].trim();
    
    // Skip non-product matches
    if (!productName || 
        productName.length < 3 ||
        productName.toLowerCase().includes('icon') ||
        productName.toLowerCase().includes('logo') ||
        productName.includes('phthalate') ||
        productName.includes('resistant')) {
      continue;
    }
    
    // Generate symbol from product name
    const symbol = `ELBE-${productName.replace(/[®\s]+/g, '-').toUpperCase()}`;
    
    // Determine shade automatically
    const shade = determineShade(productName, collectionSlug);
    
    const product: FoilProduct = {
      url: collectionUrl,
      name: productName,
      collection: `ELBE ${collectionSlug.charAt(0).toUpperCase() + collectionSlug.slice(1)}`,
      collectionSlug,
      foilCategory: collectionInfo.foilCategory,
      thickness: collectionInfo.thickness,
      description: collectionInfo.description,
      imageUrl: thumbnailUrl,
      symbol,
      brand: 'elbe',
      shade,
    };
    
    products.push(product);
    console.log(`[ELBE] Found product: ${productName} -> ${thumbnailUrl}`);
  }
  
  return products;
}

export const elbeImportApi = {
  // Get list of ELBE collection URLs
  getCollectionUrls(): string[] {
    return Object.keys(ELBE_COLLECTIONS).map(slug => `https://elbepools.com/products/${slug}`);
  },

  // Scrape all ELBE collections and extract products
  async scrapeAllProducts(onProgress?: (progress: number, text: string) => void): Promise<{ success: boolean; products?: FoilProduct[]; error?: string }> {
    const collections = Object.keys(ELBE_COLLECTIONS);
    const allProducts: FoilProduct[] = [];
    
    for (let i = 0; i < collections.length; i++) {
      const slug = collections[i];
      const url = `https://elbepools.com/products/${slug}`;
      
      onProgress?.(Math.round((i / collections.length) * 100), `Pobieranie kolekcji ${slug}...`);
      
      try {
        const result = await firecrawlApi.scrape(url, {
          formats: ['markdown'],
          onlyMainContent: true,
        });
        
        const raw = result as any;
        const isOk = raw?.success !== false;
        
        if (isOk && raw?.data) {
          const markdown = raw.data.data?.markdown || raw.data.markdown;
          if (markdown) {
            const products = parseElbeProductsFromMarkdown(markdown, slug, url);
            console.log(`[ELBE] ${slug}: found ${products.length} products`);
            allProducts.push(...products);
          }
        }
      } catch (error) {
        console.warn(`[ELBE] Failed to scrape ${slug}:`, error);
      }
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    
    // Deduplicate by symbol
    const uniqueProducts = Array.from(
      new Map(allProducts.map(p => [p.symbol, p])).values()
    );
    
    console.log(`[ELBE] Total unique products: ${uniqueProducts.length}`);
    return { success: true, products: uniqueProducts };
  },

  // Save products to database (reuses Alkorplan save function)
  async saveProducts(products: FoilProduct[]): Promise<{ success: boolean; inserted?: number; total?: number; error?: string }> {
    const { data, error } = await supabase.functions.invoke('import-foils-from-web', {
      body: { action: 'save', products },
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return data;
  },
};
