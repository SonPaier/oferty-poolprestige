import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
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
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle>Niezapisane zmiany</AlertDialogTitle>
          <AlertDialogDescription>
            Masz niezapisane zmiany w ofercie. Co chcesz zrobić?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2 mt-4">
          <Button
            variant="default"
            onClick={onContinue}
            className="w-full justify-start"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kontynuuj edycję
          </Button>
          <Button
            variant="outline"
            onClick={onSave}
            className="w-full justify-start"
          >
            <Save className="w-4 h-4 mr-2" />
            Zapisz zmiany
          </Button>
          <Button
            variant="destructive"
            onClick={onDiscard}
            className="w-full justify-start"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Porzuć zmiany
          </Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
