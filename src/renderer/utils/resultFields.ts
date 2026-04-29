import type { SkillCandidateViewModel } from '../components/SkillCandidateCard';

export interface ExecutionTargetViewModel {
  kind?: string;
  environment?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function extractExecutionTarget(metadata: unknown): ExecutionTargetViewModel | undefined {
  if (!isRecord(metadata) || !isRecord(metadata.executionTarget)) {
    return undefined;
  }

  const executionTarget = metadata.executionTarget as Record<string, unknown>;
  const kind = typeof executionTarget.kind === 'string' ? executionTarget.kind : undefined;
  const environment = typeof executionTarget.environment === 'string' ? executionTarget.environment : undefined;

  if (!kind && !environment) {
    return undefined;
  }

  return { kind, environment };
}

export function extractSkillCandidate(rawOutput: unknown): SkillCandidateViewModel | undefined {
  if (!isRecord(rawOutput) || !isRecord(rawOutput.skillCandidate)) {
    return undefined;
  }

  return rawOutput.skillCandidate as unknown as SkillCandidateViewModel;
}
