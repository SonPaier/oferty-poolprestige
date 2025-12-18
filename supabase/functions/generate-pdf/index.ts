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
    logoBase64?: string;
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

// Format price with proper Polish currency
const formatPrice = (price: number): string => {
  return price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " zł";
};

// Format number with spaces as thousand separator
const formatNumber = (num: number, decimals: number = 1): string => {
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
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
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;
    let y = 20;

    // Colors
    const primaryColor: [number, number, number] = [0, 128, 160];
    const darkText: [number, number, number] = [30, 30, 30];
    const grayText: [number, number, number] = [100, 100, 100];
    const lightGray: [number, number, number] = [240, 240, 240];

    // Helper functions
    const addText = (
      text: string,
      x: number,
      yPos: number,
      options?: { size?: number; style?: string; color?: [number, number, number]; align?: "left" | "center" | "right" }
    ) => {
      doc.setFontSize(options?.size || 10);
      doc.setFont("helvetica", options?.style || "normal");
      const color = options?.color || darkText;
      doc.setTextColor(color[0], color[1], color[2]);
      
      let xPos = x;
      if (options?.align === "right") {
        const textWidth = doc.getTextWidth(text);
        xPos = x - textWidth;
      } else if (options?.align === "center") {
        const textWidth = doc.getTextWidth(text);
        xPos = x - textWidth / 2;
      }
      doc.text(text, xPos, yPos);
    };

    const addLine = (yPos: number, color?: [number, number, number]) => {
      const c = color || [220, 220, 220];
      doc.setDrawColor(c[0], c[1], c[2]);
      doc.setLineWidth(0.3);
      doc.line(margin, yPos, pageWidth - margin, yPos);
    };

    const checkPageBreak = (requiredSpace: number): boolean => {
      if (y + requiredSpace > pageHeight - 25) {
        doc.addPage();
        y = 20;
        return true;
      }
      return false;
    };

    // Draw rounded rectangle
    const drawRoundedRect = (x: number, yPos: number, w: number, h: number, r: number, fill: [number, number, number]) => {
      doc.setFillColor(fill[0], fill[1], fill[2]);
      doc.roundedRect(x, yPos, w, h, r, r, "F");
    };

    // === HEADER ===
    // Logo placeholder (left side)
    if (data.companySettings.logoBase64) {
      try {
        doc.addImage(data.companySettings.logoBase64, "PNG", margin, y - 5, 35, 15);
      } catch (e) {
        console.log("Could not add logo:", e);
      }
    }

    // Company name and info
    const headerX = data.companySettings.logoBase64 ? margin + 40 : margin;
    addText(data.companySettings.name.toUpperCase(), headerX, y, { size: 16, style: "bold", color: primaryColor });
    y += 5;
    addText(`${data.companySettings.address}, ${data.companySettings.postalCode} ${data.companySettings.city}`, headerX, y, { size: 8, color: grayText });
    y += 4;
    addText(`Tel: ${data.companySettings.phone} | Email: ${data.companySettings.email}`, headerX, y, { size: 8, color: grayText });
    y += 4;
    addText(`NIP: ${data.companySettings.nip} | ${data.companySettings.website}`, headerX, y, { size: 8, color: grayText });

    // Offer info box (right side)
    const offerBoxWidth = 55;
    const offerBoxX = pageWidth - margin - offerBoxWidth;
    drawRoundedRect(offerBoxX, 12, offerBoxWidth, 22, 2, lightGray);
    addText("OFERTA", offerBoxX + offerBoxWidth / 2, 20, { size: 8, color: grayText, align: "center" });
    addText(data.offerNumber, offerBoxX + offerBoxWidth / 2, 26, { size: 10, style: "bold", color: primaryColor, align: "center" });
    
    const currentDate = new Date().toLocaleDateString("pl-PL", { year: "numeric", month: "long", day: "numeric" });
    addText(currentDate, offerBoxX + offerBoxWidth / 2, 32, { size: 8, color: grayText, align: "center" });

    y += 10;
    addLine(y, primaryColor);
    y += 12;

    // === CUSTOMER DATA ===
    drawRoundedRect(margin, y - 3, contentWidth, 35, 2, [250, 252, 255]);
    
    addText("DANE KLIENTA", margin + 5, y + 3, { size: 9, style: "bold", color: primaryColor });
    y += 10;
    
    addText(data.customerData.contactPerson, margin + 5, y, { size: 11, style: "bold", color: darkText });
    y += 5;
    
    if (data.customerData.companyName) {
      addText(data.customerData.companyName, margin + 5, y, { size: 9, color: darkText });
      y += 4;
    }
    
    const contactLine = `Tel: ${data.customerData.phone}${data.customerData.email ? ` | Email: ${data.customerData.email}` : ""}`;
    addText(contactLine, margin + 5, y, { size: 8, color: grayText });
    y += 4;
    
    if (data.customerData.address || data.customerData.city) {
      const addressLine = [data.customerData.address, data.customerData.postalCode, data.customerData.city].filter(Boolean).join(", ");
      addText(addressLine, margin + 5, y, { size: 8, color: grayText });
      y += 4;
    }
    
    if (data.customerData.nip) {
      addText(`NIP: ${data.customerData.nip}`, margin + 5, y, { size: 8, color: grayText });
    }

    y += 15;

    // === POOL PARAMETERS ===
    addText("PARAMETRY BASENU", margin, y, { size: 10, style: "bold", color: primaryColor });
    y += 8;

    const poolTypeLabels: Record<string, string> = {
      prywatny: "Prywatny",
      polprywatny: "Polprywatny",
      hotelowy: "Hotelowy / Publiczny",
    };

    // Pool params in a grid
    const paramBoxWidth = (contentWidth - 10) / 3;
    const params = [
      { label: "Typ basenu", value: poolTypeLabels[data.poolParams.type] || data.poolParams.type },
      { label: "Wymiary", value: `${data.poolParams.length} x ${data.poolParams.width} m` },
      { label: "Glebokosc", value: `${data.poolParams.depthShallow} - ${data.poolParams.depthDeep} m` },
      { label: "Objetosc", value: `${formatNumber(data.poolParams.volume)} m³` },
      { label: "Wydajnosc filtracji", value: `${formatNumber(data.poolParams.requiredFlow)} m³/h` },
    ];

    if (data.poolParams.isIrregular) {
      params.push({ label: "Ksztalt nieregularny", value: `+${data.poolParams.irregularSurcharge}%` });
    }

    params.forEach((param, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = margin + col * (paramBoxWidth + 5);
      const yOffset = row * 12;
      
      addText(param.label + ":", x, y + yOffset, { size: 8, color: grayText });
      addText(param.value, x, y + yOffset + 4, { size: 9, style: "bold", color: darkText });
    });

    y += Math.ceil(params.length / 3) * 12 + 8;
    addLine(y);
    y += 10;

    // === SECTIONS WITH PRODUCTS ===
    const sectionNameMap: Record<string, string> = {
      "Wykończenie basenu": "WYKONCZENIE BASENU",
      "Uzbrojenie niecki": "UZBROJENIE NIECKI",
      "Filtracja": "FILTRACJA",
      "Oświetlenie": "OSWIETLENIE",
      "Automatyka": "AUTOMATYKA",
    };

    for (const section of data.sections) {
      if (section.items.length === 0) continue;

      checkPageBreak(25 + section.items.length * 8);

      const sectionName = sectionNameMap[section.name] || section.name.toUpperCase();
      
      // Section header with background
      drawRoundedRect(margin, y - 2, contentWidth, 7, 1, [245, 248, 250]);
      addText(sectionName, margin + 3, y + 3, { size: 9, style: "bold", color: primaryColor });
      y += 10;

      // Table header
      addText("Produkt", margin, y, { size: 7, color: grayText });
      addText("Ilosc", pageWidth - margin - 50, y, { size: 7, color: grayText });
      addText("Wartosc", pageWidth - margin, y, { size: 7, color: grayText, align: "right" });
      y += 4;

      for (const item of section.items) {
        checkPageBreak(8);

        // Truncate long product names
        let productName = item.product.name;
        const maxNameWidth = contentWidth - 65;
        while (doc.getTextWidth(productName) > maxNameWidth && productName.length > 10) {
          productName = productName.slice(0, -4) + "...";
        }

        addText(productName, margin, y, { size: 8, color: darkText });
        
        const itemTotal = item.unitPrice * item.quantity;
        addText(`${item.quantity} szt.`, pageWidth - margin - 45, y, { size: 8, color: grayText });
        addText(formatPrice(itemTotal), pageWidth - margin, y, { size: 8, style: "bold", color: darkText, align: "right" });

        y += 6;
      }

      y += 4;
    }

    // === EXCAVATION ===
    checkPageBreak(35);
    
    drawRoundedRect(margin, y - 2, contentWidth, 7, 1, [245, 248, 250]);
    addText("ROBOTY ZIEMNE", margin + 3, y + 3, { size: 9, style: "bold", color: primaryColor });
    y += 12;

    addText(`Wykop: ${formatNumber(data.excavation.volume)} m³ x ${formatPrice(data.excavation.pricePerM3)}/m³`, margin, y, { size: 8, color: darkText });
    addText(formatPrice(data.excavation.excavationTotal), pageWidth - margin, y, { size: 8, style: "bold", color: darkText, align: "right" });
    y += 6;

    addText("Wywoz ziemi (ryczalt)", margin, y, { size: 8, color: darkText });
    addText(formatPrice(data.excavation.removalFixedPrice), pageWidth - margin, y, { size: 8, style: "bold", color: darkText, align: "right" });
    y += 12;

    // === SUMMARY ===
    checkPageBreak(55);

    // Summary box
    drawRoundedRect(margin, y, contentWidth, 45, 3, [250, 252, 255]);
    
    const summaryCol1 = margin + 10;
    const summaryCol2 = pageWidth - margin - 10;
    let summaryY = y + 8;

    addText("Produkty i uslugi:", summaryCol1, summaryY, { size: 9, color: grayText });
    addText(formatPrice(data.totals.productsTotal), summaryCol2, summaryY, { size: 9, color: darkText, align: "right" });
    summaryY += 7;

    addText("Roboty ziemne:", summaryCol1, summaryY, { size: 9, color: grayText });
    addText(formatPrice(data.totals.excavationTotal), summaryCol2, summaryY, { size: 9, color: darkText, align: "right" });
    summaryY += 7;

    addLine(summaryY - 2);
    summaryY += 3;

    addText("RAZEM NETTO:", summaryCol1, summaryY, { size: 10, style: "bold", color: darkText });
    addText(formatPrice(data.totals.grandTotalNet), summaryCol2, summaryY, { size: 10, style: "bold", color: darkText, align: "right" });
    summaryY += 7;

    addText(`+ VAT ${(VAT_RATE * 100).toFixed(0)}%:`, summaryCol1, summaryY, { size: 9, color: grayText });
    addText(formatPrice(data.totals.vatAmount), summaryCol2, summaryY, { size: 9, color: grayText, align: "right" });

    y += 50;

    // Grand total bar
    drawRoundedRect(margin, y, contentWidth, 14, 2, primaryColor);
    addText("RAZEM BRUTTO:", margin + 10, y + 9, { size: 12, style: "bold", color: [255, 255, 255] });
    addText(formatPrice(data.totals.grandTotalGross), pageWidth - margin - 10, y + 9, { size: 12, style: "bold", color: [255, 255, 255], align: "right" });

    y += 25;

    // === FOOTER ===
    checkPageBreak(25);
    
    addText("Oferta wazna 30 dni od daty wystawienia.", margin, y, { size: 7, color: grayText });
    y += 4;
    addText("Ceny nie zawieraja kosztow transportu i montazu, chyba ze zaznaczono inaczej.", margin, y, { size: 7, color: grayText });
    y += 8;
    
    addLine(y);
    y += 6;
    addText(`${data.companySettings.name} | ${data.companySettings.website} | ${data.companySettings.phone}`, pageWidth / 2, y, { size: 7, color: primaryColor, align: "center" });

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
