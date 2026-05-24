export interface JobInputSpec {
  name: string;
  label: string;
  type: 'number' | 'text' | 'select' | 'boolean';
  default: unknown;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  helpText?: string;
}

export interface JobExecutorSpec {
  type: 'subprocess' | 'lambda' | 'ecs';
  command: string;
  cwd?: string;
  envOverrides?: Record<string, string>;
  outputPath?: string;
}

export interface MetricFieldSpec {
  key: string;
  label: string;
  format: 'percentage' | 'integer' | 'decimal' | 'text';
  regexPattern: string;
}

export interface JobSpec {
  jobType: string;
  displayName: string;
  description: string;
  inputs: JobInputSpec[];
  executor: JobExecutorSpec;
  metricsSchema: MetricFieldSpec[];
}

export type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface JobRun {
  jobId: string;
  jobType: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  triggeredBy: string;
  inputsApplied: Record<string, unknown>;
  metrics: Record<string, unknown>;
  logLocation?: string;
}
