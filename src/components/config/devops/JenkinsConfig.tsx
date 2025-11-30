import { useState } from 'react';
import { useCanvasStore } from '@/store/useCanvasStore';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Plus, Trash2, Play, GitBranch, Settings, Code, Clock } from 'lucide-react';
import { CanvasNode } from '@/types';

interface Stage {
  id: string;
  name: string;
  type: 'shell' | 'docker' | 'git' | 'test';
  command?: string;
  image?: string;
  repository?: string;
  branch?: string;
}

interface Pipeline {
  id: string;
  name: string;
  description?: string;
  trigger: 'manual' | 'push' | 'schedule' | 'webhook';
  schedule?: string;
  stages: Stage[];
  enabled: boolean;
}

interface JenkinsConfig {
  serverUrl?: string;
  pipelines?: Pipeline[];
  nodeCount?: number;
  executorCount?: number;
}

export function JenkinsConfig({ componentId }: { componentId: string }) {
  const { nodes, updateNode } = useCanvasStore();
  const node = nodes.find((n) => n.id === componentId) as CanvasNode | undefined;
  const [activeTab, setActiveTab] = useState('pipelines');

  if (!node) return <div className="p-4 text-muted-foreground">Component not found</div>;

  const config = (node.data.config as any) || {} as JenkinsConfig;
  const pipelines = config.pipelines || [];

  const updateConfig = (updates: Partial<JenkinsConfig>) => {
    updateNode(componentId, {
      data: {
        ...node.data,
        config: { ...config, ...updates },
      },
    });
  };

  const addPipeline = () => {
    const newPipeline: Pipeline = {
      id: `pipeline-${Date.now()}`,
      name: 'New Pipeline',
      trigger: 'manual',
      stages: [],
      enabled: true,
    };
    updateConfig({ pipelines: [...pipelines, newPipeline] });
  };

  const updatePipeline = (index: number, updates: Partial<Pipeline>) => {
    const updated = [...pipelines];
    updated[index] = { ...updated[index], ...updates };
    updateConfig({ pipelines: updated });
  };

  const removePipeline = (index: number) => {
    updateConfig({ pipelines: pipelines.filter((_, i) => i !== index) });
  };

  const addStage = (pipelineIndex: number) => {
    const pipeline = pipelines[pipelineIndex];
    const newStage: Stage = {
      id: `stage-${Date.now()}`,
      name: 'New Stage',
      type: 'shell',
      command: '',
    };
    updatePipeline(pipelineIndex, {
      stages: [...(pipeline.stages || []), newStage],
    });
  };

  const updateStage = (pipelineIndex: number, stageIndex: number, updates: Partial<Stage>) => {
    const pipeline = pipelines[pipelineIndex];
    const updatedStages = [...(pipeline.stages || [])];
    updatedStages[stageIndex] = { ...updatedStages[stageIndex], ...updates };
    updatePipeline(pipelineIndex, { stages: updatedStages });
  };

  const removeStage = (pipelineIndex: number, stageIndex: number) => {
    const pipeline = pipelines[pipelineIndex];
    updatePipeline(pipelineIndex, {
      stages: (pipeline.stages || []).filter((_, i) => i !== stageIndex),
    });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <div className="border-b border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Code className="h-6 w-6" />
              Jenkins CI/CD
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure pipelines, jobs, and build stages
            </p>
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
        <div className="border-b border-border px-4">
          <TabsList className="bg-transparent">
            <TabsTrigger value="pipelines" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Pipelines
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Settings
            </TabsTrigger>
          </TabsList>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-6">
            <TabsContent value="pipelines" className="space-y-4 mt-0">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">CI/CD Pipelines</h3>
                  <p className="text-sm text-muted-foreground">Define build and deployment pipelines</p>
                </div>
                <Button onClick={addPipeline} size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Add Pipeline
                </Button>
              </div>

              <div className="space-y-6">
                {pipelines.map((pipeline, pipelineIndex) => (
                  <div key={pipeline.id} className="border border-border rounded-lg p-4 space-y-4 bg-card">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Play className="h-5 w-5" />
                        <Input
                          value={pipeline.name}
                          onChange={(e) => updatePipeline(pipelineIndex, { name: e.target.value })}
                          placeholder="Pipeline Name"
                          className="font-semibold text-lg border-0 bg-transparent p-0 h-auto"
                        />
                        <Badge variant={pipeline.enabled ? 'default' : 'secondary'}>
                          {pipeline.enabled ? 'Enabled' : 'Disabled'}
                        </Badge>
                        <Badge variant="outline">{pipeline.trigger}</Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removePipeline(pipelineIndex)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={pipeline.description || ''}
                          onChange={(e) => updatePipeline(pipelineIndex, { description: e.target.value })}
                          placeholder="Pipeline description"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Trigger</Label>
                        <select
                          value={pipeline.trigger}
                          onChange={(e) =>
                            updatePipeline(pipelineIndex, { trigger: e.target.value as Pipeline['trigger'] })
                          }
                          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                        >
                          <option value="manual">Manual</option>
                          <option value="push">On Push</option>
                          <option value="schedule">Scheduled</option>
                          <option value="webhook">Webhook</option>
                        </select>
                      </div>
                    </div>

                    {pipeline.trigger === 'schedule' && (
                      <div className="space-y-2">
                        <Label>Cron Schedule</Label>
                        <Input
                          value={pipeline.schedule || ''}
                          onChange={(e) => updatePipeline(pipelineIndex, { schedule: e.target.value })}
                          placeholder="0 0 * * *"
                          className="font-mono"
                        />
                        <div className="text-xs text-muted-foreground">
                          Example: <code className="bg-secondary px-1 rounded">0 0 * * *</code> (daily at midnight)
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Switch
                        checked={pipeline.enabled}
                        onCheckedChange={(checked) => updatePipeline(pipelineIndex, { enabled: checked })}
                      />
                      <Label className="text-sm">Pipeline Enabled</Label>
                    </div>

                    <Separator />

                    {/* Stages Section */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <GitBranch className="h-4 w-4" />
                          <Label className="text-base font-semibold">Stages</Label>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addStage(pipelineIndex)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Add Stage
                        </Button>
                      </div>

                      {pipeline.stages && pipeline.stages.length > 0 ? (
                        <div className="space-y-3">
                          {pipeline.stages.map((stage, stageIndex) => (
                            <div key={stage.id} className="border border-border rounded p-3 space-y-3 bg-secondary/30">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 flex-1">
                                  <Input
                                    value={stage.name}
                                    onChange={(e) => updateStage(pipelineIndex, stageIndex, { name: e.target.value })}
                                    placeholder="Stage Name"
                                    className="font-semibold border-0 bg-transparent p-0 h-auto flex-1"
                                  />
                                  <Badge variant="outline">{stage.type}</Badge>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeStage(pipelineIndex, stageIndex)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="space-y-2">
                                <Label className="text-xs">Stage Type</Label>
                                <select
                                  value={stage.type}
                                  onChange={(e) =>
                                    updateStage(pipelineIndex, stageIndex, {
                                      type: e.target.value as Stage['type'],
                                    })
                                  }
                                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                >
                                  <option value="shell">Shell Script</option>
                                  <option value="docker">Docker Build</option>
                                  <option value="git">Git Checkout</option>
                                  <option value="test">Test</option>
                                </select>
                              </div>

                              {stage.type === 'shell' && (
                                <div className="space-y-2">
                                  <Label className="text-xs">Shell Command</Label>
                                  <textarea
                                    value={stage.command || ''}
                                    onChange={(e) =>
                                      updateStage(pipelineIndex, stageIndex, { command: e.target.value })
                                    }
                                    placeholder="npm install && npm run build"
                                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                                    rows={4}
                                  />
                                </div>
                              )}

                              {stage.type === 'docker' && (
                                <div className="space-y-2">
                                  <Label className="text-xs">Docker Image</Label>
                                  <Input
                                    value={stage.image || ''}
                                    onChange={(e) => updateStage(pipelineIndex, stageIndex, { image: e.target.value })}
                                    placeholder="node:18"
                                    className="font-mono text-sm"
                                  />
                                </div>
                              )}

                              {stage.type === 'git' && (
                                <div className="grid grid-cols-2 gap-3">
                                  <div className="space-y-2">
                                    <Label className="text-xs">Repository</Label>
                                    <Input
                                      value={stage.repository || ''}
                                      onChange={(e) =>
                                        updateStage(pipelineIndex, stageIndex, { repository: e.target.value })
                                      }
                                      placeholder="https://github.com/user/repo.git"
                                      className="font-mono text-sm"
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label className="text-xs">Branch</Label>
                                    <Input
                                      value={stage.branch || ''}
                                      onChange={(e) => updateStage(pipelineIndex, stageIndex, { branch: e.target.value })}
                                      placeholder="main"
                                      className="font-mono text-sm"
                                    />
                                  </div>
                                </div>
                              )}

                              {stage.type === 'test' && (
                                <div className="space-y-2">
                                  <Label className="text-xs">Test Command</Label>
                                  <Input
                                    value={stage.command || ''}
                                    onChange={(e) =>
                                      updateStage(pipelineIndex, stageIndex, { command: e.target.value })
                                    }
                                    placeholder="npm test"
                                    className="font-mono text-sm"
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-4 text-muted-foreground border border-dashed border-border rounded text-sm">
                          No stages defined. Click "Add Stage" to create one.
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {pipelines.length === 0 && (
                  <div className="text-center py-12 text-muted-foreground">
                    <Play className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No pipelines defined. Click "Add Pipeline" to create one.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-0">
              <div>
                <h3 className="text-lg font-semibold mb-4">Jenkins Settings</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Server URL</Label>
                    <Input
                      value={config.serverUrl || ''}
                      onChange={(e) => updateConfig({ serverUrl: e.target.value })}
                      placeholder="http://jenkins:8080"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Node Count</Label>
                      <Input
                        type="number"
                        value={config.nodeCount || ''}
                        onChange={(e) => updateConfig({ nodeCount: parseInt(e.target.value) || undefined })}
                        placeholder="1"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Executor Count</Label>
                      <Input
                        type="number"
                        value={config.executorCount || ''}
                        onChange={(e) => updateConfig({ executorCount: parseInt(e.target.value) || undefined })}
                        placeholder="2"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

