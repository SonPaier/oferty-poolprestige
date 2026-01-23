import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Upload, X } from 'lucide-react';
import { DbProduct } from '@/hooks/useProducts';
import { useUpdateProduct, useProductImages, useAddProductImage, useDeleteProductImage } from '@/hooks/useProductsManagement';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { ShadeSelect } from '@/components/ShadeSelect';
import { Separator } from '@/components/ui/separator';

interface ProductEditDialogProps {
  product: DbProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductEditDialog({ product, open, onOpenChange }: ProductEditDialogProps) {
  const [formData, setFormData] = useState<Partial<DbProduct>>({});
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateProduct = useUpdateProduct();
  const { data: images = [], isLoading: imagesLoading } = useProductImages(product?.id || '');
  const addImage = useAddProductImage();
  const deleteImage = useDeleteProductImage();

  const isFoilProduct = formData.category === 'folia';

  useEffect(() => {
    if (product) {
      setFormData({
        symbol: product.symbol,
        name: product.name,
        price: product.price,
        currency: product.currency,
        description: product.description,
        stock_quantity: product.stock_quantity,
        category: product.category,
        shade: product.shade,
        foil_category: product.foil_category,
        foil_width: product.foil_width,
      });
    }
  }, [product]);

  const handleSave = async () => {
    if (!product) return;

    try {
      await updateProduct.mutateAsync({
        id: product.id,
        ...formData,
      });
      toast.success('Produkt zaktualizowany');
      onOpenChange(false);
    } catch (error) {
      console.error('Error updating product:', error);
      toast.error('Błąd podczas aktualizacji produktu');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !product) return;

    setIsUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`Plik ${file.name} jest za duży (max 10MB)`);
          continue;
        }
        await addImage.mutateAsync({ productId: product.id, file });
      }
      toast.success('Zdjęcia dodane');
    } catch (error) {
      console.error('Error uploading images:', error);
      toast.error('Błąd podczas wgrywania zdjęć');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteImage = async (imageId: string, imageUrl: string) => {
    if (!product) return;
    try {
      await deleteImage.mutateAsync({ imageId, productId: product.id, imageUrl });
      toast.success('Zdjęcie usunięte');
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Błąd podczas usuwania zdjęcia');
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edytuj produkt: {product.symbol}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol</Label>
              <Input
                id="symbol"
                value={formData.symbol || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, symbol: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Kategoria</Label>
              <Input
                id="category"
                value={formData.category || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nazwa</Label>
            <Input
              id="name"
              value={formData.name || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="price">Cena</Label>
              <Input
                id="price"
                type="number"
                step="0.01"
                value={formData.price || 0}
                onChange={(e) => setFormData(prev => ({ ...prev, price: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currency">Waluta</Label>
              <Select
                value={formData.currency || 'PLN'}
                onValueChange={(value) => setFormData(prev => ({ ...prev, currency: value as 'PLN' | 'EUR' }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLN">PLN</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock">Stan magazynowy</Label>
              <Input
                id="stock"
                type="number"
                value={formData.stock_quantity ?? 0}
                onChange={(e) => setFormData(prev => ({ ...prev, stock_quantity: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Opis</Label>
            <Textarea
              id="description"
              rows={3}
              value={formData.description || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {/* Foil-specific attributes */}
          {isFoilProduct && (
            <>
              <Separator />
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground">Atrybuty folii</h4>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="shade">Odcień</Label>
                    <ShadeSelect
                      value={formData.shade}
                      onChange={(value) => setFormData(prev => ({ ...prev, shade: value }))}
                      placeholder="Wybierz odcień"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="foil_category">Typ folii</Label>
                    <Select
                      value={formData.foil_category || ''}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, foil_category: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Wybierz typ" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="jednokolorowa">Jednokolorowa</SelectItem>
                        <SelectItem value="strukturalna">Strukturalna</SelectItem>
                        <SelectItem value="nadruk">Z nadrukiem</SelectItem>
                        <SelectItem value="antyposlizgowa">Antypoślizgowa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="foil_width">Szerokość (m)</Label>
                    <Input
                      id="foil_width"
                      type="number"
                      step="0.01"
                      value={formData.foil_width || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, foil_width: parseFloat(e.target.value) || null }))}
                      placeholder="np. 1.65"
                    />
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Images section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Zdjęcia produktu</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4 mr-2" />
                )}
                Dodaj zdjęcia
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileUpload}
              />
            </div>

            {imagesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : images.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Brak zdjęć produktu
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {images.map((image) => (
                  <div key={image.id} className="relative group">
                    <img
                      src={image.image_url}
                      alt={image.file_name}
                      className="w-full h-24 object-cover rounded-lg border"
                    />
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Usuń zdjęcie?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Czy na pewno chcesz usunąć to zdjęcie? Ta operacja jest nieodwracalna.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Anuluj</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteImage(image.id, image.image_url)}>
                            Usuń
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button onClick={handleSave} disabled={updateProduct.isPending}>
            {updateProduct.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Zapisz
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
