import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  AlertCircle,
  HelpCircle
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
    <Card className="border">
      <CardHeader className="p-2 pb-1.5">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-[11px] flex items-center gap-1">
              <Activity className="w-3 h-3" />
              Component State
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-3.5 w-3.5 rounded-full">
                    <HelpCircle className="w-2.5 h-2.5 text-muted-foreground" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72 text-xs" align="start">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-sm">Component States</h4>
                    <div className="space-y-1.5">
                      <div className="flex items-start gap-2">
                        <Power className="w-3.5 h-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium text-green-500">Enabled</span>
                          <span className="text-muted-foreground"> — normal operation</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <PowerOff className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium text-gray-500">Disabled</span>
                          <span className="text-muted-foreground"> — turned off. Throughput=0, Errors=100%</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium text-yellow-500">Degraded</span>
                          <span className="text-muted-foreground"> — partial failure. Throughput ↓50%, Latency ↑2x, Errors ↑10%</span>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <span className="font-medium text-red-500">Failed</span>
                          <span className="text-muted-foreground"> — crashed. Same as Disabled but indicates failure</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-muted-foreground pt-1 border-t border-border">
                      Use to simulate failures and test architecture resilience.
                    </p>
                  </div>
                </PopoverContent>
              </Popover>
            </CardTitle>
            <CardDescription className="text-[9px] mt-0.5">
              Control operational state
            </CardDescription>
          </div>
          {currentState && (
            <Badge variant="outline" className={`${getStateColor(state)} text-xs px-1 py-0.5`}>
              {getStateIcon(state)}
              <span className="ml-0.5">{state.toUpperCase()}</span>
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-2 pt-1.5 space-y-2">
        {/* State buttons */}
        <div className="grid grid-cols-2 gap-1">
          <Button
            variant={state === 'enabled' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSetState('enabled')}
            className="flex items-center gap-1 h-7 text-xs"
            disabled={!isRunning}
          >
            <Power className="w-3.5 h-3.5" />
            Enabled
          </Button>
          <Button
            variant={state === 'disabled' ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => handleSetState('disabled')}
            className="flex items-center gap-1 h-7 text-xs"
            disabled={!isRunning}
          >
            <PowerOff className="w-3.5 h-3.5" />
            Disabled
          </Button>
          <Button
            variant={state === 'degraded' ? 'default' : 'outline'}
            size="sm"
            onClick={() => handleSetState('degraded')}
            className="flex items-center gap-1 h-7 text-xs bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-600 dark:text-yellow-400"
            disabled={!isRunning}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Degraded
          </Button>
          <Button
            variant={state === 'failed' ? 'destructive' : 'outline'}
            size="sm"
            onClick={() => handleSetState('failed')}
            className="flex items-center gap-1 h-7 text-xs"
            disabled={!isRunning}
          >
            <XCircle className="w-3.5 h-3.5" />
            Failed
          </Button>
        </div>

        {/* Degraded state configuration */}
        {state === 'degraded' && (
          <div className="space-y-2 p-2 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
            <div className="flex items-center gap-1 mb-1">
              <TrendingDown className="w-3 h-3 text-yellow-600 dark:text-yellow-400" />
              <Label className="text-[11px] font-semibold text-yellow-600 dark:text-yellow-400">
                Degradation Settings
              </Label>
            </div>

            <div className="space-y-2">
              <div>
                <div className="flex items-center justify-between mb-0.5">
                  <Label className="text-[10px]">Degradation Level</Label>
                  <span className="text-[9px] text-muted-foreground">{(degradedLevel * 100).toFixed(0)}%</span>
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
                <div className="flex items-center justify-between mb-0.5">
                  <Label className="text-[10px]">Failure Rate</Label>
                  <span className="text-[9px] text-muted-foreground">{(failureRate * 100).toFixed(0)}%</span>
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
                <div className="flex items-center justify-between mb-0.5">
                  <Label className="text-[10px]">Latency Multiplier</Label>
                  <span className="text-[9px] text-muted-foreground">{latencyMultiplier.toFixed(1)}x</span>
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
                <div className="flex items-center justify-between mb-0.5">
                  <Label className="text-[10px]">Throughput Multiplier</Label>
                  <span className="text-[9px] text-muted-foreground">{(throughputMultiplier * 100).toFixed(0)}%</span>
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
            className="w-full flex items-center gap-1 h-7 text-xs"
            disabled={!isRunning}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to Normal
          </Button>
        )}

        {!isRunning && (
          <div className="flex items-center gap-1 p-1 bg-muted rounded text-[9px] text-muted-foreground">
            <AlertCircle className="w-3 h-3" />
            Start emulation to control component state
          </div>
        )}
      </CardContent>
    </Card>
  );
}

