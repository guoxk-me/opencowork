import { BrowserExecutor } from '../core/executor/BrowserExecutor';
import { TaskVisualProviderSelection } from '../core/task/types';
import { loadLLMConfig } from '../llm/config';
import {
  ChatCompletionsVisualAdapter,
  ComputerUseRuntime,
  PlaywrightBrowserExecutionAdapter,
  ResponsesVisualAdapter,
  RuleBasedApprovalGate,
  UIAction,
  VisualAdapterMode,
  ComputerExecutionAdapter,
  VisualModelAdapter,
} from './index';
import { ComputerExecutionTarget } from './runtime/ComputerExecutionAdapter';
import {
  createDefaultDesktopExecutionAdapterFactory,
  DesktopExecutionAdapterFactory,
} from './runtime/DesktopExecutionAdapterFactory';

export interface RunVisualTaskParams {
  task: string;
  adapterMode?: VisualAdapterMode;
  model?: string;
  maxTurns?: number;
  launchIfNeeded?: boolean;
  approvalEnabled?: boolean;
  visualProvider?: TaskVisualProviderSelection | null;
  executionTarget?: ComputerExecutionTarget | null;
}

export interface RunVisualBrowserFallbackParams {
  action: 'click' | 'input' | 'wait';
  selector?: string;
  text?: string;
  pressEnter?: boolean;
  timeout?: number;
  adapterMode?: VisualAdapterMode;
  maxTurns?: number;
  routeReason?: string;
  fallbackReason?: string;
}

export interface RunApprovedVisualContinuationParams {
  task: string;
  actions: UIAction[];
  adapterMode?: VisualAdapterMode;
  model?: string;
  maxTurns?: number;
  executionTarget?: ComputerExecutionTarget | null;
}

export interface RunBrowserDesktopHandoffWorkflowParams {
  browserTask: string;
  desktopTask: string;
  finalBrowserTask?: string;
  adapterMode?: VisualAdapterMode;
  model?: string;
  maxTurnsPerStep?: number;
  approvalEnabled?: boolean;
  visualProvider?: TaskVisualProviderSelection | null;
}

export interface BrowserDesktopHandoffWorkflowStep {
  name: 'browser' | 'desktop' | 'final-browser';
  task: string;
  result: Awaited<ReturnType<VisualAutomationService['runVisualTask']>>;
}

export interface BrowserDesktopHandoffWorkflowResult {
  success: boolean;
  routeReason: 'browser-desktop-handoff';
  steps: BrowserDesktopHandoffWorkflowStep[];
  finalResult?: Awaited<ReturnType<VisualAutomationService['runVisualTask']>>;
  failedStep?: BrowserDesktopHandoffWorkflowStep;
}

export class VisualAutomationService {
  constructor(
    private readonly browserExecutor: BrowserExecutor,
    private readonly createDesktopExecutionAdapter: DesktopExecutionAdapterFactory =
      createDefaultDesktopExecutionAdapterFactory()
  ) {}

