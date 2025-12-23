import { useState, useEffect } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { useEmulationStore } from '@/store/useEmulationStore';
import { emulationEngine } from '@/core/EmulationEngine';
import { AnsibleEmulationEngine, AnsibleInventory, AnsibleJobTemplate, AnsibleJob } from '@/core/AnsibleEmulationEngine';
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
  Server,
  FileText,
  Users,
  Layers,
  Clock,
  FolderGit2,
  Key,
  Calendar,
  Edit,
  Search,
  X,
  AlertCircle
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface AnsibleConfigProps {
  componentId: string;
}

interface Inventory {
  id: string;
  name: string;
  type: 'static' | 'dynamic';
  hosts?: Array<{
    name: string;
    groups: string[];
    variables?: Record<string, any>;
  }>;
  groups?: Array<{
    name: string;
    hosts: string[];
    variables?: Record<string, any>;
  }>;
}

interface JobTemplate {
  id: string;
  name: string;
  playbook: string;
  inventory: string;
  enabled: boolean;
  become?: boolean;
  becomeUser?: string;
  forks?: number;
  timeout?: number;
  lastRun?: {
    id: string;
    status: 'running' | 'successful' | 'failed';
    startedAt: string;
    finishedAt?: string;
  };
}

interface Job {
  id: string;
  template: string;
  status: 'running' | 'successful' | 'failed' | 'canceled';
  startedAt: string;
  finishedAt?: string;
  duration?: number;
  hosts?: Array<{
    name: string;
    status: 'ok' | 'changed' | 'failed' | 'skipped' | 'unreachable';
  }>;
}

interface AnsibleConfig {
  inventories?: Inventory[];
  jobTemplates?: JobTemplate[];
  jobs?: Job[];
  totalInventories?: number;
  totalTemplates?: number;
  activeJobs?: number;
  successfulJobs?: number;
}

