import { ActionContract } from '../../core/task/types';
import { normalizeActionContract } from '../../core/task/actionContract';

export { normalizeActionContract };

export function resolveActionContract(value: unknown): ActionContract | undefined {
  return normalizeActionContract(value);
}

interface ActionContractSource {
  actionContract?: unknown;
  rawOutput?: unknown;
}

export function extractActionContract(source: ActionContractSource | null | undefined): ActionContract | undefined {
  const directContract = resolveActionContract(source?.actionContract);
  if (directContract) {
    return directContract;
  }

  if (!source?.rawOutput || typeof source.rawOutput !== 'object' || Array.isArray(source.rawOutput)) {
    return undefined;
  }

  return resolveActionContract((source.rawOutput as Record<string, unknown>).actionContract);
}
