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
}

// Polish character mapping for Helvetica (which doesn't support them)
const polishMap: Record<string, string> = {
  'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z',
  'Ą': 'A', 'Ć': 'C', 'Ę': 'E', 'Ł': 'L', 'Ń': 'N', 'Ó': 'O', 'Ś': 'S', 'Ź': 'Z', 'Ż': 'Z',
};

function stripPolish(str: string): string {
  return str.replace(/[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/g, ch => polishMap[ch] || ch);
}

async function loadNotoSansFont(doc: jsPDF) {
  try {
    const regularResponse = await fetch('/supabase/functions/generate-pdf/NotoSans-Regular.ttf');
    if (regularResponse.ok) {
      const buffer = await regularResponse.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
      doc.addFileToVFS('NotoSans-Regular.ttf', base64);
      doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');

      const boldResponse = await fetch('/supabase/functions/generate-pdf/NotoSans-Bold.ttf');
      if (boldResponse.ok) {
        const boldBuffer = await boldResponse.arrayBuffer();
        const boldBase64 = btoa(String.fromCharCode(...new Uint8Array(boldBuffer)));
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

interface ExportOptions {
  includeQuantity: boolean;
  includePrice: boolean;
  includeNotes: boolean;
  includeExcavationParams: boolean;
  includeCustomer: boolean;
}

async function exportToPDF(
  materials: MaterialRow[],
  title: string,
  options: ExportOptions,
  notes?: string,
  excavationParams?: ExcavationParams,
  customer?: CustomerInfo,
) {
  const doc = new jsPDF();
  const margin = 20;
  let y = 20;
  const pw = doc.internal.pageSize.getWidth();

  const fontName = await loadNotoSansFont(doc);
  const usePolishFont = !!fontName;
  const font = fontName || 'helvetica';
  const t = (s: string) => usePolishFont ? s : stripPolish(s);

  doc.setFontSize(14);
  doc.setFont(font, 'bold');
  doc.text(t(title), margin, y);
  y += 10;

  doc.setFontSize(8);
  doc.setFont(font, 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`Eksport: ${new Date().toLocaleDateString('pl-PL')}`, margin, y);
  y += 8;
  doc.setTextColor(0, 0, 0);

  // Customer section
  if (options.includeCustomer && customer) {
    doc.setFontSize(10);
    doc.setFont(font, 'bold');
    doc.text(t('Klient'), margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont(font, 'normal');
    if (customer.companyName) { doc.text(t(customer.companyName), margin, y); y += 4.5; }
    if (customer.contactPerson) { doc.text(t(customer.contactPerson), margin, y); y += 4.5; }
    if (customer.email) { doc.text(customer.email, margin, y); y += 4.5; }
    if (customer.phone) { doc.text(customer.phone, margin, y); y += 4.5; }
    const addr = [customer.address, customer.postalCode, customer.city].filter(Boolean).join(', ');
    if (addr) { doc.text(t(addr), margin, y); y += 4.5; }
    if (customer.nip) { doc.text(`NIP: ${customer.nip}`, margin, y); y += 4.5; }
    y += 4;
  }

  // Excavation params section
  if (options.includeExcavationParams && excavationParams) {
    doc.setFontSize(10);
    doc.setFont(font, 'bold');
    doc.text(t('Parametry wykopu'), margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont(font, 'normal');
    const ep = excavationParams;
    const params = [
      `Basen: ${ep.poolLength} x ${ep.poolWidth} x ${ep.poolDepth} m`,
      `Wykop: ${ep.excLength.toFixed(2)} x ${ep.excWidth.toFixed(2)} x ${ep.excDepth.toFixed(2)} m`,
      `${t('Podsypka')}: ${ep.sandBeddingHeight * 100} cm`,
      `Chudziak: ${ep.leanConcreteHeight * 100} cm`,
      `${t('Płyta denna')}: ${ep.floorSlabThickness * 100} cm`,
    ];
    params.forEach(p => { doc.text(t(p), margin, y); y += 4.5; });
    y += 4;
  }

  // Materials table
  if (options.includeQuantity) {
    const showPrice = options.includePrice;

    doc.setFontSize(9);
    doc.setFont(font, 'bold');
    doc.text('Lp.', margin, y);
    doc.text(t('Materiał'), margin + 12, y);
    doc.text(t('Ilość'), pw - margin - (showPrice ? 70 : 20), y, { align: 'right' });
    doc.text('Jed.', pw - margin - (showPrice ? 50 : 5), y);
    if (showPrice) {
      doc.text('Cena/jed.', pw - margin - 25, y, { align: 'right' });
      doc.text('Razem', pw - margin, y, { align: 'right' });
    }
    y += 2;
    doc.setDrawColor(180, 180, 180);
    doc.line(margin, y, pw - margin, y);
    y += 5;

    doc.setFont(font, 'normal');
    doc.setFontSize(9);
    materials.forEach((m, i) => {
      if (y > 275) { doc.addPage(); y = 20; }
      doc.text(`${i + 1}.`, margin, y);
      const name = m.name.length > 50 ? m.name.substring(0, 47) + '...' : m.name;
      doc.text(t(name), margin + 12, y);
      doc.text(m.quantity.toString(), pw - margin - (showPrice ? 70 : 20), y, { align: 'right' });
      doc.text(t(m.unit), pw - margin - (showPrice ? 50 : 5), y);
      if (showPrice && m.rate !== undefined && m.total !== undefined) {
        doc.text(`${m.rate.toFixed(2)} zl`, pw - margin - 25, y, { align: 'right' });
        doc.text(`${m.total.toFixed(2)} zl`, pw - margin, y, { align: 'right' });
      }
      y += 6;
    });

    if (showPrice) {
      y += 2;
      doc.line(margin, y, pw - margin, y);
      y += 6;
      doc.setFont(font, 'bold');
      const total = materials.reduce((s, m) => s + (m.total ?? 0), 0);
      doc.text('RAZEM NETTO:', pw - margin - 40, y);
      doc.text(`${total.toFixed(2)} zl`, pw - margin, y, { align: 'right' });
      y += 8;
    }
  }

  // Notes section
  if (options.includeNotes && notes) {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFontSize(10);
    doc.setFont(font, 'bold');
    doc.text(t('Uwagi'), margin, y);
    y += 5;
    doc.setFontSize(9);
    doc.setFont(font, 'normal');
    const lines = doc.splitTextToSize(t(notes), pw - margin * 2);
    doc.text(lines, margin, y);
  }

  doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
  toast.success('Wyeksportowano do PDF');
}

function exportToXLSX(
  materials: MaterialRow[],
  title: string,
  options: ExportOptions,
  notes?: string,
  excavationParams?: ExcavationParams,
  customer?: CustomerInfo,
) {
  const wb = XLSX.utils.book_new();

  // Materials sheet
  if (options.includeQuantity) {
    const rows = materials.map((m, i) => {
      const row: Record<string, string | number> = {
        'Lp.': i + 1,
        'Materiał': m.name,
        'Ilość': m.quantity,
        'Jednostka': m.unit,
      };
      if (options.includePrice) {
        row['Cena/jed. (zł)'] = m.rate ?? 0;
        row['Razem (zł)'] = m.total ?? 0;
      }
      return row;
    });

    if (options.includePrice) {
      const total = materials.reduce((s, m) => s + (m.total ?? 0), 0);
      rows.push({ 'Lp.': '', 'Materiał': 'RAZEM NETTO', 'Ilość': '' as any, 'Jednostka': '', 'Cena/jed. (zł)': '', 'Razem (zł)': total } as any);
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
    const wsP = XLSX.utils.json_to_sheet(paramRows);
    wsP['!cols'] = [{ wch: 28 }, { wch: 12 }];
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

  XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}.xlsx`);
  toast.success('Wyeksportowano do Excel');
}

export function MaterialsExportButton({ materials, title, notes, excavationParams, customer }: MaterialsExportButtonProps) {
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
    exportToPDF(materials, title, options, notes, excavationParams, customer);
    setOpen(false);
  };

  const handleExportXLSX = () => {
    exportToXLSX(materials, title, options, notes, excavationParams, customer);
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
