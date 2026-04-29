export interface LifecycleDetails {
  approval: null | {
    pending?: boolean;
    approved?: boolean;
    requestedAt?: number;
    approvedAt?: number;
    reason?: string;
  };
  takeover: null | {
    active?: boolean;
    interrupted?: boolean;
    interruptReason?: string;
    interruptedAt?: number;
    resumedAt?: number;
    restoredAt?: number;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

export function parseLifecycleDetails(metadata: unknown): LifecycleDetails {
  const record = isRecord(metadata) ? metadata : undefined;
  const approval = record && isRecord(record.approval) ? record.approval : null;
  const takeover = record && isRecord(record.takeover) ? record.takeover : null;

  return {
    approval: approval as LifecycleDetails['approval'],
    takeover: takeover as LifecycleDetails['takeover'],
  };
}
