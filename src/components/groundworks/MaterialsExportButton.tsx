import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

interface MaterialRow {
  name: string;
  quantity: number;
  unit: string;
  rate?: number;
  total?: number;
}

export interface ExcavationParams {
  excLength: number;
  excWidth: number;
  excDepth: number;
  poolLength: number;
  poolWidth: number;
  poolDepth: number;
  sandBeddingHeight: number;
  leanConcreteHeight: number;
  floorSlabThickness: number;
  reusePercent?: number;
}

export interface CustomerInfo {
  companyName?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  nip?: string;
}

interface MaterialsExportButtonProps {
  materials: MaterialRow[];
  title: string;
  notes?: string;
  excavationParams?: ExcavationParams;
  customer?: CustomerInfo;
  offerNumber?: string | null;
}

// Round quantity to 2 decimal places for export
function roundForExport(qty: number): number {
  return Math.round(qty * 100) / 100;
}

function formatQty(qty: number): string {
  const r = roundForExport(qty);
  if (Number.isInteger(r)) return r.toString();
  return r.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
}

// Polish character mapping for Helvetica fallback
const polishMap: Record<string, string> = {
  'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
  'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
};

function stripPolish(str: string): string {
  return str.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, ch => polishMap[ch] || ch);
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function loadNotoSansFont(doc: jsPDF) {
  try {
    const regularResponse = await fetch('/supabase/functions/generate-pdf/NotoSans-Regular.ttf');
    if (regularResponse.ok) {
      const buffer = await regularResponse.arrayBuffer();
      const base64 = uint8ToBase64(new Uint8Array(buffer));
      doc.addFileToVFS('NotoSans-Regular.ttf', base64);
      doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');

      const boldResponse = await fetch('/supabase/functions/generate-pdf/NotoSans-Bold.ttf');
      if (boldResponse.ok) {
        const boldBuffer = await boldResponse.arrayBuffer();
        const boldBase64 = uint8ToBase64(new Uint8Array(boldBuffer));
        doc.addFileToVFS('NotoSans-Bold.ttf', boldBase64);
        doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');
      }
      return 'NotoSans';
    }
  } catch {
    // fallback
  }
  return null;
}

async function loadLogo(): Promise<string | null> {
  try {
    const response = await fetch('/logo.png');
    if (response.ok) {
      const buffer = await response.arrayBuffer();
      return 'data:image/png;base64,' + uint8ToBase64(new Uint8Array(buffer));
    }
  } catch { /* ignore */ }
  return null;
}

interface ExportOptions {
  includeQuantity: boolean;
  includePrice: boolean;
  includeNotes: boolean;
  includeExcavationParams: boolean;
  includeCustomer: boolean;
}

// Brand colors (aqua teal theme)
const BRAND = {
  primary: [0, 139, 160] as [number, number, number],     // hsl(190,80%,42%) approx
  primaryLight: [230, 247, 250] as [number, number, number],
  dark: [30, 42, 56] as [number, number, number],
  gray: [120, 130, 140] as [number, number, number],
  lightGray: [235, 240, 245] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
};

