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
    
    // Process in batches of 5 to avoid rate limiting
    const batchSize = 5;
    
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      const promises = batch.map(async (product) => {
        // Clone so we don't mutate original
        const updated = { ...product };
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

          // Step 2: If no image found, fallback to 'markdown' format (for JS-heavy pages)
          if (!imageUrl) {
            console.log(`[scrape] ${product.symbol} -> no image in links, trying markdown...`);
            const mdResult = await firecrawlApi.scrape(product.url, {
              formats: ['markdown'],
              onlyMainContent: true,
            });

            const mdRaw = mdResult as any;
            const mdOk = mdRaw?.success === undefined ? true : Boolean(mdRaw?.success);
            
            if (mdOk && mdRaw?.data) {
              const markdown = mdRaw.data.data?.markdown || mdRaw.data.markdown;
              imageUrl = extractImageFromMarkdown(markdown);
              if (imageUrl) {
                console.log(`[scrape] ${product.symbol} -> markdown image: ${imageUrl}`);
              }
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
