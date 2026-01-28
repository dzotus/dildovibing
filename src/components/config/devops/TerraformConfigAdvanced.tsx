import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { emulationEngine } from '@/core/EmulationEngine';
import { TerraformEmulationEngine, TerraformWorkspace, TerraformRun, TerraformState, TerraformVariable, TerraformNotificationConfiguration, TerraformRunPolicy } from '@/core/TerraformEmulationEngine';
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
import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  RefreshCcw,
  Play,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Layers,
  Cloud,
  Edit,
  Search,
  Filter,
  X,
  AlertCircle,
  GitBranch,
  Save,
  Ban,
  Variable,
  Bell,
  ChevronDown,
  ChevronUp,
  Shield,
  CheckCircle2,
  GitCompare,
  History
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';

interface TerraformConfigProps {
  componentId: string;
}

interface Workspace {
  id: string;
  name: string;
  description?: string;
  terraformVersion?: string;
  autoApply?: boolean;
  queueAllRuns?: boolean;
  workingDirectory?: string;
  vcsRepo?: {
    identifier: string;
    branch: string;
    oauthTokenId?: string;
  };
  lastRun?: {
    id: string;
    status: 'pending' | 'planning' | 'planned' | 'applying' | 'applied' | 'errored' | 'canceled';
    createdAt: string;
  };
}

interface Run {
  id: string;
  workspace: string;
  status: 'pending' | 'planning' | 'planned' | 'applying' | 'applied' | 'errored' | 'canceled';
  createdAt: string;
  planOnly?: boolean;
  message?: string;
  duration?: number;
}

interface State {
  id: string;
  workspace: string;
  version: number;
  serial: number;
  lineage?: string;
  resources?: number;
  outputs?: Record<string, any>;
  updatedAt: string;
}

interface TerraformConfig {
  workspaces?: Workspace[];
  runs?: Run[];
  states?: State[];
  totalWorkspaces?: number;
  activeRuns?: number;
  completedRuns?: number;
}

