import { describe, expect, it, vi } from 'vitest';
import { BrowserExecutor } from '../../core/executor/BrowserExecutor';
import { VisualModelAdapter } from '../adapters/VisualModelAdapter';
import { VisualAutomationService } from '../VisualAutomationService';
import { BrowserExecutionAdapter } from '../runtime/BrowserExecutionAdapter';
import { ComputerExecutionAdapter } from '../runtime/ComputerExecutionAdapter';
import { ComputerUseRuntime } from '../runtime/ComputerUseRuntime';
import {
  ActionExecutionResult,
  ComputerExecutionTarget,
  VisualAdapterCapabilities,
  VisualObservation,
  VisualPageContext,
  VisualSessionHandle,
  VisualTurnRequest,
  VisualTurnResponse,
} from '../types/visualProtocol';

vi.mock('../../llm/config', () => ({
  loadLLMConfig: () => ({
    provider: 'openai',
    model: 'test-model',
    apiKey: 'test-key',
    baseUrl: 'https://example.test/v1',
    timeout: 5000,
  }),
}));

class StubVisualAdapter implements VisualModelAdapter {
  constructor(private readonly response: VisualTurnResponse) {}

  getName(): string {
    return 'stub-visual-adapter';
  }

  getCapabilities(): VisualAdapterCapabilities {
    return {
      builtInComputerTool: false,
      batchedActions: true,
      nativeScreenshotRequest: false,
      structuredOutput: true,
      toolCalling: false,
      supportsReasoningControl: false,
    };
  }

  async createSession(): Promise<VisualSessionHandle> {
    return {
      sessionId: 'stub-session',
      adapterMode: 'chat-structured',
      model: 'test-model',
      capabilities: this.getCapabilities(),
    };
  }

  async runTurn(
    _session: VisualSessionHandle,
    _request: VisualTurnRequest
  ): Promise<VisualTurnResponse> {
    return this.response;
  }

  async destroySession(_session: VisualSessionHandle): Promise<void> {}
}

class StubBrowserAdapter implements BrowserExecutionAdapter {
  public executeActions = vi.fn(async (_actions) => this.executionResult);
  public prepare = vi.fn(async () => {});
  public cleanup = vi.fn(async () => {});

  constructor(
    private readonly executionResult: ActionExecutionResult,
    private readonly executionTarget: { kind: 'browser' | 'desktop' | 'hybrid'; environment: 'playwright' | 'vm' | 'container' | 'native-bridge' } = {
      kind: 'browser',
      environment: 'playwright',
    }
  ) {}

  async captureObservation(): Promise<VisualObservation> {
    return {
      textualHints: 'stub observation',
    };
  }

  async getPageContext(): Promise<VisualPageContext> {
    return {
      url: 'https://example.test',
      title: 'Example',
    };
  }

  async getExecutionTarget(): Promise<ComputerExecutionTarget> {
    return this.executionTarget;
  }

  async getExecutionContext(): Promise<Record<string, unknown>> {
    const context: Record<string, unknown> = {
      url: 'https://example.test',
      title: 'Example',
    };

    if (this.executionTarget.kind === 'desktop') {
      context.harness = 'browser-backed-desktop';
      context.isolated = true;
      context.surface = 'desktop';
    }

    return context;
  }

  async getActionContract(): Promise<{
    supportedActions: Array<'open_application' | 'focus_window' | 'open_file' | 'save_file' | 'upload_file' | 'download_file'>;
    supportedOperations: Array<'application' | 'window' | 'file' | 'transfer'>;
    notes: string[];
  } | null> {
    if (this.executionTarget.kind !== 'desktop') {
      return null;
    }

    return {
      supportedActions: [
        'open_application',
        'focus_window',
        'open_file',
        'save_file',
        'upload_file',
        'download_file',
      ],
      supportedOperations: ['application', 'window', 'file', 'transfer'],
      notes: ['stub desktop action contract'],
    };
  }
}

class StubRuntime extends ComputerUseRuntime {
  constructor(private readonly result: Awaited<ReturnType<ComputerUseRuntime['runTask']>>) {
    super(
      {
        getName: () => 'runtime-adapter',
        getCapabilities: () => ({
          builtInComputerTool: false,
          batchedActions: true,
          nativeScreenshotRequest: false,
          structuredOutput: true,
          toolCalling: false,
          supportsReasoningControl: false,
        }),
        createSession: async () => ({
          sessionId: 'runtime-session',
          adapterMode: 'chat-structured',
          model: 'test-model',
          capabilities: {
            builtInComputerTool: false,
            batchedActions: true,
            nativeScreenshotRequest: false,
            structuredOutput: true,
            toolCalling: false,
            supportsReasoningControl: false,
          },
        }),
        runTurn: async () => ({ status: 'completed', finalMessage: 'unused' }),
        destroySession: async () => {},
      },
      new StubBrowserAdapter({ success: true, executed: [] })
    );
  }

