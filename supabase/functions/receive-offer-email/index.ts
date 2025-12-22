import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, svix-id, svix-timestamp, svix-signature",
};

// Flexible payload structure for both Resend and Zapier
interface EmailPayload {
  type?: "email.received" | string;
  created_at?: string;
  data?: {
    email_id?: string;
    from: string;
    to?: string | string[];
    cc?: string[];
    subject: string;
    text?: string;
    html?: string;
    // Resend format: base64 encoded
    attachments?: Array<{
      filename: string;
      content: string;
      content_type: string;
      size: number;
    }>;
    // Zapier format: URLs
    attachment_urls?: string[];
  };
  // Direct Zapier fields (flat structure)
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  body_plain?: string;
  body_html?: string;
  attachment_urls?: string[];
  attachments?: string; // Zapier might send as comma-separated URLs
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: EmailPayload = await req.json();
    
    // Normalize data - handle both nested (Resend) and flat (Zapier) structures
    const emailData = {
      from: payload.data?.from || payload.from || "",
      to: payload.data?.to || payload.to || "",
      subject: payload.data?.subject || payload.subject || "(brak tematu)",
      text: payload.data?.text || payload.text || payload.body_plain || "",
      html: payload.data?.html || payload.html || payload.body_html || "",
    };

    console.log("📧 Received email webhook:", {
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
        JSON.stringify({ success: false, error: "Missing 'from' field" }),
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

    // Handle Resend-style attachments (base64)
    const resendAttachments = payload.data?.attachments || [];
    if (resendAttachments.length > 0) {
      console.log(`📎 Processing ${resendAttachments.length} Resend attachments (base64)...`);
      
      for (const attachment of resendAttachments) {
        try {
          const binaryString = atob(attachment.content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          
          const timestamp = Date.now();
          const safeName = attachment.filename.replace(/[^a-zA-Z0-9.-]/g, "_");
          const filePath = `email-attachments/${timestamp}-${safeName}`;
          
          const { error: uploadError } = await supabase.storage
            .from("offer-attachments")
            .upload(filePath, bytes, {
              contentType: attachment.content_type,
              upsert: false,
            });

          if (uploadError) {
            console.error(`❌ Failed to upload ${attachment.filename}:`, uploadError);
            continue;
          }

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

          console.log(`✅ Uploaded (base64): ${attachment.filename}`);
        } catch (err) {
          console.error(`❌ Error processing attachment ${attachment.filename}:`, err);
        }
      }
    }

    // Handle Zapier-style attachments (URLs)
    let zapierAttachmentUrls: string[] = [];
    
    // Can be array or comma-separated string
    if (payload.data?.attachment_urls) {
      zapierAttachmentUrls = Array.isArray(payload.data.attachment_urls) 
        ? payload.data.attachment_urls 
        : [payload.data.attachment_urls];
    } else if (payload.attachment_urls) {
      zapierAttachmentUrls = Array.isArray(payload.attachment_urls) 
        ? payload.attachment_urls 
        : [payload.attachment_urls];
    } else if (payload.attachments && typeof payload.attachments === 'string') {
      // Comma-separated URLs
      zapierAttachmentUrls = payload.attachments.split(',').map(url => url.trim()).filter(Boolean);
    }

    if (zapierAttachmentUrls.length > 0) {
      console.log(`📎 Processing ${zapierAttachmentUrls.length} Zapier attachments (URLs)...`);
      
      for (const attachmentUrl of zapierAttachmentUrls) {
        try {
          if (!attachmentUrl || !attachmentUrl.startsWith('http')) {
            console.log(`⚠️ Skipping invalid URL: ${attachmentUrl}`);
            continue;
          }

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
            const urlParts = new URL(attachmentUrl);
            const pathParts = urlParts.pathname.split('/');
            filename = pathParts[pathParts.length - 1] || 'attachment';
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

          console.log(`✅ Uploaded (URL): ${filename}`);
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
    const offerNumber = `OF-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
    const shareUid = `${Math.random().toString(36).substring(2, 10)}-${Math.random().toString(36).substring(2, 10)}-${Math.random().toString(36).substring(2, 6)}`;

    // Create new offer in queue
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
        sourceEmail: emailContent.substring(0, 5000),
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
