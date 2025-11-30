import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useTabStore } from '@/store/useTabStore';
import { X, Plus } from 'lucide-react';

export function TabBar() {
  const { tabs, setActiveTab, closeTab, addTab } = useTabStore();

  const handleNewTab = () => {
    addTab({
      title: 'Untitled Diagram',
      type: 'diagram',
    });
  };

  return (
    <TooltipProvider>
      <div className="h-10 bg-secondary/30 border-b border-border flex items-center">
        <ScrollArea className="flex-1">
          <div className="flex items-center">
            {tabs.map((tab) => (
              <div
                key={tab.id}
                className={`
                  flex items-center gap-2 px-4 h-10 border-r border-border cursor-pointer group
                  transition-colors
                  ${
                    tab.active
                      ? 'bg-canvas-bg text-foreground'
                      : 'text-muted-foreground hover:bg-secondary/50'
                  }
                `}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="text-sm truncate max-w-[200px]">{tab.title}</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Close tab</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            ))}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 rounded-none hover:bg-secondary/50"
                  onClick={handleNewTab}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>New diagram tab</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}