  override async runTask(_input: any) {
    return this.result;
  }
}

class TestVisualAutomationService extends VisualAutomationService {
  constructor(
    browserExecutor: BrowserExecutor,
    private readonly executionAdapter: ComputerExecutionAdapter,
    private readonly runtime: ComputerUseRuntime,
    private readonly adapter: VisualModelAdapter
  ) {
    super(browserExecutor);
  }

  protected override createExecutionAdapter(_executionTarget?: ComputerExecutionTarget | null) {
    return this.executionAdapter as any;
  }

  protected override createRuntime(_adapter: any, _computer: any) {
    return this.runtime;
  }

  protected override createAdapter(_mode: any) {
    return this.adapter;
  }
}

class MixedWorkflowTestVisualAutomationService extends VisualAutomationService {
  public runVisualTaskCalls: Array<{
    task: string;
    executionTarget?: ComputerExecutionTarget | null;
    launchIfNeeded?: boolean;
  }> = [];

  constructor(browserExecutor: BrowserExecutor, private readonly runResults: Array<Awaited<ReturnType<VisualAutomationService['runVisualTask']>>>) {
    super(browserExecutor);
  }

  override async runVisualTask(params: any) {
    this.runVisualTaskCalls.push({
      task: params.task,
      executionTarget: params.executionTarget || null,
      launchIfNeeded: params.launchIfNeeded,
    });

    const nextResult = this.runResults.shift();
    if (!nextResult) {
      throw new Error('No mixed workflow result configured');
    }

    return nextResult;
  }
}

