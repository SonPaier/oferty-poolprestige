import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Collection to foil category mapping
const COLLECTION_MAPPING: Record<string, { foilCategory: string; thickness: number; description: string }> = {
  'touch': { foilCategory: 'strukturalna', thickness: 2.0, description: 'Tekstura 3D inspirowana naturą' },
  'vogue': { foilCategory: 'strukturalna', thickness: 2.0, description: 'Inspiracja trendami wnętrzarskimi' },
  'ceramics-evolve': { foilCategory: 'strukturalna', thickness: 2.0, description: 'Imitacja ceramiki' },
  'ceramics': { foilCategory: 'strukturalna', thickness: 1.5, description: 'Motyw mozaiki greckiej' },
  'alive': { foilCategory: 'strukturalna', thickness: 1.5, description: 'Nowoczesne wzory' },
  'alkorplan-3000': { foilCategory: 'nadruk', thickness: 1.5, description: 'Współczesne wzory drukowane' },
  'alkorplan-2000': { foilCategory: 'jednokolorowa', thickness: 1.5, description: 'Klasyczne kolory jednobarwne' },
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
}

function extractCollectionFromUrl(url: string): { collection: string; slug: string } | null {
  // Pattern: /collections/{collection-name}/products/{product-name}
  const match = url.match(/\/collections\/([^\/]+)\/products\/([^\/]+)/);
  if (match) {
    const slug = match[1].toLowerCase();
    // Get nice collection name from slug
    const collectionName = slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    return { collection: collectionName, slug };
  }
  return null;
}

function extractProductNameFromUrl(url: string): string {
  const match = url.match(/\/products\/([^\/\?]+)/);
  if (match) {
    return match[1]
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
  return 'Unknown';
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
        const collectionInfo = extractCollectionFromUrl(url);
        if (!collectionInfo) continue;
        
        const mapping = COLLECTION_MAPPING[collectionInfo.slug];
        if (!mapping) {
          console.log('Unknown collection:', collectionInfo.slug);
          continue;
        }
        
        const productName = extractProductNameFromUrl(url);
        const symbol = generateSymbol(collectionInfo.slug, productName);
        
        parsedProducts.push({
          url,
          name: `ALKORPLAN ${collectionInfo.collection} - ${productName}`,
          collection: collectionInfo.collection,
          collectionSlug: collectionInfo.slug,
          foilCategory: mapping.foilCategory,
          thickness: mapping.thickness,
          description: `${mapping.description}. ${productName}`,
          symbol,
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

      // Map products to database format
      const dbProducts = products.map((p: FoilProduct) => ({
        symbol: p.symbol,
        name: p.name,
        category: 'folia',
        foil_category: p.foilCategory,
        subcategory: p.collection,
        foil_width: 1.65,
        description: p.description,
        image_id: p.imageUrl || null,
        price: 0,
        currency: 'PLN',
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
      const errors: string[] = [];

      for (let i = 0; i < productsToInsert.length; i += batchSize) {
        const batch = productsToInsert.slice(i, i + batchSize);
        
        const { error } = await supabase
          .from('products')
          .upsert(batch, { 
            onConflict: 'symbol',
            ignoreDuplicates: false 
          });

        if (error) {
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          inserted += batch.length;
        }
      }

      console.log(`Saved ${inserted} products, errors: ${errors.length}`);

      return new Response(
        JSON.stringify({ 
          success: errors.length === 0, 
          inserted,
          total: productsToInsert.length,
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
