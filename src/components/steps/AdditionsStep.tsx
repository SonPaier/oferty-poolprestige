import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, Search, Plus, Minus, Trash2, Package, Loader2, Info } from 'lucide-react';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { useProducts, useProductsCount, DbProduct, getDbProductPriceInPLN } from '@/hooks/useProducts';
import { Product } from '@/data/products';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';

interface AdditionsStepProps {
  onNext: () => void;
  onBack: () => void;
}

const MAX_RESULTS = 30;

// Convert DbProduct to Product for compatibility
function dbProductToProduct(dbProduct: DbProduct): Product {
  return {
    id: dbProduct.id,
    symbol: dbProduct.symbol,
    name: dbProduct.name,
    price: dbProduct.price,
    currency: dbProduct.currency,
    description: dbProduct.description || undefined,
    category: (dbProduct.category as any) || 'akcesoria',
  };
}

export function AdditionsStep({ onNext, onBack }: AdditionsStepProps) {
  const { state, dispatch } = useConfigurator();
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const laddersAddedRef = useRef(false);

  // Check if pool has stairs
  const hasStairs = state.dimensions.customStairsVertices && 
                    state.dimensions.customStairsVertices.length > 2;

  // Auto-add ladders if no stairs (only once on mount)
  useEffect(() => {
    if (hasStairs || laddersAddedRef.current) return;
    
    // Check if ladders already added
    const hasLadders = state.sections.dodatki.items.some(item => 
      item.product.name.toLowerCase().includes('drabinka') ||
      item.product.name.toLowerCase().includes('ladder')
    );
    
    if (hasLadders) {
      laddersAddedRef.current = true;
      return;
    }
    
    // Search for ladders in database and add them
    const addLadders = async () => {
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .ilike('name', '%drabinka%')
          .gt('price', 0)
          .limit(1);
        
        if (error || !data || data.length === 0) return;
        
        const ladderProduct: Product = {
          id: data[0].id,
          symbol: data[0].symbol,
          name: data[0].name,
          price: data[0].price,
          currency: data[0].currency as 'PLN' | 'EUR',
          description: data[0].description || undefined,
          category: 'akcesoria',
        };
        
        dispatch({
          type: 'ADD_ITEM',
          payload: {
            section: 'dodatki',
            item: {
              id: `dodatek-drabinka-${Date.now()}`,
              product: ladderProduct,
              quantity: 1,
            },
          },
        });
        
        laddersAddedRef.current = true;
      } catch (err) {
        console.error('Error adding ladders:', err);
      }
    };
    
    addLadders();
  }, [hasStairs, state.sections.dodatki.items, dispatch]);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: products = [], isLoading } = useProducts(debouncedSearch, MAX_RESULTS);
  const { data: totalCount = 0 } = useProductsCount();

  const addedItems = state.sections.dodatki.items;

  const isProductAdded = (productId: string) => {
    return addedItems.some(item => item.product.id === productId);
  };

  const getAddedQuantity = (productId: string) => {
    const item = addedItems.find(item => item.product.id === productId);
    return item?.quantity || 0;
  };

  const handleAddProduct = (dbProduct: DbProduct) => {
    if (isProductAdded(dbProduct.id)) return;
    
    const product = dbProductToProduct(dbProduct);
    
    dispatch({
      type: 'ADD_ITEM',
      payload: {
        section: 'dodatki',
        item: {
          id: `dodatek-${product.id}-${Date.now()}`,
          product: product,
          quantity: 1,
        },
      },
    });
  };

  const handleRemoveProduct = (productId: string) => {
    const item = addedItems.find(item => item.product.id === productId);
    if (item) {
      dispatch({
        type: 'REMOVE_ITEM',
        payload: { section: 'dodatki', itemId: item.id },
      });
    }
  };

  const handleQuantityChange = (productId: string, delta: number) => {
    const item = addedItems.find(item => item.product.id === productId);
    if (!item) return;
    
    const newQuantity = Math.max(1, item.quantity + delta);
    dispatch({
      type: 'UPDATE_ITEM_QUANTITY',
      payload: { section: 'dodatki', itemId: item.id, quantity: newQuantity },
    });
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pl-PL', {
      style: 'currency',
      currency: 'PLN',
      minimumFractionDigits: 2,
    }).format(price);
  };

  const getItemPrice = (item: typeof addedItems[0]) => {
    if (item.customPrice) return item.customPrice;
    return item.product.currency === 'EUR' ? item.product.price * 4.35 : item.product.price;
  };

  const totalAdditionsPrice = addedItems.reduce((sum, item) => {
    const price = getItemPrice(item);
    return sum + price * item.quantity;
  }, 0);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Dodatki</h2>
          <p className="text-muted-foreground mt-1">
            Wyszukaj i dodaj dodatkowe elementy do oferty
          </p>
        </div>
        <Badge variant="outline" className="text-lg px-4 py-2">
          {addedItems.length} pozycji
        </Badge>
      </div>

      {/* Info about auto-added ladders */}
      {!hasStairs && (
        <div className="p-4 rounded-lg bg-accent/10 border border-accent/20">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-accent mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">Drabinka dodana automatycznie</p>
              <p className="text-muted-foreground">
                Ponieważ basen nie ma schodów, drabinka została automatycznie dodana do oferty.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Search Section */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              Wyszukaj produkty
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Szukaj po symbolu lub nazwie..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <div className="text-sm text-muted-foreground flex items-center gap-2">
              {isLoading && <Loader2 className="w-3 h-3 animate-spin" />}
              Wyświetlono {products.length} z {totalCount} produktów
              {searchQuery && ` (filtr: "${searchQuery}")`}
            </div>

            <ScrollArea className="h-[400px] pr-4">
              {isLoading && products.length === 0 ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : products.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Brak produktów w bazie</p>
                  <p className="text-sm mt-1">
                    Zaimportuj produkty z pliku xlsx na stronie{' '}
                    <a href="/import-products" className="text-primary underline">/import-products</a>
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {products.map((product) => {
                    const isAdded = isProductAdded(product.id);
                    const priceInPLN = getDbProductPriceInPLN(product);
                    
                    return (
                      <div
                        key={product.id}
                        className={`p-3 rounded-lg border transition-all ${
                          isAdded 
                            ? 'bg-primary/10 border-primary/30' 
                            : 'bg-card hover:bg-muted/50 border-border'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-mono text-muted-foreground">
                                {product.symbol}
                              </span>
                              {product.category && (
                                <Badge variant="secondary" className="text-xs">
                                  {product.category}
                                </Badge>
                              )}
                            </div>
                            <p className="font-medium text-sm mt-1 line-clamp-2">
                              {product.name}
                            </p>
                            <p className="text-sm text-primary font-semibold mt-1">
                              {formatPrice(priceInPLN)}
                              {product.currency === 'EUR' && (
                                <span className="text-xs text-muted-foreground ml-1">
                                  ({product.price.toFixed(2)} EUR)
                                </span>
                              )}
                            </p>
                          </div>
                          
                          {isAdded ? (
                            <div className="flex items-center gap-1">
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => handleQuantityChange(product.id, -1)}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-8 text-center font-medium text-sm">
                                {getAddedQuantity(product.id)}
                              </span>
                              <Button
                                size="icon"
                                variant="outline"
                                className="h-8 w-8"
                                onClick={() => handleQuantityChange(product.id, 1)}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                              <Button
                                size="icon"
                                variant="destructive"
                                className="h-8 w-8 ml-1"
                                onClick={() => handleRemoveProduct(product.id)}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAddProduct(product)}
                            >
                              <Plus className="w-4 h-4 mr-1" />
                              Dodaj
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Added Items Section */}
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              Dodane dodatki
            </CardTitle>
          </CardHeader>
          <CardContent>
            {addedItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Brak dodanych pozycji</p>
                <p className="text-sm mt-1">Wyszukaj i dodaj produkty z listy po lewej</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px] pr-4">
                <div className="space-y-2">
                  {addedItems.map((item) => {
                    const itemPrice = getItemPrice(item);
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg bg-muted/30 border border-border"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-mono text-muted-foreground">
                              {item.product.symbol}
                            </span>
                            <p className="font-medium text-sm mt-1 line-clamp-2">
                              {item.product.name}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className="text-sm text-muted-foreground">
                                {formatPrice(itemPrice)} × {item.quantity}
                              </span>
                              <span className="text-sm font-semibold text-primary">
                                = {formatPrice(itemPrice * item.quantity)}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => handleQuantityChange(item.product.id, -1)}
                            >
                              <Minus className="w-3 h-3" />
                            </Button>
                            <span className="w-8 text-center font-medium text-sm">
                              {item.quantity}
                            </span>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-8 w-8"
                              onClick={() => handleQuantityChange(item.product.id, 1)}
                            >
                              <Plus className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="destructive"
                              className="h-8 w-8 ml-1"
                              onClick={() => handleRemoveProduct(item.product.id)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            )}
            
            {addedItems.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Suma dodatków:</span>
                  <span className="text-xl font-bold text-primary">
                    {formatPrice(totalAdditionsPrice)}
                  </span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
