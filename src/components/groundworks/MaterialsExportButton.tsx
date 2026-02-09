import { useState } from 'react';
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

function exportToPDF(materials: MaterialRow[], title: string, includePrice: boolean) {
  const doc = new jsPDF();
  const margin = 20;
  let y = 20;
  const pw = doc.internal.pageSize.getWidth();

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(title, margin, y);
  y += 10;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120, 120, 120);
  doc.text(`Eksport: ${new Date().toLocaleDateString('pl-PL')}`, margin, y);
  y += 8;

  // Header
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Lp.', margin, y);
  doc.text('Materiał', margin + 12, y);
  doc.text('Ilość', pw - margin - (includePrice ? 70 : 20), y, { align: 'right' });
  doc.text('Jed.', pw - margin - (includePrice ? 50 : 5), y);
  if (includePrice) {
    doc.text('Cena/jed.', pw - margin - 25, y, { align: 'right' });
    doc.text('Razem', pw - margin, y, { align: 'right' });
  }
  y += 2;
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, y, pw - margin, y);
  y += 5;

  // Rows
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  materials.forEach((m, i) => {
    if (y > 275) { doc.addPage(); y = 20; }
    doc.text(`${i + 1}.`, margin, y);
    const maxNameWidth = includePrice ? 80 : 110;
    const name = m.name.length > 50 ? m.name.substring(0, 47) + '...' : m.name;
    doc.text(name, margin + 12, y);
    doc.text(m.quantity.toString(), pw - margin - (includePrice ? 70 : 20), y, { align: 'right' });
    doc.text(m.unit, pw - margin - (includePrice ? 50 : 5), y);
    if (includePrice && m.rate !== undefined && m.total !== undefined) {
      doc.text(`${m.rate.toFixed(2)} zł`, pw - margin - 25, y, { align: 'right' });
      doc.text(`${m.total.toFixed(2)} zł`, pw - margin, y, { align: 'right' });
    }
    y += 6;
  });

  if (includePrice) {
    y += 2;
    doc.line(margin, y, pw - margin, y);
    y += 6;
    doc.setFont('helvetica', 'bold');
    const total = materials.reduce((s, m) => s + (m.total ?? 0), 0);
    doc.text('RAZEM NETTO:', pw - margin - 40, y);
    doc.text(`${total.toFixed(2)} zł`, pw - margin, y, { align: 'right' });
  }

  doc.save(`${title.replace(/\s+/g, '_')}.pdf`);
  toast.success('Wyeksportowano do PDF');
}

function exportToXML(materials: MaterialRow[], title: string, includePrice: boolean) {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<materialy title="${escapeXml(title)}" data="${new Date().toISOString().split('T')[0]}">\n`;
  materials.forEach(m => {
    xml += '  <material>\n';
    xml += `    <nazwa>${escapeXml(m.name)}</nazwa>\n`;
    xml += `    <ilosc>${m.quantity}</ilosc>\n`;
    xml += `    <jednostka>${escapeXml(m.unit)}</jednostka>\n`;
    if (includePrice && m.rate !== undefined) {
      xml += `    <cena_jednostkowa>${m.rate.toFixed(2)}</cena_jednostkowa>\n`;
      xml += `    <razem>${(m.total ?? 0).toFixed(2)}</razem>\n`;
    }
    xml += '  </material>\n';
  });
  xml += '</materialy>';

  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${title.replace(/\s+/g, '_')}.xml`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success('Wyeksportowano do XML');
}

function escapeXml(str: string) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
        <DropdownMenuLabel>XML</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => exportToXML(materials, title, false)}>
          Tylko ilości
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => exportToXML(materials, title, true)}>
          Ilości i ceny
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
