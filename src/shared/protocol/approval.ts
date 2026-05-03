import { createRuntimeId, ExecutionTargetKind, now, RUNTIME_PROTOCOL_VERSION, RuntimeProtocolVersion } from './common';

export type ApprovalMode = 'auto' | 'prompt' | 'deny';

export type ApprovalSubject = 'browser' | 'desktop' | 'visual' | 'cli' | 'mcp' | 'skill';

export type ApprovalRiskLevel = 'low' | 'medium' | 'high';

export type ApprovalDecisionStatus = 'approved' | 'denied' | 'expired' | 'cancelled';

export interface ApprovalPolicyRule {
  id: string;
  subject: ApprovalSubject;
  mode: ApprovalMode;
  riskLevel?: ApprovalRiskLevel;
  actionTypes?: string[];
  toolNames?: string[];
  intentKeywords?: string[];
  description: string;
}

export interface ApprovalRequest {
  version: RuntimeProtocolVersion;
  id: string;
  runId: string;
  subject: ApprovalSubject;
  target?: ExecutionTargetKind;
  actionSummary: string;
  actions: unknown[];
  riskLevel: ApprovalRiskLevel;
  riskReasons: string[];
  matchedRules: string[];
  taskContext: Record<string, unknown>;
  createdAt: number;
  expiresAt?: number;
}

export interface ApprovalResponse {
  version: RuntimeProtocolVersion;
  id: string;
  requestId: string;
  runId: string;
  status: ApprovalDecisionStatus;
  reason?: string;
  responder?: string;
  createdAt: number;
}

export interface CreateApprovalRequestParams extends Omit<ApprovalRequest, 'version' | 'id' | 'createdAt'> {
  id?: string;
  createdAt?: number;
}

export function createApprovalRequest(params: CreateApprovalRequestParams): ApprovalRequest {
  const { id, createdAt, ...rest } = params;
  return {
    version: RUNTIME_PROTOCOL_VERSION,
    id: id || createRuntimeId('approval'),
    createdAt: createdAt || now(),
    ...rest,
  };
}

export function createApprovalResponse(params: Omit<ApprovalResponse, 'version' | 'id' | 'createdAt'>): ApprovalResponse {
  return {
    version: RUNTIME_PROTOCOL_VERSION,
    id: createRuntimeId('approval-response'),
    createdAt: now(),
    ...params,
  };
}
