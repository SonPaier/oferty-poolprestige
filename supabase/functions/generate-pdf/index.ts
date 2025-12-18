import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAT_RATE = 0.08;

interface OfferItem {
  product: {
    name: string;
    symbol: string;
  };
  quantity: number;
  unitPrice: number;
}

interface Section {
  name: string;
  items: OfferItem[];
}

interface PDFRequest {
  offerNumber: string;
  companySettings: {
    name: string;
    address: string;
    city: string;
    postalCode: string;
    nip: string;
    phone: string;
    email: string;
    website: string;
  };
  customerData: {
    companyName?: string;
    contactPerson: string;
    email?: string;
    phone: string;
    address?: string;
    city?: string;
    postalCode?: string;
    nip?: string;
  };
  poolParams: {
    type: string;
    length: number;
    width: number;
    depthShallow: number;
    depthDeep: number;
    volume: number;
    requiredFlow: number;
    isIrregular: boolean;
    irregularSurcharge: number;
  };
  sections: Section[];
  excavation: {
    volume: number;
    pricePerM3: number;
    excavationTotal: number;
    removalFixedPrice: number;
  };
  totals: {
    productsTotal: number;
    excavationTotal: number;
    grandTotalNet: number;
    vatAmount: number;
    grandTotalGross: number;
  };
}

