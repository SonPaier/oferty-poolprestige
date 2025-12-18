import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProductImport {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  description?: string;
  stock_quantity?: number;
  image_id?: string;
  category?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { products } = await req.json() as { products: ProductImport[] };

    if (!products || !Array.isArray(products)) {
      throw new Error("Invalid products data");
    }

    // Define product type for the map
    type ProcessedProduct = {
      symbol: string;
      name: string;
      price: number;
      currency: string;
      description: string | null;
      stock_quantity: number;
      image_id: string | null;
      category: string | null;
    };

    // Filter out products with empty symbols and deduplicate by symbol
    const productMap = new Map<string, ProcessedProduct>();
    
    products
      .filter(p => p.symbol && p.symbol.trim() !== "")
      .forEach(p => {
        const symbol = p.symbol.trim();
        // Keep the last occurrence of each symbol (overwrites duplicates)
        productMap.set(symbol, {
          symbol,
          name: p.name?.trim() || symbol,
          price: p.price || 0,
          currency: p.currency === "EUR" ? "EUR" : "PLN",
          description: p.description?.trim() || null,
          stock_quantity: p.stock_quantity || 0,
          image_id: p.image_id?.trim() || null,
          category: p.category?.trim() || null,
        });
      });
    
    const validProducts = Array.from(productMap.values());

    // Insert in batches of 100
    const batchSize = 100;
    let inserted = 0;
    let errors: string[] = [];

    for (let i = 0; i < validProducts.length; i += batchSize) {
      const batch = validProducts.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from("products")
        .upsert(batch, { 
          onConflict: "symbol",
          ignoreDuplicates: false 
        });

      if (error) {
        errors.push(`Batch ${i / batchSize + 1}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted,
        total: validProducts.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error importing products:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
