import { describe, expect, it } from 'vitest';
import { extractExecutionTarget, extractSkillCandidate } from '../resultFields';

describe('resultFields', () => {
  it('extracts execution target from metadata', () => {
    expect(
      extractExecutionTarget({
        executionTarget: { kind: 'desktop', environment: 'vm' },
      })
    ).toEqual({ kind: 'desktop', environment: 'vm' });
  });

  it('extracts skill candidate from raw output', () => {
    expect(
      extractSkillCandidate({
        skillCandidate: {
          status: 'generated',
          description: 'Reusable desktop workflow',
        },
      })
    ).toEqual({
      status: 'generated',
      description: 'Reusable desktop workflow',
    });
  });

  it('returns undefined for invalid input', () => {
    expect(extractExecutionTarget(null)).toBeUndefined();
    expect(extractSkillCandidate({})).toBeUndefined();
  });
});
