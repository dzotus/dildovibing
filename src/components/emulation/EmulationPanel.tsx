import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useEmulationStore } from '@/store/useEmulationStore';
import { useCanvasStore } from '@/store/useCanvasStore';
import { emulationEngine } from '@/core/EmulationEngine';
import { Play, Pause, RotateCcw } from 'lucide-react';

export function EmulationPanel() {
  const {
    isRunning,
    simulationTime,
    initialize,
    start,
    stop,
    reset,
  } = useEmulationStore();

  const { nodes, connections } = useCanvasStore();

  // Debug: Check state on mount and when isRunning changes
  useEffect(() => {
    const engineRunning = emulationEngine.getIsRunning();
    console.log('EmulationPanel mounted/updated', {
      storeIsRunning: isRunning,
      engineIsRunning: engineRunning,
      simulationTime,
      nodesCount: nodes.length,
      connectionsCount: connections.length,
    });
    
    // If state is inconsistent, fix it
    if (isRunning !== engineRunning) {
      console.warn('State mismatch detected!', { storeIsRunning: isRunning, engineIsRunning: engineRunning });
      if (isRunning && !engineRunning) {
        // Store says running but engine says not - stop store
        console.log('Fixing: stopping store');
        stop();
      } else if (!isRunning && engineRunning) {
        // Engine says running but store says not - stop engine
        console.log('Fixing: stopping engine');
        emulationEngine.stop();
      }
    }
  }, [isRunning, simulationTime, nodes.length, connections.length, stop]);

  const handleStart = () => {
    console.log('handleStart called', { isRunning, simulationTime, nodesCount: nodes.length, connectionsCount: connections.length });
    try {
      // Only initialize if this is a fresh start (simulationTime is 0)
      // Otherwise just resume the simulation
      if (simulationTime === 0) {
        console.log('Initializing emulation...');
        initialize(nodes, connections);
        console.log('Initialization complete');
      }
      console.log('Starting emulation...');
      start();
      console.log('Start called, isRunning should be true now');
    } catch (error) {
      console.error('Error starting emulation:', error);
    }
  };

  const handleStop = () => {
    stop();
  };

  const handleReset = () => {
    reset();
  };

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-2">
      {/* Simulation time display */}
      <div className="text-sm text-muted-foreground w-12">
        {formatTime(simulationTime)}
      </div>

      {/* Controls */}
      <Button
        size="sm"
        variant={isRunning ? 'default' : 'outline'}
        onClick={(e) => {
          console.log('Button clicked!', { isRunning, simulationTime, disabled: isRunning });
          e.preventDefault();
          e.stopPropagation();
          if (!isRunning) {
            handleStart();
          } else {
            console.warn('Button clicked but isRunning is true, button should be disabled');
          }
        }}
        disabled={isRunning}
        title="Start emulation"
        style={{ pointerEvents: isRunning ? 'none' : 'auto' }}
      >
        <Play className="w-4 h-4" />
      </Button>

      <Button
        size="sm"
        variant={isRunning ? 'default' : 'outline'}
        onClick={handleStop}
        disabled={!isRunning}
        title="Stop emulation"
      >
        <Pause className="w-4 h-4" />
      </Button>

      <Button
        size="sm"
        variant="outline"
        onClick={handleReset}
        title="Reset simulation"
      >
        <RotateCcw className="w-4 h-4" />
      </Button>
    </div>
  );
}
