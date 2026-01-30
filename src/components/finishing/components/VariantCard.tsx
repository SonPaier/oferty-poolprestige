import { VariantData, VariantLevel } from '../FinishingWizardContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Check, Star, Crown, Wallet } from 'lucide-react';
import { formatPrice } from '@/lib/calculations';
import { cn } from '@/lib/utils';

interface VariantCardProps {
  level: VariantLevel;
  variant: VariantData;
  isDefault: boolean;
  onSetDefault: () => void;
}

const variantConfig: Record<VariantLevel, {
  title: string;
  description: string;
  icon: React.ReactNode;
  colorClass: string;
}> = {
  economy: {
    title: 'Ekonomiczny',
    description: 'Optymalna cena przy zachowaniu jakości',
    icon: <Wallet className="w-5 h-5" />,
    colorClass: 'text-green-600 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800',
  },
  standard: {
    title: 'Standard',
    description: 'Zrównoważony wybór ceny i jakości',
    icon: <Star className="w-5 h-5" />,
    colorClass: 'text-blue-600 bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800',
  },
  premium: {
    title: 'Premium',
    description: 'Najwyższa jakość materiałów',
    icon: <Crown className="w-5 h-5" />,
    colorClass: 'text-amber-600 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
  },
};

export function VariantCard({ level, variant, isDefault, onSetDefault }: VariantCardProps) {
  const config = variantConfig[level];
  
  return (
    <Card className={cn(
      "transition-all",
      isDefault && "ring-2 ring-primary shadow-lg"
    )}>
      <CardHeader className={cn("rounded-t-lg", config.colorClass)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {config.icon}
            <CardTitle className="text-lg">{config.title}</CardTitle>
          </div>
          {isDefault && (
            <Badge className="bg-primary">Domyślny</Badge>
          )}
        </div>
        <p className="text-sm opacity-80">{config.description}</p>
      </CardHeader>
      
      <CardContent className="pt-4 space-y-4">
        {/* Product info */}
        <div>
          <p className="text-sm text-muted-foreground">Produkt</p>
          <p className="font-medium truncate" title={variant.productName}>
            {variant.productName}
          </p>
          <p className="text-sm text-primary">
            {formatPrice(variant.productPrice)} zł/m²
          </p>
        </div>
        
        <Separator />
        
        {/* Costs breakdown */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Materiały:</span>
            <span>{formatPrice(variant.totalMaterialsNet)} zł</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Usługi:</span>
            <span>{formatPrice(variant.totalServicesNet)} zł</span>
          </div>
        </div>
        
        <Separator />
        
        {/* Totals */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Razem netto:</span>
            <span className="font-medium">{formatPrice(variant.totalNet)} zł</span>
          </div>
          <div className="flex justify-between">
            <span className="font-medium">Razem brutto:</span>
            <span className="text-xl font-bold text-primary">
              {formatPrice(variant.totalGross)} zł
            </span>
          </div>
        </div>
        
        {/* Set default button */}
        <Button
          variant={isDefault ? "secondary" : "outline"}
          className="w-full"
          onClick={onSetDefault}
          disabled={isDefault}
        >
          {isDefault ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Wybrany jako domyślny
            </>
          ) : (
            'Ustaw jako domyślny'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
