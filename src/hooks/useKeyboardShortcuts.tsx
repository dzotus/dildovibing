import { useEffect } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useHistoryStore } from '@/store/useHistoryStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { useUIStore } from '@/store/useUIStore';

export function useKeyboardShortcuts() {
  const {
    undo,
    redo,
    zoom,
    setZoom,
    pan,
    setPan,
    resetCanvas,
    saveDiagram,
    selectedConnectionId,
    selectedNodeId,
    selectedGroupId,
    nodes,
    deleteConnection,
    deleteNode,
    deleteGroup,
    selectConnection,
    selectNode,
    selectGroup,
  } = useCanvasStore();
  const { canUndo, canRedo } = useHistoryStore();
  const { isRunning, start, stop } = useEmulationStore();
  const { showMinimap, toggleMinimap, showHeatMapLegend, toggleHeatMapLegend } = useUIStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;

      // Undo: Ctrl/Cmd + Z
      if (isCtrlOrCmd && e.key === 'z' && !e.shiftKey && canUndo) {
        e.preventDefault();
        undo();
        return;
      }

      // Redo: Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y
      if (
        isCtrlOrCmd &&
        ((e.key === 'z' && e.shiftKey) || e.key === 'y') &&
        canRedo
      ) {
        e.preventDefault();
        redo();
        return;
      }

      // Zoom in: Ctrl/Cmd + =
      if (isCtrlOrCmd && (e.key === '=' || e.key === '+')) {
        e.preventDefault();
        setZoom(Math.min(zoom + 0.1, 2));
        return;
      }

      // Zoom out: Ctrl/Cmd + -
      if (isCtrlOrCmd && e.key === '-') {
        e.preventDefault();
        setZoom(Math.max(zoom - 0.1, 0.5));
        return;
      }

      // Reset zoom & pan: Ctrl/Cmd + 0
      if (isCtrlOrCmd && e.key === '0') {
        e.preventDefault();
        setZoom(1);
        setPan({ x: 0, y: 0 });
        return;
      }

      // Pan with arrow keys (no Ctrl/Cmd, to not конфликт with browser shortcuts)
      const panStep = 50;
      if (!isCtrlOrCmd) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          setPan({ x: pan.x + panStep, y: pan.y });
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          setPan({ x: pan.x - panStep, y: pan.y });
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setPan({ x: pan.x, y: pan.y + panStep });
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setPan({ x: pan.x, y: pan.y - panStep });
          return;
        }
      }

      // Toggle simulation: Space (without Ctrl/Cmd), when focused on body
      if (!isCtrlOrCmd && e.key === ' ') {
        e.preventDefault();
        if (isRunning) {
          stop();
        } else {
          // Initialize nodes & connections implicitly from current canvas state
          const { nodes, connections } = useCanvasStore.getState();
          useEmulationStore.getState().initialize(nodes, connections);
          start();
        }
        return;
      }

      // Save diagram: Ctrl/Cmd + S
      if (isCtrlOrCmd && (e.key === 's' || e.key === 'ы')) {
        e.preventDefault();
        saveDiagram();
        return;
      }

      // Toggle minimap: Ctrl/Cmd + M
      if (isCtrlOrCmd && (e.key === 'm' || e.key === 'ь')) {
        e.preventDefault();
        toggleMinimap();
        return;
      }

      // Toggle heat map legend: Ctrl/Cmd + H
      if (isCtrlOrCmd && (e.key === 'h' || e.key === 'р')) {
        e.preventDefault();
        toggleHeatMapLegend();
        return;
      }

      // Delete selected items: Delete or Backspace
      if ((e.key === 'Delete' || e.key === 'Backspace') && !isCtrlOrCmd) {
        // Check if input/textarea is focused - don't delete if user is typing
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable
        );
        
        if (isInputFocused) return;

        e.preventDefault();

        // Delete selected connection
        if (selectedConnectionId) {
          deleteConnection(selectedConnectionId);
          selectConnection(null);
          return;
        }

        // Delete selected group
        if (selectedGroupId) {
          deleteGroup(selectedGroupId);
          selectGroup(null);
          return;
        }

        // Delete selected nodes (including multi-selected)
        const selectedNodes = nodes.filter(n => n.selected);
        if (selectedNodes.length > 0) {
          selectedNodes.forEach(node => deleteNode(node.id));
          selectNode(null);
          return;
        }

        // Delete single selected node (if no multi-selection)
        if (selectedNodeId) {
          deleteNode(selectedNodeId);
          selectNode(null);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    undo,
    redo,
    canUndo,
    canRedo,
    zoom,
    setZoom,
    pan,
    setPan,
    resetCanvas,
    saveDiagram,
    isRunning,
    start,
    stop,
    showMinimap,
    toggleMinimap,
    showHeatMapLegend,
    toggleHeatMapLegend,
    selectedConnectionId,
    selectedNodeId,
    selectedGroupId,
    nodes,
    deleteConnection,
    deleteNode,
    deleteGroup,
    selectConnection,
    selectNode,
    selectGroup,
  ]);
}
