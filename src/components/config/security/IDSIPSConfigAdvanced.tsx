import { useCanvasStore } from '@/store/useCanvasStore';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { useState } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Shield,
  AlertTriangle,
  Ban,
  CheckCircle,
  XCircle,
  FileText,
  Network
} from 'lucide-react';

interface IDSIPSConfigProps {
  componentId: string;
}

interface Alert {
  id: string;
  type: 'signature' | 'anomaly' | 'behavioral';
  sourceIP: string;
  destinationIP: string;
  protocol: string;
  port: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  description: string;
  blocked: boolean;
  signature?: string;
}

interface Signature {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  severity: 'critical' | 'high' | 'medium' | 'low';
  pattern: string;
  action: 'alert' | 'block' | 'log';
}

interface BlockedIP {
  ip: string;
  reason: string;
  blockedAt: string;
  expiresAt?: string;
  duration?: number;
}

interface IDSIPSConfig {
  mode?: 'ids' | 'ips';
  enableSignatureDetection?: boolean;
  enableAnomalyDetection?: boolean;
  enableBehavioralAnalysis?: boolean;
  alertThreshold?: 'low' | 'medium' | 'high' | 'critical';
  enableAutoBlock?: boolean;
  blockDuration?: number;
  enableLogging?: boolean;
  logRetention?: number;
  alerts?: Alert[];
  signatures?: Signature[];
  blockedIPs?: BlockedIP[];
  totalAlerts?: number;
  alertsBlocked?: number;
  signaturesActive?: number;
}

