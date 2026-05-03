import { createRuntimeId, now, RUNTIME_PROTOCOL_VERSION, RuntimeProtocolVersion } from './common';

export type RuntimeArtifactKind = 'file' | 'screenshot' | 'trace' | 'diff' | 'json' | 'link' | 'log' | 'text';

export interface RuntimeArtifact {
  version: RuntimeProtocolVersion;
  id: string;
  runId?: string;
  kind: RuntimeArtifactKind;
  title: string;
  uri?: string;
  inlinePreview?: string;
  sizeBytes?: number;
  mimeType?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
}

export interface CreateRuntimeArtifactParams {
  runId?: string;
  kind: RuntimeArtifactKind;
  title: string;
  uri?: string;
  inlinePreview?: string;
  sizeBytes?: number;
  mimeType?: string;
  metadata?: Record<string, unknown>;
}

export function createRuntimeArtifact(params: CreateRuntimeArtifactParams): RuntimeArtifact {
  return {
    version: RUNTIME_PROTOCOL_VERSION,
    id: createRuntimeId('artifact'),
    createdAt: now(),
    ...params,
  };
}
