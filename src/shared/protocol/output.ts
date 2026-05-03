import { createRuntimeId, ExecutionTargetKind, now, RUNTIME_PROTOCOL_VERSION, RuntimeProtocolVersion } from './common';
import { RuntimeArtifact } from './artifact';
import { RuntimeError } from './error';

export type ExecutionOutputStatus = 'success' | 'failed' | 'cancelled' | 'timeout';

export interface ExecutionOutput {
  version: RuntimeProtocolVersion;
  id: string;
  runId: string;
  actionId?: string;
  target: ExecutionTargetKind;
  status: ExecutionOutputStatus;
  summary: string;
  stdout?: string;
  stderr?: string;
  exitCode?: number;
  durationMs: number;
  truncated?: boolean;
  artifacts?: RuntimeArtifact[];
  error?: RuntimeError;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface CreateExecutionOutputParams extends Omit<ExecutionOutput, 'version' | 'id' | 'createdAt'> {
  id?: string;
  createdAt?: number;
}

export function createExecutionOutput(params: CreateExecutionOutputParams): ExecutionOutput {
  const { id, createdAt, ...rest } = params;
  return {
    version: RUNTIME_PROTOCOL_VERSION,
    id: id || createRuntimeId('output'),
    createdAt: createdAt || now(),
    ...rest,
  };
}
