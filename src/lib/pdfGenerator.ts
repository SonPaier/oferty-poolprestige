import jsPDF from 'jspdf';
import { SavedOffer } from '@/types/offers';
import { ConfiguratorState, CompanySettings } from '@/types/configurator';
import { getPriceInPLN } from '@/data/products';
import { ExcavationSettings, calculateExcavation, generateOfferNumber } from '@/types/offers';

const VAT_RATE = 0.08;

interface GeneratePDFParams {
  state: ConfiguratorState;
  companySettings: CompanySettings;
  excavationSettings: ExcavationSettings;
  offerNumber?: string;
}

export function generateOfferPDF({
  state,
  companySettings,
  excavationSettings,
  offerNumber,
}: GeneratePDFParams): void {
  const doc = new jsPDF();
  const { customerData, dimensions, calculations, sections, poolType } = state;
  const excavation = calculateExcavation(dimensions, excavationSettings);
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = 20;
  
  // Helper functions
  const addText = (text: string, x: number, yPos: number, options?: { fontSize?: number; fontStyle?: string; color?: number[] }) => {
    doc.setFontSize(options?.fontSize || 10);
    if (options?.fontStyle) {
      doc.setFont('helvetica', options.fontStyle);
    } else {
      doc.setFont('helvetica', 'normal');
    }
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
  
  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
    }).format(price);
  };
  
  const checkPageBreak = (requiredSpace: number) => {
    if (y + requiredSpace > 280) {
      doc.addPage();
      y = 20;
    }
  };

  // === HEADER ===
  addText('POOL PRESTIGE', margin, y, { fontSize: 24, fontStyle: 'bold', color: [0, 150, 180] });
  y += 8;
  addText(companySettings.name, margin, y, { fontSize: 10 });
  y += 5;
  addText(`${companySettings.address}, ${companySettings.postalCode} ${companySettings.city}`, margin, y, { fontSize: 9, color: [100, 100, 100] });
  y += 4;
  addText(`Tel: ${companySettings.phone} | Email: ${companySettings.email}`, margin, y, { fontSize: 9, color: [100, 100, 100] });
  y += 4;
  addText(`NIP: ${companySettings.nip}`, margin, y, { fontSize: 9, color: [100, 100, 100] });
  
  // Offer number and date on the right
  const currentOfferNumber = offerNumber || generateOfferNumber();
  const currentDate = new Date().toLocaleDateString('pl-PL', { year: 'numeric', month: 'long', day: 'numeric' });
  addText(`Oferta nr: ${currentOfferNumber}`, pageWidth - margin - 60, 20, { fontSize: 10, fontStyle: 'bold' });
  addText(`Data: ${currentDate}`, pageWidth - margin - 60, 26, { fontSize: 9, color: [100, 100, 100] });
  
  y += 10;
  addLine(y);
  y += 10;

  // === CUSTOMER DATA ===
  addText('DANE KLIENTA', margin, y, { fontSize: 12, fontStyle: 'bold', color: [0, 100, 120] });
  y += 8;
  addText(customerData.contactPerson, margin, y, { fontSize: 11, fontStyle: 'bold' });
  y += 5;
  if (customerData.companyName) {
    addText(customerData.companyName, margin, y, { fontSize: 10 });
    y += 5;
  }
  if (customerData.nip) {
    addText(`NIP: ${customerData.nip}`, margin, y, { fontSize: 9, color: [80, 80, 80] });
    y += 5;
  }
  addText(`Tel: ${customerData.phone}`, margin, y, { fontSize: 9, color: [80, 80, 80] });
  if (customerData.email) {
    addText(`Email: ${customerData.email}`, margin + 60, y, { fontSize: 9, color: [80, 80, 80] });
  }
  y += 5;
  if (customerData.address || customerData.city) {
    addText(`${customerData.address}, ${customerData.postalCode} ${customerData.city}`, margin, y, { fontSize: 9, color: [80, 80, 80] });
    y += 5;
  }
  
  y += 8;
  addLine(y);
  y += 10;

  // === POOL PARAMETERS ===
  addText('PARAMETRY BASENU', margin, y, { fontSize: 12, fontStyle: 'bold', color: [0, 100, 120] });
  y += 8;
  
  const poolTypeLabels: Record<string, string> = {
    prywatny: 'Prywatny',
    polprywatny: 'Polprywatny',
    hotelowy: 'Hotelowy / Publiczny',
  };
  
  const col1 = margin;
  const col2 = margin + 50;
  const col3 = margin + 100;
  
  addText('Typ basenu:', col1, y, { fontSize: 9, color: [80, 80, 80] });
  addText(poolTypeLabels[poolType] || poolType, col1, y + 4, { fontSize: 10, fontStyle: 'bold' });
  
  addText('Wymiary:', col2, y, { fontSize: 9, color: [80, 80, 80] });
  addText(`${dimensions.length} x ${dimensions.width} m`, col2, y + 4, { fontSize: 10, fontStyle: 'bold' });
  
  addText('Glebokosc:', col3, y, { fontSize: 9, color: [80, 80, 80] });
  addText(`${dimensions.depth} m`, col3, y + 4, { fontSize: 10, fontStyle: 'bold' });
  
  y += 12;
  
  addText('Objetosc:', col1, y, { fontSize: 9, color: [80, 80, 80] });
  addText(`${calculations?.volume.toFixed(1)} m3`, col1, y + 4, { fontSize: 10, fontStyle: 'bold' });
  
  addText('Wydajnosc filtracji:', col2, y, { fontSize: 9, color: [80, 80, 80] });
  addText(`${calculations?.requiredFlow.toFixed(1)} m3/h`, col2, y + 4, { fontSize: 10, fontStyle: 'bold' });
  
  if (dimensions.isIrregular) {
    addText('Ksztalt nieregularny:', col3, y, { fontSize: 9, color: [80, 80, 80] });
    addText(`+${companySettings.irregularSurchargePercent}%`, col3, y + 4, { fontSize: 10, fontStyle: 'bold', color: [200, 120, 0] });
  }
  
  y += 15;
  addLine(y);
  y += 10;

  // === SECTIONS WITH PRODUCTS ===
  const sectionLabels: Record<string, string> = {
    wykonczenie: 'WYKONCZENIE BASENU',
    uzbrojenie: 'UZBROJENIE NIECKI',
    filtracja: 'FILTRACJA',
    oswietlenie: 'OSWIETLENIE',
    automatyka: 'AUTOMATYKA',
    atrakcje: 'ATRAKCJE',
    dodatki: 'DODATKI',
  };
  
  let productsTotal = 0;
  
  Object.entries(sections).forEach(([key, section]) => {
    if (section.items.length === 0) return;
    
    checkPageBreak(30);
    
    addText(sectionLabels[key] || key.toUpperCase(), margin, y, { fontSize: 11, fontStyle: 'bold', color: [0, 100, 120] });
    y += 7;
    
    section.items.forEach(item => {
      checkPageBreak(15);
      
      const price = item.customPrice || getPriceInPLN(item.product);
      const itemTotal = price * item.quantity;
      productsTotal += itemTotal;
      
      // Product name
      const productName = item.product.name.length > 60 
        ? item.product.name.substring(0, 57) + '...' 
        : item.product.name;
      addText(productName, margin, y, { fontSize: 9 });
      
      // Quantity and price on the right
      addText(`${item.quantity} szt.`, pageWidth - margin - 55, y, { fontSize: 9, color: [80, 80, 80] });
      addText(formatPrice(itemTotal), pageWidth - margin - 25, y, { fontSize: 9, fontStyle: 'bold' });
      
      y += 5;
    });
    
    y += 5;
  });
  
  // === EXCAVATION ===
  checkPageBreak(40);
  addLine(y);
  y += 10;
  
  addText('ROBOTY ZIEMNE', margin, y, { fontSize: 11, fontStyle: 'bold', color: [0, 100, 120] });
  y += 7;
  
  const excLength = dimensions.length + (excavationSettings.marginWidth * 2);
  const excWidth = dimensions.width + (excavationSettings.marginWidth * 2);
  const excDepth = dimensions.depth + excavationSettings.marginDepth;
  
  addText(`Wykop: ${excLength.toFixed(1)} x ${excWidth.toFixed(1)} x ${excDepth.toFixed(1)} m = ${excavation.excavationVolume.toFixed(1)} m3`, margin, y, { fontSize: 9 });
  addText(formatPrice(excavation.excavationTotal), pageWidth - margin - 25, y, { fontSize: 9, fontStyle: 'bold' });
  y += 5;
  
  addText('Wywoz ziemi (ryczalt)', margin, y, { fontSize: 9 });
  addText(formatPrice(excavation.removalFixedPrice), pageWidth - margin - 25, y, { fontSize: 9, fontStyle: 'bold' });
  y += 8;
  
  const excavationTotal = excavation.excavationTotal + excavation.removalFixedPrice;

  // === SUMMARY ===
  checkPageBreak(50);
  y += 5;
  addLine(y);
  y += 10;
  
  const grandTotalNet = productsTotal + excavationTotal;
  const vatAmount = grandTotalNet * VAT_RATE;
  const grandTotalGross = grandTotalNet + vatAmount;
  
  // Summary box
  doc.setFillColor(245, 250, 255);
  doc.rect(margin, y - 3, pageWidth - (margin * 2), 35, 'F');
  
  addText('Produkty i uslugi:', margin + 5, y + 3, { fontSize: 10, color: [80, 80, 80] });
  addText(formatPrice(productsTotal), pageWidth - margin - 30, y + 3, { fontSize: 10 });
  
  addText('Roboty ziemne:', margin + 5, y + 10, { fontSize: 10, color: [80, 80, 80] });
  addText(formatPrice(excavationTotal), pageWidth - margin - 30, y + 10, { fontSize: 10 });
  
  addText('RAZEM NETTO:', margin + 5, y + 18, { fontSize: 11, fontStyle: 'bold' });
  addText(formatPrice(grandTotalNet), pageWidth - margin - 30, y + 18, { fontSize: 11, fontStyle: 'bold' });
  
  addText(`+ VAT 8%:`, margin + 5, y + 25, { fontSize: 10, color: [80, 80, 80] });
  addText(formatPrice(vatAmount), pageWidth - margin - 30, y + 25, { fontSize: 10, color: [80, 80, 80] });
  
  y += 40;
  
  // Grand total
  doc.setFillColor(0, 150, 180);
  doc.rect(margin, y - 3, pageWidth - (margin * 2), 15, 'F');
  
  addText('RAZEM BRUTTO:', margin + 5, y + 6, { fontSize: 14, fontStyle: 'bold', color: [255, 255, 255] });
  addText(formatPrice(grandTotalGross), pageWidth - margin - 35, y + 6, { fontSize: 14, fontStyle: 'bold', color: [255, 255, 255] });
  
  y += 25;

  // === FOOTER ===
  checkPageBreak(30);
  addText('Oferta wazna 30 dni od daty wystawienia.', margin, y, { fontSize: 8, color: [100, 100, 100] });
  y += 4;
  addText('Ceny nie zawieraja kosztow transportu i montazu, chyba ze zaznaczono inaczej.', margin, y, { fontSize: 8, color: [100, 100, 100] });
  y += 8;
  addText(`${companySettings.name} | ${companySettings.website}`, margin, y, { fontSize: 8, color: [0, 100, 120] });

  // Save PDF
  const fileName = `Oferta_${currentOfferNumber.replace(/\//g, '-')}_${customerData.contactPerson.replace(/\s+/g, '_')}.pdf`;
  doc.save(fileName);
}
