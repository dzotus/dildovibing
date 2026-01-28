import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { emulationEngine } from '@/core/EmulationEngine';
import { ArgoCDEmulationEngine, ArgoCDApplication, ArgoCDRepository, ArgoCDProject, ArgoCDSyncOperation, ArgoCDRole, ArgoCDPolicy, ArgoCDNotificationChannel, ArgoCDSyncWindow, ArgoCDSyncHook, SyncHookPhase, ArgoCDApplicationSet, ArgoCDApplicationSetGenerator, ApplicationSetGeneratorType, ArgoCDListGenerator, ArgoCDGitGenerator, ArgoCDClusterGenerator, ArgoCDApplicationSetTemplate, SyncPolicy, getSyncPolicyType, getSyncPolicyOptions, validateSyncPolicy } from '@/core/ArgoCDEmulationEngine';
import { CanvasNode } from '@/types';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { 
  Rocket, 
  CheckCircle2, 
  Settings, 
  Activity,
  RefreshCw,
  XCircle,
  Clock,
  Plus,
  Trash2,
  GitBranch,
  Database,
  FolderGit2,
  Users,
  Bell,
  Search,
  Filter,
  Edit,
  Play,
  RotateCcw,
  History,
  AlertCircle,
  Shield,
  Globe,
  Server,
  Eye,
  EyeOff,
  X,
  Save,
  Copy,
  Download,
  Upload,
  ChevronDown,
  ChevronUp,
  Package,
  Layers,
  Calendar,
  BarChart3,
  Grid3x3
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

interface ArgoCDConfigProps {
  componentId: string;
}

interface ApplicationDetailsViewProps {
  app: ArgoCDApplication;
  realSyncOperations: ArgoCDSyncOperation[];
  onRefresh: () => void;
  onSync: () => void;
  onRollback: () => void;
}

function ApplicationDetailsView({ app, realSyncOperations, onRefresh, onSync, onRollback }: ApplicationDetailsViewProps) {
  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'outofsync':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case 'progressing':
        return <RefreshCw className="h-5 w-5 text-blue-500 animate-spin" />;
      case 'degraded':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getHealthBadge = (health: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      healthy: 'default',
      degraded: 'destructive',
      progressing: 'secondary',
      missing: 'destructive',
      suspended: 'outline',
      unknown: 'outline',
    };
    return (
      <Badge variant={variants[health] || 'outline'} className="text-xs">
        {health}
      </Badge>
    );
  };

  // Generate mock resources for resource tree (in real implementation would come from Kubernetes)
  const mockResources = app.resources || [
    { kind: 'Deployment', name: `${app.name}-deployment`, namespace: app.namespace || 'default', status: 'synced', health: app.health },
    { kind: 'Service', name: `${app.name}-service`, namespace: app.namespace || 'default', status: 'synced', health: app.health },
    { kind: 'ConfigMap', name: `${app.name}-config`, namespace: app.namespace || 'default', status: 'synced', health: app.health },
  ];

  // Generate mock events timeline (in real implementation would come from Kubernetes events)
  const mockEvents = [
    { timestamp: Date.now() - 3600000, type: 'Normal', reason: 'Synced', message: `Application synced successfully to revision ${app.revision?.substring(0, 7) || 'N/A'}` },
    { timestamp: Date.now() - 7200000, type: 'Normal', reason: 'HealthCheck', message: 'Health check passed' },
    ...(app.history && app.history.length > 0 ? app.history.slice(0, 3).map(h => ({
      timestamp: h.deployedAt,
      type: 'Normal' as const,
      reason: 'Deployed',
      message: `Deployed revision ${h.revision.substring(0, 7)}`,
    })) : []),
  ].sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="space-y-4 pt-4">
      {/* Basic Information */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Server className="h-4 w-4" />
          Application Information
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label className="text-muted-foreground text-xs">Name</Label>
            <p className="font-semibold">{app.name}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Status</Label>
            <div className="flex items-center gap-2">
              {getStatusIcon(app.status)}
              <span className="capitalize">{app.status}</span>
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Health</Label>
            <div>{getHealthBadge(app.health)}</div>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Namespace</Label>
            <p>{app.namespace || 'default'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Project</Label>
            <p>{app.project || 'default'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Sync Policy</Label>
            <div>
              <p className="capitalize">{getSyncPolicyType(app.syncPolicy)}</p>
              {getSyncPolicyType(app.syncPolicy) === 'automated' && (
                <div className="flex gap-2 mt-1">
                  {getSyncPolicyOptions(app.syncPolicy).prune && (
                    <Badge variant="outline" className="text-xs">Prune</Badge>
                  )}
                  {getSyncPolicyOptions(app.syncPolicy).selfHeal && (
                    <Badge variant="outline" className="text-xs">Self-Heal</Badge>
                  )}
                </div>
              )}
            </div>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Repository</Label>
            <p className="text-sm break-all">{app.repository}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Path</Label>
            <p>{app.path || '.'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Target Revision</Label>
            <p>{app.targetRevision || 'main'}</p>
          </div>
          <div>
            <Label className="text-muted-foreground text-xs">Current Revision</Label>
            <p className="font-mono text-sm">{app.revision || 'N/A'}</p>
          </div>
          {app.lastSync && (
            <div>
              <Label className="text-muted-foreground text-xs">Last Sync</Label>
              <p>{formatTimeAgo(app.lastSync)}</p>
              {app.lastSyncDuration && (
                <p className="text-xs text-muted-foreground">
                  Duration: {(app.lastSyncDuration / 1000).toFixed(1)}s
                </p>
              )}
            </div>
          )}
          {app.destination && (
            <>
              <div>
                <Label className="text-muted-foreground text-xs">Destination Server</Label>
                <p className="text-sm break-all">{app.destination.server || 'N/A'}</p>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Destination Namespace</Label>
                <p>{app.destination.namespace || 'N/A'}</p>
              </div>
            </>
          )}
        </div>
      </div>

      <Separator />

      {/* Resource Tree */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Layers className="h-4 w-4" />
          Resource Tree ({mockResources.length} resources)
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto border rounded p-3">
          {mockResources.map((resource, index) => (
            <div key={`${resource.kind}-${resource.name}-${index}`} className="flex items-center justify-between p-2 border rounded hover:bg-muted/50">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="font-medium text-sm">{resource.kind}</div>
                  <div className="text-xs text-muted-foreground">{resource.name}</div>
                  {resource.namespace && (
                    <div className="text-xs text-muted-foreground">Namespace: {resource.namespace}</div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={resource.status === 'synced' ? 'default' : resource.status === 'outofsync' ? 'destructive' : 'secondary'} className="text-xs">
                  {resource.status}
                </Badge>
                {getHealthBadge(resource.health)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <Separator />

      {/* Sync History */}
      {app.history && app.history.length > 0 && (
        <>
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <History className="h-4 w-4" />
              Sync History ({app.history.length} entries)
            </h3>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {app.history.map((entry, index) => (
                <div key={entry.id || index} className="flex items-center justify-between p-2 border rounded hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <span className="font-mono text-sm">{entry.revision.substring(0, 7)}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatTimeAgo(entry.deployedAt)}
                    </span>
                    {entry.deployedBy && (
                      <span className="text-xs text-muted-foreground">
                        by {entry.deployedBy}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {index === 0 && (
                      <Badge variant="secondary" className="text-xs">Current</Badge>
                    )}
                    {index > 0 && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm(`Rollback to revision ${entry.revision.substring(0, 7)}?`)) {
                            onRollback();
                          }
                        }}
                      >
                        <RotateCcw className="h-3 w-3 mr-1" />
                        Rollback
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Separator />
        </>
      )}

      {/* Events Timeline */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Events Timeline ({mockEvents.length} events)
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {mockEvents.map((event, index) => (
            <div key={index} className="flex items-start gap-3 p-2 border rounded hover:bg-muted/50">
              <div className={`h-2 w-2 rounded-full mt-2 ${event.type === 'Normal' ? 'bg-green-500' : 'bg-red-500'}`} />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{event.reason}</span>
                  <Badge variant={event.type === 'Normal' ? 'default' : 'destructive'} className="text-xs">
                    {event.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground ml-auto">
                    {formatTimeAgo(event.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{event.message}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Sync Operations */}
      {realSyncOperations.filter(op => op.application === app.name && op.status === 'running').length > 0 && (
        <>
          <Separator />
          <div>
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Active Sync Operations
            </h3>
            <div className="space-y-2">
              {realSyncOperations
                .filter(op => op.application === app.name && op.status === 'running')
                .map(op => (
                  <div key={op.id} className="flex items-center gap-2 p-2 border rounded">
                    <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />
                    <span className="text-sm">Sync in progress...</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      Started {formatTimeAgo(op.startedAt)}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      <Separator />
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onRefresh}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
        <Button size="sm" onClick={onSync} disabled={app.status === 'progressing'}>
          <Play className="h-4 w-4 mr-2" />
          Sync Now
        </Button>
        {app.history && app.history.length > 1 && (
          <Button size="sm" variant="outline" onClick={onRollback}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Rollback
          </Button>
        )}
      </div>
    </div>
  );
}

interface ArgoCDConfig {
  serverUrl?: string;
  enableSSO?: boolean;
  ssoProvider?: 'oidc' | 'saml' | 'ldap';
  enableRBAC?: boolean;
  enableSyncPolicy?: boolean;
  autoSync?: boolean;
  syncPolicy?: 'automated' | 'manual' | 'sync-window';
  enableHealthChecks?: boolean;
  enableNotifications?: boolean;
  notificationChannels?: string[];
  applications?: Array<{
    name: string;
    namespace?: string;
    project?: string;
    repository: string;
    path?: string;
    targetRevision?: string;
    destination?: {
      server?: string;
      namespace?: string;
    };
    syncPolicy?: 'automated' | 'manual' | 'sync-window';
  }>;
  repositories?: Array<{
    name: string;
    url: string;
    type?: 'git' | 'helm' | 'oci';
    username?: string;
    password?: string;
    insecure?: boolean;
    project?: string;
  }>;
  projects?: Array<{
    name: string;
    description?: string;
    sourceRepos?: string[];
    destinations?: Array<{
      server?: string;
      namespace?: string;
    }>;
  }>;
  roles?: Array<{
    name: string;
    description?: string;
    policies?: string[];
    groups?: string[];
  }>;
  notificationChannelsConfig?: Array<{
    name: string;
    type?: 'slack' | 'email' | 'pagerduty' | 'webhook' | 'opsgenie' | 'msteams';
    enabled?: boolean;
    config?: Record<string, unknown>;
    triggers?: Array<{
      event: 'sync-success' | 'sync-failed' | 'health-degraded' | 'health-progressing' | 'sync-running' | 'app-created' | 'app-deleted';
      condition?: string;
    }>;
  }>;
  syncWindows?: Array<{
    name: string;
    description?: string;
    schedule: string;
    duration?: number;
    kind?: 'allow' | 'deny';
    applications?: string[];
    projects?: string[];
    manualSync?: boolean;
    enabled?: boolean;
  }>;
}

export function ArgoCDConfigAdvanced({ componentId }: ArgoCDConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { isRunning, getComponentMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Get Argo CD emulation engine
  const argoCDEngine = emulationEngine.getArgoCDEmulationEngine(componentId);
  const componentMetrics = getComponentMetrics(componentId);

  const config = (node.data.config as any) || {} as ArgoCDConfig;

  // Real-time data from emulation
  const [realApplications, setRealApplications] = useState<ArgoCDApplication[]>([]);
  const [realRepositories, setRealRepositories] = useState<ArgoCDRepository[]>([]);
  const [realProjects, setRealProjects] = useState<ArgoCDProject[]>([]);
  const [realSyncOperations, setRealSyncOperations] = useState<ArgoCDSyncOperation[]>([]);
  const [realSyncHistory, setRealSyncHistory] = useState<Array<{ timestamp: number; duration: number; status: 'success' | 'failed'; operationId?: string; application?: string }>>([]);
  const [realMetrics, setRealMetrics] = useState<any>(null);
  const [realRoles, setRealRoles] = useState<ArgoCDRole[]>([]);
  const [realNotificationChannels, setRealNotificationChannels] = useState<ArgoCDNotificationChannel[]>([]);
  const [realSyncWindows, setRealSyncWindows] = useState<ArgoCDSyncWindow[]>([]);
  const [realApplicationSets, setRealApplicationSets] = useState<ArgoCDApplicationSet[]>([]);

  // UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'synced' | 'outofsync' | 'progressing' | 'degraded'>('all');
  const [filterHealth, setFilterHealth] = useState<'all' | 'healthy' | 'degraded' | 'progressing'>('all');
  const [expandedApplications, setExpandedApplications] = useState<Set<string>>(new Set());
  const [syncOpFilterStatus, setSyncOpFilterStatus] = useState<'all' | 'running' | 'success' | 'failed'>('all');
  const [selectedSyncOp, setSelectedSyncOp] = useState<string | null>(null);
  const [showAddApplication, setShowAddApplication] = useState(false);
  const [showEditApplication, setShowEditApplication] = useState(false);
  const [showAddRepository, setShowAddRepository] = useState(false);
  const [showEditRepository, setShowEditRepository] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [showEditProject, setShowEditProject] = useState(false);
  const [showAddRole, setShowAddRole] = useState(false);
  const [showEditRole, setShowEditRole] = useState(false);
  const [showAddNotificationChannel, setShowAddNotificationChannel] = useState(false);
  const [showEditNotificationChannel, setShowEditNotificationChannel] = useState(false);
  const [editingApplication, setEditingApplication] = useState<ArgoCDApplication | null>(null);
  const [editingRepository, setEditingRepository] = useState<ArgoCDRepository | null>(null);
  const [editingProject, setEditingProject] = useState<ArgoCDProject | null>(null);
  const [editingRole, setEditingRole] = useState<ArgoCDRole | null>(null);
  const [editingNotificationChannel, setEditingNotificationChannel] = useState<ArgoCDNotificationChannel | null>(null);

  // Form states for new application
  const [newAppName, setNewAppName] = useState('');
  const [newAppNamespace, setNewAppNamespace] = useState('default');
  const [newAppProject, setNewAppProject] = useState('default');
  const [newAppRepository, setNewAppRepository] = useState('');
  const [newAppPath, setNewAppPath] = useState('.');
  const [newAppTargetRevision, setNewAppTargetRevision] = useState('main');
  const [newAppDestinationServer, setNewAppDestinationServer] = useState('https://kubernetes.default.svc');
  const [newAppDestinationNamespace, setNewAppDestinationNamespace] = useState('default');
  const [newAppSyncPolicy, setNewAppSyncPolicy] = useState<'automated' | 'manual' | 'sync-window'>('manual');
  const [newAppSyncPolicyPrune, setNewAppSyncPolicyPrune] = useState(false);
  const [newAppSyncPolicySelfHeal, setNewAppSyncPolicySelfHeal] = useState(false);
  
  // Helm chart configuration states
  const [newAppHelmChart, setNewAppHelmChart] = useState('');
  const [newAppHelmVersion, setNewAppHelmVersion] = useState('latest');
  const [newAppHelmReleaseName, setNewAppHelmReleaseName] = useState('');
  const [newAppHelmValues, setNewAppHelmValues] = useState('');
  const [newAppHelmValueFiles, setNewAppHelmValueFiles] = useState<string[]>([]);
  const [newAppHelmSkipCrds, setNewAppHelmSkipCrds] = useState(false);

  // Form states for new repository
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoUrl, setNewRepoUrl] = useState('');
  const [newRepoType, setNewRepoType] = useState<'git' | 'helm' | 'oci'>('git');
  const [newRepoUsername, setNewRepoUsername] = useState('');
  const [newRepoPassword, setNewRepoPassword] = useState('');
  const [newRepoInsecure, setNewRepoInsecure] = useState(false);
  const [newRepoProject, setNewRepoProject] = useState('');

  // Form states for new project
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDescription, setNewProjectDescription] = useState('');
  const [newProjectSourceRepos, setNewProjectSourceRepos] = useState<string[]>([]);
  const [newProjectDestinations, setNewProjectDestinations] = useState<Array<{ server?: string; namespace?: string }>>([]);

  // Form states for new role
  const [newRoleName, setNewRoleName] = useState('');
  const [newRoleDescription, setNewRoleDescription] = useState('');
  const [newRolePolicies, setNewRolePolicies] = useState<ArgoCDPolicy[]>([]);
  const [newRoleGroups, setNewRoleGroups] = useState<string[]>([]);

  // Form states for new notification channel
  const [newChannelName, setNewChannelName] = useState('');
  const [newChannelType, setNewChannelType] = useState<'slack' | 'email' | 'pagerduty' | 'webhook' | 'opsgenie' | 'msteams'>('slack');
  const [newChannelEnabled, setNewChannelEnabled] = useState(true);
  const [newChannelUrl, setNewChannelUrl] = useState('');
  const [newChannelChannel, setNewChannelChannel] = useState('');
  const [newChannelRecipients, setNewChannelRecipients] = useState<string[]>([]);
  const [newChannelServiceKey, setNewChannelServiceKey] = useState('');
  const [newChannelTriggers, setNewChannelTriggers] = useState<Array<{ event: string; condition?: string }>>([]);

  // Form states for new sync window
  const [newSyncWindowName, setNewSyncWindowName] = useState('');
  
  // Form states for hooks management
  const [appHooks, setAppHooks] = useState<ArgoCDSyncHook[]>([]);
  const [showAddHook, setShowAddHook] = useState(false);
  const [newHookName, setNewHookName] = useState('');
  const [newHookKind, setNewHookKind] = useState('Job');
  const [newHookPhase, setNewHookPhase] = useState<SyncHookPhase>('PreSync');
  const [newHookDeletePolicy, setNewHookDeletePolicy] = useState<'HookSucceeded' | 'HookFailed' | 'BeforeHookCreation'>('HookSucceeded');
  const [newSyncWindowDescription, setNewSyncWindowDescription] = useState('');
  const [newSyncWindowSchedule, setNewSyncWindowSchedule] = useState('09:00-17:00');
  const [newSyncWindowDuration, setNewSyncWindowDuration] = useState<number | undefined>(undefined);
  const [newSyncWindowKind, setNewSyncWindowKind] = useState<'allow' | 'deny'>('deny');
  const [newSyncWindowApplications, setNewSyncWindowApplications] = useState<string[]>([]);
  const [newSyncWindowProjects, setNewSyncWindowProjects] = useState<string[]>([]);
  const [newSyncWindowManualSync, setNewSyncWindowManualSync] = useState(false);
  const [newSyncWindowEnabled, setNewSyncWindowEnabled] = useState(true);
  const [showAddSyncWindow, setShowAddSyncWindow] = useState(false);
  const [showEditSyncWindow, setShowEditSyncWindow] = useState(false);
  const [editingSyncWindow, setEditingSyncWindow] = useState<ArgoCDSyncWindow | null>(null);

  // Form states for ApplicationSet
  const [showAddApplicationSet, setShowAddApplicationSet] = useState(false);
  const [showEditApplicationSet, setShowEditApplicationSet] = useState(false);
  const [editingApplicationSet, setEditingApplicationSet] = useState<ArgoCDApplicationSet | null>(null);
  const [newAppSetName, setNewAppSetName] = useState('');
  const [newAppSetNamespace, setNewAppSetNamespace] = useState('default');
  const [newAppSetEnabled, setNewAppSetEnabled] = useState(true);
  const [newAppSetSyncPolicy, setNewAppSetSyncPolicy] = useState<'automated' | 'manual' | 'sync-window'>('manual');
  const [newAppSetPreserveResources, setNewAppSetPreserveResources] = useState(false);
  const [newAppSetGoTemplate, setNewAppSetGoTemplate] = useState(false);
  const [newAppSetGenerators, setNewAppSetGenerators] = useState<ArgoCDApplicationSetGenerator[]>([]);
  const [newAppSetTemplate, setNewAppSetTemplate] = useState<ArgoCDApplicationSetTemplate>({});
  const [appSetNameError, setAppSetNameError] = useState<string>('');
  const [expandedGenerators, setExpandedGenerators] = useState<Set<number>>(new Set());
  const [showAddGeneratorType, setShowAddGeneratorType] = useState<number | null>(null);

  // Validation errors
  const [appNameError, setAppNameError] = useState<string>('');
  const [appRepositoryError, setAppRepositoryError] = useState<string>('');
  const [repoNameError, setRepoNameError] = useState<string>('');
  const [repoUrlError, setRepoUrlError] = useState<string>('');
  const [projectNameError, setProjectNameError] = useState<string>('');
  const [roleNameError, setRoleNameError] = useState<string>('');
  const [channelNameError, setChannelNameError] = useState<string>('');
  const [syncWindowNameError, setSyncWindowNameError] = useState<string>('');
  const [syncWindowScheduleError, setSyncWindowScheduleError] = useState<string>('');

  // Debounce timer ref для оптимизации обновлений
  const updateTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // Debounced update function для оптимизации производительности
  const debouncedUpdateData = useCallback(() => {
    if (updateTimerRef.current) {
      clearTimeout(updateTimerRef.current);
    }
    
    updateTimerRef.current = setTimeout(() => {
      if (!argoCDEngine) return;
      
      try {
        const applications = argoCDEngine.getApplications();
        const repositories = argoCDEngine.getRepositories();
        const projects = argoCDEngine.getProjects();
        const syncOperations = argoCDEngine.getSyncOperations();
        const syncHistory = argoCDEngine.getSyncHistory();
        const metrics = argoCDEngine.getMetrics();
        const roles = argoCDEngine.getRoles();
        const notificationChannels = argoCDEngine.getNotificationChannels();
        const syncWindows = argoCDEngine.getSyncWindows();
        const applicationSets = argoCDEngine.getApplicationSets();
        
        setRealApplications(applications);
        setRealRepositories(repositories);
        setRealProjects(projects);
        setRealSyncOperations(syncOperations);
        setRealSyncHistory(syncHistory);
        setRealMetrics(metrics);
        setRealRoles(roles);
        setRealNotificationChannels(notificationChannels);
        setRealSyncWindows(syncWindows);
        setRealApplicationSets(applicationSets);
      } catch (error) {
        console.error('Error updating Argo CD data:', error);
      }
    }, isRunning ? 300 : 1000); // Debounce: 300ms при запущенной симуляции, 1000ms при остановленной
  }, [argoCDEngine, isRunning]);
  
  // Update real-time data from emulation с debounce
  useEffect(() => {
    if (!argoCDEngine) return;
    
    // Первое обновление сразу
    debouncedUpdateData();
    
    // Затем обновляем с интервалом (debounce уже внутри функции)
    const interval = setInterval(debouncedUpdateData, isRunning ? 500 : 2000);
    
    return () => {
      clearInterval(interval);
      if (updateTimerRef.current) {
        clearTimeout(updateTimerRef.current);
      }
    };
  }, [argoCDEngine, isRunning, debouncedUpdateData]);

  // Sync config with emulation engine when it changes (only when config actually changes)
  useEffect(() => {
    if (!argoCDEngine || !node) return;
    
    // Use a ref to track if we've already initialized to avoid infinite loops
    const configKey = JSON.stringify({
      apps: config.applications?.map(a => a.name).sort(),
      repos: config.repositories?.map(r => r.name).sort(),
      projects: config.projects?.map(p => p.name).sort(),
    });
    
    // Only sync if config structure changed (not runtime state)
    argoCDEngine.initializeConfig(node);
  }, [argoCDEngine, node, config.applications?.length, config.repositories?.length, config.projects?.length]);

  // Filtered applications
  const filteredApplications = useMemo(() => {
    let filtered = realApplications.length > 0 ? realApplications : (config.applications || []);
    
    if (searchQuery) {
      filtered = filtered.filter(app => 
        app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (app.namespace && app.namespace.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (app.repository && app.repository.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    if (filterStatus !== 'all') {
      filtered = filtered.filter(app => app.status === filterStatus);
    }
    
    if (filterHealth !== 'all') {
      filtered = filtered.filter(app => app.health === filterHealth);
    }
    
    return filtered;
  }, [realApplications, config.applications, searchQuery, filterStatus, filterHealth]);

  // Determine selected repository type and available Helm charts
  const selectedRepository = useMemo(() => {
    if (!newAppRepository) return null;
    const repos = realRepositories.length > 0 ? realRepositories : (config.repositories || []);
    return repos.find(repo => 
      repo.name === newAppRepository.trim() || 
      repo.url === newAppRepository.trim()
    ) || null;
  }, [newAppRepository, realRepositories, config.repositories]);
  
  const isHelmRepository = selectedRepository?.type === 'helm';
  const availableHelmCharts = useMemo(() => {
    if (!isHelmRepository || !argoCDEngine) return [];
    return argoCDEngine.getHelmCharts(selectedRepository.name);
  }, [isHelmRepository, selectedRepository, argoCDEngine]);
  
  const selectedHelmChartVersions = useMemo(() => {
    if (!isHelmRepository || !newAppHelmChart || !argoCDEngine) return [];
    return argoCDEngine.getHelmChartVersions(selectedRepository!.name, newAppHelmChart);
  }, [isHelmRepository, selectedRepository, newAppHelmChart, argoCDEngine]);

  // Filtered repositories
  const filteredRepositories = useMemo(() => {
    let filtered = realRepositories.length > 0 ? realRepositories : (config.repositories || []);
    
    if (searchQuery) {
      filtered = filtered.filter(repo => 
        repo.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        repo.url.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return filtered;
  }, [realRepositories, config.repositories, searchQuery]);

  // Filtered projects
  const filteredProjects = useMemo(() => {
    let filtered = realProjects.length > 0 ? realProjects : (config.projects || []);
    
    if (searchQuery) {
      filtered = filtered.filter(project => 
        project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (project.description && project.description.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    return filtered;
  }, [realProjects, config.projects, searchQuery]);

  // Calculate stats from real metrics or config
  const stats = useMemo(() => {
    if (realMetrics) {
      return {
        totalApps: realMetrics.applicationsTotal || 0,
        syncedApps: realMetrics.applicationsSynced || 0,
        outOfSyncApps: realMetrics.applicationsOutOfSync || 0,
        progressingApps: realMetrics.applicationsProgressing || 0,
        degradedApps: realMetrics.applicationsDegraded || 0,
        healthyApps: realMetrics.applicationsHealthy || 0,
        syncRate: realMetrics.syncRate || 0,
        repositoriesTotal: realMetrics.repositoriesTotal || 0,
        repositoriesConnected: realMetrics.repositoriesConnected || 0,
        projectsTotal: realMetrics.projectsTotal || 0,
      };
    }
    
    const apps = realApplications.length > 0 ? realApplications : (config.applications || []);
    return {
      totalApps: apps.length,
      syncedApps: apps.filter(a => a.status === 'synced').length,
      outOfSyncApps: apps.filter(a => a.status === 'outofsync').length,
      progressingApps: apps.filter(a => a.status === 'progressing').length,
      degradedApps: apps.filter(a => a.status === 'degraded').length,
      healthyApps: apps.filter(a => a.health === 'healthy').length,
      syncRate: 0,
      repositoriesTotal: realRepositories.length || config.repositories?.length || 0,
      repositoriesConnected: realRepositories.filter(r => r.connectionStatus === 'successful').length,
      projectsTotal: realProjects.length || config.projects?.length || 0,
    };
  }, [realMetrics, realApplications, realRepositories, realProjects, config]);

  // Prepare chart data for sync rate over time
  const syncRateChartData = useMemo(() => {
    if (!realSyncHistory || realSyncHistory.length === 0) {
      return [];
    }

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const hourlyData: Map<number, number> = new Map();
    
    // Initialize all hours with 0
    for (let i = 23; i >= 0; i--) {
      const hourTimestamp = now - i * 60 * 60 * 1000;
      const hourKey = Math.floor(hourTimestamp / (60 * 60 * 1000));
      hourlyData.set(hourKey, 0);
    }

    // Count syncs per hour
    realSyncHistory
      .filter(s => s.timestamp >= oneDayAgo)
      .forEach(sync => {
        const hourKey = Math.floor(sync.timestamp / (60 * 60 * 1000));
        hourlyData.set(hourKey, (hourlyData.get(hourKey) || 0) + 1);
      });

    // Convert to array for chart
    return Array.from(hourlyData.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([hourKey, count]) => {
        const hourTimestamp = hourKey * 60 * 60 * 1000;
        const date = new Date(hourTimestamp);
        return {
          time: `${date.getHours().toString().padStart(2, '0')}:00`,
          syncs: count,
          timestamp: hourTimestamp
        };
      });
  }, [realSyncHistory]);

  // Prepare chart data for sync duration over time
  const syncDurationChartData = useMemo(() => {
    if (!realSyncHistory || realSyncHistory.length === 0) {
      return [];
    }

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const hourlyData: Map<number, { total: number; count: number }> = new Map();
    
    // Initialize all hours
    for (let i = 23; i >= 0; i--) {
      const hourTimestamp = now - i * 60 * 60 * 1000;
      const hourKey = Math.floor(hourTimestamp / (60 * 60 * 1000));
      hourlyData.set(hourKey, { total: 0, count: 0 });
    }

    // Calculate average duration per hour
    realSyncHistory
      .filter(s => s.timestamp >= oneDayAgo && s.status === 'success')
      .forEach(sync => {
        const hourKey = Math.floor(sync.timestamp / (60 * 60 * 1000));
        const hourData = hourlyData.get(hourKey);
        if (hourData) {
          hourData.total += sync.duration;
          hourData.count += 1;
        }
      });

    // Convert to array for chart
    return Array.from(hourlyData.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([hourKey, data]) => {
        const hourTimestamp = hourKey * 60 * 60 * 1000;
        const date = new Date(hourTimestamp);
        const avgDuration = data.count > 0 ? data.total / data.count / 1000 : 0; // Convert to seconds
        return {
          time: `${date.getHours().toString().padStart(2, '0')}:00`,
          duration: Number(avgDuration.toFixed(2)),
          timestamp: hourTimestamp
        };
      });
  }, [realSyncHistory]);

  // Prepare chart data for health status distribution
  const healthStatusChartData = useMemo(() => {
    if (!realApplications || realApplications.length === 0) {
      return [];
    }

    const healthCounts = {
      healthy: 0,
      degraded: 0,
      progressing: 0,
      suspended: 0,
      missing: 0,
      unknown: 0
    };

    realApplications.forEach(app => {
      const health = app.health || 'unknown';
      if (health in healthCounts) {
        healthCounts[health as keyof typeof healthCounts]++;
      } else {
        healthCounts.unknown++;
      }
    });

    return Object.entries(healthCounts)
      .filter(([_, count]) => count > 0)
      .map(([status, count]) => ({
        name: status.charAt(0).toUpperCase() + status.slice(1),
        value: count
      }));
  }, [realApplications]);

  // Prepare chart data for sync success rate
  const syncSuccessRateChartData = useMemo(() => {
    if (!realSyncHistory || realSyncHistory.length === 0) {
      return [];
    }

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const recentSyncs = realSyncHistory.filter(s => s.timestamp >= oneDayAgo);
    
    const successCount = recentSyncs.filter(s => s.status === 'success').length;
    const failedCount = recentSyncs.filter(s => s.status === 'failed').length;

    return [
      { name: 'Success', value: successCount, color: '#22c55e' },
      { name: 'Failed', value: failedCount, color: '#ef4444' }
    ].filter(item => item.value > 0);
  }, [realSyncHistory]);

  const updateConfig = (updates: Partial<ArgoCDConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  // Application CRUD operations
  const handleAddApplication = () => {
    // Validation
    let hasError = false;
    
    if (!newAppName.trim()) {
      setAppNameError('Application name is required');
      hasError = true;
    } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(newAppName)) {
      setAppNameError('Application name must be a valid Kubernetes name (lowercase alphanumeric and hyphens)');
      hasError = true;
    } else {
      // Check if application already exists
      const existingApps = realApplications.length > 0 ? realApplications : (config.applications || []);
      if (existingApps.some(app => app.name === newAppName.trim())) {
        setAppNameError('Application with this name already exists');
        hasError = true;
      } else {
        setAppNameError('');
      }
    }
    
    if (!newAppRepository.trim()) {
      setAppRepositoryError('Repository is required');
      hasError = true;
    } else {
      // Check if repository exists (by name or URL)
      const existingRepos = realRepositories.length > 0 ? realRepositories : (config.repositories || []);
      const repoExists = existingRepos.some(repo => 
        repo.name === newAppRepository.trim() || 
        repo.url === newAppRepository.trim()
      );
      
      if (!repoExists) {
        setAppRepositoryError('Repository not found. Please add the repository first or use an existing repository name/URL.');
        hasError = true;
      } else {
        setAppRepositoryError('');
        
        // Для Helm repositories проверяем что chart выбран
        if (isHelmRepository && !newAppHelmChart.trim()) {
          setAppRepositoryError('Helm chart is required for Helm repositories');
          hasError = true;
        }
      }
    }
    
    if (hasError) return;
    
    // Создаем правильный формат syncPolicy
    const syncPolicyForApp: SyncPolicy = newAppSyncPolicy === 'automated' && (newAppSyncPolicyPrune || newAppSyncPolicySelfHeal)
      ? {
          type: 'automated' as const,
          options: {
            prune: newAppSyncPolicyPrune || undefined,
            selfHeal: newAppSyncPolicySelfHeal || undefined,
          },
        }
      : newAppSyncPolicy;
    
    // Валидация sync policy
    const syncWindows = realSyncWindows.length > 0 ? realSyncWindows : (config.syncWindows || []);
    const syncPolicyValidation = validateSyncPolicy(
      syncPolicyForApp,
      syncWindows,
      newAppName.trim(),
      newAppProject || 'default'
    );
    
    if (!syncPolicyValidation.valid) {
      // Показываем ошибки валидации
      syncPolicyValidation.errors.forEach(error => {
        toast({
          title: "Sync Policy Validation Error",
          description: error,
          variant: "destructive",
        });
      });
      return;
    }
    
    // Показываем предупреждения если есть
    if (syncPolicyValidation.warnings.length > 0) {
      syncPolicyValidation.warnings.forEach(warning => {
        toast({
          title: "Sync Policy Warning",
          description: warning,
          variant: "default",
        });
      });
    }
    
    const newApp: ArgoCDApplication = {
      name: newAppName,
      namespace: newAppNamespace || undefined,
      project: newAppProject || 'default',
      repository: newAppRepository,
      path: isHelmRepository ? (newAppHelmChart || '.') : (newAppPath || '.'),
      targetRevision: isHelmRepository ? (newAppHelmVersion || 'latest') : (newAppTargetRevision || 'main'),
      destination: {
        server: newAppDestinationServer || 'https://kubernetes.default.svc',
        namespace: newAppDestinationNamespace || 'default',
      },
      helm: isHelmRepository && newAppHelmChart ? {
        chart: newAppHelmChart,
        version: newAppHelmVersion || 'latest',
        releaseName: newAppHelmReleaseName || undefined,
        values: newAppHelmValues ? (newAppHelmValues.trim() || undefined) : undefined,
        valueFiles: newAppHelmValueFiles.length > 0 ? newAppHelmValueFiles : undefined,
        skipCrds: newAppHelmSkipCrds || undefined,
      } : undefined,
      syncPolicy: syncPolicyForApp,
      status: 'progressing',
      health: 'progressing',
    };
    
    // Add to config
    const currentApps = config.applications || [];
    const syncPolicyForConfig: SyncPolicy = syncPolicyForApp;
    
    updateConfig({
      applications: [...currentApps, {
        name: newApp.name,
        namespace: newApp.namespace,
        project: newApp.project,
        repository: newApp.repository,
        path: newApp.path,
        targetRevision: newApp.targetRevision,
        destination: newApp.destination,
        helm: newApp.helm,
        syncPolicy: syncPolicyForConfig,
      }],
    });
    
    // Add to emulation engine
    if (argoCDEngine) {
      argoCDEngine.addApplication(newApp);
    }
    
    // Reset form
    setNewAppName('');
    setNewAppNamespace('default');
    setNewAppProject('default');
    setNewAppRepository('');
    setNewAppPath('.');
    setNewAppTargetRevision('main');
    setNewAppDestinationServer('https://kubernetes.default.svc');
    setNewAppDestinationNamespace('default');
    setNewAppSyncPolicy('manual');
    setNewAppSyncPolicyPrune(false);
    setNewAppSyncPolicySelfHeal(false);
    setNewAppHelmChart('');
    setNewAppHelmVersion('latest');
    setNewAppHelmReleaseName('');
    setNewAppHelmValues('');
    setNewAppHelmValueFiles([]);
    setNewAppHelmSkipCrds(false);
    setShowAddApplication(false);
    
    toast({
      title: "Application added",
      description: `Application "${newApp.name}" has been added successfully.`,
    });
  };

  const handleEditApplication = (app: ArgoCDApplication) => {
    setEditingApplication(app);
    setNewAppName(app.name);
    setNewAppNamespace(app.namespace || 'default');
    setNewAppProject(app.project || 'default');
    setNewAppRepository(app.repository);
    setNewAppPath(app.path || '.');
    setNewAppTargetRevision(app.targetRevision || 'main');
    setNewAppDestinationServer(app.destination?.server || 'https://kubernetes.default.svc');
    setNewAppDestinationNamespace(app.destination?.namespace || 'default');
    // Helm конфигурация
    if (app.helm) {
      setNewAppHelmChart(app.helm.chart || app.path || '');
      setNewAppHelmVersion(app.helm.version || app.targetRevision || 'latest');
      setNewAppHelmReleaseName(app.helm.releaseName || '');
      setNewAppHelmValues(typeof app.helm.values === 'string' ? app.helm.values : (app.helm.values ? JSON.stringify(app.helm.values, null, 2) : ''));
      setNewAppHelmValueFiles(app.helm.valueFiles || []);
      setNewAppHelmSkipCrds(app.helm.skipCrds || false);
    } else {
      setNewAppHelmChart('');
      setNewAppHelmVersion('latest');
      setNewAppHelmReleaseName('');
      setNewAppHelmValues('');
      setNewAppHelmValueFiles([]);
      setNewAppHelmSkipCrds(false);
    }
    // Извлекаем тип и опции из syncPolicy
    const syncPolicyType = getSyncPolicyType(app.syncPolicy);
    const syncPolicyOptions = getSyncPolicyOptions(app.syncPolicy);
    setNewAppSyncPolicy(syncPolicyType);
    setNewAppSyncPolicyPrune(syncPolicyOptions.prune ?? false);
    setNewAppSyncPolicySelfHeal(syncPolicyOptions.selfHeal ?? false);
    // Загружаем hooks из application или из engine
    if (argoCDEngine) {
      const hooks = argoCDEngine.getApplicationHooks(app.name);
      setAppHooks(hooks);
    } else {
      setAppHooks(app.hooks || []);
    }
    setShowEditApplication(true);
  };

  const handleSaveApplication = () => {
    if (!editingApplication) return;
    
    let hasError = false;
    
    if (!newAppName.trim()) {
      setAppNameError('Application name is required');
      hasError = true;
    } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(newAppName)) {
      setAppNameError('Application name must be a valid Kubernetes name (lowercase alphanumeric and hyphens)');
      hasError = true;
    } else {
      // Check if application name already exists (excluding current)
      const existingApps = realApplications.length > 0 ? realApplications : (config.applications || []);
      if (existingApps.some(app => app.name === newAppName.trim() && app.name !== editingApplication.name)) {
        setAppNameError('Application with this name already exists');
        hasError = true;
      } else {
        setAppNameError('');
      }
    }
    
    if (!newAppRepository.trim()) {
      setAppRepositoryError('Repository is required');
      hasError = true;
    } else {
      // Check if repository exists (by name or URL)
      const existingRepos = realRepositories.length > 0 ? realRepositories : (config.repositories || []);
      const repoExists = existingRepos.some(repo => 
        repo.name === newAppRepository.trim() || 
        repo.url === newAppRepository.trim()
      );
      
      if (!repoExists) {
        setAppRepositoryError('Repository not found. Please add the repository first or use an existing repository name/URL.');
        hasError = true;
      } else {
        setAppRepositoryError('');
        
        // Для Helm repositories проверяем что chart выбран
        if (isHelmRepository && !newAppHelmChart.trim()) {
          setAppRepositoryError('Helm chart is required for Helm repositories');
          hasError = true;
        }
      }
    }
    
    if (hasError) return;
    
      // Создаем правильный формат syncPolicy
      const syncPolicyForApp: SyncPolicy = newAppSyncPolicy === 'automated' && (newAppSyncPolicyPrune || newAppSyncPolicySelfHeal)
        ? {
            type: 'automated' as const,
            options: {
              prune: newAppSyncPolicyPrune || undefined,
              selfHeal: newAppSyncPolicySelfHeal || undefined,
            },
          }
        : newAppSyncPolicy;
      
      // Валидация sync policy
      const syncWindows = realSyncWindows.length > 0 ? realSyncWindows : (config.syncWindows || []);
      const syncPolicyValidation = validateSyncPolicy(
        syncPolicyForApp,
        syncWindows,
        newAppName.trim(),
        newAppProject || 'default'
      );
      
      if (!syncPolicyValidation.valid) {
        // Показываем ошибки валидации
        syncPolicyValidation.errors.forEach(error => {
          toast({
            title: "Sync Policy Validation Error",
            description: error,
            variant: "destructive",
          });
        });
        return;
      }
      
      // Показываем предупреждения если есть
      if (syncPolicyValidation.warnings.length > 0) {
        syncPolicyValidation.warnings.forEach(warning => {
          toast({
            title: "Sync Policy Warning",
            description: warning,
            variant: "default",
          });
        });
      }
      
      const updatedApp: ArgoCDApplication = {
        ...editingApplication,
        name: newAppName,
        namespace: newAppNamespace || undefined,
        project: newAppProject || 'default',
        repository: newAppRepository,
        path: isHelmRepository ? (newAppHelmChart || '.') : (newAppPath || '.'),
        targetRevision: isHelmRepository ? (newAppHelmVersion || 'latest') : (newAppTargetRevision || 'main'),
        destination: {
          server: newAppDestinationServer || 'https://kubernetes.default.svc',
          namespace: newAppDestinationNamespace || 'default',
        },
        helm: isHelmRepository && newAppHelmChart ? {
          chart: newAppHelmChart,
          version: newAppHelmVersion || 'latest',
          releaseName: newAppHelmReleaseName || undefined,
          values: newAppHelmValues ? (newAppHelmValues.trim() || undefined) : undefined,
          valueFiles: newAppHelmValueFiles.length > 0 ? newAppHelmValueFiles : undefined,
          skipCrds: newAppHelmSkipCrds || undefined,
        } : undefined,
        syncPolicy: syncPolicyForApp,
        hooks: appHooks,
      };
    
    // Update in config
    const currentApps = config.applications || [];
    const updatedApps = currentApps.map(app => 
      app.name === editingApplication.name ? {
        name: updatedApp.name,
        namespace: updatedApp.namespace,
        project: updatedApp.project,
        repository: updatedApp.repository,
        path: updatedApp.path,
        targetRevision: updatedApp.targetRevision,
        destination: updatedApp.destination,
        helm: updatedApp.helm,
        syncPolicy: syncPolicyForApp,
        hooks: updatedApp.hooks?.map(h => ({
          name: h.name,
          kind: h.kind,
          phase: h.phase,
          deletePolicy: h.deletePolicy,
        })),
      } : app
    );
    updateConfig({ applications: updatedApps });
    
    // Update in emulation engine
    if (argoCDEngine) {
      argoCDEngine.updateApplication(editingApplication.name, updatedApp);
    }
    
    setShowEditApplication(false);
    setEditingApplication(null);
    
    toast({
      title: "Application updated",
      description: `Application "${updatedApp.name}" has been updated successfully.`,
    });
  };

  const handleDeleteApplication = (appName: string) => {
    // Remove from config
    const currentApps = config.applications || [];
    updateConfig({
      applications: currentApps.filter(app => app.name !== appName),
    });
    
    // Remove from emulation engine
    if (argoCDEngine) {
      argoCDEngine.removeApplication(appName);
    }
    
    toast({
      title: "Application deleted",
      description: `Application "${appName}" has been deleted.`,
    });
  };

  const handleSyncApplication = (appName: string) => {
    if (!argoCDEngine) {
      toast({
        title: "Error",
        description: "Argo CD engine not available",
        variant: "destructive",
      });
      return;
    }
    
    const success = argoCDEngine.startSync(appName);
    if (success) {
      toast({
        title: "Sync started",
        description: `Synchronization for "${appName}" has been started.`,
      });
    } else {
      toast({
        title: "Sync failed",
        description: `Failed to start synchronization for "${appName}".`,
        variant: "destructive",
      });
    }
  };

  const handleRefreshApplication = (appName: string) => {
    if (!argoCDEngine) {
      toast({
        title: "Error",
        description: "Argo CD engine not available",
        variant: "destructive",
      });
      return;
    }
    
    // Force refresh by triggering a status check
    // The emulation engine will update the status in the next cycle
    const applications = argoCDEngine.getApplications();
    const app = applications.find(a => a.name === appName);
    
    if (app) {
      // Trigger a refresh by updating the application
      argoCDEngine.updateApplication(appName, {
        ...app,
        // Force status refresh
      });
      
      toast({
        title: "Refresh initiated",
        description: `Refreshing status for "${appName}".`,
      });
    } else {
      toast({
        title: "Application not found",
        description: `Application "${appName}" not found.`,
        variant: "destructive",
      });
    }
  };

  const handleRollbackApplication = (appName: string) => {
    if (!argoCDEngine) {
      toast({
        title: "Error",
        description: "Argo CD engine not available",
        variant: "destructive",
      });
      return;
    }
    
    const applications = argoCDEngine.getApplications();
    const app = applications.find(a => a.name === appName);
    
    if (!app) {
      toast({
        title: "Application not found",
        description: `Application "${appName}" not found.`,
        variant: "destructive",
      });
      return;
    }
    
    if (!app.history || app.history.length < 2) {
      toast({
        title: "No rollback available",
        description: `No previous revision available for "${appName}".`,
        variant: "destructive",
      });
      return;
    }
    
    // Get the previous revision (second item in history, first is current)
    const previousRevision = app.history[1];
    
    // Update application to previous revision
    const updatedApp: ArgoCDApplication = {
      ...app,
      targetRevision: previousRevision.revision,
      revision: previousRevision.revision,
      status: 'progressing',
      health: 'progressing',
    };
    
    argoCDEngine.updateApplication(appName, updatedApp);
    
    // Start sync to apply rollback
    argoCDEngine.startSync(appName);
    
    toast({
      title: "Rollback initiated",
      description: `Rolling back "${appName}" to revision ${previousRevision.revision.substring(0, 7)}.`,
    });
  };

  // Repository CRUD operations
  const handleAddRepository = () => {
    let hasError = false;
    
    if (!newRepoName.trim()) {
      setRepoNameError('Repository name is required');
      hasError = true;
    } else {
      // Check if repository already exists
      const existingRepos = realRepositories.length > 0 ? realRepositories : (config.repositories || []);
      if (existingRepos.some(repo => repo.name === newRepoName.trim())) {
        setRepoNameError('Repository with this name already exists');
        hasError = true;
      } else {
        setRepoNameError('');
      }
    }
    
    if (!newRepoUrl.trim()) {
      setRepoUrlError('Repository URL is required');
      hasError = true;
    } else {
      // Validate URL format
      const urlPatterns = [
        /^https?:\/\/.+/, // HTTP/HTTPS
        /^git@.+:.+/, // SSH git
        /^oci:\/\/.+/, // OCI registry
        /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*$/, // Simple name (for existing repos)
      ];
      
      const isValidUrl = urlPatterns.some(pattern => pattern.test(newRepoUrl.trim()));
      
      if (!isValidUrl) {
        setRepoUrlError('Repository URL must be a valid URL (http/https/git@host:path/oci://) or repository name');
        hasError = true;
      } else {
        setRepoUrlError('');
      }
    }
    
    if (hasError) return;
    
    const newRepo: ArgoCDRepository = {
      name: newRepoName,
      url: newRepoUrl,
      type: newRepoType,
      username: newRepoUsername || undefined,
      password: newRepoPassword || undefined,
      insecure: newRepoInsecure,
      project: newRepoProject || undefined,
      connectionStatus: 'unknown',
    };
    
    // Add to config
    const currentRepos = config.repositories || [];
    updateConfig({
      repositories: [...currentRepos, {
        name: newRepo.name,
        url: newRepo.url,
        type: newRepo.type,
        username: newRepo.username,
        password: newRepo.password,
        insecure: newRepo.insecure,
        project: newRepo.project,
      }],
    });
    
    // Add to emulation engine
    if (argoCDEngine) {
      argoCDEngine.addRepository(newRepo);
    }
    
    // Reset form
    setNewRepoName('');
    setNewRepoUrl('');
    setNewRepoType('git');
    setNewRepoUsername('');
    setNewRepoPassword('');
    setNewRepoInsecure(false);
    setNewRepoProject('');
    setShowAddRepository(false);
    
    toast({
      title: "Repository added",
      description: `Repository "${newRepo.name}" has been added successfully.`,
    });
  };

  const handleEditRepository = (repo: ArgoCDRepository) => {
    setEditingRepository(repo);
    setNewRepoName(repo.name);
    setNewRepoUrl(repo.url);
    setNewRepoType(repo.type || 'git');
    setNewRepoUsername(repo.username || '');
    setNewRepoPassword(repo.password || '');
    setNewRepoInsecure(repo.insecure || false);
    setNewRepoProject(repo.project || '');
    setShowEditRepository(true);
  };

  const handleSaveRepository = () => {
    if (!editingRepository) return;
    
    let hasError = false;
    
    if (!newRepoName.trim()) {
      setRepoNameError('Repository name is required');
      hasError = true;
    } else {
      // Check if repository name already exists (excluding current)
      const existingRepos = realRepositories.length > 0 ? realRepositories : (config.repositories || []);
      if (existingRepos.some(repo => repo.name === newRepoName.trim() && repo.name !== editingRepository.name)) {
        setRepoNameError('Repository with this name already exists');
        hasError = true;
      } else {
        setRepoNameError('');
      }
    }
    
    if (!newRepoUrl.trim()) {
      setRepoUrlError('Repository URL is required');
      hasError = true;
    } else {
      // Validate URL format
      const urlPatterns = [
        /^https?:\/\/.+/, // HTTP/HTTPS
        /^git@.+:.+/, // SSH git
        /^oci:\/\/.+/, // OCI registry
        /^[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]*$/, // Simple name (for existing repos)
      ];
      
      const isValidUrl = urlPatterns.some(pattern => pattern.test(newRepoUrl.trim()));
      
      if (!isValidUrl) {
        setRepoUrlError('Repository URL must be a valid URL (http/https/git@host:path/oci://) or repository name');
        hasError = true;
      } else {
        setRepoUrlError('');
      }
    }
    
    if (hasError) return;
    
    const updatedRepo: ArgoCDRepository = {
      ...editingRepository,
      name: newRepoName,
      url: newRepoUrl,
      type: newRepoType,
      username: newRepoUsername || undefined,
      password: newRepoPassword || undefined,
      insecure: newRepoInsecure,
      project: newRepoProject || undefined,
    };
    
    // Update in config
    const currentRepos = config.repositories || [];
    const updatedRepos = currentRepos.map(repo => 
      repo.name === editingRepository.name ? {
        name: updatedRepo.name,
        url: updatedRepo.url,
        type: updatedRepo.type,
        username: updatedRepo.username,
        password: updatedRepo.password,
        insecure: updatedRepo.insecure,
        project: updatedRepo.project,
      } : repo
    );
    updateConfig({ repositories: updatedRepos });
    
    // Note: Repository update in engine would need to be implemented
    setShowEditRepository(false);
    setEditingRepository(null);
    
    toast({
      title: "Repository updated",
      description: `Repository "${updatedRepo.name}" has been updated successfully.`,
    });
  };

  const handleDeleteRepository = (repoName: string) => {
    // Remove from config
    const currentRepos = config.repositories || [];
    updateConfig({
      repositories: currentRepos.filter(repo => repo.name !== repoName),
    });
    
    // Remove from emulation engine
    if (argoCDEngine) {
      argoCDEngine.removeRepository(repoName);
    }
    
    toast({
      title: "Repository deleted",
      description: `Repository "${repoName}" has been deleted.`,
    });
  };

  // Project CRUD operations
  const handleAddProject = () => {
    let hasError = false;
    
    if (!newProjectName.trim()) {
      setProjectNameError('Project name is required');
      hasError = true;
    } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(newProjectName)) {
      setProjectNameError('Project name must be a valid Kubernetes name (lowercase alphanumeric and hyphens)');
      hasError = true;
    } else {
      // Check if project already exists
      const existingProjects = realProjects.length > 0 ? realProjects : (config.projects || []);
      if (existingProjects.some(project => project.name === newProjectName.trim())) {
        setProjectNameError('Project with this name already exists');
        hasError = true;
      } else {
        setProjectNameError('');
      }
    }
    
    if (hasError) return;
    
    const newProject: ArgoCDProject = {
      name: newProjectName,
      description: newProjectDescription || undefined,
      sourceRepos: newProjectSourceRepos.length > 0 ? newProjectSourceRepos : ['*'],
      destinations: newProjectDestinations.length > 0 ? newProjectDestinations : [{ server: '*', namespace: '*' }],
    };
    
    // Add to config
    const currentProjects = config.projects || [];
    updateConfig({
      projects: [...currentProjects, {
        name: newProject.name,
        description: newProject.description,
        sourceRepos: newProject.sourceRepos,
        destinations: newProject.destinations,
      }],
    });
    
    // Note: Project add in engine would need to be implemented
    setNewProjectName('');
    setNewProjectDescription('');
    setNewProjectSourceRepos([]);
    setNewProjectDestinations([]);
    setShowAddProject(false);
    
    toast({
      title: "Project added",
      description: `Project "${newProject.name}" has been added successfully.`,
    });
  };

  const handleDeleteProject = (projectName: string) => {
    // Remove from config
    const currentProjects = config.projects || [];
    updateConfig({
      projects: currentProjects.filter(project => project.name !== projectName),
    });
    
    toast({
      title: "Project deleted",
      description: `Project "${projectName}" has been deleted.`,
    });
  };

  // RBAC CRUD operations
  const handleAddRole = () => {
    let hasError = false;
    
    if (!newRoleName.trim()) {
      setRoleNameError('Role name is required');
      hasError = true;
    } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(newRoleName)) {
      setRoleNameError('Role name must be a valid Kubernetes name (lowercase alphanumeric and hyphens)');
      hasError = true;
    } else {
      // Check if role already exists
      const existingRoles = realRoles.length > 0 ? realRoles : (config.roles || []);
      if (existingRoles.some(role => role.name === newRoleName.trim())) {
        setRoleNameError('Role with this name already exists');
        hasError = true;
      } else {
        setRoleNameError('');
      }
    }
    
    if (hasError) return;
    
    const newRole: ArgoCDRole = {
      name: newRoleName,
      description: newRoleDescription || undefined,
      policies: newRolePolicies,
      groups: newRoleGroups,
    };
    
    // Add to config
    const currentRoles = config.roles || [];
    updateConfig({
      roles: [...currentRoles, {
        name: newRole.name,
        description: newRole.description,
        policies: newRole.policies.map(p => `p, role:${newRole.name}, ${p.resource}, ${p.action}, ${p.effect}`),
        groups: newRole.groups,
      }],
    });
    
    // Add to emulation engine
    if (argoCDEngine) {
      argoCDEngine.addRole(newRole);
    }
    
    // Reset form
    setNewRoleName('');
    setNewRoleDescription('');
    setNewRolePolicies([]);
    setNewRoleGroups([]);
    setShowAddRole(false);
    
    toast({
      title: "Role added",
      description: `Role "${newRole.name}" has been added successfully.`,
    });
  };

  const handleEditRole = (role: ArgoCDRole) => {
    setEditingRole(role);
    setNewRoleName(role.name);
    setNewRoleDescription(role.description || '');
    setNewRolePolicies(role.policies);
    setNewRoleGroups(role.groups || []);
    setShowEditRole(true);
  };

  const handleSaveRole = () => {
    if (!editingRole) return;
    
    let hasError = false;
    
    if (!newRoleName.trim()) {
      setRoleNameError('Role name is required');
      hasError = true;
    } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(newRoleName)) {
      setRoleNameError('Role name must be a valid Kubernetes name (lowercase alphanumeric and hyphens)');
      hasError = true;
    } else {
      // Check if role name already exists (excluding current)
      const existingRoles = realRoles.length > 0 ? realRoles : (config.roles || []);
      if (existingRoles.some(role => role.name === newRoleName.trim() && role.name !== editingRole.name)) {
        setRoleNameError('Role with this name already exists');
        hasError = true;
      } else {
        setRoleNameError('');
      }
    }
    
    if (hasError) return;
    
    const updatedRole: ArgoCDRole = {
      ...editingRole,
      name: newRoleName,
      description: newRoleDescription || undefined,
      policies: newRolePolicies,
      groups: newRoleGroups,
    };
    
    // Update in config
    const currentRoles = config.roles || [];
    const updatedRoles = currentRoles.map(role => 
      role.name === editingRole.name ? {
        name: updatedRole.name,
        description: updatedRole.description,
        policies: updatedRole.policies.map(p => `p, role:${updatedRole.name}, ${p.resource}, ${p.action}, ${p.effect}`),
        groups: updatedRole.groups,
      } : role
    );
    updateConfig({ roles: updatedRoles });
    
    // Update in emulation engine
    if (argoCDEngine) {
      argoCDEngine.updateRole(editingRole.name, updatedRole);
    }
    
    setShowEditRole(false);
    setEditingRole(null);
    
    toast({
      title: "Role updated",
      description: `Role "${updatedRole.name}" has been updated successfully.`,
    });
  };

  const handleDeleteRole = (roleName: string) => {
    // Remove from config
    const currentRoles = config.roles || [];
    updateConfig({
      roles: currentRoles.filter(role => role.name !== roleName),
    });
    
    // Remove from emulation engine
    if (argoCDEngine) {
      argoCDEngine.removeRole(roleName);
    }
    
    toast({
      title: "Role deleted",
      description: `Role "${roleName}" has been deleted.`,
    });
  };

  const handleAddPolicy = () => {
    const newPolicy: ArgoCDPolicy = {
      action: '*',
      resource: '*',
      effect: 'allow',
    };
    setNewRolePolicies([...newRolePolicies, newPolicy]);
  };

  const handleUpdatePolicy = (index: number, updates: Partial<ArgoCDPolicy>) => {
    const updated = [...newRolePolicies];
    updated[index] = { ...updated[index], ...updates };
    setNewRolePolicies(updated);
  };

  const handleRemovePolicy = (index: number) => {
    setNewRolePolicies(newRolePolicies.filter((_, i) => i !== index));
  };

  const handleAddGroup = () => {
    const group = prompt('Enter group name:');
    if (group && group.trim() && !newRoleGroups.includes(group.trim())) {
      setNewRoleGroups([...newRoleGroups, group.trim()]);
    }
  };

  const handleRemoveGroup = (group: string) => {
    setNewRoleGroups(newRoleGroups.filter(g => g !== group));
  };

  // Notification Channels CRUD operations
  const handleAddNotificationChannel = () => {
    let hasError = false;
    
    if (!newChannelName.trim()) {
      setChannelNameError('Channel name is required');
      hasError = true;
    } else {
      // Check if channel already exists
      const existingChannels = realNotificationChannels.length > 0 ? realNotificationChannels : [];
      if (existingChannels.some(ch => ch.name === newChannelName.trim())) {
        setChannelNameError('Channel with this name already exists');
        hasError = true;
      } else {
        setChannelNameError('');
      }
    }
    
    if (hasError) return;
    
    const config: Record<string, unknown> = {};
    if (newChannelType === 'slack' && newChannelChannel) {
      config.channel = newChannelChannel;
      config.url = newChannelUrl || undefined;
    } else if (newChannelType === 'email') {
      config.recipients = newChannelRecipients;
    } else if (newChannelType === 'pagerduty') {
      config.serviceKey = newChannelServiceKey;
    } else if (newChannelType === 'webhook' || newChannelType === 'opsgenie' || newChannelType === 'msteams') {
      config.url = newChannelUrl;
    }
    
    const newChannel: ArgoCDNotificationChannel = {
      name: newChannelName,
      type: newChannelType,
      enabled: newChannelEnabled,
      config,
      triggers: newChannelTriggers.length > 0 ? newChannelTriggers : [
        { event: 'sync-success' },
        { event: 'sync-failed' },
        { event: 'health-degraded' },
      ],
    };
    
    // Add to emulation engine
    if (argoCDEngine) {
      argoCDEngine.addNotificationChannel(newChannel);
    }
    
    // Update config
    const currentChannelsConfig = config.notificationChannelsConfig || [];
    updateConfig({
      notificationChannelsConfig: [...currentChannelsConfig, {
        name: newChannel.name,
        type: newChannel.type,
        enabled: newChannel.enabled,
        config: newChannel.config,
        triggers: newChannel.triggers,
      }],
    });
    
    // Reset form
    setNewChannelName('');
    setNewChannelType('slack');
    setNewChannelEnabled(true);
    setNewChannelUrl('');
    setNewChannelChannel('');
    setNewChannelRecipients([]);
    setNewChannelServiceKey('');
    setNewChannelTriggers([]);
    setShowAddNotificationChannel(false);
    
    toast({
      title: "Notification channel added",
      description: `Channel "${newChannel.name}" has been added successfully.`,
    });
  };

  const handleEditNotificationChannel = (channel: ArgoCDNotificationChannel) => {
    setEditingNotificationChannel(channel);
    setNewChannelName(channel.name);
    setNewChannelType(channel.type);
    setNewChannelEnabled(channel.enabled);
    setNewChannelUrl(channel.config.url as string || '');
    setNewChannelChannel(channel.config.channel as string || '');
    setNewChannelRecipients((channel.config.recipients as string[]) || []);
    setNewChannelServiceKey(channel.config.serviceKey as string || '');
    setNewChannelTriggers(channel.triggers);
    setNewRecipientEmail(''); // Reset recipient email input
    setShowEditNotificationChannel(true);
  };

  const handleSaveNotificationChannel = () => {
    if (!editingNotificationChannel) return;
    
    let hasError = false;
    
    if (!newChannelName.trim()) {
      setChannelNameError('Channel name is required');
      hasError = true;
    } else {
      // Check if channel name already exists (excluding current)
      const existingChannels = realNotificationChannels.length > 0 ? realNotificationChannels : [];
      if (existingChannels.some(ch => ch.name === newChannelName.trim() && ch.name !== editingNotificationChannel.name)) {
        setChannelNameError('Channel with this name already exists');
        hasError = true;
      } else {
        setChannelNameError('');
      }
    }
    
    if (hasError) return;
    
    const channelConfig: Record<string, unknown> = {};
    if (newChannelType === 'slack' && newChannelChannel) {
      channelConfig.channel = newChannelChannel;
      channelConfig.url = newChannelUrl || undefined;
    } else if (newChannelType === 'email') {
      channelConfig.recipients = newChannelRecipients;
    } else if (newChannelType === 'pagerduty') {
      channelConfig.serviceKey = newChannelServiceKey;
    } else if (newChannelType === 'webhook' || newChannelType === 'opsgenie' || newChannelType === 'msteams') {
      channelConfig.url = newChannelUrl;
    }
    
    const updatedChannel: ArgoCDNotificationChannel = {
      ...editingNotificationChannel,
      name: newChannelName,
      type: newChannelType,
      enabled: newChannelEnabled,
      config: channelConfig,
      triggers: newChannelTriggers,
    };
    
    // Update in emulation engine
    if (argoCDEngine) {
      argoCDEngine.updateNotificationChannel(editingNotificationChannel.name, updatedChannel);
    }
    
    // Update config
    const currentChannelsConfig = config.notificationChannelsConfig || [];
    const updatedChannelsConfig = currentChannelsConfig.map(ch => 
      ch.name === editingNotificationChannel.name ? {
        name: updatedChannel.name,
        type: updatedChannel.type,
        enabled: updatedChannel.enabled,
        config: updatedChannel.config,
        triggers: updatedChannel.triggers,
      } : ch
    );
    updateConfig({ notificationChannelsConfig: updatedChannelsConfig });
    
    setShowEditNotificationChannel(false);
    setEditingNotificationChannel(null);
    
    toast({
      title: "Notification channel updated",
      description: `Channel "${updatedChannel.name}" has been updated successfully.`,
    });
  };

  const handleDeleteNotificationChannel = (channelName: string) => {
    // Remove from emulation engine
    if (argoCDEngine) {
      argoCDEngine.removeNotificationChannel(channelName);
    }
    
    // Remove from config
    const currentChannelsConfig = config.notificationChannelsConfig || [];
    updateConfig({
      notificationChannelsConfig: currentChannelsConfig.filter(ch => ch.name !== channelName),
    });
    
    toast({
      title: "Notification channel deleted",
      description: `Channel "${channelName}" has been deleted.`,
    });
  };

  const handleAddTrigger = () => {
    const newTrigger = { event: 'sync-success' as const };
    setNewChannelTriggers([...newChannelTriggers, newTrigger]);
  };

  const handleUpdateTrigger = (index: number, updates: Partial<{ event: string; condition?: string }>) => {
    const updated = [...newChannelTriggers];
    updated[index] = { ...updated[index], ...updates };
    setNewChannelTriggers(updated);
  };

  const handleRemoveTrigger = (index: number) => {
    setNewChannelTriggers(newChannelTriggers.filter((_, i) => i !== index));
  };

  // Sync Windows handlers
  const handleAddSyncWindow = () => {
    let hasError = false;
    
    if (!newSyncWindowName.trim()) {
      setSyncWindowNameError('Sync window name is required');
      hasError = true;
    } else {
      // Check if sync window already exists
      const existingWindows = realSyncWindows.length > 0 ? realSyncWindows : [];
      if (existingWindows.some(w => w.name === newSyncWindowName.trim())) {
        setSyncWindowNameError('Sync window with this name already exists');
        hasError = true;
      } else {
        setSyncWindowNameError('');
      }
    }
    
    // Validate schedule format
    const schedulePattern = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;
    const cronPattern = /^(\S+\s+){4}\S+$/;
    if (!schedulePattern.test(newSyncWindowSchedule) && !cronPattern.test(newSyncWindowSchedule)) {
      setSyncWindowScheduleError('Invalid schedule format. Use "HH:MM-HH:MM" or cron expression');
      hasError = true;
    } else {
      setSyncWindowScheduleError('');
    }
    
    if (hasError) return;
    
    const syncWindow: ArgoCDSyncWindow = {
      name: newSyncWindowName.trim(),
      description: newSyncWindowDescription.trim() || undefined,
      schedule: newSyncWindowSchedule.trim(),
      duration: newSyncWindowDuration,
      kind: newSyncWindowKind,
      applications: newSyncWindowApplications.length > 0 ? newSyncWindowApplications : undefined,
      projects: newSyncWindowProjects.length > 0 ? newSyncWindowProjects : undefined,
      manualSync: newSyncWindowManualSync,
      enabled: newSyncWindowEnabled,
    };
    
    // Add to emulation engine
    if (argoCDEngine) {
      argoCDEngine.addSyncWindow(syncWindow);
    }
    
    // Add to config
    const currentSyncWindows = config.syncWindows || [];
    updateConfig({
      syncWindows: [...currentSyncWindows, {
        name: syncWindow.name,
        description: syncWindow.description,
        schedule: syncWindow.schedule,
        duration: syncWindow.duration,
        kind: syncWindow.kind,
        applications: syncWindow.applications,
        projects: syncWindow.projects,
        manualSync: syncWindow.manualSync,
        enabled: syncWindow.enabled,
      }],
    });
    
    toast({
      title: "Sync window created",
      description: `Sync window "${syncWindow.name}" has been created.`,
    });
    
    // Reset form
    setShowAddSyncWindow(false);
    setNewSyncWindowName('');
    setNewSyncWindowDescription('');
    setNewSyncWindowSchedule('09:00-17:00');
    setNewSyncWindowDuration(undefined);
    setNewSyncWindowKind('deny');
    setNewSyncWindowApplications([]);
    setNewSyncWindowProjects([]);
    setNewSyncWindowManualSync(false);
    setNewSyncWindowEnabled(true);
    setSyncWindowNameError('');
    setSyncWindowScheduleError('');
  };

  const handleUpdateSyncWindow = () => {
    if (!editingSyncWindow) return;
    
    let hasError = false;
    
    // Validate schedule format
    const schedulePattern = /^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/;
    const cronPattern = /^(\S+\s+){4}\S+$/;
    if (!schedulePattern.test(newSyncWindowSchedule) && !cronPattern.test(newSyncWindowSchedule)) {
      setSyncWindowScheduleError('Invalid schedule format. Use "HH:MM-HH:MM" or cron expression');
      hasError = true;
    } else {
      setSyncWindowScheduleError('');
    }
    
    if (hasError) return;
    
    const updates: Partial<ArgoCDSyncWindow> = {
      description: newSyncWindowDescription.trim() || undefined,
      schedule: newSyncWindowSchedule.trim(),
      duration: newSyncWindowDuration,
      kind: newSyncWindowKind,
      applications: newSyncWindowApplications.length > 0 ? newSyncWindowApplications : undefined,
      projects: newSyncWindowProjects.length > 0 ? newSyncWindowProjects : undefined,
      manualSync: newSyncWindowManualSync,
      enabled: newSyncWindowEnabled,
    };
    
    // Update in emulation engine
    if (argoCDEngine) {
      argoCDEngine.updateSyncWindow(editingSyncWindow.name, updates);
    }
    
    // Update in config
    const currentSyncWindows = config.syncWindows || [];
    updateConfig({
      syncWindows: currentSyncWindows.map(w => 
        w.name === editingSyncWindow.name 
          ? { ...w, ...updates }
          : w
      ),
    });
    
    toast({
      title: "Sync window updated",
      description: `Sync window "${editingSyncWindow.name}" has been updated.`,
    });
    
    // Reset form
    setShowEditSyncWindow(false);
    setEditingSyncWindow(null);
    setNewSyncWindowName('');
    setNewSyncWindowDescription('');
    setNewSyncWindowSchedule('09:00-17:00');
    setNewSyncWindowDuration(undefined);
    setNewSyncWindowKind('deny');
    setNewSyncWindowApplications([]);
    setNewSyncWindowProjects([]);
    setNewSyncWindowManualSync(false);
    setNewSyncWindowEnabled(true);
    setSyncWindowScheduleError('');
  };

  const handleDeleteSyncWindow = (windowName: string) => {
    // Remove from emulation engine
    if (argoCDEngine) {
      argoCDEngine.removeSyncWindow(windowName);
    }
    
    // Remove from config
    const currentSyncWindows = config.syncWindows || [];
    updateConfig({
      syncWindows: currentSyncWindows.filter(w => w.name !== windowName),
    });
    
    toast({
      title: "Sync window deleted",
      description: `Sync window "${windowName}" has been deleted.`,
    });
  };

  const handleEditSyncWindow = (syncWindow: ArgoCDSyncWindow) => {
    setEditingSyncWindow(syncWindow);
    setNewSyncWindowName(syncWindow.name);
    setNewSyncWindowDescription(syncWindow.description || '');
    setNewSyncWindowSchedule(syncWindow.schedule);
    setNewSyncWindowDuration(syncWindow.duration);
    setNewSyncWindowKind(syncWindow.kind);
    setNewSyncWindowApplications(syncWindow.applications || []);
    setNewSyncWindowProjects(syncWindow.projects || []);
    setNewSyncWindowManualSync(syncWindow.manualSync ?? false);
    setNewSyncWindowEnabled(syncWindow.enabled);
    setShowEditSyncWindow(true);
    setSyncWindowNameError('');
    setSyncWindowScheduleError('');
  };

  const [newRecipientEmail, setNewRecipientEmail] = useState('');
  
  const handleAddRecipient = () => {
    if (newRecipientEmail.trim() && !newChannelRecipients.includes(newRecipientEmail.trim())) {
      setNewChannelRecipients([...newChannelRecipients, newRecipientEmail.trim()]);
      setNewRecipientEmail('');
    }
  };

  const handleRemoveRecipient = (recipient: string) => {
    setNewChannelRecipients(newChannelRecipients.filter(r => r !== recipient));
  };

  // Helper functions for ApplicationSet generators
  const toggleGeneratorExpanded = (idx: number) => {
    const newExpanded = new Set(expandedGenerators);
    if (newExpanded.has(idx)) {
      newExpanded.delete(idx);
    } else {
      newExpanded.add(idx);
    }
    setExpandedGenerators(newExpanded);
  };

  const addGenerator = (type: ApplicationSetGeneratorType) => {
    let newGenerator: ArgoCDApplicationSetGenerator;
    if (type === 'list') {
      newGenerator = { type: 'list', elements: [] };
    } else if (type === 'git') {
      newGenerator = { type: 'git', repoURL: '', directories: [], files: [] };
    } else {
      newGenerator = { type: 'cluster', selector: {}, values: {} };
    }
    setNewAppSetGenerators([...newAppSetGenerators, newGenerator]);
    setShowAddGeneratorType(null);
    // Auto-expand the new generator
    setExpandedGenerators(new Set([...expandedGenerators, newAppSetGenerators.length]));
  };

  const updateGenerator = (idx: number, updates: Partial<ArgoCDApplicationSetGenerator>) => {
    const updated = [...newAppSetGenerators];
    updated[idx] = { ...updated[idx], ...updates } as ArgoCDApplicationSetGenerator;
    setNewAppSetGenerators(updated);
  };

  const removeGenerator = (idx: number) => {
    setNewAppSetGenerators(newAppSetGenerators.filter((_, i) => i !== idx));
    const newExpanded = new Set(expandedGenerators);
    newExpanded.delete(idx);
    // Adjust indices for expanded generators after removal
    const adjustedExpanded = new Set<number>();
    newExpanded.forEach(i => {
      if (i < idx) {
        adjustedExpanded.add(i);
      } else if (i > idx) {
        adjustedExpanded.add(i - 1);
      }
    });
    setExpandedGenerators(adjustedExpanded);
  };

  const addListElement = (genIdx: number) => {
    const gen = newAppSetGenerators[genIdx];
    if (gen.type === 'list') {
      const updated = [...newAppSetGenerators];
      updated[genIdx] = {
        ...gen,
        elements: [...(gen.elements || []), { name: '', value: '' }]
      };
      setNewAppSetGenerators(updated);
    }
  };

  const updateListElement = (genIdx: number, elemIdx: number, key: string, value: string) => {
    const gen = newAppSetGenerators[genIdx];
    if (gen.type === 'list') {
      const updated = [...newAppSetGenerators];
      const elements = [...(gen.elements || [])];
      elements[elemIdx] = { ...elements[elemIdx], [key]: value };
      updated[genIdx] = { ...gen, elements };
      setNewAppSetGenerators(updated);
    }
  };

  const removeListElement = (genIdx: number, elemIdx: number) => {
    const gen = newAppSetGenerators[genIdx];
    if (gen.type === 'list') {
      const updated = [...newAppSetGenerators];
      updated[genIdx] = {
        ...gen,
        elements: (gen.elements || []).filter((_, i) => i !== elemIdx)
      };
      setNewAppSetGenerators(updated);
    }
  };

  const addGitDirectory = (genIdx: number) => {
    const gen = newAppSetGenerators[genIdx];
    if (gen.type === 'git') {
      const updated = [...newAppSetGenerators];
      updated[genIdx] = {
        ...gen,
        directories: [...(gen.directories || []), { path: '', exclude: false }]
      };
      setNewAppSetGenerators(updated);
    }
  };

  const updateGitDirectory = (genIdx: number, dirIdx: number, updates: { path?: string; exclude?: boolean }) => {
    const gen = newAppSetGenerators[genIdx];
    if (gen.type === 'git') {
      const updated = [...newAppSetGenerators];
      const directories = [...(gen.directories || [])];
      directories[dirIdx] = { ...directories[dirIdx], ...updates };
      updated[genIdx] = { ...gen, directories };
      setNewAppSetGenerators(updated);
    }
  };

  const removeGitDirectory = (genIdx: number, dirIdx: number) => {
    const gen = newAppSetGenerators[genIdx];
    if (gen.type === 'git') {
      const updated = [...newAppSetGenerators];
      updated[genIdx] = {
        ...gen,
        directories: (gen.directories || []).filter((_, i) => i !== dirIdx)
      };
      setNewAppSetGenerators(updated);
    }
  };

  const addGitFile = (genIdx: number) => {
    const gen = newAppSetGenerators[genIdx];
    if (gen.type === 'git') {
      const updated = [...newAppSetGenerators];
      updated[genIdx] = {
        ...gen,
        files: [...(gen.files || []), { path: '' }]
      };
      setNewAppSetGenerators(updated);
    }
  };

  const updateGitFile = (genIdx: number, fileIdx: number, path: string) => {
    const gen = newAppSetGenerators[genIdx];
    if (gen.type === 'git') {
      const updated = [...newAppSetGenerators];
      const files = [...(gen.files || [])];
      files[fileIdx] = { path };
      updated[genIdx] = { ...gen, files };
      setNewAppSetGenerators(updated);
    }
  };

  const removeGitFile = (genIdx: number, fileIdx: number) => {
    const gen = newAppSetGenerators[genIdx];
    if (gen.type === 'git') {
      const updated = [...newAppSetGenerators];
      updated[genIdx] = {
        ...gen,
        files: (gen.files || []).filter((_, i) => i !== fileIdx)
      };
      setNewAppSetGenerators(updated);
    }
  };

  // ApplicationSet CRUD operations
  const handleAddApplicationSet = () => {
    // Validation
    let hasError = false;
    
    if (!newAppSetName.trim()) {
      setAppSetNameError('ApplicationSet name is required');
      hasError = true;
    } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(newAppSetName)) {
      setAppSetNameError('ApplicationSet name must be a valid Kubernetes name (lowercase alphanumeric and hyphens)');
      hasError = true;
    } else {
      // Check if ApplicationSet already exists
      const existingAppSets = realApplicationSets.length > 0 ? realApplicationSets : [];
      if (existingAppSets.some(appSet => appSet.name === newAppSetName.trim())) {
        setAppSetNameError('ApplicationSet with this name already exists');
        hasError = true;
      } else {
        setAppSetNameError('');
      }
    }
    
    if (hasError) return;
    
    if (!argoCDEngine) return;
    
    // Create new ApplicationSet
    const newAppSet: ArgoCDApplicationSet = {
      name: newAppSetName.trim(),
      namespace: newAppSetNamespace.trim() || undefined,
      generators: newAppSetGenerators.length > 0 ? newAppSetGenerators : [],
      template: newAppSetTemplate,
      syncPolicy: newAppSetSyncPolicy,
      preserveResourcesOnDeletion: newAppSetPreserveResources,
      goTemplate: newAppSetGoTemplate,
      enabled: newAppSetEnabled,
    };
    
    argoCDEngine.addApplicationSet(newAppSet);
    
    // Update config
    const currentAppSets = config.applicationSets || [];
    updateConfig({
      applicationSets: [...currentAppSets, {
        name: newAppSet.name,
        namespace: newAppSet.namespace,
        generators: newAppSet.generators.map(g => {
          if (g.type === 'list') {
            return { type: 'list', elements: g.elements };
          } else if (g.type === 'git') {
            return { type: 'git', repoURL: g.repoURL, revision: g.revision, directories: g.directories, files: g.files };
          } else if (g.type === 'cluster') {
            return { type: 'cluster', selector: g.selector, values: g.values };
          }
          return { type: 'list', elements: [] };
        }),
        template: newAppSet.template,
        syncPolicy: newAppSet.syncPolicy,
        preserveResourcesOnDeletion: newAppSet.preserveResourcesOnDeletion,
        goTemplate: newAppSet.goTemplate,
        enabled: newAppSet.enabled,
      }],
    });
    
    // Reset form
    setNewAppSetName('');
    setNewAppSetNamespace('default');
    setNewAppSetEnabled(true);
    setNewAppSetSyncPolicy('manual');
    setNewAppSetPreserveResources(false);
    setNewAppSetGoTemplate(false);
    setNewAppSetGenerators([]);
    setNewAppSetTemplate({});
    setShowAddApplicationSet(false);
    setAppSetNameError('');
    setExpandedGenerators(new Set());
    setShowAddGeneratorType(null);
    
    toast({
      title: 'ApplicationSet created',
      description: `ApplicationSet "${newAppSet.name}" has been created successfully.`,
    });
  };

  const handleEditApplicationSet = (appSet: ArgoCDApplicationSet) => {
    setEditingApplicationSet(appSet);
    setNewAppSetName(appSet.name);
    setNewAppSetNamespace(appSet.namespace || 'default');
    setNewAppSetEnabled(appSet.enabled);
    setNewAppSetSyncPolicy(appSet.syncPolicy || 'manual');
    setNewAppSetPreserveResources(appSet.preserveResourcesOnDeletion || false);
    setNewAppSetGoTemplate(appSet.goTemplate || false);
    setNewAppSetGenerators(appSet.generators || []);
    setNewAppSetTemplate(appSet.template || {});
    setShowEditApplicationSet(true);
    setAppSetNameError('');
  };

  const handleSaveApplicationSet = () => {
    if (!editingApplicationSet || !argoCDEngine) return;
    
    // Validation
    let hasError = false;
    
    if (!newAppSetName.trim()) {
      setAppSetNameError('ApplicationSet name is required');
      hasError = true;
    } else if (!/^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/.test(newAppSetName)) {
      setAppSetNameError('ApplicationSet name must be a valid Kubernetes name (lowercase alphanumeric and hyphens)');
      hasError = true;
    } else if (newAppSetName.trim() !== editingApplicationSet.name) {
      // Check if new name already exists
      const existingAppSets = realApplicationSets.length > 0 ? realApplicationSets : [];
      if (existingAppSets.some(appSet => appSet.name === newAppSetName.trim())) {
        setAppSetNameError('ApplicationSet with this name already exists');
        hasError = true;
      } else {
        setAppSetNameError('');
      }
    } else {
      setAppSetNameError('');
    }
    
    if (hasError) return;
    
    // Update ApplicationSet
    const updates: Partial<ArgoCDApplicationSet> = {
      name: newAppSetName.trim(),
      namespace: newAppSetNamespace.trim() || undefined,
      generators: newAppSetGenerators,
      template: newAppSetTemplate,
      syncPolicy: newAppSetSyncPolicy,
      preserveResourcesOnDeletion: newAppSetPreserveResources,
      goTemplate: newAppSetGoTemplate,
      enabled: newAppSetEnabled,
    };
    
    const success = argoCDEngine.updateApplicationSet(editingApplicationSet.name, updates);
    
    if (success) {
      // Update config
      const currentAppSets = config.applicationSets || [];
      const updatedAppSets = currentAppSets.map(appSet => {
        if (appSet.name === editingApplicationSet.name) {
          return {
            ...appSet,
            name: updates.name || appSet.name,
            namespace: updates.namespace,
            generators: updates.generators?.map(g => {
              if (g.type === 'list') {
                return { type: 'list', elements: g.elements };
              } else if (g.type === 'git') {
                return { type: 'git', repoURL: g.repoURL, revision: g.revision, directories: g.directories, files: g.files };
              } else if (g.type === 'cluster') {
                return { type: 'cluster', selector: g.selector, values: g.values };
              }
              return { type: 'list', elements: [] };
            }) || appSet.generators,
            template: updates.template || appSet.template,
            syncPolicy: updates.syncPolicy || appSet.syncPolicy,
            preserveResourcesOnDeletion: updates.preserveResourcesOnDeletion ?? appSet.preserveResourcesOnDeletion,
            goTemplate: updates.goTemplate ?? appSet.goTemplate,
            enabled: updates.enabled ?? appSet.enabled,
          };
        }
        return appSet;
      });
      
      updateConfig({ applicationSets: updatedAppSets });
      
      // Reset form
      setShowEditApplicationSet(false);
      setEditingApplicationSet(null);
      setNewAppSetName('');
      setNewAppSetNamespace('default');
      setNewAppSetEnabled(true);
      setNewAppSetSyncPolicy('manual');
      setNewAppSetPreserveResources(false);
      setNewAppSetGoTemplate(false);
      setNewAppSetGenerators([]);
      setNewAppSetTemplate({});
      setAppSetNameError('');
      setExpandedGenerators(new Set());
      setShowAddGeneratorType(null);
      
      toast({
        title: 'ApplicationSet updated',
        description: `ApplicationSet "${updates.name || editingApplicationSet.name}" has been updated successfully.`,
      });
    }
  };

  const handleDeleteApplicationSet = (appSetName: string) => {
    if (!argoCDEngine) return;
    
    const success = argoCDEngine.removeApplicationSet(appSetName);
    
    if (success) {
      // Update config
      const currentAppSets = config.applicationSets || [];
      updateConfig({
        applicationSets: currentAppSets.filter(appSet => appSet.name !== appSetName),
      });
      
      toast({
        title: 'ApplicationSet deleted',
        description: `ApplicationSet "${appSetName}" has been deleted successfully.`,
      });
    }
  };

  // Helper functions
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'synced':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'outofsync':
        return <XCircle className="h-4 w-4 text-yellow-500" />;
      case 'progressing':
        return <RefreshCw className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'degraded':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getHealthBadge = (health: string) => {
    switch (health) {
      case 'healthy':
        return <Badge variant="default" className="bg-green-500">Healthy</Badge>;
      case 'degraded':
        return <Badge variant="destructive">Degraded</Badge>;
      case 'progressing':
        return <Badge variant="default" className="bg-blue-500">Progressing</Badge>;
      case 'suspended':
        return <Badge variant="secondary">Suspended</Badge>;
      case 'missing':
        return <Badge variant="destructive">Missing</Badge>;
      default:
        return <Badge variant="secondary">{health}</Badge>;
    }
  };

  const formatTimeAgo = (timestamp?: number) => {
    if (!timestamp) return 'Never';
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Rocket className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Argo CD</h2>
              <p className="text-sm text-muted-foreground mt-1">
                GitOps Continuous Deployment
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-2">
              <div className={`h-2 w-2 rounded-full ${isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
              {isRunning ? 'Running' : 'Stopped'}
            </Badge>
            {componentMetrics && (
              <Badge variant="outline" className="gap-2">
                <Activity className="h-3 w-3" />
                {componentMetrics.throughput?.toFixed(2) || 0} ops/s
              </Badge>
            )}
          </div>
        </div>

        <Separator />

        {/* Stats Overview */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Applications</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalApps}</div>
              <p className="text-xs text-muted-foreground mt-1">Total apps</p>
              {realMetrics && (
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <div className={`h-2 w-2 rounded-full ${stats.healthyApps === stats.totalApps ? 'bg-green-500' : 'bg-yellow-500'}`} />
                  <span>{stats.healthyApps} healthy</span>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Synced</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats.syncedApps}</div>
              <p className="text-xs text-muted-foreground mt-1">In sync</p>
              {realMetrics && realMetrics.syncOperationsRunning > 0 && (
                <div className="mt-2 flex items-center gap-2 text-xs text-blue-500">
                  <RefreshCw className="h-3 w-3 animate-spin" />
                  <span>{realMetrics.syncOperationsRunning} syncing</span>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Out of Sync</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{stats.outOfSyncApps}</div>
              <p className="text-xs text-muted-foreground mt-1">Needs sync</p>
              {stats.degradedApps > 0 && (
                <div className="mt-2 flex items-center gap-2 text-xs text-red-500">
                  <AlertCircle className="h-3 w-3" />
                  <span>{stats.degradedApps} degraded</span>
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Sync Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalApps > 0 ? Math.round((stats.syncedApps / stats.totalApps) * 100) : 0}%</div>
              <p className="text-xs text-muted-foreground mt-1">Synced</p>
              {realMetrics && realMetrics.syncRate > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {realMetrics.syncRate} syncs/hour
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Additional Metrics */}
        {realMetrics && (
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Repositories</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{stats.repositoriesTotal}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {stats.repositoriesConnected} connected
                  {stats.repositoriesTotal - stats.repositoriesConnected > 0 && (
                    <span className="text-red-500 ml-2">
                      {stats.repositoriesTotal - stats.repositoriesConnected} failed
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Projects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{stats.projectsTotal}</div>
                <p className="text-xs text-muted-foreground mt-1">Total projects</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Sync Operations</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-xl font-bold">{realMetrics.syncOperationsTotal || 0}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {realMetrics.syncOperationsSuccess || 0} success
                  {realMetrics.syncOperationsFailed > 0 && (
                    <span className="text-red-500 ml-2">
                      {realMetrics.syncOperationsFailed} failed
                    </span>
                  )}
                </p>
                {realMetrics.averageSyncDuration > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Avg duration: {(realMetrics.averageSyncDuration / 1000).toFixed(1)}s
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* Main Configuration Tabs */}
        <Tabs defaultValue="applications" className="w-full">
          <TabsList className="flex flex-wrap w-full">
            <TabsTrigger value="applications" className="gap-2">
              <Rocket className="h-4 w-4" />
              Applications
            </TabsTrigger>
            <TabsTrigger value="repositories" className="gap-2">
              <Database className="h-4 w-4" />
              Repositories
            </TabsTrigger>
            <TabsTrigger value="projects" className="gap-2">
              <FolderGit2 className="h-4 w-4" />
              Projects
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
            <TabsTrigger value="rbac" className="gap-2">
              <Shield className="h-4 w-4" />
              RBAC
            </TabsTrigger>
            <TabsTrigger value="notifications" className="gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="sync-operations" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Sync Operations
            </TabsTrigger>
            <TabsTrigger value="sync-windows" className="gap-2">
              <Clock className="h-4 w-4" />
              Sync Windows
            </TabsTrigger>
            <TabsTrigger value="metrics" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Metrics
            </TabsTrigger>
            <TabsTrigger value="application-sets" className="gap-2">
              <Grid3x3 className="h-4 w-4" />
              Application Sets
            </TabsTrigger>
          </TabsList>

          {/* Applications Tab */}
          <TabsContent value="applications" className="space-y-4 mt-4">
            {/* Search and Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4 items-center">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search applications..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={filterStatus} onValueChange={(value: any) => setFilterStatus(value)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="synced">Synced</SelectItem>
                      <SelectItem value="outofsync">Out of Sync</SelectItem>
                      <SelectItem value="progressing">Progressing</SelectItem>
                      <SelectItem value="degraded">Degraded</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={filterHealth} onValueChange={(value: any) => setFilterHealth(value)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by health" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Health</SelectItem>
                      <SelectItem value="healthy">Healthy</SelectItem>
                      <SelectItem value="degraded">Degraded</SelectItem>
                      <SelectItem value="progressing">Progressing</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => setShowAddApplication(true)} variant="default">
                    <Plus className="h-4 w-4 mr-2" />
                    New Application
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Add Application Inline Form */}
            {showAddApplication && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle>New Application</CardTitle>
                  <CardDescription>Create a new Argo CD application for GitOps deployment</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="app-name">Application Name *</Label>
                    <Input
                      id="app-name"
                      value={newAppName}
                      onChange={(e) => {
                        setNewAppName(e.target.value);
                        setAppNameError('');
                      }}
                      placeholder="my-app"
                    />
                    {appNameError && <p className="text-sm text-destructive">{appNameError}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="app-namespace">Namespace</Label>
                      <Input
                        id="app-namespace"
                        value={newAppNamespace}
                        onChange={(e) => setNewAppNamespace(e.target.value)}
                        placeholder="default"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="app-project">Project</Label>
                      <Input
                        id="app-project"
                        value={newAppProject}
                        onChange={(e) => setNewAppProject(e.target.value)}
                        placeholder="default"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="app-repository">Repository *</Label>
                    <Input
                      id="app-repository"
                      value={newAppRepository}
                      onChange={(e) => {
                        setNewAppRepository(e.target.value);
                        setAppRepositoryError('');
                      }}
                      placeholder="https://github.com/example/repo or repository name"
                    />
                    {appRepositoryError && <p className="text-sm text-destructive">{appRepositoryError}</p>}
                  </div>
                  {isHelmRepository ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="app-helm-chart">Helm Chart *</Label>
                          <Select
                            value={newAppHelmChart}
                            onValueChange={(value) => {
                              setNewAppHelmChart(value);
                              // Сбрасываем версию при смене chart
                              setNewAppHelmVersion('latest');
                            }}
                          >
                            <SelectTrigger id="app-helm-chart">
                              <SelectValue placeholder="Select chart" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableHelmCharts.map(chart => (
                                <SelectItem key={chart.name} value={chart.name}>
                                  {chart.name} {chart.description && `- ${chart.description}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="app-helm-version">Chart Version</Label>
                          <Select
                            value={newAppHelmVersion}
                            onValueChange={setNewAppHelmVersion}
                            disabled={!newAppHelmChart}
                          >
                            <SelectTrigger id="app-helm-version">
                              <SelectValue placeholder="latest" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="latest">latest</SelectItem>
                              {selectedHelmChartVersions.map(version => (
                                <SelectItem key={version} value={version}>
                                  {version}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="app-helm-release-name">Release Name (optional)</Label>
                        <Input
                          id="app-helm-release-name"
                          value={newAppHelmReleaseName}
                          onChange={(e) => setNewAppHelmReleaseName(e.target.value)}
                          placeholder="Leave empty to use application name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="app-helm-values">Helm Values (YAML)</Label>
                        <Textarea
                          id="app-helm-values"
                          value={newAppHelmValues}
                          onChange={(e) => setNewAppHelmValues(e.target.value)}
                          placeholder="replicas: 3&#10;image:&#10;  tag: latest"
                          rows={4}
                          className="font-mono text-sm"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="app-helm-skip-crds"
                          checked={newAppHelmSkipCrds}
                          onCheckedChange={setNewAppHelmSkipCrds}
                        />
                        <Label htmlFor="app-helm-skip-crds" className="cursor-pointer">
                          Skip CRDs installation
                        </Label>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="app-path">Path</Label>
                        <Input
                          id="app-path"
                          value={newAppPath}
                          onChange={(e) => setNewAppPath(e.target.value)}
                          placeholder="."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="app-revision">Target Revision</Label>
                        <Input
                          id="app-revision"
                          value={newAppTargetRevision}
                          onChange={(e) => setNewAppTargetRevision(e.target.value)}
                          placeholder="main"
                        />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="app-dest-server">Destination Server</Label>
                      <Input
                        id="app-dest-server"
                        value={newAppDestinationServer}
                        onChange={(e) => setNewAppDestinationServer(e.target.value)}
                        placeholder="https://kubernetes.default.svc"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="app-dest-namespace">Destination Namespace</Label>
                      <Input
                        id="app-dest-namespace"
                        value={newAppDestinationNamespace}
                        onChange={(e) => setNewAppDestinationNamespace(e.target.value)}
                        placeholder="default"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="app-sync-policy">Sync Policy</Label>
                    <Select
                      value={newAppSyncPolicy}
                      onValueChange={(value: 'automated' | 'manual' | 'sync-window') => {
                        setNewAppSyncPolicy(value);
                        // Сбрасываем опции если не automated
                        if (value !== 'automated') {
                          setNewAppSyncPolicyPrune(false);
                          setNewAppSyncPolicySelfHeal(false);
                        }
                      }}
                    >
                      <SelectTrigger id="app-sync-policy">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="automated">Automated</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="sync-window">Sync Window</SelectItem>
                      </SelectContent>
                    </Select>
                    {newAppSyncPolicy === 'automated' && (
                      <div className="space-y-2 mt-2 pl-4 border-l-2">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="app-sync-policy-prune"
                            checked={newAppSyncPolicyPrune}
                            onCheckedChange={setNewAppSyncPolicyPrune}
                          />
                          <Label htmlFor="app-sync-policy-prune" className="cursor-pointer">
                            Prune (automatically delete resources removed from Git)
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="app-sync-policy-selfheal"
                            checked={newAppSyncPolicySelfHeal}
                            onCheckedChange={setNewAppSyncPolicySelfHeal}
                          />
                          <Label htmlFor="app-sync-policy-selfheal" className="cursor-pointer">
                            Self-Heal (automatically restore drift)
                          </Label>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleAddApplication}>
                      <Save className="h-4 w-4 mr-2" />
                      Create Application
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setShowAddApplication(false);
                      setNewAppName('');
                      setNewAppNamespace('default');
                      setNewAppProject('default');
                      setNewAppRepository('');
                      setNewAppPath('.');
                      setNewAppTargetRevision('main');
                      setNewAppDestinationServer('https://kubernetes.default.svc');
                      setNewAppDestinationNamespace('default');
                      setNewAppSyncPolicy('manual');
                      setAppNameError('');
                      setAppRepositoryError('');
                    }}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Edit Application Inline Form */}
            {showEditApplication && editingApplication && (
              <Card className="border-primary">
                <CardHeader>
                  <CardTitle>Edit Application</CardTitle>
                  <CardDescription>Update application configuration</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-app-name">Application Name *</Label>
                    <Input
                      id="edit-app-name"
                      value={newAppName}
                      onChange={(e) => {
                        setNewAppName(e.target.value);
                        setAppNameError('');
                      }}
                      placeholder="my-app"
                    />
                    {appNameError && <p className="text-sm text-destructive">{appNameError}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-app-namespace">Namespace</Label>
                      <Input
                        id="edit-app-namespace"
                        value={newAppNamespace}
                        onChange={(e) => setNewAppNamespace(e.target.value)}
                        placeholder="default"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-app-project">Project</Label>
                      <Input
                        id="edit-app-project"
                        value={newAppProject}
                        onChange={(e) => setNewAppProject(e.target.value)}
                        placeholder="default"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-app-repository">Repository *</Label>
                    <Input
                      id="edit-app-repository"
                      value={newAppRepository}
                      onChange={(e) => {
                        setNewAppRepository(e.target.value);
                        setAppRepositoryError('');
                      }}
                      placeholder="https://github.com/example/repo or repository name"
                    />
                    {appRepositoryError && <p className="text-sm text-destructive">{appRepositoryError}</p>}
                  </div>
                  {isHelmRepository ? (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-app-helm-chart">Helm Chart *</Label>
                          <Select
                            value={newAppHelmChart}
                            onValueChange={(value) => {
                              setNewAppHelmChart(value);
                              setNewAppHelmVersion('latest');
                            }}
                          >
                            <SelectTrigger id="edit-app-helm-chart">
                              <SelectValue placeholder="Select chart" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableHelmCharts.map(chart => (
                                <SelectItem key={chart.name} value={chart.name}>
                                  {chart.name} {chart.description && `- ${chart.description}`}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-app-helm-version">Chart Version</Label>
                          <Select
                            value={newAppHelmVersion}
                            onValueChange={setNewAppHelmVersion}
                            disabled={!newAppHelmChart}
                          >
                            <SelectTrigger id="edit-app-helm-version">
                              <SelectValue placeholder="latest" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="latest">latest</SelectItem>
                              {selectedHelmChartVersions.map(version => (
                                <SelectItem key={version} value={version}>
                                  {version}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-app-helm-release-name">Release Name (optional)</Label>
                        <Input
                          id="edit-app-helm-release-name"
                          value={newAppHelmReleaseName}
                          onChange={(e) => setNewAppHelmReleaseName(e.target.value)}
                          placeholder="Leave empty to use application name"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-app-helm-values">Helm Values (YAML)</Label>
                        <Textarea
                          id="edit-app-helm-values"
                          value={newAppHelmValues}
                          onChange={(e) => setNewAppHelmValues(e.target.value)}
                          placeholder="replicas: 3&#10;image:&#10;  tag: latest"
                          rows={4}
                          className="font-mono text-sm"
                        />
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="edit-app-helm-skip-crds"
                          checked={newAppHelmSkipCrds}
                          onCheckedChange={setNewAppHelmSkipCrds}
                        />
                        <Label htmlFor="edit-app-helm-skip-crds" className="cursor-pointer">
                          Skip CRDs installation
                        </Label>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-app-path">Path</Label>
                        <Input
                          id="edit-app-path"
                          value={newAppPath}
                          onChange={(e) => setNewAppPath(e.target.value)}
                          placeholder="."
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-app-revision">Target Revision</Label>
                        <Input
                          id="edit-app-revision"
                          value={newAppTargetRevision}
                          onChange={(e) => setNewAppTargetRevision(e.target.value)}
                          placeholder="main"
                        />
                      </div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-app-dest-server">Destination Server</Label>
                      <Input
                        id="edit-app-dest-server"
                        value={newAppDestinationServer}
                        onChange={(e) => setNewAppDestinationServer(e.target.value)}
                        placeholder="https://kubernetes.default.svc"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-app-dest-namespace">Destination Namespace</Label>
                      <Input
                        id="edit-app-dest-namespace"
                        value={newAppDestinationNamespace}
                        onChange={(e) => setNewAppDestinationNamespace(e.target.value)}
                        placeholder="default"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-app-sync-policy">Sync Policy</Label>
                    <Select
                      value={newAppSyncPolicy}
                      onValueChange={(value: 'automated' | 'manual' | 'sync-window') => {
                        setNewAppSyncPolicy(value);
                        // Сбрасываем опции если не automated
                        if (value !== 'automated') {
                          setNewAppSyncPolicyPrune(false);
                          setNewAppSyncPolicySelfHeal(false);
                        }
                      }}
                    >
                      <SelectTrigger id="edit-app-sync-policy">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="automated">Automated</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="sync-window">Sync Window</SelectItem>
                      </SelectContent>
                    </Select>
                    {newAppSyncPolicy === 'automated' && (
                      <div className="space-y-2 mt-2 pl-4 border-l-2">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="edit-app-sync-policy-prune"
                            checked={newAppSyncPolicyPrune}
                            onCheckedChange={setNewAppSyncPolicyPrune}
                          />
                          <Label htmlFor="edit-app-sync-policy-prune" className="cursor-pointer">
                            Prune (automatically delete resources removed from Git)
                          </Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id="edit-app-sync-policy-selfheal"
                            checked={newAppSyncPolicySelfHeal}
                            onCheckedChange={setNewAppSyncPolicySelfHeal}
                          />
                          <Label htmlFor="edit-app-sync-policy-selfheal" className="cursor-pointer">
                            Self-Heal (automatically restore drift)
                          </Label>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Sync Hooks Section */}
                  <Separator />
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <Label className="text-base font-semibold">Sync Hooks</Label>
                        <p className="text-xs text-muted-foreground mt-1">
                          Kubernetes resources executed during sync phases (PreSync, Sync, PostSync, SyncFail)
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setShowAddHook(true);
                          setNewHookName('');
                          setNewHookKind('Job');
                          setNewHookPhase('PreSync');
                          setNewHookDeletePolicy('HookSucceeded');
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Hook
                      </Button>
                    </div>
                    
                    {showAddHook && (
                      <Card className="border-primary bg-muted/50">
                        <CardContent className="pt-4 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="hook-name">Hook Name *</Label>
                              <Input
                                id="hook-name"
                                value={newHookName}
                                onChange={(e) => setNewHookName(e.target.value)}
                                placeholder="pre-sync-migration"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="hook-kind">Resource Kind</Label>
                              <Select value={newHookKind} onValueChange={setNewHookKind}>
                                <SelectTrigger id="hook-kind">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Job">Job</SelectItem>
                                  <SelectItem value="Pod">Pod</SelectItem>
                                  <SelectItem value="ArgoWorkflow">Argo Workflow</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label htmlFor="hook-phase">Hook Phase *</Label>
                              <Select value={newHookPhase} onValueChange={(value: SyncHookPhase) => setNewHookPhase(value)}>
                                <SelectTrigger id="hook-phase">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="PreSync">PreSync</SelectItem>
                                  <SelectItem value="Sync">Sync</SelectItem>
                                  <SelectItem value="PostSync">PostSync</SelectItem>
                                  <SelectItem value="SyncFail">SyncFail</SelectItem>
                                  <SelectItem value="PreDelete">PreDelete</SelectItem>
                                  <SelectItem value="PostDelete">PostDelete</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="hook-delete-policy">Delete Policy</Label>
                              <Select value={newHookDeletePolicy} onValueChange={(value: 'HookSucceeded' | 'HookFailed' | 'BeforeHookCreation') => setNewHookDeletePolicy(value)}>
                                <SelectTrigger id="hook-delete-policy">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="HookSucceeded">HookSucceeded</SelectItem>
                                  <SelectItem value="HookFailed">HookFailed</SelectItem>
                                  <SelectItem value="BeforeHookCreation">BeforeHookCreation</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                if (!newHookName.trim()) {
                                  toast({
                                    title: "Error",
                                    description: "Hook name is required",
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                
                                // Check for duplicates
                                if (appHooks.some(h => h.name === newHookName.trim() && h.phase === newHookPhase)) {
                                  toast({
                                    title: "Error",
                                    description: `Hook "${newHookName}" with phase "${newHookPhase}" already exists`,
                                    variant: "destructive",
                                  });
                                  return;
                                }
                                
                                const newHook: ArgoCDSyncHook = {
                                  name: newHookName.trim(),
                                  kind: newHookKind,
                                  phase: newHookPhase,
                                  status: 'pending',
                                  deletePolicy: newHookDeletePolicy,
                                };
                                
                                setAppHooks([...appHooks, newHook]);
                                setShowAddHook(false);
                                setNewHookName('');
                              }}
                            >
                              Add
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setShowAddHook(false);
                                setNewHookName('');
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {appHooks.length > 0 && (
                      <div className="space-y-2">
                        {appHooks.map((hook, index) => (
                          <Card key={`${hook.name}-${hook.phase}-${index}`} className="border-border">
                            <CardContent className="pt-3 pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline">{hook.phase}</Badge>
                                    <span className="font-semibold">{hook.name}</span>
                                    <Badge variant="secondary" className="text-xs">{hook.kind}</Badge>
                                    {hook.deletePolicy && (
                                      <Badge variant="outline" className="text-xs">
                                        Delete: {hook.deletePolicy}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    const updatedHooks = appHooks.filter((h, i) => 
                                      !(h.name === hook.name && h.phase === hook.phase && i === index)
                                    );
                                    setAppHooks(updatedHooks);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                    
                    {appHooks.length === 0 && !showAddHook && (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        No hooks configured. Add hooks to execute custom logic during sync phases.
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2 mt-4">
                    <Button onClick={handleSaveApplication}>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setShowEditApplication(false);
                      setEditingApplication(null);
                      setAppNameError('');
                      setAppHooks([]);
                      setShowAddHook(false);
                      setNewAppSyncPolicy('manual');
                      setNewAppSyncPolicyPrune(false);
                      setNewAppSyncPolicySelfHeal(false);
                    }}>
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Applications List */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Applications</CardTitle>
                    <CardDescription>GitOps application deployments ({filteredApplications.length})</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredApplications.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Rocket className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No applications found</p>
                      <p className="text-sm mt-2">Create your first application to get started</p>
                    </div>
                  ) : (
                    filteredApplications.map((app, index) => (
                      <Card key={app.name || index} className="border-border hover:border-primary/50 transition-colors">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 flex-1">
                              {getStatusIcon(app.status)}
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <CardTitle className="text-lg">{app.name}</CardTitle>
                                  {getHealthBadge(app.health)}
                                </div>
                                <CardDescription className="text-xs mt-1">
                                  Namespace: {app.namespace || 'default'} • Project: {app.project || 'default'} • {getSyncPolicyType(app.syncPolicy)}
                                  {getSyncPolicyType(app.syncPolicy) === 'automated' && (getSyncPolicyOptions(app.syncPolicy).prune || getSyncPolicyOptions(app.syncPolicy).selfHeal) && (
                                    <span className="text-xs text-muted-foreground">
                                      {' '}({[
                                        getSyncPolicyOptions(app.syncPolicy).prune && 'Prune',
                                        getSyncPolicyOptions(app.syncPolicy).selfHeal && 'Self-Heal'
                                      ].filter(Boolean).join(', ')})
                                    </span>
                                  )} sync
                                  {app.lastSync && ` • Last sync: ${formatTimeAgo(app.lastSync)}`}
                                  {app.revision && ` • Revision: ${app.revision.substring(0, 7)}`}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                {app.status === 'outofsync' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleSyncApplication(app.name)}
                                    disabled={app.status === 'progressing'}
                                  >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Sync
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRefreshApplication(app.name)}
                                  title="Refresh application status"
                                >
                                  <RefreshCw className="h-4 w-4" />
                                </Button>
                                {app.history && app.history.length > 1 && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleRollbackApplication(app.name)}
                                    title="Rollback to previous revision"
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                )}
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    const newExpanded = new Set(expandedApplications);
                                    if (newExpanded.has(app.name)) {
                                      newExpanded.delete(app.name);
                                    } else {
                                      newExpanded.add(app.name);
                                    }
                                    setExpandedApplications(newExpanded);
                                  }}
                                  title={expandedApplications.has(app.name) ? "Hide details" : "View details"}
                                >
                                  {expandedApplications.has(app.name) ? (
                                    <ChevronUp className="h-4 w-4" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleEditApplication(app)}
                                  title="Edit application"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete application "${app.name}"?`)) {
                                      handleDeleteApplication(app.name);
                                    }
                                  }}
                                  title="Delete application"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        {expandedApplications.has(app.name) && (
                          <CardContent className="pt-0 border-t">
                            <ApplicationDetailsView 
                              app={app}
                              realSyncOperations={realSyncOperations}
                              onRefresh={() => handleRefreshApplication(app.name)}
                              onSync={() => handleSyncApplication(app.name)}
                              onRollback={() => handleRollbackApplication(app.name)}
                            />
                          </CardContent>
                        )}
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Repositories Tab */}
          <TabsContent value="repositories" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Repositories</CardTitle>
                    <CardDescription>Git repositories, Helm charts, and OCI registries</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddRepository(true)} variant="default">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Repository
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Add Repository Inline Form */}
                {showAddRepository && (
                  <Card className="border-primary mb-4">
                    <CardHeader>
                      <CardTitle>Add Repository</CardTitle>
                      <CardDescription>Add a Git repository, Helm chart repository, or OCI registry</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="repo-name">Repository Name *</Label>
                        <Input
                          id="repo-name"
                          value={newRepoName}
                          onChange={(e) => {
                            setNewRepoName(e.target.value);
                            setRepoNameError('');
                          }}
                          placeholder="my-repo"
                        />
                        {repoNameError && <p className="text-sm text-destructive">{repoNameError}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="repo-url">Repository URL *</Label>
                        <Input
                          id="repo-url"
                          value={newRepoUrl}
                          onChange={(e) => {
                            setNewRepoUrl(e.target.value);
                            setRepoUrlError('');
                          }}
                          placeholder="https://github.com/example/repo"
                        />
                        {repoUrlError && <p className="text-sm text-destructive">{repoUrlError}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="repo-type">Repository Type</Label>
                        <Select
                          value={newRepoType}
                          onValueChange={(value: 'git' | 'helm' | 'oci') => setNewRepoType(value)}
                        >
                          <SelectTrigger id="repo-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="git">Git</SelectItem>
                            <SelectItem value="helm">Helm</SelectItem>
                            <SelectItem value="oci">OCI</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="repo-username">Username</Label>
                          <Input
                            id="repo-username"
                            value={newRepoUsername}
                            onChange={(e) => setNewRepoUsername(e.target.value)}
                            placeholder="optional"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="repo-password">Password</Label>
                          <Input
                            id="repo-password"
                            type="password"
                            value={newRepoPassword}
                            onChange={(e) => setNewRepoPassword(e.target.value)}
                            placeholder="optional"
                          />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="repo-insecure"
                          checked={newRepoInsecure}
                          onCheckedChange={setNewRepoInsecure}
                        />
                        <Label htmlFor="repo-insecure">Insecure (skip TLS verification)</Label>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button onClick={handleAddRepository}>
                          <Save className="h-4 w-4 mr-2" />
                          Add Repository
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowAddRepository(false);
                          setNewRepoName('');
                          setNewRepoUrl('');
                          setNewRepoType('git');
                          setNewRepoUsername('');
                          setNewRepoPassword('');
                          setNewRepoInsecure(false);
                          setNewRepoProject('');
                          setRepoNameError('');
                          setRepoUrlError('');
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Edit Repository Inline Form */}
                {showEditRepository && editingRepository && (
                  <Card className="border-primary mb-4">
                    <CardHeader>
                      <CardTitle>Edit Repository</CardTitle>
                      <CardDescription>Update repository configuration</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-repo-name">Repository Name *</Label>
                        <Input
                          id="edit-repo-name"
                          value={newRepoName}
                          onChange={(e) => {
                            setNewRepoName(e.target.value);
                            setRepoNameError('');
                          }}
                          placeholder="my-repo"
                        />
                        {repoNameError && <p className="text-sm text-destructive">{repoNameError}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-repo-url">Repository URL *</Label>
                        <Input
                          id="edit-repo-url"
                          value={newRepoUrl}
                          onChange={(e) => {
                            setNewRepoUrl(e.target.value);
                            setRepoUrlError('');
                          }}
                          placeholder="https://github.com/example/repo"
                        />
                        {repoUrlError && <p className="text-sm text-destructive">{repoUrlError}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-repo-type">Repository Type</Label>
                        <Select
                          value={newRepoType}
                          onValueChange={(value: 'git' | 'helm' | 'oci') => setNewRepoType(value)}
                        >
                          <SelectTrigger id="edit-repo-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="git">Git</SelectItem>
                            <SelectItem value="helm">Helm</SelectItem>
                            <SelectItem value="oci">OCI</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-repo-username">Username</Label>
                          <Input
                            id="edit-repo-username"
                            value={newRepoUsername}
                            onChange={(e) => setNewRepoUsername(e.target.value)}
                            placeholder="optional"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-repo-password">Password</Label>
                          <Input
                            id="edit-repo-password"
                            type="password"
                            value={newRepoPassword}
                            onChange={(e) => setNewRepoPassword(e.target.value)}
                            placeholder="optional"
                          />
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="edit-repo-insecure"
                          checked={newRepoInsecure}
                          onCheckedChange={setNewRepoInsecure}
                        />
                        <Label htmlFor="edit-repo-insecure">Insecure (skip TLS verification)</Label>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button onClick={handleSaveRepository}>
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowEditRepository(false);
                          setEditingRepository(null);
                          setRepoNameError('');
                          setRepoUrlError('');
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <div className="space-y-3">
                  {filteredRepositories.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Database className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No repositories found</p>
                    </div>
                  ) : (
                    filteredRepositories.map((repo, index) => (
                      <Card key={repo.name || index} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Database className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <CardTitle className="text-lg">{repo.name}</CardTitle>
                                <CardDescription className="text-xs mt-1">
                                  {repo.url} • Type: {repo.type || 'git'}
                                  {repo.connectionStatus && (
                                    <Badge 
                                      variant={repo.connectionStatus === 'successful' ? 'default' : 'destructive'}
                                      className="ml-2"
                                    >
                                      {repo.connectionStatus}
                                    </Badge>
                                  )}
                                </CardDescription>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditRepository(repo)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteRepository(repo.name)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Projects</CardTitle>
                    <CardDescription>Logical grouping of applications</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddProject(true)} variant="default">
                    <Plus className="h-4 w-4 mr-2" />
                    New Project
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Add Project Inline Form */}
                {showAddProject && (
                  <Card className="border-primary mb-4">
                    <CardHeader>
                      <CardTitle>New Project</CardTitle>
                      <CardDescription>Create a new project to group applications</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="project-name">Project Name *</Label>
                        <Input
                          id="project-name"
                          value={newProjectName}
                          onChange={(e) => {
                            setNewProjectName(e.target.value);
                            setProjectNameError('');
                          }}
                          placeholder="my-project"
                        />
                        {projectNameError && <p className="text-sm text-destructive">{projectNameError}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="project-description">Description</Label>
                        <Textarea
                          id="project-description"
                          value={newProjectDescription}
                          onChange={(e) => setNewProjectDescription(e.target.value)}
                          placeholder="Project description"
                          rows={3}
                        />
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button onClick={handleAddProject}>
                          <Save className="h-4 w-4 mr-2" />
                          Create Project
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowAddProject(false);
                          setNewProjectName('');
                          setNewProjectDescription('');
                          setNewProjectSourceRepos([]);
                          setNewProjectDestinations([]);
                          setProjectNameError('');
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                <div className="space-y-3">
                  {filteredProjects.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <FolderGit2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No projects found</p>
                    </div>
                  ) : (
                    filteredProjects.map((project, index) => (
                      <Card key={project.name || index} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <CardTitle className="text-lg">{project.name}</CardTitle>
                              {project.description && (
                                <CardDescription className="text-xs mt-1">
                                  {project.description}
                                </CardDescription>
                              )}
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteProject(project.name)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardHeader>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Argo CD Server</CardTitle>
                <CardDescription>Server configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="server-url">Server URL</Label>
                  <Input
                    id="server-url"
                    value={config.serverUrl || 'https://argocd.example.com'}
                    onChange={(e) => updateConfig({ serverUrl: e.target.value })}
                    placeholder="https://argocd.example.com"
                  />
                </div>
                <Separator />
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable SSO</Label>
                      <p className="text-sm text-muted-foreground">Single Sign-On authentication</p>
                    </div>
                    <Switch
                      checked={config.enableSSO ?? false}
                      onCheckedChange={(checked) => updateConfig({ enableSSO: checked })}
                    />
                  </div>
                  {config.enableSSO && (
                    <div className="space-y-2 pl-6">
                      <Label htmlFor="sso-provider">SSO Provider</Label>
                      <Select
                        value={config.ssoProvider || 'oidc'}
                        onValueChange={(value: 'oidc' | 'saml' | 'ldap') => updateConfig({ ssoProvider: value })}
                      >
                        <SelectTrigger id="sso-provider">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="oidc">OIDC</SelectItem>
                          <SelectItem value="saml">SAML</SelectItem>
                          <SelectItem value="ldap">LDAP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable RBAC</Label>
                      <p className="text-sm text-muted-foreground">Role-based access control</p>
                    </div>
                    <Switch
                      checked={config.enableRBAC ?? true}
                      onCheckedChange={(checked) => updateConfig({ enableRBAC: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Auto Sync</Label>
                      <p className="text-sm text-muted-foreground">Automatically sync applications</p>
                    </div>
                    <Switch
                      checked={config.autoSync ?? false}
                      onCheckedChange={(checked) => updateConfig({ autoSync: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Enable Health Checks</Label>
                      <p className="text-sm text-muted-foreground">Monitor application health</p>
                    </div>
                    <Switch
                      checked={config.enableHealthChecks ?? true}
                      onCheckedChange={(checked) => updateConfig({ enableHealthChecks: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Sync Status</span>
                      <span className="font-semibold">{stats.syncedApps}/{stats.totalApps} synced</span>
                    </div>
                    <Progress value={stats.totalApps > 0 ? (stats.syncedApps / stats.totalApps) * 100 : 0} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* RBAC Tab */}
          <TabsContent value="rbac" className="space-y-4 mt-4">
            {!config.enableRBAC ? (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8 text-muted-foreground">
                    <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>RBAC is disabled. Enable it in Settings to manage roles and permissions.</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Add Role Inline Form */}
                {showAddRole && (
                  <Card className="border-primary">
                    <CardHeader>
                      <CardTitle>New Role</CardTitle>
                      <CardDescription>Create a new RBAC role</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="role-name">Role Name *</Label>
                        <Input
                          id="role-name"
                          value={newRoleName}
                          onChange={(e) => {
                            setNewRoleName(e.target.value);
                            setRoleNameError('');
                          }}
                          placeholder="admin"
                        />
                        {roleNameError && <p className="text-sm text-destructive">{roleNameError}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role-description">Description</Label>
                        <Textarea
                          id="role-description"
                          value={newRoleDescription}
                          onChange={(e) => setNewRoleDescription(e.target.value)}
                          placeholder="Role description"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Policies</Label>
                          <Button size="sm" variant="outline" onClick={handleAddPolicy}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Policy
                          </Button>
                        </div>
                        {newRolePolicies.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No policies. Click "Add Policy" to add one.</p>
                        ) : (
                          <div className="space-y-2">
                            {newRolePolicies.map((policy, index) => (
                              <Card key={index} className="p-3">
                                <div className="grid grid-cols-4 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Action</Label>
                                    <Select
                                      value={policy.action}
                                      onValueChange={(value) => handleUpdatePolicy(index, { action: value })}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="*">All</SelectItem>
                                        <SelectItem value="get">Get</SelectItem>
                                        <SelectItem value="create">Create</SelectItem>
                                        <SelectItem value="update">Update</SelectItem>
                                        <SelectItem value="delete">Delete</SelectItem>
                                        <SelectItem value="sync">Sync</SelectItem>
                                        <SelectItem value="override">Override</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Resource</Label>
                                    <Select
                                      value={policy.resource}
                                      onValueChange={(value) => handleUpdatePolicy(index, { resource: value })}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="*">All</SelectItem>
                                        <SelectItem value="applications">Applications</SelectItem>
                                        <SelectItem value="repositories">Repositories</SelectItem>
                                        <SelectItem value="clusters">Clusters</SelectItem>
                                        <SelectItem value="projects">Projects</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Effect</Label>
                                    <Select
                                      value={policy.effect}
                                      onValueChange={(value: 'allow' | 'deny') => handleUpdatePolicy(index, { effect: value })}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="allow">Allow</SelectItem>
                                        <SelectItem value="deny">Deny</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex items-end">
                                    <Button size="sm" variant="ghost" onClick={() => handleRemovePolicy(index)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                {policy.object && (
                                  <div className="mt-2">
                                    <Label className="text-xs">Object Pattern</Label>
                                    <Input
                                      value={policy.object}
                                      onChange={(e) => handleUpdatePolicy(index, { object: e.target.value })}
                                      placeholder="app-* or default/*"
                                      className="h-8"
                                    />
                                  </div>
                                )}
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Groups</Label>
                          <Button size="sm" variant="outline" onClick={handleAddGroup}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Group
                          </Button>
                        </div>
                        {newRoleGroups.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No groups. Click "Add Group" to add one.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {newRoleGroups.map((group, index) => (
                              <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                {group}
                                <button
                                  onClick={() => handleRemoveGroup(group)}
                                  className="ml-1 hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button onClick={handleAddRole}>
                          <Save className="h-4 w-4 mr-2" />
                          Create Role
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowAddRole(false);
                          setNewRoleName('');
                          setNewRoleDescription('');
                          setNewRolePolicies([]);
                          setNewRoleGroups([]);
                          setRoleNameError('');
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Edit Role Inline Form */}
                {showEditRole && editingRole && (
                  <Card className="border-primary">
                    <CardHeader>
                      <CardTitle>Edit Role</CardTitle>
                      <CardDescription>Update role configuration</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-role-name">Role Name *</Label>
                        <Input
                          id="edit-role-name"
                          value={newRoleName}
                          onChange={(e) => {
                            setNewRoleName(e.target.value);
                            setRoleNameError('');
                          }}
                          placeholder="admin"
                        />
                        {roleNameError && <p className="text-sm text-destructive">{roleNameError}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-role-description">Description</Label>
                        <Textarea
                          id="edit-role-description"
                          value={newRoleDescription}
                          onChange={(e) => setNewRoleDescription(e.target.value)}
                          placeholder="Role description"
                        />
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Policies</Label>
                          <Button size="sm" variant="outline" onClick={handleAddPolicy}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Policy
                          </Button>
                        </div>
                        {newRolePolicies.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No policies. Click "Add Policy" to add one.</p>
                        ) : (
                          <div className="space-y-2">
                            {newRolePolicies.map((policy, index) => (
                              <Card key={index} className="p-3">
                                <div className="grid grid-cols-4 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Action</Label>
                                    <Select
                                      value={policy.action}
                                      onValueChange={(value) => handleUpdatePolicy(index, { action: value })}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="*">All</SelectItem>
                                        <SelectItem value="get">Get</SelectItem>
                                        <SelectItem value="create">Create</SelectItem>
                                        <SelectItem value="update">Update</SelectItem>
                                        <SelectItem value="delete">Delete</SelectItem>
                                        <SelectItem value="sync">Sync</SelectItem>
                                        <SelectItem value="override">Override</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Resource</Label>
                                    <Select
                                      value={policy.resource}
                                      onValueChange={(value) => handleUpdatePolicy(index, { resource: value })}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="*">All</SelectItem>
                                        <SelectItem value="applications">Applications</SelectItem>
                                        <SelectItem value="repositories">Repositories</SelectItem>
                                        <SelectItem value="clusters">Clusters</SelectItem>
                                        <SelectItem value="projects">Projects</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="space-y-1">
                                    <Label className="text-xs">Effect</Label>
                                    <Select
                                      value={policy.effect}
                                      onValueChange={(value: 'allow' | 'deny') => handleUpdatePolicy(index, { effect: value })}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="allow">Allow</SelectItem>
                                        <SelectItem value="deny">Deny</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex items-end">
                                    <Button size="sm" variant="ghost" onClick={() => handleRemovePolicy(index)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                                {policy.object && (
                                  <div className="mt-2">
                                    <Label className="text-xs">Object Pattern</Label>
                                    <Input
                                      value={policy.object}
                                      onChange={(e) => handleUpdatePolicy(index, { object: e.target.value })}
                                      placeholder="app-* or default/*"
                                      className="h-8"
                                    />
                                  </div>
                                )}
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Groups</Label>
                          <Button size="sm" variant="outline" onClick={handleAddGroup}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Group
                          </Button>
                        </div>
                        {newRoleGroups.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No groups. Click "Add Group" to add one.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {newRoleGroups.map((group, index) => (
                              <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                {group}
                                <button
                                  onClick={() => handleRemoveGroup(group)}
                                  className="ml-1 hover:text-destructive"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 mt-4">
                        <Button onClick={handleSaveRole}>
                          <Save className="h-4 w-4 mr-2" />
                          Save Role
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowEditRole(false);
                          setEditingRole(null);
                          setRoleNameError('');
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Roles List */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Roles</CardTitle>
                        <CardDescription>Manage RBAC roles and permissions</CardDescription>
                      </div>
                      {!showAddRole && !showEditRole && (
                        <Button onClick={() => setShowAddRole(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          New Role
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {realRoles.length === 0 && (config.roles || []).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No roles configured. Create a role to get started.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(realRoles.length > 0 ? realRoles : (config.roles || []).map(r => ({
                          name: r.name,
                          description: r.description,
                          policies: (r.policies || []).map(p => {
                            const parts = p.split(',');
                            return {
                              action: parts[2]?.trim() || '*',
                              resource: parts[3]?.trim() || '*',
                              effect: parts[4]?.trim() === 'allow' ? 'allow' : 'deny',
                              object: parts[5]?.trim(),
                            };
                          }),
                          groups: r.groups || [],
                        }))).map((role, index) => (
                          <Card key={role.name || index} className="border-border">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <CardTitle className="text-lg">{role.name}</CardTitle>
                                  {role.description && (
                                    <CardDescription className="text-xs mt-1">
                                      {role.description}
                                    </CardDescription>
                                  )}
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditRole(role)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteRole(role.name)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                {role.policies && role.policies.length > 0 && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Policies</Label>
                                    <div className="mt-1 space-y-1">
                                      {role.policies.map((policy, pIndex) => (
                                        <Badge key={pIndex} variant="outline" className="mr-1">
                                          {policy.action} {policy.resource} ({policy.effect})
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {role.groups && role.groups.length > 0 && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Groups</Label>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {role.groups.map((group, gIndex) => (
                                        <Badge key={gIndex} variant="secondary">
                                          {group}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Notifications Tab */}
          <TabsContent value="notifications" className="space-y-4 mt-4">
            {/* Enable Notifications Toggle */}
            <Card>
              <CardHeader>
                <CardTitle>Notifications</CardTitle>
                <CardDescription>Configure notification channels for sync events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Notifications</Label>
                    <p className="text-sm text-muted-foreground">Send notifications for sync events</p>
                  </div>
                  <Switch
                    checked={config.enableNotifications ?? true}
                    onCheckedChange={(checked) => updateConfig({ enableNotifications: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            {config.enableNotifications && (
              <>
                {/* Add Notification Channel Inline Form */}
                {showAddNotificationChannel && (
                  <Card className="border-primary mb-4">
                    <CardHeader>
                      <CardTitle>New Notification Channel</CardTitle>
                      <CardDescription>Create a new notification channel</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="channel-name">Channel Name *</Label>
                        <Input
                          id="channel-name"
                          value={newChannelName}
                          onChange={(e) => {
                            setNewChannelName(e.target.value);
                            setChannelNameError('');
                          }}
                          placeholder="slack-production"
                        />
                        {channelNameError && <p className="text-sm text-destructive">{channelNameError}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="channel-type">Channel Type</Label>
                        <Select
                          value={newChannelType}
                          onValueChange={(value: 'slack' | 'email' | 'pagerduty' | 'webhook' | 'opsgenie' | 'msteams') => {
                            setNewChannelType(value);
                            // Reset type-specific fields
                            setNewChannelUrl('');
                            setNewChannelChannel('');
                            setNewChannelRecipients([]);
                            setNewChannelServiceKey('');
                          }}
                        >
                          <SelectTrigger id="channel-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="slack">Slack</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="pagerduty">PagerDuty</SelectItem>
                            <SelectItem value="webhook">Webhook</SelectItem>
                            <SelectItem value="opsgenie">OpsGenie</SelectItem>
                            <SelectItem value="msteams">Microsoft Teams</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="channel-enabled"
                          checked={newChannelEnabled}
                          onCheckedChange={setNewChannelEnabled}
                        />
                        <Label htmlFor="channel-enabled">Enabled</Label>
                      </div>

                      {/* Type-specific configuration */}
                      {newChannelType === 'slack' && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="slack-channel">Slack Channel</Label>
                            <Input
                              id="slack-channel"
                              value={newChannelChannel}
                              onChange={(e) => setNewChannelChannel(e.target.value)}
                              placeholder="#general"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="slack-webhook-url">Webhook URL (optional)</Label>
                            <Input
                              id="slack-webhook-url"
                              value={newChannelUrl}
                              onChange={(e) => setNewChannelUrl(e.target.value)}
                              placeholder="https://hooks.slack.com/services/..."
                              type="url"
                            />
                          </div>
                        </>
                      )}

                      {newChannelType === 'email' && (
                        <div className="space-y-2">
                          <Label>Email Recipients</Label>
                          <div className="flex gap-2">
                            <Input
                              value={newRecipientEmail}
                              onChange={(e) => setNewRecipientEmail(e.target.value)}
                              placeholder="user@example.com"
                              type="email"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddRecipient();
                                }
                              }}
                            />
                            <Button type="button" size="sm" variant="outline" onClick={handleAddRecipient}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          {newChannelRecipients.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {newChannelRecipients.map((recipient, index) => (
                                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                  {recipient}
                                  <button
                                    onClick={() => setNewChannelRecipients(newChannelRecipients.filter((_, i) => i !== index))}
                                    className="ml-1 hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {newChannelType === 'pagerduty' && (
                        <div className="space-y-2">
                          <Label htmlFor="pagerduty-service-key">Service Key</Label>
                          <Input
                            id="pagerduty-service-key"
                            value={newChannelServiceKey}
                            onChange={(e) => setNewChannelServiceKey(e.target.value)}
                            placeholder="PagerDuty service integration key"
                            type="password"
                          />
                        </div>
                      )}

                      {(newChannelType === 'webhook' || newChannelType === 'opsgenie' || newChannelType === 'msteams') && (
                        <div className="space-y-2">
                          <Label htmlFor="webhook-url">Webhook URL</Label>
                          <Input
                            id="webhook-url"
                            value={newChannelUrl}
                            onChange={(e) => setNewChannelUrl(e.target.value)}
                            placeholder="https://example.com/webhook"
                            type="url"
                          />
                        </div>
                      )}

                      {/* Triggers */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Triggers</Label>
                          <Button size="sm" variant="outline" onClick={handleAddTrigger}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Trigger
                          </Button>
                        </div>
                        {newChannelTriggers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No triggers. Click "Add Trigger" to add one.</p>
                        ) : (
                          <div className="space-y-2">
                            {newChannelTriggers.map((trigger, index) => (
                              <Card key={index} className="p-3">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Event</Label>
                                    <Select
                                      value={trigger.event}
                                      onValueChange={(value) => handleUpdateTrigger(index, { event: value })}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="sync-success">Sync Success</SelectItem>
                                        <SelectItem value="sync-failed">Sync Failed</SelectItem>
                                        <SelectItem value="health-degraded">Health Degraded</SelectItem>
                                        <SelectItem value="health-progressing">Health Progressing</SelectItem>
                                        <SelectItem value="sync-running">Sync Running</SelectItem>
                                        <SelectItem value="app-created">App Created</SelectItem>
                                        <SelectItem value="app-deleted">App Deleted</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex items-end gap-2">
                                    <div className="flex-1 space-y-1">
                                      <Label className="text-xs">Condition (optional)</Label>
                                      <Input
                                        value={trigger.condition || ''}
                                        onChange={(e) => handleUpdateTrigger(index, { condition: e.target.value })}
                                        placeholder="e.g., app.name == 'prod'"
                                        className="h-8"
                                      />
                                    </div>
                                    <Button size="sm" variant="ghost" onClick={() => handleRemoveTrigger(index)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button onClick={handleAddNotificationChannel}>
                          <Save className="h-4 w-4 mr-2" />
                          Create Channel
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowAddNotificationChannel(false);
                          setNewChannelName('');
                          setNewChannelType('slack');
                          setNewChannelEnabled(true);
                          setNewChannelUrl('');
                          setNewChannelChannel('');
                          setNewChannelRecipients([]);
                          setNewChannelServiceKey('');
                          setNewChannelTriggers([]);
                          setNewRecipientEmail('');
                          setChannelNameError('');
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Edit Notification Channel Inline Form */}
                {showEditNotificationChannel && editingNotificationChannel && (
                  <Card className="border-primary mb-4">
                    <CardHeader>
                      <CardTitle>Edit Notification Channel</CardTitle>
                      <CardDescription>Update notification channel configuration</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-channel-name">Channel Name *</Label>
                        <Input
                          id="edit-channel-name"
                          value={newChannelName}
                          onChange={(e) => {
                            setNewChannelName(e.target.value);
                            setChannelNameError('');
                          }}
                          placeholder="slack-production"
                        />
                        {channelNameError && <p className="text-sm text-destructive">{channelNameError}</p>}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-channel-type">Channel Type</Label>
                        <Select
                          value={newChannelType}
                          onValueChange={(value: 'slack' | 'email' | 'pagerduty' | 'webhook' | 'opsgenie' | 'msteams') => {
                            setNewChannelType(value);
                            // Reset type-specific fields
                            setNewChannelUrl('');
                            setNewChannelChannel('');
                            setNewChannelRecipients([]);
                            setNewChannelServiceKey('');
                          }}
                        >
                          <SelectTrigger id="edit-channel-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="slack">Slack</SelectItem>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="pagerduty">PagerDuty</SelectItem>
                            <SelectItem value="webhook">Webhook</SelectItem>
                            <SelectItem value="opsgenie">OpsGenie</SelectItem>
                            <SelectItem value="msteams">Microsoft Teams</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Switch
                          id="edit-channel-enabled"
                          checked={newChannelEnabled}
                          onCheckedChange={setNewChannelEnabled}
                        />
                        <Label htmlFor="edit-channel-enabled">Enabled</Label>
                      </div>

                      {/* Type-specific configuration */}
                      {newChannelType === 'slack' && (
                        <>
                          <div className="space-y-2">
                            <Label htmlFor="edit-slack-channel">Slack Channel</Label>
                            <Input
                              id="edit-slack-channel"
                              value={newChannelChannel}
                              onChange={(e) => setNewChannelChannel(e.target.value)}
                              placeholder="#general"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-slack-webhook-url">Webhook URL (optional)</Label>
                            <Input
                              id="edit-slack-webhook-url"
                              value={newChannelUrl}
                              onChange={(e) => setNewChannelUrl(e.target.value)}
                              placeholder="https://hooks.slack.com/services/..."
                              type="url"
                            />
                          </div>
                        </>
                      )}

                      {newChannelType === 'email' && (
                        <div className="space-y-2">
                          <Label>Email Recipients</Label>
                          <div className="flex gap-2">
                            <Input
                              value={newRecipientEmail}
                              onChange={(e) => setNewRecipientEmail(e.target.value)}
                              placeholder="user@example.com"
                              type="email"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  handleAddRecipient();
                                }
                              }}
                            />
                            <Button type="button" size="sm" variant="outline" onClick={handleAddRecipient}>
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>
                          {newChannelRecipients.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2">
                              {newChannelRecipients.map((recipient, index) => (
                                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                                  {recipient}
                                  <button
                                    onClick={() => setNewChannelRecipients(newChannelRecipients.filter((_, i) => i !== index))}
                                    className="ml-1 hover:text-destructive"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {newChannelType === 'pagerduty' && (
                        <div className="space-y-2">
                          <Label htmlFor="edit-pagerduty-service-key">Service Key</Label>
                          <Input
                            id="edit-pagerduty-service-key"
                            value={newChannelServiceKey}
                            onChange={(e) => setNewChannelServiceKey(e.target.value)}
                            placeholder="PagerDuty service integration key"
                            type="password"
                          />
                        </div>
                      )}

                      {(newChannelType === 'webhook' || newChannelType === 'opsgenie' || newChannelType === 'msteams') && (
                        <div className="space-y-2">
                          <Label htmlFor="edit-webhook-url">Webhook URL</Label>
                          <Input
                            id="edit-webhook-url"
                            value={newChannelUrl}
                            onChange={(e) => setNewChannelUrl(e.target.value)}
                            placeholder="https://example.com/webhook"
                            type="url"
                          />
                        </div>
                      )}

                      {/* Triggers */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label>Triggers</Label>
                          <Button size="sm" variant="outline" onClick={handleAddTrigger}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Trigger
                          </Button>
                        </div>
                        {newChannelTriggers.length === 0 ? (
                          <p className="text-sm text-muted-foreground">No triggers. Click "Add Trigger" to add one.</p>
                        ) : (
                          <div className="space-y-2">
                            {newChannelTriggers.map((trigger, index) => (
                              <Card key={index} className="p-3">
                                <div className="grid grid-cols-2 gap-2">
                                  <div className="space-y-1">
                                    <Label className="text-xs">Event</Label>
                                    <Select
                                      value={trigger.event}
                                      onValueChange={(value) => handleUpdateTrigger(index, { event: value })}
                                    >
                                      <SelectTrigger className="h-8">
                                        <SelectValue />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="sync-success">Sync Success</SelectItem>
                                        <SelectItem value="sync-failed">Sync Failed</SelectItem>
                                        <SelectItem value="health-degraded">Health Degraded</SelectItem>
                                        <SelectItem value="health-progressing">Health Progressing</SelectItem>
                                        <SelectItem value="sync-running">Sync Running</SelectItem>
                                        <SelectItem value="app-created">App Created</SelectItem>
                                        <SelectItem value="app-deleted">App Deleted</SelectItem>
                                      </SelectContent>
                                    </Select>
                                  </div>
                                  <div className="flex items-end gap-2">
                                    <div className="flex-1 space-y-1">
                                      <Label className="text-xs">Condition (optional)</Label>
                                      <Input
                                        value={trigger.condition || ''}
                                        onChange={(e) => handleUpdateTrigger(index, { condition: e.target.value })}
                                        placeholder="e.g., app.name == 'prod'"
                                        className="h-8"
                                      />
                                    </div>
                                    <Button size="sm" variant="ghost" onClick={() => handleRemoveTrigger(index)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button onClick={handleSaveNotificationChannel}>
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowEditNotificationChannel(false);
                          setEditingNotificationChannel(null);
                          setChannelNameError('');
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Notification Channels List */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Notification Channels</CardTitle>
                        <CardDescription>Manage notification channels for sync events</CardDescription>
                      </div>
                      {!showAddNotificationChannel && !showEditNotificationChannel && (
                        <Button onClick={() => setShowAddNotificationChannel(true)}>
                          <Plus className="h-4 w-4 mr-2" />
                          New Channel
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {realNotificationChannels.length === 0 && (config.notificationChannelsConfig || []).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No notification channels configured. Create a channel to get started.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {(realNotificationChannels.length > 0 ? realNotificationChannels : (config.notificationChannelsConfig || []).map(ch => ({
                          name: ch.name,
                          type: ch.type || 'webhook',
                          enabled: ch.enabled ?? true,
                          config: ch.config || {},
                          triggers: ch.triggers || [],
                        }))).map((channel, index) => (
                          <Card key={channel.name || index} className="border-border">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div>
                                    <CardTitle className="text-lg">{channel.name}</CardTitle>
                                    <CardDescription className="text-xs mt-1 flex items-center gap-2">
                                      <Badge variant="outline">{channel.type}</Badge>
                                      {channel.enabled ? (
                                        <Badge variant="default" className="bg-green-500">Enabled</Badge>
                                      ) : (
                                        <Badge variant="secondary">Disabled</Badge>
                                      )}
                                    </CardDescription>
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleEditNotificationChannel(channel)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleDeleteNotificationChannel(channel.name)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-3">
                                {/* Channel Configuration */}
                                {channel.type === 'slack' && channel.config.channel && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Slack Channel</Label>
                                    <p className="text-sm mt-1">{channel.config.channel as string}</p>
                                  </div>
                                )}
                                {channel.type === 'email' && channel.config.recipients && Array.isArray(channel.config.recipients) && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Recipients</Label>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {(channel.config.recipients as string[]).map((recipient, rIndex) => (
                                        <Badge key={rIndex} variant="secondary">{recipient}</Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {(channel.type === 'webhook' || channel.type === 'opsgenie' || channel.type === 'msteams') && channel.config.url && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Webhook URL</Label>
                                    <p className="text-sm mt-1 font-mono text-xs break-all">{channel.config.url as string}</p>
                                  </div>
                                )}
                                {channel.type === 'pagerduty' && channel.config.serviceKey && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Service Key</Label>
                                    <p className="text-sm mt-1 font-mono text-xs">••••••••</p>
                                  </div>
                                )}
                                
                                {/* Triggers */}
                                {channel.triggers && channel.triggers.length > 0 && (
                                  <div>
                                    <Label className="text-xs text-muted-foreground">Triggers</Label>
                                    <div className="mt-1 flex flex-wrap gap-1">
                                      {channel.triggers.map((trigger, tIndex) => (
                                        <Badge key={tIndex} variant="outline">
                                          {trigger.event}
                                          {trigger.condition && (
                                            <span className="ml-1 text-xs">({trigger.condition})</span>
                                          )}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          {/* Sync Operations Tab */}
          <TabsContent value="sync-operations" className="space-y-4 mt-4">
            {/* Search and Filters */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4 items-center">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search sync operations..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={syncOpFilterStatus} onValueChange={(value: any) => setSyncOpFilterStatus(value)}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="running">Running</SelectItem>
                      <SelectItem value="success">Success</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Active Sync Operations */}
            {realSyncOperations.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Active Sync Operations</CardTitle>
                  <CardDescription>Currently running synchronization operations ({realSyncOperations.length})</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {realSyncOperations
                      .filter(op => !searchQuery || op.application.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map((op) => {
                        const app = realApplications.find(a => a.name === op.application);
                        const elapsed = Date.now() - op.startedAt;
                        const estimatedDuration = realMetrics?.averageSyncDuration || 30000;
                        const progress = Math.min(100, (elapsed / estimatedDuration) * 100);
                        
                        return (
                          <Card key={op.id} className="border-border hover:border-primary/50 transition-colors">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                  <RefreshCw className={`h-5 w-5 ${op.status === 'running' ? 'text-blue-500 animate-spin' : op.status === 'success' ? 'text-green-500' : 'text-red-500'}`} />
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <CardTitle className="text-lg">{op.application}</CardTitle>
                                      <Badge variant={op.status === 'running' ? 'default' : op.status === 'success' ? 'default' : 'destructive'}>
                                        {op.status}
                                      </Badge>
                                      {op.phase && (
                                        <Badge variant="secondary" className="text-xs">
                                          {op.phase}
                                        </Badge>
                                      )}
                                    </div>
                                    <CardDescription className="text-xs mt-1">
                                      Started {formatTimeAgo(op.startedAt)}
                                      {op.finishedAt && ` • Finished ${formatTimeAgo(op.finishedAt)}`}
                                      {op.finishedAt && op.startedAt && (
                                        ` • Duration: ${((op.finishedAt - op.startedAt) / 1000).toFixed(1)}s`
                                      )}
                                    </CardDescription>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => {
                                      setSelectedSyncOp(op.id);
                                      setShowApplicationDetails(true);
                                    }}
                                    title="View details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              {op.status === 'running' && (
                                <div className="mt-3">
                                  <div className="flex justify-between text-xs text-muted-foreground mb-1">
                                    <span>Progress</span>
                                    <span>{Math.round(progress)}%</span>
                                  </div>
                                  <Progress value={progress} className="h-2" />
                                </div>
                              )}
                              {op.error && (
                                <div className="mt-3 p-2 bg-destructive/10 border border-destructive/20 rounded text-sm text-destructive">
                                  <AlertCircle className="h-4 w-4 inline mr-2" />
                                  {op.error}
                                </div>
                              )}
                              {op.resources && op.resources.length > 0 && (
                                <div className="mt-3">
                                  <div className="text-xs text-muted-foreground mb-2">Resources:</div>
                                  <div className="space-y-1">
                                    {op.resources.slice(0, 5).map((resource, idx) => (
                                      <div key={idx} className="flex items-center gap-2 text-xs">
                                        <Badge variant={resource.status === 'synced' ? 'default' : resource.status === 'failed' ? 'destructive' : 'secondary'} className="text-xs">
                                          {resource.status}
                                        </Badge>
                                        <span className="text-muted-foreground">
                                          {resource.kind}/{resource.name}
                                          {resource.namespace && ` in ${resource.namespace}`}
                                        </span>
                                        {resource.message && (
                                          <span className="text-muted-foreground ml-auto text-xs">• {resource.message}</span>
                                        )}
                                      </div>
                                    ))}
                                    {op.resources.length > 5 && (
                                      <div className="text-xs text-muted-foreground mt-1">
                                        +{op.resources.length - 5} more resources
                                      </div>
                                    )}
                                  </div>
                                </div>
                              )}
                            </CardHeader>
                          </Card>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sync History */}
            <Card>
              <CardHeader>
                <CardTitle>Sync History</CardTitle>
                <CardDescription>Recent completed synchronization operations</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {realSyncHistory.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No sync history available</p>
                      <p className="text-sm mt-2">Sync operations will appear here after completion</p>
                    </div>
                  ) : (
                    realSyncHistory
                      .filter(h => {
                        if (syncOpFilterStatus === 'all') return true;
                        if (syncOpFilterStatus === 'success') return h.status === 'success';
                        if (syncOpFilterStatus === 'failed') return h.status === 'failed';
                        return false;
                      })
                      .filter(h => !searchQuery || (h.application && h.application.toLowerCase().includes(searchQuery.toLowerCase())))
                      .slice(0, 50)
                      .map((historyItem, index) => (
                        <Card key={historyItem.operationId || index} className="border-border">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {historyItem.status === 'success' ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                                ) : (
                                  <XCircle className="h-4 w-4 text-red-500" />
                                )}
                                <div>
                                  <CardTitle className="text-base">
                                    {historyItem.application || 'Unknown Application'}
                                  </CardTitle>
                                  <CardDescription className="text-xs mt-1">
                                    Completed {formatTimeAgo(historyItem.timestamp)} • Duration: {(historyItem.duration / 1000).toFixed(1)}s
                                  </CardDescription>
                                </div>
                              </div>
                              <Badge variant={historyItem.status === 'success' ? 'default' : 'destructive'}>
                                {historyItem.status}
                              </Badge>
                            </div>
                          </CardHeader>
                        </Card>
                      ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Sync Windows Tab */}
          <TabsContent value="sync-windows" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Sync Windows</CardTitle>
                <CardDescription>
                  Configure time windows to allow or deny synchronization operations. Use "HH:MM-HH:MM" format for daily windows or cron expressions for complex schedules.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Add Sync Window Button */}
                {!showAddSyncWindow && !showEditSyncWindow && (
                  <Button 
                    onClick={() => {
                      setShowAddSyncWindow(true);
                      setNewSyncWindowName('');
                      setNewSyncWindowDescription('');
                      setNewSyncWindowSchedule('09:00-17:00');
                      setNewSyncWindowDuration(undefined);
                      setNewSyncWindowKind('deny');
                      setNewSyncWindowApplications([]);
                      setNewSyncWindowProjects([]);
                      setNewSyncWindowManualSync(false);
                      setNewSyncWindowEnabled(true);
                      setSyncWindowNameError('');
                      setSyncWindowScheduleError('');
                    }}
                    className="mb-4"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Sync Window
                  </Button>
                )}

                {/* Add Sync Window Inline Form */}
                {showAddSyncWindow && (
                  <Card className="border-primary mb-4">
                    <CardHeader>
                      <CardTitle>New Sync Window</CardTitle>
                      <CardDescription>Configure a new sync window to control when synchronizations are allowed or denied</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="sync-window-name">Name *</Label>
                        <Input
                          id="sync-window-name"
                          value={newSyncWindowName}
                          onChange={(e) => {
                            setNewSyncWindowName(e.target.value);
                            setSyncWindowNameError('');
                          }}
                          placeholder="e.g., business-hours"
                          className={syncWindowNameError ? 'border-destructive' : ''}
                        />
                        {syncWindowNameError && (
                          <p className="text-sm text-destructive">{syncWindowNameError}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="sync-window-description">Description</Label>
                        <Textarea
                          id="sync-window-description"
                          value={newSyncWindowDescription}
                          onChange={(e) => setNewSyncWindowDescription(e.target.value)}
                          placeholder="Optional description"
                          rows={2}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="sync-window-schedule">Schedule *</Label>
                        <Input
                          id="sync-window-schedule"
                          value={newSyncWindowSchedule}
                          onChange={(e) => {
                            setNewSyncWindowSchedule(e.target.value);
                            setSyncWindowScheduleError('');
                          }}
                          placeholder='e.g., "09:00-17:00" or "0 9 * * 1-5"'
                          className={syncWindowScheduleError ? 'border-destructive' : ''}
                        />
                        {syncWindowScheduleError && (
                          <p className="text-sm text-destructive">{syncWindowScheduleError}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Use "HH:MM-HH:MM" for daily windows (e.g., "09:00-17:00") or cron expression (e.g., "0 9 * * 1-5" for weekdays at 9 AM)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="sync-window-duration">Duration (minutes, optional)</Label>
                        <Input
                          id="sync-window-duration"
                          type="number"
                          value={newSyncWindowDuration || ''}
                          onChange={(e) => setNewSyncWindowDuration(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                          placeholder="e.g., 480 (for 8 hours)"
                          min="1"
                        />
                        <p className="text-xs text-muted-foreground">
                          Duration in minutes (only used with cron expressions)
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="sync-window-kind">Kind</Label>
                        <Select
                          value={newSyncWindowKind}
                          onValueChange={(value: 'allow' | 'deny') => setNewSyncWindowKind(value)}
                        >
                          <SelectTrigger id="sync-window-kind">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="deny">Deny (block sync in window)</SelectItem>
                            <SelectItem value="allow">Allow (only allow sync in window)</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                          Deny: Blocks sync during the window. Allow: Only allows sync during the window.
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Label>Applications (leave empty for all)</Label>
                        <div className="flex gap-2">
                          <Select
                            value=""
                            onValueChange={(value) => {
                              if (value && !newSyncWindowApplications.includes(value)) {
                                setNewSyncWindowApplications([...newSyncWindowApplications, value]);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select application" />
                            </SelectTrigger>
                            <SelectContent>
                              {realApplications.map(app => (
                                <SelectItem key={app.name} value={app.name}>{app.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {newSyncWindowApplications.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {newSyncWindowApplications.map(appName => (
                              <Badge key={appName} variant="secondary" className="flex items-center gap-1">
                                {appName}
                                <X
                                  className="h-3 w-3 cursor-pointer"
                                  onClick={() => setNewSyncWindowApplications(newSyncWindowApplications.filter(a => a !== appName))}
                                />
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Projects (leave empty for all)</Label>
                        <div className="flex gap-2">
                          <Select
                            value=""
                            onValueChange={(value) => {
                              if (value && !newSyncWindowProjects.includes(value)) {
                                setNewSyncWindowProjects([...newSyncWindowProjects, value]);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select project" />
                            </SelectTrigger>
                            <SelectContent>
                              {realProjects.map(project => (
                                <SelectItem key={project.name} value={project.name}>{project.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {newSyncWindowProjects.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {newSyncWindowProjects.map(projectName => (
                              <Badge key={projectName} variant="secondary" className="flex items-center gap-1">
                                {projectName}
                                <X
                                  className="h-3 w-3 cursor-pointer"
                                  onClick={() => setNewSyncWindowProjects(newSyncWindowProjects.filter(p => p !== projectName))}
                                />
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="sync-window-manual-sync"
                          checked={newSyncWindowManualSync}
                          onCheckedChange={setNewSyncWindowManualSync}
                        />
                        <Label htmlFor="sync-window-manual-sync" className="cursor-pointer">
                          Allow manual sync during window
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="sync-window-enabled"
                          checked={newSyncWindowEnabled}
                          onCheckedChange={setNewSyncWindowEnabled}
                        />
                        <Label htmlFor="sync-window-enabled" className="cursor-pointer">
                          Enabled
                        </Label>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button onClick={handleAddSyncWindow}>
                          <Save className="h-4 w-4 mr-2" />
                          Create Sync Window
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowAddSyncWindow(false);
                          setNewSyncWindowName('');
                          setNewSyncWindowDescription('');
                          setNewSyncWindowSchedule('09:00-17:00');
                          setNewSyncWindowDuration(undefined);
                          setNewSyncWindowKind('deny');
                          setNewSyncWindowApplications([]);
                          setNewSyncWindowProjects([]);
                          setNewSyncWindowManualSync(false);
                          setNewSyncWindowEnabled(true);
                          setSyncWindowNameError('');
                          setSyncWindowScheduleError('');
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Edit Sync Window Inline Form */}
                {showEditSyncWindow && editingSyncWindow && (
                  <Card className="border-primary mb-4">
                    <CardHeader>
                      <CardTitle>Edit Sync Window</CardTitle>
                      <CardDescription>Update sync window configuration</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <Label>Name</Label>
                        <Input value={editingSyncWindow.name} disabled />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-sync-window-description">Description</Label>
                        <Textarea
                          id="edit-sync-window-description"
                          value={newSyncWindowDescription}
                          onChange={(e) => setNewSyncWindowDescription(e.target.value)}
                          placeholder="Optional description"
                          rows={2}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-sync-window-schedule">Schedule *</Label>
                        <Input
                          id="edit-sync-window-schedule"
                          value={newSyncWindowSchedule}
                          onChange={(e) => {
                            setNewSyncWindowSchedule(e.target.value);
                            setSyncWindowScheduleError('');
                          }}
                          placeholder='e.g., "09:00-17:00" or "0 9 * * 1-5"'
                          className={syncWindowScheduleError ? 'border-destructive' : ''}
                        />
                        {syncWindowScheduleError && (
                          <p className="text-sm text-destructive">{syncWindowScheduleError}</p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-sync-window-duration">Duration (minutes, optional)</Label>
                        <Input
                          id="edit-sync-window-duration"
                          type="number"
                          value={newSyncWindowDuration || ''}
                          onChange={(e) => setNewSyncWindowDuration(e.target.value ? parseInt(e.target.value, 10) : undefined)}
                          placeholder="e.g., 480"
                          min="1"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="edit-sync-window-kind">Kind</Label>
                        <Select
                          value={newSyncWindowKind}
                          onValueChange={(value: 'allow' | 'deny') => setNewSyncWindowKind(value)}
                        >
                          <SelectTrigger id="edit-sync-window-kind">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="deny">Deny (block sync in window)</SelectItem>
                            <SelectItem value="allow">Allow (only allow sync in window)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label>Applications (leave empty for all)</Label>
                        <div className="flex gap-2">
                          <Select
                            value=""
                            onValueChange={(value) => {
                              if (value && !newSyncWindowApplications.includes(value)) {
                                setNewSyncWindowApplications([...newSyncWindowApplications, value]);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select application" />
                            </SelectTrigger>
                            <SelectContent>
                              {realApplications.map(app => (
                                <SelectItem key={app.name} value={app.name}>{app.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {newSyncWindowApplications.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {newSyncWindowApplications.map(appName => (
                              <Badge key={appName} variant="secondary" className="flex items-center gap-1">
                                {appName}
                                <X
                                  className="h-3 w-3 cursor-pointer"
                                  onClick={() => setNewSyncWindowApplications(newSyncWindowApplications.filter(a => a !== appName))}
                                />
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Projects (leave empty for all)</Label>
                        <div className="flex gap-2">
                          <Select
                            value=""
                            onValueChange={(value) => {
                              if (value && !newSyncWindowProjects.includes(value)) {
                                setNewSyncWindowProjects([...newSyncWindowProjects, value]);
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select project" />
                            </SelectTrigger>
                            <SelectContent>
                              {realProjects.map(project => (
                                <SelectItem key={project.name} value={project.name}>{project.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        {newSyncWindowProjects.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {newSyncWindowProjects.map(projectName => (
                              <Badge key={projectName} variant="secondary" className="flex items-center gap-1">
                                {projectName}
                                <X
                                  className="h-3 w-3 cursor-pointer"
                                  onClick={() => setNewSyncWindowProjects(newSyncWindowProjects.filter(p => p !== projectName))}
                                />
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="edit-sync-window-manual-sync"
                          checked={newSyncWindowManualSync}
                          onCheckedChange={setNewSyncWindowManualSync}
                        />
                        <Label htmlFor="edit-sync-window-manual-sync" className="cursor-pointer">
                          Allow manual sync during window
                        </Label>
                      </div>

                      <div className="flex items-center space-x-2">
                        <Switch
                          id="edit-sync-window-enabled"
                          checked={newSyncWindowEnabled}
                          onCheckedChange={setNewSyncWindowEnabled}
                        />
                        <Label htmlFor="edit-sync-window-enabled" className="cursor-pointer">
                          Enabled
                        </Label>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button onClick={handleUpdateSyncWindow}>
                          <Save className="h-4 w-4 mr-2" />
                          Update Sync Window
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowEditSyncWindow(false);
                          setEditingSyncWindow(null);
                          setNewSyncWindowName('');
                          setNewSyncWindowDescription('');
                          setNewSyncWindowSchedule('09:00-17:00');
                          setNewSyncWindowDuration(undefined);
                          setNewSyncWindowKind('deny');
                          setNewSyncWindowApplications([]);
                          setNewSyncWindowProjects([]);
                          setNewSyncWindowManualSync(false);
                          setNewSyncWindowEnabled(true);
                          setSyncWindowScheduleError('');
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Sync Windows List */}
                <div className="space-y-3">
                  {realSyncWindows.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No sync windows configured</p>
                      <p className="text-sm mt-2">Create a sync window to control when synchronizations are allowed or denied</p>
                    </div>
                  ) : (
                    realSyncWindows.map(syncWindow => (
                      <Card key={syncWindow.name} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <CardTitle className="text-base">{syncWindow.name}</CardTitle>
                                {syncWindow.enabled ? (
                                  <Badge variant="default" className="bg-green-500">Enabled</Badge>
                                ) : (
                                  <Badge variant="secondary">Disabled</Badge>
                                )}
                                <Badge variant={syncWindow.kind === 'deny' ? 'destructive' : 'default'}>
                                  {syncWindow.kind === 'deny' ? 'Deny' : 'Allow'}
                                </Badge>
                              </div>
                              {syncWindow.description && (
                                <CardDescription className="mt-1">{syncWindow.description}</CardDescription>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditSyncWindow(syncWindow)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteSyncWindow(syncWindow.name)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2">
                              <Clock className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">Schedule:</span>
                              <code className="text-xs bg-muted px-2 py-1 rounded">{syncWindow.schedule}</code>
                              {syncWindow.duration && (
                                <span className="text-muted-foreground">
                                  ({syncWindow.duration} minutes)
                                </span>
                              )}
                            </div>
                            {(syncWindow.applications && syncWindow.applications.length > 0) && (
                              <div className="flex items-center gap-2">
                                <Rocket className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">Applications:</span>
                                <div className="flex flex-wrap gap-1">
                                  {syncWindow.applications.map(appName => (
                                    <Badge key={appName} variant="outline" className="text-xs">{appName}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(syncWindow.projects && syncWindow.projects.length > 0) && (
                              <div className="flex items-center gap-2">
                                <FolderGit2 className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">Projects:</span>
                                <div className="flex flex-wrap gap-1">
                                  {syncWindow.projects.map(projectName => (
                                    <Badge key={projectName} variant="outline" className="text-xs">{projectName}</Badge>
                                  ))}
                                </div>
                              </div>
                            )}
                            {syncWindow.manualSync && (
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Manual sync allowed during window</span>
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metrics Tab */}
          <TabsContent value="metrics" className="space-y-4 mt-4">
            {/* Sync Rate Over Time Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Sync Rate Over Time</CardTitle>
                <CardDescription>
                  Number of sync operations per hour over the last 24 hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                {syncRateChartData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No sync history available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={syncRateChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Area 
                        type="monotone" 
                        dataKey="syncs" 
                        stroke="#8884d8" 
                        fill="#8884d8" 
                        fillOpacity={0.6}
                        name="Syncs per hour"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Sync Duration Over Time Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Sync Duration Over Time</CardTitle>
                <CardDescription>
                  Average sync duration (in seconds) over the last 24 hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                {syncDurationChartData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No sync history available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={syncDurationChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis label={{ value: 'Duration (seconds)', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <Legend />
                      <Line 
                        type="monotone" 
                        dataKey="duration" 
                        stroke="#82ca9d" 
                        strokeWidth={2}
                        name="Avg duration (s)"
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Health Status Distribution Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Health Status Distribution</CardTitle>
                <CardDescription>
                  Current distribution of application health statuses
                </CardDescription>
              </CardHeader>
              <CardContent>
                {healthStatusChartData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No applications available
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={healthStatusChartData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {healthStatusChartData.map((entry, index) => {
                          const COLORS: Record<string, string> = {
                            Healthy: '#22c55e',
                            Degraded: '#ef4444',
                            Progressing: '#3b82f6',
                            Suspended: '#6b7280',
                            Missing: '#f59e0b',
                            Unknown: '#9ca3af'
                          };
                          return (
                            <Cell key={`cell-${index}`} fill={COLORS[entry.name] || '#9ca3af'} />
                          );
                        })}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            {/* Sync Success Rate Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Sync Success Rate</CardTitle>
                <CardDescription>
                  Success vs failed sync operations over the last 24 hours
                </CardDescription>
              </CardHeader>
              <CardContent>
                {syncSuccessRateChartData.length === 0 ? (
                  <div className="h-64 flex items-center justify-center text-muted-foreground">
                    No sync operations in the last 24 hours
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={syncSuccessRateChartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill="#8884d8">
                        {syncSuccessRateChartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Application Sets Tab */}
          <TabsContent value="application-sets" className="space-y-4 mt-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Application Sets</CardTitle>
                    <CardDescription>Generate multiple applications from templates using generators</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowAddApplicationSet(true)} variant="default">
                    <Plus className="h-4 w-4 mr-2" />
                    New Application Set
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {/* Add Application Set Inline Form */}
                {showAddApplicationSet && (
                  <Card className="border-primary mb-4">
                    <CardHeader>
                      <CardTitle>New Application Set</CardTitle>
                      <CardDescription>Create a new ApplicationSet to generate multiple applications</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="appset-name">Application Set Name *</Label>
                          <Input
                            id="appset-name"
                            value={newAppSetName}
                            onChange={(e) => {
                              setNewAppSetName(e.target.value);
                              setAppSetNameError('');
                            }}
                            placeholder="my-appset"
                          />
                          {appSetNameError && <p className="text-sm text-destructive">{appSetNameError}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="appset-namespace">Namespace</Label>
                          <Input
                            id="appset-namespace"
                            value={newAppSetNamespace}
                            onChange={(e) => setNewAppSetNamespace(e.target.value)}
                            placeholder="default"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Generators</Label>
                        <div className="space-y-2">
                          {newAppSetGenerators.map((gen, idx) => (
                            <Card key={idx} className="border-border">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary">{gen.type}</Badge>
                                    {gen.type === 'list' && (
                                      <span className="text-sm text-muted-foreground">
                                        {gen.elements?.length || 0} elements
                                      </span>
                                    )}
                                    {gen.type === 'git' && (
                                      <span className="text-sm text-muted-foreground">
                                        {gen.repoURL || 'No repo URL'}
                                      </span>
                                    )}
                                    {gen.type === 'cluster' && (
                                      <span className="text-sm text-muted-foreground">
                                        Cluster Generator
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => toggleGeneratorExpanded(idx)}
                                    >
                                      {expandedGenerators.has(idx) ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeGenerator(idx)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>
                              {expandedGenerators.has(idx) && (
                                <CardContent className="space-y-4 pt-0">
                                  {/* List Generator */}
                                  {gen.type === 'list' && (
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <Label>List Elements</Label>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => addListElement(idx)}
                                        >
                                          <Plus className="h-4 w-4 mr-1" />
                                          Add Element
                                        </Button>
                                      </div>
                                      {gen.elements && gen.elements.length > 0 ? (
                                        <div className="space-y-2">
                                          {gen.elements.map((elem, elemIdx) => (
                                            <Card key={elemIdx} className="p-3 border-border">
                                              <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                  <Label className="text-xs">Key</Label>
                                                  <Input
                                                    className="h-8"
                                                    value={Object.keys(elem)[0] || ''}
                                                    onChange={(e) => {
                                                      const oldKey = Object.keys(elem)[0];
                                                      const newElem: Record<string, string> = {};
                                                      newElem[e.target.value] = elem[oldKey] || '';
                                                      updateListElement(idx, elemIdx, e.target.value, elem[oldKey] || '');
                                                    }}
                                                    placeholder="key"
                                                  />
                                                </div>
                                                <div className="space-y-1">
                                                  <Label className="text-xs">Value</Label>
                                                  <div className="flex gap-1">
                                                    <Input
                                                      className="h-8"
                                                      value={Object.values(elem)[0] || ''}
                                                      onChange={(e) => {
                                                        const key = Object.keys(elem)[0];
                                                        updateListElement(idx, elemIdx, key, e.target.value);
                                                      }}
                                                      placeholder="value"
                                                      className="flex-1"
                                                    />
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      onClick={() => removeListElement(idx, elemIdx)}
                                                    >
                                                      <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                  </div>
                                                </div>
                                              </div>
                                            </Card>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-sm text-muted-foreground">No elements. Click "Add Element" to add one.</p>
                                      )}
                                    </div>
                                  )}

                                  {/* Git Generator */}
                                  {gen.type === 'git' && (
                                    <div className="space-y-3">
                                      <div className="space-y-2">
                                        <Label htmlFor={`git-repo-${idx}`}>Repository URL *</Label>
                                        <Input
                                          id={`git-repo-${idx}`}
                                          value={gen.repoURL || ''}
                                          onChange={(e) => updateGenerator(idx, { repoURL: e.target.value })}
                                          placeholder="https://github.com/example/repo"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor={`git-revision-${idx}`}>Revision</Label>
                                        <Input
                                          id={`git-revision-${idx}`}
                                          value={gen.revision || ''}
                                          onChange={(e) => updateGenerator(idx, { revision: e.target.value })}
                                          placeholder="main"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <Label>Directories</Label>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => addGitDirectory(idx)}
                                          >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Add Directory
                                          </Button>
                                        </div>
                                        {gen.directories && gen.directories.length > 0 ? (
                                          <div className="space-y-2">
                                            {gen.directories.map((dir, dirIdx) => (
                                              <Card key={dirIdx} className="p-2 border-border">
                                                <div className="flex gap-2 items-end">
                                                  <div className="flex-1 space-y-1">
                                                    <Label className="text-xs">Path</Label>
                                                    <Input
                                                      className="h-8"
                                                      value={dir.path}
                                                      onChange={(e) => updateGitDirectory(idx, dirIdx, { path: e.target.value })}
                                                      placeholder="./apps"
                                                    />
                                                  </div>
                                                  <div className="flex items-center space-x-2">
                                                    <Switch
                                                      checked={dir.exclude || false}
                                                      onCheckedChange={(checked) => updateGitDirectory(idx, dirIdx, { exclude: checked })}
                                                    />
                                                    <Label className="text-xs">Exclude</Label>
                                                  </div>
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => removeGitDirectory(idx, dirIdx)}
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              </Card>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-muted-foreground">No directories. Click "Add Directory" to add one.</p>
                                        )}
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <Label>Files</Label>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => addGitFile(idx)}
                                          >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Add File
                                          </Button>
                                        </div>
                                        {gen.files && gen.files.length > 0 ? (
                                          <div className="space-y-2">
                                            {gen.files.map((file, fileIdx) => (
                                              <Card key={fileIdx} className="p-2 border-border">
                                                <div className="flex gap-2 items-end">
                                                  <div className="flex-1 space-y-1">
                                                    <Label className="text-xs">Path</Label>
                                                    <Input
                                                      className="h-8"
                                                      value={file.path}
                                                      onChange={(e) => updateGitFile(idx, fileIdx, e.target.value)}
                                                      placeholder="./values.yaml"
                                                    />
                                                  </div>
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => removeGitFile(idx, fileIdx)}
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              </Card>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-muted-foreground">No files. Click "Add File" to add one.</p>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Cluster Generator */}
                                  {gen.type === 'cluster' && (
                                    <div className="space-y-3">
                                      <div className="space-y-2">
                                        <Label>Selector (Match Labels)</Label>
                                        <div className="space-y-2">
                                          {gen.selector?.matchLabels && Object.keys(gen.selector.matchLabels).length > 0 ? (
                                            Object.entries(gen.selector.matchLabels).map(([key, value], labelIdx) => (
                                              <Card key={labelIdx} className="p-2 border-border">
                                                <div className="grid grid-cols-2 gap-2">
                                                  <Input
                                                    className="h-8"
                                                    value={key}
                                                    onChange={(e) => {
                                                      const updated = { ...gen.selector?.matchLabels };
                                                      delete updated[key];
                                                      updated[e.target.value] = value;
                                                      updateGenerator(idx, {
                                                        selector: { ...gen.selector, matchLabels: updated }
                                                      });
                                                    }}
                                                    placeholder="label key"
                                                  />
                                                  <div className="flex gap-1">
                                                    <Input
                                                      className="h-8"
                                                      value={value}
                                                      onChange={(e) => {
                                                        updateGenerator(idx, {
                                                          selector: {
                                                            ...gen.selector,
                                                            matchLabels: { ...gen.selector?.matchLabels, [key]: e.target.value }
                                                          }
                                                        });
                                                      }}
                                                      placeholder="label value"
                                                      className="flex-1"
                                                    />
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      onClick={() => {
                                                        const updated = { ...gen.selector?.matchLabels };
                                                        delete updated[key];
                                                        updateGenerator(idx, {
                                                          selector: { ...gen.selector, matchLabels: updated }
                                                        });
                                                      }}
                                                    >
                                                      <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                  </div>
                                                </div>
                                              </Card>
                                            ))
                                          ) : (
                                            <p className="text-sm text-muted-foreground">No labels. Add labels below.</p>
                                          )}
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              updateGenerator(idx, {
                                                selector: {
                                                  ...gen.selector,
                                                  matchLabels: { ...gen.selector?.matchLabels, '': '' }
                                                }
                                              });
                                            }}
                                          >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Add Label
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Values</Label>
                                        <div className="space-y-2">
                                          {gen.values && Object.keys(gen.values).length > 0 ? (
                                            Object.entries(gen.values).map(([key, value], valueIdx) => (
                                              <Card key={valueIdx} className="p-2 border-border">
                                                <div className="grid grid-cols-2 gap-2">
                                                  <Input
                                                    className="h-8"
                                                    value={key}
                                                    onChange={(e) => {
                                                      const updated = { ...gen.values };
                                                      delete updated[key];
                                                      updated[e.target.value] = value;
                                                      updateGenerator(idx, { values: updated });
                                                    }}
                                                    placeholder="key"
                                                  />
                                                  <div className="flex gap-1">
                                                    <Input
                                                      className="h-8"
                                                      value={value}
                                                      onChange={(e) => {
                                                        updateGenerator(idx, {
                                                          values: { ...gen.values, [key]: e.target.value }
                                                        });
                                                      }}
                                                      placeholder="value"
                                                      className="flex-1"
                                                    />
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      onClick={() => {
                                                        const updated = { ...gen.values };
                                                        delete updated[key];
                                                        updateGenerator(idx, { values: updated });
                                                      }}
                                                    >
                                                      <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                  </div>
                                                </div>
                                              </Card>
                                            ))
                                          ) : (
                                            <p className="text-sm text-muted-foreground">No values. Add values below.</p>
                                          )}
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              updateGenerator(idx, {
                                                values: { ...gen.values, '': '' }
                                              });
                                            }}
                                          >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Add Value
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              )}
                            </Card>
                          ))}
                          {showAddGeneratorType === null ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowAddGeneratorType(newAppSetGenerators.length)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Generator
                            </Button>
                          ) : (
                            <Card className="border-primary p-3">
                              <div className="space-y-2">
                                <Label>Select Generator Type</Label>
                                <div className="grid grid-cols-3 gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => addGenerator('list')}
                                  >
                                    List
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => addGenerator('git')}
                                  >
                                    Git
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => addGenerator('cluster')}
                                  >
                                    Cluster
                                  </Button>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowAddGeneratorType(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </Card>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Template</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="template-name">Application Name Template</Label>
                            <Input
                              id="template-name"
                              value={newAppSetTemplate.name || ''}
                              onChange={(e) => setNewAppSetTemplate({ ...newAppSetTemplate, name: e.target.value })}
                              placeholder="{{name}}"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="template-project">Project</Label>
                            <Input
                              id="template-project"
                              value={newAppSetTemplate.project || ''}
                              onChange={(e) => setNewAppSetTemplate({ ...newAppSetTemplate, project: e.target.value })}
                              placeholder="default"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="template-repo">Repository</Label>
                            <Input
                              id="template-repo"
                              value={newAppSetTemplate.repository || ''}
                              onChange={(e) => setNewAppSetTemplate({ ...newAppSetTemplate, repository: e.target.value })}
                              placeholder="https://github.com/example/repo"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="template-path">Path</Label>
                            <Input
                              id="template-path"
                              value={newAppSetTemplate.path || ''}
                              onChange={(e) => setNewAppSetTemplate({ ...newAppSetTemplate, path: e.target.value })}
                              placeholder="./manifests"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="template-revision">Target Revision</Label>
                            <Input
                              id="template-revision"
                              value={newAppSetTemplate.targetRevision || ''}
                              onChange={(e) => setNewAppSetTemplate({ ...newAppSetTemplate, targetRevision: e.target.value })}
                              placeholder="main"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="template-dest-namespace">Destination Namespace</Label>
                            <Input
                              id="template-dest-namespace"
                              value={newAppSetTemplate.destination?.namespace || ''}
                              onChange={(e) => setNewAppSetTemplate({ 
                                ...newAppSetTemplate, 
                                destination: { ...newAppSetTemplate.destination, namespace: e.target.value }
                              })}
                              placeholder="default"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="appset-sync-policy">Sync Policy</Label>
                          <Select
                            value={newAppSetSyncPolicy}
                            onValueChange={(value: 'automated' | 'manual' | 'sync-window') => setNewAppSetSyncPolicy(value)}
                          >
                            <SelectTrigger id="appset-sync-policy">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manual">Manual</SelectItem>
                              <SelectItem value="automated">Automated</SelectItem>
                              <SelectItem value="sync-window">Sync Window</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Options</Label>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="appset-preserve-resources"
                                checked={newAppSetPreserveResources}
                                onCheckedChange={setNewAppSetPreserveResources}
                              />
                              <Label htmlFor="appset-preserve-resources" className="cursor-pointer">
                                Preserve Resources on Deletion
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="appset-go-template"
                                checked={newAppSetGoTemplate}
                                onCheckedChange={setNewAppSetGoTemplate}
                              />
                              <Label htmlFor="appset-go-template" className="cursor-pointer">
                                Use Go Templates
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="appset-enabled"
                                checked={newAppSetEnabled}
                                onCheckedChange={setNewAppSetEnabled}
                              />
                              <Label htmlFor="appset-enabled" className="cursor-pointer">
                                Enabled
                              </Label>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button onClick={handleAddApplicationSet}>
                          <Save className="h-4 w-4 mr-2" />
                          Create Application Set
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowAddApplicationSet(false);
                          setNewAppSetName('');
                          setNewAppSetNamespace('default');
                          setNewAppSetEnabled(true);
                          setNewAppSetSyncPolicy('manual');
                          setNewAppSetPreserveResources(false);
                          setNewAppSetGoTemplate(false);
                          setNewAppSetGenerators([]);
                          setNewAppSetTemplate({});
                          setAppSetNameError('');
                          setExpandedGenerators(new Set());
                          setShowAddGeneratorType(null);
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Edit Application Set Inline Form */}
                {showEditApplicationSet && editingApplicationSet && (
                  <Card className="border-primary mb-4">
                    <CardHeader>
                      <CardTitle>Edit Application Set</CardTitle>
                      <CardDescription>Update ApplicationSet configuration</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-appset-name">Application Set Name *</Label>
                          <Input
                            id="edit-appset-name"
                            value={newAppSetName}
                            onChange={(e) => {
                              setNewAppSetName(e.target.value);
                              setAppSetNameError('');
                            }}
                            placeholder="my-appset"
                          />
                          {appSetNameError && <p className="text-sm text-destructive">{appSetNameError}</p>}
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit-appset-namespace">Namespace</Label>
                          <Input
                            id="edit-appset-namespace"
                            value={newAppSetNamespace}
                            onChange={(e) => setNewAppSetNamespace(e.target.value)}
                            placeholder="default"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Generators</Label>
                        <div className="space-y-2">
                          {newAppSetGenerators.map((gen, idx) => (
                            <Card key={idx} className="border-border">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="secondary">{gen.type}</Badge>
                                    {gen.type === 'list' && (
                                      <span className="text-sm text-muted-foreground">
                                        {gen.elements?.length || 0} elements
                                      </span>
                                    )}
                                    {gen.type === 'git' && (
                                      <span className="text-sm text-muted-foreground">
                                        {gen.repoURL || 'No repo URL'}
                                      </span>
                                    )}
                                    {gen.type === 'cluster' && (
                                      <span className="text-sm text-muted-foreground">
                                        Cluster Generator
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => toggleGeneratorExpanded(idx)}
                                    >
                                      {expandedGenerators.has(idx) ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => removeGenerator(idx)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </CardHeader>
                              {expandedGenerators.has(idx) && (
                                <CardContent className="space-y-4 pt-0">
                                  {/* List Generator */}
                                  {gen.type === 'list' && (
                                    <div className="space-y-3">
                                      <div className="flex items-center justify-between">
                                        <Label>List Elements</Label>
                                        <Button
                                          type="button"
                                          size="sm"
                                          variant="outline"
                                          onClick={() => addListElement(idx)}
                                        >
                                          <Plus className="h-4 w-4 mr-1" />
                                          Add Element
                                        </Button>
                                      </div>
                                      {gen.elements && gen.elements.length > 0 ? (
                                        <div className="space-y-2">
                                          {gen.elements.map((elem, elemIdx) => (
                                            <Card key={elemIdx} className="p-3 border-border">
                                              <div className="grid grid-cols-2 gap-2">
                                                <div className="space-y-1">
                                                  <Label className="text-xs">Key</Label>
                                                  <Input
                                                    className="h-8"
                                                    value={Object.keys(elem)[0] || ''}
                                                    onChange={(e) => {
                                                      const oldKey = Object.keys(elem)[0];
                                                      const newElem: Record<string, string> = {};
                                                      newElem[e.target.value] = elem[oldKey] || '';
                                                      updateListElement(idx, elemIdx, e.target.value, elem[oldKey] || '');
                                                    }}
                                                    placeholder="key"
                                                  />
                                                </div>
                                                <div className="space-y-1">
                                                  <Label className="text-xs">Value</Label>
                                                  <div className="flex gap-1">
                                                    <Input
                                                      className="h-8"
                                                      value={Object.values(elem)[0] || ''}
                                                      onChange={(e) => {
                                                        const key = Object.keys(elem)[0];
                                                        updateListElement(idx, elemIdx, key, e.target.value);
                                                      }}
                                                      placeholder="value"
                                                      className="flex-1"
                                                    />
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      onClick={() => removeListElement(idx, elemIdx)}
                                                    >
                                                      <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                  </div>
                                                </div>
                                              </div>
                                            </Card>
                                          ))}
                                        </div>
                                      ) : (
                                        <p className="text-sm text-muted-foreground">No elements. Click "Add Element" to add one.</p>
                                      )}
                                    </div>
                                  )}

                                  {/* Git Generator */}
                                  {gen.type === 'git' && (
                                    <div className="space-y-3">
                                      <div className="space-y-2">
                                        <Label htmlFor={`edit-git-repo-${idx}`}>Repository URL *</Label>
                                        <Input
                                          id={`edit-git-repo-${idx}`}
                                          value={gen.repoURL || ''}
                                          onChange={(e) => updateGenerator(idx, { repoURL: e.target.value })}
                                          placeholder="https://github.com/example/repo"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor={`edit-git-revision-${idx}`}>Revision</Label>
                                        <Input
                                          id={`edit-git-revision-${idx}`}
                                          value={gen.revision || ''}
                                          onChange={(e) => updateGenerator(idx, { revision: e.target.value })}
                                          placeholder="main"
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <Label>Directories</Label>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => addGitDirectory(idx)}
                                          >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Add Directory
                                          </Button>
                                        </div>
                                        {gen.directories && gen.directories.length > 0 ? (
                                          <div className="space-y-2">
                                            {gen.directories.map((dir, dirIdx) => (
                                              <Card key={dirIdx} className="p-2 border-border">
                                                <div className="flex gap-2 items-end">
                                                  <div className="flex-1 space-y-1">
                                                    <Label className="text-xs">Path</Label>
                                                    <Input
                                                      className="h-8"
                                                      value={dir.path}
                                                      onChange={(e) => updateGitDirectory(idx, dirIdx, { path: e.target.value })}
                                                      placeholder="./apps"
                                                    />
                                                  </div>
                                                  <div className="flex items-center space-x-2">
                                                    <Switch
                                                      checked={dir.exclude || false}
                                                      onCheckedChange={(checked) => updateGitDirectory(idx, dirIdx, { exclude: checked })}
                                                    />
                                                    <Label className="text-xs">Exclude</Label>
                                                  </div>
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => removeGitDirectory(idx, dirIdx)}
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              </Card>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-muted-foreground">No directories. Click "Add Directory" to add one.</p>
                                        )}
                                      </div>
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <Label>Files</Label>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => addGitFile(idx)}
                                          >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Add File
                                          </Button>
                                        </div>
                                        {gen.files && gen.files.length > 0 ? (
                                          <div className="space-y-2">
                                            {gen.files.map((file, fileIdx) => (
                                              <Card key={fileIdx} className="p-2 border-border">
                                                <div className="flex gap-2 items-end">
                                                  <div className="flex-1 space-y-1">
                                                    <Label className="text-xs">Path</Label>
                                                    <Input
                                                      className="h-8"
                                                      value={file.path}
                                                      onChange={(e) => updateGitFile(idx, fileIdx, e.target.value)}
                                                      placeholder="./values.yaml"
                                                    />
                                                  </div>
                                                  <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => removeGitFile(idx, fileIdx)}
                                                  >
                                                    <Trash2 className="h-3 w-3" />
                                                  </Button>
                                                </div>
                                              </Card>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-muted-foreground">No files. Click "Add File" to add one.</p>
                                        )}
                                      </div>
                                    </div>
                                  )}

                                  {/* Cluster Generator */}
                                  {gen.type === 'cluster' && (
                                    <div className="space-y-3">
                                      <div className="space-y-2">
                                        <Label>Selector (Match Labels)</Label>
                                        <div className="space-y-2">
                                          {gen.selector?.matchLabels && Object.keys(gen.selector.matchLabels).length > 0 ? (
                                            Object.entries(gen.selector.matchLabels).map(([key, value], labelIdx) => (
                                              <Card key={labelIdx} className="p-2 border-border">
                                                <div className="grid grid-cols-2 gap-2">
                                                  <Input
                                                    className="h-8"
                                                    value={key}
                                                    onChange={(e) => {
                                                      const updated = { ...gen.selector?.matchLabels };
                                                      delete updated[key];
                                                      updated[e.target.value] = value;
                                                      updateGenerator(idx, {
                                                        selector: { ...gen.selector, matchLabels: updated }
                                                      });
                                                    }}
                                                    placeholder="label key"
                                                  />
                                                  <div className="flex gap-1">
                                                    <Input
                                                      className="h-8"
                                                      value={value}
                                                      onChange={(e) => {
                                                        updateGenerator(idx, {
                                                          selector: {
                                                            ...gen.selector,
                                                            matchLabels: { ...gen.selector?.matchLabels, [key]: e.target.value }
                                                          }
                                                        });
                                                      }}
                                                      placeholder="label value"
                                                      className="flex-1"
                                                    />
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      onClick={() => {
                                                        const updated = { ...gen.selector?.matchLabels };
                                                        delete updated[key];
                                                        updateGenerator(idx, {
                                                          selector: { ...gen.selector, matchLabels: updated }
                                                        });
                                                      }}
                                                    >
                                                      <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                  </div>
                                                </div>
                                              </Card>
                                            ))
                                          ) : (
                                            <p className="text-sm text-muted-foreground">No labels. Add labels below.</p>
                                          )}
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              updateGenerator(idx, {
                                                selector: {
                                                  ...gen.selector,
                                                  matchLabels: { ...gen.selector?.matchLabels, '': '' }
                                                }
                                              });
                                            }}
                                          >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Add Label
                                          </Button>
                                        </div>
                                      </div>
                                      <div className="space-y-2">
                                        <Label>Values</Label>
                                        <div className="space-y-2">
                                          {gen.values && Object.keys(gen.values).length > 0 ? (
                                            Object.entries(gen.values).map(([key, value], valueIdx) => (
                                              <Card key={valueIdx} className="p-2 border-border">
                                                <div className="grid grid-cols-2 gap-2">
                                                  <Input
                                                    className="h-8"
                                                    value={key}
                                                    onChange={(e) => {
                                                      const updated = { ...gen.values };
                                                      delete updated[key];
                                                      updated[e.target.value] = value;
                                                      updateGenerator(idx, { values: updated });
                                                    }}
                                                    placeholder="key"
                                                  />
                                                  <div className="flex gap-1">
                                                    <Input
                                                      className="h-8"
                                                      value={value}
                                                      onChange={(e) => {
                                                        updateGenerator(idx, {
                                                          values: { ...gen.values, [key]: e.target.value }
                                                        });
                                                      }}
                                                      placeholder="value"
                                                      className="flex-1"
                                                    />
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      onClick={() => {
                                                        const updated = { ...gen.values };
                                                        delete updated[key];
                                                        updateGenerator(idx, { values: updated });
                                                      }}
                                                    >
                                                      <Trash2 className="h-3 w-3" />
                                                    </Button>
                                                  </div>
                                                </div>
                                              </Card>
                                            ))
                                          ) : (
                                            <p className="text-sm text-muted-foreground">No values. Add values below.</p>
                                          )}
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              updateGenerator(idx, {
                                                values: { ...gen.values, '': '' }
                                              });
                                            }}
                                          >
                                            <Plus className="h-4 w-4 mr-1" />
                                            Add Value
                                          </Button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </CardContent>
                              )}
                            </Card>
                          ))}
                          {showAddGeneratorType === newAppSetGenerators.length ? (
                            <Card className="border-primary p-3">
                              <div className="space-y-2">
                                <Label>Select Generator Type</Label>
                                <div className="grid grid-cols-3 gap-2">
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => addGenerator('list')}
                                  >
                                    List
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => addGenerator('git')}
                                  >
                                    Git
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => addGenerator('cluster')}
                                  >
                                    Cluster
                                  </Button>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setShowAddGeneratorType(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </Card>
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => setShowAddGeneratorType(newAppSetGenerators.length)}
                            >
                              <Plus className="h-4 w-4 mr-2" />
                              Add Generator
                            </Button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label>Template</Label>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit-template-name">Application Name Template</Label>
                            <Input
                              id="edit-template-name"
                              value={newAppSetTemplate.name || ''}
                              onChange={(e) => setNewAppSetTemplate({ ...newAppSetTemplate, name: e.target.value })}
                              placeholder="{{name}}"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-template-project">Project</Label>
                            <Input
                              id="edit-template-project"
                              value={newAppSetTemplate.project || ''}
                              onChange={(e) => setNewAppSetTemplate({ ...newAppSetTemplate, project: e.target.value })}
                              placeholder="default"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-template-repo">Repository</Label>
                            <Input
                              id="edit-template-repo"
                              value={newAppSetTemplate.repository || ''}
                              onChange={(e) => setNewAppSetTemplate({ ...newAppSetTemplate, repository: e.target.value })}
                              placeholder="https://github.com/example/repo"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-template-path">Path</Label>
                            <Input
                              id="edit-template-path"
                              value={newAppSetTemplate.path || ''}
                              onChange={(e) => setNewAppSetTemplate({ ...newAppSetTemplate, path: e.target.value })}
                              placeholder="./manifests"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-template-revision">Target Revision</Label>
                            <Input
                              id="edit-template-revision"
                              value={newAppSetTemplate.targetRevision || ''}
                              onChange={(e) => setNewAppSetTemplate({ ...newAppSetTemplate, targetRevision: e.target.value })}
                              placeholder="main"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit-template-dest-namespace">Destination Namespace</Label>
                            <Input
                              id="edit-template-dest-namespace"
                              value={newAppSetTemplate.destination?.namespace || ''}
                              onChange={(e) => setNewAppSetTemplate({ 
                                ...newAppSetTemplate, 
                                destination: { ...newAppSetTemplate.destination, namespace: e.target.value }
                              })}
                              placeholder="default"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="edit-appset-sync-policy">Sync Policy</Label>
                          <Select
                            value={newAppSetSyncPolicy}
                            onValueChange={(value: 'automated' | 'manual' | 'sync-window') => setNewAppSetSyncPolicy(value)}
                          >
                            <SelectTrigger id="edit-appset-sync-policy">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="manual">Manual</SelectItem>
                              <SelectItem value="automated">Automated</SelectItem>
                              <SelectItem value="sync-window">Sync Window</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Options</Label>
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="edit-appset-preserve-resources"
                                checked={newAppSetPreserveResources}
                                onCheckedChange={setNewAppSetPreserveResources}
                              />
                              <Label htmlFor="edit-appset-preserve-resources" className="cursor-pointer">
                                Preserve Resources on Deletion
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="edit-appset-go-template"
                                checked={newAppSetGoTemplate}
                                onCheckedChange={setNewAppSetGoTemplate}
                              />
                              <Label htmlFor="edit-appset-go-template" className="cursor-pointer">
                                Use Go Templates
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Switch
                                id="edit-appset-enabled"
                                checked={newAppSetEnabled}
                                onCheckedChange={setNewAppSetEnabled}
                              />
                              <Label htmlFor="edit-appset-enabled" className="cursor-pointer">
                                Enabled
                              </Label>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <Button onClick={handleSaveApplicationSet}>
                          <Save className="h-4 w-4 mr-2" />
                          Save Changes
                        </Button>
                        <Button variant="outline" onClick={() => {
                          setShowEditApplicationSet(false);
                          setEditingApplicationSet(null);
                          setNewAppSetName('');
                          setNewAppSetNamespace('default');
                          setNewAppSetEnabled(true);
                          setNewAppSetSyncPolicy('manual');
                          setNewAppSetPreserveResources(false);
                          setNewAppSetGoTemplate(false);
                          setNewAppSetGenerators([]);
                          setNewAppSetTemplate({});
                          setAppSetNameError('');
                          setExpandedGenerators(new Set());
                          setShowAddGeneratorType(null);
                        }}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Application Sets List */}
                <div className="space-y-3">
                  {realApplicationSets.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Grid3x3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No Application Sets configured</p>
                      <p className="text-sm mt-2">Create an ApplicationSet to generate multiple applications from templates</p>
                    </div>
                  ) : (
                    realApplicationSets.map((appSet) => (
                      <Card key={appSet.name} className="border-border">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <CardTitle className="text-base">{appSet.name}</CardTitle>
                                {appSet.enabled ? (
                                  <Badge variant="default" className="bg-green-500">Enabled</Badge>
                                ) : (
                                  <Badge variant="secondary">Disabled</Badge>
                                )}
                                {appSet.goTemplate && (
                                  <Badge variant="outline">Go Template</Badge>
                                )}
                              </div>
                              {appSet.namespace && (
                                <CardDescription className="mt-1">Namespace: {appSet.namespace}</CardDescription>
                              )}
                            </div>
                            <div className="flex gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEditApplicationSet(appSet)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteApplicationSet(appSet.name)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3">
                            <div>
                              <Label className="text-sm font-medium">Generators ({appSet.generators.length})</Label>
                              <div className="flex flex-wrap gap-2 mt-1">
                                {appSet.generators.map((gen, idx) => (
                                  <Badge key={idx} variant="outline">
                                    {gen.type}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                            {appSet.generatedApplications && appSet.generatedApplications.length > 0 && (
                              <div>
                                <Label className="text-sm font-medium">Generated Applications ({appSet.generatedApplications.length})</Label>
                                <div className="flex flex-wrap gap-2 mt-1">
                                  {appSet.generatedApplications.slice(0, 10).map((appName) => (
                                    <Badge key={appName} variant="secondary">
                                      {appName}
                                    </Badge>
                                  ))}
                                  {appSet.generatedApplications.length > 10 && (
                                    <Badge variant="secondary">
                                      +{appSet.generatedApplications.length - 10} more
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <span className="font-medium">Sync Policy:</span>{' '}
                                <Badge variant="outline">{appSet.syncPolicy || 'manual'}</Badge>
                              </div>
                              {appSet.preserveResourcesOnDeletion && (
                                <div>
                                  <span className="font-medium">Preserve Resources:</span>{' '}
                                  <Badge variant="outline">Yes</Badge>
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

    </div>
  );
}