export function TerraformConfigAdvanced({ componentId }: TerraformConfigProps) {
  const { nodes, updateNode, connections } = useCanvasStore();
  const { isRunning, getComponentMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Get Terraform emulation engine
  const terraformEngine = emulationEngine.getTerraformEmulationEngine(componentId);
  const componentMetrics = getComponentMetrics(componentId);

  const config = (node.data.config as any) || {} as TerraformConfig;
  const workspaces = config.workspaces || [
    {
      id: '1',
      name: 'production',
      description: 'Production infrastructure',
      terraformVersion: '1.5.0',
      autoApply: false,
      queueAllRuns: true,
      workingDirectory: '/terraform',
      lastRun: {
        id: 'run-1',
        status: 'applied',
        createdAt: new Date().toISOString(),
      },
    },
  ];
  const runs = config.runs || [
    {
      id: '1',
      workspace: 'production',
      status: 'applied',
      createdAt: new Date().toISOString(),
      planOnly: false,
      message: 'Apply completed successfully',
      duration: 120,
    },
  ];
  const states = config.states || [
    {
      id: '1',
      workspace: 'production',
      version: 1,
      serial: 1,
      resources: 15,
      updatedAt: new Date().toISOString(),
    },
  ];

  // State declarations
  const [editingWorkspaceIndex, setEditingWorkspaceIndex] = useState<number | null>(null);
  const [editingWorkspace, setEditingWorkspace] = useState<string | null>(null);
  const [showCreateWorkspace, setShowCreateWorkspace] = useState(false);
  const [realWorkspaces, setRealWorkspaces] = useState<TerraformWorkspace[]>([]);
  const [realRuns, setRealRuns] = useState<TerraformRun[]>([]);
  const [realStates, setRealStates] = useState<TerraformState[]>([]);
  const [realMetrics, setRealMetrics] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [runFilter, setRunFilter] = useState<'all' | 'active' | 'success' | 'failed'>('all');
  const [runWorkspaceFilter, setRunWorkspaceFilter] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [showRunDetails, setShowRunDetails] = useState(false);
  const [expandedRuns, setExpandedRuns] = useState<Set<string>>(new Set());
  const [expandedStates, setExpandedStates] = useState<Set<string>>(new Set());
  const [confirmingDeleteWorkspace, setConfirmingDeleteWorkspace] = useState<string | null>(null);
  const [confirmingCancelRun, setConfirmingCancelRun] = useState<string | null>(null);

  // Variables state
  const [selectedWorkspaceForVars, setSelectedWorkspaceForVars] = useState<string | null>(null);
  const [workspaceVariables, setWorkspaceVariables] = useState<TerraformVariable[]>([]);
  const [newVariable, setNewVariable] = useState<{ key: string; value: string; category: 'terraform' | 'env'; sensitive: boolean; hcl: boolean }>({ key: '', value: '', category: 'terraform', sensitive: false, hcl: false });
  const [editingVariable, setEditingVariable] = useState<string | null>(null);
  const [confirmingDeleteVariable, setConfirmingDeleteVariable] = useState<string | null>(null);
  const [showAddVariable, setShowAddVariable] = useState(false);

  // Notifications state
  const [selectedWorkspaceForNotifs, setSelectedWorkspaceForNotifs] = useState<string | null>(null);
  const [workspaceNotifications, setWorkspaceNotifications] = useState<TerraformNotificationConfiguration[]>([]);
  const [newNotification, setNewNotification] = useState<{ name: string; type: 'slack' | 'email' | 'webhook' | 'component'; destination: string; conditions: Array<'on_success' | 'on_failure' | 'on_start'>; enabled: boolean; description?: string }>({ name: '', type: 'webhook', destination: '', conditions: [], enabled: true });
  const [editingNotification, setEditingNotification] = useState<string | null>(null);
  const [confirmingDeleteNotification, setConfirmingDeleteNotification] = useState<string | null>(null);
  const [showAddNotification, setShowAddNotification] = useState(false);

  // Tags state
  const [workspaceTagFilter, setWorkspaceTagFilter] = useState<string | null>(null);
  const [newTagInput, setNewTagInput] = useState<Record<string, string>>({});
  const [allTags, setAllTags] = useState<string[]>([]);

  // Run Policies state
  const [selectedWorkspaceForPolicies, setSelectedWorkspaceForPolicies] = useState<string | null>(null);
  const [workspacePolicies, setWorkspacePolicies] = useState<TerraformRunPolicy[]>([]);
  const [newPolicy, setNewPolicy] = useState<{ name: string; type: 'manual_approval' | 'sentinel' | 'opa'; enabled: boolean; conditions?: { onPlanOnly?: boolean; onApply?: boolean; resourceTypes?: string[]; minResourceChanges?: number; requireDestruction?: boolean }; description?: string }>({ name: '', type: 'manual_approval', enabled: true });
  const [editingPolicy, setEditingPolicy] = useState<string | null>(null);
  const [confirmingDeletePolicy, setConfirmingDeletePolicy] = useState<string | null>(null);
  const [showAddPolicy, setShowAddPolicy] = useState(false);

  // State comparison state
  const [comparingStates, setComparingStates] = useState<{ from: string | null; to: string | null }>({ from: null, to: null });

  // Use real data from emulation if available, otherwise fallback to config
  const displayWorkspaces = realWorkspaces.length > 0 ? realWorkspaces : workspaces;
  const displayRuns = realRuns.length > 0 ? realRuns : runs;
  const displayStates = realStates.length > 0 ? realStates : states;

  const totalWorkspaces = realMetrics?.workspacesTotal || displayWorkspaces.length;
  const activeRuns = realMetrics?.runsRunning || displayRuns.filter((r: any) => ['pending', 'planning', 'applying'].includes(r.status)).length;
  const completedRuns = realMetrics?.runsSuccess || displayRuns.filter((r: any) => r.status === 'applied').length;

  // Filtered runs based on search and filter
  const filteredRuns = useMemo(() => {
    let filtered = displayRuns;
    
    if (searchQuery) {
      filtered = filtered.filter((run: any) => 
        run.workspaceName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        run.id?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    if (runWorkspaceFilter) {
      filtered = filtered.filter((run: any) => 
        run.workspaceId === runWorkspaceFilter || run.workspace === runWorkspaceFilter
      );
    }
    
    if (runFilter === 'active') {
      filtered = filtered.filter((run: any) => ['pending', 'planning', 'applying'].includes(run.status));
    } else if (runFilter === 'success') {
      filtered = filtered.filter((run: any) => run.status === 'applied');
    } else if (runFilter === 'failed') {
      filtered = filtered.filter((run: any) => run.status === 'errored');
    }
    
    return filtered.sort((a: any, b: any) => {
      const aTime = a.createdAt ? (typeof a.createdAt === 'string' ? new Date(a.createdAt).getTime() : a.createdAt) : 0;
      const bTime = b.createdAt ? (typeof b.createdAt === 'string' ? new Date(b.createdAt).getTime() : b.createdAt) : 0;
      return bTime - aTime;
    });
  }, [displayRuns, searchQuery, runFilter, runWorkspaceFilter]);

  // Update real-time data from emulation
  useEffect(() => {
    if (!terraformEngine) return;
    
    const updateData = () => {
      try {
        const workspaces = terraformEngine.getWorkspaces();
        const activeRuns = terraformEngine.getActiveRuns();
        // Get runs for all workspaces
        const allRuns: TerraformRun[] = [];
        for (const workspace of workspaces) {
          const workspaceRuns = terraformEngine.getRunsForWorkspace(workspace.id, 100);
          allRuns.push(...workspaceRuns);
        }
        const states = terraformEngine.getStates();
        const metrics = terraformEngine.getMetrics();
        
        setRealWorkspaces(workspaces);
        setRealRuns(allRuns);
        setRealStates(states);
        setRealMetrics(metrics);
      } catch (error) {
        console.error('Error updating Terraform data:', error);
      }
    };
    
    updateData();
    const interval = setInterval(updateData, isRunning ? 500 : 2000);
    return () => clearInterval(interval);
  }, [terraformEngine, isRunning]);

  // Sync config with emulation engine when it changes
  useEffect(() => {
    if (!terraformEngine || !node) return;
    terraformEngine.updateConfig(node);
  }, [config.workspaces?.length, config.runs?.length, config.states?.length, terraformEngine, node]);

  const updateConfig = (updates: Partial<TerraformConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addWorkspace = () => {
    const newWorkspace: Workspace = {
      id: `workspace-${Date.now()}`,
      name: 'new-workspace',
      terraformVersion: config.defaultTerraformVersion || '1.5.0',
      autoApply: false,
      queueAllRuns: true,
    };
    updateConfig({ workspaces: [...workspaces, newWorkspace] });
    setShowCreateWorkspace(false);
    toast({
      title: 'Workspace created',
      description: 'New workspace has been added',
    });
  };

  const removeWorkspace = (id: string) => {
    if (displayWorkspaces.length === 1) {
      toast({
        title: 'Cannot delete workspace',
        description: 'At least one workspace is required',
        variant: 'destructive',
      });
      return;
    }
    
    const workspace = displayWorkspaces.find(w => w.id === id);
    if (workspace) {
      updateConfig({ workspaces: workspaces.filter((w) => w.id !== id) });
      setConfirmingDeleteWorkspace(null);
      toast({
        title: 'Workspace deleted',
        description: `Workspace "${workspace.name}" has been removed`,
      });
    }
  };

  const updateWorkspace = (id: string, field: string, value: any) => {
    const newWorkspaces = workspaces.map((w) => {
      if (w.id === id) {
        if (field === 'vcsRepo' && value === undefined) {
          const { vcsRepo, ...rest } = w;
          return rest;
        }
        return { ...w, [field]: value };
      }
      return w;
    });
    updateConfig({ workspaces: newWorkspaces });
  };

  const createRun = (workspaceId: string, planOnly: boolean = false) => {
    const workspace = workspaces.find((w) => w.id === workspaceId);
    if (!workspace) {
      toast({
        title: 'Error',
        description: 'Workspace not found',
        variant: 'destructive',
      });
      return;
    }

    if (terraformEngine) {
      const result = terraformEngine.triggerRun(workspaceId, { planOnly, source: 'api', triggeredBy: 'user' });
      if (result.success) {
        toast({
          title: 'Run triggered',
          description: `Run ${result.runId} created for workspace ${workspace.name}`,
        });
      } else {
        toast({
          title: 'Error',
          description: result.reason || 'Failed to trigger run',
          variant: 'destructive',
        });
      }
    } else {
      // Fallback to config update if engine not available
      const newRun: Run = {
        id: `run-${Date.now()}`,
        workspace: workspace.name,
        status: 'pending',
        createdAt: new Date().toISOString(),
        planOnly,
      };
      updateConfig({ runs: [newRun, ...runs.slice(0, 9)] });
      toast({
        title: 'Run created',
        description: `Run created for workspace ${workspace.name}`,
      });
    }
  };

  const cancelRun = (runId: string) => {
    if (terraformEngine) {
      const result = terraformEngine.cancelRun(runId);
      if (result.success) {
        toast({
          title: 'Run canceled',
          description: `Run ${runId} has been canceled`,
        });
      } else {
        toast({
          title: 'Error',
          description: result.reason || 'Failed to cancel run',
          variant: 'destructive',
        });
      }
    } else {
      toast({
        title: 'Error',
        description: 'Terraform engine not available',
        variant: 'destructive',
      });
    }
  };

  // Tags operations
  useEffect(() => {
    if (!terraformEngine) {
      setAllTags([]);
      return;
    }
    
    const tags = terraformEngine.getAllTags();
    setAllTags(tags);
  }, [terraformEngine, realWorkspaces]);

  // Variables operations
  useEffect(() => {
    if (!terraformEngine || !selectedWorkspaceForVars) {
      setWorkspaceVariables([]);
      return;
    }
    
    const variables = terraformEngine.getVariables(selectedWorkspaceForVars);
    setWorkspaceVariables(variables);
  }, [terraformEngine, selectedWorkspaceForVars, realWorkspaces]);

  const addVariable = () => {
    if (!terraformEngine || !selectedWorkspaceForVars) {
      toast({
        title: 'Error',
        description: 'Please select a workspace',
        variant: 'destructive',
      });
      return;
    }

    if (!newVariable.key?.trim() || newVariable.value === undefined) {
      toast({
        title: 'Error',
        description: 'Variable key and value are required',
        variant: 'destructive',
      });
      return;
    }

    const result = terraformEngine.addVariable(selectedWorkspaceForVars, {
      key: newVariable.key,
      value: String(newVariable.value),
      category: newVariable.category || 'terraform',
      sensitive: newVariable.sensitive || false,
      hcl: newVariable.hcl || false,
    });

    if (result.success) {
      toast({
        title: 'Variable added',
        description: 'New variable has been added',
      });
      setNewVariable({ key: '', value: '', category: 'terraform', sensitive: false, hcl: false });
      setShowAddVariable(false);
      // Refresh variables
      const variables = terraformEngine.getVariables(selectedWorkspaceForVars);
      setWorkspaceVariables(variables);
    } else {
      toast({
        title: 'Error',
        description: result.reason || 'Failed to add variable',
        variant: 'destructive',
      });
    }
  };

  const updateVariable = (variableKey: string, updates: Partial<TerraformVariable>) => {
    if (!terraformEngine || !selectedWorkspaceForVars) return;

    const result = terraformEngine.updateVariable(selectedWorkspaceForVars, variableKey, updates);
    if (result.success) {
      toast({
        title: 'Variable updated',
        description: 'Variable has been updated',
      });
      const variables = terraformEngine.getVariables(selectedWorkspaceForVars);
      setWorkspaceVariables(variables);
      setEditingVariable(null);
    } else {
      toast({
        title: 'Error',
        description: result.reason || 'Failed to update variable',
        variant: 'destructive',
      });
    }
  };

  const deleteVariable = (variableKey: string) => {
    if (!terraformEngine || !selectedWorkspaceForVars) return;

    const result = terraformEngine.deleteVariable(selectedWorkspaceForVars, variableKey);
    if (result.success) {
      toast({
        title: 'Variable deleted',
        description: 'Variable has been removed',
      });
      const variables = terraformEngine.getVariables(selectedWorkspaceForVars);
      setWorkspaceVariables(variables);
      setConfirmingDeleteVariable(null);
    } else {
      toast({
        title: 'Error',
        description: result.reason || 'Failed to delete variable',
        variant: 'destructive',
      });
    }
  };

  // Notifications operations
  useEffect(() => {
    if (!terraformEngine || !selectedWorkspaceForNotifs) {
      setWorkspaceNotifications([]);
      return;
    }
    
    const notifications = terraformEngine.getNotifications(selectedWorkspaceForNotifs);
    setWorkspaceNotifications(notifications);
  }, [terraformEngine, selectedWorkspaceForNotifs, realWorkspaces]);

  const addNotification = () => {
    if (!terraformEngine || !selectedWorkspaceForNotifs) {
      toast({
        title: 'Error',
        description: 'Please select a workspace',
        variant: 'destructive',
      });
      return;
    }

    if (!newNotification.name?.trim() || !newNotification.destination?.trim()) {
      toast({
        title: 'Error',
        description: 'Notification name and destination are required',
        variant: 'destructive',
      });
      return;
    }

    if (!newNotification.conditions || newNotification.conditions.length === 0) {
      toast({
        title: 'Error',
        description: 'At least one condition is required',
        variant: 'destructive',
      });
      return;
    }

    const result = terraformEngine.addNotification(selectedWorkspaceForNotifs, {
      name: newNotification.name,
      type: newNotification.type || 'webhook',
      destination: newNotification.destination,
      conditions: newNotification.conditions,
      enabled: newNotification.enabled !== false,
      description: newNotification.description,
    });

    if (result.success) {
      toast({
        title: 'Notification added',
        description: 'New notification has been added',
      });
      setNewNotification({ name: '', type: 'webhook', destination: '', conditions: [], enabled: true });
      setShowAddNotification(false);
      // Refresh notifications
      const notifications = terraformEngine.getNotifications(selectedWorkspaceForNotifs);
      setWorkspaceNotifications(notifications);
    } else {
      toast({
        title: 'Error',
        description: result.reason || 'Failed to add notification',
        variant: 'destructive',
      });
    }
  };

  const updateNotification = (notificationId: string, updates: Partial<TerraformNotificationConfiguration>) => {
    if (!terraformEngine || !selectedWorkspaceForNotifs) return;

    const result = terraformEngine.updateNotification(selectedWorkspaceForNotifs, notificationId, updates);
    if (result.success) {
      toast({
        title: 'Notification updated',
        description: 'Notification has been updated',
      });
      const notifications = terraformEngine.getNotifications(selectedWorkspaceForNotifs);
      setWorkspaceNotifications(notifications);
      setEditingNotification(null);
    } else {
      toast({
        title: 'Error',
        description: result.reason || 'Failed to update notification',
        variant: 'destructive',
      });
    }
  };

  const deleteNotification = (notificationId: string) => {
    if (!terraformEngine || !selectedWorkspaceForNotifs) return;

    const result = terraformEngine.deleteNotification(selectedWorkspaceForNotifs, notificationId);
    if (result.success) {
      toast({
        title: 'Notification deleted',
        description: 'Notification has been removed',
      });
      const notifications = terraformEngine.getNotifications(selectedWorkspaceForNotifs);
      setWorkspaceNotifications(notifications);
      setConfirmingDeleteNotification(null);
    } else {
      toast({
        title: 'Error',
        description: result.reason || 'Failed to delete notification',
        variant: 'destructive',
      });
    }
  };

  // Tags operations
  const addTag = (workspaceId: string, tag: string) => {
    if (!terraformEngine) return;

    const result = terraformEngine.addTag(workspaceId, tag);
    if (result.success) {
      toast({
        title: 'Tag added',
        description: 'Tag has been added to workspace',
      });
      // Refresh workspaces and tags
      const workspaces = terraformEngine.getWorkspaces();
      setRealWorkspaces(workspaces);
      const tags = terraformEngine.getAllTags();
      setAllTags(tags);
      setNewTagInput({ ...newTagInput, [workspaceId]: '' });
    } else {
      toast({
        title: 'Error',
        description: result.reason || 'Failed to add tag',
        variant: 'destructive',
      });
    }
  };

  const removeTag = (workspaceId: string, tag: string) => {
    if (!terraformEngine) return;

    const result = terraformEngine.removeTag(workspaceId, tag);
    if (result.success) {
      toast({
        title: 'Tag removed',
        description: 'Tag has been removed from workspace',
      });
      // Refresh workspaces and tags
      const workspaces = terraformEngine.getWorkspaces();
      setRealWorkspaces(workspaces);
      const tags = terraformEngine.getAllTags();
      setAllTags(tags);
    } else {
      toast({
        title: 'Error',
        description: result.reason || 'Failed to remove tag',
        variant: 'destructive',
      });
    }
  };

  // Filtered workspaces by tag
  const filteredWorkspaces = useMemo(() => {
    let filtered = displayWorkspaces;
    
    if (workspaceTagFilter) {
      filtered = filtered.filter((ws: any) => 
        (ws.tags || []).includes(workspaceTagFilter)
      );
    }
    
    return filtered;
  }, [displayWorkspaces, workspaceTagFilter]);

  // Load policies when workspace selected
  useEffect(() => {
    if (!terraformEngine || !selectedWorkspaceForPolicies) return;
    
    const policies = terraformEngine.getRunPolicies(selectedWorkspaceForPolicies);
    setWorkspacePolicies(policies);
  }, [terraformEngine, selectedWorkspaceForPolicies]);

  // Run Policies operations
  const addPolicy = () => {
    if (!terraformEngine || !selectedWorkspaceForPolicies) return;
    if (!newPolicy.name.trim()) {
      toast({
        title: 'Error',
        description: 'Policy name is required',
        variant: 'destructive',
      });
      return;
    }

    const result = terraformEngine.addRunPolicy(selectedWorkspaceForPolicies, newPolicy);
    if (result.success) {
      toast({
        title: 'Policy added',
        description: 'Run policy has been added',
      });
      const policies = terraformEngine.getRunPolicies(selectedWorkspaceForPolicies);
      setWorkspacePolicies(policies);
      setNewPolicy({ name: '', type: 'manual_approval', enabled: true });
      setShowAddPolicy(false);
    } else {
      toast({
        title: 'Error',
        description: result.reason || 'Failed to add policy',
        variant: 'destructive',
      });
    }
  };

  const updatePolicy = (policyId: string, updates: Partial<TerraformRunPolicy>) => {
    if (!terraformEngine || !selectedWorkspaceForPolicies) return;

    const result = terraformEngine.updateRunPolicy(selectedWorkspaceForPolicies, policyId, updates);
    if (result.success) {
      toast({
        title: 'Policy updated',
        description: 'Run policy has been updated',
      });
      const policies = terraformEngine.getRunPolicies(selectedWorkspaceForPolicies);
      setWorkspacePolicies(policies);
      setEditingPolicy(null);
    } else {
      toast({
        title: 'Error',
        description: result.reason || 'Failed to update policy',
        variant: 'destructive',
      });
    }
  };

  const deletePolicy = (policyId: string) => {
    if (!terraformEngine || !selectedWorkspaceForPolicies) return;

    const result = terraformEngine.deleteRunPolicy(selectedWorkspaceForPolicies, policyId);
    if (result.success) {
      toast({
        title: 'Policy deleted',
        description: 'Run policy has been removed',
      });
      const policies = terraformEngine.getRunPolicies(selectedWorkspaceForPolicies);
      setWorkspacePolicies(policies);
      setConfirmingDeletePolicy(null);
    } else {
      toast({
        title: 'Error',
        description: result.reason || 'Failed to delete policy',
        variant: 'destructive',
      });
    }
  };

  const approveRun = (runId: string) => {
    if (!terraformEngine) return;

    const result = terraformEngine.approveRun(runId, 'user');
    if (result.success) {
      toast({
        title: 'Run approved',
        description: 'Run has been approved and will proceed to apply',
      });
      // Refresh runs
      const workspaces = terraformEngine.getWorkspaces();
      const allRuns: TerraformRun[] = [];
      for (const workspace of workspaces) {
        const workspaceRuns = terraformEngine.getRunsForWorkspace(workspace.id, 100);
        allRuns.push(...workspaceRuns);
      }
      setRealRuns(allRuns);
    } else {
      toast({
        title: 'Error',
        description: result.reason || 'Failed to approve run',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Terraform</p>
            <h2 className="text-2xl font-bold text-foreground">Infrastructure as Code</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage workspaces, runs, and state
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                if (terraformEngine && node) {
                  terraformEngine.updateConfig(node);
                  toast({
                    title: 'Refreshed',
                    description: 'Configuration has been refreshed',
                  });
                }
              }}
            >
              <RefreshCcw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        <Separator />

        {/* Enhanced Stats with Visual Indicators */}
        <div className="grid grid-cols-4 gap-4">
          <Card className="border-l-4 border-l-blue-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Workspaces</CardTitle>
                <Layers className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalWorkspaces}</span>
                <span className="text-xs text-muted-foreground">active</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Runs</CardTitle>
                <Activity className="h-4 w-4 text-cyan-500 animate-pulse" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{activeRuns}</span>
                <span className="text-xs text-muted-foreground">running</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{completedRuns}</span>
                <span className="text-xs text-muted-foreground">success</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">State Versions</CardTitle>
                <FileText className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{states.length}</span>
                <span className="text-xs text-muted-foreground">versions</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="workspaces" className="space-y-4">
          <TabsList className="flex flex-wrap gap-2">
            <TabsTrigger value="workspaces">
              <Layers className="h-4 w-4 mr-2" />
              Workspaces ({displayWorkspaces.length})
            </TabsTrigger>
            <TabsTrigger value="runs">
              <Play className="h-4 w-4 mr-2" />
              Runs ({filteredRuns.length})
            </TabsTrigger>
            <TabsTrigger value="state">
              <FileText className="h-4 w-4 mr-2" />
              State ({displayStates.length})
            </TabsTrigger>
            <TabsTrigger value="variables">
              <Variable className="h-4 w-4 mr-2" />
              Variables
            </TabsTrigger>
            <TabsTrigger value="notifications">
              <Bell className="h-4 w-4 mr-2" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="policies">
              <Shield className="h-4 w-4 mr-2" />
              Policies
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workspaces" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Workspaces</CardTitle>
                    <CardDescription>Manage Terraform workspaces</CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {allTags.length > 0 && (
                      <Select value={workspaceTagFilter || 'all'} onValueChange={(value) => setWorkspaceTagFilter(value === 'all' ? null : value)}>
                        <SelectTrigger className="w-40">
                          <SelectValue placeholder="Filter by tag" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Workspaces</SelectItem>
                          {allTags.map((tag) => (
                            <SelectItem key={tag} value={tag}>
                              {tag}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    <Button onClick={addWorkspace} size="sm">
                      <Plus className="h-4 w-4 mr-2" />
                      Create Workspace
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {filteredWorkspaces.map((workspace) => (
                    <Card key={workspace.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                              <Layers className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{workspace.name}</CardTitle>
                              {workspace.description && (
                                <p className="text-sm text-muted-foreground mt-0.5">{workspace.description}</p>
                              )}
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="font-mono text-xs">
                                  <Cloud className="h-3 w-3 mr-1" />
                                  v{workspace.terraformVersion || '1.5.0'}
                                </Badge>
                                {workspace.autoApply && (
                                  <Badge variant="default" className="bg-green-500">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    Auto Apply
                                  </Badge>
                                )}
                                {workspace.lastRun && (
                                  <Badge variant={
                                    workspace.lastRun.status === 'applied' ? 'default' :
                                    workspace.lastRun.status === 'errored' ? 'destructive' : 'secondary'
                                  }>
                                    {workspace.lastRun.status === 'applied' && <CheckCircle className="h-3 w-3 mr-1" />}
                                    {workspace.lastRun.status === 'errored' && <XCircle className="h-3 w-3 mr-1" />}
                                    {typeof workspace.lastRun.status === 'string' ? workspace.lastRun.status : 'unknown'}
                                  </Badge>
                                )}
                                {terraformEngine && (
                                  <>
                                    {(() => {
                                      const vars = terraformEngine.getVariables(workspace.id);
                                      return vars.length > 0 ? (
                                        <Badge variant="outline" className="text-xs">
                                          <Variable className="h-3 w-3 mr-1" />
                                          {vars.length} {vars.length === 1 ? 'variable' : 'variables'}
                                        </Badge>
                                      ) : null;
                                    })()}
                                    {(() => {
                                      const notifs = terraformEngine.getNotifications(workspace.id);
                                      return notifs.length > 0 ? (
                                        <Badge variant="outline" className="text-xs">
                                          <Bell className="h-3 w-3 mr-1" />
                                          {notifs.length} {notifs.length === 1 ? 'notification' : 'notifications'}
                                        </Badge>
                                      ) : null;
                                    })()}
                                  </>
                                )}
                              </div>
                              {(workspace.tags && workspace.tags.length > 0) && (
                                <div className="flex flex-wrap items-center gap-1 mt-2">
                                  {workspace.tags.map((tag) => (
                                    <Badge key={tag} variant="outline" className="text-xs">
                                      {tag}
                                      {terraformEngine && (
                                        <button
                                          onClick={() => removeTag(workspace.id, tag)}
                                          className="ml-1 hover:text-destructive"
                                          type="button"
                                        >
                                          <X className="h-3 w-3" />
                                        </button>
                                      )}
                                    </Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => createRun(workspace.id, false)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Run Plan
                            </Button>
                            {editingWorkspace === workspace.id ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingWorkspace(null)}
                              >
                                <Save className="h-4 w-4 mr-2" />
                                Save
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setEditingWorkspace(workspace.id)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </Button>
                            )}
                            {confirmingDeleteWorkspace === workspace.id ? (
                              <div className="flex items-center gap-2">
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  onClick={() => removeWorkspace(workspace.id)}
                                >
                                  Confirm
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setConfirmingDeleteWorkspace(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setConfirmingDeleteWorkspace(workspace.id)}
                                disabled={displayWorkspaces.length === 1}
                                className="hover:bg-destructive/10 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {editingWorkspace === workspace.id ? (
                          <>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Workspace Name</Label>
                                <Input
                                  value={workspace.name}
                                  onChange={(e) => updateWorkspace(workspace.id, 'name', e.target.value)}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Terraform Version</Label>
                                <Select
                                  value={workspace.terraformVersion || config.defaultTerraformVersion || '1.5.0'}
                                  onValueChange={(value) => updateWorkspace(workspace.id, 'terraformVersion', value)}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1.5.0">1.5.0</SelectItem>
                                    <SelectItem value="1.4.0">1.4.0</SelectItem>
                                    <SelectItem value="1.3.0">1.3.0</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label>Working Directory</Label>
                                <Input
                                  value={workspace.workingDirectory || ''}
                                  onChange={(e) => updateWorkspace(workspace.id, 'workingDirectory', e.target.value)}
                                  placeholder="/terraform"
                                />
                              </div>
                              <div className="flex items-center justify-between">
                                <Label>Auto Apply</Label>
                                <Switch
                                  checked={workspace.autoApply ?? false}
                                  onCheckedChange={(checked) => updateWorkspace(workspace.id, 'autoApply', checked)}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Textarea
                                value={workspace.description || ''}
                                onChange={(e) => updateWorkspace(workspace.id, 'description', e.target.value)}
                                rows={2}
                                placeholder="Workspace description"
                              />
                            </div>
                            <Separator />
                            <div className="space-y-2">
                              <Label>VCS Repository (Optional)</Label>
                              <div className="grid grid-cols-3 gap-2">
                                <Input
                                  placeholder="org/repo"
                                  value={workspace.vcsRepo?.identifier || ''}
                                  onChange={(e) => {
                                    const ws = workspaces.find(w => w.id === workspace.id);
                                    if (ws) {
                                      updateWorkspace(workspace.id, 'vcsRepo', {
                                        ...(ws.vcsRepo || {}),
                                        identifier: e.target.value,
                                      });
                                    }
                                  }}
                                />
                                <Input
                                  placeholder="branch"
                                  value={workspace.vcsRepo?.branch || ''}
                                  onChange={(e) => {
                                    const ws = workspaces.find(w => w.id === workspace.id);
                                    if (ws) {
                                      updateWorkspace(workspace.id, 'vcsRepo', {
                                        ...(ws.vcsRepo || { identifier: '' }),
                                        branch: e.target.value,
                                      });
                                    }
                                  }}
                                />
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    const ws = workspaces.find(w => w.id === workspace.id);
                                    if (ws) updateWorkspace(workspace.id, 'vcsRepo', undefined);
                                  }}
                                  disabled={!workspace.vcsRepo}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                              <Label>Tags</Label>
                              <div className="flex flex-wrap items-center gap-2">
                                {terraformEngine && (
                                  <>
                                    <Input
                                      placeholder="Add tag..."
                                      value={newTagInput[workspace.id] || ''}
                                      onChange={(e) => setNewTagInput({ ...newTagInput, [workspace.id]: e.target.value })}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newTagInput[workspace.id]?.trim()) {
                                          addTag(workspace.id, newTagInput[workspace.id]);
                                          e.preventDefault();
                                        }
                                      }}
                                      className="w-32"
                                    />
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        if (newTagInput[workspace.id]?.trim()) {
                                          addTag(workspace.id, newTagInput[workspace.id]);
                                        }
                                      }}
                                      disabled={!newTagInput[workspace.id]?.trim()}
                                    >
                                      <Plus className="h-4 w-4 mr-1" />
                                      Add Tag
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                            <Separator />
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <Label>HCL Code</Label>
                                {terraformEngine && workspace.hclCodeVersion && (
                                  <span className="text-xs text-muted-foreground">
                                    Version: {workspace.hclCodeVersion}
                                    {workspace.hclCodeUpdatedAt && (
                                      <> • Updated: {new Date(workspace.hclCodeUpdatedAt).toLocaleString()}</>
                                    )}
                                  </span>
                                )}
                              </div>
                              <Textarea
                                value={terraformEngine ? (terraformEngine.getHCLCode(workspace.id) || '') : ''}
                                onChange={(e) => {
                                  if (terraformEngine) {
                                    const result = terraformEngine.setHCLCode(workspace.id, e.target.value);
                                    if (result.success) {
                                      // Обновляем локальное состояние
                                      const updatedWorkspaces = realWorkspaces.map(w => 
                                        w.id === workspace.id 
                                          ? { ...w, hclCode: e.target.value, hclCodeUpdatedAt: Date.now() }
                                          : w
                                      );
                                      setRealWorkspaces(updatedWorkspaces);
                                    } else {
                                      toast({
                                        title: 'Error',
                                        description: result.reason || 'Failed to update HCL code',
                                        variant: 'destructive',
                                      });
                                    }
                                  }
                                }}
                                placeholder='resource "kubernetes_deployment" "example" {
  metadata {
    name = "example-deployment"
  }
  spec {
    replicas = 3
  }
}'
                                className="font-mono text-sm"
                                rows={10}
                              />
                              <p className="text-xs text-muted-foreground">
                                HCL code will be automatically loaded from VCS when webhook is received. You can also edit it manually here.
                              </p>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                              <div>
                                <Label className="text-muted-foreground">Terraform Version</Label>
                                <p className="font-medium">{workspace.terraformVersion || config.defaultTerraformVersion || '1.5.0'}</p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">Working Directory</Label>
                                <p className="font-medium font-mono">{workspace.workingDirectory || '/terraform'}</p>
                              </div>
                              <div>
                                <Label className="text-muted-foreground">Auto Apply</Label>
                                <p className="font-medium">{workspace.autoApply ? 'Enabled' : 'Disabled'}</p>
                              </div>
                              {workspace.vcsRepo && (
                                <div>
                                  <Label className="text-muted-foreground">VCS Repository</Label>
                                  <p className="font-medium font-mono">{workspace.vcsRepo.identifier}@{workspace.vcsRepo.branch}</p>
                                </div>
                              )}
                            </div>
                            {workspace.description && (
                              <>
                                <Separator />
                                <div>
                                  <Label className="text-muted-foreground">Description</Label>
                                  <p className="text-sm mt-1">{workspace.description}</p>
                                </div>
                              </>
                            )}
                            {(workspace.tags && workspace.tags.length > 0) && (
                              <>
                                <Separator />
                                <div>
                                  <Label className="text-muted-foreground">Tags</Label>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {workspace.tags.map((tag) => (
                                      <Badge key={tag} variant="outline" className="text-xs">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              </>
                            )}
                            {terraformEngine && terraformEngine.getHCLCode(workspace.id) && (
                              <>
                                <Separator />
                                <div>
                                  <Label className="text-muted-foreground">HCL Code</Label>
                                  <div className="mt-1 space-y-1">
                                    <p className="text-xs text-muted-foreground font-mono bg-muted p-2 rounded max-h-32 overflow-auto">
                                      {terraformEngine.getHCLCode(workspace.id)?.substring(0, 200)}
                                      {(terraformEngine.getHCLCode(workspace.id)?.length || 0) > 200 && '...'}
                                    </p>
                                    {workspace.hclCodeVersion && (
                                      <p className="text-xs text-muted-foreground">
                                        Version: {workspace.hclCodeVersion}
                                        {workspace.hclCodeUpdatedAt && (
                                          <> • Updated: {new Date(workspace.hclCodeUpdatedAt).toLocaleString()}</>
                                        )}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="runs" className="space-y-4">
            {/* Run Timeline Chart */}
            {filteredRuns.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Run Timeline</CardTitle>
                  <CardDescription>Run history over time</CardDescription>
                </CardHeader>
                <CardContent>
                  {(() => {
                    // Group runs by hour for the last 24 hours
                    const now = Date.now();
                    const hours = 24;
                    const intervalMs = 60 * 60 * 1000; // 1 hour
                    const timelineData: Array<{ time: string; success: number; failed: number; active: number; total: number }> = [];
                    
                    for (let i = hours - 1; i >= 0; i--) {
                      const hourStart = now - (i * intervalMs);
                      const hourEnd = hourStart + intervalMs;
                      const hourRuns = filteredRuns.filter((run: any) => {
                        const runTime = run.createdAt ? (typeof run.createdAt === 'string' ? new Date(run.createdAt).getTime() : run.createdAt) : 0;
                        return runTime >= hourStart && runTime < hourEnd;
                      });
                      
                      const success = hourRuns.filter((r: any) => r.status === 'applied').length;
                      const failed = hourRuns.filter((r: any) => r.status === 'errored' || r.status === 'canceled').length;
                      const active = hourRuns.filter((r: any) => ['pending', 'planning', 'applying'].includes(r.status)).length;
                      
                      timelineData.push({
                        time: new Date(hourStart).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
                        success,
                        failed,
                        active,
                        total: hourRuns.length
                      });
                    }
                    
                    return timelineData.length > 0 ? (
                      <ResponsiveContainer width="100%" height={300}>
                        <AreaChart data={timelineData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="time" />
                          <YAxis />
                          <RechartsTooltip />
                          <Legend />
                          <Area type="monotone" dataKey="success" stackId="1" stroke="#22c55e" fill="#22c55e" name="Success" />
                          <Area type="monotone" dataKey="failed" stackId="1" stroke="#ef4444" fill="#ef4444" name="Failed" />
                          <Area type="monotone" dataKey="active" stackId="1" stroke="#3b82f6" fill="#3b82f6" name="Active" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        No run data available for timeline
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Terraform Runs</CardTitle>
                    <CardDescription>Execution history and status</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative">
                      <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search runs..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 w-64"
                      />
                    </div>
                    <Select value={runWorkspaceFilter || 'all'} onValueChange={(value) => setRunWorkspaceFilter(value === 'all' ? null : value)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Filter by workspace" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Workspaces</SelectItem>
                        {displayWorkspaces.map((ws: any) => (
                          <SelectItem key={ws.id} value={ws.id}>{ws.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={runFilter} onValueChange={(value: any) => setRunFilter(value)}>
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="success">Success</SelectItem>
                        <SelectItem value="failed">Failed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {filteredRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No runs found</p>
                ) : (
                  <div className="space-y-2">
                    {filteredRuns.map((run: any) => (
                      <Card
                        key={run.id}
                        className={`border-l-4 hover:shadow-md transition-all ${
                          run.status === 'applied' ? 'border-l-green-500 bg-card' :
                          run.status === 'errored' ? 'border-l-red-500 bg-card' :
                          run.status === 'canceled' ? 'border-l-gray-500 bg-card' :
                          ['pending', 'planning', 'applying'].includes(run.status) ? 'border-l-blue-500 bg-card' : 'border-l-yellow-500 bg-card'
                        }`}
                      >
                        <CardContent className="pt-4">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${
                              run.status === 'applied' ? 'bg-green-100 dark:bg-green-900/30' :
                              run.status === 'errored' ? 'bg-red-100 dark:bg-red-900/30' :
                              ['pending', 'planning', 'applying'].includes(run.status) ? 'bg-blue-100 dark:bg-blue-900/30' : 'bg-gray-100 dark:bg-gray-900/30'
                            }`}>
                              {run.status === 'applied' && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />}
                              {run.status === 'errored' && <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
                              {['pending', 'planning', 'applying'].includes(run.status) && <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-pulse" />}
                              {run.status === 'canceled' && <XCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant={
                                  run.status === 'applied' ? 'default' :
                                  run.status === 'errored' ? 'destructive' :
                                  run.status === 'canceled' ? 'outline' : 'secondary'
                                } className="font-medium">
                                  {run.status}
                                </Badge>
                                {run.planOnly && (
                                  <Badge variant="outline" className="text-xs">
                                    <FileText className="h-3 w-3 mr-1" />
                                    Plan Only
                                  </Badge>
                                )}
                                <span className="font-semibold text-base">{run.workspaceName || run.workspace}</span>
                              </div>
                              {run.message && (
                                <p className="text-sm text-muted-foreground mb-2">{run.message}</p>
                              )}
                              {run.error && (
                                <p className="text-sm text-destructive mb-2">{run.error}</p>
                              )}
                              {['planning', 'applying'].includes(run.status) && run.startedAt && (
                                <div className="mb-2">
                                  <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                                    <span className="capitalize">{run.status}...</span>
                                    <span>
                                      {run.duration !== undefined 
                                        ? `${Math.round(run.duration / 1000)}s`
                                        : run.startedAt 
                                          ? `${Math.round((Date.now() - (typeof run.startedAt === 'string' ? new Date(run.startedAt).getTime() : run.startedAt)) / 1000)}s`
                                          : '0s'
                                      }
                                    </span>
                                  </div>
                                  <Progress 
                                    value={
                                      run.duration !== undefined && run.startedAt
                                        ? Math.min(100, ((Date.now() - (typeof run.startedAt === 'string' ? new Date(run.startedAt).getTime() : run.startedAt)) / run.duration) * 100)
                                        : run.startedAt
                                          ? Math.min(95, ((Date.now() - (typeof run.startedAt === 'string' ? new Date(run.startedAt).getTime() : run.startedAt)) / (run.status === 'planning' ? 30000 : 120000)) * 100)
                                          : 0
                                    }
                                    className="h-2"
                                  />
                                </div>
                              )}
                              {run.hasChanges && (
                                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                                  {run.resourceAdditions !== undefined && run.resourceAdditions > 0 && (
                                    <Badge variant="outline" className="bg-green-50 text-green-700">+{run.resourceAdditions}</Badge>
                                  )}
                                  {run.resourceChanges !== undefined && run.resourceChanges > 0 && (
                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700">~{run.resourceChanges}</Badge>
                                  )}
                                  {run.resourceDestructions !== undefined && run.resourceDestructions > 0 && (
                                    <Badge variant="outline" className="bg-red-50 text-red-700">-{run.resourceDestructions}</Badge>
                                  )}
                                </div>
                              )}
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <div className="flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {run.createdAt ? (
                                    typeof run.createdAt === 'string' 
                                      ? new Date(run.createdAt).toLocaleString()
                                      : new Date(run.createdAt).toLocaleString()
                                  ) : 'Unknown'}
                                </div>
                                {run.duration !== undefined && (
                                  <div className="flex items-center gap-1">
                                    <Activity className="h-3 w-3" />
                                    {Math.round(run.duration / 1000)}s
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  const newExpanded = new Set(expandedRuns);
                                  if (newExpanded.has(run.id)) {
                                    newExpanded.delete(run.id);
                                  } else {
                                    newExpanded.add(run.id);
                                  }
                                  setExpandedRuns(newExpanded);
                                }}
                                title={expandedRuns.has(run.id) ? "Hide details" : "View details"}
                              >
                                {expandedRuns.has(run.id) ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                              {run.status === 'planned' && run.policyChecks?.requiresApproval && !run.policyChecks?.approved && (
                                <Button
                                  size="sm"
                                  variant="default"
                                  onClick={() => approveRun(run.id)}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2" />
                                  Approve
                                </Button>
                              )}
                              {['pending', 'planning', 'applying'].includes(run.status) && (
                                confirmingCancelRun === run.id ? (
                                  <div className="flex items-center gap-2">
                                    <Button
                                      size="sm"
                                      variant="destructive"
                                      onClick={() => {
                                        cancelRun(run.id);
                                        setConfirmingCancelRun(null);
                                      }}
                                    >
                                      Confirm
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setConfirmingCancelRun(null)}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setConfirmingCancelRun(run.id)}
                                  >
                                    <Ban className="h-4 w-4 mr-2" />
                                    Cancel
                                  </Button>
                                )
                              )}
                            </div>
                          </div>
                          {expandedRuns.has(run.id) && (
                            <>
                              <Separator className="my-4" />
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <Label className="text-muted-foreground">Run ID</Label>
                                    <p className="font-mono text-xs mt-1">{run.id}</p>
                                  </div>
                                  <div>
                                    <Label className="text-muted-foreground">Workspace</Label>
                                    <p className="font-medium mt-1">{run.workspaceName || run.workspace}</p>
                                  </div>
                                  {run.triggeredBy && (
                                    <div>
                                      <Label className="text-muted-foreground">Triggered By</Label>
                                      <p className="font-medium mt-1">{run.triggeredBy}</p>
                                    </div>
                                  )}
                                  {run.source && (
                                    <div>
                                      <Label className="text-muted-foreground">Source</Label>
                                      <Badge variant="outline" className="mt-1">{run.source}</Badge>
                                    </div>
                                  )}
                                  {run.createdAt && (
                                    <div>
                                      <Label className="text-muted-foreground">Created At</Label>
                                      <p className="font-medium mt-1">
                                        {typeof run.createdAt === 'string' 
                                          ? new Date(run.createdAt).toLocaleString()
                                          : new Date(run.createdAt).toLocaleString()}
                                      </p>
                                    </div>
                                  )}
                                  {run.startedAt && (
                                    <div>
                                      <Label className="text-muted-foreground">Started At</Label>
                                      <p className="font-medium mt-1">
                                        {typeof run.startedAt === 'string' 
                                          ? new Date(run.startedAt).toLocaleString()
                                          : new Date(run.startedAt).toLocaleString()}
                                      </p>
                                    </div>
                                  )}
                                  {run.finishedAt && (
                                    <div>
                                      <Label className="text-muted-foreground">Finished At</Label>
                                      <p className="font-medium mt-1">
                                        {typeof run.finishedAt === 'string' 
                                          ? new Date(run.finishedAt).toLocaleString()
                                          : new Date(run.finishedAt).toLocaleString()}
                                      </p>
                                    </div>
                                  )}
                                  {run.duration !== undefined && (
                                    <div>
                                      <Label className="text-muted-foreground">Duration</Label>
                                      <p className="font-medium mt-1">{Math.round(run.duration / 1000)}s</p>
                                    </div>
                                  )}
                                </div>
                                {run.hasChanges && (
                                  <>
                                    <Separator />
                                    <div>
                                      <Label className="text-muted-foreground mb-2 block">Resource Changes</Label>
                                      <div className="grid grid-cols-3 gap-4">
                                        {run.resourceAdditions !== undefined && (
                                          <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">+{run.resourceAdditions}</p>
                                            <p className="text-xs text-muted-foreground mt-1">Additions</p>
                                          </div>
                                        )}
                                        {run.resourceChanges !== undefined && (
                                          <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">~{run.resourceChanges}</p>
                                            <p className="text-xs text-muted-foreground mt-1">Changes</p>
                                          </div>
                                        )}
                                        {run.resourceDestructions !== undefined && (
                                          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                            <p className="text-2xl font-bold text-red-600 dark:text-red-400">-{run.resourceDestructions}</p>
                                            <p className="text-xs text-muted-foreground mt-1">Destructions</p>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </>
                                )}
                                {run.message && (
                                  <>
                                    <Separator />
                                    <div>
                                      <Label className="text-muted-foreground mb-2 block">Message</Label>
                                      <p className="text-sm bg-muted p-2 rounded">{run.message}</p>
                                    </div>
                                  </>
                                )}
                                {run.error && (
                                  <>
                                    <Separator />
                                    <div>
                                      <Label className="text-muted-foreground mb-2 block text-destructive">Error</Label>
                                      <p className="text-sm bg-destructive/10 text-destructive p-2 rounded font-mono">{run.error}</p>
                                    </div>
                                  </>
                                )}
                                {run.planOutput && (
                                  <>
                                    <Separator />
                                    <div>
                                      <Label className="text-muted-foreground mb-2 block">Plan Output</Label>
                                      <div className="bg-muted p-3 rounded space-y-2">
                                        <p className="text-sm font-medium">{run.planOutput.summary}</p>
                                        {run.planOutput.changes && (
                                          <div className="grid grid-cols-3 gap-2 mt-2">
                                            <div className="text-xs">
                                              <span className="text-green-600 dark:text-green-400 font-semibold">+{run.planOutput.changes.additions}</span>
                                              <span className="text-muted-foreground ml-1">additions</span>
                                            </div>
                                            <div className="text-xs">
                                              <span className="text-yellow-600 dark:text-yellow-400 font-semibold">~{run.planOutput.changes.changes}</span>
                                              <span className="text-muted-foreground ml-1">changes</span>
                                            </div>
                                            <div className="text-xs">
                                              <span className="text-red-600 dark:text-red-400 font-semibold">-{run.planOutput.changes.destructions}</span>
                                              <span className="text-muted-foreground ml-1">destructions</span>
                                            </div>
                                          </div>
                                        )}
                                        {run.planOutput.resourceChanges && run.planOutput.resourceChanges.length > 0 && (
                                          <div className="mt-3 space-y-1">
                                            <Label className="text-xs text-muted-foreground">Resource Changes:</Label>
                                            <div className="max-h-40 overflow-y-auto space-y-1">
                                              {run.planOutput.resourceChanges.map((change, idx) => (
                                                <div key={idx} className="text-xs font-mono bg-background p-1 rounded flex items-center gap-2">
                                                  <Badge 
                                                    variant="outline" 
                                                    className={`text-xs ${
                                                      change.action === 'create' ? 'bg-green-50 text-green-700 border-green-300' :
                                                      change.action === 'update' ? 'bg-yellow-50 text-yellow-700 border-yellow-300' :
                                                      change.action === 'delete' ? 'bg-red-50 text-red-700 border-red-300' :
                                                      'bg-orange-50 text-orange-700 border-orange-300'
                                                    }`}
                                                  >
                                                    {change.action}
                                                  </Badge>
                                                  <span className="flex-1">{change.address}</span>
                                                  <span className="text-muted-foreground">({change.type})</span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </>
                                )}
                                {run.applyOutput && (
                                  <>
                                    <Separator />
                                    <div>
                                      <Label className="text-muted-foreground mb-2 block">Apply Output</Label>
                                      <div className={`p-3 rounded space-y-2 ${
                                        run.applyOutput.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
                                      }`}>
                                        <p className={`text-sm font-medium ${
                                          run.applyOutput.success ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
                                        }`}>
                                          {run.applyOutput.summary}
                                        </p>
                                        {run.applyOutput.success && (
                                          <>
                                            {(run.applyOutput.resourcesCreated !== undefined || run.applyOutput.resourcesUpdated !== undefined || run.applyOutput.resourcesDestroyed !== undefined) && (
                                              <div className="grid grid-cols-3 gap-2 mt-2">
                                                {run.applyOutput.resourcesCreated !== undefined && run.applyOutput.resourcesCreated > 0 && (
                                                  <div className="text-xs">
                                                    <span className="text-green-600 dark:text-green-400 font-semibold">+{run.applyOutput.resourcesCreated}</span>
                                                    <span className="text-muted-foreground ml-1">created</span>
                                                  </div>
                                                )}
                                                {run.applyOutput.resourcesUpdated !== undefined && run.applyOutput.resourcesUpdated > 0 && (
                                                  <div className="text-xs">
                                                    <span className="text-yellow-600 dark:text-yellow-400 font-semibold">~{run.applyOutput.resourcesUpdated}</span>
                                                    <span className="text-muted-foreground ml-1">updated</span>
                                                  </div>
                                                )}
                                                {run.applyOutput.resourcesDestroyed !== undefined && run.applyOutput.resourcesDestroyed > 0 && (
                                                  <div className="text-xs">
                                                    <span className="text-red-600 dark:text-red-400 font-semibold">-{run.applyOutput.resourcesDestroyed}</span>
                                                    <span className="text-muted-foreground ml-1">destroyed</span>
                                                  </div>
                                                )}
                                              </div>
                                            )}
                                            {run.applyOutput.outputs && Object.keys(run.applyOutput.outputs).length > 0 && (
                                              <div className="mt-3 space-y-1">
                                                <Label className="text-xs text-muted-foreground">Outputs:</Label>
                                                <div className="space-y-1">
                                                  {Object.entries(run.applyOutput.outputs).map(([key, value]) => (
                                                    <div key={key} className="text-xs font-mono bg-background p-1 rounded">
                                                      <span className="text-blue-600 dark:text-blue-400">{key}</span> = <span className="text-green-600 dark:text-green-400">{String(value)}</span>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </>
                                )}
                              </div>
                            </>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="state" className="space-y-4">
            {/* State Comparison */}
            {(comparingStates.from || comparingStates.to) && (
              <Card className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>State Comparison</CardTitle>
                      <CardDescription>Compare two state versions</CardDescription>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setComparingStates({ from: null, to: null })}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const fromState = comparingStates.from ? displayStates.find((s: any) => s.id === comparingStates.from) : null;
                    const toState = comparingStates.to ? displayStates.find((s: any) => s.id === comparingStates.to) : null;
                    
                    if (!fromState || !toState) {
                      return (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          {!comparingStates.from && <p>Select "From" state version</p>}
                          {!comparingStates.to && <p>Select "To" state version</p>}
                        </div>
                      );
                    }
                    
                    const resourceDiff = (toState.resources || 0) - (fromState.resources || 0);
                    const outputsFrom = fromState.outputs || {};
                    const outputsTo = toState.outputs || {};
                    const outputKeys = new Set([...Object.keys(outputsFrom), ...Object.keys(outputsTo)]);
                    
                    return (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground">From Version</Label>
                            <div className="mt-1 p-2 bg-muted rounded">
                              <Badge variant="outline">v{fromState.version}</Badge>
                              <Badge variant="outline" className="ml-2">Serial: {fromState.serial}</Badge>
                              {fromState.resources !== undefined && (
                                <Badge variant="outline" className="ml-2">{fromState.resources} resources</Badge>
                              )}
                            </div>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">To Version</Label>
                            <div className="mt-1 p-2 bg-muted rounded">
                              <Badge variant="outline">v{toState.version}</Badge>
                              <Badge variant="outline" className="ml-2">Serial: {toState.serial}</Badge>
                              {toState.resources !== undefined && (
                                <Badge variant="outline" className="ml-2">{toState.resources} resources</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <Separator />
                        
                        <div>
                          <Label className="text-muted-foreground mb-2 block">Resource Changes</Label>
                          <div className={`p-3 rounded ${
                            resourceDiff > 0 ? 'bg-green-50 dark:bg-green-900/20' :
                            resourceDiff < 0 ? 'bg-red-50 dark:bg-red-900/20' :
                            'bg-muted'
                          }`}>
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {resourceDiff > 0 ? '+' : ''}{resourceDiff} resources
                              </span>
                              <span className="text-xs text-muted-foreground">
                                ({fromState.resources || 0} → {toState.resources || 0})
                              </span>
                            </div>
                          </div>
                        </div>
                        
                        {outputKeys.size > 0 && (
                          <>
                            <Separator />
                            <div>
                              <Label className="text-muted-foreground mb-2 block">Output Changes</Label>
                              <div className="space-y-2 max-h-64 overflow-y-auto">
                                {Array.from(outputKeys).map((key) => {
                                  const fromValue = outputsFrom[key];
                                  const toValue = outputsTo[key];
                                  const isAdded = fromValue === undefined && toValue !== undefined;
                                  const isRemoved = fromValue !== undefined && toValue === undefined;
                                  const isChanged = fromValue !== undefined && toValue !== undefined && String(fromValue) !== String(toValue);
                                  
                                  return (
                                    <div key={key} className={`p-2 rounded text-xs font-mono ${
                                      isAdded ? 'bg-green-50 dark:bg-green-900/20' :
                                      isRemoved ? 'bg-red-50 dark:bg-red-900/20' :
                                      isChanged ? 'bg-yellow-50 dark:bg-yellow-900/20' :
                                      'bg-muted'
                                    }`}>
                                      <div className="font-semibold text-blue-600 dark:text-blue-400 mb-1">{key}</div>
                                      {isAdded && (
                                        <div className="text-green-600 dark:text-green-400">
                                          + {String(toValue)}
                                        </div>
                                      )}
                                      {isRemoved && (
                                        <div className="text-red-600 dark:text-red-400">
                                          - {String(fromValue)}
                                        </div>
                                      )}
                                      {isChanged && (
                                        <div className="space-y-1">
                                          <div className="text-red-600 dark:text-red-400">
                                            - {String(fromValue)}
                                          </div>
                                          <div className="text-green-600 dark:text-green-400">
                                            + {String(toValue)}
                                          </div>
                                        </div>
                                      )}
                                      {!isAdded && !isRemoved && !isChanged && (
                                        <div className="text-muted-foreground">
                                          {String(fromValue)}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            )}
            
            <Card>
              <CardHeader>
                <CardTitle>State Management</CardTitle>
                <CardDescription>Terraform state versions</CardDescription>
              </CardHeader>
              <CardContent>
                {displayStates.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No state versions</p>
                ) : (
                  <div className="space-y-2">
                    {displayStates.map((state: any) => {
                      const isExpanded = expandedStates.has(state.id);
                      const updatedAt = state.updatedAt ? (typeof state.updatedAt === 'string' ? new Date(state.updatedAt) : new Date(state.updatedAt)) : null;
                      const createdAt = state.createdAt ? (typeof state.createdAt === 'string' ? new Date(state.createdAt) : new Date(state.createdAt)) : null;
                      const isSelectedForComparison = comparingStates.from === state.id || comparingStates.to === state.id;
                      
                      return (
                        <Card key={state.id} className={`border-l-4 ${isSelectedForComparison ? 'border-l-blue-500' : 'border-l-purple-500'}`}>
                          <CardContent className="pt-4">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2 flex-wrap">
                                  <Badge variant="outline">{state.workspaceName || state.workspace}</Badge>
                                  <Badge variant="outline">v{state.version}</Badge>
                                  <Badge variant="outline">Serial: {state.serial}</Badge>
                                  {state.resources !== undefined && (
                                    <Badge variant="outline">{state.resources} resources</Badge>
                                  )}
                                  {state.lineage && (
                                    <Badge variant="secondary" className="font-mono text-xs">
                                      Lineage: {state.lineage.substring(0, 8)}...
                                    </Badge>
                                  )}
                                  {isSelectedForComparison && (
                                    <Badge variant="default" className="bg-blue-500">
                                      {comparingStates.from === state.id ? 'From' : 'To'}
                                    </Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground space-y-1">
                                  {updatedAt && (
                                    <p>Updated: {updatedAt.toLocaleString()}</p>
                                  )}
                                  {createdAt && (
                                    <p>Created: {createdAt.toLocaleString()}</p>
                                  )}
                                </div>
                                
                                {isExpanded && (
                                  <div className="mt-4 space-y-4 pt-4 border-t">
                                    <div>
                                      <h4 className="text-sm font-semibold mb-2">State Details</h4>
                                      <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">State ID:</span>
                                          <span className="font-mono text-xs">{state.id}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Workspace ID:</span>
                                          <span className="font-mono text-xs">{state.workspaceId || 'N/A'}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Version:</span>
                                          <span>{state.version}</span>
                                        </div>
                                        <div className="flex justify-between">
                                          <span className="text-muted-foreground">Serial:</span>
                                          <span>{state.serial}</span>
                                        </div>
                                        {state.resources !== undefined && (
                                          <div className="flex justify-between">
                                            <span className="text-muted-foreground">Resources:</span>
                                            <span>{state.resources}</span>
                                          </div>
                                        )}
                                        {state.lineage && (
                                          <div>
                                            <span className="text-muted-foreground">Lineage:</span>
                                            <div className="mt-1 font-mono text-xs bg-muted p-2 rounded break-all">
                                              {state.lineage}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    
                                    {state.outputs && Object.keys(state.outputs).length > 0 && (
                                      <div>
                                        <h4 className="text-sm font-semibold mb-2">Outputs</h4>
                                        <div className="space-y-1">
                                          {Object.entries(state.outputs).map(([key, value]) => (
                                            <div key={key} className="text-xs font-mono bg-muted p-2 rounded">
                                              <span className="text-blue-600 font-semibold">{key}</span> = <span className="text-green-600">{String(value)}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    
                                    {(!state.outputs || Object.keys(state.outputs).length === 0) && (
                                      <div className="text-sm text-muted-foreground">
                                        No outputs available for this state version.
                                      </div>
                                    )}
                                    
                                    {/* Resource Changes History */}
                                    {(() => {
                                      // Find runs that led to this state version
                                      const stateRuns = displayRuns.filter((run: any) => {
                                        if (run.workspaceId !== state.workspaceId && run.workspace !== state.workspaceId && run.workspaceName !== state.workspaceName && run.workspace !== state.workspace) {
                                          return false;
                                        }
                                        // Find runs that completed before or at this state's creation time
                                        const runFinishedAt = run.finishedAt ? (typeof run.finishedAt === 'string' ? new Date(run.finishedAt).getTime() : run.finishedAt) : null;
                                        const stateCreatedAt = state.createdAt ? (typeof state.createdAt === 'string' ? new Date(state.createdAt).getTime() : state.createdAt) : null;
                                        if (!runFinishedAt || !stateCreatedAt) return false;
                                        
                                        // Find runs that finished before this state was created, but after previous state
                                        const previousState = displayStates
                                          .filter((s: any) => s.workspaceId === state.workspaceId || s.workspace === state.workspaceId || s.workspaceName === state.workspaceName || s.workspace === state.workspace)
                                          .filter((s: any) => s.version < state.version)
                                          .sort((a: any, b: any) => b.version - a.version)[0];
                                        
                                        const previousStateCreatedAt = previousState?.createdAt ? (typeof previousState.createdAt === 'string' ? new Date(previousState.createdAt).getTime() : previousState.createdAt) : 0;
                                        
                                        return runFinishedAt > previousStateCreatedAt && runFinishedAt <= stateCreatedAt && run.status === 'applied' && run.hasChanges;
                                      }).sort((a: any, b: any) => {
                                        const aTime = a.finishedAt ? (typeof a.finishedAt === 'string' ? new Date(a.finishedAt).getTime() : a.finishedAt) : 0;
                                        const bTime = b.finishedAt ? (typeof b.finishedAt === 'string' ? new Date(b.finishedAt).getTime() : b.finishedAt) : 0;
                                        return bTime - aTime;
                                      });
                                      
                                      if (stateRuns.length === 0) return null;
                                      
                                      return (
                                        <div>
                                          <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                                            <History className="h-4 w-4" />
                                            Resource Changes History
                                          </h4>
                                          <div className="space-y-2 max-h-64 overflow-y-auto">
                                            {stateRuns.map((run: any) => (
                                              <div key={run.id} className="p-2 bg-muted rounded text-xs">
                                                <div className="flex items-center justify-between mb-1">
                                                  <span className="font-mono text-xs">{run.id}</span>
                                                  <span className="text-muted-foreground">
                                                    {run.finishedAt ? (
                                                      typeof run.finishedAt === 'string' 
                                                        ? new Date(run.finishedAt).toLocaleString()
                                                        : new Date(run.finishedAt).toLocaleString()
                                                    ) : 'Unknown'}
                                                  </span>
                                                </div>
                                                {(run.resourceAdditions || run.resourceChanges || run.resourceDestructions) && (
                                                  <div className="flex items-center gap-2 mt-1">
                                                    {run.resourceAdditions !== undefined && run.resourceAdditions > 0 && (
                                                      <Badge variant="outline" className="bg-green-50 text-green-700 text-xs">+{run.resourceAdditions}</Badge>
                                                    )}
                                                    {run.resourceChanges !== undefined && run.resourceChanges > 0 && (
                                                      <Badge variant="outline" className="bg-yellow-50 text-yellow-700 text-xs">~{run.resourceChanges}</Badge>
                                                    )}
                                                    {run.resourceDestructions !== undefined && run.resourceDestructions > 0 && (
                                                      <Badge variant="outline" className="bg-red-50 text-red-700 text-xs">-{run.resourceDestructions}</Badge>
                                                    )}
                                                  </div>
                                                )}
                                                {run.planOutput?.resourceChanges && run.planOutput.resourceChanges.length > 0 && (
                                                  <div className="mt-2 space-y-1">
                                                    {run.planOutput.resourceChanges.slice(0, 3).map((change: any, idx: number) => (
                                                      <div key={idx} className="text-xs font-mono">
                                                        <Badge 
                                                          variant="outline" 
                                                          className={`text-xs ${
                                                            change.action === 'create' ? 'bg-green-50 text-green-700 border-green-300' :
                                                            change.action === 'update' ? 'bg-yellow-50 text-yellow-700 border-yellow-300' :
                                                            change.action === 'delete' ? 'bg-red-50 text-red-700 border-red-300' :
                                                            'bg-orange-50 text-orange-700 border-orange-300'
                                                          }`}
                                                        >
                                                          {change.action}
                                                        </Badge>
                                                        <span className="ml-2">{change.address}</span>
                                                      </div>
                                                    ))}
                                                    {run.planOutput.resourceChanges.length > 3 && (
                                                      <p className="text-xs text-muted-foreground">...and {run.planOutput.resourceChanges.length - 3} more changes</p>
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>
                                )}
                                
                                {!isExpanded && state.outputs && Object.keys(state.outputs).length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-xs font-semibold text-muted-foreground mb-1">Outputs ({Object.keys(state.outputs).length}):</p>
                                    <div className="space-y-1">
                                      {Object.entries(state.outputs).slice(0, 2).map(([key, value]) => (
                                        <div key={key} className="text-xs font-mono bg-muted p-1 rounded">
                                          <span className="text-blue-600">{key}</span> = <span className="text-green-600">{String(value)}</span>
                                        </div>
                                      ))}
                                      {Object.keys(state.outputs).length > 2 && (
                                        <p className="text-xs text-muted-foreground">...and {Object.keys(state.outputs).length - 2} more</p>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                {displayStates.length > 1 && (
                                  <>
                                    {!comparingStates.from ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setComparingStates({ ...comparingStates, from: state.id })}
                                        title="Select as 'From' version"
                                      >
                                        <GitCompare className="h-4 w-4 mr-1" />
                                        From
                                      </Button>
                                    ) : comparingStates.from === state.id ? (
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => setComparingStates({ ...comparingStates, from: null })}
                                        title="Clear 'From' selection"
                                      >
                                        <X className="h-4 w-4 mr-1" />
                                        From
                                      </Button>
                                    ) : null}
                                    {!comparingStates.to ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setComparingStates({ ...comparingStates, to: state.id })}
                                        title="Select as 'To' version"
                                      >
                                        <GitCompare className="h-4 w-4 mr-1" />
                                        To
                                      </Button>
                                    ) : comparingStates.to === state.id ? (
                                      <Button
                                        variant="default"
                                        size="sm"
                                        onClick={() => setComparingStates({ ...comparingStates, to: null })}
                                        title="Clear 'To' selection"
                                      >
                                        <X className="h-4 w-4 mr-1" />
                                        To
                                      </Button>
                                    ) : null}
                                  </>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => {
                                    const newExpanded = new Set(expandedStates);
                                    if (isExpanded) {
                                      newExpanded.delete(state.id);
                                    } else {
                                      newExpanded.add(state.id);
                                    }
                                    setExpandedStates(newExpanded);
                                  }}
                                >
                                  {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </Button>
                              </div>
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

          <TabsContent value="variables" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Workspace Variables</CardTitle>
                    <CardDescription>Manage Terraform and Environment variables</CardDescription>
                  </div>
                  <Button 
                    onClick={() => setShowAddVariable(true)} 
                    size="sm"
                    disabled={!selectedWorkspaceForVars}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Variable
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Workspace</Label>
                  <Select
                    value={selectedWorkspaceForVars}
                    onValueChange={(value) => {
                      setSelectedWorkspaceForVars(value);
                      setShowAddVariable(false);
                      setEditingVariable(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a workspace" />
                    </SelectTrigger>
                    <SelectContent>
                      {displayWorkspaces.map((ws) => (
                        <SelectItem key={ws.id} value={ws.id}>
                          {ws.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedWorkspaceForVars && (
                  <>
                    {showAddVariable && (
                      <Card className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Add New Variable</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Key *</Label>
                              <Input
                                value={newVariable.key || ''}
                                onChange={(e) => setNewVariable({ ...newVariable, key: e.target.value })}
                                placeholder="VARIABLE_NAME"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Category</Label>
                              <Select
                                value={newVariable.category || 'terraform'}
                                onValueChange={(value: 'terraform' | 'env') => setNewVariable({ ...newVariable, category: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="terraform">Terraform Variable</SelectItem>
                                  <SelectItem value="env">Environment Variable</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2 col-span-2">
                              <Label>Value *</Label>
                              <Textarea
                                value={newVariable.value || ''}
                                onChange={(e) => setNewVariable({ ...newVariable, value: e.target.value })}
                                placeholder="variable value"
                                rows={3}
                              />
                            </div>
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={newVariable.sensitive || false}
                                onCheckedChange={(checked) => setNewVariable({ ...newVariable, sensitive: checked })}
                              />
                              <Label>Sensitive (masked)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Switch
                                checked={newVariable.hcl || false}
                                onCheckedChange={(checked) => setNewVariable({ ...newVariable, hcl: checked })}
                              />
                              <Label>HCL</Label>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={addVariable} size="sm">
                              <Save className="h-4 w-4 mr-2" />
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowAddVariable(false);
                                setNewVariable({ key: '', value: '', category: 'terraform', sensitive: false, hcl: false });
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {workspaceVariables.length === 0 && !showAddVariable ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No variables configured</p>
                    ) : (
                      <div className="space-y-2">
                        {workspaceVariables.map((variable) => (
                          <Card key={variable.id} className="border-l-4 border-l-blue-500">
                            <CardContent className="pt-4">
                              {editingVariable === variable.id ? (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Key</Label>
                                      <Input value={variable.key} disabled />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Category</Label>
                                      <Select
                                        value={variable.category}
                                        onValueChange={(value: 'terraform' | 'env') => updateVariable(variable.key, { category: value })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="terraform">Terraform Variable</SelectItem>
                                          <SelectItem value="env">Environment Variable</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2 col-span-2">
                                      <Label>Value</Label>
                                      <Textarea
                                        value={variable.sensitive ? '••••••••' : variable.value}
                                        onChange={(e) => updateVariable(variable.key, { value: e.target.value })}
                                        rows={3}
                                        disabled={variable.sensitive}
                                      />
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        checked={variable.sensitive}
                                        onCheckedChange={(checked) => updateVariable(variable.key, { sensitive: checked })}
                                      />
                                      <Label>Sensitive</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                      <Switch
                                        checked={variable.hcl}
                                        onCheckedChange={(checked) => updateVariable(variable.key, { hcl: checked })}
                                      />
                                      <Label>HCL</Label>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button onClick={() => setEditingVariable(null)} size="sm" variant="outline">
                                      Done
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="outline" className="font-mono">{variable.key}</Badge>
                                      <Badge variant="secondary">{variable.category}</Badge>
                                      {variable.sensitive && <Badge variant="outline">Sensitive</Badge>}
                                      {variable.hcl && <Badge variant="outline">HCL</Badge>}
                                    </div>
                                    <div className="text-sm text-muted-foreground font-mono">
                                      {variable.sensitive ? '••••••••' : variable.value}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setEditingVariable(variable.id)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    {confirmingDeleteVariable === variable.key ? (
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => deleteVariable(variable.key)}
                                        >
                                          Confirm
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setConfirmingDeleteVariable(null)}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setConfirmingDeleteVariable(variable.key)}
                                        className="hover:bg-destructive/10 hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Notification Configurations</CardTitle>
                    <CardDescription>Configure notifications for run events</CardDescription>
                  </div>
                  <Button 
                    onClick={() => setShowAddNotification(true)} 
                    size="sm"
                    disabled={!selectedWorkspaceForNotifs}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Notification
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Workspace</Label>
                  <Select
                    value={selectedWorkspaceForNotifs}
                    onValueChange={(value) => {
                      setSelectedWorkspaceForNotifs(value);
                      setShowAddNotification(false);
                      setEditingNotification(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a workspace" />
                    </SelectTrigger>
                    <SelectContent>
                      {displayWorkspaces.map((ws) => (
                        <SelectItem key={ws.id} value={ws.id}>
                          {ws.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedWorkspaceForNotifs && (
                  <>
                    {showAddNotification && (
                      <Card className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base">Add New Notification</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Name *</Label>
                              <Input
                                value={newNotification.name || ''}
                                onChange={(e) => setNewNotification({ ...newNotification, name: e.target.value })}
                                placeholder="Notification name"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Type</Label>
                              <Select
                                value={newNotification.type || 'webhook'}
                                onValueChange={(value: 'slack' | 'email' | 'webhook' | 'component') => setNewNotification({ ...newNotification, type: value })}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="webhook">Webhook</SelectItem>
                                  <SelectItem value="slack">Slack</SelectItem>
                                  <SelectItem value="email">Email</SelectItem>
                                  <SelectItem value="component">Component</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2 col-span-2">
                              <Label>Destination *</Label>
                              {newNotification.type === 'component' ? (
                                <Select
                                  value={newNotification.destination || ''}
                                  onValueChange={(value) => setNewNotification({ ...newNotification, destination: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select target component" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {nodes.filter(n => n.id !== componentId).map((node) => (
                                      <SelectItem key={node.id} value={node.id}>
                                        {node.data?.label || node.type}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <Input
                                  value={newNotification.destination || ''}
                                  onChange={(e) => setNewNotification({ ...newNotification, destination: e.target.value })}
                                  placeholder={newNotification.type === 'email' ? 'email@example.com' : 'https://webhook.url'}
                                />
                              )}
                            </div>
                            <div className="space-y-2 col-span-2">
                              <Label>Conditions *</Label>
                              <div className="flex flex-wrap gap-2">
                                {(['on_success', 'on_failure', 'on_start'] as const).map((condition) => (
                                  <div key={condition} className="flex items-center space-x-2">
                                    <input
                                      type="checkbox"
                                      checked={newNotification.conditions?.includes(condition) || false}
                                      onChange={(e) => {
                                        const conditions = newNotification.conditions || [];
                                        if (e.target.checked) {
                                          setNewNotification({ ...newNotification, conditions: [...conditions, condition] });
                                        } else {
                                          setNewNotification({ ...newNotification, conditions: conditions.filter(c => c !== condition) });
                                        }
                                      }}
                                      className="rounded"
                                    />
                                    <Label className="text-sm">{condition.replace('_', ' ')}</Label>
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 col-span-2">
                              <Switch
                                checked={newNotification.enabled !== false}
                                onCheckedChange={(checked) => setNewNotification({ ...newNotification, enabled: checked })}
                              />
                              <Label>Enabled</Label>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button onClick={addNotification} size="sm">
                              <Save className="h-4 w-4 mr-2" />
                              Save
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setShowAddNotification(false);
                                setNewNotification({ name: '', type: 'webhook', destination: '', conditions: [], enabled: true });
                              }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {workspaceNotifications.length === 0 && !showAddNotification ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No notifications configured</p>
                    ) : (
                      <div className="space-y-2">
                        {workspaceNotifications.map((notification) => (
                          <Card key={notification.id} className="border-l-4 border-l-blue-500">
                            <CardContent className="pt-4">
                              {editingNotification === notification.id ? (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Name</Label>
                                      <Input
                                        value={notification.name}
                                        onChange={(e) => updateNotification(notification.id, { name: e.target.value })}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Type</Label>
                                      <Select
                                        value={notification.type}
                                        onValueChange={(value: 'slack' | 'email' | 'webhook' | 'component') => updateNotification(notification.id, { type: value })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="webhook">Webhook</SelectItem>
                                          <SelectItem value="slack">Slack</SelectItem>
                                          <SelectItem value="email">Email</SelectItem>
                                          <SelectItem value="component">Component</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2 col-span-2">
                                      <Label>Destination</Label>
                                      {notification.type === 'component' ? (
                                        <Select
                                          value={notification.destination}
                                          onValueChange={(value) => updateNotification(notification.id, { destination: value })}
                                        >
                                          <SelectTrigger>
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {nodes.filter(n => n.id !== componentId).map((node) => (
                                              <SelectItem key={node.id} value={node.id}>
                                                {node.data?.label || node.type}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <Input
                                          value={notification.destination}
                                          onChange={(e) => updateNotification(notification.id, { destination: e.target.value })}
                                        />
                                      )}
                                    </div>
                                    <div className="space-y-2 col-span-2">
                                      <Label>Conditions</Label>
                                      <div className="flex flex-wrap gap-2">
                                        {(['on_success', 'on_failure', 'on_start'] as const).map((condition) => (
                                          <div key={condition} className="flex items-center space-x-2">
                                            <input
                                              type="checkbox"
                                              checked={notification.conditions.includes(condition)}
                                              onChange={(e) => {
                                                const conditions = notification.conditions;
                                                if (e.target.checked) {
                                                  updateNotification(notification.id, { conditions: [...conditions, condition] });
                                                } else {
                                                  updateNotification(notification.id, { conditions: conditions.filter(c => c !== condition) });
                                                }
                                              }}
                                              className="rounded"
                                            />
                                            <Label className="text-sm">{condition.replace('_', ' ')}</Label>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                    <div className="flex items-center space-x-2 col-span-2">
                                      <Switch
                                        checked={notification.enabled}
                                        onCheckedChange={(checked) => updateNotification(notification.id, { enabled: checked })}
                                      />
                                      <Label>Enabled</Label>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button onClick={() => setEditingNotification(null)} size="sm" variant="outline">
                                      Done
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="outline">{notification.name}</Badge>
                                      <Badge variant="secondary">{notification.type}</Badge>
                                      {notification.enabled ? (
                                        <Badge variant="default">Enabled</Badge>
                                      ) : (
                                        <Badge variant="outline">Disabled</Badge>
                                      )}
                                    </div>
                                    <div className="text-sm text-muted-foreground mb-2">
                                      Destination: {notification.type === 'component' ? nodes.find(n => n.id === notification.destination)?.data?.label || notification.destination : notification.destination}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {notification.conditions.map((condition) => (
                                        <Badge key={condition} variant="outline" className="text-xs">
                                          {condition.replace('_', ' ')}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => setEditingNotification(notification.id)}
                                    >
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    {confirmingDeleteNotification === notification.id ? (
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => deleteNotification(notification.id)}
                                        >
                                          Confirm
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => setConfirmingDeleteNotification(null)}
                                        >
                                          Cancel
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setConfirmingDeleteNotification(notification.id)}
                                        className="hover:bg-destructive/10 hover:text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="policies" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Run Policies</CardTitle>
                <CardDescription>
                  Configure approval workflows and policy checks for runs
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Select Workspace</Label>
                  <Select
                    value={selectedWorkspaceForPolicies || ''}
                    onValueChange={(value) => {
                      setSelectedWorkspaceForPolicies(value);
                      setShowAddPolicy(false);
                      setEditingPolicy(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select workspace" />
                    </SelectTrigger>
                    <SelectContent>
                      {displayWorkspaces.map((ws: any) => (
                        <SelectItem key={ws.id} value={ws.id}>
                          {ws.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {selectedWorkspaceForPolicies && (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Policies</h3>
                      {!showAddPolicy && (
                        <Button onClick={() => setShowAddPolicy(true)} size="sm">
                          <Plus className="h-4 w-4 mr-2" />
                          Add Policy
                        </Button>
                      )}
                    </div>

                    {showAddPolicy && (
                      <Card className="border-2 border-dashed">
                        <CardContent className="pt-6">
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Policy Name</Label>
                                <Input
                                  value={newPolicy.name}
                                  onChange={(e) => setNewPolicy({ ...newPolicy, name: e.target.value })}
                                  placeholder="e.g., Require approval for applies"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Policy Type</Label>
                                <Select
                                  value={newPolicy.type}
                                  onValueChange={(value: 'manual_approval' | 'sentinel' | 'opa') => setNewPolicy({ ...newPolicy, type: value })}
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="manual_approval">Manual Approval</SelectItem>
                                    <SelectItem value="sentinel">Sentinel</SelectItem>
                                    <SelectItem value="opa">OPA</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2 col-span-2">
                                <Label>Description (optional)</Label>
                                <Textarea
                                  value={newPolicy.description || ''}
                                  onChange={(e) => setNewPolicy({ ...newPolicy, description: e.target.value })}
                                  placeholder="Describe what this policy checks"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Apply to Plan-Only Runs</Label>
                                <Switch
                                  checked={newPolicy.conditions?.onPlanOnly || false}
                                  onCheckedChange={(checked) => setNewPolicy({ ...newPolicy, conditions: { ...newPolicy.conditions, onPlanOnly: checked } })}
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Apply to Apply Runs</Label>
                                <Switch
                                  checked={newPolicy.conditions?.onApply || false}
                                  onCheckedChange={(checked) => setNewPolicy({ ...newPolicy, conditions: { ...newPolicy.conditions, onApply: checked } })}
                                />
                              </div>
                              {newPolicy.type !== 'manual_approval' && (
                                <>
                                  <div className="space-y-2">
                                    <Label>Min Resource Changes</Label>
                                    <Input
                                      type="number"
                                      value={newPolicy.conditions?.minResourceChanges || ''}
                                      onChange={(e) => setNewPolicy({ ...newPolicy, conditions: { ...newPolicy.conditions, minResourceChanges: e.target.value ? parseInt(e.target.value) : undefined } })}
                                      placeholder="Optional"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Require Destruction</Label>
                                    <Switch
                                      checked={newPolicy.conditions?.requireDestruction || false}
                                      onCheckedChange={(checked) => setNewPolicy({ ...newPolicy, conditions: { ...newPolicy.conditions, requireDestruction: checked } })}
                                    />
                                  </div>
                                </>
                              )}
                              <div className="flex items-center space-x-2 col-span-2">
                                <Switch
                                  checked={newPolicy.enabled}
                                  onCheckedChange={(checked) => setNewPolicy({ ...newPolicy, enabled: checked })}
                                />
                                <Label>Enabled</Label>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button onClick={addPolicy} size="sm">
                                Add Policy
                              </Button>
                              <Button onClick={() => { setShowAddPolicy(false); setNewPolicy({ name: '', type: 'manual_approval', enabled: true }); }} size="sm" variant="outline">
                                Cancel
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    <div className="space-y-2">
                      {workspacePolicies.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          No policies configured. Add a policy to require approvals or run checks.
                        </div>
                      ) : (
                        workspacePolicies.map((policy) => (
                          <Card key={policy.id}>
                            <CardContent className="pt-6">
                              {editingPolicy === policy.id ? (
                                <div className="space-y-4">
                                  <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                      <Label>Policy Name</Label>
                                      <Input
                                        value={policy.name}
                                        onChange={(e) => updatePolicy(policy.id, { name: e.target.value })}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Policy Type</Label>
                                      <Select
                                        value={policy.type}
                                        onValueChange={(value: 'manual_approval' | 'sentinel' | 'opa') => updatePolicy(policy.id, { type: value })}
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="manual_approval">Manual Approval</SelectItem>
                                          <SelectItem value="sentinel">Sentinel</SelectItem>
                                          <SelectItem value="opa">OPA</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2 col-span-2">
                                      <Label>Description</Label>
                                      <Textarea
                                        value={policy.description || ''}
                                        onChange={(e) => updatePolicy(policy.id, { description: e.target.value })}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Apply to Plan-Only Runs</Label>
                                      <Switch
                                        checked={policy.conditions?.onPlanOnly || false}
                                        onCheckedChange={(checked) => updatePolicy(policy.id, { conditions: { ...policy.conditions, onPlanOnly: checked } })}
                                      />
                                    </div>
                                    <div className="space-y-2">
                                      <Label>Apply to Apply Runs</Label>
                                      <Switch
                                        checked={policy.conditions?.onApply || false}
                                        onCheckedChange={(checked) => updatePolicy(policy.id, { conditions: { ...policy.conditions, onApply: checked } })}
                                      />
                                    </div>
                                    {policy.type !== 'manual_approval' && (
                                      <>
                                        <div className="space-y-2">
                                          <Label>Min Resource Changes</Label>
                                          <Input
                                            type="number"
                                            value={policy.conditions?.minResourceChanges || ''}
                                            onChange={(e) => updatePolicy(policy.id, { conditions: { ...policy.conditions, minResourceChanges: e.target.value ? parseInt(e.target.value) : undefined } })}
                                          />
                                        </div>
                                        <div className="space-y-2">
                                          <Label>Require Destruction</Label>
                                          <Switch
                                            checked={policy.conditions?.requireDestruction || false}
                                            onCheckedChange={(checked) => updatePolicy(policy.id, { conditions: { ...policy.conditions, requireDestruction: checked } })}
                                          />
                                        </div>
                                      </>
                                    )}
                                    <div className="flex items-center space-x-2 col-span-2">
                                      <Switch
                                        checked={policy.enabled}
                                        onCheckedChange={(checked) => updatePolicy(policy.id, { enabled: checked })}
                                      />
                                      <Label>Enabled</Label>
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button onClick={() => setEditingPolicy(null)} size="sm" variant="outline">
                                      Done
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-start justify-between">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="outline">{policy.name}</Badge>
                                      <Badge variant="secondary">{policy.type}</Badge>
                                      {policy.enabled ? (
                                        <Badge variant="default">Enabled</Badge>
                                      ) : (
                                        <Badge variant="outline">Disabled</Badge>
                                      )}
                                    </div>
                                    {policy.description && (
                                      <div className="text-sm text-muted-foreground mb-2">
                                        {policy.description}
                                      </div>
                                    )}
                                    <div className="flex flex-wrap gap-1">
                                      {policy.conditions?.onPlanOnly && (
                                        <Badge variant="outline" className="text-xs">Plan-Only</Badge>
                                      )}
                                      {policy.conditions?.onApply && (
                                        <Badge variant="outline" className="text-xs">Apply</Badge>
                                      )}
                                      {policy.conditions?.minResourceChanges && (
                                        <Badge variant="outline" className="text-xs">Min Changes: {policy.conditions.minResourceChanges}</Badge>
                                      )}
                                      {policy.conditions?.requireDestruction && (
                                        <Badge variant="outline" className="text-xs">Requires Destruction</Badge>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex gap-2">
                                    <Button onClick={() => setEditingPolicy(policy.id)} size="sm" variant="outline">
                                      <Edit className="h-4 w-4" />
                                    </Button>
                                    {confirmingDeletePolicy === policy.id ? (
                                      <div className="flex gap-2">
                                        <Button onClick={() => deletePolicy(policy.id)} size="sm" variant="destructive">
                                          Confirm
                                        </Button>
                                        <Button onClick={() => setConfirmingDeletePolicy(null)} size="sm" variant="outline">
                                          Cancel
                                        </Button>
                                      </div>
                                    ) : (
                                      <Button onClick={() => setConfirmingDeletePolicy(policy.id)} size="sm" variant="destructive">
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Organization Settings</CardTitle>
                <CardDescription>Organization-level configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="organizationName">Organization Name</Label>
                  <Input
                    id="organizationName"
                    value={config.organizationName || 'archiphoenix'}
                    onChange={(e) => updateConfig({ organizationName: e.target.value })}
                    placeholder="archiphoenix"
                  />
                  <p className="text-xs text-muted-foreground">Organization name for Terraform Cloud/Enterprise</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Terraform Settings</CardTitle>
                <CardDescription>Global configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Default Terraform Version</Label>
                  <Select
                    value={config.defaultTerraformVersion || '1.5.0'}
                    onValueChange={(value) => updateConfig({ defaultTerraformVersion: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1.5.0">1.5.0</SelectItem>
                      <SelectItem value="1.4.0">1.4.0</SelectItem>
                      <SelectItem value="1.3.0">1.3.0</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable State Locking</Label>
                    <p className="text-xs text-muted-foreground">Prevents concurrent modifications</p>
                  </div>
                  <Switch
                    checked={config.enableStateLocking !== false}
                    onCheckedChange={(checked) => updateConfig({ enableStateLocking: checked })}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable Remote State</Label>
                    <p className="text-xs text-muted-foreground">Store state remotely</p>
                  </div>
                  <Switch
                    checked={config.enableRemoteState !== false}
                    onCheckedChange={(checked) => updateConfig({ enableRemoteState: checked })}
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Enable VCS Integration</Label>
                    <p className="text-xs text-muted-foreground">Connect to version control</p>
                  </div>
                  <Switch
                    checked={config.enableVCS !== false}
                    onCheckedChange={(checked) => updateConfig({ enableVCS: checked })}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Simulation Settings</CardTitle>
                <CardDescription>Configure simulation behavior</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="runTriggerRate">Run Trigger Rate (runs/hour)</Label>
                  <Input
                    id="runTriggerRate"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={config.runTriggerRate ?? 0.5}
                    onChange={(e) => updateConfig({ runTriggerRate: parseFloat(e.target.value) || 0.5 })}
                  />
                  <p className="text-xs text-muted-foreground">Number of runs per hour per workspace</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="failureRate">Failure Rate</Label>
                  <Input
                    id="failureRate"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={config.failureRate ?? 0.05}
                    onChange={(e) => updateConfig({ failureRate: parseFloat(e.target.value) || 0.05 })}
                  />
                  <p className="text-xs text-muted-foreground">Probability of run failure (0-1)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="vcsWebhookProbability">VCS Webhook Probability</Label>
                  <Input
                    id="vcsWebhookProbability"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={config.vcsWebhookProbability ?? 0.3}
                    onChange={(e) => updateConfig({ vcsWebhookProbability: parseFloat(e.target.value) || 0.3 })}
                  />
                  <p className="text-xs text-muted-foreground">Probability of VCS webhook per hour (0-1)</p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="averagePlanDuration">Average Plan Duration (ms)</Label>
                  <Input
                    id="averagePlanDuration"
                    type="number"
                    step="1000"
                    min="1000"
                    value={config.averagePlanDuration ?? 30000}
                    onChange={(e) => updateConfig({ averagePlanDuration: parseInt(e.target.value) || 30000 })}
                  />
                  <p className="text-xs text-muted-foreground">Base duration for plan phase in milliseconds</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="averageApplyDuration">Average Apply Duration (ms)</Label>
                  <Input
                    id="averageApplyDuration"
                    type="number"
                    step="1000"
                    min="1000"
                    value={config.averageApplyDuration ?? 120000}
                    onChange={(e) => updateConfig({ averageApplyDuration: parseInt(e.target.value) || 120000 })}
                  />
                  <p className="text-xs text-muted-foreground">Base duration for apply phase in milliseconds</p>
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label htmlFor="changeProbability">Change Probability</Label>
                  <Input
                    id="changeProbability"
                    type="number"
                    step="0.01"
                    min="0"
                    max="1"
                    value={config.changeProbability ?? 0.7}
                    onChange={(e) => updateConfig({ changeProbability: parseFloat(e.target.value) || 0.7 })}
                  />
                  <p className="text-xs text-muted-foreground">Probability of changes in plan (0-1)</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultStateResources">Default State Resources</Label>
                  <Input
                    id="defaultStateResources"
                    type="number"
                    step="1"
                    min="0"
                    value={config.defaultStateResources ?? 10}
                    onChange={(e) => updateConfig({ defaultStateResources: parseInt(e.target.value) || 10 })}
                  />
                  <p className="text-xs text-muted-foreground">Default number of resources for new state</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

