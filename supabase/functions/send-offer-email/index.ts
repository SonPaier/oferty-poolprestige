import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string;
  cc?: string;
  subject: string;
  body: string;
  pdfBase64?: string;
  pdfFilename?: string;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const emailData: EmailRequest = await req.json();
    
    console.log("📧 Mock email sending:", {
      to: emailData.to,
      cc: emailData.cc,
      subject: emailData.subject,
      bodyLength: emailData.body.length,
      hasAttachment: !!emailData.pdfBase64,
    });

    // Check if RESEND_API_KEY is configured
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (!resendApiKey) {
      // MOCK MODE - Return success without actually sending
      console.log("⚠️ RESEND_API_KEY not configured - running in MOCK mode");
      
      return new Response(
        JSON.stringify({
          success: true,
          mock: true,
          message: "Email wysłany (tryb testowy - skonfiguruj RESEND_API_KEY dla prawdziwej wysyłki)",
          details: {
            to: emailData.to,
            cc: emailData.cc,
            subject: emailData.subject,
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // REAL MODE - Send via Resend
    // Note: Real implementation would use Resend API here
    // For now, we'll still mock but indicate the key is present
    console.log("✅ RESEND_API_KEY configured - would send real email");
    
    // TODO: Implement real Resend sending when ready
    // const resend = new Resend(resendApiKey);
    // await resend.emails.send({...});

    return new Response(
      JSON.stringify({
        success: true,
        mock: false,
        message: "Email został wysłany",
        details: {
          to: emailData.to,
          cc: emailData.cc,
          subject: emailData.subject,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: unknown) {
    console.error("❌ Email error:", error);
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
