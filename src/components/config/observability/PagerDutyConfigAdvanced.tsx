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
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  AlertTriangle,
  Users,
  Bell,
  Clock,
  Shield,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { emulationEngine } from '@/core/EmulationEngine';
import { useEmulationStore } from '@/store/useEmulationStore';
import { useEffect, useState } from 'react';

interface PagerDutyConfigProps {
  componentId: string;
}

interface Service {
  id: string;
  name: string;
  integrationKey: string;
  status: 'active' | 'maintenance' | 'disabled';
  escalationPolicy?: string;
  autoResolve?: boolean;
  resolveTimeout?: number;
  incidentCount?: number;
}

interface Incident {
  id: string;
  title: string;
  service: string;
  status: 'triggered' | 'acknowledged' | 'resolved';
  severity: 'critical' | 'error' | 'warning' | 'info';
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  assignedTo?: string;
}

interface EscalationPolicy {
  id: string;
  name: string;
  levels: Array<{
    level: number;
    timeout: number;
    targets: string[];
  }>;
}

interface Schedule {
  id: string;
  name: string;
  timezone: string;
  layers: Array<{
    start: string;
    rotation_virtual_start: string;
    rotation_turn_length_seconds: number;
    users: Array<{ user: { id: string } }>;
    restrictions?: Array<{
      type: 'weekly_restriction';
      start_time_of_day: string;
      duration_seconds: number;
      start_day_of_week: number;
    }>;
  }>;
}

interface PagerDutyConfig {
  services?: Service[];
  incidents?: Incident[];
  escalationPolicies?: EscalationPolicy[];
  onCallUsers?: Array<{
    id: string;
    name: string;
    email: string;
    status: 'on-call' | 'off-call';
  }>;
  schedules?: Schedule[];
  totalIncidents?: number;
  activeIncidents?: number;
  resolvedIncidents?: number;
  // Global settings (aligned with profiles.ts and PagerDutyEmulationEngine)
  enableAutoResolve?: boolean;
  resolveTimeout?: number;
  enableWebhooks?: boolean;
  webhookUrl?: string;
  severityMapping?: 'standard' | 'error-focused' | 'warning-demoted';
}

// Validation helpers
const validateIntegrationKey = (key: string): boolean => {
  if (!key) return true; // Optional field
  // Integration keys are typically UUID or base64-like strings
  return /^[a-zA-Z0-9_-]+$/.test(key) && key.length >= 8;
};

