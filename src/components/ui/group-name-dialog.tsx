import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface GroupNameDialogProps {
  open: boolean;
  initialName?: string;
  onConfirm: (name: string) => void;
  onCancel: () => void;
}

export function GroupNameDialog({ open, initialName = '', onConfirm, onCancel }: GroupNameDialogProps) {
  const [name, setName] = React.useState(initialName);

  React.useEffect(() => {
    if (open) {
      setName(initialName);
    }
  }, [open, initialName]);

  const handleConfirm = () => {
    if (name.trim()) {
      onConfirm(name.trim());
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{initialName ? 'Переименовать группу' : 'Создать группу'}</DialogTitle>
          <DialogDescription>
            {initialName ? 'Введите новое название группы' : 'Введите название для новой группы'}
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="group-name">Название группы</Label>
          <Input
            id="group-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleConfirm();
              }
            }}
            className="mt-2"
            autoFocus
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Отмена
          </Button>
          <Button onClick={handleConfirm} disabled={!name.trim()}>
            {initialName ? 'Сохранить' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

