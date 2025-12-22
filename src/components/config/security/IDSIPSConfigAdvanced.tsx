import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { emulationEngine } from '@/core/EmulationEngine';
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
import { useState, useEffect } from 'react';
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
  Network,
  Search
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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
  const { getComponentMetrics } = useEmulationStore();
  const { toast } = useToast();
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
  
  // Получаем реальные метрики из эмуляции
  const metrics = getComponentMetrics(componentId);
  const idsIpsEngine = emulationEngine.getIDSIPSEmulationEngine(componentId);
  
  // Реальные данные из эмуляции
  const [realAlerts, setRealAlerts] = useState<any[]>([]);
  const [realBlockedIPs, setRealBlockedIPs] = useState<any[]>([]);
  const [realStats, setRealStats] = useState({
    totalAlerts: 0,
    alertsBlocked: 0,
    signaturesActive: 0,
    blockedIPs: 0,
  });

  // Обновляем данные из эмуляции
  useEffect(() => {
    if (idsIpsEngine) {
      const alerts = idsIpsEngine.getAlerts(100);
      const blockedIPs = idsIpsEngine.getBlockedIPs();
      const stats = idsIpsEngine.getStats();
      
      setRealAlerts(alerts.map(a => ({
        id: a.id,
        type: a.type,
        sourceIP: a.sourceIP,
        destinationIP: a.destinationIP,
        protocol: a.protocol,
        port: a.port,
        severity: a.severity,
        timestamp: new Date(a.timestamp).toISOString(),
        description: a.description,
        blocked: a.blocked,
        signature: a.signature,
      })));
      
      setRealBlockedIPs(blockedIPs.map(b => ({
        ip: b.ip,
        reason: b.reason,
        blockedAt: new Date(b.blockedAt).toISOString(),
        expiresAt: b.expiresAt ? new Date(b.expiresAt).toISOString() : undefined,
        duration: b.expiresAt ? Math.floor((b.expiresAt - b.blockedAt) / 1000) : undefined,
      })));
      
      setRealStats({
        totalAlerts: stats.alertsGenerated,
        alertsBlocked: stats.alertsBlocked,
        signaturesActive: stats.activeSignatures,
        blockedIPs: stats.blockedIPs,
      });
    }
  }, [idsIpsEngine, metrics?.timestamp]);

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

  // Используем реальные данные из эмуляции, если доступны
  const alerts = realAlerts.length > 0 ? realAlerts : config.alerts || [];
  const blockedIPs = realBlockedIPs.length > 0 ? realBlockedIPs : config.blockedIPs || [];
  const totalAlerts = realStats.totalAlerts || config.totalAlerts || alerts.length;
  const alertsBlocked = realStats.alertsBlocked || config.alertsBlocked || alerts.filter((a) => a.blocked).length;
  const signaturesActive = realStats.signaturesActive || config.signaturesActive || signatures.filter((s) => s.enabled).length;

  const [editingSignatureIndex, setEditingSignatureIndex] = useState<number | null>(null);
  const [showCreateSignature, setShowCreateSignature] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [alertFilter, setAlertFilter] = useState<'all' | 'signature' | 'anomaly' | 'behavioral'>('all');

  const updateConfig = (updates: Partial<IDSIPSConfig>) => {
    const newConfig = { ...config, ...updates };
    updateNode(componentId, {
      data: {
        ...node.data,
        config: newConfig,
      },
    });
    
    // Обновляем эмуляцию при изменении конфигурации
    try {
      const engine = emulationEngine.getIDSIPSEmulationEngine(componentId);
      if (engine) {
        engine.initializeConfig({
          ...node,
          data: {
            ...node.data,
            config: newConfig,
          },
        });
      }
    } catch (e) {
      // Silently fail - emulation will sync on next updateMetrics call
    }
  };

  const handleRefresh = () => {
    if (idsIpsEngine) {
      const alerts = idsIpsEngine.getAlerts(100);
      const blockedIPs = idsIpsEngine.getBlockedIPs();
      const stats = idsIpsEngine.getStats();
      
      setRealAlerts(alerts.map(a => ({
        id: a.id,
        type: a.type,
        sourceIP: a.sourceIP,
        destinationIP: a.destinationIP,
        protocol: a.protocol,
        port: a.port,
        severity: a.severity,
        timestamp: new Date(a.timestamp).toISOString(),
        description: a.description,
        blocked: a.blocked,
        signature: a.signature,
      })));
      
      setRealBlockedIPs(blockedIPs.map(b => ({
        ip: b.ip,
        reason: b.reason,
        blockedAt: new Date(b.blockedAt).toISOString(),
        expiresAt: b.expiresAt ? new Date(b.expiresAt).toISOString() : undefined,
        duration: b.expiresAt ? Math.floor((b.expiresAt - b.blockedAt) / 1000) : undefined,
      })));
      
      setRealStats({
        totalAlerts: stats.alertsGenerated,
        alertsBlocked: stats.alertsBlocked,
        signaturesActive: stats.activeSignatures,
        blockedIPs: stats.blockedIPs,
      });
      
      toast({
        title: 'Refreshed',
        description: 'IDS/IPS data has been refreshed',
      });
    }
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
    toast({
      title: 'Signature created',
      description: 'New signature has been created',
    });
  };

  const removeSignature = (id: string) => {
    const signature = signatures.find(s => s.id === id);
    updateConfig({ signatures: signatures.filter((s) => s.id !== id) });
    toast({
      title: 'Signature deleted',
      description: signature ? `Signature "${signature.name}" has been deleted` : 'Signature has been deleted',
    });
  };

  const updateSignature = (id: string, field: string, value: any) => {
    const newSignatures = signatures.map((s) =>
      s.id === id ? { ...s, [field]: value } : s
    );
    updateConfig({ signatures: newSignatures });
  };

  const unblockIP = (ip: string) => {
    if (idsIpsEngine) {
      idsIpsEngine.unblockIP(ip);
    }
    updateConfig({ blockedIPs: blockedIPs.filter((b) => b.ip !== ip) });
    toast({
      title: 'IP unblocked',
      description: `IP address ${ip} has been unblocked`,
    });
  };

  // Фильтрация алертов
  const filteredAlerts = alerts.filter(alert => {
    if (alertFilter !== 'all' && alert.type !== alertFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        alert.sourceIP.toLowerCase().includes(query) ||
        alert.destinationIP.toLowerCase().includes(query) ||
        alert.description.toLowerCase().includes(query) ||
        (alert.signature && alert.signature.toLowerCase().includes(query))
      );
    }
    return true;
  });

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
            <Button variant="outline" size="sm" onClick={handleRefresh}>
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
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Security Alerts</CardTitle>
                    <CardDescription>Recent intrusion detection alerts</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search alerts..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Select value={alertFilter} onValueChange={(value: any) => setAlertFilter(value)}>
                      <SelectTrigger className="w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        <SelectItem value="signature">Signature</SelectItem>
                        <SelectItem value="anomaly">Anomaly</SelectItem>
                        <SelectItem value="behavioral">Behavioral</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredAlerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    {alerts.length === 0 ? 'No alerts detected' : 'No alerts match the filter'}
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredAlerts.map((alert) => (
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