const validateEmail = (email: string): boolean => {
  if (!email) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateUrl = (url: string): boolean => {
  if (!url) return true; // Optional if webhooks disabled
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export function PagerDutyConfigAdvanced({ componentId }: PagerDutyConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { getComponentMetrics, isRunning } = useEmulationStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isUpdating, setIsUpdating] = useState(false);

  // Get real-time metrics
  const componentMetrics = getComponentMetrics(componentId);
  const customMetrics = componentMetrics?.customMetrics || {};

  useEffect(() => {
    // Force re-render when metrics change
  }, [componentMetrics, isRunning]);

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node?.data?.config || {}) as PagerDutyConfig;
  const globalEnableAutoResolve = config.enableAutoResolve ?? true;
  const globalResolveTimeout = config.resolveTimeout ?? 300;
  const globalEnableWebhooks = config.enableWebhooks ?? false;
  const globalWebhookUrl = config.webhookUrl ?? '';
  const globalSeverityMapping = config.severityMapping ?? 'standard';
  const services = Array.isArray(config.services) ? config.services : [];
  const pagerDutyIncidents = emulationEngine.getPagerDutyIncidents(componentId);
  const incidents: Incident[] = pagerDutyIncidents.map((i) => {
    const service = services.find((s) => s.id === i.serviceId);
    return {
      id: i.id,
      title: i.title,
      service: service?.name || i.serviceId,
      status: i.status,
      severity: i.severity,
      createdAt: new Date(i.createdAt).toISOString(),
      acknowledgedAt: i.acknowledgedAt
        ? new Date(i.acknowledgedAt).toISOString()
        : undefined,
      resolvedAt: i.resolvedAt ? new Date(i.resolvedAt).toISOString() : undefined,
    };
  });
  const escalationPolicies = Array.isArray(config.escalationPolicies)
    ? config.escalationPolicies
    : [];
  const onCallUsers = Array.isArray(config.onCallUsers) ? config.onCallUsers : [];
  const schedules = Array.isArray(config.schedules) ? config.schedules : [];
  const pagerDutyMetrics = emulationEngine.getPagerDutyMetrics(componentId);
  
  // Date/time format settings
  const [timeFormat, setTimeFormat] = useState<'12h' | '24h'>((config as any).timeFormat || '24h');
  const [dateFormat, setDateFormat] = useState<'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY'>((config as any).dateFormat || 'YYYY-MM-DD');
  const totalIncidents = pagerDutyMetrics?.incidentsTotal ?? incidents.length;
  const activeIncidents = pagerDutyMetrics?.incidentsActive ?? incidents.filter((i) => i.status !== 'resolved').length;
  const resolvedIncidents = pagerDutyMetrics?.incidentsResolved ?? incidents.filter((i) => i.status === 'resolved').length;


  const updateConfig = (updates: Partial<PagerDutyConfig>) => {
    const newConfig = { ...config, ...updates };
    
    // Validate before updating
    const errors: Record<string, string> = {};
    
    // Validate webhook URL if webhooks enabled
    if (newConfig.enableWebhooks && newConfig.webhookUrl) {
      if (!validateUrl(newConfig.webhookUrl)) {
        errors.webhookUrl = 'Invalid URL format';
      }
    }

    // Validate integration keys
    if (Array.isArray(newConfig.services)) {
      newConfig.services.forEach((service, index) => {
        if (service.integrationKey && !validateIntegrationKey(service.integrationKey)) {
          errors[`service-${index}-integrationKey`] = 'Invalid integration key format';
        }
      });
    }

    // Validate emails
    if (Array.isArray(newConfig.onCallUsers)) {
      newConfig.onCallUsers.forEach((user, index) => {
        if (!validateEmail(user.email)) {
          errors[`user-${index}-email`] = 'Invalid email format';
        }
      });
    }

    setValidationErrors(errors);

    // Don't update if there are validation errors
    if (Object.keys(errors).length > 0) {
      return;
    }

    // Update node config
    updateNode(componentId, {
      data: {
        ...node.data,
        config: newConfig,
      },
    });

    // Update emulation engine
    setIsUpdating(true);
    const updatedNode = { ...node, data: { ...node.data, config: newConfig } };
    emulationEngine.updateNodesAndConnections([updatedNode], []);
    
    // Reset updating state after a short delay
    setTimeout(() => setIsUpdating(false), 500);
  };

  const addService = () => {
    const newService: Service = {
      id: `service-${Date.now()}`,
      name: 'new-service',
      integrationKey: '',
      status: 'active',
      autoResolve: true,
      resolveTimeout: 300,
      incidentCount: 0,
    };
    updateConfig({ services: [...services, newService] });
    setShowCreateService(false);
  };

  const removeService = (id: string) => {
    updateConfig({ services: services.filter((s) => s.id !== id) });
  };

  const updateService = (id: string, field: string, value: any) => {
    const newServices = services.map((s) =>
      s.id === id ? { ...s, [field]: value } : s
    );
    updateConfig({ services: newServices });
  };

  const acknowledgeIncident = (id: string) => {
    emulationEngine.acknowledgePagerDutyIncident(componentId, id);
  };

  const resolveIncident = (id: string) => {
    emulationEngine.resolvePagerDutyIncident(componentId, id);
  };

  const addEscalationPolicy = () => {
    const newPolicy: EscalationPolicy = {
      id: `policy-${Date.now()}`,
      name: 'new-policy',
      levels: [{ level: 1, timeout: 5, targets: [] }],
    };
    updateConfig({ escalationPolicies: [...escalationPolicies, newPolicy] });
    setShowCreatePolicy(false);
  };

  const removeEscalationPolicy = (id: string) => {
    updateConfig({ escalationPolicies: escalationPolicies.filter((p) => p.id !== id) });
  };

  const updateEscalationPolicyName = (id: string, name: string) => {
    const updated = escalationPolicies.map((p) =>
      p.id === id ? { ...p, name } : p
    );
    updateConfig({ escalationPolicies: updated });
  };

  const addEscalationLevel = (policyId: string) => {
    const updated = escalationPolicies.map((p) => {
      if (p.id !== policyId) return p;
      const nextLevel = (p.levels[p.levels.length - 1]?.level || 0) + 1;
      return {
        ...p,
        levels: [
          ...p.levels,
          { level: nextLevel, timeout: 5, targets: [] },
        ],
      };
    });
    updateConfig({ escalationPolicies: updated });
  };

  const removeEscalationLevel = (policyId: string, levelIndex: number) => {
    const updated = escalationPolicies.map((p) => {
      if (p.id !== policyId) return p;
      const levels = p.levels.filter((_, idx) => idx !== levelIndex);
      return { ...p, levels };
    });
    updateConfig({ escalationPolicies: updated });
  };

  const updateEscalationLevelTimeout = (policyId: string, levelIndex: number, timeout: number) => {
    const updated = escalationPolicies.map((p) => {
      if (p.id !== policyId) return p;
      const levels = p.levels.map((lvl, idx) =>
        idx === levelIndex ? { ...lvl, timeout } : lvl
      );
      return { ...p, levels };
    });
    updateConfig({ escalationPolicies: updated });
  };


  const addOnCallUser = () => {
    const newUser = {
      id: `user-${Date.now()}`,
      name: 'On-Call User',
      email: 'user@example.com',
      status: 'on-call' as const,
    };
    updateConfig({ onCallUsers: [...onCallUsers, newUser] });
    setShowCreateOnCall(false);
  };

  const removeOnCallUser = (id: string) => {
    const updatedUsers = onCallUsers.filter((u) => u.id !== id);

    // Также очищаем targets в политиках, чтобы не висели "мертвые" ссылки
    const updatedPolicies = escalationPolicies.map((p) => ({
      ...p,
      levels: p.levels.map((lvl) => ({
        ...lvl,
        targets: lvl.targets.filter((t) => t !== id),
      })),
    }));

    updateConfig({
      onCallUsers: updatedUsers,
      escalationPolicies: updatedPolicies,
    });
  };

  const updateOnCallUser = (id: string, field: 'name' | 'email' | 'status', value: string) => {
    const updatedUsers = onCallUsers.map((u) =>
      u.id === id ? { ...u, [field]: value } : u
    );
    updateConfig({ onCallUsers: updatedUsers });
  };

  const addSchedule = () => {
    const newSchedule: Schedule = {
      id: `schedule-${Date.now()}`,
      name: 'new-schedule',
      timezone: 'UTC',
      layers: [{
        start: new Date().toISOString(),
        rotation_virtual_start: new Date().toISOString(),
        rotation_turn_length_seconds: 604800, // 7 days
        users: [],
      }],
    };
    updateConfig({ schedules: [...schedules, newSchedule] });
  };

  const removeSchedule = (id: string) => {
    // Remove schedule and also remove it from escalation policy targets in a single update
    const updatedSchedules = schedules.filter((s) => s.id !== id);
    const updatedPolicies = escalationPolicies.map((p) => ({
      ...p,
      levels: p.levels.map((lvl) => ({
        ...lvl,
        targets: lvl.targets.filter((t) => t !== id),
      })),
    }));
    updateConfig({ 
      schedules: updatedSchedules,
      escalationPolicies: updatedPolicies 
    });
  };

  const updateSchedule = (id: string, field: 'name' | 'timezone', value: string) => {
    const updatedSchedules = schedules.map((s) =>
      s.id === id ? { ...s, [field]: value } : s
    );
    updateConfig({ schedules: updatedSchedules });
  };

  const addScheduleLayer = (scheduleId: string) => {
    const updatedSchedules = schedules.map((s) => {
      if (s.id !== scheduleId) return s;
      return {
        ...s,
        layers: [
          ...s.layers,
          {
            start: new Date().toISOString(),
            rotation_virtual_start: new Date().toISOString(),
            rotation_turn_length_seconds: 604800,
            users: [],
          },
        ],
      };
    });
    updateConfig({ schedules: updatedSchedules });
  };

  const removeScheduleLayer = (scheduleId: string, layerIndex: number) => {
    const updatedSchedules = schedules.map((s) => {
      if (s.id !== scheduleId) return s;
      return {
        ...s,
        layers: s.layers.filter((_, idx) => idx !== layerIndex),
      };
    });
    updateConfig({ schedules: updatedSchedules });
  };

  const updateScheduleLayer = (
    scheduleId: string,
    layerIndex: number,
    field: 'start' | 'rotation_virtual_start' | 'rotation_turn_length_seconds',
    value: string | number
  ) => {
    const updatedSchedules = schedules.map((s) => {
      if (s.id !== scheduleId) return s;
      return {
        ...s,
        layers: s.layers.map((l, idx) =>
          idx === layerIndex ? { ...l, [field]: value } : l
        ),
      };
    });
    updateConfig({ schedules: updatedSchedules });
  };

  const toggleScheduleLayerUser = (scheduleId: string, layerIndex: number, userId: string) => {
    const updatedSchedules = schedules.map((s) => {
      if (s.id !== scheduleId) return s;
      return {
        ...s,
        layers: s.layers.map((l, idx) => {
          if (idx !== layerIndex) return l;
          const hasUser = l.users.some((u) => u.user.id === userId);
          return {
            ...l,
            users: hasUser
              ? l.users.filter((u) => u.user.id !== userId)
              : [...l.users, { user: { id: userId } }],
          };
        }),
      };
    });
    updateConfig({ schedules: updatedSchedules });
  };

  const toggleEscalationLevelTarget = (policyId: string, levelIndex: number, targetId: string) => {
    const updated = escalationPolicies.map((p) => {
      if (p.id !== policyId) return p;
      const levels = p.levels.map((lvl, idx) => {
        if (idx !== levelIndex) return lvl;
        const has = lvl.targets.includes(targetId);
        const targets = has
          ? lvl.targets.filter((t) => t !== targetId)
          : [...lvl.targets, targetId];
        return { ...lvl, targets };
      });
      return { ...p, levels };
    });
    updateConfig({ escalationPolicies: updated });
  };

  // Get current on-call users for schedules
  const getScheduleOnCallUsers = (scheduleId: string): string[] => {
    return emulationEngine.getPagerDutyScheduleOnCallUsers(componentId, scheduleId);
  };

  // Helper to format date for input (local time)
  const formatDateForInput = (isoString: string): string => {
    const date = new Date(isoString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    if (dateFormat === 'MM/DD/YYYY') {
      return `${month}/${day}/${year}`;
    } else if (dateFormat === 'DD/MM/YYYY') {
      return `${day}/${month}/${year}`;
    }
    return `${year}-${month}-${day}`;
  };

  // Helper to parse date from input (local time)
  const parseDateFromInput = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    
    let year: number, month: number, day: number;
    
    if (dateFormat === 'MM/DD/YYYY') {
      const [m, d, y] = dateStr.split('/').map(Number);
      year = y;
      month = m - 1;
      day = d;
    } else if (dateFormat === 'DD/MM/YYYY') {
      const [d, m, y] = dateStr.split('/').map(Number);
      year = y;
      month = m - 1;
      day = d;
    } else {
      const [y, m, d] = dateStr.split('-').map(Number);
      year = y;
      month = m - 1;
      day = d;
    }
    
    return new Date(year, month, day);
  };

  // Helper to format time for input (local time)
  const formatTimeForInput = (isoString: string): string => {
    const date = new Date(isoString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    
    if (timeFormat === '12h') {
      const h12 = hours % 12 || 12;
      const ampm = hours >= 12 ? 'PM' : 'AM';
      return `${String(h12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
    }
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  };

  // Helper to parse time from input (local time)
  const parseTimeFromInput = (timeStr: string, isPM: boolean = false): { hours: number; minutes: number } | null => {
    if (!timeStr) return null;
    
    const [h, m] = timeStr.split(':').map(Number);
    let hours = h;
    
    if (timeFormat === '12h') {
      if (isPM && hours !== 12) {
        hours += 12;
      } else if (!isPM && hours === 12) {
        hours = 0;
      }
    }
    
    return { hours, minutes: m };
  };

  // Update format settings
  const updateFormatSettings = (timeFmt?: '12h' | '24h', dateFmt?: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY') => {
    if (timeFmt !== undefined) {
      setTimeFormat(timeFmt);
      updateConfig({ timeFormat: timeFmt } as any);
    }
    if (dateFmt !== undefined) {
      setDateFormat(dateFmt);
      updateConfig({ dateFormat: dateFmt } as any);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">PagerDuty</p>
            <h2 className="text-2xl font-bold text-foreground">Incident Management</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage incidents, services, escalation policies and on-call schedules
            </p>
          </div>
          <div className="flex gap-2">
            {isUpdating && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCcw className="h-4 w-4 animate-spin" />
                Updating...
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const updatedNode = { ...node };
                emulationEngine.updateNodesAndConnections([updatedNode], []);
              }}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Total Incidents</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{totalIncidents}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-red-500">{activeIncidents}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Resolved</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold text-green-500">{resolvedIncidents}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Services</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{services.length}</span>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Global Settings
            </CardTitle>
            <CardDescription>
              Control how incidents are auto-resolved, mapped by severity and propagated via webhooks
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Auto Resolve</Label>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm text-muted-foreground">Enable automatic incident resolution</span>
                  <Switch
                    checked={globalEnableAutoResolve}
                    onCheckedChange={(checked) =>
                      updateConfig({ enableAutoResolve: checked })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Resolve Timeout (seconds)</Label>
                <Input
                  type="number"
                  value={globalResolveTimeout}
                  onChange={(e) =>
                    updateConfig({ resolveTimeout: Number(e.target.value) || 0 })
                  }
                  min={60}
                />
              </div>
              <div className="space-y-2">
                <Label>Severity Mapping</Label>
                <Select
                  value={globalSeverityMapping}
                  onValueChange={(value: 'standard' | 'error-focused' | 'warning-demoted') =>
                    updateConfig({ severityMapping: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard (critical / warning / info)</SelectItem>
                    <SelectItem value="error-focused">Error-focused (warnings treated as errors)</SelectItem>
                    <SelectItem value="warning-demoted">Warning demoted (warnings as info)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Enable Webhooks</Label>
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className="text-sm text-muted-foreground">Send outbound incident webhooks</span>
                  <Switch
                    checked={globalEnableWebhooks}
                    onCheckedChange={(checked) =>
                      updateConfig({ enableWebhooks: checked })
                    }
                  />
                </div>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Webhook URL</Label>
                <Input
                  value={globalWebhookUrl}
                  onChange={(e) => updateConfig({ webhookUrl: e.target.value })}
                  placeholder="https://webhook.example.com/pagerduty"
                  disabled={!globalEnableWebhooks}
                  className={validationErrors.webhookUrl ? 'border-red-500' : ''}
                />
                {validationErrors.webhookUrl && (
                  <p className="text-xs text-red-500">{validationErrors.webhookUrl}</p>
                )}
                {globalEnableWebhooks && customMetrics.webhook_success_rate !== undefined && (
                  <div className="text-xs text-muted-foreground">
                    Success rate: {(customMetrics.webhook_success_rate * 100).toFixed(1)}%
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="incidents" className="space-y-4">
          <TabsList>
            <TabsTrigger value="incidents">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Incidents ({activeIncidents})
            </TabsTrigger>
            <TabsTrigger value="services">
              <Settings className="h-4 w-4 mr-2" />
              Services ({services.length})
            </TabsTrigger>
            <TabsTrigger value="policies">
              <Users className="h-4 w-4 mr-2" />
              Escalation Policies ({escalationPolicies.length})
            </TabsTrigger>
            <TabsTrigger value="oncall">
              <Bell className="h-4 w-4 mr-2" />
              On-Call
            </TabsTrigger>
            <TabsTrigger value="schedules">
              <Clock className="h-4 w-4 mr-2" />
              Schedules ({schedules.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="incidents" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Incidents</CardTitle>
                <CardDescription>Manage and respond to incidents</CardDescription>
              </CardHeader>
              <CardContent>
                {incidents.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No incidents</p>
                ) : (
                  <div className="space-y-2">
                    {incidents.map((incident) => (
                      <Card
                        key={incident.id}
                        className={`border-l-4 ${
                          incident.severity === 'critical' ? 'border-l-red-500' :
                          incident.severity === 'error' ? 'border-l-orange-500' :
                          incident.severity === 'warning' ? 'border-l-yellow-500' : 'border-l-blue-500'
                        }`}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={
                                  incident.status === 'resolved' ? 'default' :
                                  incident.status === 'acknowledged' ? 'secondary' : 'destructive'
                                }>
                                  {incident.status}
                                </Badge>
                                <Badge variant={
                                  incident.severity === 'critical' ? 'destructive' :
                                  incident.severity === 'error' ? 'default' : 'outline'
                                }>
                                  {incident.severity}
                                </Badge>
                                <span className="font-medium">{incident.title}</span>
                              </div>
                              <div className="text-sm text-muted-foreground">
                                <p>Service: {incident.service}</p>
                                <p>Created: {new Date(incident.createdAt).toLocaleString()}</p>
                                {incident.assignedTo && (
                                  <p>Assigned to: {incident.assignedTo}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {incident.status === 'triggered' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => acknowledgeIncident(incident.id)}
                                >
                                  Acknowledge
                                </Button>
                              )}
                              {incident.status !== 'resolved' && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => resolveIncident(incident.id)}
                                >
                                  Resolve
                                </Button>
                              )}
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

          <TabsContent value="services" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Services</CardTitle>
                    <CardDescription>Configure monitored services</CardDescription>
                  </div>
                  <Button onClick={addService} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Service
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {services.map((service) => (
                    <Card key={service.id} className="border-l-4 border-l-blue-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <CardTitle className="text-base">{service.name}</CardTitle>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant={
                                service.status === 'active' ? 'default' :
                                service.status === 'maintenance' ? 'secondary' : 'outline'
                              }>
                                {service.status}
                              </Badge>
                              <Badge variant="outline">
                                {service.incidentCount || 0} incidents
                              </Badge>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeService(service.id)}
                            disabled={services.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Service Name</Label>
                            <Input
                              value={service.name}
                              onChange={(e) => updateService(service.id, 'name', e.target.value)}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Integration Key</Label>
                            <Input
                              value={service.integrationKey}
                              onChange={(e) => updateService(service.id, 'integrationKey', e.target.value)}
                              placeholder="integration-key"
                              className={
                                validationErrors[`service-${services.indexOf(service)}-integrationKey`]
                                  ? 'border-red-500'
                                  : ''
                              }
                            />
                            {validationErrors[`service-${services.indexOf(service)}-integrationKey`] && (
                              <p className="text-xs text-red-500">
                                {validationErrors[`service-${services.indexOf(service)}-integrationKey`]}
                              </p>
                            )}
                          </div>
                          <div className="space-y-2">
                            <Label>Status</Label>
                            <Select
                              value={service.status}
                              onValueChange={(value: 'active' | 'maintenance' | 'disabled') => updateService(service.id, 'status', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="maintenance">Maintenance</SelectItem>
                                <SelectItem value="disabled">Disabled</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label>Escalation Policy</Label>
                            <Select
                              value={service.escalationPolicy || ''}
                              onValueChange={(value) => updateService(service.id, 'escalationPolicy', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {escalationPolicies.map((p) => (
                                  <SelectItem key={p.id} value={p.name}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Auto Resolve</Label>
                            <Switch
                              checked={service.autoResolve ?? true}
                              onCheckedChange={(checked) => updateService(service.id, 'autoResolve', checked)}
                            />
                          </div>
                          {service.autoResolve && (
                            <div className="space-y-2">
                              <Label>Resolve Timeout (seconds)</Label>
                              <Input
                                type="number"
                                value={service.resolveTimeout || 300}
                                onChange={(e) => updateService(service.id, 'resolveTimeout', Number(e.target.value))}
                                min={60}
                              />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policies" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Escalation Policies</CardTitle>
                    <CardDescription>Configure incident escalation rules</CardDescription>
                  </div>
                  <Button onClick={addEscalationPolicy} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Policy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {escalationPolicies.map((policy) => (
                    <Card key={policy.id} className="border-l-4 border-l-green-500">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 space-y-1">
                            <Label>Policy Name</Label>
                            <Input
                              value={policy.name}
                              onChange={(e) => updateEscalationPolicyName(policy.id, e.target.value)}
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeEscalationPolicy(policy.id)}
                            disabled={escalationPolicies.length === 1}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            <span>{policy.levels.length} levels</span>
                          </div>
                          <Button
                            variant="outline"
                            size="xs"
                            onClick={() => addEscalationLevel(policy.id)}
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Level
                          </Button>
                        </div>
                        <div className="space-y-2">
                          {policy.levels.map((level, lIndex) => (
                            <Card key={lIndex} className="p-3">
                              <div className="flex items-start justify-between gap-4">
                                <div className="space-y-2 flex-1">
                                  <div className="flex items-center justify-between">
                                    <p className="font-medium">Level {level.level}</p>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => removeEscalationLevel(policy.id, lIndex)}
                                      disabled={policy.levels.length === 1}
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                      <Label className="text-xs">Timeout (minutes)</Label>
                                      <Input
                                        type="number"
                                        value={level.timeout}
                                        min={1}
                                        onChange={(e) =>
                                          updateEscalationLevelTimeout(
                                            policy.id,
                                            lIndex,
                                            Number(e.target.value) || 0
                                          )
                                        }
                                      />
                                    </div>
                                    <div className="col-span-2 space-y-1">
                                      <Label className="text-xs">Targets (users or schedules)</Label>
                                      <div className="space-y-2">
                                        <div className="flex flex-wrap gap-1">
                                          {onCallUsers.map((user) => {
                                            const selected = level.targets.includes(user.id);
                                            return (
                                              <Badge
                                                key={user.id}
                                                variant={selected ? 'default' : 'outline'}
                                                className="cursor-pointer text-xs"
                                                onClick={() =>
                                                  toggleEscalationLevelTarget(
                                                    policy.id,
                                                    lIndex,
                                                    user.id
                                                  )
                                                }
                                              >
                                                👤 {user.name}
                                              </Badge>
                                            );
                                          })}
                                          {schedules.map((schedule) => {
                                            const selected = level.targets.includes(schedule.id);
                                            const onCallUserIds = getScheduleOnCallUsers(schedule.id);
                                            return (
                                              <Badge
                                                key={schedule.id}
                                                variant={selected ? 'default' : 'outline'}
                                                className="cursor-pointer text-xs"
                                                onClick={() =>
                                                  toggleEscalationLevelTarget(
                                                    policy.id,
                                                    lIndex,
                                                    schedule.id
                                                  )
                                                }
                                                title={`Schedule: ${schedule.name} (${onCallUserIds.length} on-call)`}
                                              >
                                                📅 {schedule.name}
                                              </Badge>
                                            );
                                          })}
                                          {onCallUsers.length === 0 && schedules.length === 0 && (
                                            <span className="text-xs text-muted-foreground">
                                              No targets configured
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </Card>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="oncall" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>On-Call Roster</CardTitle>
                    <CardDescription>Manage who participates in on-call and their status</CardDescription>
                  </div>
                  <Button size="sm" onClick={addOnCallUser}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {onCallUsers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No on-call users configured. Add at least one user to use escalation policies effectively.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {onCallUsers.map((user) => (
                      <Card key={user.id} className="border-l-4 border-l-purple-500">
                        <CardContent className="pt-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="space-y-2 flex-1">
                              <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                  <Label className="text-xs">Name</Label>
                                  <Input
                                    value={user.name}
                                    onChange={(e) =>
                                      updateOnCallUser(user.id, 'name', e.target.value)
                                    }
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Email</Label>
                                  <Input
                                    value={user.email}
                                    onChange={(e) =>
                                      updateOnCallUser(user.id, 'email', e.target.value)
                                    }
                                    className={
                                      validationErrors[`user-${onCallUsers.indexOf(user)}-email`]
                                        ? 'border-red-500'
                                        : ''
                                    }
                                  />
                                  {validationErrors[`user-${onCallUsers.indexOf(user)}-email`] && (
                                    <p className="text-xs text-red-500">
                                      {validationErrors[`user-${onCallUsers.indexOf(user)}-email`]}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="space-y-1">
                                  <Label className="text-xs">Status</Label>
                                  <Select
                                    value={user.status}
                                    onValueChange={(value: 'on-call' | 'off-call') =>
                                      updateOnCallUser(user.id, 'status', value)
                                    }
                                  >
                                    <SelectTrigger className="h-8 w-[140px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="on-call">On-Call</SelectItem>
                                      <SelectItem value="off-call">Off-Call</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                <Badge variant={user.status === 'on-call' ? 'default' : 'outline'}>
                                  {user.status === 'on-call' ? 'On-Call' : 'Off-Call'}
                                </Badge>
                              </div>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeOnCallUser(user.id)}
                              disabled={onCallUsers.length === 1}
                            >
                              <Trash2 className="h-4 w-4" />
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

          <TabsContent value="schedules" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Schedules</CardTitle>
                    <CardDescription>Configure on-call rotation schedules</CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Time Format:</Label>
                      <Select value={timeFormat} onValueChange={(v: '12h' | '24h') => updateFormatSettings(v)}>
                        <SelectTrigger className="h-8 w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="12h">12h</SelectItem>
                          <SelectItem value="24h">24h</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">Date Format:</Label>
                      <Select value={dateFormat} onValueChange={(v: 'YYYY-MM-DD' | 'MM/DD/YYYY' | 'DD/MM/YYYY') => updateFormatSettings(undefined, v)}>
                        <SelectTrigger className="h-8 w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                          <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                          <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={addSchedule} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Schedule
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {schedules.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No schedules configured. Create a schedule to manage on-call rotations.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {schedules.map((schedule) => {
                      const onCallUserIds = getScheduleOnCallUsers(schedule.id);
                      const onCallUsersList = onCallUsers.filter((u) => onCallUserIds.includes(u.id));
                      return (
                        <Card key={schedule.id} className="border-l-4 border-l-indigo-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 space-y-2">
                                <div className="flex items-center gap-2">
                                  <Label>Schedule Name</Label>
                                  <Input
                                    value={schedule.name}
                                    onChange={(e) => updateSchedule(schedule.id, 'name', e.target.value)}
                                    className="max-w-xs"
                                  />
                                </div>
                                <div className="flex items-center gap-2">
                                  <Label>Timezone</Label>
                                  <Select
                                    value={schedule.timezone}
                                    onValueChange={(value) => updateSchedule(schedule.id, 'timezone', value)}
                                  >
                                    <SelectTrigger className="max-w-xs">
                                      <SelectValue placeholder="Select timezone" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="UTC">UTC (Coordinated Universal Time)</SelectItem>
                                      <SelectItem value="America/New_York">America/New_York (EST/EDT)</SelectItem>
                                      <SelectItem value="America/Chicago">America/Chicago (CST/CDT)</SelectItem>
                                      <SelectItem value="America/Denver">America/Denver (MST/MDT)</SelectItem>
                                      <SelectItem value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</SelectItem>
                                      <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
                                      <SelectItem value="Europe/Paris">Europe/Paris (CET/CEST)</SelectItem>
                                      <SelectItem value="Europe/Berlin">Europe/Berlin (CET/CEST)</SelectItem>
                                      <SelectItem value="Europe/Moscow">Europe/Moscow (MSK)</SelectItem>
                                      <SelectItem value="Asia/Dubai">Asia/Dubai (GST)</SelectItem>
                                      <SelectItem value="Asia/Kolkata">Asia/Kolkata (IST)</SelectItem>
                                      <SelectItem value="Asia/Shanghai">Asia/Shanghai (CST)</SelectItem>
                                      <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                                      <SelectItem value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</SelectItem>
                                      <SelectItem value="Pacific/Auckland">Pacific/Auckland (NZST/NZDT)</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {onCallUsersList.length > 0 && (
                                  <div className="flex items-center gap-2">
                                    <Badge variant="default">Current On-Call:</Badge>
                                    {onCallUsersList.map((u) => (
                                      <Badge key={u.id} variant="outline">{u.name}</Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeSchedule(schedule.id)}
                                disabled={schedules.length === 1}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <Clock className="h-3 w-3" />
                                <span>{schedule.layers.length} layer(s)</span>
                              </div>
                              <Button
                                variant="outline"
                                size="xs"
                                onClick={() => addScheduleLayer(schedule.id)}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Layer
                              </Button>
                            </div>
                            <div className="space-y-2">
                              {schedule.layers.map((layer, lIndex) => (
                                <Card key={lIndex} className="p-3 bg-muted/50">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="space-y-2 flex-1">
                                      <div className="flex items-center justify-between">
                                        <p className="font-medium text-sm">Layer {lIndex + 1}</p>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          onClick={() => removeScheduleLayer(schedule.id, lIndex)}
                                          disabled={schedule.layers.length === 1}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                          <Label className="text-xs">Start Date & Time</Label>
                                          <div className="flex gap-2">
                                            <Input
                                              type={dateFormat === 'YYYY-MM-DD' ? 'date' : 'text'}
                                              value={dateFormat === 'YYYY-MM-DD' 
                                                ? new Date(layer.start).toISOString().split('T')[0]
                                                : formatDateForInput(layer.start)}
                                              onChange={(e) => {
                                                const dateStr = e.target.value;
                                                if (!dateStr) return;
                                                const currentDate = new Date(layer.start);
                                                let newDate: Date;
                                                
                                                if (dateFormat === 'YYYY-MM-DD') {
                                                  const [year, month, day] = dateStr.split('-').map(Number);
                                                  newDate = new Date(year, month - 1, day, currentDate.getHours(), currentDate.getMinutes());
                                                } else {
                                                  const parsed = parseDateFromInput(dateStr);
                                                  if (!parsed) return;
                                                  newDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), currentDate.getHours(), currentDate.getMinutes());
                                                }
                                                
                                                updateScheduleLayer(schedule.id, lIndex, 'start', newDate.toISOString());
                                              }}
                                              placeholder={dateFormat === 'YYYY-MM-DD' ? '' : dateFormat}
                                              className="text-xs flex-1"
                                            />
                                            <Input
                                              type={timeFormat === '24h' ? 'time' : 'text'}
                                              value={formatTimeForInput(layer.start)}
                                              onChange={(e) => {
                                                const timeStr = e.target.value;
                                                if (!timeStr) return;
                                                const currentDate = new Date(layer.start);
                                                let hours: number, minutes: number;
                                                
                                                if (timeFormat === '24h') {
                                                  [hours, minutes] = timeStr.split(':').map(Number);
                                                } else {
                                                  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
                                                  if (!match) return;
                                                  hours = Number(match[1]);
                                                  minutes = Number(match[2]);
                                                  const isPM = (match[3] || '').toUpperCase() === 'PM';
                                                  if (isPM && hours !== 12) hours += 12;
                                                  if (!isPM && hours === 12) hours = 0;
                                                }
                                                
                                                const newDate = new Date(
                                                  currentDate.getFullYear(),
                                                  currentDate.getMonth(),
                                                  currentDate.getDate(),
                                                  hours,
                                                  minutes
                                                );
                                                updateScheduleLayer(schedule.id, lIndex, 'start', newDate.toISOString());
                                              }}
                                              placeholder={timeFormat === '24h' ? 'HH:mm' : 'hh:mm AM/PM'}
                                              className="text-xs w-28"
                                            />
                                          </div>
                                        </div>
                                        <div className="space-y-1">
                                          <Label className="text-xs">Rotation Start Date & Time</Label>
                                          <div className="flex gap-2">
                                            <Input
                                              type={dateFormat === 'YYYY-MM-DD' ? 'date' : 'text'}
                                              value={dateFormat === 'YYYY-MM-DD'
                                                ? new Date(layer.rotation_virtual_start).toISOString().split('T')[0]
                                                : formatDateForInput(layer.rotation_virtual_start)}
                                              onChange={(e) => {
                                                const dateStr = e.target.value;
                                                if (!dateStr) return;
                                                const currentDate = new Date(layer.rotation_virtual_start);
                                                let newDate: Date;
                                                
                                                if (dateFormat === 'YYYY-MM-DD') {
                                                  const [year, month, day] = dateStr.split('-').map(Number);
                                                  newDate = new Date(year, month - 1, day, currentDate.getHours(), currentDate.getMinutes());
                                                } else {
                                                  const parsed = parseDateFromInput(dateStr);
                                                  if (!parsed) return;
                                                  newDate = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), currentDate.getHours(), currentDate.getMinutes());
                                                }
                                                
                                                updateScheduleLayer(schedule.id, lIndex, 'rotation_virtual_start', newDate.toISOString());
                                              }}
                                              placeholder={dateFormat === 'YYYY-MM-DD' ? '' : dateFormat}
                                              className="text-xs flex-1"
                                            />
                                            <Input
                                              type={timeFormat === '24h' ? 'time' : 'text'}
                                              value={formatTimeForInput(layer.rotation_virtual_start)}
                                              onChange={(e) => {
                                                const timeStr = e.target.value;
                                                if (!timeStr) return;
                                                const currentDate = new Date(layer.rotation_virtual_start);
                                                let hours: number, minutes: number;
                                                
                                                if (timeFormat === '24h') {
                                                  [hours, minutes] = timeStr.split(':').map(Number);
                                                } else {
                                                  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
                                                  if (!match) return;
                                                  hours = Number(match[1]);
                                                  minutes = Number(match[2]);
                                                  const isPM = (match[3] || '').toUpperCase() === 'PM';
                                                  if (isPM && hours !== 12) hours += 12;
                                                  if (!isPM && hours === 12) hours = 0;
                                                }
                                                
                                                const newDate = new Date(
                                                  currentDate.getFullYear(),
                                                  currentDate.getMonth(),
                                                  currentDate.getDate(),
                                                  hours,
                                                  minutes
                                                );
                                                updateScheduleLayer(schedule.id, lIndex, 'rotation_virtual_start', newDate.toISOString());
                                              }}
                                              placeholder={timeFormat === '24h' ? 'HH:mm' : 'hh:mm AM/PM'}
                                              className="text-xs w-28"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                      <div className="grid grid-cols-1 gap-3">
                                        <div className="space-y-1">
                                          <Label className="text-xs">Rotation Length (days)</Label>
                                          <Input
                                            type="number"
                                            value={Math.floor(layer.rotation_turn_length_seconds / 86400)}
                                            onChange={(e) => {
                                              const days = Number(e.target.value) || 7;
                                              updateScheduleLayer(schedule.id, lIndex, 'rotation_turn_length_seconds', days * 86400);
                                            }}
                                            min={1}
                                            className="text-xs"
                                          />
                                        </div>
                                      </div>
                                      <div className="space-y-1">
                                        <Label className="text-xs">Users in Rotation</Label>
                                        <div className="flex flex-wrap gap-1">
                                          {onCallUsers.map((user) => {
                                            const selected = layer.users.some((u) => u.user.id === user.id);
                                            return (
                                              <Badge
                                                key={user.id}
                                                variant={selected ? 'default' : 'outline'}
                                                className="cursor-pointer text-xs"
                                                onClick={() => toggleScheduleLayerUser(schedule.id, lIndex, user.id)}
                                              >
                                                {user.name}
                                              </Badge>
                                            );
                                          })}
                                          {onCallUsers.length === 0 && (
                                            <span className="text-xs text-muted-foreground">
                                              No on-call users configured
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </Card>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
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

