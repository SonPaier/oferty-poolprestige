import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Collection to foil category mapping - keys match URL slugs
const COLLECTION_MAPPING: Record<string, { foilCategory: string; thickness: number; description: string }> = {
  'touch': { foilCategory: 'strukturalna', thickness: 2.0, description: 'Tekstura 3D inspirowana naturą' },
  'vogue': { foilCategory: 'strukturalna', thickness: 2.0, description: 'Inspiracja trendami wnętrzarskimi' },
  'ceramics-evolve': { foilCategory: 'strukturalna', thickness: 2.0, description: 'Imitacja ceramiki' },
  'ceramics': { foilCategory: 'strukturalna', thickness: 1.5, description: 'Motyw mozaiki greckiej' },
  'alive': { foilCategory: 'strukturalna', thickness: 1.5, description: 'Nowoczesne wzory' },
  'alkorplan3000': { foilCategory: 'nadruk', thickness: 1.5, description: 'Współczesne wzory drukowane' },
  'alkorplan2000': { foilCategory: 'jednokolorowa', thickness: 1.5, description: 'Klasyczne kolory jednobarwne' },
  'relief': { foilCategory: 'antyposlizgowa', thickness: 1.5, description: 'Antypoślizgowa klasa 3' },
  'kolos': { foilCategory: 'strukturalna', thickness: 2.0, description: 'Do intensywnego użytku' },
  'natural-pool': { foilCategory: 'jednokolorowa', thickness: 1.5, description: 'Do stawów kąpielowych' },
};

