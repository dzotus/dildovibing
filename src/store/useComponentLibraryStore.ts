import { create } from 'zustand';
import { ComponentCollection } from '@/types';

const STORAGE_KEY = 'archiphoenix_component_library';

interface ComponentLibraryState {
  favorites: string[];
  collections: ComponentCollection[];
  toggleFavorite: (componentId: string) => void;
  createCollection: (name: string) => string | null;
  renameCollection: (collectionId: string, name: string) => void;
  deleteCollection: (collectionId: string) => void;
  addComponentToCollection: (collectionId: string, componentId: string) => void;
  removeComponentFromCollection: (collectionId: string, componentId: string) => void;
}

const loadState = (): Pick<ComponentLibraryState, 'favorites' | 'collections'> => {
  if (typeof window === 'undefined') {
    return { favorites: [], collections: [] };
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { favorites: [], collections: [] };
    }
    const parsed = JSON.parse(raw);
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      collections: Array.isArray(parsed.collections) ? parsed.collections : [],
    };
  } catch (error) {
    console.warn('Failed to load component library state', error);
    return { favorites: [], collections: [] };
  }
};

const persistState = (state: Pick<ComponentLibraryState, 'favorites' | 'collections'>) => {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
};

export const useComponentLibraryStore = create<ComponentLibraryState>((set, get) => ({
  favorites: loadState().favorites,
  collections: loadState().collections,

  toggleFavorite: (componentId) => {
    set((state) => {
      const exists = state.favorites.includes(componentId);
      const favorites = exists
        ? state.favorites.filter((id) => id !== componentId)
        : [...state.favorites, componentId];
      persistState({ favorites, collections: state.collections });
      return { favorites };
    });
  },

  createCollection: (name) => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const newCollection: ComponentCollection = {
      id: `collection-${Date.now()}`,
      name: trimmed,
      componentIds: [],
    };

    set((state) => {
      const collections = [...state.collections, newCollection];
      persistState({ favorites: state.favorites, collections });
      return { collections };
    });

    return newCollection.id;
  },

  renameCollection: (collectionId, name) => {
    set((state) => {
      const collections = state.collections.map((collection) =>
        collection.id === collectionId ? { ...collection, name } : collection
      );
      persistState({ favorites: state.favorites, collections });
      return { collections };
    });
  },

  deleteCollection: (collectionId) => {
    set((state) => {
      const collections = state.collections.filter((collection) => collection.id !== collectionId);
      persistState({ favorites: state.favorites, collections });
      return { collections };
    });
  },

  addComponentToCollection: (collectionId, componentId) => {
    set((state) => {
      const collections = state.collections.map((collection) => {
        if (collection.id !== collectionId) return collection;
        if (collection.componentIds.includes(componentId)) return collection;
        return { ...collection, componentIds: [...collection.componentIds, componentId] };
      });
      persistState({ favorites: state.favorites, collections });
      return { collections };
    });
  },

  removeComponentFromCollection: (collectionId, componentId) => {
    set((state) => {
      const collections = state.collections.map((collection) => {
        if (collection.id !== collectionId) return collection;
        return {
          ...collection,
          componentIds: collection.componentIds.filter((id) => id !== componentId),
        };
      });
      persistState({ favorites: state.favorites, collections });
      return { collections };
    });
  },
}));