  async runVisualTask(params: RunVisualTaskParams) {
    const config = loadLLMConfig();
    const adapterMode = params.adapterMode || 'chat-structured';
    const model = params.model || config.model;
    const maxTurns = params.maxTurns || 8;
    const launchIfNeeded = params.launchIfNeeded !== false;
    const approvalEnabled = params.approvalEnabled !== false;

    if (launchIfNeeded && !this.browserExecutor.getPage()) {
      await this.browserExecutor.launchBrowser();
    }

    const adapter = this.createAdapter(adapterMode);
    const adapterCapabilities = adapter.getCapabilities();
    const session = await adapter.createSession({
      model,
      systemPrompt:
        'Use the current browser state to complete the task safely. Prefer short action batches. Request more visual context when needed.',
      timeoutMs: config.timeout || 60000,
      maxTurns,
      metadata: {
        visualProvider: params.visualProvider || null,
      },
    });

    const computer = this.createExecutionAdapter(params.executionTarget);
    const runtime = this.createRuntime(adapter, computer);

    try {
      if (computer.prepare) {
        await computer.prepare();
      }

      const executionTarget = await computer.getExecutionTarget();
      const executionContext = await computer.getExecutionContext();
      const actionContract = computer.getActionContract ? await computer.getActionContract() : null;

      const result = await runtime.runTask({
        runId: session.sessionId,
        task: params.task,
        adapterSession: session,
        maxTurns,
        approvalPolicy: {
          enabled: approvalEnabled,
          highImpactActions: ['login', 'publish', 'send', 'delete', 'payment', 'upload'],
        },
      });

      return {
        adapter: adapter.getName(),
        adapterMode,
        model,
        routeReason: 'visual-runtime',
        maxTurns,
        executionTarget,
        executionContext,
        actionContract,
        visualProvider: params.visualProvider || null,
        visualProviderCapabilities: params.visualProvider?.capabilities || null,
        adapterCapabilities,
        ...result,
      };
    } finally {
      let cleanupError: unknown = null;
      if (computer.cleanup) {
        try {
          await computer.cleanup();
        } catch (error) {
          cleanupError = error;
          console.warn('[VisualAutomationService] Computer cleanup failed:', error);
        }
      }

      try {
        await adapter.destroySession(session);
      } catch (error) {
        console.warn('[VisualAutomationService] Adapter session cleanup failed:', error);
        if (!cleanupError) {
          cleanupError = error;
        }
      }

      if (cleanupError) {
        throw cleanupError;
      }
    }
  }

  async runBrowserActionFallback(params: RunVisualBrowserFallbackParams) {
    const result = await this.runVisualTask({
      task: this.buildBrowserFallbackTask(params),
      adapterMode: params.adapterMode,
      maxTurns: params.maxTurns || 6,
      launchIfNeeded: true,
    });

    return {
      ...result,
      routeReason: params.routeReason || 'browser-action-visual-route',
      fallbackReason: params.fallbackReason,
      originalAction: params.action,
      selectorHint: params.selector,
    };
  }

  async runApprovedVisualContinuation(params: RunApprovedVisualContinuationParams) {
    const computer = this.createExecutionAdapter(params.executionTarget);
    try {
      if (computer.prepare) {
        await computer.prepare();
      }

      const execution = await computer.executeActions(params.actions || []);

      if (!execution.success) {
        return {
          success: false,
          turns: [],
          error: execution.error,
          routeReason: 'approved-visual-actions',
        };
      }

      const continuationResult = await this.runVisualTask({
        task: params.task,
        adapterMode: params.adapterMode,
        model: params.model,
        maxTurns: params.maxTurns,
        launchIfNeeded: false,
        approvalEnabled: false,
        executionTarget: params.executionTarget,
      });

      return {
        ...continuationResult,
        routeReason: 'approved-visual-actions',
        approvedActions: execution.executed,
      };
    } finally {
      if (computer.cleanup) {
        await computer.cleanup();
      }
    }
  }