describe('VisualAutomationService', () => {
  it('returns execution error when approved actions fail before continuation', async () => {
    const browserExecutor = { getPage: () => ({}) } as BrowserExecutor;
    const service = new TestVisualAutomationService(
      browserExecutor,
      new StubBrowserAdapter({
        success: false,
        executed: [],
        error: {
          code: 'ACTION_EXECUTION_FAILED',
          message: 'Click failed',
          recoverable: true,
        },
      }),
      new StubRuntime({ success: true, turns: [], finalMessage: 'should not run' }),
      new StubVisualAdapter({ status: 'completed', finalMessage: 'unused' })
    );

    const result = await service.runApprovedVisualContinuation({
      task: 'Click submit and continue',
      actions: [{ type: 'click', x: 10, y: 20 }],
    });

    expect(result.success).toBe(false);
    expect(result.error?.code).toBe('ACTION_EXECUTION_FAILED');
    expect(result.routeReason).toBe('approved-visual-actions');
  });

  it('continues visual execution after approved actions succeed', async () => {
    const browserExecutor = { getPage: () => ({}) } as BrowserExecutor;
    const browserAdapter = new StubBrowserAdapter({
      success: true,
      executed: [{ type: 'click', x: 10, y: 20 }],
    });
    const continuationRuntime = new StubRuntime({
      success: true,
      finalMessage: 'Approved path completed',
      turns: [{ turnId: 'turn-1', duration: 100 }],
      metrics: {
        totalTurns: 1,
        actionBatches: 0,
        proposedActionCount: 0,
        executedActionCount: 0,
        approvalInterruptions: 0,
        totalDurationMs: 100,
      },
    });
    const service = new TestVisualAutomationService(
      browserExecutor,
      browserAdapter,
      continuationRuntime,
      new StubVisualAdapter({ status: 'completed', finalMessage: 'unused' })
    );

    const result = await service.runApprovedVisualContinuation({
      task: 'Click submit and continue',
      actions: [{ type: 'click', x: 10, y: 20 }],
      maxTurns: 4,
    });

    expect(result.success).toBe(true);
    expect(result.finalMessage).toBe('Approved path completed');
    expect(result.routeReason).toBe('approved-visual-actions');
    expect(result.approvedActions).toHaveLength(1);
    expect(browserAdapter.executeActions).toHaveBeenCalledTimes(1);
    expect(result.metrics?.totalTurns).toBe(1);
  });

  it('returns adapter and provider capability metadata for routed visual runs', async () => {
    const browserExecutor = { getPage: () => ({}) } as BrowserExecutor;
    const service = new TestVisualAutomationService(
      browserExecutor,
      new StubBrowserAdapter({ success: true, executed: [] }),
      new StubRuntime({ success: true, finalMessage: 'done', turns: [] }),
      new StubVisualAdapter({ status: 'completed', finalMessage: 'unused' })
    );

    const result = await service.runVisualTask({
      task: 'Inspect the current page visually',
      visualProvider: {
        id: 'provider-1',
        name: 'Provider 1',
        score: 91,
        reasons: ['selected provider'],
        adapterMode: 'chat-structured',
        capabilities: {
          builtInComputerTool: false,
          batchedActions: true,
          nativeScreenshotRequest: false,
          structuredOutput: true,
          toolCalling: false,
          supportsReasoningControl: false,
        },
        signals: {
          completionRate: 0.91,
          costScore: 0.12,
          latencyScore: 14,
        },
      },
    });

    expect(result.visualProviderCapabilities).toMatchObject({
      structuredOutput: true,
      batchedActions: true,
    });
    expect(result.adapterCapabilities).toMatchObject({
      structuredOutput: true,
      batchedActions: true,
    });
    expect(result.executionTarget).toEqual({
      kind: 'browser',
      environment: 'playwright',
    });
    expect(result.executionContext).toMatchObject({
      url: 'https://example.test',
      title: 'Example',
    });
  });

  it('uses a desktop execution target when provided', async () => {
    const browserExecutor = { getPage: () => ({}) } as BrowserExecutor;
    const desktopAdapter = new StubBrowserAdapter(
      { success: true, executed: [] },
      { kind: 'desktop', environment: 'vm' }
    );
    const service = new TestVisualAutomationService(
      browserExecutor,
      desktopAdapter,
      new StubRuntime({ success: true, finalMessage: 'done', turns: [] }),
      new StubVisualAdapter({ status: 'completed', finalMessage: 'unused' })
    );

    const result = await service.runVisualTask({
      task: 'Use the desktop target to open a note and save it',
      executionTarget: { kind: 'desktop', environment: 'vm' },
    });

    expect(result.executionTarget).toEqual({ kind: 'desktop', environment: 'vm' });
    expect(result.executionContext).toMatchObject({
      harness: 'browser-backed-desktop',
      isolated: true,
      surface: 'desktop',
    });
    expect(await desktopAdapter.getActionContract()).toMatchObject({
      supportedOperations: ['application', 'window', 'file', 'transfer'],
      supportedActions: [
        'open_application',
        'focus_window',
        'open_file',
        'save_file',
        'upload_file',
        'download_file',
      ],
    });
    expect(desktopAdapter.prepare).toHaveBeenCalledTimes(1);
    expect(desktopAdapter.cleanup).toHaveBeenCalledTimes(1);
  });

  it('runs a browser to desktop handoff workflow across both targets', async () => {
    const browserExecutor = { getPage: () => ({}) } as BrowserExecutor;
    const service = new MixedWorkflowTestVisualAutomationService(browserExecutor, [
      {
        success: true,
        finalMessage: 'browser step done',
        turns: [],
        executionTarget: { kind: 'browser', environment: 'playwright' },
      } as Awaited<ReturnType<VisualAutomationService['runVisualTask']>>,
      {
        success: true,
        finalMessage: 'desktop step done',
        turns: [],
        executionTarget: { kind: 'desktop', environment: 'native-bridge' },
      } as Awaited<ReturnType<VisualAutomationService['runVisualTask']>>,
      {
        success: true,
        finalMessage: 'final browser step done',
        turns: [],
        executionTarget: { kind: 'browser', environment: 'playwright' },
      } as Awaited<ReturnType<VisualAutomationService['runVisualTask']>>,
    ]);

    const result = await VisualAutomationService.prototype.runBrowserDesktopHandoffWorkflow.call(service, {
      browserTask: 'download the source file in the browser',
      desktopTask: 'rename the downloaded file on the desktop',
      finalBrowserTask: 'upload the renamed file back in the browser',
      maxTurnsPerStep: 3,
    });

    expect(result.success).toBe(true);
    expect(result.routeReason).toBe('browser-desktop-handoff');
    expect(result.steps).toHaveLength(3);
    expect(result.steps.map((step) => step.name)).toEqual(['browser', 'desktop', 'final-browser']);
    expect(service.runVisualTaskCalls.map((call) => call.executionTarget)).toEqual([
      { kind: 'browser', environment: 'playwright' },
      { kind: 'desktop', environment: 'native-bridge' },
      { kind: 'browser', environment: 'playwright' },
    ]);
    expect(result.finalResult?.finalMessage).toBe('final browser step done');
  });
});
