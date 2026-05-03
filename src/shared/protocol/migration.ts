import { RuntimeClient } from './common';
import { createRuntimeEvent, RuntimeEvent } from './event';
import { createRuntimeRun, RuntimeRun, RuntimeTaskStatus } from './task';

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getString(record: Record<string, unknown>, key: string): string | undefined {
  return typeof record[key] === 'string' ? (record[key] as string) : undefined;
}

function getNumber(record: Record<string, unknown>, key: string): number | undefined {
  return typeof record[key] === 'number' ? (record[key] as number) : undefined;
}

function normalizeClient(value: unknown): RuntimeClient {
  switch (value) {
    case 'scheduler':
    case 'im':
    case 'mcp':
    case 'cli':
    case 'test':
      return value;
    case 'chat':
    case 'electron':
    default:
      return 'electron';
  }
}

function normalizeStatus(value: unknown): RuntimeTaskStatus {
  switch (value) {
    case 'pending':
    case 'planning':
    case 'running':
    case 'waiting_user':
    case 'paused':
    case 'completed':
    case 'failed':
    case 'cancelled':
      return value;
    default:
      return 'pending';
  }
}

export function normalizeLegacyTaskRun(input: unknown): RuntimeRun | null {
  if (!isRecord(input)) {
    return null;
  }

  const id = getString(input, 'id');
  if (!id) {
    return null;
  }

  const source = normalizeClient(input.source);
  const inputRecord = isRecord(input.input) ? input.input : {};
  const prompt = getString(inputRecord, 'prompt');
  const params = isRecord(inputRecord.params) ? inputRecord.params : undefined;

  return createRuntimeRun({
    id,
    client: source,
    source,
    status: normalizeStatus(input.status),
    mode: 'execute',
    title: getString(input, 'title') || prompt || 'Untitled task',
    input: { prompt, params },
    sessionId: getString(input, 'sessionId'),
    templateId: getString(input, 'templateId'),
    resultId: getString(input, 'resultId'),
    metadata: isRecord(input.metadata) ? input.metadata : undefined,
    startedAt: getNumber(input, 'startedAt') || Date.now(),
    endedAt: getNumber(input, 'endedAt'),
  });
}

export function normalizeLegacyTaskRunEvents(input: unknown): RuntimeEvent[] {
  const run = normalizeLegacyTaskRun(input);
  if (!run) {
    return [];
  }

  const events: RuntimeEvent[] = [
    createRuntimeEvent({
      runId: run.id,
      type: 'task/started',
      client: run.client,
      timestamp: run.startedAt,
      payload: {
        title: run.title,
        source: run.source,
        mode: run.mode,
        input: run.input,
      },
    }),
  ];

  if (run.status === 'completed') {
    events.push(
      createRuntimeEvent({
        runId: run.id,
        type: 'task/completed',
        client: run.client,
        timestamp: run.endedAt || run.startedAt,
        payload: { resultId: run.resultId },
      })
    );
  }

  if (run.status === 'failed') {
    events.push(
      createRuntimeEvent({
        runId: run.id,
        type: 'task/failed',
        client: run.client,
        timestamp: run.endedAt || run.startedAt,
        payload: { error: run.metadata?.lastError },
      })
    );
  }

  if (run.status === 'cancelled') {
    events.push(
      createRuntimeEvent({
        runId: run.id,
        type: 'task/cancelled',
        client: run.client,
        timestamp: run.endedAt || run.startedAt,
        payload: {},
      })
    );
  }

  return events;
}