const formatPrice = (price: number): string => {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
  }).format(price);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: PDFRequest = await req.json();
    console.log("Generating PDF for offer:", data.offerNumber);

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    let y = 20;

    // Helper functions
    const addText = (text: string, x: number, yPos: number, options?: { size?: number; style?: string; color?: number[] }) => {
      doc.setFontSize(options?.size || 10);
      doc.setFont("helvetica", options?.style || "normal");
      if (options?.color) {
        doc.setTextColor(options.color[0], options.color[1], options.color[2]);
      } else {
        doc.setTextColor(0, 0, 0);
      }
      doc.text(text, x, yPos);
    };

    const addLine = (yPos: number) => {
      doc.setDrawColor(200, 200, 200);
      doc.line(margin, yPos, pageWidth - margin, yPos);
    };

    const checkPageBreak = (requiredSpace: number) => {
      if (y + requiredSpace > 280) {
        doc.addPage();
        y = 20;
      }
    };

    // === HEADER ===
    addText("POOL PRESTIGE", margin, y, { size: 24, style: "bold", color: [0, 150, 180] });
    y += 8;
    addText(data.companySettings.name, margin, y, { size: 10 });
    y += 5;
    addText(`${data.companySettings.address}, ${data.companySettings.postalCode} ${data.companySettings.city}`, margin, y, { size: 9, color: [100, 100, 100] });
    y += 4;
    addText(`Tel: ${data.companySettings.phone} | Email: ${data.companySettings.email}`, margin, y, { size: 9, color: [100, 100, 100] });
    y += 4;
    addText(`NIP: ${data.companySettings.nip}`, margin, y, { size: 9, color: [100, 100, 100] });

    // Offer info on right
    const currentDate = new Date().toLocaleDateString("pl-PL", { year: "numeric", month: "long", day: "numeric" });
    addText(`Oferta nr: ${data.offerNumber}`, pageWidth - margin - 60, 20, { size: 10, style: "bold" });
    addText(`Data: ${currentDate}`, pageWidth - margin - 60, 26, { size: 9, color: [100, 100, 100] });

    y += 10;
    addLine(y);
    y += 10;

    // === CUSTOMER DATA ===
    addText("DANE KLIENTA", margin, y, { size: 12, style: "bold", color: [0, 100, 120] });
    y += 8;
    addText(data.customerData.contactPerson, margin, y, { size: 11, style: "bold" });
    y += 5;
    if (data.customerData.companyName) {
      addText(data.customerData.companyName, margin, y, { size: 10 });
      y += 5;
    }
    if (data.customerData.nip) {
      addText(`NIP: ${data.customerData.nip}`, margin, y, { size: 9, color: [80, 80, 80] });
      y += 5;
    }
    addText(`Tel: ${data.customerData.phone}`, margin, y, { size: 9, color: [80, 80, 80] });
    if (data.customerData.email) {
      addText(`Email: ${data.customerData.email}`, margin + 60, y, { size: 9, color: [80, 80, 80] });
    }
    y += 5;
    if (data.customerData.address || data.customerData.city) {
      addText(`${data.customerData.address || ""}, ${data.customerData.postalCode || ""} ${data.customerData.city || ""}`, margin, y, { size: 9, color: [80, 80, 80] });
      y += 5;
    }

    y += 8;
    addLine(y);
    y += 10;

    // === POOL PARAMETERS ===
    addText("PARAMETRY BASENU", margin, y, { size: 12, style: "bold", color: [0, 100, 120] });
    y += 8;

    const poolTypeLabels: Record<string, string> = {
      prywatny: "Prywatny",
      polprywatny: "Polprywatny",
      hotelowy: "Hotelowy / Publiczny",
    };

    const col1 = margin;
    const col2 = margin + 50;
    const col3 = margin + 100;

    addText("Typ basenu:", col1, y, { size: 9, color: [80, 80, 80] });
    addText(poolTypeLabels[data.poolParams.type] || data.poolParams.type, col1, y + 4, { size: 10, style: "bold" });

    addText("Wymiary:", col2, y, { size: 9, color: [80, 80, 80] });
    addText(`${data.poolParams.length} x ${data.poolParams.width} m`, col2, y + 4, { size: 10, style: "bold" });

    addText("Glebokosc:", col3, y, { size: 9, color: [80, 80, 80] });
    addText(`${data.poolParams.depthShallow} - ${data.poolParams.depthDeep} m`, col3, y + 4, { size: 10, style: "bold" });

    y += 12;

    addText("Objetosc:", col1, y, { size: 9, color: [80, 80, 80] });
    addText(`${data.poolParams.volume.toFixed(1)} m3`, col1, y + 4, { size: 10, style: "bold" });

    addText("Wydajnosc filtracji:", col2, y, { size: 9, color: [80, 80, 80] });
    addText(`${data.poolParams.requiredFlow.toFixed(1)} m3/h`, col2, y + 4, { size: 10, style: "bold" });

    if (data.poolParams.isIrregular) {
      addText("Ksztalt nieregularny:", col3, y, { size: 9, color: [80, 80, 80] });
      addText(`+${data.poolParams.irregularSurcharge}%`, col3, y + 4, { size: 10, style: "bold", color: [200, 120, 0] });
    }

    y += 15;
    addLine(y);
    y += 10;

    // === SECTIONS WITH PRODUCTS ===
    for (const section of data.sections) {
      if (section.items.length === 0) continue;

      checkPageBreak(30);

      addText(section.name.toUpperCase(), margin, y, { size: 11, style: "bold", color: [0, 100, 120] });
      y += 7;

      for (const item of section.items) {
        checkPageBreak(15);

        const productName = item.product.name.length > 60
          ? item.product.name.substring(0, 57) + "..."
          : item.product.name;
        addText(productName, margin, y, { size: 9 });

        const itemTotal = item.unitPrice * item.quantity;
        addText(`${item.quantity} szt.`, pageWidth - margin - 55, y, { size: 9, color: [80, 80, 80] });
        addText(formatPrice(itemTotal), pageWidth - margin - 25, y, { size: 9, style: "bold" });

        y += 5;
      }

      y += 5;
    }

    // === EXCAVATION ===
    checkPageBreak(40);
    addLine(y);
    y += 10;

    addText("ROBOTY ZIEMNE", margin, y, { size: 11, style: "bold", color: [0, 100, 120] });
    y += 7;

    addText(`Wykop: ${data.excavation.volume.toFixed(1)} m3 x ${formatPrice(data.excavation.pricePerM3)}/m3`, margin, y, { size: 9 });
    addText(formatPrice(data.excavation.excavationTotal), pageWidth - margin - 25, y, { size: 9, style: "bold" });
    y += 5;

    addText("Wywoz ziemi (ryczalt)", margin, y, { size: 9 });
    addText(formatPrice(data.excavation.removalFixedPrice), pageWidth - margin - 25, y, { size: 9, style: "bold" });
    y += 8;

    // === SUMMARY ===
    checkPageBreak(50);
    y += 5;
    addLine(y);
    y += 10;

    // Summary box
    doc.setFillColor(245, 250, 255);
    doc.rect(margin, y - 3, pageWidth - margin * 2, 35, "F");

    addText("Produkty i uslugi:", margin + 5, y + 3, { size: 10, color: [80, 80, 80] });
    addText(formatPrice(data.totals.productsTotal), pageWidth - margin - 30, y + 3, { size: 10 });

    addText("Roboty ziemne:", margin + 5, y + 10, { size: 10, color: [80, 80, 80] });
    addText(formatPrice(data.totals.excavationTotal), pageWidth - margin - 30, y + 10, { size: 10 });

    addText("RAZEM NETTO:", margin + 5, y + 18, { size: 11, style: "bold" });
    addText(formatPrice(data.totals.grandTotalNet), pageWidth - margin - 30, y + 18, { size: 11, style: "bold" });

    addText("+ VAT 8%:", margin + 5, y + 25, { size: 10, color: [80, 80, 80] });
    addText(formatPrice(data.totals.vatAmount), pageWidth - margin - 30, y + 25, { size: 10, color: [80, 80, 80] });

    y += 40;

    // Grand total
    doc.setFillColor(0, 150, 180);
    doc.rect(margin, y - 3, pageWidth - margin * 2, 15, "F");

    addText("RAZEM BRUTTO:", margin + 5, y + 6, { size: 14, style: "bold", color: [255, 255, 255] });
    addText(formatPrice(data.totals.grandTotalGross), pageWidth - margin - 35, y + 6, { size: 14, style: "bold", color: [255, 255, 255] });

    y += 25;

    // === FOOTER ===
    checkPageBreak(30);
    addText("Oferta wazna 30 dni od daty wystawienia.", margin, y, { size: 8, color: [100, 100, 100] });
    y += 4;
    addText("Ceny nie zawieraja kosztow transportu i montazu, chyba ze zaznaczono inaczej.", margin, y, { size: 8, color: [100, 100, 100] });
    y += 8;
    addText(`${data.companySettings.name} | ${data.companySettings.website}`, margin, y, { size: 8, color: [0, 100, 120] });

    // Generate PDF as base64
    const pdfOutput = doc.output("datauristring");

    console.log("PDF generated successfully");

    return new Response(JSON.stringify({ pdf: pdfOutput, offerNumber: data.offerNumber }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
