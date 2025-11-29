import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { EmulationPanel } from '@/components/emulation/EmulationPanel';
import {
  MousePointer2,
  Move,
  Workflow,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  Download,
  Upload,
  Play,
  Settings,
  Undo2,
  Redo2,
} from 'lucide-react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import {
  exportDiagramAsJSON,
  importDiagramFromJSON,
} from '@/utils/persistence';
import { useRef } from 'react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useState } from 'react';
import { Input } from '@/components/ui/input';

export function Toolbar() {
  const { zoom, setZoom, diagramName, setDiagramName, saveDiagram, loadDiagramState, undo, redo } =
    useCanvasStore();
  const { canUndo, canRedo } = useHistoryStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newName, setNewName] = useState(diagramName);

  const handleZoomIn = () => setZoom(Math.min(zoom + 0.1, 2));
  const handleZoomOut = () => setZoom(Math.max(zoom - 0.1, 0.5));
  const handleZoomReset = () => setZoom(1);

  const handleSave = () => {
    saveDiagram();
    toast.success('Diagram saved to browser storage');
  };

  const handleExport = () => {
    const filename = `${diagramName.replace(/\s+/g, '_')}_${Date.now()}.json`;
    exportDiagramAsJSON(useCanvasStore.getState(), filename);
    toast.success('Diagram exported as JSON');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const diagram = await importDiagramFromJSON(file);
      if (!diagram) {
        toast.error('Failed to import diagram: Invalid file format');
        return;
      }

      // Load the imported diagram
      loadDiagramState({
        nodes: diagram.nodes,
        connections: diagram.connections,
        zoom: diagram.zoom,
        pan: diagram.pan,
      });

      // Update diagram name
      setDiagramName(diagram.name);

      toast.success(`Diagram "${diagram.name}" imported successfully`);
    } catch (error) {
      toast.error('Failed to import diagram');
      console.error(error);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRenameSave = () => {
    if (newName.trim()) {
      setDiagramName(newName.trim());
      toast.success('Diagram renamed');
    }
    setShowRenameDialog(false);
  };

  return (
    <>
      <div className="h-14 bg-toolbar-bg border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRenameDialog(true)}
            className="text-lg font-semibold text-foreground hover:text-primary transition-colors cursor-pointer"
            title="Click to rename diagram"
          >
            <span className="text-primary">Archi</span>Phoenix
            <span className="text-xs text-secondary-foreground ml-2">— {diagramName}</span>
          </button>
          <Separator orientation="vertical" className="h-6 mx-2" />

          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-9 w-9" title="Select">
              <MousePointer2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" title="Pan">
              <Move className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" title="Connect">
              <Workflow className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6 mx-2" />

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={undo}
              disabled={!canUndo}
              title="Undo (Ctrl/Cmd+Z)"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={redo}
              disabled={!canRedo}
              title="Redo (Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y)"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-secondary/50 rounded-md p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomOut}
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm font-mono px-2 min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomIn}
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomReset}
              title="Reset Zoom"
            >
              <Maximize2 className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={handleSave}
            title="Save diagram to browser storage (auto-saves on changes)"
          >
            <Save className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={handleExport}
            title="Export diagram as JSON file"
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={handleImportClick}
            title="Import diagram from JSON file"
          >
            <Upload className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <EmulationPanel />

          <Button variant="ghost" size="icon" className="h-9 w-9" title="Settings">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Hidden file input for import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleImportFile}
        className="hidden"
        aria-label="Import diagram from file"
      />

      {/* Rename Dialog */}
      <AlertDialog open={showRenameDialog} onOpenChange={setShowRenameDialog}>
        <AlertDialogContent>
          <AlertDialogTitle>Rename Diagram</AlertDialogTitle>
          <AlertDialogDescription>
            Enter a new name for your diagram
          </AlertDialogDescription>
          <div className="py-4">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Diagram name"
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleRenameSave();
                }
              }}
              autoFocus
            />
          </div>
          <div className="flex gap-2 justify-end">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRenameSave}>Save</AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
