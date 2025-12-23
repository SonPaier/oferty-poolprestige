import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Save, Loader2, Home, Mail } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface BottomNavigationBarProps {
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onBack: () => void;
  onSave: () => void;
  isSaving: boolean;
  hasChanges: boolean;
  isEditMode: boolean;
  sourceEmail?: string;
}

export function BottomNavigationBar({
  currentStep,
  totalSteps,
  onNext,
  onBack,
  onSave,
  isSaving,
  hasChanges,
  isEditMode,
  sourceEmail,
}: BottomNavigationBarProps) {
  const navigate = useNavigate();
  const isFirstStep = currentStep === 1;
  const isLastStep = currentStep === totalSteps;
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  return (
    <>
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border shadow-lg">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            {/* Left side - Back button */}
            <div className="flex items-center gap-2">
              {!isFirstStep && (
                <Button
                  variant="outline"
                  onClick={onBack}
                  className="gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Wstecz</span>
                </Button>
              )}
              {isFirstStep && (
                <Button
                  variant="ghost"
                  onClick={() => navigate('/')}
                  className="gap-2 text-muted-foreground"
                >
                  <Home className="w-4 h-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Button>
              )}
            </div>

            {/* Center - Step indicator + email icon */}
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {sourceEmail && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowEmailDialog(true)}
                  title="Pokaż treść zapytania"
                  className="h-8 w-8 text-primary hover:text-primary"
                >
                  <Mail className="w-4 h-4" />
                </Button>
              )}
              <span>Krok {currentStep} z {totalSteps}</span>
            </div>

            {/* Right side - Save and Next buttons */}
            <div className="flex items-center gap-2">
              {/* Save button - always visible when there are changes */}
              {(hasChanges || isEditMode) && !isLastStep && (
                <Button
                  variant="outline"
                  onClick={onSave}
                  disabled={isSaving}
                  className="gap-2"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span className="hidden sm:inline">Zapisz</span>
                </Button>
              )}

              {/* Next button */}
              {!isLastStep && (
                <Button
                  onClick={onNext}
                  className="gap-2"
                >
                  <span className="hidden sm:inline">Dalej</span>
                  <ArrowRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Email content dialog */}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-primary" />
              Treść zapytania
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh]">
            <pre className="text-sm whitespace-pre-wrap font-sans text-muted-foreground bg-muted/50 p-4 rounded-md">
              {sourceEmail || 'Brak treści zapytania'}
            </pre>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}
