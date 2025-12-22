import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Attachment {
  name: string;
  type: string;
  url: string;
}

interface ExtractedData {
  customerData: {
    companyName?: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    city?: string;
    postalCode?: string;
    nip?: string;
  };
  poolDimensions?: {
    length?: number;
    width?: number;
    depthShallow?: number;
    depthDeep?: number;
  };
  poolType?: 'prywatny' | 'polprywatny' | 'hotelowy';
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { emailContent, attachments } = await req.json() as { 
      emailContent?: string; 
      attachments?: Attachment[] 
    };
    
    if ((!emailContent || typeof emailContent !== 'string') && (!attachments || attachments.length === 0)) {
      return new Response(
        JSON.stringify({ error: "Email content or attachments are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Extracting data from email content, length:", emailContent?.length || 0);
    console.log("Attachments:", attachments?.length || 0);

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `Jesteś asystentem firmy Pool Prestige, specjalizującej się w budowie basenów.
Twoim zadaniem jest wyekstrahowanie danych z treści maila lub wiadomości od klienta oraz z załączników (obrazków, PDF-ów, plików Excel).

Zwróć dane w formacie JSON z następującą strukturą:
{
  "customerData": {
    "companyName": "nazwa firmy (jeśli jest)",
    "contactPerson": "imię i nazwisko osoby kontaktowej",
    "email": "adres email",
    "phone": "numer telefonu",
    "address": "ulica i numer",
    "city": "miasto",
    "postalCode": "kod pocztowy",
    "nip": "NIP firmy (jeśli jest)"
  },
  "poolDimensions": {
    "length": liczba w metrach (długość basenu),
    "width": liczba w metrach (szerokość basenu),
    "depthShallow": liczba w metrach (głębokość płytka, domyślnie 1.2),
    "depthDeep": liczba w metrach (głębokość głęboka, domyślnie 1.8)
  },
  "poolType": "prywatny" | "polprywatny" | "hotelowy"
}

Zasady:
- Jeśli nie możesz znaleźć jakiejś informacji, pozostaw pole puste lub null
- Numery telefonów formatuj jako +48 XXX XXX XXX
- Wymiary basenu mogą być podane w różnych formatach: "8x4", "8 na 4 metrów", "8m x 4m" itp.
- Jeśli podano tylko jeden wymiar głębokości, użyj go jako głębokość głęboką, a płytką ustaw na 1.2m
- Typ basenu: prywatny (dom jednorodzinny), polprywatny (pensjonat, mały hotel), hotelowy (duży hotel, obiekt publiczny)
- Analizuj również obrazki (mogą zawierać rysunki techniczne z wymiarami)
- Analizuj pliki Excel/CSV które mogą zawierać tabele z danymi
- Zwracaj TYLKO poprawny JSON, bez żadnego dodatkowego tekstu`;

    // Build messages with images if present
    const userContent: any[] = [];
    
    if (emailContent?.trim()) {
      userContent.push({
        type: "text",
        text: `Wyekstrahuj dane z poniższej wiadomości:\n\n${emailContent}`
      });
    } else {
      userContent.push({
        type: "text",
        text: "Wyekstrahuj dane z załączonych plików:"
      });
    }
    
    // Add image attachments for vision analysis
    if (attachments && attachments.length > 0) {
      for (const attachment of attachments) {
        if (attachment.type.startsWith('image/')) {
          userContent.push({
            type: "image_url",
            image_url: {
              url: attachment.url
            }
          });
        } else {
          // For non-image files, just mention them
          userContent.push({
            type: "text",
            text: `\n\n[Załącznik: ${attachment.name} (${attachment.type})]`
          });
        }
      }
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Przekroczono limit zapytań. Spróbuj ponownie za chwilę." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "Brak kredytów AI. Doładuj konto." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    console.log("AI response:", content);

    // Parse JSON from response
    let extractedData: ExtractedData;
    try {
      // Remove markdown code blocks if present
      let jsonStr = content;
      if (jsonStr.includes("```json")) {
        jsonStr = jsonStr.replace(/```json\n?/g, "").replace(/```\n?/g, "");
      } else if (jsonStr.includes("```")) {
        jsonStr = jsonStr.replace(/```\n?/g, "");
      }
      extractedData = JSON.parse(jsonStr.trim());
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      extractedData = { customerData: {} };
    }

    console.log("Extracted data:", extractedData);

    return new Response(JSON.stringify(extractedData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in extract-from-email function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});