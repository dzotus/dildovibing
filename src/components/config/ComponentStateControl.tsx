import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { useComponentStateStore } from '@/store/useComponentStateStore';
import { ComponentState } from '@/core/ComponentStateEngine';
import { 
  Power, 
  PowerOff, 
  AlertTriangle, 
  XCircle, 
  RotateCcw,
  Activity,
  TrendingDown,
  AlertCircle
} from 'lucide-react';
import { useEmulationStore } from '@/store/useEmulationStore';

interface ComponentStateControlProps {
  componentId: string;
  componentLabel: string;
}

export function ComponentStateControl({ componentId, componentLabel }: ComponentStateControlProps) {
  const { isRunning } = useEmulationStore();
  const { getComponentState, setComponentState, resetComponent } = useComponentStateStore();
  const currentState = getComponentState(componentId);
  const state = currentState?.state || 'enabled';
  
  const [degradedLevel, setDegradedLevel] = useState(currentState?.degradedLevel || 0.5);
  const [failureRate, setFailureRate] = useState(currentState?.failureRate || 0.1);
  const [latencyMultiplier, setLatencyMultiplier] = useState(currentState?.latencyMultiplier || 2);
  const [throughputMultiplier, setThroughputMultiplier] = useState(currentState?.throughputMultiplier || 0.5);

  const handleSetState = (newState: ComponentState) => {
    if (newState === 'degraded') {
      setComponentState(componentId, newState, {
        degradedLevel,
        failureRate,
        latencyMultiplier,
        throughputMultiplier,
      });
    } else {
      setComponentState(componentId, newState);
    }
  };

  const handleReset = () => {
    resetComponent(componentId);
    setDegradedLevel(0.5);
    setFailureRate(0.1);
    setLatencyMultiplier(2);
    setThroughputMultiplier(0.5);
  };

  const getStateColor = (state: ComponentState) => {
    switch (state) {
      case 'enabled':
        return 'bg-green-500/20 text-green-500 border-green-500/50';
      case 'disabled':
        return 'bg-gray-500/20 text-gray-500 border-gray-500/50';
      case 'degraded':
        return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50';
      case 'failed':
        return 'bg-red-500/20 text-red-500 border-red-500/50';
    }
  };

  const getStateIcon = (state: ComponentState) => {
    switch (state) {
      case 'enabled':
        return <Power className="w-4 h-4" />;
      case 'disabled':
        return <PowerOff className="w-4 h-4" />;
      case 'degraded':
        return <AlertTriangle className="w-4 h-4" />;
      case 'failed':
        return <XCircle className="w-4 h-4" />;
    }
  };

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Component State Control
            </CardTitle>
            <CardDescription className="text-xs mt-1">
              Manually control component operational state
            </CardDescription>
          </div>
          {currentState && (
            <Badge variant="outline" className={getStateColor(state)}>
              {getStateIcon(state)}
              <span className="ml-1">{state.toUpperCase()}</span>
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* State buttons */}
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant={state === 'enabled' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSetState('enabled')}
            className="flex items-center gap-2"
            disabled={!isRunning}
          >
            <Power className="w-4 h-4" />
            Enabled
          </Button>
          <Button
            variant={state === 'disabled' ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => handleSetState('disabled')}
            className="flex items-center gap-2"
            disabled={!isRunning}
          >
            <PowerOff className="w-4 h-4" />
            Disabled
          </Button>
          <Button
            variant={state === 'degraded' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSetState('degraded')}
            className="flex items-center gap-2 bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-600 dark:text-yellow-400"
            disabled={!isRunning}
          >
            <AlertTriangle className="w-4 h-4" />
            Degraded
          </Button>
          <Button
            variant={state === 'failed' ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => handleSetState('failed')}
            className="flex items-center gap-2"
            disabled={!isRunning}
          >
            <XCircle className="w-4 h-4" />
            Failed
          </Button>
        </div>

        {/* Degraded state configuration */}
        {state === 'degraded' && (
          <div className="space-y-4 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-yellow-600 dark:text-yellow-400" />
              <Label className="text-xs font-semibold text-yellow-600 dark:text-yellow-400">
                Degradation Settings
              </Label>
            </div>

            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Degradation Level</Label>
                  <span className="text-xs text-muted-foreground">{(degradedLevel * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[degradedLevel]}
                  onValueChange={(value) => {
                    setDegradedLevel(value[0]);
                    handleSetState('degraded');
                  }}
                  min={0}
                  max={1}
                  step={0.1}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Failure Rate</Label>
                  <span className="text-xs text-muted-foreground">{(failureRate * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[failureRate]}
                  onValueChange={(value) => {
                    setFailureRate(value[0]);
                    handleSetState('degraded');
                  }}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Latency Multiplier</Label>
                  <span className="text-xs text-muted-foreground">{latencyMultiplier.toFixed(1)}x</span>
                </div>
                <Slider
                  value={[latencyMultiplier]}
                  onValueChange={(value) => {
                    setLatencyMultiplier(value[0]);
                    handleSetState('degraded');
                  }}
                  min={1}
                  max={5}
                  step={0.1}
                  className="w-full"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">Throughput Multiplier</Label>
                  <span className="text-xs text-muted-foreground">{(throughputMultiplier * 100).toFixed(0)}%</span>
                </div>
                <Slider
                  value={[throughputMultiplier]}
                  onValueChange={(value) => {
                    setThroughputMultiplier(value[0]);
                    handleSetState('degraded');
                  }}
                  min={0}
                  max={1}
                  step={0.05}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* Reset button */}
        {currentState && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="w-full flex items-center gap-2"
            disabled={!isRunning}
          >
            <RotateCcw className="w-4 h-4" />
            Reset to Normal
          </Button>
        )}

        {!isRunning && (
          <div className="flex items-center gap-2 p-2 bg-muted rounded text-xs text-muted-foreground">
            <AlertCircle className="w-4 h-4" />
            Start emulation to control component state
          </div>
        )}
      </CardContent>
    </Card>
  );
}

