import React from 'react';
import { Button } from '@/components/ui/button';
import { useEmulationStore } from '@/store/useEmulationStore';
import { useCanvasStore } from '@/store/useCanvasStore';
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

  const handleStart = () => {
    // Only initialize if this is a fresh start (simulationTime is 0)
    // Otherwise just resume the simulation
    if (simulationTime === 0) {
      initialize(nodes, connections);
    }
    start();
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
        onClick={handleStart}
        disabled={isRunning}
        title="Start emulation"
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
