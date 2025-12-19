import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { encode as encodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import fontkit from "https://esm.sh/@pdf-lib/fontkit@1.1.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OfferItem {
  product: { name: string; symbol: string };
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

const formatPrice = (price: number): string => {
  return price.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " zł";
};

const formatNumber = (num: number, decimals: number = 1): string => {
  return num.toFixed(decimals).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
};

// Load and cache fonts.
// Note: some deployments may not bundle binary assets next to index.ts, so we fall back to remote download.
let cachedFont: Uint8Array | null = null;
let cachedFontBold: Uint8Array | null = null;

const REMOTE_FONT_REGULAR =
  "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf";
const REMOTE_FONT_BOLD =
  "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Bold.ttf";

async function readLocalFont(path: string) {
  try {
    const url = new URL(path, import.meta.url);
    return await Deno.readFile(url);
  } catch (e) {
    console.warn(`Local font not available (${path}) – falling back to remote`, e);
    return null;
  }
}

async function fetchFont(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Font download failed: ${res.status} ${res.statusText}`);
  return new Uint8Array(await res.arrayBuffer());
}

async function loadFonts() {
  if (!cachedFont) {
    console.log("Loading Noto Sans Regular...");
    cachedFont = (await readLocalFont("./NotoSans-Regular.ttf")) ?? (await fetchFont(REMOTE_FONT_REGULAR));
    console.log("Noto Sans Regular loaded");
  }
  if (!cachedFontBold) {
    console.log("Loading Noto Sans Bold...");
    cachedFontBold = (await readLocalFont("./NotoSans-Bold.ttf")) ?? (await fetchFont(REMOTE_FONT_BOLD));
    console.log("Noto Sans Bold loaded");
  }
  return { regular: cachedFont, bold: cachedFontBold };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: PDFRequest = await req.json();
    console.log("Generating PDF for offer:", data.offerNumber);

    // Load fonts (fallback to standard fonts if anything goes wrong)
    let fonts: { regular: Uint8Array; bold: Uint8Array } | null = null;
    try {
      fonts = await loadFonts();
    } catch (e) {
      console.warn("Font load failed – using Helvetica:", e);
      fonts = null;
    }

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);

    // Embed fonts
    let fontRegular, fontBold;
    try {
      if (!fonts) throw new Error("Fonts not available");
      fontRegular = await pdfDoc.embedFont(fonts.regular, { subset: true });
      fontBold = await pdfDoc.embedFont(fonts.bold, { subset: true });
      console.log("Custom fonts embedded successfully");
    } catch (e) {
      console.warn("Failed to embed custom fonts, using Helvetica:", e);
      fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
      fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }

    // Page setup
    const pageWidth = 595.28; // A4
    const pageHeight = 841.89;
    const margin = 50;
    const contentWidth = pageWidth - margin * 2;

    let page = pdfDoc.addPage([pageWidth, pageHeight]);
    let y = pageHeight - margin;

    // Colors
    const primaryColor = rgb(0, 0.4, 0.6);
    const darkText = rgb(0.13, 0.13, 0.13);
    const grayText = rgb(0.4, 0.4, 0.4);
    const lightGray = rgb(0.96, 0.97, 0.98);
    const accentColor = rgb(0.9, 0.5, 0.13);

    // Helper functions
    const drawText = (text: string, x: number, yPos: number, options?: { 
      size?: number; 
      font?: typeof fontRegular; 
      color?: typeof darkText;
      maxWidth?: number;
    }) => {
      const size = options?.size || 10;
      const font = options?.font || fontRegular;
      const color = options?.color || darkText;
      
      let displayText = text;
      if (options?.maxWidth) {
        while (font.widthOfTextAtSize(displayText, size) > options.maxWidth && displayText.length > 3) {
          displayText = displayText.slice(0, -4) + "...";
        }
      }
      
      page.drawText(displayText, { x, y: yPos, size, font, color });
    };

    const drawTextRight = (text: string, xRight: number, yPos: number, options?: { 
      size?: number; 
      font?: typeof fontRegular; 
      color?: typeof darkText;
    }) => {
      const size = options?.size || 10;
      const font = options?.font || fontRegular;
      const color = options?.color || darkText;
      const textWidth = font.widthOfTextAtSize(text, size);
      page.drawText(text, { x: xRight - textWidth, y: yPos, size, font, color });
    };

    const drawLine = (yPos: number, color?: typeof grayText) => {
      page.drawLine({
        start: { x: margin, y: yPos },
        end: { x: pageWidth - margin, y: yPos },
        thickness: 0.5,
        color: color || rgb(0.8, 0.8, 0.8),
      });
    };

    const drawRect = (x: number, yPos: number, w: number, h: number, color: typeof lightGray) => {
      page.drawRectangle({ x, y: yPos, width: w, height: h, color });
    };

    const checkPageBreak = (requiredSpace: number) => {
      if (y - requiredSpace < margin + 30) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        y = pageHeight - margin;
        return true;
      }
      return false;
    };

    const getTextWidth = (text: string, font: typeof fontRegular, size: number) => {
      return font.widthOfTextAtSize(text, size);
    };

    // === HEADER ===
    // Header background (matching topbar style) - increased height with more padding
    const headerHeight = 85;
    drawRect(0, pageHeight - headerHeight, pageWidth, headerHeight, primaryColor);
    
    // Logo - centered vertically in header
    let logoWidth = 0;
    if (data.companySettings.logoBase64) {
      try {
        const logoData = data.companySettings.logoBase64.split(",")[1] || data.companySettings.logoBase64;
        const logoBytes = Uint8Array.from(atob(logoData), c => c.charCodeAt(0));
        const logoImage = await pdfDoc.embedPng(logoBytes);
        const logoMaxHeight = (headerHeight - 20) * 0.5; // 50% of available space
        const scale = logoMaxHeight / logoImage.height;
        const scaledWidth = logoImage.width * scale;
        const scaledHeight = logoImage.height * scale;
        logoWidth = scaledWidth + 15;
        // Center logo vertically in header
        const logoY = pageHeight - headerHeight + (headerHeight - scaledHeight) / 2;
        page.drawImage(logoImage, { 
          x: margin, 
          y: logoY, 
          width: scaledWidth, 
          height: scaledHeight 
        });
      } catch (e) {
        console.log("Could not add logo:", e);
      }
    }

    // Company info (white text on blue background) - centered vertically
    const headerX = margin + logoWidth;
    const textBlockHeight = 50; // approximate height of all text lines
    const textStartY = pageHeight - (headerHeight - textBlockHeight) / 2;
    drawText(data.companySettings.name.toUpperCase(), headerX, textStartY - 5, { size: 14, font: fontBold, color: rgb(1, 1, 1) });
    drawText(`${data.companySettings.address}, ${data.companySettings.postalCode} ${data.companySettings.city}`, headerX, textStartY - 20, { size: 8, color: rgb(0.9, 0.9, 0.9) });
    drawText(`Tel: ${data.companySettings.phone} | Email: ${data.companySettings.email}`, headerX, textStartY - 32, { size: 8, color: rgb(0.9, 0.9, 0.9) });
    drawText(`NIP: ${data.companySettings.nip} | ${data.companySettings.website}`, headerX, textStartY - 44, { size: 8, color: rgb(0.9, 0.9, 0.9) });

    // Offer info (in header, right corner - white text) - centered vertically
    const currentDate = new Date().toLocaleDateString("pl-PL", { year: "numeric", month: "long", day: "numeric" });
    drawTextRight("OFERTA", pageWidth - margin, textStartY - 5, { size: 9, color: rgb(0.8, 0.9, 1) });
    drawTextRight(data.offerNumber, pageWidth - margin, textStartY - 20, { size: 12, font: fontBold, color: rgb(1, 1, 1) });
    drawTextRight(currentDate, pageWidth - margin, textStartY - 35, { size: 8, color: rgb(0.8, 0.9, 1) });

    y = pageHeight - headerHeight - 20;
    drawLine(y, primaryColor);
    y -= 25;

    // === CUSTOMER DATA ===
    drawRect(margin, y - 55, contentWidth, 60, rgb(0.97, 0.98, 1));
    
    drawText("DANE KLIENTA", margin + 15, y - 12, { size: 10, font: fontBold, color: primaryColor });
    drawText(data.customerData.contactPerson, margin + 15, y - 28, { size: 12, font: fontBold, color: darkText });
    
    let customerY = y - 42;
    if (data.customerData.companyName) {
      drawText(data.customerData.companyName, margin + 15, customerY, { size: 10, color: darkText });
      customerY -= 12;
    }
    
    const contactLine = `Tel: ${data.customerData.phone}${data.customerData.email ? ` | Email: ${data.customerData.email}` : ""}`;
    drawText(contactLine, margin + 15, customerY, { size: 9, color: grayText });
    
    if (data.customerData.address || data.customerData.city) {
      const addressLine = [data.customerData.address, data.customerData.postalCode, data.customerData.city].filter(Boolean).join(", ");
      drawText(addressLine, margin + 15, customerY - 12, { size: 9, color: grayText });
    }

    y -= 75;

    // === POOL PARAMETERS ===
    drawText("PARAMETRY BASENU", margin, y, { size: 11, font: fontBold, color: primaryColor });
    y -= 18;

    const poolTypeLabels: Record<string, string> = {
      prywatny: "Prywatny",
      polprywatny: "Półprywatny",
      hotelowy: "Hotelowy / Publiczny",
    };

    const overflowTypeLabels: Record<string, string> = {
      skimmerowy: "Skimmerowy",
      rynnowy: "Rynnowy",
    };

    const params = [
      { label: "Typ basenu:", value: poolTypeLabels[data.poolParams.type] || data.poolParams.type },
      { label: "Wymiary:", value: `${data.poolParams.length} x ${data.poolParams.width} m` },
      { label: "Głębokość:", value: `${data.poolParams.depth} m` },
      { label: "Objętość:", value: `${formatNumber(data.poolParams.volume)} m³` },
      { label: "Wydajność filtracji:", value: `${formatNumber(data.poolParams.requiredFlow)} m³/h` },
    ];

    if (data.poolParams.overflowType) {
      params.push({ label: "Typ przelewu:", value: overflowTypeLabels[data.poolParams.overflowType] || data.poolParams.overflowType });
    }

    const colWidth = contentWidth / 3;
    params.forEach((param, i) => {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = margin + col * colWidth;
      const yOffset = row * 28;
      
      drawText(param.label, x, y - yOffset, { size: 9, color: grayText });
      drawText(param.value, x, y - yOffset - 12, { size: 10, font: fontBold, color: darkText });
    });

    y -= Math.ceil(params.length / 3) * 28 + 10;
    drawLine(y);
    y -= 20;

    // === SECTIONS WITH PRODUCTS ===
    const sectionNameMap: Record<string, string> = {
      "Wykończenie basenu": "WYKOŃCZENIE BASENU",
      "Uzbrojenie niecki": "UZBROJENIE NIECKI",
      "Filtracja": "FILTRACJA",
      "Oświetlenie": "OŚWIETLENIE",
      "Automatyka": "AUTOMATYKA",
      "Dodatki": "DODATKI",
    };

    for (const section of data.sections) {
      if (section.items.length === 0) continue;

      checkPageBreak(50 + section.items.length * 18);

      const sectionName = sectionNameMap[section.name] || section.name.toUpperCase();
      
      // Section header
      drawRect(margin, y - 12, contentWidth, 18, rgb(0.94, 0.96, 0.98));
      drawText(sectionName, margin + 10, y - 8, { size: 10, font: fontBold, color: primaryColor });
      y -= 25;

      // Table header
      const colProduct = margin;
      const colQty = pageWidth - margin - 150;
      const colDiscount = pageWidth - margin - 90;
      const colValue = pageWidth - margin;

      drawText("Produkt", colProduct, y, { size: 8, color: grayText });
      drawText("Ilość", colQty, y, { size: 8, color: grayText });
      drawText("Rabat", colDiscount, y, { size: 8, color: grayText });
      drawTextRight("Wartość", colValue, y, { size: 8, color: grayText });
      y -= 5;
      drawLine(y, rgb(0.9, 0.9, 0.9));
      y -= 12;

      for (const item of section.items) {
        checkPageBreak(20);

        const maxNameWidth = colQty - colProduct - 20;
        drawText(item.product.name, colProduct, y, { size: 9, color: darkText, maxWidth: maxNameWidth });
        
        const discount = item.discount ?? 100;
        const actualDiscount = 100 - discount; // Convert: 95% means 5% discount displayed
        const itemTotal = item.unitPrice * item.quantity * (discount / 100);
        
        drawText(`${item.quantity} szt.`, colQty, y, { size: 9, color: grayText });
        if (actualDiscount > 0) {
          drawText(`${actualDiscount}%`, colDiscount, y, { size: 9, color: accentColor });
        }
        drawTextRight(formatPrice(itemTotal), colValue, y, { size: 9, font: fontBold, color: darkText });

        y -= 16;
      }

      y -= 8;
    }

    // === INNE SECTION ===
    if (data.inneItems && data.inneItems.length > 0) {
      checkPageBreak(50 + data.inneItems.length * 18);

      drawRect(margin, y - 12, contentWidth, 18, rgb(0.94, 0.96, 0.98));
      drawText("INNE", margin + 10, y - 8, { size: 10, font: fontBold, color: primaryColor });
      y -= 25;

      const colProduct = margin;
      const colQty = pageWidth - margin - 150;
      const colDiscount = pageWidth - margin - 90;
      const colValue = pageWidth - margin;

      drawText("Pozycja", colProduct, y, { size: 8, color: grayText });
      drawText("Ilość", colQty, y, { size: 8, color: grayText });
      drawText("Rabat", colDiscount, y, { size: 8, color: grayText });
      drawTextRight("Wartość", colValue, y, { size: 8, color: grayText });
      y -= 5;
      drawLine(y, rgb(0.9, 0.9, 0.9));
      y -= 12;

      for (const item of data.inneItems) {
        checkPageBreak(20);

        const maxNameWidth = colQty - colProduct - 20;
        drawText(item.name, colProduct, y, { size: 9, color: darkText, maxWidth: maxNameWidth });
        
        const actualDiscount = 100 - item.discount; // Convert: 95% means 5% discount displayed
        const itemTotal = item.unitPrice * item.quantity * (item.discount / 100);
        
        drawText(`${item.quantity} ${item.unit}`, colQty, y, { size: 9, color: grayText });
        if (actualDiscount > 0) {
          drawText(`${actualDiscount}%`, colDiscount, y, { size: 9, color: accentColor });
        }
        drawTextRight(formatPrice(itemTotal), colValue, y, { size: 9, font: fontBold, color: darkText });

        y -= 16;
      }

      y -= 8;
    }

    // === EXCAVATION ===
    checkPageBreak(80);
    
    drawRect(margin, y - 12, contentWidth, 18, rgb(0.94, 0.96, 0.98));
    drawText("ROBOTY ZIEMNE", margin + 10, y - 8, { size: 10, font: fontBold, color: primaryColor });
    y -= 30;

    drawText(`Wykop: ${formatNumber(data.excavation.volume)} m³ × ${formatPrice(data.excavation.pricePerM3)}/m³`, margin, y, { size: 10, color: darkText });
    drawTextRight(formatPrice(data.excavation.excavationTotal), pageWidth - margin, y, { size: 10, font: fontBold, color: darkText });
    y -= 16;

    drawText("Wywóz ziemi (ryczałt)", margin, y, { size: 10, color: darkText });
    drawTextRight(formatPrice(data.excavation.removalFixedPrice), pageWidth - margin, y, { size: 10, font: fontBold, color: darkText });
    y -= 30;

    // === SUMMARY ===
    checkPageBreak(120);

    const vatRate = data.totals.vatRate ?? 23;
    const summaryBoxHeight = data.totals.inneTotal ? 90 : 75;
    
    drawRect(margin, y - summaryBoxHeight, contentWidth, summaryBoxHeight, rgb(0.97, 0.98, 1));
    
    const summaryCol1 = margin + 20;
    const summaryCol2 = pageWidth - margin - 20;
    let summaryY = y - 18;

    drawText("Produkty i usługi:", summaryCol1, summaryY, { size: 10, color: grayText });
    drawTextRight(formatPrice(data.totals.productsTotal), summaryCol2, summaryY, { size: 10, color: darkText });
    summaryY -= 16;

    if (data.totals.inneTotal) {
      drawText("Inne:", summaryCol1, summaryY, { size: 10, color: grayText });
      drawTextRight(formatPrice(data.totals.inneTotal), summaryCol2, summaryY, { size: 10, color: darkText });
      summaryY -= 16;
    }

    drawText("Roboty ziemne:", summaryCol1, summaryY, { size: 10, color: grayText });
    drawTextRight(formatPrice(data.totals.excavationTotal), summaryCol2, summaryY, { size: 10, color: darkText });
    summaryY -= 12;

    page.drawLine({
      start: { x: summaryCol1, y: summaryY },
      end: { x: summaryCol2, y: summaryY },
      thickness: 0.5,
      color: rgb(0.8, 0.8, 0.8),
    });
    summaryY -= 14;

    drawText("RAZEM NETTO:", summaryCol1, summaryY, { size: 11, font: fontBold, color: darkText });
    drawTextRight(formatPrice(data.totals.grandTotalNet), summaryCol2, summaryY, { size: 11, font: fontBold, color: darkText });
    summaryY -= 16;

    drawText(`+ VAT ${vatRate}%:`, summaryCol1, summaryY, { size: 10, color: grayText });
    drawTextRight(formatPrice(data.totals.vatAmount), summaryCol2, summaryY, { size: 10, color: grayText });

    y -= summaryBoxHeight + 15;

    // Grand total bar
    drawRect(margin, y - 28, contentWidth, 28, primaryColor);
    drawText("RAZEM BRUTTO:", margin + 20, y - 18, { size: 12, font: fontBold, color: rgb(1, 1, 1) });
    drawTextRight(formatPrice(data.totals.grandTotalGross), pageWidth - margin - 20, y - 18, { size: 12, font: fontBold, color: rgb(1, 1, 1) });

    y -= 50;

    // === OPTIONS SECTION ===
    if (data.options && data.options.length > 0) {
      checkPageBreak(40 + data.options.length * 18);

      drawRect(margin, y - 12, contentWidth, 18, rgb(1, 0.95, 0.88));
      drawText("OPCJE DODATKOWE", margin + 10, y - 8, { size: 10, font: fontBold, color: accentColor });
      y -= 30;

      for (const option of data.options) {
        checkPageBreak(20);

        drawText(option.name, margin, y, { size: 9, color: darkText, maxWidth: contentWidth - 120 });
        drawText(`${option.quantity} szt.`, pageWidth - margin - 100, y, { size: 9, color: grayText });
        
        const priceStr = option.priceDifference >= 0 
          ? `+${formatPrice(option.priceDifference)}` 
          : formatPrice(option.priceDifference);
        drawTextRight(priceStr, pageWidth - margin, y, { size: 9, font: fontBold, color: accentColor });

        y -= 16;
      }

      y -= 15;
    }

    // === NOTES AND PAYMENT TERMS ===
    if (data.notes || data.paymentTerms) {
      checkPageBreak(60);
      
      if (data.notes) {
        drawText("UWAGI:", margin, y, { size: 10, font: fontBold, color: primaryColor });
        y -= 14;
        
        // Simple word wrap
        const words = data.notes.split(' ');
        let line = '';
        for (const word of words) {
          const testLine = line + (line ? ' ' : '') + word;
          if (getTextWidth(testLine, fontRegular, 9) > contentWidth) {
            drawText(line, margin, y, { size: 9, color: darkText });
            y -= 12;
            line = word;
          } else {
            line = testLine;
          }
        }
        if (line) {
          drawText(line, margin, y, { size: 9, color: darkText });
          y -= 12;
        }
        y -= 10;
      }

      if (data.paymentTerms) {
        checkPageBreak(40);
        drawText("WARUNKI PŁATNOŚCI:", margin, y, { size: 10, font: fontBold, color: primaryColor });
        y -= 14;
        
        const words = data.paymentTerms.split(' ');
        let line = '';
        for (const word of words) {
          const testLine = line + (line ? ' ' : '') + word;
          if (getTextWidth(testLine, fontRegular, 9) > contentWidth) {
            drawText(line, margin, y, { size: 9, color: darkText });
            y -= 12;
            line = word;
          } else {
            line = testLine;
          }
        }
        if (line) {
          drawText(line, margin, y, { size: 9, color: darkText });
          y -= 12;
        }
      }
    }

    // === FOOTER ===
    checkPageBreak(35);
    
    y -= 10;
    drawLine(y, primaryColor);
    y -= 15;
    
    const footerText = `${data.companySettings.name} | ${data.companySettings.website} | ${data.companySettings.phone}`;
    const footerWidth = getTextWidth(footerText, fontRegular, 9);
    drawText(footerText, (pageWidth - footerWidth) / 2, y, { size: 9, color: primaryColor });

    // Generate PDF and return as base64 JSON (works reliably with functions.invoke)
    const pdfBytes = await pdfDoc.save();
    const pdfBase64 = encodeBase64(
      pdfBytes.buffer.slice(pdfBytes.byteOffset, pdfBytes.byteOffset + pdfBytes.byteLength) as ArrayBuffer,
    );

    const safeOffer = (data.offerNumber || "oferta").replace(/[^0-9A-Za-z._-]+/g, "-");
    const safeCustomer = (data.customerData?.contactPerson || "klient").replace(/[^0-9A-Za-z._-]+/g, "-");
    const filename = `Oferta_${safeOffer}_${safeCustomer}.pdf`;

    console.log("PDF generated successfully");

    return new Response(JSON.stringify({ pdfBase64, filename }), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Error generating PDF:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