async function exportToPDF(
  materials: MaterialRow[],
  title: string,
  options: ExportOptions,
  notes?: string,
  excavationParams?: ExcavationParams,
  customer?: CustomerInfo,
  offerNumber?: string | null,
) {
  const doc = new jsPDF();
  const margin = 18;
  let y = 16;
  const pw = doc.internal.pageSize.getWidth();
  const contentW = pw - margin * 2;

  const fontName = await loadNotoSansFont(doc);
  const usePolishFont = !!fontName;
  const font = fontName || 'helvetica';
  const t = (s: string) => usePolishFont ? s : stripPolish(s);

  const logo = await loadLogo();

  // ── Header bar ──
  const headerH = 22;
  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, pw, headerH, 'F');

  let logoEndX = margin;
  if (logo) {
    // Load image to get natural dimensions for aspect ratio
    const img = new Image();
    img.src = logo;
    await new Promise<void>((resolve) => { img.onload = () => resolve(); img.onerror = () => resolve(); });
    const naturalW = img.naturalWidth || 1;
    const naturalH = img.naturalHeight || 1;
    const logoH = 14;
    const logoW = (naturalW / naturalH) * logoH;
    // Use high-quality rendering by specifying original pixel dimensions
    const imgProps: any = { compression: 'NONE' };
    doc.addImage(logo, 'PNG', margin, (headerH - logoH) / 2, logoW, logoH, undefined, undefined, undefined);
    logoEndX = margin + logoW + 4;
  }

  doc.setFontSize(14);
  doc.setFont(font, 'bold');
  doc.setTextColor(...BRAND.white);
  doc.text(t(title), logoEndX, headerH / 2 + 2);

  doc.setFontSize(8);
  doc.setFont(font, 'normal');
  doc.text(`Eksport: ${new Date().toLocaleDateString('pl-PL')}`, pw - margin, headerH / 2 + 2, { align: 'right' });
  y = headerH + 8;
  doc.setTextColor(...BRAND.dark);

  // ── Customer section ──
  if (options.includeCustomer && customer) {
    doc.setFillColor(...BRAND.primaryLight);
    doc.roundedRect(margin, y, contentW, 32, 2, 2, 'F');

    doc.setFontSize(10);
    doc.setFont(font, 'bold');
    doc.setTextColor(...BRAND.primary);
    doc.text(t('Klient'), margin + 4, y + 6);
    doc.setFont(font, 'normal');
    doc.setTextColor(...BRAND.dark);
    doc.setFontSize(8.5);

    let cy = y + 12;
    const leftCol = margin + 4;
    const rightCol = margin + contentW / 2;

    if (customer.companyName) { doc.text(t(customer.companyName), leftCol, cy); }
    if (customer.contactPerson) { doc.text(t(customer.contactPerson), leftCol, cy + 4.5); }
    if (customer.email) { doc.text(customer.email, rightCol, cy); }
    if (customer.phone) { doc.text(customer.phone, rightCol, cy + 4.5); }
    const addr = [customer.address, customer.postalCode, customer.city].filter(Boolean).join(', ');
    if (addr) { doc.text(t(addr), leftCol, cy + 9); }
    if (customer.nip) { doc.text(`NIP: ${customer.nip}`, rightCol, cy + 9); }

    y += 36;
  }

  // ── Excavation params section ──
  if (options.includeExcavationParams && excavationParams) {
    doc.setFillColor(...BRAND.lightGray);
    doc.roundedRect(margin, y, contentW, 26, 2, 2, 'F');

    doc.setFontSize(9);
    doc.setFont(font, 'bold');
    doc.setTextColor(...BRAND.primary);
    doc.text(t('Parametry wykopu'), margin + 4, y + 6);

    doc.setFont(font, 'normal');
    doc.setTextColor(...BRAND.dark);
    doc.setFontSize(8);

    const ep = excavationParams;
    const col1 = margin + 4;
    const col2 = margin + contentW / 2;
    let py = y + 12;

    doc.text(`Basen: ${ep.poolLength} x ${ep.poolWidth} x ${ep.poolDepth} m`, col1, py);
    doc.text(`Wykop: ${ep.excLength.toFixed(2)} x ${ep.excWidth.toFixed(2)} x ${ep.excDepth.toFixed(2)} m`, col2, py);
    py += 4.5;
    doc.text(`${t('Podsypka')}: ${ep.sandBeddingHeight * 100} cm`, col1, py);
    doc.text(`Chudziak: ${ep.leanConcreteHeight * 100} cm`, col2, py);
    py += 4.5;
    doc.text(`${t('Płyta denna')}: ${ep.floorSlabThickness * 100} cm`, col1, py);
    if (ep.reusePercent !== undefined && ep.reusePercent > 0) {
      doc.text(`${t('Wykorzystanie gruntu')}: ${ep.reusePercent}%`, col2, py);
    }

    y += 30;
  }

  // ── Materials table ──
  if (options.includeQuantity) {
    const showPrice = options.includePrice;

    // Table header
    doc.setFillColor(...BRAND.primary);
    doc.rect(margin, y, contentW, 8, 'F');

    doc.setFontSize(8);
    doc.setFont(font, 'bold');
    doc.setTextColor(...BRAND.white);

    const colLp = margin + 3;
    const colName = margin + 14;
    const colQty = showPrice ? pw - margin - 72 : pw - margin - 28;
    const colUnit = showPrice ? pw - margin - 52 : pw - margin - 12;
    const colRate = pw - margin - 28;
    const colTotal = pw - margin - 3;

    const headerTextY = y + 4;
    doc.text('Lp.', colLp, headerTextY, { baseline: 'middle' });
    doc.text(t('Materiał'), colName, headerTextY, { baseline: 'middle' });
    doc.text(t('Ilość'), colQty, headerTextY, { align: 'right', baseline: 'middle' });
    doc.text('Jed.', colUnit - 4, headerTextY, { baseline: 'middle' });
    if (showPrice) {
      doc.text('Cena/jed.', colRate, headerTextY, { align: 'right', baseline: 'middle' });
      doc.text('Razem', colTotal, headerTextY, { align: 'right', baseline: 'middle' });
    }
    y += 10;

    doc.setTextColor(...BRAND.dark);
    doc.setFont(font, 'normal');
    doc.setFontSize(8);

    materials.forEach((m, i) => {
      if (y > 275) { doc.addPage(); y = 16; }

      // Alternating row background
      if (i % 2 === 0) {
        doc.setFillColor(...BRAND.lightGray);
        doc.rect(margin, y - 4, contentW, 7, 'F');
      }

      const rounded = roundForExport(m.quantity);
      const total = m.rate !== undefined ? rounded * m.rate : (m.total ?? 0);

      doc.text(`${i + 1}.`, colLp, y);
      const name = m.name.length > 45 ? m.name.substring(0, 42) + '...' : m.name;
      doc.text(t(name), colName, y);
      doc.text(formatQty(m.quantity), colQty, y, { align: 'right' });
      doc.text(t(m.unit), colUnit - 4, y);
      if (showPrice && m.rate !== undefined) {
        doc.text(`${m.rate.toFixed(2)} ${t('zł')}`, colRate, y, { align: 'right' });
        doc.text(`${total.toFixed(2)} ${t('zł')}`, colTotal, y, { align: 'right' });
      }
      y += 7;
    });

    if (showPrice) {
      // Total row
      doc.setFillColor(...BRAND.primary);
      doc.rect(margin, y - 2, contentW, 9, 'F');
      doc.setFont(font, 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...BRAND.white);
      const total = materials.reduce((s, m) => {
        const r = roundForExport(m.quantity);
        return s + (m.rate !== undefined ? r * m.rate : (m.total ?? 0));
      }, 0);
      const totalLabel = `RAZEM NETTO:  ${total.toFixed(2)} ${t('zł')}`;
      doc.text(totalLabel, colTotal, y + 4, { align: 'right' });
      y += 14;
      doc.setTextColor(...BRAND.dark);
    }
  }

  // ── Notes section ──
  if (options.includeNotes && notes) {
    if (y > 255) { doc.addPage(); y = 16; }
    y += 4;
    doc.setFillColor(...BRAND.primaryLight);
    const noteLines = doc.splitTextToSize(t(notes), contentW - 8);
    const noteH = Math.max(16, noteLines.length * 4 + 12);
    doc.roundedRect(margin, y, contentW, noteH, 2, 2, 'F');

    doc.setFontSize(9);
    doc.setFont(font, 'bold');
    doc.setTextColor(...BRAND.primary);
    doc.text(t('Uwagi'), margin + 4, y + 6);
    doc.setFont(font, 'normal');
    doc.setTextColor(...BRAND.dark);
    doc.setFontSize(8);
    doc.text(noteLines, margin + 4, y + 12);
  }

  // ── Footer ──
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const ph = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...BRAND.primary);
    doc.setLineWidth(0.5);
    doc.line(margin, ph - 12, pw - margin, ph - 12);
    doc.setFontSize(7);
    doc.setFont(font, 'normal');
    doc.setTextColor(...BRAND.gray);
    doc.text('Pool Prestige', margin, ph - 7);
    doc.text(`${i} / ${pageCount}`, pw - margin, ph - 7, { align: 'right' });
  }

  const fileName = offerNumber ? `${offerNumber}-${title}`.replace(/\s+/g, '_') : title.replace(/\s+/g, '_');
  doc.save(`${fileName}.pdf`);
  toast.success('Wyeksportowano do PDF');
}

