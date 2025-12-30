import { useState, useRef } from 'react';
import { Header } from '@/components/Header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious, PaginationEllipsis } from '@/components/ui/pagination';
import { Search, Download, Upload, Edit, Trash2, Loader2, Package, FileSpreadsheet } from 'lucide-react';
import { useProductsPaginated, useDeleteProduct } from '@/hooks/useProductsManagement';
import { DbProduct, getDbProductPriceInPLN } from '@/hooks/useProducts';
import { ProductEditDialog } from '@/components/ProductEditDialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

export default function Products() {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [editProduct, setEditProduct] = useState<DbProduct | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importMode, setImportMode] = useState<'full' | 'partial'>('full');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useProductsPaginated(debouncedSearch, currentPage);
  const deleteProduct = useDeleteProduct();

  // Debounce search
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
    const timeoutId = setTimeout(() => {
      setDebouncedSearch(value);
    }, 300);
    return () => clearTimeout(timeoutId);
  };

  const formatPrice = (product: DbProduct) => {
    const pricePLN = getDbProductPriceInPLN(product);
    return `${pricePLN.toFixed(2)} PLN`;
  };

  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteProduct.mutateAsync(productId);
      toast.success('Produkt usunięty');
    } catch (error) {
      console.error('Error deleting product:', error);
      toast.error('Błąd podczas usuwania produktu');
    }
  };

  // Export to CSV
  const handleExportCSV = async () => {
    try {
      const { data: allProducts, error } = await supabase
        .from('products')
        .select('symbol, name, price, currency, description, stock_quantity, category, foil_category, foil_width')
        .order('name');

      if (error) throw error;

      const headers = ['Symbol', 'Nazwa', 'Cena', 'Waluta', 'Opis', 'Stan magazynowy', 'Kategoria', 'Kategoria folii', 'Szerokość folii'];
      const csvRows = [
        headers.join(';'),
        ...(allProducts || []).map(p => [
          p.symbol,
          p.name,
          p.price,
          p.currency,
          p.description || '',
          p.stock_quantity || 0,
          p.category || '',
          (p as any).foil_category || '',
          (p as any).foil_width || '',
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')),
      ];

      const csvContent = '\ufeff' + csvRows.join('\n'); // BOM for Excel
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `produkty_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success('Eksport zakończony');
    } catch (error) {
      console.error('Error exporting CSV:', error);
      toast.error('Błąd podczas eksportu');
    }
  };

  // Import from CSV
  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      // Skip header row, parse CSV
      const products = lines.slice(1).map(line => {
        // Parse CSV with semicolon separator and quoted values
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
          const char = line[i];
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === ';' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());
        
        return {
          symbol: values[0] || '',
          name: values[1] || '',
          price: parseFloat(values[2] || '0') || 0,
          currency: (values[3]?.toUpperCase() === 'EUR' ? 'EUR' : 'PLN'),
          description: values[4] || null,
          stock_quantity: parseInt(values[5] || '0') || 0,
          category: values[6] || null,
          foil_category: values[7] || null,
          foil_width: values[8] ? parseFloat(values[8]) : null,
        };
      }).filter(p => p.symbol);

      if (importMode === 'partial') {
        // Partial update - only update existing products by symbol
        let updated = 0;
        for (const product of products) {
          const { error } = await supabase
            .from('products')
            .update({
              name: product.name,
              price: product.price,
              currency: product.currency,
              description: product.description,
              stock_quantity: product.stock_quantity,
              category: product.category,
              foil_category: product.foil_category,
              foil_width: product.foil_width,
            })
            .eq('symbol', product.symbol);
          
          if (!error) updated++;
        }
        toast.success(`Zaktualizowano ${updated} produktów`);
      } else {
        // Full import via edge function
        const { data: result, error } = await supabase.functions.invoke('import-products', {
          body: { products },
        });

        if (error) throw error;
        toast.success(`Zaimportowano ${result.inserted} z ${result.total} produktów`);
      }
    } catch (error) {
      console.error('Error importing XLSX:', error);
      toast.error('Błąd podczas importu');
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const renderPaginationItems = () => {
    if (!data) return null;
    const { totalPages, currentPage } = data;
    const items = [];
    
    // Show first page
    items.push(
      <PaginationItem key={1}>
        <PaginationLink
          onClick={() => setCurrentPage(1)}
          isActive={currentPage === 1}
          className="cursor-pointer"
        >
          1
        </PaginationLink>
      </PaginationItem>
    );

    if (currentPage > 3) {
      items.push(<PaginationItem key="start-ellipsis"><PaginationEllipsis /></PaginationItem>);
    }

    // Show pages around current
    for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
      items.push(
        <PaginationItem key={i}>
          <PaginationLink
            onClick={() => setCurrentPage(i)}
            isActive={currentPage === i}
            className="cursor-pointer"
          >
            {i}
          </PaginationLink>
        </PaginationItem>
      );
    }

    if (currentPage < totalPages - 2) {
      items.push(<PaginationItem key="end-ellipsis"><PaginationEllipsis /></PaginationItem>);
    }

    // Show last page if more than 1 page
    if (totalPages > 1) {
      items.push(
        <PaginationItem key={totalPages}>
          <PaginationLink
            onClick={() => setCurrentPage(totalPages)}
            isActive={currentPage === totalPages}
            className="cursor-pointer"
          >
            {totalPages}
          </PaginationLink>
        </PaginationItem>
      );
    }

    return items;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header showNavLinks />

      <main className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-3">
                <Package className="w-6 h-6 text-primary" />
                <CardTitle>Produkty</CardTitle>
                {data && (
                  <span className="text-sm text-muted-foreground">
                    ({data.totalCount} produktów)
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleExportCSV}>
                  <Download className="w-4 h-4 mr-2" />
                  Eksport CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImportMode('full');
                    fileInputRef.current?.click();
                  }}
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Import CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImportMode('partial');
                    fileInputRef.current?.click();
                  }}
                  disabled={isImporting}
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Częściowy update
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={handleImportCSV}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj po nazwie lub symbolu..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Table */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="text-center py-12 text-destructive">
                Błąd podczas ładowania produktów
              </div>
            ) : data?.products.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                Nie znaleziono produktów
              </div>
            ) : (
              <>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[120px]">Symbol</TableHead>
                        <TableHead>Nazwa</TableHead>
                        <TableHead className="text-right w-[120px]">Cena</TableHead>
                        <TableHead className="w-[100px]">Waluta</TableHead>
                        <TableHead className="w-[100px]">Kategoria</TableHead>
                        <TableHead className="w-[100px] text-right">Akcje</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.products.map((product) => (
                        <TableRow key={product.id}>
                          <TableCell className="font-mono text-sm">{product.symbol}</TableCell>
                          <TableCell className="max-w-[300px] truncate">{product.name}</TableCell>
                          <TableCell className="text-right">{formatPrice(product)}</TableCell>
                          <TableCell>{product.currency}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {product.category || '-'}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setEditProduct(product)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <Trash2 className="w-4 h-4 text-destructive" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Usuń produkt?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Czy na pewno chcesz usunąć produkt "{product.name}"? Ta operacja jest nieodwracalna.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Anuluj</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteProduct(product.id)}>
                                      Usuń
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {data && data.totalPages > 1 && (
                  <div className="mt-4">
                    <Pagination>
                      <PaginationContent>
                        <PaginationItem>
                          <PaginationPrevious
                            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                            className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                        {renderPaginationItems()}
                        <PaginationItem>
                          <PaginationNext
                            onClick={() => setCurrentPage(Math.min(data.totalPages, currentPage + 1))}
                            className={currentPage === data.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                          />
                        </PaginationItem>
                      </PaginationContent>
                    </Pagination>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>

      <ProductEditDialog
        product={editProduct}
        open={!!editProduct}
        onOpenChange={(open) => !open && setEditProduct(null)}
      />
    </div>
  );
}
