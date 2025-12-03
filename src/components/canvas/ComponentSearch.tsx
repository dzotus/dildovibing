import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useUIStore } from '@/store/useUIStore';
import { COMPONENT_LIBRARY } from '@/data/components';
import { Search, X, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ComponentSearch() {
  const { nodes, selectNode, zoom, pan, setPan, setZoom } = useCanvasStore();
  const { searchQuery, setSearchQuery, highlightedNodeId, setHighlightedNodeId } = useUIStore();
  const [isOpen, setIsOpen] = useState(false);

  const filteredNodes = useMemo(() => {
    if (!searchQuery.trim()) return [];
    
    const query = searchQuery.toLowerCase();
    return nodes.filter(node => {
      const component = COMPONENT_LIBRARY.find(c => c.type === node.type);
      const label = node.data?.label || '';
      const type = node.type || '';
      const category = component?.category || '';
      
      return (
        label.toLowerCase().includes(query) ||
        type.toLowerCase().includes(query) ||
        category.toLowerCase().includes(query)
      );
    });
  }, [nodes, searchQuery]);

  const handleSelectNode = (nodeId: string) => {
    selectNode(nodeId);
    setHighlightedNodeId(nodeId);
    
    // Center on node
    const node = nodes.find(n => n.id === nodeId);
    if (node && isOpen) {
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2;
      const nodeCenterX = node.position.x + 70;
      const nodeCenterY = node.position.y + 70;
      
      const newPanX = centerX - nodeCenterX * zoom;
      const newPanY = centerY - nodeCenterY * zoom;
      
      setPan({ x: newPanX, y: newPanY });
      
      // Zoom to fit if needed
      if (zoom < 0.8) {
        setZoom(1);
      }
    }
    
    // Clear highlight after 2 seconds
    setTimeout(() => setHighlightedNodeId(null), 2000);
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search components..."
          value={searchQuery}
          onChange={(e) => {
            setSearchQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          className="pl-8 pr-8 w-64"
        />
        {searchQuery && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-0 top-1/2 transform -translate-y-1/2 h-6 w-6"
            onClick={() => {
              setSearchQuery('');
              setIsOpen(false);
              setHighlightedNodeId(null);
            }}
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </div>
      
      {isOpen && searchQuery && (
        <div className="absolute top-full left-0 mt-1 w-64 bg-card border border-border rounded-md shadow-lg z-50 max-h-80 overflow-hidden">
          {filteredNodes.length > 0 ? (
            <ScrollArea className="max-h-80">
              <div className="p-1">
                {filteredNodes.map((node) => {
                  const component = COMPONENT_LIBRARY.find(c => c.type === node.type);
                  const isHighlighted = highlightedNodeId === node.id;
                  
                  return (
                    <button
                      key={node.id}
                      onClick={() => handleSelectNode(node.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-sm hover:bg-accent transition-colors flex items-center justify-between",
                        isHighlighted && "bg-accent"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {node.data?.label || node.type}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {component?.category || 'Unknown'} • {node.type}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 ml-2" />
                    </button>
                  );
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No components found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

