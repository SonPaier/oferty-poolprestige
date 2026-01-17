import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Image URLs for each subcategory (placeholder images)
const subcategoryImages: Record<string, string> = {
  prysznice: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=400&fit=crop",
  przeciwprady: "https://images.unsplash.com/photo-1575429198097-0414ec08e8cd?w=400&h=400&fit=crop",
  masaz_wodny: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=400&h=400&fit=crop",
  masaz_powietrzny: "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=400&fit=crop",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all attraction products
    const { data: products, error: productsError } = await supabase
      .from("products")
      .select("id, symbol, name, subcategory")
      .eq("category", "attraction");

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`);
    }

    if (!products || products.length === 0) {
      return new Response(
        JSON.stringify({ message: "No attraction products found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];

    for (const product of products) {
      // Check if product already has an image
      const { data: existingImage } = await supabase
        .from("product_images")
        .select("id")
        .eq("product_id", product.id)
        .limit(1)
        .single();

      if (existingImage) {
        results.push({ product: product.symbol, status: "skipped", reason: "already has image" });
        continue;
      }

      // Get image URL for subcategory
      const imageUrl = subcategoryImages[product.subcategory] || subcategoryImages.prysznice;

      // Download the image
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        results.push({ product: product.symbol, status: "error", reason: "failed to download image" });
        continue;
      }

      const imageBlob = await imageResponse.blob();
      const fileName = `${product.id}/${Date.now()}.jpg`;

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, imageBlob, {
          contentType: "image/jpeg",
          upsert: true,
        });

      if (uploadError) {
        results.push({ product: product.symbol, status: "error", reason: uploadError.message });
        continue;
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      // Insert into product_images table
      const { error: insertError } = await supabase
        .from("product_images")
        .insert({
          product_id: product.id,
          image_url: urlData.publicUrl,
          file_name: fileName,
          sort_order: 0,
        });

      if (insertError) {
        results.push({ product: product.symbol, status: "error", reason: insertError.message });
        continue;
      }

      results.push({ product: product.symbol, status: "success", imageUrl: urlData.publicUrl });
    }

    return new Response(
      JSON.stringify({ 
        message: "Seeding complete", 
        total: products.length,
        results 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
