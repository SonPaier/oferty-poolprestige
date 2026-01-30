import { useFinishingWizard, FinishingType } from '../FinishingWizardContext';
import { useConfigurator } from '@/context/ConfiguratorContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Layers, Film, Grid3X3, AlertTriangle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';

interface FinishingOption {
  type: FinishingType;
  title: string;
  description: string;
  icon: React.ReactNode;
  features: string[];
}

const finishingOptions: FinishingOption[] = [
  {
    type: 'foil',
    title: 'Folia basenowa',
    description: 'Elastyczne wykończenie z folii PVC, idealne dla większości zastosowań',
    icon: <Film className="w-8 h-8" />,
    features: [
      'Szybszy montaż',
      'Niższy koszt',
      'Łatwa naprawa',
      'Bogata paleta kolorów',
    ],
  },
  {
    type: 'ceramic',
    title: 'Płytki ceramiczne',
    description: 'Klasyczne wykończenie ceramiczne dla luksusowych instalacji',
    icon: <Grid3X3 className="w-8 h-8" />,
    features: [
      'Większa trwałość',
      'Prestiżowy wygląd',
      'Łatwe czyszczenie',
      'Odporność na UV',
    ],
  },
];

export function Step1TypeSelection() {
  const { state, dispatch } = useFinishingWizard();
  const { state: configuratorState } = useConfigurator();
  const [pendingType, setPendingType] = useState<FinishingType>(null);
  const [showWarning, setShowWarning] = useState(false);
  
  // Get the type set in pool dimensions
  const poolLiningType = configuratorState.dimensions.liningType;
  const suggestedType: FinishingType = poolLiningType === 'ceramiczny' ? 'ceramic' : 'foil';
  
  const handleTypeSelect = (type: FinishingType) => {
    // If changing from an existing selection, show warning
    if (state.finishingType && state.finishingType !== type) {
      setPendingType(type);
      setShowWarning(true);
      return;
    }
    
    dispatch({ type: 'SET_FINISHING_TYPE', payload: type });
  };
  
  const confirmTypeChange = () => {
    if (pendingType) {
      dispatch({ type: 'SET_FINISHING_TYPE', payload: pendingType });
    }
    setShowWarning(false);
    setPendingType(null);
  };
  
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Layers className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-semibold">Wybierz typ wykończenia</h2>
      </div>
      
      {/* Info about suggested type */}
      {suggestedType && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/20">
          <Info className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm">
              Na podstawie parametrów basenu sugerujemy: <strong>
                {suggestedType === 'foil' ? 'Folia basenowa' : 'Płytki ceramiczne'}
              </strong>
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Możesz wybrać inny typ, ale może to wpłynąć na koszty i czas realizacji.
            </p>
          </div>
        </div>
      )}
      
      {/* Type selection cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {finishingOptions.map((option) => (
          <Card
            key={option.type}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              state.finishingType === option.type && "ring-2 ring-primary bg-primary/5",
              option.type === suggestedType && state.finishingType !== option.type && "border-primary/50"
            )}
            onClick={() => handleTypeSelect(option.type)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className={cn(
                  "p-3 rounded-lg",
                  state.finishingType === option.type ? "bg-primary text-primary-foreground" : "bg-muted"
                )}>
                  {option.icon}
                </div>
                <div className="flex gap-2">
                  {option.type === suggestedType && (
                    <Badge variant="secondary">Sugerowany</Badge>
                  )}
                  {state.finishingType === option.type && (
                    <Badge>Wybrany</Badge>
                  )}
                </div>
              </div>
              <CardTitle className="text-lg mt-3">{option.title}</CardTitle>
              <p className="text-sm text-muted-foreground">{option.description}</p>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {option.features.map((feature, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    {feature}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Warning dialog for type change */}
      <AlertDialog open={showWarning} onOpenChange={setShowWarning}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              Zmiana typu wykończenia
            </AlertDialogTitle>
            <AlertDialogDescription>
              Zmiana typu wykończenia spowoduje utratę wszystkich dotychczasowych wyborów, 
              w tym wybranego produktu, materiałów i wygenerowanych wariantów cenowych.
              <br /><br />
              Czy na pewno chcesz kontynuować?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingType(null)}>
              Anuluj
            </AlertDialogCancel>
            <AlertDialogAction onClick={confirmTypeChange}>
              Tak, zmień typ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
