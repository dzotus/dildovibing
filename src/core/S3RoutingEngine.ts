/**
 * AWS S3 Routing Engine
 * Simulates AWS S3 object storage operations with versioning, lifecycle policies,
 * and storage class transitions
 */

export type S3StorageClass = 'STANDARD' | 'STANDARD_IA' | 'GLACIER' | 'DEEP_ARCHIVE' | 'INTELLIGENT_TIERING';
export type S3EncryptionType = 'AES256' | 'aws:kms';

export interface S3LifecycleRule {
  id: string;
  name: string;
  prefix?: string;
  status: 'Enabled' | 'Disabled';
  transitions?: Array<{
    days: number;
    storageClass: string;
  }>;
  expiration?: {
    days: number;
  };
}

export interface S3Bucket {
  name: string;
  region: string;
  versioning: boolean;
  encryption?: S3EncryptionType;
  lifecycleEnabled?: boolean;
  lifecycleDays?: number;
  glacierEnabled?: boolean;
  glacierDays?: number;
  publicAccess?: boolean;
  lifecycleRules?: S3LifecycleRule[];
}

export interface S3Object {
  key: string;
  bucket: string;
  size: number;
  lastModified: number;
  storageClass: S3StorageClass;
  etag: string;
  contentType?: string;
  metadata?: Record<string, string>;
  versionId?: string; // For versioned objects
  encryption?: S3EncryptionType;
}

export interface S3Version {
  versionId: string;
  object: S3Object;
  isDeleteMarker: boolean;
}

export interface S3Operation {
  operation: 'PUT' | 'GET' | 'DELETE' | 'HEAD' | 'LIST';
  bucket: string;
  key?: string;
  success: boolean;
  latency: number;
  error?: string;
  timestamp: number;
}

export interface S3Metrics {
  bucket: string;
  objectCount: number;
  totalSize: number; // bytes
  versionsCount: number; // if versioning enabled
  putCount: number;
  getCount: number;
  deleteCount: number;
  listCount: number;
  errorCount: number;
  averageLatency: number; // ms
  lastOperation?: number;
}

/**
 * AWS S3 Routing Engine
 * Simulates AWS S3 object storage behavior
 */
export class S3RoutingEngine {
  private buckets: Map<string, S3Bucket> = new Map();
  // bucket -> key -> current object
  private objects: Map<string, Map<string, S3Object>> = new Map();
  // bucket -> key -> versions (for versioned buckets)
  private versions: Map<string, Map<string, S3Version[]>> = new Map();
  // Operations history for metrics
  private operations: S3Operation[] = [];
  // Metrics per bucket
  private metrics: Map<string, S3Metrics> = new Map();
  
  // Lifecycle transition tracking
  private lifecycleTransitions: Map<string, Map<string, {
    currentClass: S3StorageClass;
    transitionScheduled: number; // timestamp when transition should occur
    targetClass: S3StorageClass;
    ruleId?: string; // For lifecycle rule-based transitions
    transitionIndex?: number; // Index in transitions array
    allTransitions?: Array<{ days: number; storageClass: string }>; // All transitions from rule
  }>> = new Map();

  /**
   * Initialize with S3 configuration
   */
  public initialize(config: {
    buckets?: S3Bucket[];
    defaultRegion?: string;
    lifecycleRules?: S3LifecycleRule[];
  }) {
    // Clear previous state
    this.buckets.clear();
    this.objects.clear();
    this.versions.clear();
    this.operations = [];
    this.metrics.clear();
    this.lifecycleTransitions.clear();

    // Initialize buckets
    if (config.buckets) {
      for (const bucket of config.buckets) {
        this.buckets.set(bucket.name, { ...bucket });
        this.objects.set(bucket.name, new Map());
        if (bucket.versioning) {
          this.versions.set(bucket.name, new Map());
        }
        this.metrics.set(bucket.name, {
          bucket: bucket.name,
          objectCount: 0,
          totalSize: 0,
          versionsCount: 0,
          putCount: 0,
          getCount: 0,
          deleteCount: 0,
          listCount: 0,
          errorCount: 0,
          averageLatency: 0,
        });
        this.lifecycleTransitions.set(bucket.name, new Map());
      }
    }
  }

