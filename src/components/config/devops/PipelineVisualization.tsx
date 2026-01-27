import { GitLabCIStage, GitLabCIJob, GitLabCIPipeline } from '@/core/GitLabCIEmulationEngine';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, Play, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PipelineVisualizationProps {
  pipeline: GitLabCIPipeline;
  onStageClick?: (stage: GitLabCIStage) => void;
  onJobClick?: (job: GitLabCIJob) => void;
}

export function PipelineVisualization({ pipeline, onStageClick, onJobClick }: PipelineVisualizationProps) {
  if (!pipeline.stages || pipeline.stages.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            No stages available for this pipeline
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStageStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-500 border-green-600';
      case 'failed':
        return 'bg-red-500 border-red-600';
      case 'running':
        return 'bg-blue-500 border-blue-600 animate-pulse';
      case 'pending':
        return 'bg-yellow-500 border-yellow-600';
      case 'canceled':
        return 'bg-gray-500 border-gray-600';
      case 'skipped':
        return 'bg-gray-400 border-gray-500';
      default:
        return 'bg-gray-300 border-gray-400';
    }
  };

  const getJobStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-100 border-green-300 text-green-800';
      case 'failed':
        return 'bg-red-100 border-red-300 text-red-800';
      case 'running':
        return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'pending':
        return 'bg-yellow-100 border-yellow-300 text-yellow-800';
      case 'manual':
        return 'bg-purple-100 border-purple-300 text-purple-800';
      case 'canceled':
        return 'bg-gray-100 border-gray-300 text-gray-800';
      case 'skipped':
        return 'bg-gray-100 border-gray-300 text-gray-600';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-600';
    }
  };

  const getStageStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-4 w-4 text-white" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-white" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-white animate-spin" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-white" />;
      default:
        return <AlertCircle className="h-4 w-4 text-white" />;
    }
  };

  const getJobStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle2 className="h-3 w-3" />;
      case 'failed':
        return <XCircle className="h-3 w-3" />;
      case 'running':
        return <Loader2 className="h-3 w-3 animate-spin" />;
      case 'pending':
        return <Clock className="h-3 w-3" />;
      case 'manual':
        return <Play className="h-3 w-3" />;
      default:
        return <AlertCircle className="h-3 w-3" />;
    }
  };

  // Calculate overall pipeline progress
  const totalJobs = pipeline.stages.reduce((sum, stage) => sum + (stage.jobs?.length || 0), 0);
  const completedJobs = pipeline.stages.reduce(
    (sum, stage) =>
      sum + (stage.jobs?.filter((job) => job.status === 'success' || job.status === 'failed' || job.status === 'skipped').length || 0),
    0
  );
  const pipelineProgress = totalJobs > 0 ? Math.round((completedJobs / totalJobs) * 100) : 0;

  // Calculate stage progress
  const getStageProgress = (stage: GitLabCIStage) => {
    const jobs = stage.jobs || [];
    if (jobs.length === 0) return 0;
    const completed = jobs.filter((job) => job.status === 'success' || job.status === 'failed' || job.status === 'skipped').length;
    return Math.round((completed / jobs.length) * 100);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Pipeline Visualization</CardTitle>
            <CardDescription>
              Pipeline #{pipeline.iid} • {pipeline.ref}
              {pipeline.duration && ` • ${Math.round(pipeline.duration / 1000)}s`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={pipeline.status === 'success' ? 'default' : pipeline.status === 'failed' ? 'destructive' : 'secondary'}>
              {pipeline.status}
            </Badge>
            {totalJobs > 0 && (
              <div className="text-sm text-muted-foreground">
                {completedJobs}/{totalJobs} jobs
              </div>
            )}
          </div>
        </div>
        {totalJobs > 0 && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Overall Progress</span>
              <span>{pipelineProgress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className={cn(
                  'h-2 rounded-full transition-all',
                  pipeline.status === 'success' ? 'bg-green-500' :
                  pipeline.status === 'failed' ? 'bg-red-500' :
                  'bg-blue-500'
                )}
                style={{ width: `${pipelineProgress}%` }}
              />
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Stages visualization */}
          <div className="relative">
            {/* Connection lines */}
            <div className="absolute top-8 left-0 right-0 h-0.5 bg-gray-300 -z-10" />
            
            <div className="flex items-start gap-4 overflow-x-auto pb-4">
              {pipeline.stages.map((stage, index) => {
                const stageProgress = getStageProgress(stage);
                const isLast = index === pipeline.stages.length - 1;
                
                return (
                  <div key={stage.name} className="flex items-start gap-2 flex-shrink-0">
                    {/* Stage node */}
                    <div
                      className={cn(
                        'relative flex flex-col items-center cursor-pointer group',
                        onStageClick && 'hover:scale-105 transition-transform'
                      )}
                      onClick={() => onStageClick?.(stage)}
                    >
                      {/* Stage circle */}
                      <div
                        className={cn(
                          'w-16 h-16 rounded-full border-4 flex items-center justify-center transition-all',
                          getStageStatusColor(stage.status),
                          onStageClick && 'group-hover:shadow-lg'
                        )}
                      >
                        {getStageStatusIcon(stage.status)}
                      </div>
                      
                      {/* Stage name */}
                      <div className="mt-2 text-center">
                        <div className="font-semibold text-sm">{stage.name}</div>
                        {stage.jobs && stage.jobs.length > 0 && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {stage.jobs.filter((j) => j.status === 'success' || j.status === 'failed' || j.status === 'skipped').length}/{stage.jobs.length}
                          </div>
                        )}
                        {stage.duration && (
                          <div className="text-xs text-muted-foreground">
                            {Math.round(stage.duration / 1000)}s
                          </div>
                        )}
                      </div>
                      
                      {/* Stage progress bar */}
                      {stage.jobs && stage.jobs.length > 0 && (
                        <div className="mt-2 w-16">
                          <div className="w-full bg-gray-200 rounded-full h-1">
                            <div
                              className={cn(
                                'h-1 rounded-full transition-all',
                                stage.status === 'success' ? 'bg-green-500' :
                                stage.status === 'failed' ? 'bg-red-500' :
                                'bg-blue-500'
                              )}
                              style={{ width: `${stageProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                    
                    {/* Arrow connector (except for last stage) */}
                    {!isLast && (
                      <div className="flex items-center pt-8">
                        <div className="w-8 h-0.5 bg-gray-300" />
                        <div className="w-0 h-0 border-t-4 border-t-transparent border-b-4 border-b-transparent border-l-4 border-l-gray-300" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Jobs details for selected stage */}
          {pipeline.stages.some((s) => s.jobs && s.jobs.length > 0) && (
            <div className="border-t pt-4">
              <div className="text-sm font-semibold mb-3">Jobs by Stage</div>
              <div className="space-y-4">
                {pipeline.stages.map((stage) => {
                  if (!stage.jobs || stage.jobs.length === 0) return null;
                  
                  return (
                    <div key={stage.name} className="space-y-2">
                      <div className="flex items-center gap-2">
                        <div className={cn('w-3 h-3 rounded-full', getStageStatusColor(stage.status).split(' ')[0])} />
                        <div className="font-medium text-sm">{stage.name}</div>
                        <Badge variant="outline" className="text-xs">
                          {stage.jobs.length} job{stage.jobs.length !== 1 ? 's' : ''}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 ml-5">
                        {stage.jobs.map((job) => (
                          <div
                            key={job.id}
                            className={cn(
                              'p-2 rounded border text-xs cursor-pointer transition-all',
                              getJobStatusColor(job.status),
                              onJobClick && 'hover:shadow-md'
                            )}
                            onClick={() => onJobClick?.(job)}
                          >
                            <div className="flex items-center gap-2">
                              {getJobStatusIcon(job.status)}
                              <span className="font-medium">{job.name}</span>
                            </div>
                            {job.duration && (
                              <div className="text-xs mt-1 opacity-75">
                                {Math.round(job.duration / 1000)}s
                              </div>
                            )}
                            {job.progress !== undefined && job.progress < 100 && (
                              <div className="mt-1">
                                <div className="w-full bg-white/50 rounded-full h-1">
                                  <div
                                    className="bg-current h-1 rounded-full transition-all"
                                    style={{ width: `${job.progress}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