export function IDSIPSConfigAdvanced({ componentId }: IDSIPSConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as IDSIPSConfig;
  const mode = config.mode || 'ids';
  const enableSignatureDetection = config.enableSignatureDetection ?? true;
  const enableAnomalyDetection = config.enableAnomalyDetection ?? true;
  const enableBehavioralAnalysis = config.enableBehavioralAnalysis ?? false;
  const alertThreshold = config.alertThreshold || 'medium';
  const enableAutoBlock = config.enableAutoBlock ?? false;
  const blockDuration = config.blockDuration || 3600;
  const enableLogging = config.enableLogging ?? true;
  const logRetention = config.logRetention || 30;
  const alerts = config.alerts || [
    {
      id: '1',
      type: 'signature',
      sourceIP: '192.168.1.100',
      destinationIP: '10.0.0.50',
      protocol: 'TCP',
      port: 22,
      severity: 'high',
      timestamp: new Date().toISOString(),
      description: 'SSH brute force attempt detected',
      blocked: true,
      signature: 'SSH_BRUTE_FORCE',
    },
  ];
  const signatures = config.signatures || [
    {
      id: '1',
      name: 'SSH Brute Force',
      description: 'Detects multiple failed SSH login attempts',
      enabled: true,
      severity: 'high',
      pattern: 'alert tcp any any -> any 22',
      action: 'block',
    },
    {
      id: '2',
      name: 'SQL Injection',
      description: 'Detects SQL injection attempts',
      enabled: true,
      severity: 'critical',
      pattern: 'content:"\' OR 1=1"',
      action: 'block',
    },
  ];
  const blockedIPs = config.blockedIPs || [
    {
      ip: '192.168.1.100',
      reason: 'SSH brute force',
      blockedAt: new Date().toISOString(),
      duration: 3600,
    },
  ];
  const totalAlerts = config.totalAlerts || alerts.length;
  const alertsBlocked = config.alertsBlocked || alerts.filter((a) => a.blocked).length;
  const signaturesActive = config.signaturesActive || signatures.filter((s) => s.enabled).length;

  const [editingSignatureIndex, setEditingSignatureIndex] = useState<number | null>(null);
  const [showCreateSignature, setShowCreateSignature] = useState(false);

  const updateConfig = (updates: Partial<IDSIPSConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addSignature = () => {
    const newSignature: Signature = {
      id: `sig-${Date.now()}`,
      name: 'New Signature',
      description: '',
      enabled: true,
      severity: 'medium',
      pattern: '',
      action: 'alert',
    };
    updateConfig({ signatures: [...signatures, newSignature] });
    setShowCreateSignature(false);
  };

  const removeSignature = (id: string) => {
    updateConfig({ signatures: signatures.filter((s) => s.id !== id) });
  };

  const updateSignature = (id: string, field: string, value: any) => {
    const newSignatures = signatures.map((s) =>
      s.id === id ? { ...s, [field]: value } : s
    );
    updateConfig({ signatures: newSignatures });
  };

  const unblockIP = (ip: string) => {
    updateConfig({ blockedIPs: blockedIPs.filter((b) => b.ip !== ip) });
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">IDS / IPS</p>
            <h2 className="text-2xl font-bold text-foreground">Intrusion Detection & Prevention</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Monitor and protect network from security threats
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm">
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Alerts</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{totalAlerts}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Alerts Blocked</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-red-500">{alertsBlocked}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active Signatures</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{signaturesActive}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Blocked IPs</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{blockedIPs.length}</span>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="alerts" className="space-y-4">
          <TabsList>
            <TabsTrigger value="alerts">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Alerts ({alerts.length})
            </TabsTrigger>
            <TabsTrigger value="signatures">
              <Shield className="h-4 w-4 mr-2" />
              Signatures ({signatures.length})
            </TabsTrigger>
            <TabsTrigger value="blocked">
              <Ban className="h-4 w-4 mr-2" />
              Blocked IPs ({blockedIPs.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="alerts" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Security Alerts</CardTitle>
                <CardDescription>Recent intrusion detection alerts</CardDescription>
              </CardHeader>
              <CardContent>
                {alerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No alerts detected</p>
                ) : (
                  <div className="space-y-2">
                    {alerts.map((alert) => (
                      <Card
                        key={alert.id}
                        className={`border-l-4 ${
                          alert.severity === 'critical' ? 'border-l-red-500' :
                          alert.severity === 'high' ? 'border-l-orange-500' :
                          alert.severity === 'medium' ? 'border-l-yellow-500' : 'border-l-blue-500'
                        }`}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={
                                  alert.severity === 'critical' ? 'destructive' :
                                  alert.severity === 'high' ? 'default' : 'outline'
                                }>
                                  {alert.severity}
                                </Badge>
                                <Badge variant="outline">{alert.type}</Badge>
                                {alert.blocked ? (
                                  <Badge variant="default" className="bg-green-500">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Blocked
                                  </Badge>
                                ) : (
                                  <Badge variant="outline">
                                    <XCircle className="h-3 w-3 mr-1" />
                                    Not Blocked
                                  </Badge>
                                )}
                              </div>
                              <p className="font-medium mb-1">{alert.description}</p>
                              <div className="text-sm text-muted-foreground">
                                <p>Source: {alert.sourceIP} → Destination: {alert.destinationIP}</p>
                                <p>Protocol: {alert.protocol} Port: {alert.port}</p>
                                <p>Time: {new Date(alert.timestamp).toLocaleString()}</p>
                                {alert.signature && (
                                  <p>Signature: {alert.signature}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="signatures" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Detection Signatures</CardTitle>
                    <CardDescription>Configure detection rules and patterns</CardDescription>
                  </div>
                  <Button onClick={addSignature} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Signature
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {signatures.map((signature) => (
                    <Card key={signature.id} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{signature.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={signature.enabled ? 'default' : 'outline'}>
                                {signature.enabled ? 'Enabled' : 'Disabled'}
                              </Badge>
                              <Badge variant={
                                signature.severity === 'critical' ? 'destructive' :
                                signature.severity === 'high' ? 'default' : 'outline'
                              }>
                                {signature.severity}
                              </Badge>
                              <Badge variant="outline">{signature.action}</Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Switch
                              checked={signature.enabled}
                              onCheckedChange={(checked) => updateSignature(signature.id, 'enabled', checked)}
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeSignature(signature.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Signature Name</Label>
                            <Input
                              value={signature.name}
                              onChange={(e) => updateSignature(signature.id, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Severity</Label>
                            <Select
                              value={signature.severity}
                              onValueChange={(value: 'critical' | 'high' | 'medium' | 'low') => updateSignature(signature.id, 'severity', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="critical">Critical</SelectItem>
                                <SelectItem value="high">High</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="low">Low</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Action</Label>
                            <Select
                              value={signature.action}
                              onValueChange={(value: 'alert' | 'block' | 'log') => updateSignature(signature.id, 'action', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="block">Block</SelectItem>
                                <SelectItem value="alert">Alert</SelectItem>
                                <SelectItem value="log">Log</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Description</Label>
                            <Input
                              value={signature.description}
                              onChange={(e) => updateSignature(signature.id, 'description', e.target.value)}
                              placeholder="Signature description"
                            />
                          </div>
                          <div className="space-y-2 col-span-2">
                            <Label>Pattern</Label>
                            <Input
                              value={signature.pattern}
                              onChange={(e) => updateSignature(signature.id, 'pattern', e.target.value)}
                              placeholder="Detection pattern"
                              className="font-mono text-sm"
                            />
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="blocked" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Blocked IP Addresses</CardTitle>
                <CardDescription>IPs currently blocked by the system</CardDescription>
              </CardHeader>
              <CardContent>
                {blockedIPs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No IPs blocked</p>
                ) : (
                  <div className="space-y-2">
                    {blockedIPs.map((blocked, index) => (
                      <Card key={index} className="border-l-4 border-l-red-500">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="destructive">{blocked.ip}</Badge>
                                <Badge variant="outline">{blocked.reason}</Badge>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <p>Blocked at: {new Date(blocked.blockedAt).toLocaleString()}</p>
                                {blocked.duration && (
                                  <p>Duration: {blocked.duration} seconds</p>
                                )}
                                {blocked.expiresAt && (
                                  <p>Expires: {new Date(blocked.expiresAt).toLocaleString()}</p>
                                )}
                              </div>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => unblockIP(blocked.ip)}
                            >
                              Unblock
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>IDS/IPS Settings</CardTitle>
                <CardDescription>Configure detection and prevention settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Operation Mode</Label>
                  <Select
                    value={mode}
                    onValueChange={(value: 'ids' | 'ips') => updateConfig({ mode: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ips">IPS (Prevention - Active blocking)</SelectItem>
                      <SelectItem value="ids">IDS (Detection - Monitoring only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Signature Detection</Label>
                    <Switch
                      checked={enableSignatureDetection}
                      onCheckedChange={(checked) => updateConfig({ enableSignatureDetection: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Anomaly Detection</Label>
                    <Switch
                      checked={enableAnomalyDetection}
                      onCheckedChange={(checked) => updateConfig({ enableAnomalyDetection: checked })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Behavioral Analysis</Label>
                    <Switch
                      checked={enableBehavioralAnalysis}
                      onCheckedChange={(checked) => updateConfig({ enableBehavioralAnalysis: checked })}
                    />
                  </div>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Alert Threshold</Label>
                  <Select
                    value={alertThreshold}
                    onValueChange={(value: 'low' | 'medium' | 'high' | 'critical') => updateConfig({ alertThreshold: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Auto Block</Label>
                  <Switch
                    checked={enableAutoBlock}
                    onCheckedChange={(checked) => updateConfig({ enableAutoBlock: checked })}
                  />
                </div>
                {enableAutoBlock && (
                  <div className="space-y-2">
                    <Label>Block Duration (seconds)</Label>
                    <Input
                      type="number"
                      value={blockDuration}
                      onChange={(e) => updateConfig({ blockDuration: Number(e.target.value) })}
                      min={60}
                      max={86400}
                    />
                  </div>
                )}
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable Logging</Label>
                  <Switch
                    checked={enableLogging}
                    onCheckedChange={(checked) => updateConfig({ enableLogging: checked })}
                  />
                </div>
                {enableLogging && (
                  <div className="space-y-2">
                    <Label>Log Retention (days)</Label>
                    <Input
                      type="number"
                      value={logRetention}
                      onChange={(e) => updateConfig({ logRetention: Number(e.target.value) })}
                      min={1}
                      max={365}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

