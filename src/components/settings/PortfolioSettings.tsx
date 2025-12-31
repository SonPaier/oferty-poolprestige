import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Images, 
  Plus, 
  Trash2, 
  Upload, 
  X,
  Loader2,
  GripVertical
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface PortfolioItem {
  id: string;
  name: string;
  description: string | null;
  images: PortfolioImage[];
}

interface PortfolioImage {
  id: string;
  image_url: string;
  file_name: string;
  sort_order: number;
}

export function PortfolioSettings() {
  const [portfolios, setPortfolios] = useState<PortfolioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    loadPortfolios();
  }, []);

  const loadPortfolios = async () => {
    try {
      const { data: portfolioData, error: portfolioError } = await supabase
        .from('portfolio')
        .select('*')
        .order('created_at', { ascending: false });

      if (portfolioError) throw portfolioError;

      const portfoliosWithImages: PortfolioItem[] = [];
      
      for (const portfolio of portfolioData || []) {
        const { data: images, error: imagesError } = await supabase
          .from('portfolio_images')
          .select('*')
          .eq('portfolio_id', portfolio.id)
          .order('sort_order');

        if (imagesError) throw imagesError;

        portfoliosWithImages.push({
          id: portfolio.id,
          name: portfolio.name,
          description: portfolio.description,
          images: images || [],
        });
      }

      setPortfolios(portfoliosWithImages);
    } catch (err) {
      console.error('Error loading portfolios:', err);
      toast.error('Błąd ładowania portfolio');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePortfolio = async () => {
    if (!newName.trim()) {
      toast.error('Podaj nazwę portfolio');
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase
        .from('portfolio')
        .insert({
          name: newName.trim(),
          description: newDescription.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      setPortfolios(prev => [{
        id: data.id,
        name: data.name,
        description: data.description,
        images: [],
      }, ...prev]);
      
      setNewName('');
      setNewDescription('');
      toast.success('Portfolio utworzone');
    } catch (err) {
      console.error('Error creating portfolio:', err);
      toast.error('Błąd tworzenia portfolio');
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePortfolio = async (portfolioId: string) => {
    if (!confirm('Czy na pewno chcesz usunąć to portfolio wraz ze wszystkimi zdjęciami?')) {
      return;
    }

    try {
      // Delete images from storage
      const portfolio = portfolios.find(p => p.id === portfolioId);
      if (portfolio) {
        for (const image of portfolio.images) {
          const path = image.image_url.split('/').pop();
          if (path) {
            await supabase.storage.from('portfolio-images').remove([path]);
          }
        }
      }

      // Delete from database (cascade will delete images records)
      const { error } = await supabase
        .from('portfolio')
        .delete()
        .eq('id', portfolioId);

      if (error) throw error;

      setPortfolios(prev => prev.filter(p => p.id !== portfolioId));
      toast.success('Portfolio usunięte');
    } catch (err) {
      console.error('Error deleting portfolio:', err);
      toast.error('Błąd usuwania portfolio');
    }
  };

  const handleUploadImages = async (portfolioId: string, files: FileList) => {
    setUploading(portfolioId);
    
    try {
      const portfolio = portfolios.find(p => p.id === portfolioId);
      const currentMaxOrder = portfolio?.images.length || 0;
      
      const newImages: PortfolioImage[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        const fileExt = file.name.split('.').pop();
        const fileName = `${portfolioId}-${Date.now()}-${i}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('portfolio-images')
          .upload(fileName, file);

        if (uploadError) {
          console.error('Upload error:', uploadError);
          continue;
        }

        const { data: { publicUrl } } = supabase.storage
          .from('portfolio-images')
          .getPublicUrl(fileName);

        const { data: imageRecord, error: insertError } = await supabase
          .from('portfolio_images')
          .insert({
            portfolio_id: portfolioId,
            image_url: publicUrl,
            file_name: file.name,
            file_size: file.size,
            sort_order: currentMaxOrder + i,
          })
          .select()
          .single();

        if (insertError) {
          console.error('Insert error:', insertError);
          continue;
        }

        newImages.push(imageRecord);
      }

      setPortfolios(prev => prev.map(p => {
        if (p.id === portfolioId) {
          return {
            ...p,
            images: [...p.images, ...newImages],
          };
        }
        return p;
      }));

      toast.success(`Przesłano ${newImages.length} zdjęć`);
    } catch (err) {
      console.error('Error uploading images:', err);
      toast.error('Błąd przesyłania zdjęć');
    } finally {
      setUploading(null);
    }
  };

  const handleDeleteImage = async (portfolioId: string, imageId: string, imageUrl: string) => {
    try {
      // Delete from storage
      const path = imageUrl.split('/').pop();
      if (path) {
        await supabase.storage.from('portfolio-images').remove([path]);
      }

      // Delete from database
      const { error } = await supabase
        .from('portfolio_images')
        .delete()
        .eq('id', imageId);

      if (error) throw error;

      setPortfolios(prev => prev.map(p => {
        if (p.id === portfolioId) {
          return {
            ...p,
            images: p.images.filter(img => img.id !== imageId),
          };
        }
        return p;
      }));

      toast.success('Zdjęcie usunięte');
    } catch (err) {
      console.error('Error deleting image:', err);
      toast.error('Błąd usuwania zdjęcia');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-medium flex items-center gap-2 mb-4">
          <Images className="w-4 h-4 text-primary" />
          Portfolio (zestawy zdjęć realizacji)
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Twórz zestawy zdjęć z realizacji, które będą wyświetlane w widoku publicznym oferty.
        </p>
      </div>

      {/* Create new portfolio */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Nowe portfolio</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="newPortfolioName">Nazwa</Label>
              <Input
                id="newPortfolioName"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="np. Basen prywatny Warszawa"
                className="input-field"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPortfolioDesc">Opis (opcjonalnie)</Label>
              <Input
                id="newPortfolioDesc"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Krótki opis realizacji"
                className="input-field"
              />
            </div>
          </div>
          <Button 
            onClick={handleCreatePortfolio} 
            disabled={creating || !newName.trim()}
            size="sm"
          >
            {creating ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Plus className="w-4 h-4 mr-2" />
            )}
            Utwórz portfolio
          </Button>
        </CardContent>
      </Card>

      {/* Existing portfolios */}
      {portfolios.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Brak portfolio. Utwórz pierwsze powyżej.
        </p>
      ) : (
        <div className="space-y-4">
          {portfolios.map((portfolio) => (
            <Card key={portfolio.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-sm">{portfolio.name}</CardTitle>
                    {portfolio.description && (
                      <p className="text-xs text-muted-foreground mt-1">{portfolio.description}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDeletePortfolio(portfolio.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Images grid */}
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 mb-4">
                  {portfolio.images.map((image) => (
                    <div key={image.id} className="relative group aspect-square">
                      <img
                        src={image.image_url}
                        alt={image.file_name}
                        className="w-full h-full object-cover rounded-lg"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 right-1 w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDeleteImage(portfolio.id, image.id, image.image_url)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                </div>

                {/* Upload button */}
                <input
                  ref={(el) => { fileInputRefs.current[portfolio.id] = el; }}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => e.target.files && handleUploadImages(portfolio.id, e.target.files)}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRefs.current[portfolio.id]?.click()}
                  disabled={uploading === portfolio.id}
                >
                  {uploading === portfolio.id ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Dodaj zdjęcia
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}