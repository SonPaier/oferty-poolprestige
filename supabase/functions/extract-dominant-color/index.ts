import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Simplified palette - 8 base colors that cover major foil shades
const SIMPLIFIED_PALETTE = [
  { hex: '#FFFFFF', shade: 'biały', rgb: { r: 255, g: 255, b: 255 } },
  { hex: '#D2B48C', shade: 'beżowy', rgb: { r: 210, g: 180, b: 140 } },
  { hex: '#808080', shade: 'szary', rgb: { r: 128, g: 128, b: 128 } },
  { hex: '#1A1A1A', shade: 'czarny', rgb: { r: 26, g: 26, b: 26 } },
  { hex: '#4169E1', shade: 'niebieski', rgb: { r: 65, g: 105, b: 225 } },
  { hex: '#20B2AA', shade: 'turkusowy', rgb: { r: 32, g: 178, b: 170 } },
  { hex: '#228B22', shade: 'zielony', rgb: { r: 34, g: 139, b: 34 } },
  { hex: '#8B4513', shade: 'brązowy', rgb: { r: 139, g: 69, b: 19 } },
];

// Producer color names mapping to simplified palette (Polish shades)
const PRODUCER_COLOR_MAP: Record<string, string> = {
  // English
  'white': 'biały',
  'sand': 'beżowy',
  'beige': 'beżowy',
  'cream': 'biały',
  'grey': 'szary',
  'gray': 'szary',
  'light grey': 'szary',
  'dark grey': 'szary',
  'anthracite': 'szary',
  'black': 'czarny',
  'graphite': 'czarny',
  'blue': 'niebieski',
  'light blue': 'niebieski',
  'adriatic blue': 'niebieski',
  'greek blue': 'niebieski',
  'caribbean blue': 'turkusowy',
  'turquoise': 'turkusowy',
  'caribbean': 'turkusowy',
  'aqua': 'turkusowy',
  'teal': 'turkusowy',
  'green': 'zielony',
  'olive': 'zielony',
  'brown': 'brązowy',
  'chocolate': 'brązowy',
  'terracotta': 'brązowy',
  'terra': 'brązowy',
  
  // German (ELBE)
  'weiß': 'biały',
  'weiss': 'biały',
  'grau': 'szary',
  'blau': 'niebieski',
  'schwarz': 'czarny',
  'braun': 'brązowy',
  'grün': 'zielony',
  
  // Product-specific names
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
  'marble': 'biały',
  'pearl': 'biały',
  'amber': 'beżowy',
  'basalt': 'szary',
  'ocean': 'niebieski',
  'azure': 'niebieski',
  'sky': 'niebieski',
  'slate': 'szary',
  'platinum': 'szary',
  'ivory': 'biały',
  
  // Vogue collection
  'summer': 'niebieski',
  'tropical': 'niebieski',
  'urban': 'szary',
  'vintage': 'beżowy',
  
  // Kolos collection
  'delos': 'niebieski',
  'milos': 'niebieski',
  'naxos': 'niebieski',
  'paros': 'biały',
  'syros': 'szary',
  
  // Alive collection
  'aquarelle': 'niebieski',
  'mist': 'szary',
  'coral': 'beżowy',
  
  // Touch collection
  'relax': 'niebieski',
  'elegance': 'szary',
  'serenity': 'niebieski',
  'vanity': 'beżowy',
  'origin': 'beżowy',
  'genuine': 'beżowy',
  
  // Alkorplan colors
  'adriatic': 'niebieski',
};

interface RGB {
  r: number;
  g: number;
  b: number;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.round(x).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('').toUpperCase();
}

// Euclidean distance between two RGB colors
function colorDistance(c1: RGB, c2: RGB): number {
  return Math.sqrt(
    Math.pow(c1.r - c2.r, 2) +
    Math.pow(c1.g - c2.g, 2) +
    Math.pow(c1.b - c2.b, 2)
  );
}

// Map any HEX to simplified Polish shade
function mapRgbToSimplifiedShade(rgb: RGB): { shade: string; paletteHex: string } {
  let closest = { shade: 'nieznany', paletteHex: '#808080', distance: Infinity };
  
  for (const color of SIMPLIFIED_PALETTE) {
    const dist = colorDistance(rgb, color.rgb);
    if (dist < closest.distance) {
      closest = { shade: color.shade, paletteHex: color.hex, distance: dist };
    }
  }
  
  return { shade: closest.shade, paletteHex: closest.paletteHex };
}

// Map producer color name to simplified shade
function mapProducerColorToShade(producerColor: string): string | null {
  const normalized = producerColor.toLowerCase().trim();
  
  // Direct match
  if (PRODUCER_COLOR_MAP[normalized]) {
    return PRODUCER_COLOR_MAP[normalized];
  }
  
  // Partial match (e.g., "Adriatic Blue 2mm" → "niebieski")
  for (const [key, shade] of Object.entries(PRODUCER_COLOR_MAP)) {
    if (normalized.includes(key)) {
      return shade;
    }
  }
  
  return null;
}

