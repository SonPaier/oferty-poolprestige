import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { supabase } from '@/integrations/supabase/client';

interface ProductRow {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  description: string;
  stock_quantity: number;
  image_id: string;
}

export default function ImportProducts() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{ inserted: number; total: number; errors?: string[] } | null>(null);

  const parseXlsx = async (file: File): Promise<ProductRow[]> => {
    const data = await file.arrayBuffer();
    const workbook = XLSX.read(data, { type: 'array' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];

    // Skip header row
    const products: ProductRow[] = [];
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || !row[0]) continue;

      // Column mapping from xlsx:
      // 0: Symbol, 1: Zdjęcie domyślne, 2: Nazwa, 3: Stan, 4: Grupa, 
      // 5: Działy sprzedaży, 6: Cena ewidencyjna, 7: Cena ewidencyjna (symbol), 8: Opis
      const symbol = String(row[0] || '').trim();
      const imageId = String(row[1] || '').trim();
      const name = String(row[2] || '').trim();
      const stockStr = String(row[3] || '0').replace(/\s/g, '').replace(',', '.');
      const priceStr = String(row[6] || '0').replace(/\s/g, '').replace(',', '.');
      const currency = String(row[7] || 'PLN').trim();
      const description = String(row[8] || '').trim();

      if (symbol) {
        products.push({
          symbol,
          name: name || symbol,
          price: parseFloat(priceStr) || 0,
          currency: currency === 'EUR' ? 'EUR' : 'PLN',
          description,
          stock_quantity: parseFloat(stockStr) || 0,
          image_id: imageId || '',
        });
      }
    }

    return products;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error('Wybierz plik xlsx');
      return;
    }

    setIsProcessing(true);
    setProgress(10);
    setResult(null);

    try {
      // Parse xlsx
      toast.info('Parsowanie pliku xlsx...');
      const products = await parseXlsx(file);
      setProgress(30);
      
      if (products.length === 0) {
        toast.error('Nie znaleziono produktów w pliku');
        setIsProcessing(false);
        return;
      }

      toast.info(`Znaleziono ${products.length} produktów. Importowanie...`);

      // Send to edge function
      const { data, error } = await supabase.functions.invoke('import-products', {
        body: { products },
      });

      setProgress(100);

      if (error) {
        throw new Error(error.message);
      }

      setResult(data);
      toast.success(`Zaimportowano ${data.inserted} produktów`);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Błąd importu: ' + (error instanceof Error ? error.message : 'Nieznany błąd'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-6 h-6 text-primary" />
            Import produktów z Excel
          </CardTitle>
          <CardDescription>
            Prześlij plik xlsx z bazą produktów. Plik powinien zawierać kolumny: Symbol, Nazwa, Cena, Waluta, Opis.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-8 bg-muted/30">
            <Upload className="w-12 h-12 text-muted-foreground mb-4" />
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="max-w-xs"
            />
            {file && (
              <p className="mt-2 text-sm text-muted-foreground">
                Wybrany plik: <span className="font-medium text-foreground">{file.name}</span>
              </p>
            )}
          </div>

          {isProcessing && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Przetwarzanie...</span>
              </div>
              <Progress value={progress} />
            </div>
          )}

          {result && (
            <div className={`p-4 rounded-lg ${result.errors?.length ? 'bg-destructive/10 border border-destructive/20' : 'bg-success/10 border border-success/20'}`}>
              <div className="flex items-start gap-3">
                {result.errors?.length ? (
                  <AlertCircle className="w-5 h-5 text-destructive mt-0.5" />
                ) : (
                  <CheckCircle className="w-5 h-5 text-success mt-0.5" />
                )}
                <div>
                  <p className="font-medium">
                    Zaimportowano {result.inserted} z {result.total} produktów
                  </p>
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      <p>Błędy:</p>
                      <ul className="list-disc list-inside">
                        {result.errors.slice(0, 5).map((err, i) => (
                          <li key={i}>{err}</li>
                        ))}
                        {result.errors.length > 5 && (
                          <li>...i {result.errors.length - 5} więcej</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <Button 
            onClick={handleImport} 
            disabled={!file || isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importowanie...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Importuj produkty
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
