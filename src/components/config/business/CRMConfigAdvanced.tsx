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
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { useState, useEffect, useMemo } from 'react';
import { 
  Settings, 
  Activity,
  Plus,
  Trash2,
  Edit,
  RefreshCcw,
  Users,
  Phone,
  Mail,
  Building,
  TrendingUp,
  DollarSign,
  Search,
  Filter,
  X,
  AlertCircle,
  FileText,
  UserPlus,
  Briefcase,
  Target,
  HelpCircle,
  Calendar,
  Clock
} from 'lucide-react';
import type { 
  CRMContact, CRMDeal, CRMAccount, CRMLead, CRMCase, CRMActivity,
  ContactStatus, DealStage, AccountType, CaseStatus, CasePriority
} from '@/core/CRMEmulationEngine';

interface CRMConfigProps {
  componentId: string;
}

interface CRMConfig {
  crmType?: 'salesforce' | 'hubspot' | 'dynamics' | 'custom';
  apiEndpoint?: string;
  enableContacts?: boolean;
  enableLeads?: boolean;
  enableOpportunities?: boolean;
  enableAccounts?: boolean;
  enableCases?: boolean;
  enableReports?: boolean;
  enableWorkflows?: boolean;
  enableIntegrations?: boolean;
  contacts?: CRMContact[];
  deals?: CRMDeal[];
  accounts?: CRMAccount[];
  leads?: CRMLead[];
  cases?: CRMCase[];
  activities?: CRMActivity[];
  requestsPerSecond?: number;
  averageResponseTime?: number;
  errorRate?: number;
  conversionRate?: number;
  dealWinRate?: number;
  caseResolutionTime?: number;
}

