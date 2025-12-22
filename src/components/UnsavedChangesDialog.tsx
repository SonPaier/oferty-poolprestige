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
import { Button } from '@/components/ui/button';
import { Save, Trash2, ArrowLeft } from 'lucide-react';

interface UnsavedChangesDialogProps {
  open: boolean;
  onDiscard: () => void;
  onSave: () => void;
  onContinue: () => void;
}

export function UnsavedChangesDialog({
  open,
  onDiscard,
  onSave,
  onContinue,
}: UnsavedChangesDialogProps) {
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Niezapisane zmiany</AlertDialogTitle>
          <AlertDialogDescription>
            Masz niezapisane zmiany w ofercie. Co chcesz zrobić?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="destructive"
            onClick={onDiscard}
            className="w-full sm:w-auto"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Porzuć zmiany
          </Button>
          <Button
            variant="outline"
            onClick={onSave}
            className="w-full sm:w-auto"
          >
            <Save className="w-4 h-4 mr-2" />
            Zapisz zmiany
          </Button>
          <Button
            variant="default"
            onClick={onContinue}
            className="w-full sm:w-auto"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kontynuuj edycję
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
