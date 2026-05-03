import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  RuntimeArtifact,
  RuntimeEvent,
  RuntimeEventType,
  RuntimeTraceEvent,
  createRuntimeId,
  createRuntimeTraceEvent,
  RuntimeMode,
  RuntimeClient,
} from '../../shared/protocol';
import { RuntimeEventBus, getRuntimeEventBus } from './RuntimeEventBus';

export interface TraceRunContext {
  runId: string;
  client: RuntimeClient;
  source: RuntimeClient;
  title: string;
  task?: string;
  mode: RuntimeMode;
  workspaceRules?: Array<{
    id: string;
    sourcePath: string;
    scopePath: string;
    content: string;
    loadedAt: number;
  }>;
  metadata?: Record<string, unknown>;
  startedAt?: number;
}

export interface TraceRunSummary {
  runId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'unknown';
  startedAt: number;
  updatedAt: number;
  title: string;
  source: RuntimeClient;
  client: RuntimeClient;
  mode: RuntimeMode;
  task?: string;
  workspaceRules?: Array<{ id: string; sourcePath: string; scopePath: string }>;
  metadata?: Record<string, unknown>;
  events: RuntimeTraceEvent[];
  artifacts: RuntimeArtifact[];
}

interface TraceRecord extends TraceRunSummary {
  id: string;
}

export interface TaskTraceCollectorOptions {
  baseDir?: string;
  eventBus?: RuntimeEventBus;
}

const DEFAULT_MAX_EVENTS_PER_TRACE = 1000;

export class TaskTraceCollector {
  private readonly baseDir: string;
  private readonly eventBus: RuntimeEventBus;
  private readonly traces = new Map<string, TraceRecord>();
  private sequenceByRun = new Map<string, number>();

  constructor(options: TaskTraceCollectorOptions = {}) {
    const homeDir = process.env.HOME || process.env.USERPROFILE || os.tmpdir();
    this.baseDir = options.baseDir || path.join(homeDir, '.opencowork', 'traces');
    this.eventBus = options.eventBus || getRuntimeEventBus();
    this.eventBus.subscribeAll((event) => this.recordEvent(event));
  }

  recordRunContext(context: TraceRunContext): void {
    const record = this.getOrCreateRecord(context.runId, context);
    record.client = context.client;
    record.source = context.source;
    record.title = context.title;
    record.task = context.task || record.task;
    record.mode = context.mode;
    record.metadata = {
      ...(record.metadata || {}),
      ...(context.metadata || {}),
    };
    record.startedAt = context.startedAt || record.startedAt;
    record.updatedAt = Date.now();
    record.workspaceRules = (context.workspaceRules || []).map((rule) => ({
      id: rule.id,
      sourcePath: rule.sourcePath,
      scopePath: rule.scopePath,
    }));
    this.persist(record);
  }

  recordEvent(event: RuntimeEvent): void {
    const record = this.getOrCreateRecord(event.runId);
    const sequence = (this.sequenceByRun.get(event.runId) || 0) + 1;
    this.sequenceByRun.set(event.runId, sequence);

    record.events.push(
      createRuntimeTraceEvent({
        ...event,
        sequence,
        visibility: this.resolveVisibility(event.type),
      })
    );

    if (record.events.length > DEFAULT_MAX_EVENTS_PER_TRACE) {
      record.events.splice(0, record.events.length - DEFAULT_MAX_EVENTS_PER_TRACE);
    }

    if (event.type === 'task/started') {
      record.status = 'running';
      record.startedAt = record.startedAt || event.timestamp;
    }

    if (event.type === 'task/completed') {
      record.status = 'completed';
    }

    if (event.type === 'task/failed') {
      record.status = 'failed';
    }

    if (event.type === 'task/cancelled') {
      record.status = 'cancelled';
    }

    if (event.type === 'tool/call_finished') {
      const output = event.payload?.executionOutput as { artifacts?: RuntimeArtifact[] } | undefined;
      if (output?.artifacts && output.artifacts.length > 0) {
        record.artifacts.push(...output.artifacts);
      }
    }

    if (event.type === 'artifact/created') {
      const artifact = event.payload?.artifact as RuntimeArtifact | undefined;
      if (artifact) {
        record.artifacts.push(artifact);
      }
    }

    record.updatedAt = Date.now();
    this.persist(record);
  }

  getTrace(runId: string): TraceRunSummary | null {
    const record = this.traces.get(runId);
    if (record) {
      return this.stripInternal(record);
    }

    const filePath = this.getTracePath(runId);
    if (!fs.existsSync(filePath)) {
      return null;
    }

    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as TraceRecord;
      this.traces.set(runId, parsed);
      return this.stripInternal(parsed);
    } catch (error) {
      // Trace read failures should not break run detail rendering.
      // eslint-disable-next-line no-console
      console.warn('[TaskTraceCollector] Failed to read trace:', error);
      return null;
    }
  }

  listTraces(limit: number = 50): TraceRunSummary[] {
    const records = Array.from(this.traces.values())
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
    return records.map((record) => this.stripInternal(record));
  }

  private resolveVisibility(type: RuntimeEventType) {
    switch (type) {
      case 'approval/requested':
      case 'approval/resolved':
      case 'task/completed':
      case 'task/failed':
      case 'task/cancelled':
        return 'user';
      case 'tool/call_started':
      case 'tool/call_finished':
        return 'debug';
      default:
        return 'internal';
    }
  }

  private getOrCreateRecord(runId: string, context?: TraceRunContext): TraceRecord {
    const existing = this.traces.get(runId);
    if (existing) {
      return existing;
    }

    const createdAt = context?.startedAt || Date.now();
    const record: TraceRecord = {
      id: createRuntimeId('trace'),
      runId,
      status: 'unknown',
      startedAt: createdAt,
      updatedAt: createdAt,
      title: context?.title || 'Untitled task',
      source: context?.source || 'electron',
      client: context?.client || 'electron',
      mode: context?.mode || 'execute',
      task: context?.task,
      workspaceRules: (context?.workspaceRules || []).map((rule) => ({
        id: rule.id,
        sourcePath: rule.sourcePath,
        scopePath: rule.scopePath,
      })),
      metadata: context?.metadata,
      events: [],
      artifacts: [],
    };

    this.traces.set(runId, record);
    return record;
  }

  private persist(record: TraceRecord): void {
    fs.mkdirSync(this.baseDir, { recursive: true });
    fs.writeFileSync(this.getTracePath(record.runId), JSON.stringify(record, null, 2), 'utf-8');
  }

  private getTracePath(runId: string): string {
    return path.join(this.baseDir, `${this.sanitize(runId)}.json`);
  }

  private sanitize(value: string): string {
    return value.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120) || 'unknown';
  }

  private stripInternal(record: TraceRecord): TraceRunSummary {
    return {
      runId: record.runId,
      status: record.status,
      startedAt: record.startedAt,
      updatedAt: record.updatedAt,
      title: record.title,
      source: record.source,
      client: record.client,
      mode: record.mode,
      task: record.task,
      workspaceRules: record.workspaceRules,
      metadata: record.metadata,
      events: [...record.events],
      artifacts: [...record.artifacts],
    };
  }
}

let taskTraceCollector: TaskTraceCollector | null = null;

export function getTaskTraceCollector(): TaskTraceCollector {
  if (!taskTraceCollector) {
    taskTraceCollector = new TaskTraceCollector();
  }
  return taskTraceCollector;
}

export function resetTaskTraceCollector(): void {
  taskTraceCollector = null;
}
