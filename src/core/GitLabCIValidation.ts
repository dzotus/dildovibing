/**
 * GitLab CI Configuration Validation
 * Использует Zod для валидации конфигураций
 */

import { z } from 'zod';
import { CronParser } from '@/utils/cronParser';

/**
 * Схема валидации для GitLab CI Job
 */
const GitLabCIJobSchema = z.object({
  name: z.string().min(1),
  stage: z.string().min(1),
  script: z.array(z.string()).optional(),
  image: z.string().optional(),
  tags: z.array(z.string()).optional(),
  when: z.enum(['on_success', 'on_failure', 'always', 'manual']).optional(),
  allowFailure: z.boolean().optional(),
});

/**
 * Схема валидации для GitLab CI Stage
 */
const GitLabCIStageSchema = z.object({
  name: z.string().min(1),
  jobs: z.array(GitLabCIJobSchema).optional(),
});

/**
 * Схема валидации для GitLab CI Pipeline
 */
const GitLabCIPipelineSchema = z.object({
  id: z.string().min(1),
  ref: z.string().optional(),
  source: z.enum(['push', 'web', 'trigger', 'schedule', 'api']).optional(),
  stages: z.array(GitLabCIStageSchema).optional(),
});

/**
 * Схема валидации для GitLab CI Runner
 */
const GitLabCIRunnerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  executor: z.enum(['docker', 'kubernetes', 'shell']).optional(),
  maxJobs: z.number().int().min(1).max(100).optional(),
  tags: z.array(z.string()).optional(),
  isShared: z.boolean().optional(),
});

/**
 * Схема валидации для GitLab CI Variable
 */
const GitLabCIVariableSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  protected: z.boolean().optional(),
  masked: z.boolean().optional(),
  environmentScope: z.string().optional(),
});

/**
 * Схема валидации для GitLab CI Environment
 */
const GitLabCIEnvironmentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  externalUrl: z.string().url().optional().or(z.literal('')),
});

/**
 * Схема валидации для GitLab CI Schedule
 */
const GitLabCIScheduleSchema = z.object({
  id: z.string().min(1),
  description: z.string().min(1),
  ref: z.string().min(1),
  cron: z.string().min(1),
  active: z.boolean().optional(),
  variables: z.record(z.string()).optional(),
});

/**
 * Схема валидации для полной конфигурации GitLab CI
 */
export const GitLabCIEmulationConfigSchema = z.object({
  gitlabUrl: z.string().url().optional().or(z.literal('')),
  projectId: z.string().optional(),
  projectUrl: z.string().url().optional().or(z.literal('')),
  enableRunners: z.boolean().optional(),
  runnerType: z.enum(['docker', 'kubernetes', 'shell']).optional(),
  concurrentJobs: z.number().int().min(1).max(100).optional(),
  enableCache: z.boolean().optional(),
  cacheType: z.enum(['s3', 'gcs', 'local']).optional(),
  enableArtifacts: z.boolean().optional(),
  artifactsExpiry: z.string().optional(),
  enableKubernetes: z.boolean().optional(),
  k8sNamespace: z.string().optional(),
  pipelines: z.array(GitLabCIPipelineSchema).optional(),
  runners: z.array(GitLabCIRunnerSchema).optional(),
  variables: z.array(GitLabCIVariableSchema).optional(),
  environments: z.array(GitLabCIEnvironmentSchema).optional(),
  schedules: z.array(GitLabCIScheduleSchema).optional(),
  pipelineTriggerRate: z.number().min(0).max(1000).optional(),
  averagePipelineDuration: z.number().min(0).optional(),
  averageJobDuration: z.number().min(0).optional(),
  failureRate: z.number().min(0).max(1).optional(),
  cacheHitRate: z.number().min(0).max(1).optional(),
});

/**
 * Тип для валидированной конфигурации
 */
export type ValidatedGitLabCIEmulationConfig = z.infer<typeof GitLabCIEmulationConfigSchema>;

/**
 * Результат валидации
 */
export interface ValidationResult {
  valid: boolean;
  errors?: Array<{ path: string; message: string }>;
}

/**
 * Валидирует конфигурацию GitLab CI
 */
export function validateGitLabCIConfig(config: unknown): ValidationResult {
  try {
    GitLabCIEmulationConfigSchema.parse(config);
    return { valid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        valid: false,
        errors: error.errors.map((err) => ({
          path: err.path.join('.'),
          message: err.message,
        })),
      };
    }
    return {
      valid: false,
      errors: [{ path: '', message: 'Unknown validation error' }],
    };
  }
}

import { CronParser } from '@/utils/cronParser';

/**
 * Валидирует cron выражение
 */
export function validateCronExpression(cron: string): ValidationResult {
  try {
    // Используем CronParser для валидации
    const validation = CronParser.validate(cron);
    
    if (validation.valid) {
      return { valid: true };
    }
    
    return {
      valid: false,
      errors: [{ path: 'cron', message: validation.error || 'Invalid cron expression' }],
    };
  } catch (error) {
    return {
      valid: false,
      errors: [{ path: 'cron', message: error instanceof Error ? error.message : 'Invalid cron expression' }],
    };
  }
}
