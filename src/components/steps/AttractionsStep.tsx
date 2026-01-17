import { Sparkles, ShoppingCart } from 'lucide-react';
import { AttractionsGrid } from '@/components/attractions/AttractionsGrid';
import { useAttractionsSelection } from '@/hooks/useAttractionsSelection';
import { Card, CardContent } from '@/components/ui/card';

interface AttractionsStepProps {
  onNext: () => void;
  onBack: () => void;
}

export function AttractionsStep({ onNext, onBack }: AttractionsStepProps) {
  const { totalCount, totalPrice } = useAttractionsSelection();

  const formattedTotal = new Intl.NumberFormat('pl-PL', {
    style: 'currency',
    currency: 'PLN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(totalPrice);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold">Atrakcje basenowe</h2>
        </div>
        <p className="text-muted-foreground">
          Wybierz atrakcje wodne do konfiguracji basenu
        </p>
      </div>

      {/* Selection Summary Bar */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="py-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <span className="font-medium">
                Wybrano: <span className="text-primary">{totalCount}</span> {totalCount === 1 ? 'produkt' : totalCount < 5 ? 'produkty' : 'produktów'}
              </span>
            </div>
            <div className="font-bold text-lg">
              {formattedTotal}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories Grid */}
      <AttractionsGrid />
    </div>
  );
}
