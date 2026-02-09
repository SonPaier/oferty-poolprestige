import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

interface MaterialsExportButtonProps {
  materials: MaterialRow[];
  title: string;
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
    // Load NotoSans from the edge function folder via fetch
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

async function exportToPDF(materials: MaterialRow[], title: string, includePrice: boolean) {
  const doc = new jsPDF();
  const margin = 20;
  let y = 20;
  const pw = doc.internal.pageSize.getWidth();

  // Try to load NotoSans for Polish support, fall back to Helvetica with stripped diacritics
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

  doc.setFontSize(9);
  doc.setFont(font, 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Lp.', margin, y);
  doc.text(t('Materiał'), margin + 12, y);
  doc.text(t('Ilość'), pw - margin - (includePrice ? 70 : 20), y, { align: 'right' });
  doc.text('Jed.', pw - margin - (includePrice ? 50 : 5), y);
  if (includePrice) {
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
    doc.text(m.quantity.toString(), pw - margin - (includePrice ? 70 : 20), y, { align: 'right' });
    doc.text(t(m.unit), pw - margin - (includePrice ? 50 : 5), y);
    if (includePrice && m.rate !== undefined && m.total !== undefined) {
      doc.text(`${m.rate.toFixed(2)} zl`, pw - margin - 25, y, { align: 'right' });
      doc.text(`${m.total.toFixed(2)} zl`, pw - margin, y, { align: 'right' });
    }
    y += 6;
  });

  if (includePrice) {
    y += 2;
    doc.line(margin, y, pw - margin, y);
    y += 6;
    doc.setFont(font, 'bold');
    const total = materials.reduce((s, m) => s + (m.total ?? 0), 0);
    doc.text('RAZEM NETTO:', pw - margin - 40, y);
    doc.text(`${total.toFixed(2)} zl`, pw - margin, y, { align: 'right' });
  }

  doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
  toast.success('Wyeksportowano do PDF');
}

function exportToXLSX(materials: MaterialRow[], title: string, includePrice: boolean) {
  const rows = materials.map((m, i) => {
    const row: Record<string, string | number> = {
      'Lp.': i + 1,
      'Materiał': m.name,
      'Ilość': m.quantity,
      'Jednostka': m.unit,
    };
    if (includePrice) {
      row['Cena/jed. (zł)'] = m.rate ?? 0;
      row['Razem (zł)'] = m.total ?? 0;
    }
    return row;
  });

  if (includePrice) {
    const total = materials.reduce((s, m) => s + (m.total ?? 0), 0);
    rows.push({ 'Lp.': '', 'Materiał': 'RAZEM NETTO', 'Ilość': '' as any, 'Jednostka': '', 'Cena/jed. (zł)': '', 'Razem (zł)': total } as any);
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  // Auto-size columns
  const colWidths = Object.keys(rows[0] || {}).map(key => ({
    wch: Math.max(key.length, ...rows.map(r => String(r[key] ?? '').length)) + 2
  }));
  ws['!cols'] = colWidths;

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Materiały');
  XLSX.writeFile(wb, `${title.replace(/\s+/g, '_')}.xlsx`);
  toast.success('Wyeksportowano do Excel');
}

export function MaterialsExportButton({ materials, title }: MaterialsExportButtonProps) {
  if (materials.length === 0) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Eksport materiałów
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuLabel>PDF</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => exportToPDF(materials, title, false)}>
          Tylko ilości
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToPDF(materials, title, true)}>
          Ilości i ceny
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Excel (XLSX)</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => exportToXLSX(materials, title, false)}>
          Tylko ilości
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToXLSX(materials, title, true)}>
          Ilości i ceny
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
