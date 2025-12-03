import { useMemo, useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, ChevronDown, ChevronRight, Star, Plus, X, FolderPlus, GripVertical } from 'lucide-react';
import { COMPONENT_LIBRARY, COMPONENT_CATEGORIES } from '@/data/components';
import { ComponentCollection, ComponentType } from '@/types';
import { useComponentLibraryStore } from '@/store/useComponentLibraryStore';
import { CollectionNameDialog } from '@/components/ui/collection-name-dialog';

export function Sidebar() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [showCreateCollectionDialog, setShowCreateCollectionDialog] = useState(false);
  const [showCreateAndAddDialog, setShowCreateAndAddDialog] = useState(false);
  const [editingCollection, setEditingCollection] = useState<ComponentCollection | null>(null);
  const [componentToAdd, setComponentToAdd] = useState<string | null>(null);
  const [collectionsHeight, setCollectionsHeight] = useState<number>(180); // Default: ~2.5 collections
  const [isResizing, setIsResizing] = useState(false);
  const resizeRef = useRef<HTMLDivElement>(null);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
    () =>
      COMPONENT_CATEGORIES.reduce(
        (acc, category) => {
          acc[category.id] = true;
          return acc;
        },
        {} as Record<string, boolean>
      )
  );
  const {
    favorites,
    collections,
    toggleFavorite,
    createCollection,
    renameCollection,
    deleteCollection,
    addComponentToCollection,
    removeComponentFromCollection,
  } = useComponentLibraryStore();

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const searchValue = search.toLowerCase();
  const filteredComponents = useMemo(
    () =>
      COMPONENT_LIBRARY.filter((comp) =>
        comp.label.toLowerCase().includes(searchValue)
      ),
    [searchValue]
  );

  const favoritesComponents = useMemo(
    () => filteredComponents.filter((component) => favorites.includes(component.id)),
    [favorites, filteredComponents]
  );

  const handleDragStart = (e: React.DragEvent, component: ComponentType) => {
    e.dataTransfer.setData('application/json', JSON.stringify(component));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleCreateCollection = () => {
    setEditingCollection(null);
    setShowCreateCollectionDialog(true);
  };

  const handleCollectionNameConfirm = (name: string) => {
    if (editingCollection) {
      // Rename existing collection
      renameCollection(editingCollection.id, name);
      setEditingCollection(null);
    } else {
      // Create new collection
      // Check for duplicate names
      const isDuplicate = collections.some(c => c.name.toLowerCase() === name.toLowerCase());
      if (isDuplicate) {
        alert('A collection with this name already exists');
        return;
      }
      const collectionId = createCollection(name);
      if (!collectionId) {
        alert('Failed to create collection');
      }
    }
    setShowCreateCollectionDialog(false);
  };

  const handleCollectionNameCancel = () => {
    setShowCreateCollectionDialog(false);
    setEditingCollection(null);
  };

  const handleCreateCollectionAndAdd = (componentId: string) => {
    setComponentToAdd(componentId);
    setEditingCollection(null);
    setShowCreateAndAddDialog(true);
  };

  const handleCreateAndAddConfirm = (name: string) => {
    if (!componentToAdd) return;
    
    // Check for duplicate names
    const isDuplicate = collections.some(c => c.name.toLowerCase() === name.toLowerCase());
    if (isDuplicate) {
      alert('A collection with this name already exists');
      return;
    }
    
    const collectionId = createCollection(name);
    if (collectionId) {
      addComponentToCollection(collectionId, componentToAdd);
    } else {
      alert('Failed to create collection');
    }
    
    setShowCreateAndAddDialog(false);
    setComponentToAdd(null);
  };

  const handleCreateAndAddCancel = () => {
    setShowCreateAndAddDialog(false);
    setComponentToAdd(null);
  };

  const handleRenameCollection = (collection: ComponentCollection) => {
    setEditingCollection(collection);
    setShowCreateCollectionDialog(true);
  };

  // Resize handle logic
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      
      const sidebar = resizeRef.current.closest('.h-full');
      if (!sidebar) return;
      
      const sidebarRect = sidebar.getBoundingClientRect();
      const handleRect = resizeRef.current.getBoundingClientRect();
      const newHeight = sidebarRect.bottom - e.clientY;
      
      // Min height: ~1 collection (~70px), Max height: ~80% of sidebar
      const minHeight = 70;
      const maxHeight = sidebarRect.height * 0.8;
      
      setCollectionsHeight(Math.max(minHeight, Math.min(maxHeight, newHeight)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  const renderComponentCard = (
    component: ComponentType,
    options?: { compact?: boolean; onRemove?: () => void }
  ) => {
    const isFavorite = favorites.includes(component.id);

    return (
      <div
        key={`${component.id}-${options?.compact ? 'compact' : 'default'}`}
        draggable
        onDragStart={(e) => handleDragStart(e, component)}
        className={`flex items-center gap-1 px-1 ${
          options?.compact ? 'py-0.5 text-[10px]' : 'py-1 text-xs'
        } rounded-md bg-secondary/50 hover:bg-secondary cursor-move transition-colors border border-border/50`}
      >
        <div className="flex items-center gap-0.5 flex-1 min-w-0">
          <span className="text-sm flex-shrink-0">{component.icon}</span>
          <span className="text-foreground truncate min-w-0">{component.label}</span>
        </div>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleFavorite(component.id);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            className="p-1 rounded-md hover:bg-muted transition-colors"
            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Star
              className={`h-4 w-4 ${isFavorite ? 'text-yellow-400' : 'text-muted-foreground'}`}
              fill={isFavorite ? 'currentColor' : 'none'}
            />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onMouseDown={(e) => e.stopPropagation()}
                className="p-1 rounded-md hover:bg-muted transition-colors"
                title="Add to collection"
              >
                <Plus className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {collections.length === 0 && (
                <>
                  <DropdownMenuLabel>No collections</DropdownMenuLabel>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      handleCreateCollectionAndAdd(component.id);
                    }}
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Create and add
                  </DropdownMenuItem>
                </>
              )}

              {collections.length > 0 && (
                <>
                  <DropdownMenuLabel>Add to collection</DropdownMenuLabel>
                  {collections.map((collection) => (
                    <DropdownMenuItem
                      key={collection.id}
                      onSelect={(e) => {
                        e.preventDefault();
                        addComponentToCollection(collection.id, component.id);
                      }}
                    >
                      {collection.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      handleCreateCollectionAndAdd(component.id);
                    }}
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    New collection
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {options?.onRemove && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                options.onRemove?.();
              }}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-1 rounded-md hover:bg-muted transition-colors"
              title="Remove from collection"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const visibleCategories =
    activeCategory === 'all'
      ? COMPONENT_CATEGORIES
      : COMPONENT_CATEGORIES.filter((category) => category.id === activeCategory);

  return (
    <div className="w-60 h-full bg-sidebar-bg border-r border-border flex flex-col">
      <div className="p-3 border-b border-border">
        <h2 className="text-xs font-semibold text-foreground mb-2">Components</h2>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-7 h-8 text-xs"
          />
        </div>
      </div>

      <div className="px-3 py-1.5 border-b border-border pb-2">
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <ScrollArea orientation="horizontal" className="w-full">
            <TabsList className="flex w-max gap-0.5">
              <TabsTrigger value="all" className="text-xs px-2 py-1">
                All
              </TabsTrigger>
              {COMPONENT_CATEGORIES.map((category) => (
                <TabsTrigger key={category.id} value={category.id} className="text-xs px-2 py-1">
                  {category.icon}
                </TabsTrigger>
              ))}
            </TabsList>
            <ScrollBar 
              orientation="horizontal" 
              className="data-[state=visible]:bg-accent/20 data-[state=visible]:hover:bg-accent/30 [&>[data-radix-scroll-area-thumb]]:bg-accent/80 hover:[&>[data-radix-scroll-area-thumb]]:bg-accent rounded-full"
              style={{ transition: 'none' }}
            />
          </ScrollArea>
        </Tabs>
      </div>

      {favoritesComponents.length > 0 && (
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase text-muted-foreground">Favorites</span>
            <span className="text-[10px] text-muted-foreground">{favoritesComponents.length}</span>
          </div>
          <div className="space-y-1">
            {favoritesComponents.map((component) => renderComponentCard(component, { compact: true }))}
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="pl-3 pr-6 py-2">
          {visibleCategories.map((category) => {
            const categoryComponents = filteredComponents.filter(
              (c) => c.category === category.id
            );

            if (categoryComponents.length === 0 && search) return null;

            return (
              <div key={category.id} className="mb-1.5">
                <Button
                  variant="ghost"
                  className="w-full justify-start px-1 h-7 text-xs"
                  onClick={() => toggleCategory(category.id)}
                >
                  {expandedCategories[category.id] ? (
                    <ChevronDown className="h-3.5 w-3.5 mr-0.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 mr-0.5" />
                  )}
                  <span className="mr-1">{category.icon}</span>
                  <span className="flex-1 text-left truncate min-w-0 mr-1">{category.label}</span>
                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                    {categoryComponents.length}
                  </span>
                </Button>

                {expandedCategories[category.id] && (
                  <div className="ml-1.5 mt-1 space-y-1">
                    {categoryComponents.map((component) => renderComponentCard(component, { compact: true }))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      {/* Resize handle - with spacing to prevent conflicts */}
      <div
        ref={resizeRef}
        className="h-2 border-t border-border cursor-row-resize hover:bg-accent/50 transition-colors relative group flex items-center justify-center"
        onMouseDown={(e) => {
          e.preventDefault();
          setIsResizing(true);
        }}
        style={{ userSelect: 'none' }}
      >
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
          <GripVertical className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>

      <div 
        className="border-t border-border overflow-hidden flex flex-col"
        style={{ height: `${collectionsHeight}px` }}
      >
        <div className="p-2 pb-1.5 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-semibold text-muted-foreground">Collections</span>
            <Button 
              size="xs" 
              variant="outline" 
              className="h-6 text-[10px] px-2" 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCreateCollection();
              }}
              type="button"
            >
              <Plus className="h-3 w-3 mr-0.5" />
              New
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="pl-1.5 pr-4 pb-2 space-y-1.5">
            {collections.length === 0 ? (
              <p className="text-[10px] text-muted-foreground px-0.5">
                Create collections to quickly build typical architectures.
              </p>
            ) : (
              collections.map((collection) => {
                const componentsInCollection = collection.componentIds
                  .map((id) => COMPONENT_LIBRARY.find((component) => component.id === id))
                  .filter((component): component is ComponentType => Boolean(component))
                  .filter((component) => component.label.toLowerCase().includes(searchValue));

                return (
                  <div key={collection.id} className="rounded-md border border-border/60 p-1.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{collection.name}</p>
                        <p className="text-[10px] text-muted-foreground">{componentsInCollection.length} items</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Rename"
                          onClick={() => handleRenameCollection(collection)}
                        >
                          ✏️
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          title="Delete collection"
                          onClick={() => deleteCollection(collection.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {componentsInCollection.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground">Add components via "+" menu.</p>
                    ) : (
                      <div className="space-y-1">
                        {componentsInCollection.map((component) =>
                          renderComponentCard(component, {
                            compact: true,
                            onRemove: () => removeComponentFromCollection(collection.id, component.id),
                          })
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </ScrollArea>
      </div>
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase font-semibold text-muted-foreground">Collections</span>
          <Button 
            size="xs" 
            variant="outline" 
            className="h-6 text-[10px] px-2" 
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              handleCreateCollection();
            }}
            type="button"
          >
            <Plus className="h-3 w-3 mr-0.5" />
            New
          </Button>
        </div>


      {/* Create/Rename Collection Dialog */}
      <CollectionNameDialog
        open={showCreateCollectionDialog}
        initialName={editingCollection?.name || ''}
        onConfirm={handleCollectionNameConfirm}
        onCancel={handleCollectionNameCancel}
      />

      {/* Create Collection and Add Dialog */}
      <CollectionNameDialog
        open={showCreateAndAddDialog}
        initialName=""
        onConfirm={handleCreateAndAddConfirm}
        onCancel={handleCreateAndAddCancel}
      />
    </div>
  );
}