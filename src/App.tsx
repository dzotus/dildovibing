import { Toolbar } from './components/layout/Toolbar';
import { Sidebar } from './components/layout/Sidebar';
import { PropertiesPanel } from './components/layout/PropertiesPanel';
import { TabBar } from './components/layout/TabBar';
import { Canvas } from './components/canvas/Canvas';
import { ComponentConfigRenderer } from './components/config/ComponentConfigRenderer';
import { useTabStore } from './store/useTabStore';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NodeRefsProvider } from './contexts/NodeRefsContext';
import { ResizeObserverProvider } from './contexts/ResizeObserverContext';

function App() {
  useKeyboardShortcuts();
  const { tabs } = useTabStore();
  const activeTab = tabs.find((tab) => tab.active);

  return (
    <ErrorBoundary>
      <ResizeObserverProvider>
        <NodeRefsProvider>
    <div className="h-screen flex flex-col bg-background">
      <Toolbar />
      <TabBar />
      <div className="flex-1 flex overflow-hidden">
            <ErrorBoundary>
        <Sidebar />
            </ErrorBoundary>
            <ErrorBoundary>
        {activeTab?.type === 'diagram' ? (
          <Canvas />
        ) : activeTab?.type === 'component' && activeTab.componentId && activeTab.componentType ? (
          <div className="flex-1 overflow-hidden">
            <ComponentConfigRenderer
              componentId={activeTab.componentId}
              componentType={activeTab.componentType}
            />
          </div>
        ) : (
          <Canvas />
        )}
            </ErrorBoundary>
            <ErrorBoundary>
        <PropertiesPanel />
            </ErrorBoundary>
      </div>
    </div>
        </NodeRefsProvider>
      </ResizeObserverProvider>
    </ErrorBoundary>
  );
}

export default App;