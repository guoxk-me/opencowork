import { ActionContract } from './types';

export function normalizeActionContract(value: unknown): ActionContract | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  const supportedActions = Array.isArray(record.supportedActions)
    ? record.supportedActions.filter((item): item is string => typeof item === 'string')
    : undefined;
  const supportedOperations = Array.isArray(record.supportedOperations)
    ? record.supportedOperations.filter((item): item is string => typeof item === 'string')
    : undefined;
  const notes = Array.isArray(record.notes)
    ? record.notes.filter((item): item is string => typeof item === 'string')
    : undefined;
  const workflowSemantics = Array.isArray(record.workflowSemantics)
    ? record.workflowSemantics
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item) => ({
          action: typeof item.action === 'string' ? item.action : '',
          summary: typeof item.summary === 'string' ? item.summary : '',
          examples: Array.isArray(item.examples)
            ? item.examples.filter((example): example is string => typeof example === 'string')
            : undefined,
        }))
        .filter((item) => item.action.length > 0 && item.summary.length > 0)
    : undefined;

  if (!supportedActions && !supportedOperations && !notes && !workflowSemantics) {
    return undefined;
  }

  return {
    supportedActions,
    supportedOperations,
    notes,
    workflowSemantics,
  };
}
