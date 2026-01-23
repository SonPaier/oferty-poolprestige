import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Header } from '@/components/Header';
import { foilImportApi, elbeImportApi, FoilProduct, extractColorFromImage } from '@/lib/api/firecrawl';
import { Search, Download, Save, CheckCircle, Loader2, ExternalLink, Factory, ImageIcon, Type } from 'lucide-react';

type ImportStep = 'idle' | 'mapping' | 'parsing' | 'scraping' | 'ready' | 'saving' | 'done';
type ImportSource = 'alkorplan' | 'elbe';

const foilCategoryLabels: Record<string, string> = {
  'jednokolorowa': 'Jednokolorowa',
  'strukturalna': 'Strukturalna',
  'nadruk': 'Z nadrukiem',
  'antyposlizgowa': 'Antypoślizgowa',
};

const foilCategoryColors: Record<string, string> = {
  'jednokolorowa': 'bg-blue-100 text-blue-800',
  'strukturalna': 'bg-green-100 text-green-800',
  'nadruk': 'bg-purple-100 text-purple-800',
  'antyposlizgowa': 'bg-orange-100 text-orange-800',
};

export default function ImportFoils() {
  const [source, setSource] = useState<ImportSource>('alkorplan');
  const [step, setStep] = useState<ImportStep>('idle');
  const [progress, setProgress] = useState(0);
  const [progressText, setProgressText] = useState('');
  const [urls, setUrls] = useState<string[]>([]);
  const [products, setProducts] = useState<FoilProduct[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<{ inserted: number; total: number } | null>(null);

  const handleMapAlkorplan = async () => {
    setStep('mapping');
    setProgress(10);
    setProgressText('Mapowanie strony renolit-alkorplan.com...');

    try {
      const mapResult = await foilImportApi.mapProductUrls();
      
      if (!mapResult.success || !mapResult.urls) {
        throw new Error(mapResult.error || 'Nie udało się zmapować strony');
      }

      setUrls(mapResult.urls);
      setProgress(30);
      setProgressText(`Znaleziono ${mapResult.urls.length} URLi produktów. Parsowanie...`);
      setStep('parsing');

      // Parse URLs
      const parseResult = await foilImportApi.parseProductUrls(mapResult.urls);
      
      if (!parseResult.success || !parseResult.products) {
        throw new Error(parseResult.error || 'Nie udało się sparsować URLi');
      }

      const productsWithBrand = parseResult.products.map(p => ({ ...p, brand: 'alkorplan' as const }));
      setProducts(productsWithBrand);
      setSelectedProducts(new Set(productsWithBrand.map(p => p.symbol)));
      setProgress(100);
      setProgressText(`Gotowe! Znaleziono ${productsWithBrand.length} produktów folii.`);
      setStep('ready');
      
      toast.success(`Znaleziono ${productsWithBrand.length} produktów folii Alkorplan`);
    } catch (error) {
      console.error('Error mapping:', error);
      toast.error(error instanceof Error ? error.message : 'Błąd mapowania');
      setStep('idle');
      setProgress(0);
    }
  };

  const handleScanElbe = async () => {
    setStep('mapping');
    setProgress(10);
    setProgressText('Skanowanie strony elbepools.com...');

    try {
      const result = await elbeImportApi.scrapeAllProducts((prog, text) => {
        setProgress(prog);
        setProgressText(text);
      });
      
      if (!result.success || !result.products) {
        throw new Error(result.error || 'Nie udało się pobrać produktów');
      }

      setProducts(result.products);
      setSelectedProducts(new Set(result.products.map(p => p.symbol)));
      setProgress(100);
      setProgressText(`Gotowe! Znaleziono ${result.products.length} produktów folii ELBE.`);
      setStep('ready');
      
      toast.success(`Znaleziono ${result.products.length} produktów folii ELBE`);
    } catch (error) {
      console.error('Error scanning ELBE:', error);
      toast.error(error instanceof Error ? error.message : 'Błąd skanowania');
      setStep('idle');
      setProgress(0);
    }
  };

  const handleScrapeImages = async () => {
    setStep('scraping');
    setProgress(0);
    setProgressText('Pobieranie zdjęć i ekstrakcja kolorów...');

    try {
      const selectedProductsList = products.filter(p => selectedProducts.has(p.symbol));
      const totalProducts = selectedProductsList.length;
      
      // Scrape in smaller batches with progress updates
      const batchSize = 5;
      const updatedProducts: FoilProduct[] = [];
      
      for (let i = 0; i < selectedProductsList.length; i += batchSize) {
        const batch = selectedProductsList.slice(i, i + batchSize);
        const batchResults = await foilImportApi.scrapeProductDetails(batch);
        
        // Extract colors from images for products that have them
        const batchWithColors = await Promise.all(batchResults.map(async (product) => {
          if (product.imageUrl && !product.shade) {
            const colorResult = await extractColorFromImage(
              product.imageUrl, 
              product.name, 
              product.description
            );
            return {
              ...product,
              shade: colorResult.shade || product.shade,
              extractedHex: colorResult.extractedHex,
              shadeSource: colorResult.source,
            };
          }
          return { ...product, shadeSource: product.shade ? 'name' as const : undefined };
        }));
        
        updatedProducts.push(...batchWithColors);
        
        const progressPercent = Math.round(((i + batch.length) / totalProducts) * 100);
        setProgress(progressPercent);
        setProgressText(`Pobrano ${i + batch.length} z ${totalProducts} produktów...`);
      }

      // Update products with scraped data
      const updatedMap = new Map(updatedProducts.map(p => [p.symbol, p]));
      setProducts(prev => prev.map(p => updatedMap.get(p.symbol) || p));
      
      setStep('ready');
      setProgress(100);
      setProgressText('Zdjęcia i kolory pobrane!');
      toast.success('Pobrano zdjęcia i wyekstrahowano kolory');
    } catch (error) {
      console.error('Error scraping:', error);
      toast.error('Błąd pobierania zdjęć');
      setStep('ready');
    }
  };

  const handleSave = async () => {
    setStep('saving');
    setProgress(50);
    setProgressText('Zapisywanie do bazy danych...');

    try {
      const selectedProductsList = products.filter(p => selectedProducts.has(p.symbol));
      const saveApi = source === 'alkorplan' ? foilImportApi : elbeImportApi;
      const saveResult = await saveApi.saveProducts(selectedProductsList);

      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Błąd zapisu');
      }

      setResult({ inserted: saveResult.inserted || 0, total: saveResult.total || 0 });
      setStep('done');
      setProgress(100);
      setProgressText('Import zakończony!');
      
      toast.success(`Zaimportowano ${saveResult.inserted} produktów`);
    } catch (error) {
      console.error('Error saving:', error);
      toast.error(error instanceof Error ? error.message : 'Błąd zapisu');
      setStep('ready');
    }
  };

  const toggleProduct = (symbol: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(symbol)) {
        next.delete(symbol);
      } else {
        next.add(symbol);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedProducts.size === products.length) {
      setSelectedProducts(new Set());
    } else {
      setSelectedProducts(new Set(products.map(p => p.symbol)));
    }
  };

  const handleReset = () => {
    setStep('idle');
    setProducts([]);
    setUrls([]);
    setResult(null);
    setProgress(0);
    setSelectedProducts(new Set());
  };

  const handleSourceChange = (newSource: string) => {
    if (step !== 'idle' && step !== 'done') {
      toast.error('Zakończ lub anuluj bieżący import przed zmianą źródła');
      return;
    }
    setSource(newSource as ImportSource);
    handleReset();
  };

  const groupedProducts = products.reduce((acc, product) => {
    if (!acc[product.collection]) {
      acc[product.collection] = [];
    }
    acc[product.collection].push(product);
    return acc;
  }, {} as Record<string, FoilProduct[]>);

  const isWorking = ['mapping', 'parsing', 'scraping', 'saving'].includes(step);

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto py-8 px-4">
        <Card className="max-w-6xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-6 w-6" />
              Import folii basenowych
            </CardTitle>
            <CardDescription>
              Automatyczne pobieranie bazy folii basenowych ze stron producentów
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Source selection tabs */}
            <Tabs value={source} onValueChange={handleSourceChange}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="alkorplan" disabled={isWorking}>
                  Renolit Alkorplan
                </TabsTrigger>
                <TabsTrigger value="elbe" disabled={isWorking}>
                  ELBE Pool Surface
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Progress section */}
            {isWorking && (
              <div className="space-y-2">
                <Progress value={progress} className="h-2" />
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {progressText}
                </p>
              </div>
            )}

            {/* Step 1: Scan/Map */}
            {step === 'idle' && (
              <div className="text-center py-8">
                <Search className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {source === 'alkorplan' 
                    ? 'Skanuj stronę Renolit Alkorplan' 
                    : 'Skanuj stronę ELBE Pool Surface'}
                </h3>
                <p className="text-muted-foreground mb-6">
                  {source === 'alkorplan'
                    ? 'Przeskanuj renolit-alkorplan.com aby znaleźć wszystkie dostępne folie basenowe.'
                    : 'Przeskanuj elbepools.com aby znaleźć wszystkie dostępne folie basenowe ELBE.'}
                </p>
                <Button 
                  onClick={source === 'alkorplan' ? handleMapAlkorplan : handleScanElbe} 
                  size="lg"
                >
                  <Search className="h-4 w-4 mr-2" />
                  Rozpocznij skanowanie
                </Button>
              </div>
            )}

            {/* Step 2: Review products */}
            {step === 'ready' && products.length > 0 && (
              <>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium">Znalezione produkty</h3>
                    <p className="text-sm text-muted-foreground">
                      Wybrano {selectedProducts.size} z {products.length} produktów
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={toggleAll}>
                      {selectedProducts.size === products.length ? 'Odznacz wszystko' : 'Zaznacz wszystko'}
                    </Button>
                    {source === 'alkorplan' && (
                      <Button variant="outline" onClick={handleScrapeImages}>
                        <Download className="h-4 w-4 mr-2" />
                        Pobierz zdjęcia
                      </Button>
                    )}
                    <Button onClick={handleSave} disabled={selectedProducts.size === 0}>
                      <Save className="h-4 w-4 mr-2" />
                      Zapisz ({selectedProducts.size})
                    </Button>
                  </div>
                </div>

                <ScrollArea className="h-[500px] border rounded-lg p-4">
                  {Object.entries(groupedProducts).map(([collection, collectionProducts]) => (
                    <div key={collection} className="mb-6">
                      <h4 className="font-medium text-lg mb-3 flex items-center gap-2">
                        {collection}
                        <Badge variant="secondary">{collectionProducts.length}</Badge>
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {collectionProducts.map(product => (
                          <div
                            key={product.symbol}
                            className={`border rounded-lg p-3 flex gap-3 cursor-pointer transition-colors ${
                              selectedProducts.has(product.symbol) 
                                ? 'border-primary bg-primary/5' 
                                : 'border-border hover:border-muted-foreground'
                            }`}
                            onClick={() => toggleProduct(product.symbol)}
                          >
                            <Checkbox
                              checked={selectedProducts.has(product.symbol)}
                              onCheckedChange={() => toggleProduct(product.symbol)}
                              className="mt-1"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                {product.imageUrl && (
                                  <img 
                                    src={product.imageUrl} 
                                    alt={product.name}
                                    className="w-10 h-10 rounded object-cover"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm truncate">{product.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">{product.symbol}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className={foilCategoryColors[product.foilCategory]}>
                                  {foilCategoryLabels[product.foilCategory]}
                                </Badge>
                                {product.shade && (
                                  <div className="flex items-center gap-1">
                                    {product.extractedHex && (
                                      <div 
                                        className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
                                        style={{ backgroundColor: product.extractedHex }}
                                        title={`HEX: ${product.extractedHex}`}
                                      />
                                    )}
                                    <Badge variant="outline" className="text-xs">
                                      {product.shade}
                                    </Badge>
                                    {product.shadeSource === 'producer' && (
                                      <span title="Dane producenta"><Factory className="w-3 h-3 text-muted-foreground" /></span>
                                    )}
                                    {product.shadeSource === 'image' && (
                                      <span title="Ekstrakcja z obrazka"><ImageIcon className="w-3 h-3 text-muted-foreground" /></span>
                                    )}
                                    {product.shadeSource === 'name' && (
                                      <span title="Z nazwy produktu"><Type className="w-3 h-3 text-muted-foreground" /></span>
                                    )}
                                  </div>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  {product.thickness}mm
                                </span>
                                <a 
                                  href={product.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </ScrollArea>
              </>
            )}

            {/* Step 3: Done */}
            {step === 'done' && result && (
              <div className="text-center py-8">
                <CheckCircle className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <h3 className="text-lg font-medium mb-2">Import zakończony!</h3>
                <p className="text-muted-foreground mb-6">
                  Zaimportowano {result.inserted} z {result.total} produktów folii do bazy danych.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" onClick={handleReset}>
                    Importuj ponownie
                  </Button>
                  <Button onClick={() => window.location.href = '/produkty'}>
                    Przejdź do produktów
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
