import { DiagramState } from '@/types';
import { debounce } from './debounce';
import { logWarn, logError, logInfo } from './logger';
import { migrateProtocolsToConnections, needsProtocolMigration } from './migration';

const STORAGE_KEY = 'archiphoenix_diagram';
const CURRENT_VERSION = 2; // Incremented for protocol migration
const SAVE_DEBOUNCE_MS = 500; // Задержка для debounce сохранения

export interface StoredDiagram extends DiagramState {
  version: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Apply migrations to diagram based on version
 */
function applyMigrations(diagram: StoredDiagram): StoredDiagram | null {
  try {
    let migratedDiagram = diagram;

    // Migration from version 1 to 2: Protocol nodes → Connection protocols
    if (diagram.version < 2) {
      logInfo(`Migrating diagram from version ${diagram.version} to ${CURRENT_VERSION}`);
      
      if (needsProtocolMigration(migratedDiagram)) {
        const { state, result } = migrateProtocolsToConnections(migratedDiagram);
        
        if (result.success) {
          migratedDiagram = {
            ...state,
            version: CURRENT_VERSION,
            name: migratedDiagram.name,
            createdAt: migratedDiagram.createdAt,
            updatedAt: new Date().toISOString(),
          };
          
          logInfo(
            `Migration successful: ${result.migratedNodes} nodes, ${result.migratedConnections} connections`
          );
          
          if (result.errors.length > 0) {
            logWarn(`Migration warnings: ${result.errors.join('; ')}`);
          }
        } else {
          logError('Migration failed', new Error(result.errors.join('; ')));
          return null;
        }
      } else {
        // No migration needed, just update version
        migratedDiagram = {
          ...migratedDiagram,
          version: CURRENT_VERSION,
          updatedAt: new Date().toISOString(),
        };
      }
    }

    return migratedDiagram;
  } catch (error) {
    logError('Failed to apply migrations', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
}

/**
 * Load diagram from localStorage
 */
export const loadDiagramFromStorage = (): StoredDiagram | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const diagram = JSON.parse(stored) as StoredDiagram;
    
    // Validate basic structure
    if (!diagram.nodes || !diagram.connections) {
      logWarn('Invalid diagram structure');
      return null;
    }

    // Ensure groups array exists
    if (!diagram.groups) {
      diagram.groups = [];
    }

    // Apply migrations if needed
    if (diagram.version !== CURRENT_VERSION) {
      const migrated = applyMigrations(diagram);
      if (migrated) {
        // Save migrated version back to storage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
          localStorage.setItem(`${STORAGE_KEY}_createdAt`, migrated.createdAt);
        } catch (saveError) {
          logWarn('Failed to save migrated diagram', saveError instanceof Error ? saveError : new Error(String(saveError)));
        }
        return migrated;
      }
      // If migration failed, return null
      return null;
    }

    return diagram;
  } catch (error) {
    logError('Failed to load diagram from storage', error instanceof Error ? error : new Error(String(error)));
    return null;
  }
};

/**
 * Save diagram to localStorage (internal, without debounce)
 */
const _saveDiagramToStorage = (
  state: DiagramState,
  name: string = 'My Diagram'
): void => {
  try {
    const diagram: StoredDiagram = {
      ...state,
      version: CURRENT_VERSION,
      name,
      createdAt: localStorage.getItem(`${STORAGE_KEY}_createdAt`) || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(diagram));
    localStorage.setItem(`${STORAGE_KEY}_createdAt`, diagram.createdAt);
  } catch (error) {
    logError('Failed to save diagram to storage', error instanceof Error ? error : new Error(String(error)));
  }
};

/**
 * Save diagram to localStorage with debounce
 * Использует debounce для оптимизации частых сохранений
 */
export const saveDiagramToStorage = debounce(_saveDiagramToStorage, SAVE_DEBOUNCE_MS);

/**
 * Save diagram to localStorage immediately (without debounce)
 * Используется для критичных сохранений (например, перед закрытием)
 */
export const saveDiagramToStorageImmediate = (
  state: DiagramState,
  name: string = 'My Diagram'
): void => {
  _saveDiagramToStorage(state, name);
};

/**
 * Clear diagram from localStorage
 */
export const clearDiagramStorage = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(`${STORAGE_KEY}_createdAt`);
  } catch (error) {
    logError('Failed to clear diagram storage', error instanceof Error ? error : new Error(String(error)));
  }
};

/**
 * Export diagram as JSON file
 */
export const exportDiagramAsJSON = (
  state: DiagramState,
  filename: string = 'diagram.json'
): void => {
  try {
    const diagram: StoredDiagram = {
      ...state,
      version: CURRENT_VERSION,
      name: filename.replace('.json', ''),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const json = JSON.stringify(diagram, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    logError('Failed to export diagram', error instanceof Error ? error : new Error(String(error)));
  }
};

/**
 * Import diagram from JSON file
 */
export const importDiagramFromJSON = (file: File): Promise<StoredDiagram | null> => {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const content = event.target?.result as string;
          const diagram = JSON.parse(content) as StoredDiagram;

          // Validate structure
          if (
            !diagram.nodes ||
            !diagram.connections ||
            typeof diagram.zoom !== 'number' ||
            !diagram.pan
          ) {
            throw new Error('Invalid diagram format');
          }

          // Ensure groups array exists
          if (!diagram.groups) {
            diagram.groups = [];
          }

          // Ensure version exists (default to 1 for old diagrams)
          if (!diagram.version) {
            diagram.version = 1;
          }

          // Apply migrations if needed
          if (diagram.version !== CURRENT_VERSION) {
            const migrated = applyMigrations(diagram);
            if (migrated) {
              resolve(migrated);
            } else {
              logError('Migration failed during import', new Error('Migration returned null'));
              resolve(null);
            }
          } else {
            resolve(diagram);
          }
        } catch (error) {
          logError('Failed to parse diagram file', error instanceof Error ? error : new Error(String(error)));
          resolve(null);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      logError('Failed to import diagram', error instanceof Error ? error : new Error(String(error)));
      resolve(null);
    }
  });
};

/**
 * Export diagram as SVG/PNG (placeholder for future implementation)
 * For now, returns data for export
 */
export const getDiagramExportData = (state: DiagramState): string => {
  return `
  <svg width="1200" height="800" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <style>
        .node { fill: #1e293b; stroke: #475569; stroke-width: 2; }
        .label { fill: #f1f5f9; font-family: system-ui; font-size: 12px; }
        .connection { stroke: #64748b; stroke-width: 2; fill: none; }
      </style>
    </defs>
    
    <!-- Background grid -->
    <defs>
      <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#334155" stroke-width="0.5"/>
      </pattern>
    </defs>
    <rect width="1200" height="800" fill="#0f172a" />
    <rect width="1200" height="800" fill="url(#grid)" />
    
    <!-- Placeholder: connections would be rendered here -->
    <!-- Placeholder: nodes would be rendered here -->
  </svg>
  `;
};