export function AnsibleConfigAdvanced({ componentId }: AnsibleConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { isRunning, getComponentMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Get Ansible emulation engine
  const ansibleEngine = emulationEngine.getAnsibleEmulationEngine(componentId);
  const componentMetrics = getComponentMetrics(componentId);

  const config = (node.data.config as any) || {} as AnsibleConfig;
  
  // Real-time data from emulation
  const [realInventories, setRealInventories] = useState<AnsibleInventory[]>([]);
  const [realJobTemplates, setRealJobTemplates] = useState<AnsibleJobTemplate[]>([]);
  const [realJobs, setRealJobs] = useState<AnsibleJob[]>([]);
  const [realProjects, setRealProjects] = useState<any[]>([]);
  const [realCredentials, setRealCredentials] = useState<any[]>([]);
  const [realSchedules, setRealSchedules] = useState<any[]>([]);
  const [realMetrics, setRealMetrics] = useState<any>(null);

  // UI State - Inventories
  const [editingInventoryIndex, setEditingInventoryIndex] = useState<number | null>(null);
  const [showCreateInventory, setShowCreateInventory] = useState(false);
  const [inventoryToDelete, setInventoryToDelete] = useState<string | null>(null);
  const [editingInventoryHosts, setEditingInventoryHosts] = useState<string | null>(null);
  const [editingInventoryGroups, setEditingInventoryGroups] = useState<string | null>(null);
  const [newHostName, setNewHostName] = useState('');
  const [newHostGroups, setNewHostGroups] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupHosts, setNewGroupHosts] = useState('');

  // UI State - Job Templates
  const [editingTemplateIndex, setEditingTemplateIndex] = useState<number | null>(null);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

  // UI State - Jobs
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [showJobDetails, setShowJobDetails] = useState(false);
  const [jobLogs, setJobLogs] = useState<string[]>([]);

  // UI State - Projects
  const [showCreateProject, setShowCreateProject] = useState(false);
  const [editingProject, setEditingProject] = useState<string | null>(null);
  const [projectToDelete, setProjectToDelete] = useState<string | null>(null);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState('');
  const [projectScmType, setProjectScmType] = useState<'git' | 'svn' | 'insights' | 'manual' | 'archive'>('manual');
  const [projectScmUrl, setProjectScmUrl] = useState('');
  const [projectScmBranch, setProjectScmBranch] = useState('main');
  const [projectPlaybooks, setProjectPlaybooks] = useState('playbook.yml');

  // UI State - Credentials
  const [showCreateCredential, setShowCreateCredential] = useState(false);
  const [editingCredential, setEditingCredential] = useState<string | null>(null);
  const [credentialToDelete, setCredentialToDelete] = useState<string | null>(null);
  const [credentialName, setCredentialName] = useState('');
  const [credentialDescription, setCredentialDescription] = useState('');
  const [credentialType, setCredentialType] = useState<'machine' | 'vault' | 'source_control' | 'cloud' | 'network' | 'insights'>('machine');
  // Machine credential fields
  const [credentialUsername, setCredentialUsername] = useState('');
  const [credentialPassword, setCredentialPassword] = useState('');
  const [credentialSshKey, setCredentialSshKey] = useState('');
  const [credentialSshKeyUnlock, setCredentialSshKeyUnlock] = useState('');
  const [credentialBecomeMethod, setCredentialBecomeMethod] = useState<'sudo' | 'su' | 'pbrun' | 'pfexec' | 'dzdo' | 'pmrun' | 'runas'>('sudo');
  const [credentialBecomeUsername, setCredentialBecomeUsername] = useState('');
  const [credentialBecomePassword, setCredentialBecomePassword] = useState('');
  // Vault credential fields
  const [credentialVaultPassword, setCredentialVaultPassword] = useState('');
  const [credentialVaultId, setCredentialVaultId] = useState('');
  // Cloud credential fields
  const [credentialCloudProvider, setCredentialCloudProvider] = useState<'aws' | 'azure' | 'gcp' | 'openstack'>('aws');
  // Source control credential fields
  const [credentialScmUsername, setCredentialScmUsername] = useState('');
  const [credentialScmPassword, setCredentialScmPassword] = useState('');
  const [credentialScmSshKey, setCredentialScmSshKey] = useState('');

  // UI State - Schedules
  const [showCreateSchedule, setShowCreateSchedule] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<string | null>(null);
  const [scheduleToDelete, setScheduleToDelete] = useState<string | null>(null);
  const [scheduleName, setScheduleName] = useState('');
  const [scheduleDescription, setScheduleDescription] = useState('');
  const [scheduleJobTemplate, setScheduleJobTemplate] = useState('');
  const [scheduleEnabled, setScheduleEnabled] = useState(true);
  const [scheduleRrule, setScheduleRrule] = useState('DTSTART:20240101T000000Z\nRRULE:FREQ=HOURLY;INTERVAL=1');
  const [scheduleTimezone, setScheduleTimezone] = useState('UTC');
  const [scheduleExtraVars, setScheduleExtraVars] = useState('');
  const [scheduleLimit, setScheduleLimit] = useState('');
  
  // Update real-time data from emulation
  useEffect(() => {
    if (!ansibleEngine) return;
    
    const updateData = () => {
      try {
        const inventories = ansibleEngine.getInventories();
        const jobTemplates = ansibleEngine.getJobTemplates();
        const jobs = ansibleEngine.getAllJobs();
        const projects = ansibleEngine.getProjects();
        const credentials = ansibleEngine.getCredentials();
        const schedules = ansibleEngine.getSchedules();
        const metrics = ansibleEngine.getMetrics();
        
        setRealInventories(inventories);
        setRealJobTemplates(jobTemplates);
        setRealJobs(jobs);
        setRealProjects(projects);
        setRealCredentials(credentials);
        setRealSchedules(schedules);
        setRealMetrics(metrics);
      } catch (error) {
        console.error('Error updating Ansible data:', error);
      }
    };
    
    updateData();
    const interval = setInterval(updateData, isRunning ? 500 : 2000);
    return () => clearInterval(interval);
  }, [ansibleEngine, isRunning]);
  
  // Sync config with emulation engine when it changes
  useEffect(() => {
    if (ansibleEngine && node) {
      ansibleEngine.updateConfig(node);
    }
  }, [config, node, ansibleEngine]);

  // Load project data when editing
  useEffect(() => {
    if (editingProject && ansibleEngine) {
      const project = ansibleEngine.getProjects().find(p => p.id === editingProject);
      if (project) {
        setProjectName(project.name);
        setProjectDescription(project.description || '');
        setProjectScmType(project.scmType);
        setProjectScmUrl(project.scmUrl || '');
        setProjectScmBranch(project.scmBranch || 'main');
        setProjectPlaybooks(project.playbooks?.join(', ') || 'playbook.yml');
      }
    } else if (!editingProject && !showCreateProject) {
      // Reset form when dialog closes
      setProjectName('');
      setProjectDescription('');
      setProjectScmType('manual');
      setProjectScmUrl('');
      setProjectScmBranch('main');
      setProjectPlaybooks('playbook.yml');
    }
  }, [editingProject, ansibleEngine, showCreateProject]);

  // Load credential data when editing
  useEffect(() => {
    if (editingCredential && ansibleEngine) {
      const credential = ansibleEngine.getCredentials().find(c => c.id === editingCredential);
      if (credential) {
        setCredentialName(credential.name);
        setCredentialDescription(credential.description || '');
        setCredentialType(credential.credentialType);
        setCredentialUsername(credential.username || '');
        setCredentialPassword(credential.password || '');
        setCredentialSshKey(credential.sshKey || '');
        setCredentialSshKeyUnlock(credential.sshKeyUnlock || '');
        setCredentialBecomeMethod(credential.becomeMethod || 'sudo');
        setCredentialBecomeUsername(credential.becomeUsername || '');
        setCredentialBecomePassword(credential.becomePassword || '');
        setCredentialVaultPassword(credential.vaultPassword || '');
        setCredentialVaultId(credential.vaultId || '');
        setCredentialCloudProvider(credential.cloudProvider || 'aws');
        setCredentialScmUsername(credential.scmUsername || '');
        setCredentialScmPassword(credential.scmPassword || '');
        setCredentialScmSshKey(credential.scmSshKey || '');
      }
    } else if (!editingCredential && !showCreateCredential) {
      // Reset form when dialog closes
      setCredentialName('');
      setCredentialDescription('');
      setCredentialType('machine');
      setCredentialUsername('');
      setCredentialPassword('');
      setCredentialSshKey('');
      setCredentialSshKeyUnlock('');
      setCredentialBecomeMethod('sudo');
      setCredentialBecomeUsername('');
      setCredentialBecomePassword('');
      setCredentialVaultPassword('');
      setCredentialVaultId('');
      setCredentialCloudProvider('aws');
      setCredentialScmUsername('');
      setCredentialScmPassword('');
      setCredentialScmSshKey('');
    }
  }, [editingCredential, ansibleEngine, showCreateCredential]);

  // Load schedule data when editing
  useEffect(() => {
    if (editingSchedule && ansibleEngine) {
      const schedule = ansibleEngine.getSchedules().find(s => s.id === editingSchedule);
      if (schedule) {
        setScheduleName(schedule.name);
        setScheduleDescription(schedule.description || '');
        setScheduleJobTemplate(schedule.unifiedJobTemplate);
        setScheduleEnabled(schedule.enabled);
        setScheduleRrule(schedule.rrule || 'DTSTART:20240101T000000Z\nRRULE:FREQ=HOURLY;INTERVAL=1');
        setScheduleTimezone(schedule.timezone || 'UTC');
        setScheduleExtraVars(schedule.extraData?.extraVars || '');
        setScheduleLimit(schedule.extraData?.limit || '');
      }
    } else if (!editingSchedule && !showCreateSchedule) {
      // Reset form when dialog closes
      setScheduleName('');
      setScheduleDescription('');
      setScheduleJobTemplate('');
      setScheduleEnabled(true);
      setScheduleRrule('DTSTART:20240101T000000Z\nRRULE:FREQ=HOURLY;INTERVAL=1');
      setScheduleTimezone('UTC');
      setScheduleExtraVars('');
      setScheduleLimit('');
    }
  }, [editingSchedule, ansibleEngine, showCreateSchedule]);

  // Use real data from emulation if available, otherwise fall back to config
  const inventories = realInventories.length > 0 ? realInventories : (config.inventories || []);
  const jobTemplates = realJobTemplates.length > 0 ? realJobTemplates : (config.jobTemplates || []);
  const jobs = realJobs.length > 0 ? realJobs : (config.jobs || []);
  
  // Use real metrics if available
  const totalInventories = realMetrics?.inventoriesTotal ?? inventories.length;
  const totalTemplates = realMetrics?.jobTemplatesTotal ?? jobTemplates.length;
  const activeJobs = realMetrics?.jobsRunning ?? jobs.filter((j) => j.status === 'running' || j.status === 'pending' || j.status === 'waiting').length;
  const successfulJobs = realMetrics?.jobsSuccess ?? jobs.filter((j) => j.status === 'successful').length;

  const updateConfig = (updates: Partial<AnsibleConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addInventory = () => {
    const inventoryName = `inventory-${inventories.length + 1}`;
    const newInventory: Inventory = {
      id: `inv-${Date.now()}`,
      name: inventoryName,
      type: 'static',
      hosts: [],
      groups: [],
    };
    updateConfig({ inventories: [...inventories, newInventory] });
    toast({
      title: 'Inventory created',
      description: `Inventory "${inventoryName}" has been created`,
    });
    setShowCreateInventory(false);
  };

  const removeInventory = (id: string) => {
    const inventory = inventories.find(i => i.id === id);
    updateConfig({ inventories: inventories.filter((i) => i.id !== id) });
    toast({
      title: 'Inventory deleted',
      description: `Inventory "${inventory?.name || id}" has been removed`,
    });
    setInventoryToDelete(null);
  };

  const updateInventory = (id: string, field: string, value: any) => {
    const newInventories = inventories.map((i) =>
      i.id === id ? { ...i, [field]: value } : i
    );
    updateConfig({ inventories: newInventories });
  };

  const addHostToInventory = (inventoryId: string, hostName: string, groups: string[] = []) => {
    const inventory = inventories.find(i => i.id === inventoryId);
    if (!inventory) return;
    
    const newHost = {
      name: hostName,
      groups: groups,
      variables: {},
    };
    
    const updatedHosts = [...(inventory.hosts || []), newHost];
    updateInventory(inventoryId, 'hosts', updatedHosts);
    toast({
      title: 'Host added',
      description: `Host "${hostName}" has been added to inventory`,
    });
  };

  const removeHostFromInventory = (inventoryId: string, hostIndex: number) => {
    const inventory = inventories.find(i => i.id === inventoryId);
    if (!inventory || !inventory.hosts) return;
    
    const updatedHosts = inventory.hosts.filter((_, idx) => idx !== hostIndex);
    updateInventory(inventoryId, 'hosts', updatedHosts);
    toast({
      title: 'Host removed',
      description: 'Host has been removed from inventory',
    });
  };

  const addGroupToInventory = (inventoryId: string, groupName: string, hosts: string[] = []) => {
    const inventory = inventories.find(i => i.id === inventoryId);
    if (!inventory) return;
    
    const newGroup = {
      name: groupName,
      hosts: hosts,
      variables: {},
    };
    
    const updatedGroups = [...(inventory.groups || []), newGroup];
    updateInventory(inventoryId, 'groups', updatedGroups);
    toast({
      title: 'Group added',
      description: `Group "${groupName}" has been added to inventory`,
    });
  };

  const removeGroupFromInventory = (inventoryId: string, groupIndex: number) => {
    const inventory = inventories.find(i => i.id === inventoryId);
    if (!inventory || !inventory.groups) return;
    
    const updatedGroups = inventory.groups.filter((_, idx) => idx !== groupIndex);
    updateInventory(inventoryId, 'groups', updatedGroups);
    toast({
      title: 'Group removed',
      description: 'Group has been removed from inventory',
    });
  };

  const addJobTemplate = () => {
    if (inventories.length === 0) {
      toast({
        title: 'No inventories',
        description: 'Please create an inventory first before creating a job template',
        variant: 'destructive',
      });
      return;
    }
    
    const templateName = `template-${jobTemplates.length + 1}`;
    const newTemplate: JobTemplate = {
      id: `template-${Date.now()}`,
      name: templateName,
      playbook: 'playbook.yml',
      inventory: inventories[0]?.name || inventories[0]?.id || '',
      enabled: true,
      become: false,
      forks: 5,
      timeout: 3600,
    };
    updateConfig({ jobTemplates: [...jobTemplates, newTemplate] });
    toast({
      title: 'Template created',
      description: `Job template "${templateName}" has been created`,
    });
    setShowCreateTemplate(false);
  };

  const removeJobTemplate = (id: string) => {
    const template = jobTemplates.find(t => t.id === id);
    updateConfig({ jobTemplates: jobTemplates.filter((t) => t.id !== id) });
    toast({
      title: 'Template deleted',
      description: `Job template "${template?.name || id}" has been removed`,
    });
    setTemplateToDelete(null);
  };

  const updateJobTemplate = (id: string, field: string, value: any) => {
    const newTemplates = jobTemplates.map((t) =>
      t.id === id ? { ...t, [field]: value } : t
    );
    updateConfig({ jobTemplates: newTemplates });
  };

  const launchJob = (templateId: string) => {
    if (ansibleEngine) {
      const job = ansibleEngine.launchJobFromTemplate(templateId);
      if (job) {
        toast({
          title: 'Job launched',
          description: `Job "${job.name}" has been started`,
        });
      } else {
        toast({
          title: 'Failed to launch job',
          description: 'Could not launch job from template',
          variant: 'destructive',
        });
      }
    } else {
      // Fallback to config-based approach
      const template = jobTemplates.find((t) => t.id === templateId);
      if (!template) {
        toast({
          title: 'Template not found',
          description: 'Could not find the job template',
          variant: 'destructive',
        });
        return;
      }

      const newJob: Job = {
        id: `job-${Date.now()}`,
        template: template.name,
        status: 'running',
        startedAt: new Date().toISOString(),
      };
      updateConfig({ jobs: [newJob, ...jobs.slice(0, 9)] });
      toast({
        title: 'Job launched',
        description: `Job "${newJob.template}" has been started`,
      });
    }
  };

  // Project CRUD operations
  const addProject = (projectData: {
    name: string;
    description?: string;
    scmType: 'git' | 'svn' | 'insights' | 'manual' | 'archive';
    scmUrl?: string;
    scmBranch?: string;
    playbooks?: string[];
  }) => {
    const currentProjects = config.projects || [];
    const newProject = {
      id: `project-${Date.now()}`,
      name: projectData.name,
      description: projectData.description,
      scmType: projectData.scmType,
      scmUrl: projectData.scmUrl,
      scmBranch: projectData.scmBranch || 'main',
      playbooks: projectData.playbooks || ['playbook.yml'],
    };
    
    updateConfig({ projects: [...currentProjects, newProject] });
    toast({
      title: 'Project created',
      description: `Project "${projectData.name}" has been created`,
    });
    setShowCreateProject(false);
  };

  const updateProject = (projectId: string, projectData: {
    name: string;
    description?: string;
    scmType: 'git' | 'svn' | 'insights' | 'manual' | 'archive';
    scmUrl?: string;
    scmBranch?: string;
    playbooks?: string[];
  }) => {
    const currentProjects = config.projects || [];
    const updatedProjects = currentProjects.map(p => 
      p.id === projectId 
        ? {
            ...p,
            name: projectData.name,
            description: projectData.description,
            scmType: projectData.scmType,
            scmUrl: projectData.scmUrl,
            scmBranch: projectData.scmBranch || 'main',
            playbooks: projectData.playbooks || ['playbook.yml'],
          }
        : p
    );
    
    updateConfig({ projects: updatedProjects });
    toast({
      title: 'Project updated',
      description: `Project "${projectData.name}" has been updated`,
    });
    setEditingProject(null);
  };

  const removeProject = (projectId: string) => {
    const currentProjects = config.projects || [];
    const project = ansibleEngine?.getProjects().find(p => p.id === projectId) || currentProjects.find(p => p.id === projectId);
    
    // Check if project is used in any job templates
    const templatesToCheck = realJobTemplates.length > 0 ? realJobTemplates : jobTemplates;
    const isUsedInTemplates = templatesToCheck.some(t => t.project === projectId);
    if (isUsedInTemplates) {
      toast({
        title: 'Cannot delete project',
        description: 'Project is used in one or more job templates. Please remove or update those templates first.',
        variant: 'destructive',
      });
      setProjectToDelete(null);
      return;
    }
    
    updateConfig({ projects: currentProjects.filter(p => p.id !== projectId) });
    toast({
      title: 'Project deleted',
      description: `Project "${project?.name || projectId}" has been removed`,
    });
    setProjectToDelete(null);
  };

  // Credential CRUD operations
  const addCredential = (credentialData: {
    name: string;
    description?: string;
    credentialType: 'machine' | 'vault' | 'source_control' | 'cloud' | 'network' | 'insights';
    username?: string;
    password?: string;
    sshKey?: string;
    sshKeyUnlock?: string;
    becomeMethod?: string;
    becomeUsername?: string;
    becomePassword?: string;
    vaultPassword?: string;
    vaultId?: string;
    cloudProvider?: 'aws' | 'azure' | 'gcp' | 'openstack';
    scmUsername?: string;
    scmPassword?: string;
    scmSshKey?: string;
  }) => {
    const currentCredentials = config.credentials || [];
    const newCredential: any = {
      id: `credential-${Date.now()}`,
      name: credentialData.name,
      description: credentialData.description,
      credentialType: credentialData.credentialType,
    };
    
    // Add type-specific fields
    if (credentialData.credentialType === 'machine') {
      newCredential.username = credentialData.username;
      newCredential.password = credentialData.password;
      newCredential.sshKey = credentialData.sshKey;
      newCredential.sshKeyUnlock = credentialData.sshKeyUnlock;
      newCredential.becomeMethod = credentialData.becomeMethod;
      newCredential.becomeUsername = credentialData.becomeUsername;
      newCredential.becomePassword = credentialData.becomePassword;
    } else if (credentialData.credentialType === 'vault') {
      newCredential.vaultPassword = credentialData.vaultPassword;
      newCredential.vaultId = credentialData.vaultId;
    } else if (credentialData.credentialType === 'cloud') {
      newCredential.cloudProvider = credentialData.cloudProvider;
    } else if (credentialData.credentialType === 'source_control') {
      newCredential.scmUsername = credentialData.scmUsername;
      newCredential.scmPassword = credentialData.scmPassword;
      newCredential.scmSshKey = credentialData.scmSshKey;
    }
    
    updateConfig({ credentials: [...currentCredentials, newCredential] });
    toast({
      title: 'Credential created',
      description: `Credential "${credentialData.name}" has been created`,
    });
    setShowCreateCredential(false);
  };

  const updateCredential = (credentialId: string, credentialData: {
    name: string;
    description?: string;
    credentialType: 'machine' | 'vault' | 'source_control' | 'cloud' | 'network' | 'insights';
    username?: string;
    password?: string;
    sshKey?: string;
    sshKeyUnlock?: string;
    becomeMethod?: string;
    becomeUsername?: string;
    becomePassword?: string;
    vaultPassword?: string;
    vaultId?: string;
    cloudProvider?: 'aws' | 'azure' | 'gcp' | 'openstack';
    scmUsername?: string;
    scmPassword?: string;
    scmSshKey?: string;
  }) => {
    const currentCredentials = config.credentials || [];
    const updatedCredentials = currentCredentials.map(c => {
      if (c.id === credentialId) {
        const updated: any = {
          ...c,
          name: credentialData.name,
          description: credentialData.description,
          credentialType: credentialData.credentialType,
        };
        
        // Clear old fields and set new ones based on type
        if (credentialData.credentialType === 'machine') {
          updated.username = credentialData.username;
          updated.password = credentialData.password;
          updated.sshKey = credentialData.sshKey;
          updated.sshKeyUnlock = credentialData.sshKeyUnlock;
          updated.becomeMethod = credentialData.becomeMethod;
          updated.becomeUsername = credentialData.becomeUsername;
          updated.becomePassword = credentialData.becomePassword;
          // Clear vault and cloud fields
          delete updated.vaultPassword;
          delete updated.vaultId;
          delete updated.cloudProvider;
          delete updated.scmUsername;
          delete updated.scmPassword;
          delete updated.scmSshKey;
        } else if (credentialData.credentialType === 'vault') {
          updated.vaultPassword = credentialData.vaultPassword;
          updated.vaultId = credentialData.vaultId;
          // Clear machine and cloud fields
          delete updated.username;
          delete updated.password;
          delete updated.sshKey;
          delete updated.sshKeyUnlock;
          delete updated.becomeMethod;
          delete updated.becomeUsername;
          delete updated.becomePassword;
          delete updated.cloudProvider;
          delete updated.scmUsername;
          delete updated.scmPassword;
          delete updated.scmSshKey;
        } else if (credentialData.credentialType === 'cloud') {
          updated.cloudProvider = credentialData.cloudProvider;
          // Clear other fields
          delete updated.username;
          delete updated.password;
          delete updated.sshKey;
          delete updated.vaultPassword;
          delete updated.vaultId;
          delete updated.scmUsername;
          delete updated.scmPassword;
          delete updated.scmSshKey;
        } else if (credentialData.credentialType === 'source_control') {
          updated.scmUsername = credentialData.scmUsername;
          updated.scmPassword = credentialData.scmPassword;
          updated.scmSshKey = credentialData.scmSshKey;
          // Clear other fields
          delete updated.username;
          delete updated.password;
          delete updated.sshKey;
          delete updated.vaultPassword;
          delete updated.vaultId;
          delete updated.cloudProvider;
        }
        
        return updated;
      }
      return c;
    });
    
    updateConfig({ credentials: updatedCredentials });
    toast({
      title: 'Credential updated',
      description: `Credential "${credentialData.name}" has been updated`,
    });
    setEditingCredential(null);
  };

  const removeCredential = (credentialId: string) => {
    const currentCredentials = config.credentials || [];
    const credential = ansibleEngine?.getCredentials().find(c => c.id === credentialId) || currentCredentials.find(c => c.id === credentialId);
    
    // Check if credential is used in any job templates
    const templatesToCheck = realJobTemplates.length > 0 ? realJobTemplates : jobTemplates;
    const isUsedInTemplates = templatesToCheck.some(t => t.credential === credentialId || t.vaultCredential === credentialId);
    if (isUsedInTemplates) {
      toast({
        title: 'Cannot delete credential',
        description: 'Credential is used in one or more job templates. Please remove or update those templates first.',
        variant: 'destructive',
      });
      setCredentialToDelete(null);
      return;
    }
    
    updateConfig({ credentials: currentCredentials.filter(c => c.id !== credentialId) });
    toast({
      title: 'Credential deleted',
      description: `Credential "${credential?.name || credentialId}" has been removed`,
    });
    setCredentialToDelete(null);
  };

  // Schedule CRUD operations
  const addSchedule = (scheduleData: {
    name: string;
    description?: string;
    unifiedJobTemplate: string;
    enabled: boolean;
    rrule: string;
    timezone?: string;
    extraData?: Record<string, any>;
  }) => {
    const currentSchedules = config.schedules || [];
    const newSchedule = {
      id: `schedule-${Date.now()}`,
      name: scheduleData.name,
      description: scheduleData.description,
      unifiedJobTemplate: scheduleData.unifiedJobTemplate,
      enabled: scheduleData.enabled,
      rrule: scheduleData.rrule,
      timezone: scheduleData.timezone || 'UTC',
      extraData: scheduleData.extraData,
    };
    
    updateConfig({ schedules: [...currentSchedules, newSchedule] });
    toast({
      title: 'Schedule created',
      description: `Schedule "${scheduleData.name}" has been created`,
    });
    setShowCreateSchedule(false);
  };

  const updateSchedule = (scheduleId: string, scheduleData: {
    name: string;
    description?: string;
    unifiedJobTemplate: string;
    enabled: boolean;
    rrule: string;
    timezone?: string;
    extraData?: Record<string, any>;
  }) => {
    const currentSchedules = config.schedules || [];
    const updatedSchedules = currentSchedules.map(s => 
      s.id === scheduleId 
        ? {
            ...s,
            name: scheduleData.name,
            description: scheduleData.description,
            unifiedJobTemplate: scheduleData.unifiedJobTemplate,
            enabled: scheduleData.enabled,
            rrule: scheduleData.rrule,
            timezone: scheduleData.timezone || 'UTC',
            extraData: scheduleData.extraData,
          }
        : s
    );
    
    updateConfig({ schedules: updatedSchedules });
    toast({
      title: 'Schedule updated',
      description: `Schedule "${scheduleData.name}" has been updated`,
    });
    setEditingSchedule(null);
  };

  const removeSchedule = (scheduleId: string) => {
    const currentSchedules = config.schedules || [];
    const schedule = ansibleEngine?.getSchedules().find(s => s.id === scheduleId) || currentSchedules.find(s => s.id === scheduleId);
    
    updateConfig({ schedules: currentSchedules.filter(s => s.id !== scheduleId) });
    toast({
      title: 'Schedule deleted',
      description: `Schedule "${schedule?.name || scheduleId}" has been removed`,
    });
    setScheduleToDelete(null);
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">Ansible</p>
            <h2 className="text-2xl font-bold text-foreground">Configuration Management</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage inventories, job templates, and automation jobs
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => {
                if (ansibleEngine) {
                  ansibleEngine.updateConfig(node);
                  toast({
                    title: 'Refreshed',
                    description: 'Configuration has been refreshed from emulation',
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
                <CardTitle className="text-sm font-medium text-muted-foreground">Inventories</CardTitle>
                <Server className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalInventories}</span>
                <span className="text-xs text-muted-foreground">configured</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Job Templates</CardTitle>
                <FileText className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">{totalTemplates}</span>
                <span className="text-xs text-muted-foreground">available</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Active Jobs</CardTitle>
                <Activity className="h-4 w-4 text-cyan-500 animate-pulse" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{activeJobs}</span>
                <span className="text-xs text-muted-foreground">running</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500 bg-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Successful</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{successfulJobs}</span>
                <span className="text-xs text-muted-foreground">completed</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="inventories" className="space-y-4">
          <TabsList>
            <TabsTrigger value="inventories">
              <Server className="h-4 w-4 mr-2" />
              Inventories ({inventories.length})
            </TabsTrigger>
            <TabsTrigger value="projects">
              <FolderGit2 className="h-4 w-4 mr-2" />
              Projects ({realMetrics?.projectsTotal || 0})
            </TabsTrigger>
            <TabsTrigger value="credentials">
              <Key className="h-4 w-4 mr-2" />
              Credentials ({realMetrics?.credentialsTotal || 0})
            </TabsTrigger>
            <TabsTrigger value="templates">
              <FileText className="h-4 w-4 mr-2" />
              Job Templates ({jobTemplates.length})
            </TabsTrigger>
            <TabsTrigger value="jobs">
              <Play className="h-4 w-4 mr-2" />
              Jobs ({jobs.length})
            </TabsTrigger>
            <TabsTrigger value="schedules">
              <Calendar className="h-4 w-4 mr-2" />
              Schedules ({realMetrics?.schedulesTotal || 0})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="inventories" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Inventories</CardTitle>
                    <CardDescription>Manage host inventories</CardDescription>
                  </div>
                  <Button onClick={addInventory} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Inventory
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {inventories.map((inventory) => (
                    <Card key={inventory.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                              <Server className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{inventory.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className="font-medium">
                                  {inventory.type === 'static' ? 'Static' : 'Dynamic'}
                                </Badge>
                                {inventory.hosts && (
                                  <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300">
                                    <Server className="h-3 w-3 mr-1" />
                                    {inventory.hosts.length} hosts
                                  </Badge>
                                )}
                                {inventory.groups && (
                                  <Badge variant="outline" className="bg-purple-50 dark:bg-purple-950/20 text-purple-700 dark:text-purple-300">
                                    <Layers className="h-3 w-3 mr-1" />
                                    {inventory.groups.length} groups
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setInventoryToDelete(inventory.id)}
                            disabled={inventories.length === 1}
                            className="hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Inventory Name</Label>
                            <Input
                              value={inventory.name}
                              onChange={(e) => {
                                const newName = e.target.value.trim();
                                if (newName) {
                                  updateInventory(inventory.id, 'name', newName);
                                }
                              }}
                              placeholder="Inventory name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Inventory Type</Label>
                            <Select
                              value={inventory.type}
                              onValueChange={(value: 'static' | 'dynamic') => updateInventory(inventory.id, 'type', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="static">Static</SelectItem>
                                <SelectItem value="dynamic">Dynamic</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <Separator />
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-sm font-semibold">Hosts</Label>
                              <p className="text-xs text-muted-foreground">Manage inventory hosts</p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingInventoryHosts(inventory.id)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Hosts ({inventory.hosts?.length || 0})
                            </Button>
                          </div>
                          {inventory.hosts && inventory.hosts.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {inventory.hosts.slice(0, 10).map((host, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  <Server className="h-3 w-3 mr-1" />
                                  {host.name}
                                  {host.groups && host.groups.length > 0 && (
                                    <span className="ml-1 text-muted-foreground">({host.groups.join(', ')})</span>
                                  )}
                                </Badge>
                              ))}
                              {inventory.hosts.length > 10 && (
                                <Badge variant="outline" className="text-xs">
                                  +{inventory.hosts.length - 10} more
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No hosts configured</p>
                          )}
                        </div>
                        
                        <Separator />
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-sm font-semibold">Groups</Label>
                              <p className="text-xs text-muted-foreground">Manage inventory groups</p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setEditingInventoryGroups(inventory.id)}
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Edit Groups ({inventory.groups?.length || 0})
                            </Button>
                          </div>
                          {inventory.groups && inventory.groups.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {inventory.groups.map((group, idx) => (
                                <Badge key={idx} variant="outline" className="text-xs">
                                  <Layers className="h-3 w-3 mr-1" />
                                  {group.name}
                                  {group.hosts && group.hosts.length > 0 && (
                                    <span className="ml-1 text-muted-foreground">({group.hosts.length})</span>
                                  )}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No groups configured</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="projects" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Projects</CardTitle>
                    <CardDescription>Manage playbook projects and SCM sources</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowCreateProject(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Project
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {ansibleEngine ? (
                  <div className="space-y-4">
                    {(realProjects.length > 0 || ansibleEngine.getProjects().length > 0) ? (
                      (realProjects.length > 0 ? realProjects : ansibleEngine.getProjects()).map((project) => (
                        <Card key={project.id} className="border-l-4 border-l-green-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                                  <FolderGit2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                                </div>
                                <div className="flex-1">
                                  <CardTitle className="text-lg font-semibold">{project.name}</CardTitle>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="outline">{project.scmType}</Badge>
                                    {project.status && (
                                      <Badge variant={project.status === 'successful' ? 'default' : 'destructive'}>
                                        {project.status}
                                      </Badge>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingProject(project.id)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setProjectToDelete(project.id)}
                                  className="hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm">
                              {project.description && <p className="text-muted-foreground">{project.description}</p>}
                              {project.scmUrl && <p><span className="font-medium">SCM URL:</span> {project.scmUrl}</p>}
                              {project.scmBranch && <p><span className="font-medium">Branch:</span> {project.scmBranch}</p>}
                              {project.playbooks && project.playbooks.length > 0 && (
                                <div>
                                  <span className="font-medium">Playbooks:</span>
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {project.playbooks.map((pb, idx) => (
                                      <Badge key={idx} variant="outline" className="text-xs">{pb}</Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {project.lastUpdateTime && (
                                <p className="text-xs text-muted-foreground">
                                  Last updated: {new Date(project.lastUpdateTime).toLocaleString()}
                                </p>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No projects configured. Projects will be shown here when job templates are created.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Emulation engine not initialized. Projects will be available when simulation is running.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="credentials" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Credentials</CardTitle>
                    <CardDescription>Manage authentication credentials</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowCreateCredential(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Credential
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {ansibleEngine ? (
                  <div className="space-y-4">
                    {(realCredentials.length > 0 || ansibleEngine.getCredentials().length > 0) ? (
                      (realCredentials.length > 0 ? realCredentials : ansibleEngine.getCredentials()).map((cred) => (
                        <Card key={cred.id} className="border-l-4 border-l-orange-500">
                          <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                                  <Key className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                                </div>
                                <div className="flex-1">
                                  <CardTitle className="text-lg font-semibold">{cred.name}</CardTitle>
                                  <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="outline">{cred.credentialType}</Badge>
                                    {cred.username && <Badge variant="outline">User: {cred.username}</Badge>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingCredential(cred.id)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setCredentialToDelete(cred.id)}
                                  className="hover:bg-destructive/10 hover:text-destructive"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-2 text-sm">
                              {cred.description && <p className="text-muted-foreground">{cred.description}</p>}
                              {cred.becomeMethod && <p><span className="font-medium">Become Method:</span> {cred.becomeMethod}</p>}
                              {cred.becomeUsername && <p><span className="font-medium">Become User:</span> {cred.becomeUsername}</p>}
                              {cred.cloudProvider && <p><span className="font-medium">Cloud Provider:</span> {cred.cloudProvider}</p>}
                              {cred.vaultId && <p><span className="font-medium">Vault ID:</span> {cred.vaultId}</p>}
                            </div>
                          </CardContent>
                        </Card>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No credentials configured. Credentials are used for authentication in job templates.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Emulation engine not initialized. Credentials will be available when simulation is running.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Job Templates</CardTitle>
                    <CardDescription>Configure automation job templates</CardDescription>
                  </div>
                  <Button onClick={addJobTemplate} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Template
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {jobTemplates.map((template) => (
                    <Card key={template.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-card">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                              <FileText className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{template.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant={template.enabled ? 'default' : 'outline'} className={template.enabled ? 'bg-green-500' : ''}>
                                  {template.enabled ? (
                                    <>
                                      <CheckCircle className="h-3 w-3 mr-1" />
                                      Enabled
                                    </>
                                  ) : (
                                    'Disabled'
                                  )}
                                </Badge>
                                <Badge variant="outline" className="font-mono text-xs">
                                  <FileText className="h-3 w-3 mr-1" />
                                  {template.playbook}
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  <Server className="h-3 w-3 mr-1" />
                                  {template.inventory}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => launchJob(template.id)}
                              disabled={!template.enabled}
                              className="bg-green-600 hover:bg-green-700"
                            >
                              <Play className="h-4 w-4 mr-2" />
                              Launch
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setTemplateToDelete(template.id)}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Template Name</Label>
                            <Input
                              value={template.name}
                              onChange={(e) => {
                                const newName = e.target.value.trim();
                                if (newName) {
                                  updateJobTemplate(template.id, 'name', newName);
                                }
                              }}
                              placeholder="Template name"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Playbook</Label>
                            <Input
                              value={template.playbook}
                              onChange={(e) => {
                                const newPlaybook = e.target.value.trim();
                                if (newPlaybook) {
                                  updateJobTemplate(template.id, 'playbook', newPlaybook);
                                }
                              }}
                              placeholder="playbook.yml"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Inventory</Label>
                            <Select
                              value={template.inventory}
                              onValueChange={(value) => updateJobTemplate(template.id, 'inventory', value)}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {inventories.map((inv) => (
                                  <SelectItem key={inv.id} value={inv.name}>{inv.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Enabled</Label>
                            <Switch
                              checked={template.enabled}
                              onCheckedChange={(checked) => updateJobTemplate(template.id, 'enabled', checked)}
                            />
                          </div>
                          <div className="flex items-center justify-between">
                            <Label>Become (sudo)</Label>
                            <Switch
                              checked={template.become ?? false}
                              onCheckedChange={(checked) => updateJobTemplate(template.id, 'become', checked)}
                            />
                          </div>
                          {template.become && (
                            <div className="space-y-2">
                              <Label>Become User</Label>
                              <Input
                                value={template.becomeUser || 'root'}
                                onChange={(e) => updateJobTemplate(template.id, 'becomeUser', e.target.value)}
                              />
                            </div>
                          )}
                          <div className="space-y-2">
                            <Label>Forks</Label>
                            <Input
                              type="number"
                              value={template.forks || 5}
                              onChange={(e) => updateJobTemplate(template.id, 'forks', Number(e.target.value))}
                              min={1}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Timeout (seconds)</Label>
                            <Input
                              type="number"
                              value={template.timeout || 3600}
                              onChange={(e) => updateJobTemplate(template.id, 'timeout', Number(e.target.value))}
                              min={1}
                            />
                          </div>
                        </div>
                        
                        {/* Advanced Settings */}
                        <Separator className="my-4" />
                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <div>
                              <Label className="text-sm font-semibold">Advanced Settings</Label>
                              <p className="text-xs text-muted-foreground">Additional configuration options</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label>Limit (host pattern)</Label>
                              <Input
                                value={(template as any).limit || ''}
                                onChange={(e) => updateJobTemplate(template.id, 'limit', e.target.value)}
                                placeholder="all, web*, !excluded"
                              />
                              <p className="text-xs text-muted-foreground">Limit execution to specific hosts</p>
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Verbosity</Label>
                              <Select
                                value={String((template as any).verbosity || 0)}
                                onValueChange={(value) => updateJobTemplate(template.id, 'verbosity', Number(value))}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="0">0 - Normal</SelectItem>
                                  <SelectItem value="1">1 - Verbose (-v)</SelectItem>
                                  <SelectItem value="2">2 - More Verbose (-vv)</SelectItem>
                                  <SelectItem value="3">3 - Debug (-vvv)</SelectItem>
                                  <SelectItem value="4">4 - Connection Debug (-vvvv)</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            
                            <div className="space-y-2 col-span-2">
                              <Label>Extra Variables (YAML)</Label>
                              <Textarea
                                value={(template as any).extraVars || ''}
                                onChange={(e) => updateJobTemplate(template.id, 'extraVars', e.target.value)}
                                placeholder="---&#10;key1: value1&#10;key2: value2"
                                className="font-mono text-sm min-h-24"
                              />
                              <p className="text-xs text-muted-foreground">Additional variables in YAML format</p>
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Job Tags</Label>
                              <Input
                                value={(template as any).jobTags || ''}
                                onChange={(e) => updateJobTemplate(template.id, 'jobTags', e.target.value)}
                                placeholder="tag1,tag2,tag3"
                              />
                              <p className="text-xs text-muted-foreground">Comma-separated tags to run</p>
                            </div>
                            
                            <div className="space-y-2">
                              <Label>Skip Tags</Label>
                              <Input
                                value={(template as any).skipTags || ''}
                                onChange={(e) => updateJobTemplate(template.id, 'skipTags', e.target.value)}
                                placeholder="tag1,tag2"
                              />
                              <p className="text-xs text-muted-foreground">Comma-separated tags to skip</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="jobs" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Job History</CardTitle>
                <CardDescription>Execution history and status</CardDescription>
              </CardHeader>
              <CardContent>
                {jobs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No jobs executed</p>
                ) : (
                  <div className="space-y-2">
                    {jobs.map((job) => {
                      const jobObj = typeof job === 'object' && 'id' in job ? job : null;
                      const jobStatus = jobObj?.status || (typeof job === 'object' && 'status' in job ? (job as any).status : 'unknown');
                      const jobId = jobObj?.id || (typeof job === 'object' && 'id' in job ? (job as any).id : `job-${Math.random()}`);
                      const jobName = jobObj?.name || jobObj?.jobTemplateName || (typeof job === 'object' && 'template' in job ? (job as any).template : 'Unknown Job');
                      const jobStarted = jobObj?.started || (typeof job === 'object' && 'startedAt' in job ? new Date((job as any).startedAt).getTime() : Date.now());
                      const jobFinished = jobObj?.finished;
                      const jobElapsed = jobObj?.elapsed || (typeof job === 'object' && 'duration' in job ? (job as any).duration : undefined);
                      const jobHosts = jobObj?.hosts || (typeof job === 'object' && 'hosts' in job ? (job as any).hosts : []);
                      const jobResultSummary = jobObj?.resultSummary;

                      return (
                        <Card
                          key={jobId}
                          className={`border-l-4 hover:shadow-md transition-all cursor-pointer ${
                            jobStatus === 'successful' ? 'border-l-green-500 bg-card' :
                            jobStatus === 'failed' || jobStatus === 'error' ? 'border-l-red-500 bg-card' :
                            jobStatus === 'running' || jobStatus === 'pending' || jobStatus === 'waiting' ? 'border-l-blue-500 bg-card' : 
                            jobStatus === 'canceled' ? 'border-l-gray-500 bg-card' : 'border-l-gray-500 bg-card'
                          }`}
                          onClick={() => {
                            if (ansibleEngine) {
                              setSelectedJob(jobId);
                              const logs = ansibleEngine.getJobLogs(jobId);
                              setJobLogs(logs);
                              setShowJobDetails(true);
                            }
                          }}
                        >
                          <CardContent className="pt-4">
                            <div className="flex items-start gap-3">
                              <div className={`p-2 rounded-lg ${
                                jobStatus === 'successful' ? 'bg-green-100 dark:bg-green-900/30' :
                                jobStatus === 'failed' || jobStatus === 'error' ? 'bg-red-100 dark:bg-red-900/30' :
                                jobStatus === 'running' || jobStatus === 'pending' || jobStatus === 'waiting' ? 'bg-blue-100 dark:bg-blue-900/30' : 
                                'bg-gray-100 dark:bg-gray-900/30'
                              }`}>
                                {jobStatus === 'successful' && <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />}
                                {(jobStatus === 'failed' || jobStatus === 'error') && <XCircle className="h-5 w-5 text-red-600 dark:text-red-400" />}
                                {(jobStatus === 'running' || jobStatus === 'pending' || jobStatus === 'waiting') && <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-pulse" />}
                                {jobStatus === 'canceled' && <XCircle className="h-5 w-5 text-gray-600 dark:text-gray-400" />}
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <Badge variant={
                                      jobStatus === 'successful' ? 'default' :
                                      jobStatus === 'failed' || jobStatus === 'error' ? 'destructive' :
                                      jobStatus === 'running' || jobStatus === 'pending' || jobStatus === 'waiting' ? 'secondary' : 'outline'
                                    } className="font-medium">
                                      {jobStatus}
                                    </Badge>
                                    <span className="font-semibold text-base">{jobName}</span>
                                  </div>
                                  {jobStatus === 'running' && ansibleEngine && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (ansibleEngine.cancelJob(jobId)) {
                                          toast({
                                            title: 'Job canceled',
                                            description: `Job "${jobName}" has been canceled`,
                                          });
                                        }
                                      }}
                                    >
                                      <X className="h-4 w-4 mr-2" />
                                      Cancel
                                    </Button>
                                  )}
                                </div>
                                {jobResultSummary && (
                                  <div className="flex items-center gap-2 mb-2 text-xs">
                                    <Badge variant="outline" className="text-green-600">OK: {jobResultSummary.ok}</Badge>
                                    <Badge variant="outline" className="text-yellow-600">Changed: {jobResultSummary.changed}</Badge>
                                    <Badge variant="outline" className="text-red-600">Failed: {jobResultSummary.failed}</Badge>
                                    <Badge variant="outline" className="text-orange-600">Unreachable: {jobResultSummary.unreachable}</Badge>
                                    <Badge variant="outline">Skipped: {jobResultSummary.skipped}</Badge>
                                  </div>
                                )}
                                {jobHosts && jobHosts.length > 0 && (
                                  <div className="flex flex-wrap items-center gap-2 mb-2">
                                    {jobHosts.slice(0, 5).map((host: any, idx: number) => (
                                      <Badge key={idx} variant={
                                        host.status === 'ok' ? 'default' :
                                        host.status === 'failed' || host.status === 'unreachable' ? 'destructive' : 'outline'
                                      } className="text-xs">
                                        {host.status === 'ok' && <CheckCircle className="h-3 w-3 mr-1" />}
                                        {(host.status === 'failed' || host.status === 'unreachable') && <XCircle className="h-3 w-3 mr-1" />}
                                        {host.status === 'changed' && <Activity className="h-3 w-3 mr-1" />}
                                        {host.name}: {host.status}
                                      </Badge>
                                    ))}
                                    {jobHosts.length > 5 && (
                                      <Badge variant="outline" className="text-xs">
                                        +{jobHosts.length - 5} more
                                      </Badge>
                                    )}
                                  </div>
                                )}
                                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                  <div className="flex items-center gap-1">
                                    <Clock className="h-3 w-3" />
                                    {new Date(jobStarted).toLocaleString()}
                                  </div>
                                  {jobFinished && (
                                    <div className="flex items-center gap-1">
                                      <CheckCircle className="h-3 w-3" />
                                      {new Date(jobFinished).toLocaleString()}
                                    </div>
                                  )}
                                  {jobElapsed !== undefined && (
                                    <div className="flex items-center gap-1">
                                      <Activity className="h-3 w-3" />
                                      {jobElapsed.toFixed(1)}s
                                    </div>
                                  )}
                                </div>
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

          <TabsContent value="schedules" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Schedules</CardTitle>
                    <CardDescription>Manage scheduled job executions</CardDescription>
                  </div>
                  <Button size="sm" onClick={() => setShowCreateSchedule(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Schedule
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {ansibleEngine ? (
                  <div className="space-y-4">
                    {(realSchedules.length > 0 || ansibleEngine.getSchedules().length > 0) ? (
                      (realSchedules.length > 0 ? realSchedules : ansibleEngine.getSchedules()).map((schedule) => {
                        const templatesToCheck = realJobTemplates.length > 0 ? realJobTemplates : ansibleEngine.getJobTemplates();
                        const template = templatesToCheck.find(t => t.id === schedule.unifiedJobTemplate);
                        return (
                          <Card key={schedule.id} className="border-l-4 border-l-purple-500">
                            <CardHeader className="pb-3">
                              <div className="flex items-center justify-between">
                                <div className="flex items-start gap-3">
                                  <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                                    <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                                  </div>
                                  <div className="flex-1">
                                    <CardTitle className="text-lg font-semibold">{schedule.name}</CardTitle>
                                    <div className="flex items-center gap-2 mt-2">
                                      <Badge variant={schedule.enabled ? 'default' : 'outline'}>
                                        {schedule.enabled ? 'Enabled' : 'Disabled'}
                                      </Badge>
                                      {template && (
                                        <Badge variant="outline">{template.name}</Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setEditingSchedule(schedule.id)}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setScheduleToDelete(schedule.id)}
                                    className="hover:bg-destructive/10 hover:text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <div className="space-y-2 text-sm">
                                {schedule.description && <p className="text-muted-foreground">{schedule.description}</p>}
                                {schedule.rrule && (
                                  <p><span className="font-medium">Schedule:</span> <code className="text-xs bg-muted px-1 py-0.5 rounded">{schedule.rrule}</code></p>
                                )}
                                {schedule.nextRun && (
                                  <p><span className="font-medium">Next Run:</span> {new Date(schedule.nextRun).toLocaleString()}</p>
                                )}
                                {schedule.lastRun && (
                                  <p><span className="font-medium">Last Run:</span> {new Date(schedule.lastRun).toLocaleString()}</p>
                                )}
                                {schedule.lastRunStatus && (
                                  <Badge variant={schedule.lastRunStatus === 'successful' ? 'default' : 'destructive'}>
                                    Last: {schedule.lastRunStatus}
                                  </Badge>
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        No schedules configured. Create schedules to automatically run job templates on a schedule.
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Emulation engine not initialized. Schedules will be available when simulation is running.
                  </p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Ansible Settings</CardTitle>
                <CardDescription>Global configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Default Forks</Label>
                  <Input type="number" defaultValue={5} min={1} />
                </div>
                <div className="space-y-2">
                  <Label>Default Timeout (seconds)</Label>
                  <Input type="number" defaultValue={3600} min={1} />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <Label>Enable Host Key Checking</Label>
                  <Switch defaultChecked />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Enable Gathering Facts</Label>
                  <Switch defaultChecked />
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Job Details Dialog */}
      <Dialog open={showJobDetails} onOpenChange={setShowJobDetails}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Job Details</DialogTitle>
            <DialogDescription>
              View job execution details and logs
            </DialogDescription>
          </DialogHeader>
          {selectedJob && ansibleEngine && (() => {
            const job = ansibleEngine.getJob(selectedJob);
            if (!job) return <p className="text-muted-foreground">Job not found</p>;
            
            return (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <div className="mt-1">
                      <Badge variant={
                        job.status === 'successful' ? 'default' :
                        job.status === 'failed' || job.status === 'error' ? 'destructive' :
                        job.status === 'running' || job.status === 'pending' || job.status === 'waiting' ? 'secondary' : 'outline'
                      }>
                        {job.status}
                      </Badge>
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Duration</Label>
                    <p className="mt-1 text-sm">{job.elapsed?.toFixed(2)}s</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Job Template</Label>
                    <p className="mt-1 text-sm">{job.jobTemplateName || job.jobTemplate || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Inventory</Label>
                    <p className="mt-1 text-sm">{job.inventoryName || job.inventory || 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Started</Label>
                    <p className="mt-1 text-sm">{job.started ? new Date(job.started).toLocaleString() : 'N/A'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Finished</Label>
                    <p className="mt-1 text-sm">{job.finished ? new Date(job.finished).toLocaleString() : 'Running...'}</p>
                  </div>
                </div>
                
                {job.resultSummary && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Results Summary</Label>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-green-600">OK: {job.resultSummary.ok}</Badge>
                      <Badge variant="outline" className="text-yellow-600">Changed: {job.resultSummary.changed}</Badge>
                      <Badge variant="outline" className="text-red-600">Failed: {job.resultSummary.failed}</Badge>
                      <Badge variant="outline" className="text-orange-600">Unreachable: {job.resultSummary.unreachable}</Badge>
                      <Badge variant="outline">Skipped: {job.resultSummary.skipped}</Badge>
                    </div>
                  </div>
                )}

                {job.hosts && job.hosts.length > 0 && (
                  <div>
                    <Label className="text-xs text-muted-foreground mb-2 block">Hosts ({job.hosts.length})</Label>
                    <div className="space-y-2 max-h-48 overflow-y-auto">
                      {job.hosts.map((host) => (
                        <div key={host.id || host.name} className="flex items-center justify-between p-2 border rounded">
                          <div className="flex items-center gap-2">
                            <Badge variant={
                              host.status === 'ok' ? 'default' :
                              host.status === 'failed' || host.status === 'unreachable' ? 'destructive' : 'outline'
                            } className="text-xs">
                              {host.status}
                            </Badge>
                            <span className="text-sm font-medium">{host.name}</span>
                          </div>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            {host.changed && <span className="text-yellow-600">Changed</span>}
                            {host.failed && <span className="text-red-600">Failed</span>}
                            {host.unreachable && <span className="text-orange-600">Unreachable</span>}
                            {host.skipped && <span className="text-gray-600">Skipped</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <Label className="text-xs text-muted-foreground mb-2 block">Job Logs</Label>
                  <div className="bg-muted p-4 rounded-md font-mono text-xs max-h-96 overflow-y-auto">
                    {jobLogs.length > 0 ? (
                      jobLogs.map((log, idx) => (
                        <div key={idx} className="mb-1 whitespace-pre-wrap">{log}</div>
                      ))
                    ) : (
                      <p className="text-muted-foreground">No logs available</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowJobDetails(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Inventory Confirmation */}
      <AlertDialog open={!!inventoryToDelete} onOpenChange={(open) => !open && setInventoryToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inventory</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this inventory? This action cannot be undone.
              {inventoryToDelete && inventories.find(i => i.id === inventoryToDelete) && (
                <> Inventory "{inventories.find(i => i.id === inventoryToDelete)?.name}" will be permanently removed.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => inventoryToDelete && removeInventory(inventoryToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Template Confirmation */}
      <AlertDialog open={!!templateToDelete} onOpenChange={(open) => !open && setTemplateToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Job Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this job template? This action cannot be undone.
              {templateToDelete && jobTemplates.find(t => t.id === templateToDelete) && (
                <> Template "{jobTemplates.find(t => t.id === templateToDelete)?.name}" will be permanently removed.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => templateToDelete && removeJobTemplate(templateToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Project Confirmation */}
      <AlertDialog open={!!projectToDelete} onOpenChange={(open) => !open && setProjectToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this project? This action cannot be undone.
              {projectToDelete && ansibleEngine && (() => {
                const project = ansibleEngine.getProjects().find(p => p.id === projectToDelete);
                return project ? <> Project "{project.name}" will be permanently removed.</> : null;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => projectToDelete && removeProject(projectToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Hosts Dialog */}
      {editingInventoryHosts && (() => {
        const inventory = inventories.find(i => i.id === editingInventoryHosts);
        if (!inventory) return null;
        
        return (
          <Dialog open={!!editingInventoryHosts} onOpenChange={(open) => !open && setEditingInventoryHosts(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Hosts - {inventory.name}</DialogTitle>
                <DialogDescription>
                  Manage hosts in this inventory
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Add Host Form */}
                <div className="border rounded-lg p-4 space-y-3">
                  <Label className="text-sm font-semibold">Add New Host</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Host Name</Label>
                      <Input
                        value={newHostName}
                        onChange={(e) => setNewHostName(e.target.value)}
                        placeholder="web1.example.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Groups (comma-separated)</Label>
                      <Input
                        value={newHostGroups}
                        onChange={(e) => setNewHostGroups(e.target.value)}
                        placeholder="web,production"
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (newHostName.trim() && editingInventoryHosts) {
                        const groups = newHostGroups.split(',').map(g => g.trim()).filter(g => g);
                        addHostToInventory(editingInventoryHosts, newHostName.trim(), groups);
                        setNewHostName('');
                        setNewHostGroups('');
                      }
                    }}
                    disabled={!newHostName.trim()}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Host
                  </Button>
                </div>

                {/* Hosts List */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Hosts ({inventory.hosts?.length || 0})</Label>
                  {inventory.hosts && inventory.hosts.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {inventory.hosts.map((host, idx) => (
                        <Card key={idx} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Server className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{host.name}</span>
                              </div>
                              {host.groups && host.groups.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {host.groups.map((group, gIdx) => (
                                    <Badge key={gIdx} variant="outline" className="text-xs">{group}</Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => editingInventoryHosts && removeHostFromInventory(editingInventoryHosts, idx)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No hosts in this inventory</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setEditingInventoryHosts(null);
                  setNewHostName('');
                  setNewHostGroups('');
                }}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Edit Groups Dialog */}
      {editingInventoryGroups && (() => {
        const inventory = inventories.find(i => i.id === editingInventoryGroups);
        if (!inventory) return null;
        
        return (
          <Dialog open={!!editingInventoryGroups} onOpenChange={(open) => !open && setEditingInventoryGroups(null)}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Groups - {inventory.name}</DialogTitle>
                <DialogDescription>
                  Manage groups in this inventory
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* Add Group Form */}
                <div className="border rounded-lg p-4 space-y-3">
                  <Label className="text-sm font-semibold">Add New Group</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Group Name</Label>
                      <Input
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="web"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Hosts (comma-separated)</Label>
                      <Input
                        value={newGroupHosts}
                        onChange={(e) => setNewGroupHosts(e.target.value)}
                        placeholder="web1.example.com,web2.example.com"
                      />
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (newGroupName.trim() && editingInventoryGroups) {
                        const hosts = newGroupHosts.split(',').map(h => h.trim()).filter(h => h);
                        addGroupToInventory(editingInventoryGroups, newGroupName.trim(), hosts);
                        setNewGroupName('');
                        setNewGroupHosts('');
                      }
                    }}
                    disabled={!newGroupName.trim()}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Group
                  </Button>
                </div>

                {/* Groups List */}
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Groups ({inventory.groups?.length || 0})</Label>
                  {inventory.groups && inventory.groups.length > 0 ? (
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {inventory.groups.map((group, idx) => (
                        <Card key={idx} className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <Layers className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">{group.name}</span>
                              </div>
                              {group.hosts && group.hosts.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {group.hosts.map((host, hIdx) => (
                                    <Badge key={hIdx} variant="outline" className="text-xs">{host}</Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => editingInventoryGroups && removeGroupFromInventory(editingInventoryGroups, idx)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No groups in this inventory</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setEditingInventoryGroups(null);
                  setNewGroupName('');
                  setNewGroupHosts('');
                }}>
                  Close
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        );
      })()}

      {/* Create/Edit Project Dialog */}
      <Dialog open={showCreateProject || !!editingProject} onOpenChange={(open) => {
        if (!open) {
          setShowCreateProject(false);
          setEditingProject(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingProject ? 'Edit Project' : 'Create Project'}</DialogTitle>
            <DialogDescription>
              {editingProject ? 'Update project configuration' : 'Create a new project for playbooks'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Project Name *</Label>
              <Input
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="My Project"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Project description"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>SCM Type *</Label>
              <Select value={projectScmType} onValueChange={(value: any) => setProjectScmType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual">Manual</SelectItem>
                  <SelectItem value="git">Git</SelectItem>
                  <SelectItem value="svn">SVN</SelectItem>
                  <SelectItem value="insights">Red Hat Insights</SelectItem>
                  <SelectItem value="archive">Archive</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {projectScmType !== 'manual' && (
              <>
                <div className="space-y-2">
                  <Label>SCM URL</Label>
                  <Input
                    value={projectScmUrl}
                    onChange={(e) => setProjectScmUrl(e.target.value)}
                    placeholder="https://github.com/user/repo.git"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SCM Branch</Label>
                  <Input
                    value={projectScmBranch}
                    onChange={(e) => setProjectScmBranch(e.target.value)}
                    placeholder="main"
                  />
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Playbooks (comma-separated)</Label>
              <Input
                value={projectPlaybooks}
                onChange={(e) => setProjectPlaybooks(e.target.value)}
                placeholder="playbook.yml,deploy.yml"
              />
              <p className="text-xs text-muted-foreground">List of playbook files in this project</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateProject(false);
              setEditingProject(null);
              setProjectName('');
              setProjectDescription('');
              setProjectScmType('manual');
              setProjectScmUrl('');
              setProjectScmBranch('main');
              setProjectPlaybooks('playbook.yml');
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!projectName.trim()) {
                  toast({
                    title: 'Validation error',
                    description: 'Project name is required',
                    variant: 'destructive',
                  });
                  return;
                }

                const projectData = {
                  name: projectName.trim(),
                  description: projectDescription.trim() || undefined,
                  scmType: projectScmType,
                  scmUrl: projectScmUrl.trim() || undefined,
                  scmBranch: projectScmBranch.trim() || 'main',
                  playbooks: projectPlaybooks.split(',').map(p => p.trim()).filter(p => p),
                };

                if (editingProject) {
                  updateProject(editingProject, projectData);
                  setEditingProject(null);
                } else {
                  addProject(projectData);
                }

                // Reset form and close dialog
                setShowCreateProject(false);
                setProjectName('');
                setProjectDescription('');
                setProjectScmType('manual');
                setProjectScmUrl('');
                setProjectScmBranch('main');
                setProjectPlaybooks('playbook.yml');
              }}
              disabled={!projectName.trim()}
            >
              {editingProject ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Credential Confirmation */}
      <AlertDialog open={!!credentialToDelete} onOpenChange={(open) => !open && setCredentialToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Credential</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this credential? This action cannot be undone.
              {credentialToDelete && ansibleEngine && (() => {
                const credential = ansibleEngine.getCredentials().find(c => c.id === credentialToDelete);
                return credential ? <> Credential "{credential.name}" will be permanently removed.</> : null;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => credentialToDelete && removeCredential(credentialToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Edit Credential Dialog */}
      <Dialog open={showCreateCredential || !!editingCredential} onOpenChange={(open) => {
        if (!open) {
          setShowCreateCredential(false);
          setEditingCredential(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCredential ? 'Edit Credential' : 'Create Credential'}</DialogTitle>
            <DialogDescription>
              {editingCredential ? 'Update credential configuration' : 'Create a new authentication credential'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Credential Name *</Label>
              <Input
                value={credentialName}
                onChange={(e) => setCredentialName(e.target.value)}
                placeholder="My Credential"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={credentialDescription}
                onChange={(e) => setCredentialDescription(e.target.value)}
                placeholder="Credential description"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Credential Type *</Label>
              <Select value={credentialType} onValueChange={(value: any) => setCredentialType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="machine">Machine</SelectItem>
                  <SelectItem value="vault">Vault</SelectItem>
                  <SelectItem value="source_control">Source Control</SelectItem>
                  <SelectItem value="cloud">Cloud</SelectItem>
                  <SelectItem value="network">Network</SelectItem>
                  <SelectItem value="insights">Red Hat Insights</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Machine Credential Fields */}
            {credentialType === 'machine' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      value={credentialUsername}
                      onChange={(e) => setCredentialUsername(e.target.value)}
                      placeholder="root"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password</Label>
                    <Input
                      type="password"
                      value={credentialPassword}
                      onChange={(e) => setCredentialPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label>SSH Private Key</Label>
                  <Textarea
                    value={credentialSshKey}
                    onChange={(e) => setCredentialSshKey(e.target.value)}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----"
                    className="font-mono text-sm min-h-24"
                  />
                </div>

                <div className="space-y-2">
                  <Label>SSH Key Unlock Passphrase</Label>
                  <Input
                    type="password"
                    value={credentialSshKeyUnlock}
                    onChange={(e) => setCredentialSshKeyUnlock(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>

                <Separator />

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Privilege Escalation Method</Label>
                    <Select value={credentialBecomeMethod} onValueChange={(value: any) => setCredentialBecomeMethod(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sudo">sudo</SelectItem>
                        <SelectItem value="su">su</SelectItem>
                        <SelectItem value="pbrun">pbrun</SelectItem>
                        <SelectItem value="pfexec">pfexec</SelectItem>
                        <SelectItem value="dzdo">dzdo</SelectItem>
                        <SelectItem value="pmrun">pmrun</SelectItem>
                        <SelectItem value="runas">runas</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Privilege Escalation Username</Label>
                    <Input
                      value={credentialBecomeUsername}
                      onChange={(e) => setCredentialBecomeUsername(e.target.value)}
                      placeholder="root"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Privilege Escalation Password</Label>
                  <Input
                    type="password"
                    value={credentialBecomePassword}
                    onChange={(e) => setCredentialBecomePassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
              </div>
            )}

            {/* Vault Credential Fields */}
            {credentialType === 'vault' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Vault Password *</Label>
                  <Input
                    type="password"
                    value={credentialVaultPassword}
                    onChange={(e) => setCredentialVaultPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Vault ID</Label>
                  <Input
                    value={credentialVaultId}
                    onChange={(e) => setCredentialVaultId(e.target.value)}
                    placeholder="my_vault"
                  />
                  <p className="text-xs text-muted-foreground">Optional vault identifier</p>
                </div>
              </div>
            )}

            {/* Cloud Credential Fields */}
            {credentialType === 'cloud' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Cloud Provider *</Label>
                  <Select value={credentialCloudProvider} onValueChange={(value: any) => setCredentialCloudProvider(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="aws">AWS</SelectItem>
                      <SelectItem value="azure">Azure</SelectItem>
                      <SelectItem value="gcp">Google Cloud Platform</SelectItem>
                      <SelectItem value="openstack">OpenStack</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Additional provider-specific configuration fields would be added here in a real implementation.
                </p>
              </div>
            )}

            {/* Source Control Credential Fields */}
            {credentialType === 'source_control' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Username</Label>
                    <Input
                      value={credentialScmUsername}
                      onChange={(e) => setCredentialScmUsername(e.target.value)}
                      placeholder="git"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Password / Token</Label>
                    <Input
                      type="password"
                      value={credentialScmPassword}
                      onChange={(e) => setCredentialScmPassword(e.target.value)}
                      placeholder="••••••••"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>SSH Private Key</Label>
                  <Textarea
                    value={credentialScmSshKey}
                    onChange={(e) => setCredentialScmSshKey(e.target.value)}
                    placeholder="-----BEGIN RSA PRIVATE KEY-----"
                    className="font-mono text-sm min-h-24"
                  />
                </div>
              </div>
            )}

            {/* Network and Insights types - minimal fields */}
            {(credentialType === 'network' || credentialType === 'insights') && (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Additional configuration fields for {credentialType} credentials would be added here.
                </p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateCredential(false);
              setEditingCredential(null);
              // Reset form is handled by useEffect
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!credentialName.trim()) {
                  toast({
                    title: 'Validation error',
                    description: 'Credential name is required',
                    variant: 'destructive',
                  });
                  return;
                }

                const credentialData: any = {
                  name: credentialName.trim(),
                  description: credentialDescription.trim() || undefined,
                  credentialType: credentialType,
                };

                if (credentialType === 'machine') {
                  credentialData.username = credentialUsername.trim() || undefined;
                  credentialData.password = credentialPassword || undefined;
                  credentialData.sshKey = credentialSshKey.trim() || undefined;
                  credentialData.sshKeyUnlock = credentialSshKeyUnlock || undefined;
                  credentialData.becomeMethod = credentialBecomeMethod;
                  credentialData.becomeUsername = credentialBecomeUsername.trim() || undefined;
                  credentialData.becomePassword = credentialBecomePassword || undefined;
                } else if (credentialType === 'vault') {
                  credentialData.vaultPassword = credentialVaultPassword || undefined;
                  credentialData.vaultId = credentialVaultId.trim() || undefined;
                } else if (credentialType === 'cloud') {
                  credentialData.cloudProvider = credentialCloudProvider;
                } else if (credentialType === 'source_control') {
                  credentialData.scmUsername = credentialScmUsername.trim() || undefined;
                  credentialData.scmPassword = credentialScmPassword || undefined;
                  credentialData.scmSshKey = credentialScmSshKey.trim() || undefined;
                }

                if (editingCredential) {
                  updateCredential(editingCredential, credentialData);
                  setEditingCredential(null);
                } else {
                  addCredential(credentialData);
                }

                // Reset form and close dialog
                setShowCreateCredential(false);
              }}
              disabled={!credentialName.trim()}
            >
              {editingCredential ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Schedule Confirmation */}
      <AlertDialog open={!!scheduleToDelete} onOpenChange={(open) => !open && setScheduleToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Schedule</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this schedule? This action cannot be undone.
              {scheduleToDelete && ansibleEngine && (() => {
                const schedule = ansibleEngine.getSchedules().find(s => s.id === scheduleToDelete);
                return schedule ? <> Schedule "{schedule.name}" will be permanently removed.</> : null;
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => scheduleToDelete && removeSchedule(scheduleToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Create/Edit Schedule Dialog */}
      <Dialog open={showCreateSchedule || !!editingSchedule} onOpenChange={(open) => {
        if (!open) {
          setShowCreateSchedule(false);
          setEditingSchedule(null);
        }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingSchedule ? 'Edit Schedule' : 'Create Schedule'}</DialogTitle>
            <DialogDescription>
              {editingSchedule ? 'Update schedule configuration' : 'Create a new schedule to automatically run job templates'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Schedule Name *</Label>
              <Input
                value={scheduleName}
                onChange={(e) => setScheduleName(e.target.value)}
                placeholder="Daily Backup Schedule"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={scheduleDescription}
                onChange={(e) => setScheduleDescription(e.target.value)}
                placeholder="Schedule description"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Job Template *</Label>
              <Select value={scheduleJobTemplate} onValueChange={setScheduleJobTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a job template" />
                </SelectTrigger>
                <SelectContent>
                  {(realJobTemplates.length > 0 ? realJobTemplates : jobTemplates).map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {jobTemplates.length === 0 && (
                <p className="text-xs text-muted-foreground">No job templates available. Create a job template first.</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch
                checked={scheduleEnabled}
                onCheckedChange={setScheduleEnabled}
              />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Schedule (RRULE / Cron Expression) *</Label>
              <Textarea
                value={scheduleRrule}
                onChange={(e) => setScheduleRrule(e.target.value)}
                placeholder="DTSTART:20240101T000000Z&#10;RRULE:FREQ=HOURLY;INTERVAL=1"
                className="font-mono text-sm min-h-32"
              />
              <p className="text-xs text-muted-foreground">
                Use iCal RRULE format. Examples:
                <br />
                • Hourly: DTSTART:20240101T000000Z\nRRULE:FREQ=HOURLY;INTERVAL=1
                <br />
                • Daily at 2 AM: DTSTART:20240101T020000Z\nRRULE:FREQ=DAILY
                <br />
                • Weekly on Monday: DTSTART:20240101T000000Z\nRRULE:FREQ=WEEKLY;BYDAY=MO
              </p>
            </div>

            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={scheduleTimezone} onValueChange={setScheduleTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UTC">UTC</SelectItem>
                  <SelectItem value="America/New_York">America/New_York (EST/EDT)</SelectItem>
                  <SelectItem value="America/Chicago">America/Chicago (CST/CDT)</SelectItem>
                  <SelectItem value="America/Denver">America/Denver (MST/MDT)</SelectItem>
                  <SelectItem value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</SelectItem>
                  <SelectItem value="Europe/London">Europe/London (GMT/BST)</SelectItem>
                  <SelectItem value="Europe/Paris">Europe/Paris (CET/CEST)</SelectItem>
                  <SelectItem value="Asia/Tokyo">Asia/Tokyo (JST)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">Additional Job Parameters</Label>
                <p className="text-xs text-muted-foreground mb-4">Optional parameters to pass when the scheduled job runs</p>
              </div>

              <div className="space-y-2">
                <Label>Limit (host pattern)</Label>
                <Input
                  value={scheduleLimit}
                  onChange={(e) => setScheduleLimit(e.target.value)}
                  placeholder="all, web*, !excluded"
                />
                <p className="text-xs text-muted-foreground">Limit execution to specific hosts</p>
              </div>

              <div className="space-y-2">
                <Label>Extra Variables (YAML)</Label>
                <Textarea
                  value={scheduleExtraVars}
                  onChange={(e) => setScheduleExtraVars(e.target.value)}
                  placeholder="---&#10;key1: value1&#10;key2: value2"
                  className="font-mono text-sm min-h-24"
                />
                <p className="text-xs text-muted-foreground">Additional variables in YAML format</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowCreateSchedule(false);
              setEditingSchedule(null);
              // Reset form is handled by useEffect
            }}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                if (!scheduleName.trim()) {
                  toast({
                    title: 'Validation error',
                    description: 'Schedule name is required',
                    variant: 'destructive',
                  });
                  return;
                }

                if (!scheduleJobTemplate) {
                  toast({
                    title: 'Validation error',
                    description: 'Job template is required',
                    variant: 'destructive',
                  });
                  return;
                }

                if (!scheduleRrule.trim()) {
                  toast({
                    title: 'Validation error',
                    description: 'Schedule rule (RRULE) is required',
                    variant: 'destructive',
                  });
                  return;
                }

                const extraData: Record<string, any> = {};
                if (scheduleLimit.trim()) {
                  extraData.limit = scheduleLimit.trim();
                }
                if (scheduleExtraVars.trim()) {
                  extraData.extraVars = scheduleExtraVars.trim();
                }

                const scheduleData = {
                  name: scheduleName.trim(),
                  description: scheduleDescription.trim() || undefined,
                  unifiedJobTemplate: scheduleJobTemplate,
                  enabled: scheduleEnabled,
                  rrule: scheduleRrule.trim(),
                  timezone: scheduleTimezone,
                  extraData: Object.keys(extraData).length > 0 ? extraData : undefined,
                };

                if (editingSchedule) {
                  updateSchedule(editingSchedule, scheduleData);
                  setEditingSchedule(null);
                } else {
                  addSchedule(scheduleData);
                }

                // Reset form and close dialog
                setShowCreateSchedule(false);
              }}
              disabled={!scheduleName.trim() || !scheduleJobTemplate || !scheduleRrule.trim()}
            >
              {editingSchedule ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

