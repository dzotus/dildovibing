import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { SQSRoutingEngine } from '@/core/SQSRoutingEngine';
import { AlertCircle } from 'lucide-react';

interface Queue {
  name: string;
  type: 'standard' | 'fifo';
  region: string;
  visibilityTimeout: number;
  messageRetention: number;
  delaySeconds: number;
  maxReceiveCount?: number;
  deadLetterQueue?: string;
  contentBasedDedup?: boolean;
  fifoThroughputLimit?: 'perQueue' | 'perMessageGroupId';
  highThroughputFifo?: boolean;
  accountId?: string;
}

interface CreateQueueDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (queue: Queue) => void;
  defaultRegion?: string;
  defaultAccountId?: string;
  existingQueueNames?: string[];
}

// AWS Regions list
const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-north-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1', 'ap-northeast-2', 'ap-south-1',
  'sa-east-1', 'ca-central-1', 'af-south-1', 'me-south-1',
];

export function CreateQueueDialog({
  open,
  onOpenChange,
  onSave,
  defaultRegion = 'us-east-1',
  defaultAccountId = '123456789012',
  existingQueueNames = [],
}: CreateQueueDialogProps) {
  const [queue, setQueue] = useState<Queue>({
    name: '',
    type: 'standard',
    region: defaultRegion,
    visibilityTimeout: 30,
    messageRetention: 4,
    delaySeconds: 0,
    accountId: defaultAccountId,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setQueue({
        name: '',
        type: 'standard',
        region: defaultRegion,
        visibilityTimeout: 30,
        messageRetention: 4,
        delaySeconds: 0,
        accountId: defaultAccountId,
      });
      setErrors({});
      setTouched({});
    }
  }, [open, defaultRegion, defaultAccountId]);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate queue name
    if (!queue.name || queue.name.trim() === '') {
      newErrors.name = 'Queue name is required';
    } else {
      const validation = SQSRoutingEngine.validateQueueName(queue.name, queue.type);
      if (!validation.valid) {
        newErrors.name = validation.error || 'Invalid queue name';
      } else if (existingQueueNames.includes(queue.name)) {
        newErrors.name = 'Queue with this name already exists';
      }
    }

    // Validate region
    if (!queue.region || queue.region.trim() === '') {
      newErrors.region = 'Region is required';
    } else if (!AWS_REGIONS.includes(queue.region)) {
      newErrors.region = 'Invalid AWS region';
    }

    // Validate visibility timeout
    if (queue.visibilityTimeout < 0 || queue.visibilityTimeout > 43200) {
      newErrors.visibilityTimeout = 'Visibility timeout must be between 0 and 43200 seconds';
    }

    // Validate message retention
    if (queue.messageRetention < 1 || queue.messageRetention > 14) {
      newErrors.messageRetention = 'Message retention must be between 1 and 14 days';
    }

    // Validate delay seconds
    if (queue.delaySeconds < 0 || queue.delaySeconds > 900) {
      newErrors.delaySeconds = 'Delay seconds must be between 0 and 900';
    }

    // Validate max receive count (if set)
    if (queue.maxReceiveCount !== undefined && (queue.maxReceiveCount < 1 || queue.maxReceiveCount > 1000)) {
      newErrors.maxReceiveCount = 'Max receive count must be between 1 and 1000';
    }

    // Validate account ID
    if (queue.accountId && !/^\d{12}$/.test(queue.accountId)) {
      newErrors.accountId = 'Account ID must be 12 digits';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleFieldChange = (field: keyof Queue, value: any) => {
    let updatedQueue = { ...queue, [field]: value };

    // Auto-fix FIFO queue name suffix
    if (field === 'type') {
      if (value === 'fifo' && !updatedQueue.name.endsWith('.fifo')) {
        updatedQueue.name = updatedQueue.name + '.fifo';
      } else if (value === 'standard' && updatedQueue.name.endsWith('.fifo')) {
        updatedQueue.name = updatedQueue.name.slice(0, -5);
      }
    }

    // Auto-fix queue name when type changes
    if (field === 'name' && queue.type === 'fifo' && !value.endsWith('.fifo')) {
      updatedQueue.name = value + '.fifo';
    }

    setQueue(updatedQueue);
    
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  const handleBlur = (field: string) => {
    setTouched({ ...touched, [field]: true });
    validate();
  };

  const handleSave = () => {
    if (validate()) {
      onSave(queue);
      onOpenChange(false);
    } else {
      // Mark all fields as touched to show errors
      const allFields = ['name', 'region', 'visibilityTimeout', 'messageRetention', 'delaySeconds', 'accountId'];
      setTouched(Object.fromEntries(allFields.map(f => [f, true])));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create SQS Queue</DialogTitle>
          <DialogDescription>
            Configure a new Amazon SQS queue with delivery guarantees and settings
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Basic Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Basic Settings</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="queue-name">
                  Queue Name <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="queue-name"
                  value={queue.name}
                  onChange={(e) => handleFieldChange('name', e.target.value)}
                  onBlur={() => handleBlur('name')}
                  placeholder={queue.type === 'fifo' ? 'my-queue.fifo' : 'my-queue'}
                  className={errors.name && touched.name ? 'border-red-500' : ''}
                />
                {errors.name && touched.name && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.name}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {queue.type === 'fifo' 
                    ? 'FIFO queue names must end with .fifo (1-80 characters)'
                    : '1-80 characters, alphanumeric, hyphens, underscores'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="queue-type">
                  Queue Type <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={queue.type}
                  onValueChange={(value: 'standard' | 'fifo') => handleFieldChange('type', value)}
                >
                  <SelectTrigger id="queue-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard Queue</SelectItem>
                    <SelectItem value="fifo">FIFO Queue</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {queue.type === 'fifo' 
                    ? 'Guaranteed order and exactly-once processing'
                    : 'At-least-once delivery, high throughput'}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="queue-region">
                  AWS Region <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={queue.region}
                  onValueChange={(value) => handleFieldChange('region', value)}
                >
                  <SelectTrigger id="queue-region" className={errors.region && touched.region ? 'border-red-500' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {AWS_REGIONS.map(region => (
                      <SelectItem key={region} value={region}>{region}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.region && touched.region && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.region}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="queue-account-id">Account ID</Label>
                <Input
                  id="queue-account-id"
                  value={queue.accountId || ''}
                  onChange={(e) => handleFieldChange('accountId', e.target.value)}
                  onBlur={() => handleBlur('accountId')}
                  placeholder="123456789012"
                  className={errors.accountId && touched.accountId ? 'border-red-500' : ''}
                />
                {errors.accountId && touched.accountId && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.accountId}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  12-digit AWS account ID for queue URLs and ARNs
                </p>
              </div>
            </div>
          </div>

          {/* Delivery Settings */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Delivery Settings</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="visibility-timeout">
                  Visibility Timeout (seconds) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="visibility-timeout"
                  type="number"
                  value={queue.visibilityTimeout}
                  onChange={(e) => handleFieldChange('visibilityTimeout', Number(e.target.value))}
                  onBlur={() => handleBlur('visibilityTimeout')}
                  min={0}
                  max={43200}
                  className={errors.visibilityTimeout && touched.visibilityTimeout ? 'border-red-500' : ''}
                />
                {errors.visibilityTimeout && touched.visibilityTimeout && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.visibilityTimeout}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Time message is hidden after being received (0-43200)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message-retention">
                  Message Retention (days) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="message-retention"
                  type="number"
                  value={queue.messageRetention}
                  onChange={(e) => handleFieldChange('messageRetention', Number(e.target.value))}
                  onBlur={() => handleBlur('messageRetention')}
                  min={1}
                  max={14}
                  className={errors.messageRetention && touched.messageRetention ? 'border-red-500' : ''}
                />
                {errors.messageRetention && touched.messageRetention && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.messageRetention}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  How long messages are kept (1-14 days)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="delay-seconds">
                  Delivery Delay (seconds) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="delay-seconds"
                  type="number"
                  value={queue.delaySeconds}
                  onChange={(e) => handleFieldChange('delaySeconds', Number(e.target.value))}
                  onBlur={() => handleBlur('delaySeconds')}
                  min={0}
                  max={900}
                  className={errors.delaySeconds && touched.delaySeconds ? 'border-red-500' : ''}
                />
                {errors.delaySeconds && touched.delaySeconds && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.delaySeconds}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Delay before messages become available (0-900)
                </p>
              </div>
            </div>
          </div>

          {/* Dead Letter Queue */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Dead Letter Queue</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dlq-name">Dead Letter Queue Name</Label>
                <Input
                  id="dlq-name"
                  value={queue.deadLetterQueue || ''}
                  onChange={(e) => handleFieldChange('deadLetterQueue', e.target.value || undefined)}
                  placeholder="dlq-name"
                />
                <p className="text-xs text-muted-foreground">
                  Queue for messages that fail processing
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="max-receive-count">Max Receive Count</Label>
                <Input
                  id="max-receive-count"
                  type="number"
                  value={queue.maxReceiveCount || ''}
                  onChange={(e) => handleFieldChange('maxReceiveCount', e.target.value ? Number(e.target.value) : undefined)}
                  onBlur={() => handleBlur('maxReceiveCount')}
                  min={1}
                  max={1000}
                  placeholder="3"
                  className={errors.maxReceiveCount && touched.maxReceiveCount ? 'border-red-500' : ''}
                />
                {errors.maxReceiveCount && touched.maxReceiveCount && (
                  <p className="text-xs text-red-500 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.maxReceiveCount}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Messages moved to DLQ after this many receives (1-1000)
                </p>
              </div>
            </div>
          </div>

          {/* FIFO Settings */}
          {queue.type === 'fifo' && (
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">FIFO Settings</h3>
              
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="content-based-dedup">Content-Based Deduplication</Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically deduplicate messages by content hash
                    </p>
                  </div>
                  <Switch
                    id="content-based-dedup"
                    checked={queue.contentBasedDedup || false}
                    onCheckedChange={(checked) => handleFieldChange('contentBasedDedup', checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fifo-throughput-limit">FIFO Throughput Limit</Label>
                  <Select
                    value={queue.fifoThroughputLimit || 'perQueue'}
                    onValueChange={(value: 'perQueue' | 'perMessageGroupId') => 
                      handleFieldChange('fifoThroughputLimit', value)
                    }
                  >
                    <SelectTrigger id="fifo-throughput-limit">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="perQueue">Per Queue</SelectItem>
                      <SelectItem value="perMessageGroupId">Per Message Group ID</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Throughput limit mode for FIFO queue
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="high-throughput-fifo">High-Throughput FIFO Mode</Label>
                    <p className="text-xs text-muted-foreground">
                      Enable high-throughput mode for better performance with multiple message groups
                    </p>
                  </div>
                  <Switch
                    id="high-throughput-fifo"
                    checked={queue.highThroughputFifo || false}
                    onCheckedChange={(checked) => handleFieldChange('highThroughputFifo', checked)}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>
            Create Queue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
