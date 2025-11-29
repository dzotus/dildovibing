import { DiagramState } from '@/types';

const STORAGE_KEY = 'archiphoenix_diagram';
const CURRENT_VERSION = 1;

export interface StoredDiagram extends DiagramState {
  version: number;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Load diagram from localStorage
 */
export const loadDiagramFromStorage = (): StoredDiagram | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const diagram = JSON.parse(stored) as StoredDiagram;
    
    // Validate version
    if (diagram.version !== CURRENT_VERSION) {
      console.warn('Diagram version mismatch, using defaults');
      return null;
    }

    return diagram;
  } catch (error) {
    console.error('Failed to load diagram from storage:', error);
    return null;
  }
};

/**
 * Save diagram to localStorage
 */
export const saveDiagramToStorage = (
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
    console.error('Failed to save diagram to storage:', error);
  }
};

/**
 * Clear diagram from localStorage
 */
export const clearDiagramStorage = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(`${STORAGE_KEY}_createdAt`);
  } catch (error) {
    console.error('Failed to clear diagram storage:', error);
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
    console.error('Failed to export diagram:', error);
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

          resolve(diagram);
        } catch (error) {
          console.error('Failed to parse diagram file:', error);
          resolve(null);
        }
      };
      reader.readAsText(file);
    } catch (error) {
      console.error('Failed to import diagram:', error);
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