  async runBrowserDesktopHandoffWorkflow(
    params: RunBrowserDesktopHandoffWorkflowParams
  ): Promise<BrowserDesktopHandoffWorkflowResult> {
    const steps: BrowserDesktopHandoffWorkflowStep[] = [];

    const browserStepResult = await this.runVisualTask({
      task: params.browserTask,
      adapterMode: params.adapterMode,
      model: params.model,
      maxTurns: params.maxTurnsPerStep,
      launchIfNeeded: true,
      approvalEnabled: params.approvalEnabled,
      visualProvider: params.visualProvider,
      executionTarget: { kind: 'browser', environment: 'playwright' },
    });
    const browserStep: BrowserDesktopHandoffWorkflowStep = {
      name: 'browser',
      task: params.browserTask,
      result: browserStepResult,
    };
    steps.push(browserStep);

    if (!browserStepResult.success) {
      return {
        success: false,
        routeReason: 'browser-desktop-handoff',
        steps,
        failedStep: browserStep,
      };
    }

    const desktopStepResult = await this.runVisualTask({
      task: params.desktopTask,
      adapterMode: params.adapterMode,
      model: params.model,
      maxTurns: params.maxTurnsPerStep,
      launchIfNeeded: false,
      approvalEnabled: params.approvalEnabled,
      visualProvider: params.visualProvider,
      executionTarget: { kind: 'desktop', environment: 'native-bridge' },
    });
    const desktopStep: BrowserDesktopHandoffWorkflowStep = {
      name: 'desktop',
      task: params.desktopTask,
      result: desktopStepResult,
    };
    steps.push(desktopStep);

    if (!desktopStepResult.success) {
      return {
        success: false,
        routeReason: 'browser-desktop-handoff',
        steps,
        failedStep: desktopStep,
      };
    }

    let finalResult = desktopStepResult;

    if (params.finalBrowserTask) {
      const finalBrowserStepResult = await this.runVisualTask({
        task: params.finalBrowserTask,
        adapterMode: params.adapterMode,
        model: params.model,
        maxTurns: params.maxTurnsPerStep,
        launchIfNeeded: false,
        approvalEnabled: params.approvalEnabled,
        visualProvider: params.visualProvider,
        executionTarget: { kind: 'browser', environment: 'playwright' },
      });
      const finalBrowserStep: BrowserDesktopHandoffWorkflowStep = {
        name: 'final-browser',
        task: params.finalBrowserTask,
        result: finalBrowserStepResult,
      };
      steps.push(finalBrowserStep);
      finalResult = finalBrowserStepResult;

      if (!finalBrowserStepResult.success) {
        return {
          success: false,
          routeReason: 'browser-desktop-handoff',
          steps,
          finalResult,
          failedStep: finalBrowserStep,
        };
      }
    }

    return {
      success: true,
      routeReason: 'browser-desktop-handoff',
      steps,
      finalResult,
    };
  }

  protected createAdapter(mode: VisualAdapterMode): VisualModelAdapter {
    switch (mode) {
      case 'responses-computer':
        return new ResponsesVisualAdapter();
      case 'chat-structured':
        return new ChatCompletionsVisualAdapter();
      default:
        throw new Error(`Unsupported visual adapter mode: ${mode}`);
    }
  }

  protected createBrowserAdapter(): PlaywrightBrowserExecutionAdapter {
    return new PlaywrightBrowserExecutionAdapter(this.browserExecutor);
  }

  protected createExecutionAdapter(executionTarget?: ComputerExecutionTarget | null): ComputerExecutionAdapter {
    if (executionTarget?.kind === 'desktop') {
      return this.createDesktopExecutionAdapter(this.browserExecutor, executionTarget);
    }

    return this.createBrowserAdapter();
  }

  protected createRuntime(adapter: VisualModelAdapter, computer: ComputerExecutionAdapter): ComputerUseRuntime {
    return new ComputerUseRuntime(adapter, computer, new RuleBasedApprovalGate());
  }

  private buildBrowserFallbackTask(params: RunVisualBrowserFallbackParams): string {
    switch (params.action) {
      case 'click':
        return `Use visual browser interaction to click the element that matches selector hint: ${params.selector || 'unknown target'}. If the target is not clearly visible, inspect the page and click the most likely matching interactive element.`;
      case 'input':
        return `Use visual browser interaction to focus the input matching selector hint: ${params.selector || 'unknown input'}, then type this text: ${params.text || ''}${params.pressEnter ? ', and press Enter after typing.' : '.'}`;
      case 'wait':
        return `Use visual browser interaction to inspect whether an element matching selector hint: ${params.selector || 'unknown target'} is visible. Wait briefly if needed before concluding.`;
      default:
        return 'Use visual browser interaction to inspect and continue the requested browser task.';
    }
  }
}
