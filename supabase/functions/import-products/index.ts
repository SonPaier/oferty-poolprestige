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

    // Filter out products with empty symbols and prepare for upsert
    const validProducts = products
      .filter(p => p.symbol && p.symbol.trim() !== "")
      .map(p => ({
        symbol: p.symbol.trim(),
        name: p.name?.trim() || p.symbol.trim(),
        price: p.price || 0,
        currency: p.currency === "EUR" ? "EUR" : "PLN",
        description: p.description?.trim() || null,
        stock_quantity: p.stock_quantity || 0,
        image_id: p.image_id?.trim() || null,
        category: p.category?.trim() || null,
      }));

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
