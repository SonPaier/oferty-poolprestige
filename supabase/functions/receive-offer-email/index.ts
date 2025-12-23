import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

// Flexible payload structure for Zapier
interface EmailPayload {
  // Direct Zapier fields (flat structure) - based on screenshot
  from?: string;
  to?: string;
  subject?: string;
  text?: string;           // Body Plain in Zapier
  html?: string;           // Body Html in Zapier
  attachment_urls?: string | string[]; // Can be single URL or array
  // Alternative field names
  body_plain?: string;
  body_html?: string;
  attachments?: string;    // Comma-separated URLs
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: EmailPayload = await req.json();
    
    console.log("📧 Raw payload received:", JSON.stringify(payload, null, 2));
    
    // Normalize data - handle Zapier flat structure
    const emailData = {
      from: payload.from || "",
      to: payload.to || "",
      subject: payload.subject || "(brak tematu)",
      text: payload.text || payload.body_plain || "",
      html: payload.html || payload.body_html || "",
    };

    console.log("📧 Normalized email data:", {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
      textLength: emailData.text?.length || 0,
      htmlLength: emailData.html?.length || 0,
    });

    // Validate we have minimum required data
    if (!emailData.from) {
      console.error("❌ Missing 'from' field in payload");
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Missing 'from' field",
          received_keys: Object.keys(payload),
          hint: "Make sure Zapier is sending 'from' field with the sender email"
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Upload attachments to storage bucket
    const uploadedAttachments: Array<{
      name: string;
      type: string;
      size: number;
      url: string;
      path: string;
    }> = [];

    // Handle Zapier-style attachments (URLs)
    let attachmentUrls: string[] = [];
    
    // Handle different formats from Zapier
    if (payload.attachment_urls) {
      if (Array.isArray(payload.attachment_urls)) {
        attachmentUrls = payload.attachment_urls.filter(Boolean);
      } else if (typeof payload.attachment_urls === 'string') {
        // Can be single URL or comma-separated
        attachmentUrls = payload.attachment_urls.split(',').map(url => url.trim()).filter(Boolean);
      }
    } else if (payload.attachments && typeof payload.attachments === 'string') {
      // Comma-separated URLs
      attachmentUrls = payload.attachments.split(',').map(url => url.trim()).filter(Boolean);
    }

    console.log(`📎 Found ${attachmentUrls.length} attachment URLs to process`);

    if (attachmentUrls.length > 0) {
      for (const attachmentUrl of attachmentUrls) {
        try {
          if (!attachmentUrl || !attachmentUrl.startsWith('http')) {
            console.log(`⚠️ Skipping invalid URL: ${attachmentUrl}`);
            continue;
          }

          console.log(`📥 Downloading attachment from: ${attachmentUrl}`);

          // Download the attachment
          const response = await fetch(attachmentUrl);
          if (!response.ok) {
            console.error(`❌ Failed to download attachment from ${attachmentUrl}: ${response.status}`);
            continue;
          }

          const contentType = response.headers.get('content-type') || 'application/octet-stream';
          const contentDisposition = response.headers.get('content-disposition') || '';
          
          // Try to extract filename from content-disposition or URL
          let filename = 'attachment';
          const filenameMatch = contentDisposition.match(/filename[*]?=["']?([^"';\n]+)/i);
          if (filenameMatch) {
            filename = filenameMatch[1];
          } else {
            // Extract from URL
            try {
              const urlParts = new URL(attachmentUrl);
              const pathParts = urlParts.pathname.split('/');
              const lastPart = pathParts[pathParts.length - 1];
              if (lastPart && lastPart.includes('.')) {
                filename = decodeURIComponent(lastPart);
              }
            } catch {
              filename = 'attachment';
            }
          }

          const arrayBuffer = await response.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);

          const timestamp = Date.now();
          const safeName = filename.replace(/[^a-zA-Z0-9.-]/g, "_");
          const filePath = `email-attachments/${timestamp}-${safeName}`;

          const { error: uploadError } = await supabase.storage
            .from("offer-attachments")
            .upload(filePath, bytes, {
              contentType: contentType,
              upsert: false,
            });

          if (uploadError) {
            console.error(`❌ Failed to upload ${filename}:`, uploadError);
            continue;
          }

          const { data: urlData } = supabase.storage
            .from("offer-attachments")
            .getPublicUrl(filePath);

          uploadedAttachments.push({
            name: filename,
            type: contentType,
            size: bytes.length,
            url: urlData.publicUrl,
            path: filePath,
          });

          console.log(`✅ Uploaded: ${filename} (${bytes.length} bytes)`);
        } catch (err) {
          console.error(`❌ Error downloading attachment from ${attachmentUrl}:`, err);
        }
      }
    }

    // Extract customer data from email
    const emailContent = emailData.text || emailData.html || "";
    const customerData = extractCustomerData(emailData.from, emailContent);

    // Generate offer number
    const now = new Date();
    const offerNumber = `PP/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}/${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const shareUid = `${Math.random().toString(36).substring(2, 10)}-${Math.random().toString(36).substring(2, 10)}-${Math.random().toString(36).substring(2, 6)}`;

    // Create new offer in queue with email content as source
    const newOffer = {
      offer_number: offerNumber,
      share_uid: shareUid,
      status: "queue",
      pool_type: "prywatny",
      dimensions: {
        shape: "prostokatny",
        length: 8,
        width: 4,
        depth: 1.5,
        hasSlope: false,
        isIrregular: false,
        overflowType: "skimmerowy",
        attractions: 0,
        stairs: { enabled: false, position: "inside", side: "left", width: "full", stepHeight: 0.29, stepCount: 4, stepDepth: 0.29 },
        wadingPool: { enabled: false, side: "left", width: 2, length: 1.5, depth: 0.4, position: "inside" },
      },
      excavation: {
        soilType: "normalny",
        accessibility: "dobry",
        groundwaterLevel: "brak",
      },
      sections: {
        wykonczenie: { id: "wykonczenie", name: "Wykończenie", items: [] },
        uzbrojenie: { id: "uzbrojenie", name: "Uzbrojenie", items: [] },
        filtracja: { id: "filtracja", name: "Filtracja", items: [] },
        oswietlenie: { id: "oswietlenie", name: "Oświetlenie", items: [] },
        automatyka: { id: "automatyka", name: "Automatyka", items: [] },
        atrakcje: { id: "atrakcje", name: "Atrakcje", items: [] },
        dodatki: { id: "dodatki", name: "Dodatki", items: [] },
      },
      customer_data: {
        ...customerData,
        // Store original email content for AI extraction later
        sourceEmail: emailContent.substring(0, 10000),
        emailSubject: emailData.subject,
        attachments: uploadedAttachments,
      },
      total_net: 0,
      total_gross: 0,
    };

    const { data: insertedOffer, error: insertError } = await supabase
      .from("offers")
      .insert(newOffer)
      .select()
      .single();

    if (insertError) {
      console.error("❌ Failed to create offer:", insertError);
      throw insertError;
    }

    console.log("✅ Created new offer in queue:", {
      id: insertedOffer.id,
      offerNumber: insertedOffer.offer_number,
      from: emailData.from,
      subject: emailData.subject,
      attachmentsCount: uploadedAttachments.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        offerId: insertedOffer.id,
        offerNumber: insertedOffer.offer_number,
        shareUid: insertedOffer.share_uid,
        message: "Email processed and offer created in queue",
        attachmentsUploaded: uploadedAttachments.length,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("❌ Error processing inbound email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});

// Helper function to extract customer data from email
function extractCustomerData(from: string, content: string): {
  companyName: string;
  contactPerson: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  postalCode: string;
} {
  // Extract email from "Name <email@example.com>" format
  const emailMatch = from.match(/<(.+)>/) || [null, from];
  const email = emailMatch[1] || from;
  
  // Extract name from "Name <email@example.com>" format
  const nameMatch = from.match(/^([^<]+)/);
  const contactPerson = nameMatch ? nameMatch[1].trim() : "";

  // Try to find phone number in content
  const phoneMatch = content.match(/(?:\+48|48)?[\s.-]?(\d{3})[\s.-]?(\d{3})[\s.-]?(\d{3})/);
  const phone = phoneMatch ? phoneMatch[0].replace(/[\s.-]/g, "") : "";

  // Try to find postal code and city
  const postalMatch = content.match(/(\d{2}-\d{3})\s+([A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ\s]+)/i);
  const postalCode = postalMatch ? postalMatch[1] : "";
  const city = postalMatch ? postalMatch[2].trim() : "";

  return {
    companyName: "",
    contactPerson,
    email,
    phone,
    address: "",
    city,
    postalCode,
  };
}
