import {
  ApprovalMode,
  ApprovalPolicyRule,
  ApprovalRequest,
  ApprovalRiskLevel,
  ApprovalSubject,
  createApprovalRequest,
  ExecutionTargetKind,
  RuntimeError,
} from '../../shared/protocol';
import { AnyAction } from '../action/ActionSchema';

export interface ApprovalEvaluationContext {
  runId: string;
  taskContext?: Record<string, unknown>;
  runtimeMode?: 'plan' | 'execute';
  workspaceRules?: string[];
  subject?: ApprovalSubject;
  target?: ExecutionTargetKind;
  metadata?: Record<string, unknown>;
}

export interface ApprovalDecision {
  approved: boolean;
  mode: ApprovalMode;
  request: ApprovalRequest;
  matchedRules: ApprovalPolicyRule[];
  riskLevel: ApprovalRiskLevel;
  reason: string;
  error?: RuntimeError;
}

export interface ApprovalPolicyServiceOptions {
  rules?: ApprovalPolicyRule[];
  defaultMode?: ApprovalMode;
}

const DEFAULT_RULES: ApprovalPolicyRule[] = [
  {
    id: 'cli-write-like-commands',
    subject: 'cli',
    mode: 'prompt',
    riskLevel: 'high',
    actionTypes: ['cli:execute'],
    intentKeywords: ['write', 'install', 'remove', 'delete', 'publish', 'push', 'commit', 'save'],
    description: 'Prompt before potentially mutating CLI commands',
  },
  {
    id: 'browser-high-impact-actions',
    subject: 'browser',
    mode: 'prompt',
    riskLevel: 'high',
    actionTypes: ['browser:click', 'browser:input'],
    intentKeywords: ['submit', 'publish', 'send', 'delete', 'remove', 'payment', 'pay', 'buy', 'purchase'],
    description: 'Prompt before high-impact browser actions',
  },
  {
    id: 'desktop-workflow-actions',
    subject: 'desktop',
    mode: 'prompt',
    riskLevel: 'high',
    actionTypes: ['open_application', 'focus_window', 'open_file', 'save_file', 'upload_file', 'download_file'],
    description: 'Prompt before desktop workflow actions',
  },
  {
    id: 'mcp-and-skill-actions',
    subject: 'mcp',
    mode: 'prompt',
    riskLevel: 'medium',
    description: 'Prompt before MCP actions',
  },
  {
    id: 'visual-multi-step-actions',
    subject: 'visual',
    mode: 'prompt',
    riskLevel: 'medium',
    actionTypes: ['drag', 'keypress', 'type'],
    description: 'Prompt before multi-step visual actions',
  },
];

export class ApprovalPolicyService {
  private readonly rules: ApprovalPolicyRule[];
  private readonly defaultMode: ApprovalMode;

  constructor(options: ApprovalPolicyServiceOptions = {}) {
    this.rules = options.rules || DEFAULT_RULES;
    this.defaultMode = options.defaultMode || 'auto';
  }

  evaluate(action: AnyAction, context: ApprovalEvaluationContext): ApprovalDecision {
    const subject = context.subject || this.resolveSubject(action);
    const target = context.target || this.resolveTarget(action);
    const matchedRules = this.rules.filter((rule) => this.matchesRule(rule, action, context, subject));
    const riskLevel = this.resolveRiskLevel(action, matchedRules, context);
    const mode = this.resolveMode(matchedRules);
    const requested = createApprovalRequest({
      runId: context.runId,
      subject,
      target,
      actionSummary: this.describeAction(action),
      actions: [action],
      riskLevel,
      riskReasons: this.collectRiskReasons(action, matchedRules, context),
      matchedRules: matchedRules.map((rule) => rule.id),
      taskContext: {
        ...context.taskContext,
        runtimeMode: context.runtimeMode || 'execute',
        workspaceRules: context.workspaceRules || [],
        metadata: context.metadata || {},
      },
    });

    const reason = this.buildReason(action, matchedRules, riskLevel, context);
    const approved = mode === 'auto' || mode === 'prompt' ? matchedRules.length === 0 : false;

    return {
      approved,
      mode,
      request: requested,
      matchedRules,
      riskLevel,
      reason,
      error: approved
        ? undefined
        : {
            version: 1,
            code: 'APPROVAL_DENIED',
            message: reason,
            recoverable: true,
          },
    };
  }

