import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { jsPDF } from "https://esm.sh/jspdf@2.5.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OfferItem {
  product: {
    name: string;
    symbol: string;
  };
  quantity: number;
  unitPrice: number;
  discount?: number;
}

interface Section {
  name: string;
  items: OfferItem[];
}

interface InneItem {
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

interface OptionItem {
  name: string;
  quantity: number;
  priceDifference: number;
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
    depth: number;
    volume: number;
    requiredFlow: number;
    isIrregular: boolean;
    irregularSurcharge: number;
    overflowType?: string;
  };
  sections: Section[];
  inneItems?: InneItem[];
  excavation: {
    volume: number;
    pricePerM3: number;
    excavationTotal: number;
    removalFixedPrice: number;
  };
  totals: {
    productsTotal: number;
    inneTotal?: number;
    excavationTotal: number;
    grandTotalNet: number;
    vatRate?: number;
    vatAmount: number;
    grandTotalGross: number;
  };
  notes?: string;
  paymentTerms?: string;
  options?: OptionItem[];
}

// Format price with proper Polish currency
const formatPrice = (price: number): string => {
  return price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " zł";
};

// Format number with spaces as thousand separator
const formatNumber = (num: number, decimals: number = 1): string => {
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

// Replace Polish characters with ASCII equivalents for Helvetica
const sanitizePolishChars = (text: string): string => {
  const polishMap: Record<string, string> = {
    'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 
    'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
    'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 
    'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z'
  };
  return text.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, char => polishMap[char] || char);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: PDFRequest = await req.json();
    console.log("Generating PDF for offer:", data.offerNumber);

    const doc = new jsPDF();
    
    // Using Helvetica (built-in) with Polish character sanitization
    // This is more reliable than trying to load custom fonts
    doc.setFont("helvetica", "normal");

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 20;
    const contentWidth = pageWidth - margin * 2;
    let y = 25;

    // Colors
    const primaryColor: [number, number, number] = [0, 102, 153];
    const darkText: [number, number, number] = [33, 33, 33];
    const grayText: [number, number, number] = [100, 100, 100];
    const lightGray: [number, number, number] = [245, 245, 245];
    const accentColor: [number, number, number] = [230, 126, 34];

    // Helper functions
    const addText = (
      text: string,
      x: number,
      yPos: number,
      options?: { size?: number; style?: string; color?: [number, number, number]; align?: "left" | "center" | "right"; sanitize?: boolean }
    ) => {
      const sanitize = options?.sanitize !== false;
      const displayText = sanitize ? sanitizePolishChars(text) : text;
      
      doc.setFontSize(options?.size || 10);
      doc.setFont("helvetica", options?.style || "normal");
      const color = options?.color || darkText;
      doc.setTextColor(color[0], color[1], color[2]);
      
      let xPos = x;
      if (options?.align === "right") {
        const textWidth = doc.getTextWidth(displayText);
        xPos = x - textWidth;
      } else if (options?.align === "center") {
        const textWidth = doc.getTextWidth(displayText);
        xPos = x - textWidth / 2;
      }
      doc.text(displayText, xPos, yPos);
    };

    const addLine = (yPos: number, color?: [number, number, number], width?: number) => {
      const c = color || [200, 200, 200];
      doc.setDrawColor(c[0], c[1], c[2]);
      doc.setLineWidth(width || 0.3);
      doc.line(margin, yPos, pageWidth - margin, yPos);
    };

    const checkPageBreak = (requiredSpace: number): boolean => {
      if (y + requiredSpace > pageHeight - 30) {
        doc.addPage();
        y = 25;
        return true;
      }
      return false;
    };

    const drawRect = (x: number, yPos: number, w: number, h: number, fill: [number, number, number], radius?: number) => {
      doc.setFillColor(fill[0], fill[1], fill[2]);
      if (radius) {
        doc.roundedRect(x, yPos, w, h, radius, radius, "F");
      } else {
        doc.rect(x, yPos, w, h, "F");
      }
    };

    // === HEADER ===
    // Logo (left side)
    if (data.companySettings.logoBase64) {
      try {
        doc.addImage(data.companySettings.logoBase64, "PNG", margin, y - 8, 30, 12);
      } catch (e) {
        console.log("Could not add logo:", e);
      }
    }

    // Company name and info (left)
    const headerX = data.companySettings.logoBase64 ? margin + 35 : margin;
    addText(data.companySettings.name.toUpperCase(), headerX, y, { size: 14, style: "bold", color: primaryColor });
    y += 5;
    addText(`${data.companySettings.address}, ${data.companySettings.postalCode} ${data.companySettings.city}`, headerX, y, { size: 8, color: grayText });
    y += 4;
    addText(`Tel: ${data.companySettings.phone} | Email: ${data.companySettings.email}`, headerX, y, { size: 8, color: grayText });
    y += 4;
    addText(`NIP: ${data.companySettings.nip} | ${data.companySettings.website}`, headerX, y, { size: 8, color: grayText });

    // Offer box (right side)
    const offerBoxWidth = 50;
    const offerBoxX = pageWidth - margin - offerBoxWidth;
    drawRect(offerBoxX, 17, offerBoxWidth, 20, lightGray, 2);
    addText("OFERTA", offerBoxX + offerBoxWidth / 2, 24, { size: 8, color: grayText, align: "center" });
    addText(data.offerNumber, offerBoxX + offerBoxWidth / 2, 30, { size: 9, style: "bold", color: primaryColor, align: "center" });
    
    const currentDate = new Date().toLocaleDateString("pl-PL", { year: "numeric", month: "long", day: "numeric" });
    addText(sanitizePolishChars(currentDate), offerBoxX + offerBoxWidth / 2, 35, { size: 7, color: grayText, align: "center", sanitize: false });

    y += 8;
    addLine(y, primaryColor, 0.5);
    y += 15;

    // === CUSTOMER DATA ===
    drawRect(margin, y - 5, contentWidth, 32, [248, 250, 252], 3);
    
    addText("DANE KLIENTA", margin + 8, y, { size: 9, style: "bold", color: primaryColor });
    y += 8;
    
    addText(data.customerData.contactPerson, margin + 8, y, { size: 11, style: "bold", color: darkText });
    y += 6;
    
    if (data.customerData.companyName) {
      addText(data.customerData.companyName, margin + 8, y, { size: 9, color: darkText });
      y += 5;
    }
    
    const contactLine = `Tel: ${data.customerData.phone}${data.customerData.email ? ` | Email: ${data.customerData.email}` : ""}`;
    addText(contactLine, margin + 8, y, { size: 8, color: grayText });
    y += 5;
    
    if (data.customerData.address || data.customerData.city) {
      const addressLine = [data.customerData.address, data.customerData.postalCode, data.customerData.city].filter(Boolean).join(", ");
      addText(addressLine, margin + 8, y, { size: 8, color: grayText });
    }

    y += 12;

    // === POOL PARAMETERS ===
    addText("PARAMETRY BASENU", margin, y, { size: 10, style: "bold", color: primaryColor });
    y += 10;

    const poolTypeLabels: Record<string, string> = {
      prywatny: "Prywatny",
      polprywatny: "Polprywatny",
      hotelowy: "Hotelowy / Publiczny",
    };

    const overflowTypeLabels: Record<string, string> = {
      skimmerowy: "Skimmerowy",
      rynnowy: "Rynnowy",
    };

    // Pool params in grid layout
    const colWidth = contentWidth / 3;
    const params = [
      { label: "Typ basenu", value: poolTypeLabels[data.poolParams.type] || data.poolParams.type },
      { label: "Wymiary", value: `${data.poolParams.length} x ${data.poolParams.width} m` },
      { label: "Glebokosc", value: `${data.poolParams.depth} m` },
      { label: "Objetosc", value: `${formatNumber(data.poolParams.volume)} m3` },
      { label: "Wydajnosc filtracji", value: `${formatNumber(data.poolParams.requiredFlow)} m3/h` },
    ];

    if (data.poolParams.overflowType) {
      params.push({ label: "Typ przelewu", value: overflowTypeLabels[data.poolParams.overflowType] || data.poolParams.overflowType });
    }

    params.forEach((param, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = margin + col * colWidth;
      const yOffset = row * 12;
      
      addText(param.label + ":", x, y + yOffset, { size: 8, color: grayText });
      addText(param.value, x, y + yOffset + 5, { size: 9, style: "bold", color: darkText });
    });

    y += Math.ceil(params.length / 3) * 12 + 5;
    addLine(y);
    y += 12;

    // === SECTIONS WITH PRODUCTS ===
    const sectionNameMap: Record<string, string> = {
      "Wykończenie basenu": "WYKONCZENIE BASENU",
      "Uzbrojenie niecki": "UZBROJENIE NIECKI",
      "Filtracja": "FILTRACJA",
      "Oświetlenie": "OSWIETLENIE",
      "Automatyka": "AUTOMATYKA",
      "Dodatki": "DODATKI",
    };

    for (const section of data.sections) {
      if (section.items.length === 0) continue;

      checkPageBreak(30 + section.items.length * 7);

      const sectionName = sectionNameMap[section.name] || sanitizePolishChars(section.name.toUpperCase());
      
      // Section header
      drawRect(margin, y - 3, contentWidth, 8, [240, 245, 250], 2);
      addText(sectionName, margin + 5, y + 2, { size: 9, style: "bold", color: primaryColor, sanitize: false });
      y += 10;

      // Table header
      const colProduct = margin;
      const colQty = pageWidth - margin - 65;
      const colDiscount = pageWidth - margin - 40;
      const colValue = pageWidth - margin;
      
      addText("Produkt", colProduct, y, { size: 7, color: grayText });
      addText("Ilosc", colQty, y, { size: 7, color: grayText });
      addText("Rabat", colDiscount, y, { size: 7, color: grayText });
      addText("Wartosc", colValue, y, { size: 7, color: grayText, align: "right" });
      y += 2;
      addLine(y, [230, 230, 230], 0.2);
      y += 5;

      for (const item of section.items) {
        checkPageBreak(8);

        // Truncate long product names
        let productName = sanitizePolishChars(item.product.name);
        const maxNameWidth = colQty - colProduct - 10;
        while (doc.getTextWidth(productName) > maxNameWidth && productName.length > 10) {
          productName = productName.slice(0, -4) + "...";
        }

        addText(productName, colProduct, y, { size: 8, color: darkText, sanitize: false });
        
        const discount = item.discount ?? 100;
        const itemTotal = item.unitPrice * item.quantity * (discount / 100);
        
        addText(`${item.quantity} szt.`, colQty, y, { size: 8, color: grayText });
        addText(`${discount}%`, colDiscount, y, { size: 8, color: discount < 100 ? accentColor : grayText });
        addText(formatPrice(itemTotal), colValue, y, { size: 8, style: "bold", color: darkText, align: "right" });

        y += 6;
      }

      y += 6;
    }

    // === INNE SECTION ===
    if (data.inneItems && data.inneItems.length > 0) {
      checkPageBreak(30 + data.inneItems.length * 7);

      drawRect(margin, y - 3, contentWidth, 8, [240, 245, 250], 2);
      addText("INNE", margin + 5, y + 2, { size: 9, style: "bold", color: primaryColor });
      y += 10;

      const colProduct = margin;
      const colQty = pageWidth - margin - 65;
      const colDiscount = pageWidth - margin - 40;
      const colValue = pageWidth - margin;

      addText("Pozycja", colProduct, y, { size: 7, color: grayText });
      addText("Ilosc", colQty, y, { size: 7, color: grayText });
      addText("Rabat", colDiscount, y, { size: 7, color: grayText });
      addText("Wartosc", colValue, y, { size: 7, color: grayText, align: "right" });
      y += 2;
      addLine(y, [230, 230, 230], 0.2);
      y += 5;

      for (const item of data.inneItems) {
        checkPageBreak(8);

        const itemName = sanitizePolishChars(item.name);
        const maxNameWidth = colQty - colProduct - 10;
        let displayName = itemName;
        while (doc.getTextWidth(displayName) > maxNameWidth && displayName.length > 10) {
          displayName = displayName.slice(0, -4) + "...";
        }

        addText(displayName, colProduct, y, { size: 8, color: darkText, sanitize: false });
        
        const itemTotal = item.unitPrice * item.quantity * (item.discount / 100);
        const unitText = sanitizePolishChars(item.unit);
        
        addText(`${item.quantity} ${unitText}`, colQty, y, { size: 8, color: grayText, sanitize: false });
        addText(`${item.discount}%`, colDiscount, y, { size: 8, color: item.discount < 100 ? accentColor : grayText });
        addText(formatPrice(itemTotal), colValue, y, { size: 8, style: "bold", color: darkText, align: "right" });

        y += 6;
      }

      y += 6;
    }

    // === EXCAVATION ===
    checkPageBreak(40);
    
    drawRect(margin, y - 3, contentWidth, 8, [240, 245, 250], 2);
    addText("ROBOTY ZIEMNE", margin + 5, y + 2, { size: 9, style: "bold", color: primaryColor });
    y += 12;

    addText(`Wykop: ${formatNumber(data.excavation.volume)} m3 x ${formatPrice(data.excavation.pricePerM3)}/m3`, margin, y, { size: 9, color: darkText });
    addText(formatPrice(data.excavation.excavationTotal), pageWidth - margin, y, { size: 9, style: "bold", color: darkText, align: "right" });
    y += 7;

    addText("Wywoz ziemi (ryczalt)", margin, y, { size: 9, color: darkText });
    addText(formatPrice(data.excavation.removalFixedPrice), pageWidth - margin, y, { size: 9, style: "bold", color: darkText, align: "right" });
    y += 15;

    // === SUMMARY ===
    checkPageBreak(70);

    const vatRate = data.totals.vatRate ?? 23;
    const summaryBoxHeight = data.totals.inneTotal ? 55 : 48;
    
    drawRect(margin, y, contentWidth, summaryBoxHeight, [248, 250, 252], 3);
    
    const summaryCol1 = margin + 12;
    const summaryCol2 = pageWidth - margin - 12;
    let summaryY = y + 10;

    addText("Produkty i uslugi:", summaryCol1, summaryY, { size: 9, color: grayText });
    addText(formatPrice(data.totals.productsTotal), summaryCol2, summaryY, { size: 9, color: darkText, align: "right" });
    summaryY += 8;

    if (data.totals.inneTotal) {
      addText("Inne:", summaryCol1, summaryY, { size: 9, color: grayText });
      addText(formatPrice(data.totals.inneTotal), summaryCol2, summaryY, { size: 9, color: darkText, align: "right" });
      summaryY += 8;
    }

    addText("Roboty ziemne:", summaryCol1, summaryY, { size: 9, color: grayText });
    addText(formatPrice(data.totals.excavationTotal), summaryCol2, summaryY, { size: 9, color: darkText, align: "right" });
    summaryY += 8;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.3);
    doc.line(summaryCol1, summaryY - 2, summaryCol2, summaryY - 2);
    summaryY += 4;

    addText("RAZEM NETTO:", summaryCol1, summaryY, { size: 10, style: "bold", color: darkText });
    addText(formatPrice(data.totals.grandTotalNet), summaryCol2, summaryY, { size: 10, style: "bold", color: darkText, align: "right" });
    summaryY += 8;

    addText(`+ VAT ${vatRate}%:`, summaryCol1, summaryY, { size: 9, color: grayText });
    addText(formatPrice(data.totals.vatAmount), summaryCol2, summaryY, { size: 9, color: grayText, align: "right" });

    y += summaryBoxHeight + 8;

    // Grand total bar
    drawRect(margin, y, contentWidth, 16, primaryColor, 3);
    addText("RAZEM BRUTTO:", margin + 12, y + 10, { size: 11, style: "bold", color: [255, 255, 255] });
    addText(formatPrice(data.totals.grandTotalGross), pageWidth - margin - 12, y + 10, { size: 11, style: "bold", color: [255, 255, 255], align: "right" });

    y += 28;

    // === OPTIONS SECTION ===
    if (data.options && data.options.length > 0) {
      checkPageBreak(25 + data.options.length * 8);

      drawRect(margin, y - 3, contentWidth, 8, [255, 243, 224], 2);
      addText("OPCJE DODATKOWE", margin + 5, y + 2, { size: 9, style: "bold", color: accentColor });
      y += 12;

      addText("Alternatywa", margin, y, { size: 7, color: grayText });
      addText("Ilosc", pageWidth - margin - 50, y, { size: 7, color: grayText });
      addText("Doplata", pageWidth - margin, y, { size: 7, color: grayText, align: "right" });
      y += 5;

      for (const option of data.options) {
        checkPageBreak(8);

        let optionName = sanitizePolishChars(option.name);
        const maxNameWidth = contentWidth - 70;
        while (doc.getTextWidth(optionName) > maxNameWidth && optionName.length > 10) {
          optionName = optionName.slice(0, -4) + "...";
        }

        addText(optionName, margin, y, { size: 8, color: darkText, sanitize: false });
        addText(`${option.quantity} szt.`, pageWidth - margin - 45, y, { size: 8, color: grayText });
        
        const priceStr = option.priceDifference >= 0 
          ? `+${formatPrice(option.priceDifference)}` 
          : formatPrice(option.priceDifference);
        addText(priceStr, pageWidth - margin, y, { size: 8, style: "bold", color: accentColor, align: "right" });

        y += 7;
      }

      y += 10;
    }

    // === NOTES AND PAYMENT TERMS ===
    if (data.notes || data.paymentTerms) {
      checkPageBreak(35);
      
      if (data.notes) {
        addText("UWAGI:", margin, y, { size: 9, style: "bold", color: primaryColor });
        y += 6;
        
        const notesLines = doc.splitTextToSize(sanitizePolishChars(data.notes), contentWidth);
        for (const line of notesLines) {
          checkPageBreak(6);
          addText(line, margin, y, { size: 8, color: darkText, sanitize: false });
          y += 5;
        }
        y += 6;
      }

      if (data.paymentTerms) {
        addText("WARUNKI PLATNOSCI:", margin, y, { size: 9, style: "bold", color: primaryColor });
        y += 6;
        
        const termsLines = doc.splitTextToSize(sanitizePolishChars(data.paymentTerms), contentWidth);
        for (const line of termsLines) {
          checkPageBreak(6);
          addText(line, margin, y, { size: 8, color: darkText, sanitize: false });
          y += 5;
        }
        y += 6;
      }
    }

    // === FOOTER ===
    checkPageBreak(20);
    
    y += 5;
    addLine(y, primaryColor, 0.5);
    y += 8;
    
    const footerText = `${data.companySettings.name} | ${data.companySettings.website} | ${data.companySettings.phone}`;
    addText(sanitizePolishChars(footerText), pageWidth / 2, y, { size: 8, color: primaryColor, align: "center", sanitize: false });

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
