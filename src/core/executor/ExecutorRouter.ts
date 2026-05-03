import { AnyAction, ActionResult } from '../action/ActionSchema';
import { BrowserExecutor } from './BrowserExecutor';
import { CLIExecutor } from './CLIExecutor';
import { AskUserExecutor } from './AskUserExecutor';
import { createRuntimeEvent } from '../../shared/protocol';
import { RuntimeEventBus, getRuntimeEventBus } from '../runtime/RuntimeEventBus';
import { ApprovalPolicyService, ApprovalEvaluationContext } from '../runtime/ApprovalPolicyService';

export interface ExecutorRouterOptions {
  eventBus?: RuntimeEventBus;
  approvalPolicyService?: ApprovalPolicyService;
}

export interface ExecuteActionContext {
  runId?: string;
  approval?: ApprovalEvaluationContext;
}

export class ExecutorRouter {
  public browserExecutor: BrowserExecutor;
  private cliExecutor: CLIExecutor;
  private askUserExecutor: AskUserExecutor;
  private eventBus: RuntimeEventBus;
  private approvalPolicyService: ApprovalPolicyService;

  constructor(options: ExecutorRouterOptions = {}) {
    this.browserExecutor = new BrowserExecutor();
    this.cliExecutor = new CLIExecutor();
    this.askUserExecutor = new AskUserExecutor();
    this.eventBus = options.eventBus || getRuntimeEventBus();
    this.approvalPolicyService = options.approvalPolicyService || new ApprovalPolicyService();
  }

  async execute(action: AnyAction, context: ExecuteActionContext = {}): Promise<ActionResult> {
    const startTime = Date.now();
    const runId = context.runId || action.id;
    this.emitToolCallStarted(action, runId);

    const approvalDecision = context.approval
      ? this.approvalPolicyService.evaluate(action, {
          ...context.approval,
          runId,
        })
      : null;

    if (approvalDecision && !approvalDecision.approved) {
      this.eventBus.emit(
        createRuntimeEvent({
          runId,
          type: 'approval/requested',
          payload: {
            request: approvalDecision.request,
            reason: approvalDecision.reason,
            mode: approvalDecision.mode,
            matchedRules: approvalDecision.matchedRules.map((rule) => rule.id),
            riskLevel: approvalDecision.riskLevel,
          },
        })
      );
      this.eventBus.emit(
        createRuntimeEvent({
          runId,
          type: 'approval/resolved',
          payload: {
            approved: false,
            reason: approvalDecision.reason,
            requestId: approvalDecision.request.id,
            status: 'denied',
          },
        })
      );

      const result: ActionResult = {
        success: false,
        error: {
          code: approvalDecision.error?.code || 'APPROVAL_DENIED',
          message: approvalDecision.reason,
          recoverable: true,
        },
        duration: Date.now() - startTime,
      };
      this.emitToolCallFinished(action, runId, result);
      return result;
    }

    try {
      console.log(`[ExecutorRouter] Executing action: ${action.type}`);

      let result: ActionResult;
      switch (action.type) {
        case 'browser:navigate':
        case 'browser:click':
        case 'browser:input':
        case 'browser:wait':
        case 'browser:extract':
        case 'browser:screenshot':
          result = await this.browserExecutor.execute(action);
          break;

        case 'cli:execute':
          result = await this.cliExecutor.execute({ ...action, runId } as AnyAction);
          break;

        case 'ask:user':
          result = await this.askUserExecutor.execute(action);
          break;

        default:
          result = {
            success: false,
            error: {
              code: 'UNKNOWN_ACTION',
              message: `Unknown action type: ${action.type}`,
              recoverable: false,
            },
            duration: Date.now() - startTime,
          };
          break;
      }
      this.emitToolCallFinished(action, runId, result);
      return result;
      } catch (error: unknown) {
      console.error(`[ExecutorRouter] Action execution failed:`, error);
      const message = error instanceof Error ? error.message : String(error);
      const result = {
        success: false,
        error: {
          code: 'EXECUTION_ERROR',
          message,
          recoverable: true,
        },
        duration: Date.now() - startTime,
      };
      this.emitToolCallFinished(action, runId, result);
      return result;
    }
  }

  private emitToolCallStarted(action: AnyAction, runId: string): void {
    this.eventBus.emit(
      createRuntimeEvent({
        runId,
        type: 'tool/call_started',
        payload: {
          actionId: action.id,
          actionType: action.type,
          description: action.description,
        },
      })
    );
  }

  private emitToolCallFinished(action: AnyAction, runId: string, result: ActionResult): void {
    this.eventBus.emit(
      createRuntimeEvent({
        runId,
        type: 'tool/call_finished',
        payload: {
          actionId: action.id,
          actionType: action.type,
          success: result.success,
          duration: result.duration,
          error: result.error,
          executionOutput: result.executionOutput,
        },
      })
    );
  }

  async cleanup(): Promise<void> {
    await this.browserExecutor.cleanup();
    this.askUserExecutor.cancelAll();
    // CLIExecutor 当前无需清理（如有需要可添加 cliExecutor.cleanup()
    console.log('[ExecutorRouter] Cleaned up');
  }
}

export default ExecutorRouter;
