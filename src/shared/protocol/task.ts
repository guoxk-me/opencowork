import { RuntimeArtifact } from './artifact';
import { RuntimeClient, RuntimeMode, RUNTIME_PROTOCOL_VERSION, RuntimeProtocolVersion } from './common';
import { RuntimeError } from './error';

export type RuntimeTaskStatus =
  | 'pending'
  | 'planning'
  | 'running'
  | 'waiting_user'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface RuntimeTaskInput {
  prompt?: string;
  params?: Record<string, unknown>;
}

export interface RuntimeRun {
  version: RuntimeProtocolVersion;
  id: string;
  client: RuntimeClient;
  source: RuntimeClient;
  status: RuntimeTaskStatus;
  mode: RuntimeMode;
  title: string;
  input: RuntimeTaskInput;
  sessionId?: string;
  templateId?: string;
  resultId?: string;
  artifacts?: RuntimeArtifact[];
  error?: RuntimeError;
  metadata?: Record<string, unknown>;
  startedAt: number;
  endedAt?: number;
}

export function createRuntimeRun(params: Omit<RuntimeRun, 'version'>): RuntimeRun {
  return {
    version: RUNTIME_PROTOCOL_VERSION,
    ...params,
  };
}
