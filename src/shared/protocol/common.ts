export const RUNTIME_PROTOCOL_VERSION = 1 as const;

export type RuntimeProtocolVersion = typeof RUNTIME_PROTOCOL_VERSION;

export type RuntimeClient = 'electron' | 'scheduler' | 'im' | 'mcp' | 'cli' | 'test';

export type RuntimeMode = 'plan' | 'execute';

export type ExecutionTargetKind = 'browser' | 'desktop' | 'hybrid' | 'cli' | 'mcp' | 'skill';

export interface RuntimeEntityBase {
  version: RuntimeProtocolVersion;
  id: string;
  createdAt?: number;
}

export function createRuntimeId(prefix: string = 'runtime'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function now(): number {
  return Date.now();
}
