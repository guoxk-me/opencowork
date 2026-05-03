import { RUNTIME_PROTOCOL_VERSION, RuntimeProtocolVersion } from './common';

export type RuntimeErrorCode =
  | 'TASK_FAILED'
  | 'APPROVAL_DENIED'
  | 'POLICY_DENIED'
  | 'VALIDATION_FAILED'
  | 'TIMEOUT'
  | 'NON_ZERO_EXIT'
  | 'SPAWN_FAILED'
  | 'UNKNOWN_ERROR';

export interface RuntimeError {
  version: RuntimeProtocolVersion;
  code: RuntimeErrorCode | string;
  message: string;
  recoverable: boolean;
  cause?: string;
  metadata?: Record<string, unknown>;
}

export function createRuntimeError(params: Omit<RuntimeError, 'version'>): RuntimeError {
  return {
    version: RUNTIME_PROTOCOL_VERSION,
    ...params,
  };
}

export function normalizeError(error: unknown, fallbackCode: RuntimeErrorCode = 'UNKNOWN_ERROR'): RuntimeError {
  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>;
    const code = typeof record.code === 'string' ? record.code : fallbackCode;
    const message = typeof record.message === 'string' ? record.message : String(error);
    const recoverable = typeof record.recoverable === 'boolean' ? record.recoverable : true;

    return createRuntimeError({ code, message, recoverable });
  }

  return createRuntimeError({
    code: fallbackCode,
    message: String(error),
    recoverable: true,
  });
}
