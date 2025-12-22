import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

// Resend Inbound Email Webhook payload structure
interface ResendInboundEmail {
  type: "email.received";
  created_at: string;
  data: {
    email_id: string;
    from: string;
    to: string[];
    cc?: string[];
    subject: string;
    text?: string;
    html?: string;
    attachments?: Array<{
      filename: string;
      content: string; // base64 encoded
      content_type: string;
      size: number;
    }>;
  };
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: ResendInboundEmail = await req.json();
    
    console.log("📧 Received inbound email webhook:", {
      type: payload.type,
      from: payload.data?.from,
      to: payload.data?.to,
      subject: payload.data?.subject,
      attachmentCount: payload.data?.attachments?.length || 0,
    });

    // Verify this is an email received event
    if (payload.type !== "email.received") {
      console.log("⚠️ Ignoring non-email event:", payload.type);
      return new Response(JSON.stringify({ success: true, ignored: true }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { from, to, subject, text, html, attachments } = payload.data;
    
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

    if (attachments && attachments.length > 0) {
      console.log(`📎 Processing ${attachments.length} attachments...`);
      
      for (const attachment of attachments) {
        try {
          // Decode base64 content
          const binaryString = atob(attachment.content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          // Generate unique path
          const timestamp = Date.now();
          const safeName = attachment.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
          const filePath = `email-attachments/${timestamp}-${safeName}`;
          
          // Upload to storage
          const { data: uploadData, error: uploadError } = await supabase.storage
            .from("offer-attachments")
            .upload(filePath, bytes, {
              contentType: attachment.content_type,
              upsert: false,
            });

          if (uploadError) {
            console.error(`❌ Failed to upload ${attachment.filename}:`, uploadError);
            continue;
          }

          // Get public URL
          const { data: urlData } = supabase.storage
            .from("offer-attachments")
            .getPublicUrl(filePath);

          uploadedAttachments.push({
            name: attachment.filename,
            type: attachment.content_type,
            size: attachment.size,
            url: urlData.publicUrl,
            path: filePath,
          });

          console.log(`✅ Uploaded: ${attachment.filename}`);
        } catch (err) {
          console.error(`❌ Error processing attachment ${attachment.filename}:`, err);
        }
      }
    }

    // Extract customer data from email
    const emailContent = text || html || "";
    const customerData = extractCustomerData(from, emailContent);

    // Generate offer number
    const now = new Date();
    const offerNumber = `OF-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const shareUid = `${Math.random().toString(36).substring(2, 10)}-${Math.random().toString(36).substring(2, 10)}-${Math.random().toString(36).substring(2, 6)}`;

    // Create new offer in queue
    const newOffer = {
      offer_number: offerNumber,
      share_uid: shareUid,
      status: "queue", // New offers go to queue
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
        sourceEmail: emailContent.substring(0, 5000), // Store first 5000 chars of email
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
      from: from,
      subject: subject,
      attachments: uploadedAttachments.length,
    });

    return new Response(
      JSON.stringify({
        success: true,
        offerId: insertedOffer.id,
        offerNumber: insertedOffer.offer_number,
        message: "Email processed and offer created in queue",
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
