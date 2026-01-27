import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { EmulationPanel } from '@/components/emulation/EmulationPanel';
import { ComponentSearch } from '@/components/canvas/ComponentSearch';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  Save,
  Download,
  Upload,
  Settings,
  Undo2,
  Redo2,
  Map,
  Activity,
  Layers,
  Sparkles,
  Ruler,
} from 'lucide-react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useUIStore } from '@/store/useUIStore';
import { logError } from '@/utils/logger';
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
import { GroupNameDialog } from '@/components/ui/group-name-dialog';

export function Toolbar() {
  const {
    zoom,
    setZoom,
    diagramName,
    setDiagramName,
    saveDiagram,
    loadDiagramState,
    undo,
    redo,
    selectedNodeId,
    createGroupFromSelection,
    autoGroupByConnections,
    nodes,
    pan,
    setPan,
    viewportWidth,
    viewportHeight,
  } = useCanvasStore();
  const { canUndo, canRedo } = useHistoryStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [newName, setNewName] = useState(diagramName);
  const [showGroupNameDialog, setShowGroupNameDialog] = useState(false);
  const { showMinimap, toggleMinimap, showHeatMapLegend, toggleHeatMapLegend, showRuler, toggleRuler } = useUIStore();

  const handleZoomIn = () => setZoom(Math.min(zoom + 0.1, 2));
  const handleZoomOut = () => setZoom(zoom - 0.1);
  const handleZoomReset = () => {
    const allNodes = nodes;
    if (!allNodes.length) {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      return;
    }

    // Compute world bounds of all nodes (including size 140x140)
    const padding = 100;
    const xs1 = allNodes.map((n) => n.position.x);
    const ys1 = allNodes.map((n) => n.position.y);
    const xs2 = allNodes.map((n) => n.position.x + 140);
    const ys2 = allNodes.map((n) => n.position.y + 140);

    const minX = Math.min(...xs1) - padding;
    const minY = Math.min(...ys1) - padding;
    const maxX = Math.max(...xs2) + padding;
    const maxY = Math.max(...ys2) + padding;

    const worldWidth = maxX - minX;
    const worldHeight = maxY - minY;

    const vw = viewportWidth || window.innerWidth;
    const vh = viewportHeight || (window.innerHeight - 56);

    const scaleX = vw / worldWidth;
    const scaleY = vh / worldHeight;
    let newZoom = Math.min(scaleX, scaleY);
    newZoom = Math.min(Math.max(newZoom, 0.2), 2.5);

    // Center bounds in viewport (canvas viewport coordinates)
    const worldCenterX = minX + worldWidth / 2;
    const worldCenterY = minY + worldHeight / 2;
    const viewCenterX = vw / 2;
    const viewCenterY = vh / 2;

    const newPanX = viewCenterX - worldCenterX * newZoom;
    const newPanY = viewCenterY - worldCenterY * newZoom;

    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

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
        nodes: diagram.nodes || [],
        connections: diagram.connections || [],
        groups: diagram.groups || [],
        zoom: diagram.zoom || 1,
        pan: diagram.pan || { x: 0, y: 0 },
      });

      // Update diagram name
      setDiagramName(diagram.name);

      toast.success(`Diagram "${diagram.name}" imported successfully`);
    } catch (error) {
      toast.error('Failed to import diagram');
      logError('Failed to import diagram', error instanceof Error ? error : new Error(String(error)));
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

  const handleCreateGroup = () => {
    const { nodes } = useCanvasStore.getState();
    const selectedNodes = nodes.filter((n) => n.selected || n.id === selectedNodeId);
    
    if (selectedNodes.length === 0) {
      toast.error('Select at least one component to create a group');
      return;
    }
    
    setShowGroupNameDialog(true);
  };

  const handleGroupNameConfirm = (name: string) => {
    createGroupFromSelection(name);
    toast.success(`Group "${name}" created`);
    setShowGroupNameDialog(false);
  };

  const handleAutoGroup = () => {
    autoGroupByConnections();
    toast.success('Groups created automatically from connections');
  };

  return (
    <>
      <GroupNameDialog
        open={showGroupNameDialog}
        onConfirm={handleGroupNameConfirm}
        onCancel={() => setShowGroupNameDialog(false)}
      />

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

          <Separator orientation="vertical" className="h-6 mx-2" />

          <ComponentSearch />
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-secondary/50 rounded-md p-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomIn}
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <span className="text-sm font-mono px-2 min-w-[60px] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomOut}
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={handleZoomReset}
              title="Fit to View"
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
            <Upload className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={handleImportClick}
            title="Import diagram from JSON file"
          >
            <Download className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          {/* Group controls */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            title="Create group from selection"
            onClick={handleCreateGroup}
            disabled={!selectedNodeId}
          >
            <Layers className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            title="Auto-group by connections"
            onClick={handleAutoGroup}
          >
            <Sparkles className="h-4 w-4" />
          </Button>

          <Separator orientation="vertical" className="h-6" />

          <EmulationPanel />

          <Button 
            variant={showMinimap ? "default" : "ghost"} 
            size="icon" 
            className="h-9 w-9" 
            title={showMinimap ? "Hide minimap" : "Show minimap"}
            onClick={toggleMinimap}
          >
            <Map className="h-4 w-4" />
          </Button>

          <Button 
            variant={showHeatMapLegend ? "default" : "ghost"} 
            size="icon" 
            className="h-9 w-9" 
            title={showHeatMapLegend ? "Hide heat map legend" : "Show heat map legend"}
            onClick={toggleHeatMapLegend}
          >
            <Activity className="h-4 w-4" />
          </Button>

          <Button 
            variant={showRuler ? "default" : "ghost"} 
            size="icon" 
            className="h-9 w-9" 
            title={showRuler ? "Hide ruler" : "Show ruler"}
            onClick={toggleRuler}
          >
            <Ruler className="h-4 w-4" />
          </Button>

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
              onKeyDown={(e) => {
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
