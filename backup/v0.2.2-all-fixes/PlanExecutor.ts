import { Plan, PlanNode, AnyAction } from '../action/ActionSchema';
import { ExecutorRouter } from '../executor/ExecutorRouter';

interface ExecutionCallbacks {
  onNodeStart?: (node: PlanNode) => void;
  onNodeComplete?: (node: PlanNode, result: any) => void;
  onNodeError?: (node: PlanNode, error: any) => void;
  onCondition?: (expression: string, result: boolean) => void;
  onLoopIteration?: (node: PlanNode, iteration: number) => void;
  onUserTakeover?: (node: PlanNode) => void;
}

type ExecutionEvent =
  | { type: 'node_start'; node: PlanNode }
  | { type: 'node_complete'; node: PlanNode; result: any }
  | { type: 'node_error'; node: PlanNode; error: { message: string; code?: string; recoverable?: boolean } }
  | { type: 'condition_eval'; expression: string; result: boolean }
  | { type: 'loop_iteration'; node: PlanNode; iteration: number }
  | { type: 'paused'; node: PlanNode }
  | { type: 'resumed' }
  | { type: 'completed'; summary: any }
  | { type: 'failed'; error: { message: string; code?: string; recoverable?: boolean } };

export class PlanExecutor {
  private plan: Plan | null = null;
  private currentNodeId: string | null = null;
  private paused: boolean = false;
  private cancelled: boolean = false;
  private callbacks: ExecutionCallbacks = {};
  private router: ExecutorRouter;

  constructor() {
    this.router = new ExecutorRouter();
  }

  startScreencast(): void {
    this.router.browserExecutor.startScreencast();
  }

  stopScreencast(): void {
    this.router.browserExecutor.stopScreencast();
  }

  async getPageContent(): Promise<string> {
    try {
      const content = await this.router.browserExecutor.getPageContent();
      return content || '';
    } catch (error) {
      console.error('[PlanExecutor] Failed to get page content:', error);
      return '';
    }
  }

  async getPageUrl(): Promise<string> {
    try {
      const url = await this.router.browserExecutor.getPageUrl();
      return url || '';
    } catch (error) {
      console.error('[PlanExecutor] Failed to get page URL:', error);
      return '';
    }
  }

  async getPageStructure(): Promise<any> {
    try {
      const structure = await this.router.browserExecutor.getPageStructure();
      return structure || null;
    } catch (error) {
      console.error('[PlanExecutor] Failed to get page structure:', error);
      return null;
    }
  }

  setActiveMode(active: boolean): void {
    if (this.router.browserExecutor.setActiveMode) {
      this.router.browserExecutor.setActiveMode(active);
    }
  }

  async *execute(
    plan: Plan,
    callbacks?: ExecutionCallbacks
  ): AsyncGenerator<ExecutionEvent, void, unknown> {
    this.plan = plan;
    this.paused = false;
    this.cancelled = false;
    this.callbacks = callbacks || {};

    console.log(`[PlanExecutor] Starting execution of plan ${plan.id}`);

    const actionNodes = plan.nodes.filter((n) => n.type === 'action');

    for (const node of actionNodes) {
      if (this.cancelled) {
        console.log(`[PlanExecutor] Execution cancelled`);
        break;
      }

      while (this.paused) {
        yield { type: 'paused', node };
        await this.waitForResume();
      }

      this.currentNodeId = node.id;

      try {
        yield { type: 'node_start', node };

        if (node.action) {
          const result = await this.executeAction(node.action);
          
          if (result.success) {
            yield { type: 'node_complete', node, result };
            this.callbacks.onNodeComplete?.(node, result);
          } else {
            const error = new Error(result.error?.message || 'Action failed');
            yield { type: 'node_error', node, error: { 
              message: error.message, 
              code: result.error?.code,
              recoverable: result.error?.recoverable ?? true
            } };
            this.callbacks.onNodeError?.(node, error);
            
            if (!result.error?.recoverable) {
              yield { type: 'failed', error };
              return;
            }
          }
        }
      } catch (error: any) {
        console.error(`[PlanExecutor] Node ${node.id} failed:`, error);
        yield { type: 'node_error', node, error: error as Error };
        this.callbacks.onNodeError?.(node, error as Error);
        yield { type: 'failed', error: error as Error };
        return;
      }
    }

    if (!this.cancelled) {
      yield { type: 'completed', summary: {} };
    }
  }

  private async executeAction(action: AnyAction): Promise<any> {
    console.log(`[PlanExecutor] Executing action via router: ${action.type}`);
    return await this.router.execute(action);
  }

  async executeSingleAction(action: AnyAction): Promise<any> {
    console.log(`[PlanExecutor] Executing single action via router: ${action.type}`);
    return await this.router.execute(action);
  }

  private async waitForResume(): Promise<void> {
    return new Promise((resolve) => {
      const check = () => {
        if (!this.paused) {
          resolve();
        } else {
          setTimeout(check, 100);
        }
      };
      check();
    });
  }

  pause(): void {
    this.paused = true;
    console.log(`[PlanExecutor] Paused at node ${this.currentNodeId}`);
  }

  resume(): void {
    this.paused = false;
    console.log(`[PlanExecutor] Resumed`);
  }

  jumpTo(nodeId: string): void {
    if (this.plan) {
      const nodeExists = this.plan.nodes.some((n) => n.id === nodeId);
      if (nodeExists) {
        this.currentNodeId = nodeId;
        console.log(`[PlanExecutor] Jumped to node ${nodeId}`);
      }
    }
  }

  getCurrentNodeId(): string | null {
    return this.currentNodeId;
  }

  isPaused(): boolean {
    return this.paused;
  }

  isCancelled(): boolean {
    return this.cancelled;
  }

  cancel(): void {
    this.cancelled = true;
    console.log(`[PlanExecutor] Cancelled`);
  }

  async cleanup(): Promise<void> {
    await this.router.cleanup();
  }

  async getScreenshot(): Promise<string | null> {
    return await this.router.browserExecutor.getScreenshot();
  }

  getBrowserPage() {
    return this.router.browserExecutor.getPage();
  }
}

export default PlanExecutor;