  /**
   * Put object into bucket (upload)
   */
  public putObject(
    bucketName: string,
    key: string,
    data: unknown,
    size: number,
    metadata?: Record<string, string>,
    contentType?: string
  ): { success: boolean; versionId?: string; etag: string; latency: number; error?: string } {
    const startTime = Date.now();
    const bucket = this.buckets.get(bucketName);
    
    if (!bucket) {
      return {
        success: false,
        etag: '',
        latency: Date.now() - startTime,
        error: `Bucket '${bucketName}' does not exist`,
      };
    }

    // Generate ETag (simplified: hash of key + timestamp)
    const etag = this.generateETag(key, size);
    
    // Generate version ID if versioning enabled
    const versionId = bucket.versioning 
      ? `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      : undefined;

    // Create object
    const object: S3Object = {
      key,
      bucket: bucketName,
      size,
      lastModified: Date.now(),
      storageClass: 'STANDARD', // Default storage class
      etag,
      contentType: contentType || 'application/octet-stream',
      metadata: metadata || {},
      versionId,
      encryption: bucket.encryption,
    };

    // Store object
    const bucketObjects = this.objects.get(bucketName)!;
    
    // If versioning enabled, store version
    if (bucket.versioning && versionId) {
      const bucketVersions = this.versions.get(bucketName)!;
      const keyVersions = bucketVersions.get(key) || [];
      
      keyVersions.push({
        versionId,
        object,
        isDeleteMarker: false,
      });
      
      bucketVersions.set(key, keyVersions);
      this.versions.set(bucketName, bucketVersions);
      
      // Update metrics
      const metrics = this.metrics.get(bucketName)!;
      metrics.versionsCount = this.getTotalVersionsCount(bucketName);
    }
    
    // Update current object
    bucketObjects.set(key, object);
    this.objects.set(bucketName, bucketObjects);

    // Schedule lifecycle transition based on rules or bucket-level settings
    const matchingRule = this.findMatchingLifecycleRule(bucket, key);
    
    if (matchingRule && matchingRule.transitions && matchingRule.transitions.length > 0) {
      // Use lifecycle rule transitions
      const transitions = this.lifecycleTransitions.get(bucketName)!;
      const firstTransition = matchingRule.transitions[0];
      const transitionTime = Date.now() + (firstTransition.days * 24 * 60 * 60 * 1000);
      
      transitions.set(key, {
        currentClass: 'STANDARD',
        transitionScheduled: transitionTime,
        targetClass: firstTransition.storageClass as S3StorageClass,
        ruleId: matchingRule.id,
        transitionIndex: 0,
        allTransitions: matchingRule.transitions,
      });
      this.lifecycleTransitions.set(bucketName, transitions);
    } else if (bucket.lifecycleEnabled && bucket.lifecycleDays) {
      // Fallback to bucket-level lifecycle settings
      const transitions = this.lifecycleTransitions.get(bucketName)!;
      const transitionTime = Date.now() + (bucket.lifecycleDays * 24 * 60 * 60 * 1000);
      
      transitions.set(key, {
        currentClass: 'STANDARD',
        transitionScheduled: transitionTime,
        targetClass: bucket.glacierEnabled ? 'GLACIER' : 'STANDARD_IA',
      });
      this.lifecycleTransitions.set(bucketName, transitions);
    }

    // Update metrics
    const metrics = this.metrics.get(bucketName)!;
    const existingObject = bucketObjects.get(key);
    if (!existingObject) {
      metrics.objectCount++;
    } else {
      // Replacing existing object, adjust size
      metrics.totalSize -= existingObject.size;
    }
    metrics.totalSize += size;
    metrics.putCount++;
    
    const latency = this.calculatePutLatency(size);
    this.recordOperation('PUT', bucketName, key, true, latency);
    this.updateMetrics(bucketName, latency, true);

    return {
      success: true,
      versionId,
      etag,
      latency,
    };
  }

  /**
   * Get object from bucket (download)
   */
  public getObject(
    bucketName: string,
    key: string,
    versionId?: string
  ): { success: boolean; object?: S3Object; latency: number; error?: string } {
    const startTime = Date.now();
    const bucket = this.buckets.get(bucketName);
    
    if (!bucket) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: `Bucket '${bucketName}' does not exist`,
      };
    }

    const bucketObjects = this.objects.get(bucketName)!;
    
    // If versioning and versionId specified, get specific version
    if (bucket.versioning && versionId) {
      const bucketVersions = this.versions.get(bucketName)!;
      const keyVersions = bucketVersions.get(key) || [];
      const version = keyVersions.find(v => v.versionId === versionId);
      
      if (!version || version.isDeleteMarker) {
        const latency = this.calculateGetLatency(0);
        this.recordOperation('GET', bucketName, key, false, latency);
        this.updateMetrics(bucketName, latency, false);
        
        return {
          success: false,
          latency,
          error: version?.isDeleteMarker ? 'Object version is a delete marker' : `Object version '${versionId}' not found`,
        };
      }
      
      // Check if version is in Glacier (restore needed)
      if (version.object.storageClass === 'GLACIER' || version.object.storageClass === 'DEEP_ARCHIVE') {
        const latency = this.calculateGlacierRestoreLatency();
        this.recordOperation('GET', bucketName, key, false, latency);
        this.updateMetrics(bucketName, latency, false);
        
        return {
          success: false,
          latency,
          error: `Object is archived in ${version.object.storageClass}. Restore operation required.`,
        };
      }
      
      const latency = this.calculateGetLatency(version.object.size);
      this.recordOperation('GET', bucketName, key, true, latency);
      this.updateMetrics(bucketName, latency, true);
      
      return {
        success: true,
        object: version.object,
        latency,
      };
    }
    
    // Get current object
    const object = bucketObjects.get(key);
    if (!object) {
      const latency = this.calculateGetLatency(0);
      this.recordOperation('GET', bucketName, key, false, latency);
      this.updateMetrics(bucketName, latency, false);
      
      return {
        success: false,
        latency,
        error: `Object '${key}' not found`,
      };
    }
    
    // Check if object is in Glacier (restore needed)
    if (object.storageClass === 'GLACIER' || object.storageClass === 'DEEP_ARCHIVE') {
      const latency = this.calculateGlacierRestoreLatency();
      this.recordOperation('GET', bucketName, key, false, latency);
      this.updateMetrics(bucketName, latency, false);
      
      return {
        success: false,
        latency,
        error: `Object is archived in ${object.storageClass}. Restore operation required.`,
      };
    }
    
    const latency = this.calculateGetLatency(object.size);
    this.recordOperation('GET', bucketName, key, true, latency);
    this.updateMetrics(bucketName, latency, true);
    
    return {
      success: true,
      object,
      latency,
    };
  }

  /**
   * Delete object from bucket
   */
  public deleteObject(
    bucketName: string,
    key: string,
    versionId?: string
  ): { success: boolean; deleteMarker?: boolean; latency: number; error?: string } {
    const startTime = Date.now();
    const bucket = this.buckets.get(bucketName);
    
    if (!bucket) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: `Bucket '${bucketName}' does not exist`,
      };
    }

    const bucketObjects = this.objects.get(bucketName)!;
    const object = bucketObjects.get(key);
    
    if (!object) {
      const latency = this.calculateDeleteLatency();
      this.recordOperation('DELETE', bucketName, key, false, latency);
      this.updateMetrics(bucketName, latency, false);
      
      return {
        success: false,
        latency,
        error: `Object '${key}' not found`,
      };
    }
    
    // If versioning enabled, create delete marker instead of deleting
    if (bucket.versioning) {
      const bucketVersions = this.versions.get(bucketName)!;
      const keyVersions = bucketVersions.get(key) || [];
      const deleteMarkerVersionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      keyVersions.push({
        versionId: deleteMarkerVersionId,
        object: { ...object },
        isDeleteMarker: true,
      });
      
      bucketVersions.set(key, keyVersions);
      this.versions.set(bucketName, bucketVersions);
      
      // Remove current object (but keep versions)
      bucketObjects.delete(key);
      this.objects.set(bucketName, bucketObjects);
      
      const metrics = this.metrics.get(bucketName)!;
      metrics.versionsCount = this.getTotalVersionsCount(bucketName);
      metrics.deleteCount++;
      
      const latency = this.calculateDeleteLatency();
      this.recordOperation('DELETE', bucketName, key, true, latency);
      this.updateMetrics(bucketName, latency, true);
      
      return {
        success: true,
        deleteMarker: true,
        latency,
      };
    }
    
    // Non-versioned: delete object completely
    const size = object.size;
    bucketObjects.delete(key);
    this.objects.set(bucketName, bucketObjects);
    
    const metrics = this.metrics.get(bucketName)!;
    metrics.objectCount--;
    metrics.totalSize -= size;
    metrics.deleteCount++;
    
    const latency = this.calculateDeleteLatency();
    this.recordOperation('DELETE', bucketName, key, true, latency);
    this.updateMetrics(bucketName, latency, true);
    
    return {
      success: true,
      latency,
    };
  }

  /**
   * List objects in bucket
   */
  public listObjects(
    bucketName: string,
    prefix?: string,
    maxKeys?: number
  ): { success: boolean; objects: S3Object[]; latency: number; error?: string } {
    const startTime = Date.now();
    const bucket = this.buckets.get(bucketName);
    
    if (!bucket) {
      return {
        success: false,
        objects: [],
        latency: Date.now() - startTime,
        error: `Bucket '${bucketName}' does not exist`,
      };
    }

    const bucketObjects = this.objects.get(bucketName)!;
    let objects = Array.from(bucketObjects.values());
    
    // Filter by prefix
    if (prefix) {
      objects = objects.filter(obj => obj.key.startsWith(prefix));
    }
    
    // Sort by key
    objects.sort((a, b) => a.key.localeCompare(b.key));
    
    // Limit results
    if (maxKeys) {
      objects = objects.slice(0, maxKeys);
    }
    
    const latency = this.calculateListLatency(objects.length);
    this.recordOperation('LIST', bucketName, undefined, true, latency);
    
    const metrics = this.metrics.get(bucketName)!;
    metrics.listCount++;
    this.updateMetrics(bucketName, latency, true);
    
    return {
      success: true,
      objects,
      latency,
    };
  }

  /**
   * Head object (get metadata only)
   */
  public headObject(
    bucketName: string,
    key: string
  ): { success: boolean; object?: S3Object; latency: number; error?: string } {
    const startTime = Date.now();
    const bucket = this.buckets.get(bucketName);
    
    if (!bucket) {
      return {
        success: false,
        latency: Date.now() - startTime,
        error: `Bucket '${bucketName}' does not exist`,
      };
    }

    const bucketObjects = this.objects.get(bucketName)!;
    const object = bucketObjects.get(key);
    
    if (!object) {
      const latency = this.calculateHeadLatency();
      this.recordOperation('HEAD', bucketName, key, false, latency);
      this.updateMetrics(bucketName, latency, false);
      
      return {
        success: false,
        latency,
        error: `Object '${key}' not found`,
      };
    }
    
    const latency = this.calculateHeadLatency();
    this.recordOperation('HEAD', bucketName, key, true, latency);
    this.updateMetrics(bucketName, latency, true);
    
    return {
      success: true,
      object,
      latency,
    };
  }

  /**
   * Process lifecycle transitions (called periodically)
   */
  public processLifecycleTransitions(currentTime: number = Date.now()): void {
    for (const [bucketName, transitions] of this.lifecycleTransitions.entries()) {
      const bucket = this.buckets.get(bucketName);
      // Check if bucket has lifecycle enabled either via flag or rules
      const hasLifecycle = bucket && (
        bucket.lifecycleEnabled || 
        (bucket.lifecycleRules && bucket.lifecycleRules.some(rule => rule.status === 'Enabled'))
      );
      if (!hasLifecycle) continue;
      
      const bucketObjects = this.objects.get(bucketName)!;
      
      for (const [key, transition] of transitions.entries()) {
        if (currentTime >= transition.transitionScheduled) {
          const object = bucketObjects.get(key);
          if (object && object.storageClass === transition.currentClass) {
            // Transition to new storage class
            object.storageClass = transition.targetClass;
            bucketObjects.set(key, object);
            this.objects.set(bucketName, bucketObjects);
            
            // Schedule next transition if applicable
            if (transition.ruleId && transition.allTransitions && transition.transitionIndex !== undefined) {
              // Lifecycle rule-based transitions: check if there are more transitions
              const nextIndex = transition.transitionIndex + 1;
              if (nextIndex < transition.allTransitions.length) {
                const nextTransition = transition.allTransitions[nextIndex];
                const nextTransitionTime = currentTime + (nextTransition.days * 24 * 60 * 60 * 1000);
                transitions.set(key, {
                  currentClass: transition.targetClass,
                  transitionScheduled: nextTransitionTime,
                  targetClass: nextTransition.storageClass as S3StorageClass,
                  ruleId: transition.ruleId,
                  transitionIndex: nextIndex,
                  allTransitions: transition.allTransitions,
                });
              } else {
                // No more transitions in rule, check expiration
                const rule = this.findLifecycleRuleById(bucket, transition.ruleId);
                if (rule?.expiration?.days) {
                  // Schedule expiration (object deletion)
                  // Note: In real S3, expiration happens automatically, we just mark it
                  const expirationTime = currentTime + (rule.expiration.days * 24 * 60 * 60 * 1000);
                  // Store expiration time in transition (will be checked separately)
                  transitions.set(key, {
                    currentClass: transition.targetClass,
                    transitionScheduled: expirationTime,
                    targetClass: transition.targetClass, // Keep same class
                    ruleId: transition.ruleId,
                    expiration: true,
                  });
                } else {
                  // No expiration, remove from transitions
                  transitions.delete(key);
                }
              }
            } else if (bucket.glacierEnabled && bucket.glacierDays && transition.targetClass === 'STANDARD_IA') {
              // Fallback: bucket-level glacier transition
              const glacierTransitionTime = currentTime + (bucket.glacierDays * 24 * 60 * 60 * 1000);
              transitions.set(key, {
                currentClass: 'STANDARD_IA',
                transitionScheduled: glacierTransitionTime,
                targetClass: 'GLACIER',
              });
            } else {
              // No more transitions, remove from map
              transitions.delete(key);
            }
          } else if (!object) {
            // Object was deleted, remove transition
            transitions.delete(key);
          }
        }
      }
      
      this.lifecycleTransitions.set(bucketName, transitions);
    }
    
    // Process expirations (objects that should be deleted)
    this.processExpirations(currentTime);
  }

  /**
   * Process object expirations based on lifecycle rules
   */
  private processExpirations(currentTime: number): void {
    for (const [bucketName, transitions] of this.lifecycleTransitions.entries()) {
      const bucket = this.buckets.get(bucketName);
      if (!bucket) continue;
      
      const bucketObjects = this.objects.get(bucketName)!;
      const expiredKeys: string[] = [];
      
      for (const [key, transition] of transitions.entries()) {
        if (transition.expiration && currentTime >= transition.transitionScheduled) {
          // Object should be expired (deleted)
          if (bucketObjects.has(key)) {
            expiredKeys.push(key);
          }
        }
      }
      
      // Delete expired objects
      for (const key of expiredKeys) {
        const object = bucketObjects.get(key);
        if (object) {
          const metrics = this.metrics.get(bucketName);
          if (metrics) {
            metrics.objectCount = Math.max(0, metrics.objectCount - 1);
            metrics.totalSize = Math.max(0, metrics.totalSize - object.size);
          }
        }
        bucketObjects.delete(key);
        transitions.delete(key);
      }
      
      this.objects.set(bucketName, bucketObjects);
      this.lifecycleTransitions.set(bucketName, transitions);
    }
  }

  /**
   * Find matching lifecycle rule for an object key
   */
  private findMatchingLifecycleRule(bucket: S3Bucket, key: string): S3LifecycleRule | undefined {
    if (!bucket.lifecycleRules || bucket.lifecycleRules.length === 0) {
      return undefined;
    }
    
    // Find enabled rule that matches the key prefix (longest prefix wins)
    const matchingRules = bucket.lifecycleRules
      .filter(rule => rule.status === 'Enabled')
      .filter(rule => !rule.prefix || key.startsWith(rule.prefix))
      .sort((a, b) => {
        // Sort by prefix length (longest first)
        const aPrefix = a.prefix || '';
        const bPrefix = b.prefix || '';
        return bPrefix.length - aPrefix.length;
      });
    
    return matchingRules[0];
  }

  /**
   * Find lifecycle rule by ID
   */
  private findLifecycleRuleById(bucket: S3Bucket, ruleId: string): S3LifecycleRule | undefined {
    if (!bucket.lifecycleRules) return undefined;
    return bucket.lifecycleRules.find(rule => rule.id === ruleId);
  }

  /**
   * Find lifecycle rule by ID
   */
  private findLifecycleRuleById(bucket: S3Bucket, ruleId: string): S3LifecycleRule | undefined {
    if (!bucket.lifecycleRules) return undefined;
    return bucket.lifecycleRules.find(rule => rule.id === ruleId);
  }

  /**
   * Get bucket metrics
   */
  public getBucketMetrics(bucketName: string): S3Metrics | undefined {
    return this.metrics.get(bucketName);
  }

  /**
   * Get all bucket metrics
   */
  public getAllBucketMetrics(): Map<string, S3Metrics> {
    return new Map(this.metrics);
  }

  /**
   * Get total storage size across all buckets
   */
  public getTotalStorageSize(): number {
    let total = 0;
    for (const metrics of this.metrics.values()) {
      total += metrics.totalSize;
    }
    return total;
  }

  /**
   * Get total object count across all buckets
   */
  public getTotalObjectCount(): number {
    let total = 0;
    for (const metrics of this.metrics.values()) {
      total += metrics.objectCount;
    }
    return total;
  }

  // Private helper methods

  private generateETag(key: string, size: number): string {
    // Simplified ETag generation (in real S3, it's MD5 hash)
    const hash = `${key}_${size}_${Date.now()}`;
    let hashValue = 0;
    for (let i = 0; i < hash.length; i++) {
      const char = hash.charCodeAt(i);
      hashValue = ((hashValue << 5) - hashValue) + char;
      hashValue = hashValue & hashValue; // Convert to 32bit integer
    }
    return Math.abs(hashValue).toString(16);
  }

  private calculatePutLatency(size: number): number {
    // Latency increases with object size
    // Base latency: 50ms, + 0.1ms per KB
    const baseLatency = 50;
    const sizeLatency = (size / 1024) * 0.1;
    const jitter = (Math.random() - 0.5) * 10; // ±5ms jitter
    return Math.max(10, baseLatency + sizeLatency + jitter);
  }

  private calculateGetLatency(size: number): number {
    // Similar to PUT but slightly faster for smaller objects
    const baseLatency = 30;
    const sizeLatency = (size / 1024) * 0.15;
    const jitter = (Math.random() - 0.5) * 10;
    return Math.max(10, baseLatency + sizeLatency + jitter);
  }

  private calculateDeleteLatency(): number {
    // Delete is fast
    const baseLatency = 20;
    const jitter = (Math.random() - 0.5) * 5;
    return Math.max(5, baseLatency + jitter);
  }

  private calculateListLatency(count: number): number {
    // List latency depends on number of objects
    const baseLatency = 40;
    const countLatency = count * 0.01; // +0.01ms per object
    const jitter = (Math.random() - 0.5) * 10;
    return Math.max(20, baseLatency + countLatency + jitter);
  }

  private calculateHeadLatency(): number {
    // Head is very fast (metadata only)
    const baseLatency = 15;
    const jitter = (Math.random() - 0.5) * 5;
    return Math.max(5, baseLatency + jitter);
  }

  private calculateGlacierRestoreLatency(): number {
    // Glacier restore requires time (simulate failure for immediate access)
    return 5000; // 5 seconds (actual restore takes hours/days)
  }

  private recordOperation(
    operation: S3Operation['operation'],
    bucket: string,
    key: string | undefined,
    success: boolean,
    latency: number
  ): void {
    this.operations.push({
      operation,
      bucket,
      key,
      success,
      latency,
      timestamp: Date.now(),
    });
    
    // Keep only last 1000 operations
    if (this.operations.length > 1000) {
      this.operations.shift();
    }
  }

  private updateMetrics(bucketName: string, latency: number, success: boolean): void {
    const metrics = this.metrics.get(bucketName);
    if (!metrics) return;
    
    // Update average latency (rolling average)
    const totalOps = metrics.putCount + metrics.getCount + metrics.deleteCount + metrics.listCount;
    if (totalOps > 0) {
      metrics.averageLatency = ((metrics.averageLatency * (totalOps - 1)) + latency) / totalOps;
    } else {
      metrics.averageLatency = latency;
    }
    
    if (!success) {
      metrics.errorCount++;
    }
    
    metrics.lastOperation = Date.now();
  }

  private getTotalVersionsCount(bucketName: string): number {
    const bucketVersions = this.versions.get(bucketName);
    if (!bucketVersions) return 0;
    
    let total = 0;
    for (const versions of bucketVersions.values()) {
      total += versions.length;
    }
    return total;
  }
}