interface FoilProduct {
  url: string;
  name: string;
  collection: string;
  collectionSlug: string;
  foilCategory: string;
  thickness: number;
  description: string;
  imageUrl?: string;
  symbol: string;
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

function determineShade(productName: string): string | undefined {
  const nameLower = productName.toLowerCase();
  
  // 1. Try full product name match
  if (SIMPLIFIED_SHADE_MAP[nameLower]) {
    return SIMPLIFIED_SHADE_MAP[nameLower];
  }
  
  // 2. Try to extract the color part from product names like "ALKORPLAN Touch - Bhumi"
  const parts = productName.split(/\s*[-–]\s*/);
  const lastPart = parts[parts.length - 1].trim().toLowerCase();
  
  if (SIMPLIFIED_SHADE_MAP[lastPart]) {
    return SIMPLIFIED_SHADE_MAP[lastPart];
  }
  
  // 3. Try individual words
  const words = nameLower.split(/\s+/);
  for (const word of words.reverse()) {
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

function extractCollectionAndProductFromUrl(url: string): { collection: string; collectionSlug: string; productName: string } | null {
  // Pattern: /collections/{collection-name}/{product-name}
  const match = url.match(/\/collections\/([^\/]+)\/([^\/\?]+)$/);
  if (match) {
    const collectionSlug = match[1].toLowerCase();
    const productSlug = match[2].toLowerCase();
    
    if (!productSlug || productSlug === 'sitemap.xml') {
      return null;
    }
    
    const collectionName = collectionSlug
      .replace(/alkorplan(\d+)/i, 'Alkorplan $1')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    const productName = productSlug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    return { collection: collectionName, collectionSlug, productName };
  }
  return null;
}

function generateSymbol(collectionSlug: string, productName: string): string {
  const cleanProductName = productName
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  const cleanCollection = collectionSlug
    .toUpperCase()
    .replace(/-/g, '');
  
  return `ALKORPLAN-${cleanCollection}-${cleanProductName}`;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, urls, products } = await req.json();

    if (action === 'parse-urls') {
      // Parse URLs and extract product info
      const parsedProducts: FoilProduct[] = [];
      
      for (const url of urls || []) {
        const extracted = extractCollectionAndProductFromUrl(url);
        if (!extracted) continue;
        
        const mapping = COLLECTION_MAPPING[extracted.collectionSlug];
        if (!mapping) {
          console.log('Unknown collection:', extracted.collectionSlug);
          continue;
        }
        
        const symbol = generateSymbol(extracted.collectionSlug, extracted.productName);
        const fullName = `ALKORPLAN ${extracted.collection} - ${extracted.productName}`;
        const shade = determineShade(extracted.productName);
        
        parsedProducts.push({
          url,
          name: fullName,
          collection: extracted.collection,
          collectionSlug: extracted.collectionSlug,
          foilCategory: mapping.foilCategory,
          thickness: mapping.thickness,
          description: `${mapping.description}. ${extracted.productName}`,
          symbol,
          shade,
        });
      }
      
      console.log(`Parsed ${parsedProducts.length} products from ${urls?.length || 0} URLs`);
      
      return new Response(
        JSON.stringify({ success: true, products: parsedProducts }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'save') {
      // Save products to database
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      if (!products || !Array.isArray(products)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Products array is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Map symbol -> imageUrl (scraped on the client)
      const imageBySymbol = new Map<string, string>();
      for (const p of products as FoilProduct[]) {
        if (p?.symbol && p?.imageUrl) imageBySymbol.set(p.symbol, p.imageUrl);
      }

      // Map products to database format
      const dbProducts = products.map((p: FoilProduct) => ({
        symbol: p.symbol,
        name: p.name,
        category: 'folia',
        foil_category: p.foilCategory,
        subcategory: p.collection,
        foil_width: 1.65,
        description: p.description,
        // Images are stored in `product_images` table. Keep this column unused.
        image_id: null,
        price: 0,
        currency: 'PLN',
        shade: p.shade || null,
        extracted_hex: p.extractedHex || null,
      }));

      // Deduplicate by symbol
      const uniqueProducts = new Map();
      for (const p of dbProducts) {
        uniqueProducts.set(p.symbol, p);
      }

      const productsToInsert = Array.from(uniqueProducts.values());

      // Insert in batches
      const batchSize = 50;
      let inserted = 0;
      let imagesInserted = 0;
      const errors: string[] = [];

      for (let i = 0; i < productsToInsert.length; i += batchSize) {
        const batch = productsToInsert.slice(i, i + batchSize);
        
        const { error: upsertError } = await supabase
          .from('products')
          .upsert(batch, { 
            onConflict: 'symbol',
            ignoreDuplicates: false 
          });

        if (upsertError) {
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${upsertError.message}`);
        } else {
          inserted += batch.length;

          // Attach images to `product_images` (so the rest of the app can display them)
          try {
            const symbols = batch.map((p: any) => p.symbol).filter(Boolean);
            if (symbols.length > 0) {
              const { data: savedProducts, error: selectError } = await supabase
                .from('products')
                .select('id, symbol')
                .in('symbol', symbols);

              if (selectError) {
                console.warn('Failed selecting saved products for image insert:', selectError.message);
              } else if (savedProducts && savedProducts.length > 0) {
                const productIds = savedProducts.map(p => p.id);

                // Skip products that already have a primary image (sort_order = 0)
                const { data: existingImages, error: existingError } = await supabase
                  .from('product_images')
                  .select('product_id')
                  .in('product_id', productIds)
                  .eq('sort_order', 0);

                if (existingError) {
                  console.warn('Failed selecting existing images:', existingError.message);
                }

                const existingProductIds = new Set((existingImages || []).map(img => img.product_id));

                const imagesToInsert = savedProducts
                  .map(p => {
                    const imageUrl = imageBySymbol.get(p.symbol);
                    if (!imageUrl) return null;
                    if (existingProductIds.has(p.id)) return null;
                    return {
                      product_id: p.id,
                      image_url: imageUrl,
                      file_name: `imported:${p.symbol}`,
                      file_size: null,
                      sort_order: 0,
                    };
                  })
                  .filter(Boolean) as any[];

                if (imagesToInsert.length > 0) {
                  const { error: imgInsertError } = await supabase
                    .from('product_images')
                    .insert(imagesToInsert);

                  if (imgInsertError) {
                    console.warn('Failed inserting product images:', imgInsertError.message);
                  } else {
                    imagesInserted += imagesToInsert.length;
                  }
                }
              }
            }
          } catch (e) {
            console.warn('Unexpected error while attaching images:', e);
          }
        }
      }

      console.log(`Saved ${inserted} products, images: ${imagesInserted}, errors: ${errors.length}`);

      return new Response(
        JSON.stringify({ 
          success: errors.length === 0, 
          inserted,
          total: productsToInsert.length,
          imagesInserted,
          errors: errors.length > 0 ? errors : undefined 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Unknown action. Use: parse-urls, save' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in import-foils-from-web:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
