import {
  ApprovalResponseParams,
  CancelTaskParams,
  createRuntimeCommand,
  createRuntimeEvent,
  InterruptTaskParams,
  ListRunsParams,
  ReadRunParams,
  ResumeTaskParams,
  RuntimeClient,
  RuntimeRun,
  StartTaskParams,
} from '../../shared/protocol';
import { RuntimeEventBus, getRuntimeEventBus } from './RuntimeEventBus';
import { TaskTraceCollector, getTaskTraceCollector } from './TaskTraceCollector';

export interface StartTaskResponse {
  accepted: boolean;
  handle?: string;
  runId?: string;
  run?: unknown;
  error?: string;
  [key: string]: unknown;
}

export interface RuntimeActionResponse {
  success: boolean;
  runId?: string;
  error?: string;
  [key: string]: unknown;
}

export interface ReadRunResponse {
  run: RuntimeRun | unknown | null;
  events: ReturnType<RuntimeEventBus['listEvents']>;
  trace: ReturnType<TaskTraceCollector['getTrace']>;
}

export interface ListRunsResponse {
  runs: Array<RuntimeRun | unknown>;
}

export interface AgentRuntimeApi {
  startTask(params: StartTaskParams, context?: unknown): Promise<StartTaskResponse>;
  interruptTask(params: InterruptTaskParams, context?: unknown): Promise<RuntimeActionResponse>;
  resumeTask(params: ResumeTaskParams, context?: unknown): Promise<RuntimeActionResponse>;
  cancelTask(params: CancelTaskParams, context?: unknown): Promise<RuntimeActionResponse>;
  respondApproval(params: ApprovalResponseParams, context?: unknown): Promise<RuntimeActionResponse>;
  readRun(params: ReadRunParams): Promise<ReadRunResponse>;
  listRuns(params?: ListRunsParams): Promise<ListRunsResponse>;
}

export interface AgentRuntimeAdapter {
  startTask(params: StartTaskParams, context?: unknown): Promise<StartTaskResponse>;
  interruptTask?(params: InterruptTaskParams, context?: unknown): Promise<RuntimeActionResponse>;
  resumeTask?(params: ResumeTaskParams, context?: unknown): Promise<RuntimeActionResponse>;
  cancelTask?(params: CancelTaskParams, context?: unknown): Promise<RuntimeActionResponse>;
  respondApproval?(params: ApprovalResponseParams, context?: unknown): Promise<RuntimeActionResponse>;
  readRun?(params: ReadRunParams): Promise<RuntimeRun | unknown | null>;
  listRuns?(params?: ListRunsParams): Promise<Array<RuntimeRun | unknown>>;
}

export interface InProcessAgentRuntimeApiOptions {
  adapter: AgentRuntimeAdapter;
  eventBus?: RuntimeEventBus;
  traceCollector?: TaskTraceCollector;
  defaultClient?: RuntimeClient;
}

export class InProcessAgentRuntimeApi implements AgentRuntimeApi {
  private readonly adapter: AgentRuntimeAdapter;
  private readonly eventBus: RuntimeEventBus;
  private readonly traceCollector: TaskTraceCollector;
  private readonly defaultClient: RuntimeClient;

  constructor(options: InProcessAgentRuntimeApiOptions) {
    this.adapter = options.adapter;
    this.eventBus = options.eventBus || getRuntimeEventBus();
    this.traceCollector = options.traceCollector || getTaskTraceCollector();
    this.defaultClient = options.defaultClient || 'electron';
  }

  async startTask(params: StartTaskParams, context?: unknown): Promise<StartTaskResponse> {
    const client = params.client || this.defaultClient;
    const command = createRuntimeCommand({
      type: 'task/start',
      client,
      params: { ...params, client },
    });

    const response = await this.adapter.startTask({ ...params, client }, context);
    const runId = this.resolveRunId(response) || params.runId;

    if (runId) {
      this.traceCollector.recordRunContext({
        runId,
        client,
        source: client,
        title: params.task,
        task: params.task,
        mode: params.mode || 'execute',
        metadata: {
          source: params.source,
          templateId: params.templateId,
          sessionId: params.sessionId,
          threadId: params.threadId,
          executionMode: params.executionMode,
          executionTargetKind: params.executionTargetKind,
        },
      });
      this.eventBus.emit(
        createRuntimeEvent({
          runId,
          type: response.accepted ? 'task/started' : 'task/failed',
          client,
          payload: {
            commandId: command.id,
            source: params.source || client,
            task: params.task,
            accepted: response.accepted,
            error: response.error,
          },
        })
      );
    }

    return runId && !response.runId ? { ...response, runId } : response;
  }

  async interruptTask(params: InterruptTaskParams, context?: unknown): Promise<RuntimeActionResponse> {
    if (!this.adapter.interruptTask) {
      return { success: false, runId: params.runId, error: 'Interrupt is not supported' };
    }
    return this.adapter.interruptTask(params, context);
  }

  async resumeTask(params: ResumeTaskParams, context?: unknown): Promise<RuntimeActionResponse> {
    if (!this.adapter.resumeTask) {
      return { success: false, runId: params.runId, error: 'Resume is not supported' };
    }
    return this.adapter.resumeTask(params, context);
  }

  async cancelTask(params: CancelTaskParams, context?: unknown): Promise<RuntimeActionResponse> {
    if (!this.adapter.cancelTask) {
      return { success: false, runId: params.runId, error: 'Cancel is not supported' };
    }
    return this.adapter.cancelTask(params, context);
  }

  async respondApproval(params: ApprovalResponseParams, context?: unknown): Promise<RuntimeActionResponse> {
    if (!this.adapter.respondApproval) {
      return { success: false, runId: params.runId, error: 'Approval response is not supported' };
    }
    return this.adapter.respondApproval(params, context);
  }

  async readRun(params: ReadRunParams): Promise<ReadRunResponse> {
    const run = this.adapter.readRun ? await this.adapter.readRun(params) : null;
    return {
      run,
      events: this.eventBus.listEvents(params.runId),
      trace: this.traceCollector.getTrace(params.runId),
    };
  }

  async listRuns(params?: ListRunsParams): Promise<ListRunsResponse> {
    const runs = this.adapter.listRuns ? await this.adapter.listRuns(params) : [];
    return { runs };
  }

  private resolveRunId(response: StartTaskResponse): string | undefined {
    if (typeof response.runId === 'string') {
      return response.runId;
    }
    if (typeof response.handle === 'string') {
      return response.handle;
    }
    if (response.run && typeof response.run === 'object') {
      const run = response.run as Record<string, unknown>;
      return typeof run.id === 'string' ? run.id : undefined;
    }
    return undefined;
  }
}