export function CRMConfigAdvanced({ componentId }: CRMConfigProps) {
  const { nodes, updateNode } = useCanvasStore();
  const { getComponentMetrics } = useEmulationStore();
  const { toast } = useToast();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  // Get CRM emulation engine for real-time metrics
  const crmEngine = emulationEngine.getCRMEmulationEngine(componentId);
  const componentMetrics = getComponentMetrics(componentId);
  const customMetrics = componentMetrics?.customMetrics || {};

  const config = (node.data.config as any) || {} as CRMConfig;
  const contacts = config.contacts || [];
  const deals = config.deals || [];
  const accounts = config.accounts || [];
  const leads = config.leads || [];
  const cases = config.cases || [];
  const activities = config.activities || [];

  // Get real-time metrics from emulation engine or fallback to config
  const crmMetrics = crmEngine?.getMetrics();
  const totalContacts = crmMetrics?.contactsTotal ?? contacts.length;
  const totalDeals = crmMetrics?.dealsTotal ?? deals.length;
  const pipelineValue = crmMetrics?.pipelineValue ?? deals.filter(d => d.stage !== 'closed-won' && d.stage !== 'closed-lost').reduce((sum, d) => sum + d.value, 0);
  const conversionRate = crmMetrics?.conversionRate ?? (leads.length > 0 ? (leads.filter((l) => l.status === 'converted').length / leads.length) * 100 : 0);
  const dealWinRate = crmMetrics?.dealWinRate ?? 0;
  const requestsPerSecond = crmMetrics?.requestsPerSecond ?? customMetrics.requestsPerSecond ?? 0;
  const averageResponseTime = crmMetrics?.averageResponseTime ?? customMetrics.averageResponseTime ?? 0;
  const errorRate = crmMetrics?.errorRate ?? customMetrics.errorRate ?? 0;

  // State for dialogs and forms
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [dealDialogOpen, setDealDialogOpen] = useState(false);
  const [accountDialogOpen, setAccountDialogOpen] = useState(false);
  const [leadDialogOpen, setLeadDialogOpen] = useState(false);
  const [caseDialogOpen, setCaseDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CRMContact | null>(null);
  const [editingDeal, setEditingDeal] = useState<CRMDeal | null>(null);
  const [editingAccount, setEditingAccount] = useState<CRMAccount | null>(null);
  const [editingLead, setEditingLead] = useState<CRMLead | null>(null);
  const [editingCase, setEditingCase] = useState<CRMCase | null>(null);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [stageFilter, setStageFilter] = useState<string>('all');

  const updateConfig = (updates: Partial<CRMConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
    
    // Sync with emulation engine
    if (crmEngine) {
      crmEngine.initializeConfig(node);
    }
  };

  // Sync data from emulation engine
  useEffect(() => {
    if (crmEngine) {
      const engineContacts = crmEngine.getContacts();
      const engineDeals = crmEngine.getDeals();
      const engineAccounts = crmEngine.getAccounts();
      const engineLeads = crmEngine.getLeads();
      const engineCases = crmEngine.getCases();
      const engineActivities = crmEngine.getActivities();
      
      // Only sync if engine has data and config is empty
      if ((engineContacts.length > 0 || engineDeals.length > 0 || engineAccounts.length > 0) && 
          (contacts.length === 0 && deals.length === 0 && accounts.length === 0)) {
        updateConfig({
          contacts: engineContacts,
          deals: engineDeals,
          accounts: engineAccounts,
          leads: engineLeads,
          cases: engineCases,
          activities: engineActivities,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crmEngine]);

  // Contact CRUD
  const openContactDialog = (contact?: CRMContact) => {
    setEditingContact(contact || null);
    setContactDialogOpen(true);
  };

  const saveContact = (contactData: Partial<CRMContact>) => {
    if (!contactData.name) {
      toast({
        title: 'Validation error',
        description: 'Contact name is required',
        variant: 'destructive',
      });
      return;
    }

    const updatedContacts = editingContact
      ? contacts.map(c => c.id === editingContact.id ? { ...c, ...contactData } as CRMContact : c)
      : [...contacts, { 
          id: `contact-${Date.now()}`,
          name: contactData.name!,
          email: contactData.email,
          phone: contactData.phone,
          company: contactData.company,
          status: contactData.status || 'lead',
          createdAt: Date.now(),
          lastContact: Date.now(),
        } as CRMContact];

    updateConfig({ contacts: updatedContacts });
    
    if (crmEngine) {
      if (editingContact) {
        crmEngine.updateContact(editingContact.id, contactData as Partial<CRMContact>);
      } else {
        const newContact = updatedContacts[updatedContacts.length - 1];
        crmEngine.addContact(newContact);
      }
    }

    setContactDialogOpen(false);
    toast({
      title: editingContact ? 'Contact updated' : 'Contact created',
      description: `Contact ${contactData.name} has been ${editingContact ? 'updated' : 'created'}.`,
    });
  };

  const removeContact = (id: string) => {
    updateConfig({ contacts: contacts.filter((c) => c.id !== id) });
    if (crmEngine) {
      crmEngine.removeContact(id);
    }
    toast({
      title: 'Contact removed',
      description: 'Contact has been removed.',
    });
  };

  // Deal CRUD
  const openDealDialog = (deal?: CRMDeal) => {
    setEditingDeal(deal || null);
    setDealDialogOpen(true);
  };

  const saveDeal = (dealData: Partial<CRMDeal>) => {
    if (!dealData.name || !dealData.value) {
      toast({
        title: 'Validation error',
        description: 'Deal name and value are required',
        variant: 'destructive',
      });
      return;
    }

    const updatedDeals = editingDeal
      ? deals.map(d => d.id === editingDeal.id ? { ...d, ...dealData } as CRMDeal : d)
      : [...deals, {
          id: `deal-${Date.now()}`,
          name: dealData.name!,
          value: dealData.value!,
          stage: dealData.stage || 'prospecting',
          probability: dealData.probability || 0,
          contactId: dealData.contactId,
          accountId: dealData.accountId,
          expectedClose: dealData.expectedClose,
          createdAt: Date.now(),
        } as CRMDeal];

    updateConfig({ deals: updatedDeals });
    
    if (crmEngine) {
      if (editingDeal) {
        crmEngine.updateDeal(editingDeal.id, dealData as Partial<CRMDeal>);
      } else {
        const newDeal = updatedDeals[updatedDeals.length - 1];
        crmEngine.addDeal(newDeal);
      }
    }

    setDealDialogOpen(false);
    toast({
      title: editingDeal ? 'Deal updated' : 'Deal created',
      description: `Deal ${dealData.name} has been ${editingDeal ? 'updated' : 'created'}.`,
    });
  };

  const removeDeal = (id: string) => {
    updateConfig({ deals: deals.filter((d) => d.id !== id) });
    if (crmEngine) {
      crmEngine.removeDeal(id);
    }
    toast({
      title: 'Deal removed',
      description: 'Deal has been removed.',
    });
  };

  // Account CRUD
  const openAccountDialog = (account?: CRMAccount) => {
    setEditingAccount(account || null);
    setAccountDialogOpen(true);
  };

  const saveAccount = (accountData: Partial<CRMAccount>) => {
    if (!accountData.name) {
      toast({
        title: 'Validation error',
        description: 'Account name is required',
        variant: 'destructive',
      });
      return;
    }

    const updatedAccounts = editingAccount
      ? accounts.map(a => a.id === editingAccount.id ? { ...a, ...accountData } as CRMAccount : a)
      : [...accounts, {
          id: `account-${Date.now()}`,
          name: accountData.name!,
          type: accountData.type || 'customer',
          industry: accountData.industry,
          website: accountData.website,
          phone: accountData.phone,
          email: accountData.email,
          address: accountData.address,
          annualRevenue: accountData.annualRevenue,
          employees: accountData.employees,
          createdAt: Date.now(),
        } as CRMAccount];

    updateConfig({ accounts: updatedAccounts });
    
    if (crmEngine) {
      if (editingAccount) {
        crmEngine.updateAccount(editingAccount.id, accountData as Partial<CRMAccount>);
      } else {
        const newAccount = updatedAccounts[updatedAccounts.length - 1];
        crmEngine.addAccount(newAccount);
      }
    }

    setAccountDialogOpen(false);
    toast({
      title: editingAccount ? 'Account updated' : 'Account created',
      description: `Account ${accountData.name} has been ${editingAccount ? 'updated' : 'created'}.`,
    });
  };

  const removeAccount = (id: string) => {
    updateConfig({ accounts: accounts.filter((a) => a.id !== id) });
    if (crmEngine) {
      crmEngine.removeAccount(id);
    }
    toast({
      title: 'Account removed',
      description: 'Account has been removed.',
    });
  };

  // Lead CRUD
  const openLeadDialog = (lead?: CRMLead) => {
    setEditingLead(lead || null);
    setLeadDialogOpen(true);
  };

  const saveLead = (leadData: Partial<CRMLead>) => {
    if (!leadData.name) {
      toast({
        title: 'Validation error',
        description: 'Lead name is required',
        variant: 'destructive',
      });
      return;
    }

    const updatedLeads = editingLead
      ? leads.map(l => l.id === editingLead.id ? { ...l, ...leadData } as CRMLead : l)
      : [...leads, {
          id: `lead-${Date.now()}`,
          name: leadData.name!,
          email: leadData.email,
          phone: leadData.phone,
          company: leadData.company,
          status: leadData.status || 'new',
          source: leadData.source || 'web',
          score: leadData.score || 0,
          createdAt: Date.now(),
        } as CRMLead];

    updateConfig({ leads: updatedLeads });
    
    if (crmEngine) {
      if (editingLead) {
        crmEngine.updateLead(editingLead.id, leadData as Partial<CRMLead>);
      } else {
        const newLead = updatedLeads[updatedLeads.length - 1];
        crmEngine.addLead(newLead);
      }
    }

    setLeadDialogOpen(false);
    toast({
      title: editingLead ? 'Lead updated' : 'Lead created',
      description: `Lead ${leadData.name} has been ${editingLead ? 'updated' : 'created'}.`,
    });
  };

  const removeLead = (id: string) => {
    updateConfig({ leads: leads.filter((l) => l.id !== id) });
    if (crmEngine) {
      crmEngine.removeLead(id);
    }
    toast({
      title: 'Lead removed',
      description: 'Lead has been removed.',
    });
  };

  // Case CRUD
  const openCaseDialog = (crmCase?: CRMCase) => {
    setEditingCase(crmCase || null);
    setCaseDialogOpen(true);
  };

  const saveCase = (caseData: Partial<CRMCase>) => {
    if (!caseData.subject) {
      toast({
        title: 'Validation error',
        description: 'Case subject is required',
        variant: 'destructive',
      });
      return;
    }

    const updatedCases = editingCase
      ? cases.map(c => c.id === editingCase.id ? { ...c, ...caseData } as CRMCase : c)
      : [...cases, {
          id: `case-${Date.now()}`,
          subject: caseData.subject!,
          description: caseData.description,
          contactId: caseData.contactId,
          accountId: caseData.accountId,
          status: caseData.status || 'new',
          priority: caseData.priority || 'medium',
          type: caseData.type || 'question',
          createdAt: Date.now(),
        } as CRMCase];

    updateConfig({ cases: updatedCases });
    
    if (crmEngine) {
      if (editingCase) {
        crmEngine.updateCase(editingCase.id, caseData as Partial<CRMCase>);
      } else {
        const newCase = updatedCases[updatedCases.length - 1];
        crmEngine.addCase(newCase);
      }
    }

    setCaseDialogOpen(false);
    toast({
      title: editingCase ? 'Case updated' : 'Case created',
      description: `Case ${caseData.subject} has been ${editingCase ? 'updated' : 'created'}.`,
    });
  };

  const removeCase = (id: string) => {
    updateConfig({ cases: cases.filter((c) => c.id !== id) });
    if (crmEngine) {
      crmEngine.removeCase(id);
    }
    toast({
      title: 'Case removed',
      description: 'Case has been removed.',
    });
  };

  // Filtered and searched data
  const filteredContacts = useMemo(() => {
    let filtered = contacts;
    if (searchQuery) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.company?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(c => c.status === statusFilter);
    }
    return filtered;
  }, [contacts, searchQuery, statusFilter]);

  const filteredDeals = useMemo(() => {
    let filtered = deals;
    if (searchQuery) {
      filtered = filtered.filter(d => 
        d.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    if (stageFilter !== 'all') {
      filtered = filtered.filter(d => d.stage === stageFilter);
    }
    return filtered;
  }, [deals, searchQuery, stageFilter]);

  const getStageColor = (stage: string) => {
    switch (stage) {
      case 'closed-won':
        return 'bg-green-500';
      case 'closed-lost':
        return 'bg-red-500';
      case 'negotiation':
        return 'bg-blue-500';
      case 'proposal':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'customer':
        return 'bg-green-500';
      case 'lead':
        return 'bg-blue-500';
      case 'partner':
        return 'bg-purple-500';
      case 'inactive':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="p-6 space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs uppercase text-muted-foreground tracking-wide">CRM System</p>
            <h2 className="text-2xl font-bold text-foreground">Customer Relationship Management</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Manage customer relationships and sales pipeline
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
          <Card className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Contacts</CardTitle>
                <Users className="h-4 w-4 text-blue-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{totalContacts}</span>
                <span className="text-xs text-muted-foreground">total</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-green-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Deals</CardTitle>
                <Activity className="h-4 w-4 text-green-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-green-600 dark:text-green-400">{totalDeals}</span>
                <span className="text-xs text-muted-foreground">active</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-purple-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pipeline Value</CardTitle>
                <DollarSign className="h-4 w-4 text-purple-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-purple-600 dark:text-purple-400">${(pipelineValue / 1000).toFixed(0)}K</span>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-4 border-l-cyan-500">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Conversion</CardTitle>
                <TrendingUp className="h-4 w-4 text-cyan-500" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">{conversionRate.toFixed(1)}%</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="contacts" className="space-y-4">
          <TabsList className="flex flex-wrap gap-2">
            <TabsTrigger value="contacts">
              <Users className="h-4 w-4 mr-2" />
              Contacts ({contacts.length})
            </TabsTrigger>
            <TabsTrigger value="deals">
              <Activity className="h-4 w-4 mr-2" />
              Deals ({deals.length})
            </TabsTrigger>
            <TabsTrigger value="accounts">
              <Building className="h-4 w-4 mr-2" />
              Accounts ({accounts.length})
            </TabsTrigger>
            <TabsTrigger value="leads">
              <Target className="h-4 w-4 mr-2" />
              Leads ({leads.length})
            </TabsTrigger>
            <TabsTrigger value="cases">
              <HelpCircle className="h-4 w-4 mr-2" />
              Cases ({cases.length})
            </TabsTrigger>
            <TabsTrigger value="settings">
              <Settings className="h-4 w-4 mr-2" />
              Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Contacts</CardTitle>
                    <CardDescription>Customer and lead contacts</CardDescription>
                  </div>
                  <Button onClick={() => openContactDialog()} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Contact
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search contacts..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Statuses</SelectItem>
                      <SelectItem value="lead">Lead</SelectItem>
                      <SelectItem value="customer">Customer</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {filteredContacts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No contacts found</p>
                    <p className="text-xs mt-2">Click "Add Contact" to create a new contact</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredContacts.map((contact) => (
                    <Card key={contact.id} className="border-l-4 border-l-blue-500 hover:shadow-md transition-shadow bg-gradient-to-r from-blue-50/50 to-transparent dark:from-blue-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                              <Users className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{contact.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline">{contact.status}</Badge>
                                {contact.company && (
                                  <Badge variant="outline">
                                    <Building className="h-3 w-3 mr-1" />
                                    {contact.company}
                                  </Badge>
                                )}
                                {contact.value && (
                                  <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300">
                                    ${contact.value.toLocaleString()}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openContactDialog(contact)}
                              className="hover:bg-blue-50 dark:hover:bg-blue-950/20"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeContact(contact.id)}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {contact.email && (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span>{contact.email}</span>
                            </div>
                          )}
                          {contact.phone && (
                            <div className="flex items-center gap-2">
                              <Phone className="h-4 w-4 text-muted-foreground" />
                              <span>{contact.phone}</span>
                            </div>
                          )}
                        </div>
                        {contact.lastContact && (
                          <div className="text-xs text-muted-foreground mt-2">
                            Last contact: {new Date(contact.lastContact).toLocaleString()}
                          </div>
                        )}
                      </CardContent>
                    </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="deals" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Sales Pipeline</CardTitle>
                    <CardDescription>Active deals and opportunities</CardDescription>
                  </div>
                  <Button onClick={() => openDealDialog()} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Deal
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4 mb-4">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search deals..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                  <Select value={stageFilter} onValueChange={setStageFilter}>
                    <SelectTrigger className="w-[180px]">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filter by stage" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Stages</SelectItem>
                      <SelectItem value="prospecting">Prospecting</SelectItem>
                      <SelectItem value="qualification">Qualification</SelectItem>
                      <SelectItem value="proposal">Proposal</SelectItem>
                      <SelectItem value="negotiation">Negotiation</SelectItem>
                      <SelectItem value="closed-won">Closed Won</SelectItem>
                      <SelectItem value="closed-lost">Closed Lost</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {filteredDeals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <TrendingUp className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No deals found</p>
                    <p className="text-xs mt-2">Click "Add Deal" to create a new deal</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredDeals.map((deal) => (
                    <Card key={deal.id} className="border-l-4 border-l-green-500 hover:shadow-md transition-shadow bg-gradient-to-r from-green-50/50 to-transparent dark:from-green-950/10">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2 rounded-lg ${getStageColor(deal.stage)}/20`}>
                              <DollarSign className="h-5 w-5 text-green-600 dark:text-green-400" />
                            </div>
                            <div>
                              <CardTitle className="text-lg font-semibold">{deal.name}</CardTitle>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge variant="outline" className={getStageColor(deal.stage)}>
                                  {deal.stage}
                                </Badge>
                                <Badge variant="outline">${deal.value.toLocaleString()}</Badge>
                                <Badge variant="outline">{deal.probability}% probability</Badge>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDealDialog(deal)}
                              className="hover:bg-green-50 dark:hover:bg-green-950/20"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeDeal(deal.id)}
                              className="hover:bg-destructive/10 hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm">
                          {deal.contactId && (
                            <div className="mb-2">
                              <span className="text-muted-foreground">Contact:</span>
                              <span className="ml-2 font-semibold">{contacts.find((c) => c.id === deal.contactId)?.name || deal.contactId}</span>
                            </div>
                          )}
                          {deal.accountId && (
                            <div className="mb-2">
                              <span className="text-muted-foreground">Account:</span>
                              <span className="ml-2 font-semibold">{accounts.find((a) => a.id === deal.accountId)?.name || deal.accountId}</span>
                            </div>
                          )}
                          {deal.description && (
                            <div className="mb-2 text-muted-foreground">{deal.description}</div>
                          )}
                          {deal.expectedClose && (
                            <div className="text-xs text-muted-foreground mt-2">
                              Expected close: {new Date(deal.expectedClose).toLocaleDateString()}
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
          </TabsContent>

          <TabsContent value="accounts" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Accounts</CardTitle>
                    <CardDescription>Company accounts and organizations</CardDescription>
                  </div>
                  <Button onClick={() => openAccountDialog()} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Account
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {accounts.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Building className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No accounts configured</p>
                    <p className="text-xs mt-2">Click "Add Account" to create a new account</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {accounts.map((account) => (
                      <Card key={account.id} className="border-l-4 border-l-purple-500 hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-purple-100 dark:bg-purple-900/30">
                                <Building className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                              </div>
                              <div>
                                <CardTitle className="text-lg font-semibold">{account.name}</CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline">{account.type}</Badge>
                                  {account.industry && <Badge variant="outline">{account.industry}</Badge>}
                                  {account.annualRevenue && (
                                    <Badge variant="outline" className="bg-green-50 dark:bg-green-950/20">
                                      ${(account.annualRevenue / 1000000).toFixed(1)}M
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openAccountDialog(account)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => removeAccount(account.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {account.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span>{account.email}</span>
                              </div>
                            )}
                            {account.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span>{account.phone}</span>
                              </div>
                            )}
                            {account.website && (
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4 text-muted-foreground" />
                                <span>{account.website}</span>
                              </div>
                            )}
                            {account.employees && (
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span>{account.employees} employees</span>
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
          </TabsContent>

          <TabsContent value="leads" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Leads</CardTitle>
                    <CardDescription>Potential customers and prospects</CardDescription>
                  </div>
                  <Button onClick={() => openLeadDialog()} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Lead
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {leads.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No leads configured</p>
                    <p className="text-xs mt-2">Click "Add Lead" to create a new lead</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {leads.map((lead) => (
                      <Card key={lead.id} className="border-l-4 border-l-orange-500 hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                                <Target className="h-5 w-5 text-orange-600 dark:text-orange-400" />
                              </div>
                              <div>
                                <CardTitle className="text-lg font-semibold">{lead.name}</CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline">{lead.status}</Badge>
                                  {lead.source && <Badge variant="outline">{lead.source}</Badge>}
                                  {lead.score !== undefined && (
                                    <Badge variant="outline" className="bg-blue-50 dark:bg-blue-950/20">
                                      Score: {lead.score}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openLeadDialog(lead)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => removeLead(lead.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            {lead.email && (
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span>{lead.email}</span>
                              </div>
                            )}
                            {lead.phone && (
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-muted-foreground" />
                                <span>{lead.phone}</span>
                              </div>
                            )}
                            {lead.company && (
                              <div className="flex items-center gap-2">
                                <Building className="h-4 w-4 text-muted-foreground" />
                                <span>{lead.company}</span>
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
          </TabsContent>

          <TabsContent value="cases" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Support Cases</CardTitle>
                    <CardDescription>Customer support tickets and issues</CardDescription>
                  </div>
                  <Button onClick={() => openCaseDialog()} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Case
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {cases.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <HelpCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                    <p>No cases configured</p>
                    <p className="text-xs mt-2">Click "Add Case" to create a new case</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cases.map((crmCase) => (
                      <Card key={crmCase.id} className="border-l-4 border-l-red-500 hover:shadow-md transition-shadow">
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3">
                              <div className="p-2 rounded-lg bg-red-100 dark:bg-red-900/30">
                                <HelpCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                              </div>
                              <div>
                                <CardTitle className="text-lg font-semibold">{crmCase.subject}</CardTitle>
                                <div className="flex items-center gap-2 mt-2">
                                  <Badge variant="outline">{crmCase.status}</Badge>
                                  <Badge variant="outline" className={
                                    crmCase.priority === 'critical' ? 'bg-red-500' :
                                    crmCase.priority === 'high' ? 'bg-orange-500' :
                                    crmCase.priority === 'medium' ? 'bg-yellow-500' : 'bg-gray-500'
                                  }>
                                    {crmCase.priority}
                                  </Badge>
                                  {crmCase.type && <Badge variant="outline">{crmCase.type}</Badge>}
                                </div>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Button variant="ghost" size="icon" onClick={() => openCaseDialog(crmCase)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => removeCase(crmCase.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          {crmCase.description && (
                            <p className="text-sm text-muted-foreground mb-2">{crmCase.description}</p>
                          )}
                          <div className="text-xs text-muted-foreground">
                            Created: {crmCase.createdAt ? new Date(crmCase.createdAt).toLocaleString() : 'N/A'}
                            {crmCase.resolvedAt && (
                              <span className="ml-4">Resolved: {new Date(crmCase.resolvedAt).toLocaleString()}</span>
                            )}
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
                <CardTitle>CRM Settings</CardTitle>
                <CardDescription>System configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>CRM Type</Label>
                  <Select value={config.crmType || 'salesforce'} onValueChange={(value) => updateConfig({ crmType: value as any })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salesforce">Salesforce</SelectItem>
                      <SelectItem value="hubspot">HubSpot</SelectItem>
                      <SelectItem value="dynamics">Microsoft Dynamics</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>API Endpoint</Label>
                  <Input
                    value={config.apiEndpoint || ''}
                    onChange={(e) => updateConfig({ apiEndpoint: e.target.value })}
                    placeholder="https://api.crm.example.com"
                  />
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Contacts</Label>
                    <p className="text-xs text-muted-foreground">Manage customer contacts</p>
                  </div>
                  <Switch checked={config.enableContacts ?? true} onCheckedChange={(checked) => updateConfig({ enableContacts: checked })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Leads</Label>
                    <p className="text-xs text-muted-foreground">Manage potential customers</p>
                  </div>
                  <Switch checked={config.enableLeads ?? true} onCheckedChange={(checked) => updateConfig({ enableLeads: checked })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Opportunities</Label>
                    <p className="text-xs text-muted-foreground">Manage sales opportunities</p>
                  </div>
                  <Switch checked={config.enableOpportunities ?? true} onCheckedChange={(checked) => updateConfig({ enableOpportunities: checked })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Accounts</Label>
                    <p className="text-xs text-muted-foreground">Manage company accounts</p>
                  </div>
                  <Switch checked={config.enableAccounts ?? true} onCheckedChange={(checked) => updateConfig({ enableAccounts: checked })} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Cases</Label>
                    <p className="text-xs text-muted-foreground">Manage support cases</p>
                  </div>
                  <Switch checked={config.enableCases ?? true} onCheckedChange={(checked) => updateConfig({ enableCases: checked })} />
                </div>
                <Separator />
                <div className="space-y-2">
                  <Label>Default Deal Stages</Label>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline">Prospecting</Badge>
                    <Badge variant="outline">Qualification</Badge>
                    <Badge variant="outline">Proposal</Badge>
                    <Badge variant="outline">Negotiation</Badge>
                    <Badge variant="outline">Closed Won</Badge>
                    <Badge variant="outline">Closed Lost</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Contact Dialog */}
        <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingContact ? 'Edit Contact' : 'Create Contact'}</DialogTitle>
              <DialogDescription>Enter contact information</DialogDescription>
            </DialogHeader>
            <ContactForm
              contact={editingContact}
              contacts={contacts}
              accounts={accounts}
              onSave={(data) => {
                saveContact(data);
                setEditingContact(null);
              }}
              onCancel={() => {
                setContactDialogOpen(false);
                setEditingContact(null);
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Deal Dialog */}
        <Dialog open={dealDialogOpen} onOpenChange={setDealDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingDeal ? 'Edit Deal' : 'Create Deal'}</DialogTitle>
              <DialogDescription>Enter deal information</DialogDescription>
            </DialogHeader>
            <DealForm
              deal={editingDeal}
              contacts={contacts}
              accounts={accounts}
              onSave={(data) => {
                saveDeal(data);
                setEditingDeal(null);
              }}
              onCancel={() => {
                setDealDialogOpen(false);
                setEditingDeal(null);
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Account Dialog */}
        <Dialog open={accountDialogOpen} onOpenChange={setAccountDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingAccount ? 'Edit Account' : 'Create Account'}</DialogTitle>
              <DialogDescription>Enter account information</DialogDescription>
            </DialogHeader>
            <AccountForm
              account={editingAccount}
              onSave={(data) => {
                saveAccount(data);
                setEditingAccount(null);
              }}
              onCancel={() => {
                setAccountDialogOpen(false);
                setEditingAccount(null);
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Lead Dialog */}
        <Dialog open={leadDialogOpen} onOpenChange={setLeadDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingLead ? 'Edit Lead' : 'Create Lead'}</DialogTitle>
              <DialogDescription>Enter lead information</DialogDescription>
            </DialogHeader>
            <LeadForm
              lead={editingLead}
              onSave={(data) => {
                saveLead(data);
                setEditingLead(null);
              }}
              onCancel={() => {
                setLeadDialogOpen(false);
                setEditingLead(null);
              }}
            />
          </DialogContent>
        </Dialog>

        {/* Case Dialog */}
        <Dialog open={caseDialogOpen} onOpenChange={setCaseDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingCase ? 'Edit Case' : 'Create Case'}</DialogTitle>
              <DialogDescription>Enter case information</DialogDescription>
            </DialogHeader>
            <CaseForm
              crmCase={editingCase}
              contacts={contacts}
              accounts={accounts}
              onSave={(data) => {
                saveCase(data);
                setEditingCase(null);
              }}
              onCancel={() => {
                setCaseDialogOpen(false);
                setEditingCase(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// Contact Form Component
function ContactForm({ contact, contacts, accounts, onSave, onCancel }: {
  contact?: CRMContact | null;
  contacts: CRMContact[];
  accounts: CRMAccount[];
  onSave: (data: Partial<CRMContact>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Partial<CRMContact>>({
    name: contact?.name || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    company: contact?.company || '',
    status: contact?.status || 'lead',
    accountId: contact?.accountId || '',
    value: contact?.value || 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateEmail = (email: string) => {
    if (!email) return '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) ? '' : 'Invalid email format';
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Name is required';
    }
    
    if (formData.email && formData.email.trim() !== '') {
      const emailError = validateEmail(formData.email);
      if (emailError) {
        newErrors.email = emailError;
      }
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Name *</Label>
        <Input 
          value={formData.name} 
          onChange={(e) => {
            setFormData({ ...formData, name: e.target.value });
            if (errors.name) setErrors({ ...errors, name: '' });
          }}
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input 
            type="email" 
            value={formData.email} 
            onChange={(e) => {
              setFormData({ ...formData, email: e.target.value });
              if (errors.email) setErrors({ ...errors, email: '' });
            }}
            className={errors.email ? 'border-destructive' : ''}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Company</Label>
          <Input value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as ContactStatus })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="lead">Lead</SelectItem>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="partner">Partner</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Account</Label>
        <Select value={formData.accountId || '__none__'} onValueChange={(value) => setFormData({ ...formData, accountId: value === '__none__' ? '' : value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {accounts.map(acc => (
              <SelectItem key={acc.id} value={acc.id}>{acc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave}>Save</Button>
      </DialogFooter>
    </div>
  );
}

// Deal Form Component
function DealForm({ deal, contacts, accounts, onSave, onCancel }: {
  deal?: CRMDeal | null;
  contacts: CRMContact[];
  accounts: CRMAccount[];
  onSave: (data: Partial<CRMDeal>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Partial<CRMDeal>>({
    name: deal?.name || '',
    value: deal?.value || 0,
    stage: deal?.stage || 'prospecting',
    probability: deal?.probability || 0,
    contactId: deal?.contactId || '',
    accountId: deal?.accountId || '',
    description: deal?.description || '',
    expectedClose: deal?.expectedClose,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Deal name is required';
    }
    
    if (!formData.value || formData.value <= 0) {
      newErrors.value = 'Value must be greater than 0';
    }
    
    if (formData.probability !== undefined && (formData.probability < 0 || formData.probability > 100)) {
      newErrors.probability = 'Probability must be between 0 and 100';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Deal Name *</Label>
        <Input 
          value={formData.name} 
          onChange={(e) => {
            setFormData({ ...formData, name: e.target.value });
            if (errors.name) setErrors({ ...errors, name: '' });
          }}
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Value ($) *</Label>
          <Input 
            type="number" 
            value={formData.value} 
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setFormData({ ...formData, value: val });
              if (errors.value) setErrors({ ...errors, value: '' });
            }}
            className={errors.value ? 'border-destructive' : ''}
          />
          {errors.value && <p className="text-sm text-destructive">{errors.value}</p>}
        </div>
        <div className="space-y-2">
          <Label>Probability (%)</Label>
          <Input 
            type="number" 
            min="0" 
            max="100" 
            value={formData.probability} 
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              setFormData({ ...formData, probability: val });
              if (errors.probability) setErrors({ ...errors, probability: '' });
            }}
            className={errors.probability ? 'border-destructive' : ''}
          />
          {errors.probability && <p className="text-sm text-destructive">{errors.probability}</p>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Stage</Label>
          <Select value={formData.stage} onValueChange={(value) => setFormData({ ...formData, stage: value as DealStage })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prospecting">Prospecting</SelectItem>
              <SelectItem value="qualification">Qualification</SelectItem>
              <SelectItem value="proposal">Proposal</SelectItem>
              <SelectItem value="negotiation">Negotiation</SelectItem>
              <SelectItem value="closed-won">Closed Won</SelectItem>
              <SelectItem value="closed-lost">Closed Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Expected Close Date</Label>
          <Input type="date" value={formData.expectedClose ? new Date(formData.expectedClose).toISOString().split('T')[0] : ''} onChange={(e) => setFormData({ ...formData, expectedClose: e.target.value ? new Date(e.target.value).getTime() : undefined })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Contact</Label>
          <Select value={formData.contactId || '__none__'} onValueChange={(value) => setFormData({ ...formData, contactId: value === '__none__' ? '' : value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select contact" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {contacts.map(contact => (
                <SelectItem key={contact.id} value={contact.id}>{contact.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Account</Label>
          <Select value={formData.accountId || '__none__'} onValueChange={(value) => setFormData({ ...formData, accountId: value === '__none__' ? '' : value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {accounts.map(account => (
                <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={3} />
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave}>Save</Button>
      </DialogFooter>
    </div>
  );
}

// Account Form Component
function AccountForm({ account, onSave, onCancel }: {
  account?: CRMAccount | null;
  onSave: (data: Partial<CRMAccount>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Partial<CRMAccount>>({
    name: account?.name || '',
    type: account?.type || 'customer',
    industry: account?.industry || '',
    website: account?.website || '',
    phone: account?.phone || '',
    email: account?.email || '',
    address: account?.address || '',
    annualRevenue: account?.annualRevenue || 0,
    employees: account?.employees || 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateEmail = (email: string) => {
    if (!email) return '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) ? '' : 'Invalid email format';
  };

  const validateUrl = (url: string) => {
    if (!url) return '';
    try {
      new URL(url.startsWith('http') ? url : `https://${url}`);
      return '';
    } catch {
      return 'Invalid URL format';
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Account name is required';
    }
    
    if (formData.email && formData.email.trim() !== '') {
      const emailError = validateEmail(formData.email);
      if (emailError) {
        newErrors.email = emailError;
      }
    }
    
    if (formData.website && formData.website.trim() !== '') {
      const urlError = validateUrl(formData.website);
      if (urlError) {
        newErrors.website = urlError;
      }
    }
    
    if (formData.annualRevenue !== undefined && formData.annualRevenue < 0) {
      newErrors.annualRevenue = 'Annual revenue cannot be negative';
    }
    
    if (formData.employees !== undefined && formData.employees < 0) {
      newErrors.employees = 'Number of employees cannot be negative';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Account Name *</Label>
        <Input 
          value={formData.name} 
          onChange={(e) => {
            setFormData({ ...formData, name: e.target.value });
            if (errors.name) setErrors({ ...errors, name: '' });
          }}
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value as AccountType })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="customer">Customer</SelectItem>
              <SelectItem value="partner">Partner</SelectItem>
              <SelectItem value="competitor">Competitor</SelectItem>
              <SelectItem value="reseller">Reseller</SelectItem>
              <SelectItem value="prospect">Prospect</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Industry</Label>
          <Input value={formData.industry} onChange={(e) => setFormData({ ...formData, industry: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input 
            type="email" 
            value={formData.email} 
            onChange={(e) => {
              setFormData({ ...formData, email: e.target.value });
              if (errors.email) setErrors({ ...errors, email: '' });
            }}
            className={errors.email ? 'border-destructive' : ''}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Website</Label>
        <Input 
          value={formData.website} 
          onChange={(e) => {
            setFormData({ ...formData, website: e.target.value });
            if (errors.website) setErrors({ ...errors, website: '' });
          }}
          className={errors.website ? 'border-destructive' : ''}
        />
        {errors.website && <p className="text-sm text-destructive">{errors.website}</p>}
      </div>
      <div className="space-y-2">
        <Label>Address</Label>
        <Textarea value={formData.address} onChange={(e) => setFormData({ ...formData, address: e.target.value })} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Annual Revenue ($)</Label>
          <Input 
            type="number" 
            value={formData.annualRevenue} 
            onChange={(e) => {
              const val = parseFloat(e.target.value) || 0;
              setFormData({ ...formData, annualRevenue: val });
              if (errors.annualRevenue) setErrors({ ...errors, annualRevenue: '' });
            }}
            className={errors.annualRevenue ? 'border-destructive' : ''}
          />
          {errors.annualRevenue && <p className="text-sm text-destructive">{errors.annualRevenue}</p>}
        </div>
        <div className="space-y-2">
          <Label>Employees</Label>
          <Input 
            type="number" 
            value={formData.employees} 
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              setFormData({ ...formData, employees: val });
              if (errors.employees) setErrors({ ...errors, employees: '' });
            }}
            className={errors.employees ? 'border-destructive' : ''}
          />
          {errors.employees && <p className="text-sm text-destructive">{errors.employees}</p>}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave}>Save</Button>
      </DialogFooter>
    </div>
  );
}

// Lead Form Component
function LeadForm({ lead, onSave, onCancel }: {
  lead?: CRMLead | null;
  onSave: (data: Partial<CRMLead>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Partial<CRMLead>>({
    name: lead?.name || '',
    email: lead?.email || '',
    phone: lead?.phone || '',
    company: lead?.company || '',
    status: lead?.status || 'new',
    source: lead?.source || 'web',
    score: lead?.score || 0,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateEmail = (email: string) => {
    if (!email) return '';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email) ? '' : 'Invalid email format';
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name || formData.name.trim() === '') {
      newErrors.name = 'Lead name is required';
    }
    
    if (formData.email && formData.email.trim() !== '') {
      const emailError = validateEmail(formData.email);
      if (emailError) {
        newErrors.email = emailError;
      }
    }
    
    if (formData.score !== undefined && (formData.score < 0 || formData.score > 100)) {
      newErrors.score = 'Lead score must be between 0 and 100';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Lead Name *</Label>
        <Input 
          value={formData.name} 
          onChange={(e) => {
            setFormData({ ...formData, name: e.target.value });
            if (errors.name) setErrors({ ...errors, name: '' });
          }}
          className={errors.name ? 'border-destructive' : ''}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Email</Label>
          <Input 
            type="email" 
            value={formData.email} 
            onChange={(e) => {
              setFormData({ ...formData, email: e.target.value });
              if (errors.email) setErrors({ ...errors, email: '' });
            }}
            className={errors.email ? 'border-destructive' : ''}
          />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>
        <div className="space-y-2">
          <Label>Phone</Label>
          <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Company</Label>
          <Input value={formData.company} onChange={(e) => setFormData({ ...formData, company: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as any })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="contacted">Contacted</SelectItem>
              <SelectItem value="qualified">Qualified</SelectItem>
              <SelectItem value="converted">Converted</SelectItem>
              <SelectItem value="lost">Lost</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Source</Label>
          <Select value={formData.source} onValueChange={(value) => setFormData({ ...formData, source: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="web">Web</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="phone">Phone</SelectItem>
              <SelectItem value="referral">Referral</SelectItem>
              <SelectItem value="other">Other</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Lead Score (0-100)</Label>
          <Input 
            type="number" 
            min="0" 
            max="100" 
            value={formData.score} 
            onChange={(e) => {
              const val = parseInt(e.target.value) || 0;
              setFormData({ ...formData, score: val });
              if (errors.score) setErrors({ ...errors, score: '' });
            }}
            className={errors.score ? 'border-destructive' : ''}
          />
          {errors.score && <p className="text-sm text-destructive">{errors.score}</p>}
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave}>Save</Button>
      </DialogFooter>
    </div>
  );
}

// Case Form Component
function CaseForm({ crmCase, contacts, accounts, onSave, onCancel }: {
  crmCase?: CRMCase | null;
  contacts: CRMContact[];
  accounts: CRMAccount[];
  onSave: (data: Partial<CRMCase>) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState<Partial<CRMCase>>({
    subject: crmCase?.subject || '',
    description: crmCase?.description || '',
    status: crmCase?.status || 'new',
    priority: crmCase?.priority || 'medium',
    type: crmCase?.type || 'question',
    contactId: crmCase?.contactId || '',
    accountId: crmCase?.accountId || '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.subject || formData.subject.trim() === '') {
      newErrors.subject = 'Subject is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Subject *</Label>
        <Input 
          value={formData.subject} 
          onChange={(e) => {
            setFormData({ ...formData, subject: e.target.value });
            if (errors.subject) setErrors({ ...errors, subject: '' });
          }}
          className={errors.subject ? 'border-destructive' : ''}
        />
        {errors.subject && <p className="text-sm text-destructive">{errors.subject}</p>}
      </div>
      <div className="space-y-2">
        <Label>Description</Label>
        <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={4} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as CaseStatus })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="escalated">Escalated</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
              <SelectItem value="closed">Closed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Priority</Label>
          <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value as CasePriority })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Type</Label>
          <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="question">Question</SelectItem>
              <SelectItem value="problem">Problem</SelectItem>
              <SelectItem value="feature">Feature Request</SelectItem>
              <SelectItem value="complaint">Complaint</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Contact</Label>
          <Select value={formData.contactId || '__none__'} onValueChange={(value) => setFormData({ ...formData, contactId: value === '__none__' ? '' : value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select contact" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">None</SelectItem>
              {contacts.map(contact => (
                <SelectItem key={contact.id} value={contact.id}>{contact.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label>Account</Label>
        <Select value={formData.accountId || '__none__'} onValueChange={(value) => setFormData({ ...formData, accountId: value === '__none__' ? '' : value })}>
          <SelectTrigger>
            <SelectValue placeholder="Select account" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">None</SelectItem>
            {accounts.map(account => (
              <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={handleSave}>Save</Button>
      </DialogFooter>
    </div>
  );
}