  private resolveSubject(action: AnyAction): ApprovalSubject {
    switch (action.type) {
      case 'cli:execute':
        return 'cli';
      case 'ask:user':
        return 'visual';
      case 'browser:navigate':
      case 'browser:click':
      case 'browser:input':
      case 'browser:wait':
      case 'browser:extract':
      case 'browser:screenshot':
      default:
        return 'browser';
    }
  }

  private resolveTarget(action: AnyAction): ExecutionTargetKind {
    switch (action.type) {
      case 'cli:execute':
        return 'cli';
      case 'ask:user':
        return 'skill';
      default:
        return 'browser';
    }
  }

  private matchesRule(
    rule: ApprovalPolicyRule,
    action: AnyAction,
    context: ApprovalEvaluationContext,
    subject: ApprovalSubject
  ): boolean {
    if (rule.subject !== subject) {
      return false;
    }

    if (rule.actionTypes && rule.actionTypes.length > 0 && !rule.actionTypes.includes(action.type)) {
      return false;
    }

    if (rule.intentKeywords && rule.intentKeywords.length > 0) {
      const haystack = [
        action.description,
        JSON.stringify(action.params),
        context.taskContext ? JSON.stringify(context.taskContext) : '',
        context.workspaceRules ? context.workspaceRules.join('\n') : '',
      ]
        .join(' ')
        .toLowerCase();
      if (!rule.intentKeywords.some((keyword) => haystack.includes(keyword.toLowerCase()))) {
        return false;
      }
    }

    return true;
  }

  private resolveRiskLevel(
    action: AnyAction,
    matchedRules: ApprovalPolicyRule[],
    context: ApprovalEvaluationContext
  ): ApprovalRiskLevel {
    if (context.runtimeMode === 'plan') {
      return 'high';
    }

    const explicitRuleLevel = matchedRules.find((rule) => rule.riskLevel)?.riskLevel;
    if (explicitRuleLevel) {
      return explicitRuleLevel;
    }

    if (action.type === 'cli:execute') {
      return 'medium';
    }

    return 'low';
  }

  private resolveMode(matchedRules: ApprovalPolicyRule[]): ApprovalMode {
    if (matchedRules.length === 0) {
      return this.defaultMode;
    }

    if (matchedRules.some((rule) => rule.mode === 'deny')) {
      return 'deny';
    }

    if (matchedRules.some((rule) => rule.mode === 'prompt')) {
      return 'prompt';
    }

    return 'auto';
  }

  private describeAction(action: AnyAction): string {
    switch (action.type) {
      case 'browser:navigate':
        return `Navigate to ${(action.params as { url?: string }).url || 'page'}`;
      case 'browser:click':
        return `Click ${(action.params as { selector?: string }).selector || 'element'}`;
      case 'browser:input':
        return `Input text into ${(action.params as { selector?: string }).selector || 'field'}`;
      case 'browser:wait':
        return 'Wait for browser condition';
      case 'browser:extract':
        return `Extract ${(action.params as { type?: string }).type || 'content'}`;
      case 'browser:screenshot':
        return 'Capture browser screenshot';
      case 'cli:execute':
        return `Execute CLI command ${(action.params as { command?: string }).command || ''}`.trim();
      case 'ask:user':
        return `Ask user: ${(action.params as { question?: string }).question || ''}`.trim();
      default:
        return action.description || action.type;
    }
  }

  private collectRiskReasons(
    action: AnyAction,
    matchedRules: ApprovalPolicyRule[],
    context: ApprovalEvaluationContext
  ): string[] {
    const reasons = matchedRules.map((rule) => rule.description);

    if (context.runtimeMode === 'plan') {
      reasons.push('plan mode blocks mutation actions');
    }

    if (action.type === 'cli:execute') {
      reasons.push('cli command may mutate local environment');
    }

    return Array.from(new Set(reasons));
  }

  private buildReason(
    action: AnyAction,
    matchedRules: ApprovalPolicyRule[],
    riskLevel: ApprovalRiskLevel,
    context: ApprovalEvaluationContext
  ): string {
    const reasons = this.collectRiskReasons(action, matchedRules, context);
    const ruleText = matchedRules.length > 0 ? ` matched rules: ${matchedRules.map((rule) => rule.id).join(', ')}` : '';
    return `Approval ${matchedRules.length > 0 ? 'required' : 'not required'} for ${action.type} (${riskLevel})${ruleText}${reasons.length > 0 ? ` - ${reasons.join('; ')}` : ''}`;
  }
}
