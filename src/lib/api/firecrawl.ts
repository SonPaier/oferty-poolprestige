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
        try {
          const result = await firecrawlApi.scrape(product.url, {
            formats: ['html'],
            onlyMainContent: true,
          });

          if (result.success && result.data) {
            // Try to extract image URL from HTML
            const html = result.data.html || '';
            const imgMatch = html.match(/og:image[^>]*content="([^"]+)"/i) ||
                            html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*product[^"]*"/i) ||
                            html.match(/data-src="([^"]+\.(?:jpg|jpeg|png|webp))"/i);
            
            if (imgMatch) {
              product.imageUrl = imgMatch[1];
            }
          }
        } catch (err) {
          console.warn(`Failed to scrape ${product.url}:`, err);
        }
        return product;
      });

      const results = await Promise.all(promises);
      updatedProducts.push(...results);
      
      // Rate limiting delay between batches
      if (i + batchSize < products.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

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
