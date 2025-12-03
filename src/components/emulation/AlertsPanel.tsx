import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAlertStore } from '@/store/useAlertStore';
import { useCanvasStore } from '@/store/useCanvasStore';
import { XCircle, AlertTriangle, Info, X, CheckCircle2 } from 'lucide-react';
import { useEffect } from 'react';

export function AlertsPanel() {
  const { alerts, acknowledgeAlert, clearAlerts, getCriticalAlerts, getWarningAlerts } = useAlertStore();
  const { selectNode } = useCanvasStore();

  const criticalAlerts = getCriticalAlerts();
  const warningAlerts = getWarningAlerts();
  const infoAlerts = alerts.filter(a => a.type === 'info');

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'critical':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Info className="w-4 h-4 text-blue-500" />;
    }
  };

  const handleNodeClick = (nodeId: string) => {
    selectNode(nodeId);
  };

  if (alerts.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-sm">Alerts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-sm text-muted-foreground py-8">
            <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50 text-green-500" />
            <p>No active alerts</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm">Alerts</CardTitle>
            <div className="flex gap-2 mt-1">
              {criticalAlerts.length > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {criticalAlerts.length} Critical
                </Badge>
              )}
              {warningAlerts.length > 0 && (
                <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-600">
                  {warningAlerts.length} Warning
                </Badge>
              )}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={clearAlerts}
          >
            Clear All
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-2">
            {alerts.map((alert) => (
              <Card
                key={alert.id}
                className={`border-l-4 ${
                  alert.type === 'critical'
                    ? 'border-l-red-500 bg-red-500/5'
                    : alert.type === 'warning'
                    ? 'border-l-yellow-500 bg-yellow-500/5'
                    : 'border-l-blue-500 bg-blue-500/5'
                }`}
              >
                <CardContent className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1">
                      {getAlertIcon(alert.type)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-xs font-semibold">{alert.title}</h4>
                          <Badge
                            variant={
                              alert.type === 'critical'
                                ? 'destructive'
                                : alert.type === 'warning'
                                ? 'outline'
                                : 'secondary'
                            }
                            className="text-[10px]"
                          >
                            {alert.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mb-2">{alert.message}</p>
                        {alert.nodeLabel && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs p-1"
                            onClick={() => alert.nodeId && handleNodeClick(alert.nodeId)}
                          >
                            View: {alert.nodeLabel}
                          </Button>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {new Date(alert.timestamp).toLocaleTimeString()}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => acknowledgeAlert(alert.id)}
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