// Extract shade from text description
function extractShadeFromText(text: string): string | null {
  const textLower = text.toLowerCase();
  
  for (const [key, shade] of Object.entries(PRODUCER_COLOR_MAP)) {
    if (textLower.includes(key)) {
      return shade;
    }
  }
  
  return null;
}

// Decode image and extract dominant color using ImageScript
async function extractDominantColorFromImage(imageUrl: string): Promise<{ hex: string; shade: string } | null> {
  try {
    console.log(`[extract-color] Fetching image: ${imageUrl}`);
    
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FoilImporter/1.0)',
        'Accept': 'image/*',
      },
    });
    
    if (!response.ok) {
      console.warn(`[extract-color] Failed to fetch image: ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('image')) {
      console.warn(`[extract-color] Not an image: ${contentType}`);
      return null;
    }
    
    const buffer = await response.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    
    // Decode image using ImageScript
    let image: Image;
    try {
      image = await Image.decode(bytes);
    } catch (decodeError) {
      console.warn(`[extract-color] Failed to decode image:`, decodeError);
      return null;
    }
    
    console.log(`[extract-color] Image decoded: ${image.width}x${image.height}`);
    
    // Sample pixels from center region (avoid edges which might have borders/backgrounds)
    const startX = Math.floor(image.width * 0.25);
    const endX = Math.floor(image.width * 0.75);
    const startY = Math.floor(image.height * 0.25);
    const endY = Math.floor(image.height * 0.75);
    
    let totalR = 0, totalG = 0, totalB = 0, pixelCount = 0;
    const step = Math.max(1, Math.floor((endX - startX) / 20)); // Sample ~20x20 grid
    
    for (let y = startY; y < endY; y += step) {
      for (let x = startX; x < endX; x += step) {
        const pixel = image.getPixelAt(x + 1, y + 1); // 1-indexed
        
        // Extract RGBA from pixel (32-bit integer)
        const r = (pixel >> 24) & 0xFF;
        const g = (pixel >> 16) & 0xFF;
        const b = (pixel >> 8) & 0xFF;
        const a = pixel & 0xFF;
        
        // Skip transparent pixels
        if (a < 128) continue;
        
        // Skip pure white/black backgrounds
        if ((r > 250 && g > 250 && b > 250) || (r < 5 && g < 5 && b < 5)) continue;
        
        totalR += r;
        totalG += g;
        totalB += b;
        pixelCount++;
      }
    }
    
    if (pixelCount < 10) {
      console.warn('[extract-color] Not enough valid pixels found');
      return null;
    }
    
    const avgR = Math.round(totalR / pixelCount);
    const avgG = Math.round(totalG / pixelCount);
    const avgB = Math.round(totalB / pixelCount);
    
    const dominantHex = rgbToHex(avgR, avgG, avgB);
    const { shade } = mapRgbToSimplifiedShade({ r: avgR, g: avgG, b: avgB });
    
    console.log(`[extract-color] Extracted: RGB(${avgR},${avgG},${avgB}) = ${dominantHex} -> ${shade}`);
    
    return { hex: dominantHex, shade };
  } catch (error) {
    console.error('[extract-color] Error extracting color:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { imageUrl, producerColor, productName, description } = await req.json();
    
    let shade: string | null = null;
    let extractedHex: string | null = null;
    let source: 'producer' | 'image' | 'name' | null = null;
    
    // Priority 1: Producer data (color name from manufacturer)
    if (producerColor) {
      shade = mapProducerColorToShade(producerColor);
      if (shade) {
        source = 'producer';
        console.log(`[extract-color] Using producer color: ${producerColor} -> ${shade}`);
      }
    }
    
    // Priority 2: Description text
    if (!shade && description) {
      shade = extractShadeFromText(description);
      if (shade) {
        source = 'producer';
        console.log(`[extract-color] Extracted from description: ${shade}`);
      }
    }
    
    // Priority 3: Image extraction (with proper decoding)
    if (!shade && imageUrl) {
      const colorResult = await extractDominantColorFromImage(imageUrl);
      if (colorResult && colorResult.shade !== 'nieznany') {
        shade = colorResult.shade;
        extractedHex = colorResult.hex;
        source = 'image';
        console.log(`[extract-color] Extracted from image: ${extractedHex} -> ${shade}`);
      }
    }
    
    // Priority 4: Product name
    if (!shade && productName) {
      shade = mapProducerColorToShade(productName);
      if (shade) {
        source = 'name';
        console.log(`[extract-color] Extracted from name: ${productName} -> ${shade}`);
      }
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        shade,
        extractedHex,
        source,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in extract-dominant-color:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
