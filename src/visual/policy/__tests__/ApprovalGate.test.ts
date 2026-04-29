import { describe, expect, it } from 'vitest';
import {
  RuleBasedApprovalGate,
  buildApprovalAudit,
  containsHighImpactActions,
  containsHighImpactIntent,
} from '../ApprovalGate';

describe('ApprovalGate', () => {
  it('detects high-impact task intent from task and page context', () => {
    const matches = containsHighImpactIntent({
      task: 'Please publish the updated pricing page',
      page: {
        title: 'Publish changes',
        url: 'https://example.test/publish',
      },
      approvalPolicy: {
        enabled: true,
      },
    });

    expect(matches).toContain('publish');
  });

  it('detects risky action batches from action content', () => {
    const reasons = containsHighImpactActions([
      { type: 'focus_window', windowTitle: 'Inbox' },
      { type: 'type', text: 'launch announcement' },
      { type: 'keypress', keys: ['ENTER'] },
    ]);

    expect(reasons).toContain('contains high-impact desktop action: focus_window');
    expect(reasons).toContain('contains keypress action');
    expect(reasons).toContain('contains text entry action');
    expect(reasons).toContain('contains large multi-step action batch');
  });

  it('requires approval when mixed intent and action risk are present', async () => {
    const gate = new RuleBasedApprovalGate();

    const shouldPause = await gate.shouldPauseForApproval(
      [
        { type: 'type', text: 'release announcement' },
        { type: 'keypress', keys: ['ENTER'] },
      ],
      {
        task: 'Send the prepared release message to the team',
        page: {
          title: 'Messaging Console',
        },
        approvalPolicy: {
          enabled: true,
        },
      }
    );

    expect(shouldPause).toBe(true);
  });

  it('adds desktop backend context to approval audit reasons', () => {
    const audit = buildApprovalAudit(
      [{ type: 'open_file', targetPath: '/tmp/report.csv' }],
      {
        task: 'Open the exported report file',
        page: {
          title: 'Desktop export',
        },
        executionTarget: {
          kind: 'desktop',
          environment: 'native-bridge',
        },
        approvalPolicy: {
          enabled: true,
        },
      }
    );

    expect(audit.actionRiskReasons).toContain('contains desktop workflow action: open_file');
    expect(audit.actionRiskReasons).toContain('runs on native-bridge host desktop backend');
  });
});
