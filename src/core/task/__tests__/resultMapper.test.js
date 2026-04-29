import { describe, expect, it } from 'vitest';
import { mapAgentResultToTaskResult } from '../resultMapper';
describe('resultMapper', () => {
    it('preserves action contract on task results and raw output', () => {
        const result = mapAgentResultToTaskResult({
            success: true,
            output: { value: 'done' },
            finalMessage: 'Completed',
            actionContract: {
                supportedActions: ['open_application', 'save_file'],
                notes: ['desktop workflow'],
            },
        });
        expect(result.actionContract).toMatchObject({
            supportedActions: ['open_application', 'save_file'],
            notes: ['desktop workflow'],
        });
        expect(result.rawOutput).toMatchObject({
            actionContract: {
                supportedActions: ['open_application', 'save_file'],
                notes: ['desktop workflow'],
            },
        });
    });
    it('keeps mixed browser-desktop workflow traces in task results', () => {
        const result = mapAgentResultToTaskResult({
            success: true,
            finalMessage: 'mixed workflow complete',
            output: {
                routeReason: 'browser-desktop-handoff',
            },
            steps: [
                {
                    toolName: 'browser-desktop-handoff:browser',
                    result: {
                        success: true,
                        routeReason: 'browser-desktop-handoff',
                        turns: [{ step: 1, action: 'download' }],
                        metrics: {
                            totalTurns: 2,
                            actionBatches: 1,
                            recoveryAttempts: 0,
                            verificationFailures: 0,
                            approvalInterruptions: 0,
                        },
                    },
                },
                {
                    toolName: 'browser-desktop-handoff:desktop',
                    result: {
                        success: true,
                        routeReason: 'browser-desktop-handoff',
                        turns: [{ step: 2, action: 'rename' }],
                        metrics: {
                            totalTurns: 3,
                            actionBatches: 1,
                            recoveryAttempts: 1,
                            verificationFailures: 0,
                            approvalInterruptions: 0,
                        },
                    },
                },
            ],
        });
        expect(result.summary).toBe('mixed workflow complete');
        const rawOutput = result.rawOutput;
        expect(Array.isArray(rawOutput.visualTrace)).toBe(true);
        expect(Array.isArray(rawOutput.visualMetrics)).toBe(true);
        expect(rawOutput.visualTrace).toHaveLength(3);
        expect(rawOutput.visualTrace).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'output', routeReason: 'browser-desktop-handoff' }),
            expect.objectContaining({ source: 'step', routeReason: 'browser-desktop-handoff' }),
        ]));
        expect(rawOutput.visualMetrics).toEqual(expect.arrayContaining([
            expect.objectContaining({ source: 'step', totalTurns: 2, actionBatches: 1 }),
            expect.objectContaining({ source: 'step', totalTurns: 3, recoveryAttempts: 1 }),
        ]));
    });
});
