import { describe, expect, it } from 'vitest';
import { extractActionContract, resolveActionContract } from '../actionContract';

describe('resolveActionContract', () => {
  it('normalizes supported contract fields', () => {
    expect(
      resolveActionContract({
        supportedActions: ['open_application', 123, 'save_file'],
        supportedOperations: ['focus_window'],
        notes: ['desktop workflow', null],
        workflowSemantics: [
          { action: 'open_file', summary: 'Open a local file', examples: ['Open /tmp/report.csv', 123] },
          { action: '', summary: 'ignored' },
        ],
      })
    ).toEqual({
      supportedActions: ['open_application', 'save_file'],
      supportedOperations: ['focus_window'],
      notes: ['desktop workflow'],
      workflowSemantics: [
        {
          action: 'open_file',
          summary: 'Open a local file',
          examples: ['Open /tmp/report.csv'],
        },
      ],
    });
  });

  it('returns undefined for empty values', () => {
    expect(resolveActionContract({})).toBeUndefined();
    expect(resolveActionContract(null)).toBeUndefined();
    expect(resolveActionContract(['open_application'])).toBeUndefined();
  });

  it('extracts from either direct field or raw output', () => {
    expect(
      extractActionContract({
        actionContract: { supportedActions: ['focus_window'] },
      })
    ).toEqual({ supportedActions: ['focus_window'] });

    expect(
      extractActionContract({
        rawOutput: {
          actionContract: { supportedOperations: ['save_file'], notes: ['loaded from history'] },
        },
      })
    ).toEqual({
      supportedOperations: ['save_file'],
      notes: ['loaded from history'],
    });
  });
});
