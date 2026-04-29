import { describe, expect, it } from 'vitest';
import { parseLifecycleDetails } from '../taskLifecycle';

describe('taskLifecycle', () => {
  it('parses approval and takeover metadata', () => {
    expect(
      parseLifecycleDetails({
        approval: { pending: true, reason: 'needs approval' },
        takeover: { active: true, interruptedAt: 123 },
      })
    ).toEqual({
      approval: { pending: true, reason: 'needs approval' },
      takeover: { active: true, interruptedAt: 123 },
    });
  });

  it('returns nulls for missing metadata', () => {
    expect(parseLifecycleDetails(null)).toEqual({ approval: null, takeover: null });
    expect(parseLifecycleDetails({ approval: 'bad' })).toEqual({ approval: null, takeover: null });
  });
});
