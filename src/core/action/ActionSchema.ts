import type { ExecutionOutput } from '../../shared/protocol';

// Action类型枚举
export enum ActionType {
  // Browser Actions
  BROWSER_NAVIGATE = 'browser:navigate',
  BROWSER_CLICK = 'browser:click',
  BROWSER_INPUT = 'browser:input',
  BROWSER_WAIT = 'browser:wait',
  BROWSER_EXTRACT = 'browser:extract',
  BROWSER_SCREENSHOT = 'browser:screenshot',

  // CLI Actions
  CLI_EXECUTE = 'cli:execute',

  // Control Actions
  ASK_USER = 'ask:user',
}

// Action约束
export interface ActionConstraints {
  timeout: number;
  retries: number;
  requiresConfirm: boolean;
}

// 基础Action接口
export interface BaseAction {
  id: string;
  type: ActionType;
  description: string;
  params: Record<string, any>;
  constraints?: ActionConstraints;
  dependsOn?: string[];
}

// Browser Actions
export interface BrowserNavigateAction extends BaseAction {
  type: ActionType.BROWSER_NAVIGATE;
  params: {
    url: string;
    waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
  };
}

export interface BrowserClickAction extends BaseAction {
  type: ActionType.BROWSER_CLICK;
  params: {
    selector: string;
    index?: number;
    textMatch?: string;
    fallbackSelectors?: string[];
  };
}

export interface BrowserInputAction extends BaseAction {
  type: ActionType.BROWSER_INPUT;
  params: {
    selector: string;
    text: string;
    clear?: boolean;
    delay?: number;
    textMatch?: string;
    fallbackSelectors?: string[];
    force?: boolean;
    pressEnter?: boolean;
  };
}

export interface BrowserWaitAction extends BaseAction {
  type: ActionType.BROWSER_WAIT;
  params: {
    selector?: string;
    timeout?: number;
    state?: 'visible' | 'hidden' | 'attached' | 'detached';
  };
}

export interface BrowserExtractAction extends BaseAction {
  type: ActionType.BROWSER_EXTRACT;
  params: {
    selector: string;
    type: 'text' | 'html' | 'table' | 'json';
    multiple?: boolean;
  };
}

export interface BrowserScreenshotAction extends BaseAction {
  type: ActionType.BROWSER_SCREENSHOT;
  params: {
    fullPage?: boolean;
    selector?: string;
  };
}

// CLI Actions
export interface CLIExecuteAction extends BaseAction {
  type: ActionType.CLI_EXECUTE;
  params: {
    command: string;
    workingDir?: string;
    env?: Record<string, string>;
  };
}

// Control Actions
export interface AskUserAction extends BaseAction {
  type: ActionType.ASK_USER;
  params: {
    question: string;
    options?: string[];
    defaultResponse?: string;
  };
}

// Action联合类型
export type AnyAction =
  | BrowserNavigateAction
  | BrowserClickAction
  | BrowserInputAction
  | BrowserWaitAction
  | BrowserExtractAction
  | BrowserScreenshotAction
  | CLIExecuteAction
  | AskUserAction;

// Action执行结果
export interface ActionResult {
  success: boolean;
  output?: any;
  executionOutput?: ExecutionOutput;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
  screenshots?: string[];
  duration: number;
}

// Plan相关类型
export interface Plan {
  id: string;
  nodes: PlanNode[];
  edges: PlanEdge[];
  rootNodeId: string;
}

export interface PlanNode {
  id: string;
  action: AnyAction | null;
  type: 'action' | 'condition' | 'loop';
  condition?: {
    expression: string;
    thenNodeId: string;
    elseNodeId: string;
  };
  loop?: {
    maxIterations: number;
    untilNodeId: string;
    bodyNodeId: string;
  };
  metadata: {
    description: string;
    estimatedDuration?: number;
    canUserTakeover: boolean;
  };
}

export interface PlanEdge {
  from: string;
  to: string;
  type: 'success' | 'failure' | 'always';
  guard?: string;
}

// 工具函数：生成唯一ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
