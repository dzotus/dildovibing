import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { Search, ChevronDown, ChevronRight, Star, Plus, X, FolderPlus } from 'lucide-react';
import { COMPONENT_LIBRARY, COMPONENT_CATEGORIES } from '@/data/components';
import { ComponentCollection, ComponentType } from '@/types';
import { useComponentLibraryStore } from '@/store/useComponentLibraryStore';

export function Sidebar() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
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
    const name = window.prompt('Название новой подборки');
    if (name) {
      createCollection(name);
    }
  };

  const handleCreateCollectionAndAdd = (componentId: string) => {
    const name = window.prompt('Название новой подборки');
    if (name) {
      const collectionId = createCollection(name);
      if (collectionId) {
        addComponentToCollection(collectionId, componentId);
      }
    }
  };

  const handleRenameCollection = (collection: ComponentCollection) => {
    const name = window.prompt('Новое название подборки', collection.name);
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    renameCollection(collection.id, trimmed);
  };

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
        className={`flex items-center gap-2 px-3 ${
          options?.compact ? 'py-1.5 text-xs' : 'py-2 text-sm'
        } rounded-md bg-secondary/50 hover:bg-secondary cursor-move transition-colors border border-border/50`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{component.icon}</span>
          <span className="text-foreground">{component.label}</span>
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
            title={isFavorite ? 'Удалить из избранного' : 'Добавить в избранное'}
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
                title="Добавить в подборку"
              >
                <Plus className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {collections.length === 0 && (
                <>
                  <DropdownMenuLabel>Подборки отсутствуют</DropdownMenuLabel>
                  <DropdownMenuItem
                    onSelect={(e) => {
                      e.preventDefault();
                      handleCreateCollectionAndAdd(component.id);
                    }}
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    Создать и добавить
                  </DropdownMenuItem>
                </>
              )}

              {collections.length > 0 && (
                <>
                  <DropdownMenuLabel>Добавить в подборку</DropdownMenuLabel>
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
                    Новая подборка
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
              title="Удалить из подборки"
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
    <div className="w-64 h-full bg-sidebar-bg border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground mb-3">Components</h2>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search components..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
      </div>

      <div className="px-4 py-2 border-b border-border">
        <Tabs value={activeCategory} onValueChange={setActiveCategory}>
          <ScrollArea orientation="horizontal">
            <TabsList className="flex w-max space-x-1">
              <TabsTrigger value="all" className="text-xs">
                Все
              </TabsTrigger>
              {COMPONENT_CATEGORIES.map((category) => (
                <TabsTrigger key={category.id} value={category.id} className="text-xs">
                  {category.icon}
                </TabsTrigger>
              ))}
            </TabsList>
          </ScrollArea>
        </Tabs>
      </div>

      {favoritesComponents.length > 0 && (
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase text-muted-foreground">Избранное</span>
            <span className="text-xs text-muted-foreground">{favoritesComponents.length}</span>
          </div>
          <div className="space-y-1">
            {favoritesComponents.map((component) => renderComponentCard(component, { compact: true }))}
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="p-2">
          {visibleCategories.map((category) => {
            const categoryComponents = filteredComponents.filter(
              (c) => c.category === category.id
            );

            if (categoryComponents.length === 0 && search) return null;

            return (
              <div key={category.id} className="mb-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start px-2 h-8 text-sm"
                  onClick={() => toggleCategory(category.id)}
                >
                  {expandedCategories[category.id] ? (
                    <ChevronDown className="h-4 w-4 mr-1" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-1" />
                  )}
                  <span className="mr-2">{category.icon}</span>
                  {category.label}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {categoryComponents.length}
                  </span>
                </Button>

                {expandedCategories[category.id] && (
                  <div className="ml-2 mt-1 space-y-1">
                    {categoryComponents.map((component) => renderComponentCard(component))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <div className="p-3 border-t border-border space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase font-semibold text-muted-foreground">Подборки</span>
          <Button size="xs" variant="outline" onClick={handleCreateCollection}>
            <Plus className="h-3 w-3 mr-1" />
            Новая
          </Button>
        </div>

        {collections.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Создайте подборку, чтобы быстрее собирать типовые архитектуры.
          </p>
        )}

        {collections.map((collection) => {
          const componentsInCollection = collection.componentIds
            .map((id) => COMPONENT_LIBRARY.find((component) => component.id === id))
            .filter((component): component is ComponentType => Boolean(component))
            .filter((component) => component.label.toLowerCase().includes(searchValue));

          return (
            <div key={collection.id} className="rounded-md border border-border/60 p-2">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-foreground">{collection.name}</p>
                  <p className="text-xs text-muted-foreground">{componentsInCollection.length} компонентов</p>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title="Переименовать"
                    onClick={() => handleRenameCollection(collection)}
                  >
                    ✏️
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    title="Удалить подборку"
                    onClick={() => deleteCollection(collection.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {componentsInCollection.length === 0 ? (
                <p className="text-xs text-muted-foreground">Добавьте компоненты через меню “+”.</p>
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
        })}
      </div>
    </div>
  );
}