function exportToXLSX(
  materials: MaterialRow[],
  title: string,
  options: ExportOptions,
  notes?: string,
  excavationParams?: ExcavationParams,
  customer?: CustomerInfo,
  offerNumber?: string | null,
) {
  const wb = XLSX.utils.book_new();

  // Materials sheet
  if (options.includeQuantity) {
    const rows = materials.map((m, i) => {
      const rounded = roundForExport(m.quantity);
      const row: Record<string, string | number> = {
        'Lp.': i + 1,
        'Materiał': m.name,
        'Ilość': rounded,
        'Jednostka': m.unit,
      };
      if (options.includePrice) {
        row['Cena/jed. (zł)'] = m.rate ?? 0;
        row['Razem (zł)'] = m.rate !== undefined ? Math.round(rounded * m.rate * 100) / 100 : (m.total ?? 0);
      }
      return row;
    });

    if (options.includePrice) {
      const total = materials.reduce((s, m) => {
        const r = roundForExport(m.quantity);
        return s + (m.rate !== undefined ? r * m.rate : (m.total ?? 0));
      }, 0);
      rows.push({ 'Lp.': '', 'Materiał': 'RAZEM NETTO', 'Ilość': '' as any, 'Jednostka': '', 'Cena/jed. (zł)': '', 'Razem (zł)': Math.round(total * 100) / 100 } as any);
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = Object.keys(rows[0] || {}).map(key => ({
      wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length)) + 2
    }));
    ws['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, ws, 'Materiały');
  }

  // Excavation params sheet
  if (options.includeExcavationParams && excavationParams) {
    const ep = excavationParams;
    const paramRows = [
      { 'Parametr': 'Basen - długość (m)', 'Wartość': ep.poolLength },
      { 'Parametr': 'Basen - szerokość (m)', 'Wartość': ep.poolWidth },
      { 'Parametr': 'Basen - głębokość (m)', 'Wartość': ep.poolDepth },
      { 'Parametr': 'Wykop - długość (m)', 'Wartość': Number(ep.excLength.toFixed(2)) },
      { 'Parametr': 'Wykop - szerokość (m)', 'Wartość': Number(ep.excWidth.toFixed(2)) },
      { 'Parametr': 'Wykop - głębokość (m)', 'Wartość': Number(ep.excDepth.toFixed(2)) },
      { 'Parametr': 'Podsypka (cm)', 'Wartość': ep.sandBeddingHeight * 100 },
      { 'Parametr': 'Chudziak (cm)', 'Wartość': ep.leanConcreteHeight * 100 },
      { 'Parametr': 'Płyta denna (cm)', 'Wartość': ep.floorSlabThickness * 100 },
    ];
    if (ep.reusePercent !== undefined && ep.reusePercent > 0) {
      paramRows.push({ 'Parametr': 'Wykorzystanie gruntu z wykopu (%)', 'Wartość': ep.reusePercent });
    }
    const wsP = XLSX.utils.json_to_sheet(paramRows);
    wsP['!cols'] = [{ wch: 34 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, wsP, 'Parametry wykopu');
  }

  // Customer sheet
  if (options.includeCustomer && customer) {
    const custRows = [
      { 'Pole': 'Firma', 'Wartość': customer.companyName || '' },
      { 'Pole': 'Osoba kontaktowa', 'Wartość': customer.contactPerson || '' },
      { 'Pole': 'Email', 'Wartość': customer.email || '' },
      { 'Pole': 'Telefon', 'Wartość': customer.phone || '' },
      { 'Pole': 'Adres', 'Wartość': customer.address || '' },
      { 'Pole': 'Miasto', 'Wartość': customer.city || '' },
      { 'Pole': 'Kod pocztowy', 'Wartość': customer.postalCode || '' },
      { 'Pole': 'NIP', 'Wartość': customer.nip || '' },
    ].filter(r => r['Wartość']);
    const wsC = XLSX.utils.json_to_sheet(custRows);
    wsC['!cols'] = [{ wch: 20 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsC, 'Klient');
  }

  // Notes sheet
  if (options.includeNotes && notes) {
    const wsN = XLSX.utils.json_to_sheet([{ 'Uwagi': notes }]);
    wsN['!cols'] = [{ wch: 80 }];
    XLSX.utils.book_append_sheet(wb, wsN, 'Uwagi');
  }

  const fileName = offerNumber ? `${offerNumber}-${title}`.replace(/\s+/g, '_') : title.replace(/\s+/g, '_');
  XLSX.writeFile(wb, `${fileName}.xlsx`);
  toast.success('Wyeksportowano do Excel');
}

export function MaterialsExportButton({ materials, title, notes, excavationParams, customer, offerNumber }: MaterialsExportButtonProps) {
  const [open, setOpen] = useState(false);
  const [includeQuantity, setIncludeQuantity] = useState(true);
  const [includePrice, setIncludePrice] = useState(false);
  const [includeNotes, setIncludeNotes] = useState(false);
  const [includeExcavationParams, setIncludeExcavationParams] = useState(false);
  const [includeCustomer, setIncludeCustomer] = useState(false);

  if (materials.length === 0) return null;

  const options: ExportOptions = {
    includeQuantity,
    includePrice,
    includeNotes,
    includeExcavationParams,
    includeCustomer,
  };

  const handleExportPDF = () => {
    exportToPDF(materials, title, options, notes, excavationParams, customer, offerNumber);
    setOpen(false);
  };

  const handleExportXLSX = () => {
    exportToXLSX(materials, title, options, notes, excavationParams, customer, offerNumber);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Eksport materiałów
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Eksport materiałów</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">Wybierz dane do uwzględnienia w eksporcie:</p>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Checkbox id="exp-qty" checked={includeQuantity} onCheckedChange={(v) => setIncludeQuantity(!!v)} />
              <Label htmlFor="exp-qty" className="cursor-pointer">Ilość</Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="exp-price" checked={includePrice} onCheckedChange={(v) => setIncludePrice(!!v)} />
              <Label htmlFor="exp-price" className="cursor-pointer">Cena</Label>
            </div>

            <Separator />

            <div className="flex items-center gap-2">
              <Checkbox
                id="exp-notes"
                checked={includeNotes}
                onCheckedChange={(v) => setIncludeNotes(!!v)}
                disabled={!notes}
              />
              <Label htmlFor="exp-notes" className={`cursor-pointer ${!notes ? 'text-muted-foreground' : ''}`}>
                Uwagi {!notes && '(brak)'}
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="exp-exc"
                checked={includeExcavationParams}
                onCheckedChange={(v) => setIncludeExcavationParams(!!v)}
                disabled={!excavationParams}
              />
              <Label htmlFor="exp-exc" className={`cursor-pointer ${!excavationParams ? 'text-muted-foreground' : ''}`}>
                Parametry wykopu {!excavationParams && '(niedostępne)'}
              </Label>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="exp-cust"
                checked={includeCustomer}
                onCheckedChange={(v) => setIncludeCustomer(!!v)}
                disabled={!customer}
              />
              <Label htmlFor="exp-cust" className={`cursor-pointer ${!customer ? 'text-muted-foreground' : ''}`}>
                Klient {!customer && '(brak danych)'}
              </Label>
            </div>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleExportXLSX} className="flex-1">
            Eksport XLSX
          </Button>
          <Button onClick={handleExportPDF} className="flex-1">
            Eksport PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
