import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FoilSubtype, SUBTYPE_NAMES, SUBTYPE_TO_FOIL_CATEGORY } from '@/lib/finishingMaterials';

interface ColorGalleryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subtype: FoilSubtype;
}

interface FoilColor {
  id: string;
  name: string;
  shade: string | null;
  extracted_hex: string | null;
  image_url: string | null;
}

export function ColorGalleryModal({
  open,
  onOpenChange,
  subtype,
}: ColorGalleryModalProps) {
  // Fetch foil colors for this subtype
  const { data: colors = [], isLoading } = useQuery({
    queryKey: ['foil-colors-gallery', subtype],
    queryFn: async () => {
      const foilCategory = SUBTYPE_TO_FOIL_CATEGORY[subtype];
      
      // Get products with their first image
      const { data: products, error } = await supabase
        .from('products')
        .select(`
          id,
          name,
          shade,
          extracted_hex,
          product_images (
            image_url
          )
        `)
        .eq('category', 'Folie basenowe')
        .eq('foil_category', foilCategory)
        .order('shade');

      if (error) throw error;

      return (products || []).map((p) => ({
        id: p.id,
        name: p.name,
        shade: p.shade,
        extracted_hex: p.extracted_hex,
        image_url: p.product_images?.[0]?.image_url || null,
      })) as FoilColor[];
    },
    enabled: open,
  });

  // Group colors by shade
  const groupedColors = colors.reduce((acc, color) => {
    const shade = color.shade || 'Inne';
    if (!acc[shade]) {
      acc[shade] = [];
    }
    acc[shade].push(color);
    return acc;
  }, {} as Record<string, FoilColor[]>);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            Dostępne kolory - {SUBTYPE_NAMES[subtype]}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="h-[60vh] pr-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Ładowanie kolorów...</p>
            </div>
          ) : Object.keys(groupedColors).length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">Brak dostępnych kolorów</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(groupedColors).map(([shade, items]) => (
                <div key={shade}>
                  <h3 className="font-semibold text-lg mb-3 capitalize">{shade}</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                    {items.map((color) => (
                      <div
                        key={color.id}
                        className="flex flex-col items-center p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                      >
                        {color.image_url ? (
                          <img
                            src={color.image_url}
                            alt={color.name}
                            className="w-16 h-16 object-cover rounded-md mb-2"
                          />
                        ) : (
                          <div
                            className="w-16 h-16 rounded-md mb-2 border"
                            style={{
                              backgroundColor: color.extracted_hex || '#e5e5e5',
                            }}
                          />
                        )}
                        <p className="text-xs text-center font-medium line-clamp-2">
                          {color.name}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <div className="text-xs text-muted-foreground text-center pt-2 border-t">
          Ta galeria może zostać dołączona jako załącznik do oferty PDF
        </div>
      </DialogContent>
    </Dialog>
  );
}
