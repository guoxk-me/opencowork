import { createRuntimeId, now, RUNTIME_PROTOCOL_VERSION, RuntimeClient, RuntimeProtocolVersion } from './common';

export type RuntimeEventType =
  | 'task/started'
  | 'task/planned'
  | 'task/progress'
  | 'tool/call_started'
  | 'tool/call_finished'
  | 'approval/requested'
  | 'approval/resolved'
  | 'artifact/created'
  | 'task/completed'
  | 'task/failed'
  | 'task/cancelled';

export type RuntimeEventVisibility = 'user' | 'debug' | 'internal';

export interface RuntimeEvent {
  version: RuntimeProtocolVersion;
  id: string;
  runId: string;
  type: RuntimeEventType;
  payload: Record<string, unknown>;
  timestamp: number;
  client?: RuntimeClient;
}

export interface RuntimeTraceEvent extends RuntimeEvent {
  sequence: number;
  parentEventId?: string;
  visibility: RuntimeEventVisibility;
}

export interface CreateRuntimeEventParams {
  runId: string;
  type: RuntimeEventType;
  payload?: Record<string, unknown>;
  client?: RuntimeClient;
  id?: string;
  timestamp?: number;
}

export function createRuntimeEvent(params: CreateRuntimeEventParams): RuntimeEvent {
  return {
    version: RUNTIME_PROTOCOL_VERSION,
    id: params.id || createRuntimeId('event'),
    runId: params.runId,
    type: params.type,
    payload: params.payload || {},
    timestamp: params.timestamp || now(),
    client: params.client,
  };
}

export function createRuntimeTraceEvent(
  params: CreateRuntimeEventParams & {
    sequence: number;
    parentEventId?: string;
    visibility?: RuntimeEventVisibility;
  }
): RuntimeTraceEvent {
  return {
    ...createRuntimeEvent(params),
    sequence: params.sequence,
    parentEventId: params.parentEventId,
    visibility: params.visibility || 'user',
  };
}
