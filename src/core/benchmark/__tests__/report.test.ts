import { describe, expect, it } from 'vitest';
import {
  createBenchmarkReport,
  serializeBenchmarkReportCsv,
  serializeBenchmarkReportJson,
} from '../report';
import { evaluateBenchmarkReleaseGate } from '../report';

describe('createBenchmarkReport', () => {
  it('aggregates benchmark runs into summary and per-benchmark stats', () => {
    const report = createBenchmarkReport([
      {
        id: 'run-1',
        benchmarkTaskId: 'benchmark-a',
        benchmarkTaskName: 'Benchmark A',
        runId: 'task-1',
        status: 'completed',
        startedAt: 100,
        durationMs: 1000,
        executionMode: 'dom',
        adapterMode: 'chat-structured',
        visualProvider: {
          id: 'alpha',
          name: 'Alpha',
          score: 101,
          reasons: [],
          adapterMode: 'chat-structured',
        },
        metrics: {
          durationMs: 1000,
          totalTurns: 3,
          actionBatches: 1,
          recoveryAttempts: 1,
          verificationFailures: 0,
          approvalInterruptions: 0,
        },
        evaluation: {
          passed: true,
          summary: 'ok',
          checks: [],
        },
      },
      {
        id: 'run-2',
        benchmarkTaskId: 'benchmark-a',
        benchmarkTaskName: 'Benchmark A',
        runId: 'task-2',
        status: 'failed',
        startedAt: 200,
        durationMs: 2000,
        executionMode: 'hybrid',
        adapterMode: 'responses-computer',
        visualProvider: {
          id: 'beta',
          name: 'Beta',
          score: 109,
          reasons: [],
          adapterMode: 'responses-computer',
        },
        metrics: {
          durationMs: 2000,
          totalTurns: 5,
          actionBatches: 2,
          recoveryAttempts: 2,
          verificationFailures: 1,
          approvalInterruptions: 1,
        },
        approvalAudit: {
          pending: true,
          approved: false,
          matchedIntentKeywords: ['submit'],
          actionRiskReasons: ['contains text entry action'],
          actionTypes: ['click', 'type'],
        },
      },
      {
        id: 'run-3',
        benchmarkTaskId: 'benchmark-b',
        benchmarkTaskName: 'Benchmark B',
        runId: 'task-3',
        status: 'timeout',
        startedAt: 300,
        durationMs: 3000,
        executionMode: 'visual',
        visualProvider: {
          id: 'beta',
          name: 'Beta',
          score: 109,
          reasons: [],
          adapterMode: 'responses-computer',
        },
        metrics: {
          durationMs: 3000,
          totalTurns: 6,
          actionBatches: 2,
          recoveryAttempts: 0,
          verificationFailures: 0,
          approvalInterruptions: 0,
        },
      },
    ]);

    expect(report.summary.totalRuns).toBe(3);
    expect(report.summary.passedRuns).toBe(1);
    expect(report.summary.failedRuns).toBe(1);
    expect(report.summary.timeoutRuns).toBe(1);
    expect(report.executionModes.hybrid).toBe(1);
    expect(report.adapterModes['responses-computer']).toBe(1);
    expect(report.visualProviders.alpha).toBe(1);
    expect(report.visualProviders.beta).toBe(2);
    expect(report.byExecutionMode).toHaveLength(3);
    expect(report.byAdapterMode).toHaveLength(3);
    expect(report.byExecutionMode.find((entry) => entry.executionMode === 'dom')?.successRate).toBe(100);
    expect(report.byExecutionMode.find((entry) => entry.executionMode === 'hybrid')?.failedRuns).toBe(1);
    expect(report.byAdapterMode.find((entry) => entry.adapterMode === 'chat-structured')?.successRate).toBe(100);
    expect(report.byAdapterMode.find((entry) => entry.adapterMode === 'responses-computer')?.failedRuns).toBe(1);
    expect(report.approvalAudit.totalTriggeredRuns).toBe(1);
    expect(report.approvalAudit.byActionType.click).toBe(1);
    expect(report.approvalAudit.byIntentKeyword.submit).toBe(1);
    expect(report.byBenchmark[0].benchmarkTaskId).toBe('benchmark-a');
    expect(report.byBenchmark[0].totalRuns).toBe(2);
    expect(report.byBenchmark[0].avgRecoveryAttempts).toBe(1.5);
    expect(report.byBenchmark[0].recentRunCount).toBe(2);
    expect(report.byBenchmark[0].recentSuccessRate).toBe(50);
    expect(report.summary.stableBenchmarks).toBe(0);

    const gate = evaluateBenchmarkReleaseGate(report);
    expect(gate.status).toBe('risk');
    expect(gate.summary).toContain('Release gate not met');
    expect(gate.checks).toHaveLength(2);
  });

  it('serializes benchmark report to json and csv', () => {
    const report = createBenchmarkReport([
      {
        id: 'run-1',
        benchmarkTaskId: 'benchmark-a',
        benchmarkTaskName: 'Benchmark A',
        runId: 'task-1',
        status: 'completed',
        startedAt: 100,
        durationMs: 1000,
        executionMode: 'dom',
        adapterMode: 'chat-structured',
        visualProvider: {
          id: 'alpha',
          name: 'Alpha',
          score: 101,
          reasons: [],
          adapterMode: 'chat-structured',
        },
        metrics: {
          durationMs: 1000,
          totalTurns: 1,
          actionBatches: 1,
          recoveryAttempts: 0,
          verificationFailures: 0,
          approvalInterruptions: 0,
        },
        evaluation: {
          passed: true,
          summary: 'ok',
          checks: [],
        },
      },
    ]);

    const json = serializeBenchmarkReportJson(report);
    const csv = serializeBenchmarkReportCsv(report);

    expect(json).toContain('"benchmarkTaskId": "benchmark-a"');
    expect(csv).toContain('benchmarkTaskId,benchmarkTaskName,totalRuns');
    expect(csv).toContain('visualProviders');
    expect(csv).toContain('recentRunCount');
    expect(csv).toContain('benchmark-a,Benchmark A,1');
  });

  it('marks a benchmark report as pending when no runs exist', () => {
    const report = createBenchmarkReport([]);
    const gate = evaluateBenchmarkReleaseGate(report);

    expect(gate.status).toBe('pending');
    expect(gate.summary).toContain('No benchmark data');
  });

  it('passes when benchmarks are recent, stable, and consecutive', () => {
    const report = createBenchmarkReport([
      {
        id: 'run-1',
        benchmarkTaskId: 'benchmark-a',
        benchmarkTaskName: 'Benchmark A',
        runId: 'task-1',
        status: 'completed',
        startedAt: 100,
        durationMs: 1000,
        executionMode: 'dom',
        adapterMode: 'chat-structured',
        visualProvider: {
          id: 'alpha',
          name: 'Alpha',
          score: 101,
          reasons: [],
          adapterMode: 'chat-structured',
        },
        metrics: {
          durationMs: 1000,
          totalTurns: 1,
          actionBatches: 1,
          recoveryAttempts: 0,
          verificationFailures: 0,
          approvalInterruptions: 0,
        },
        evaluation: {
          passed: true,
          summary: 'ok',
          checks: [],
        },
      },
      {
        id: 'run-2',
        benchmarkTaskId: 'benchmark-a',
        benchmarkTaskName: 'Benchmark A',
        runId: 'task-2',
        status: 'completed',
        startedAt: 200,
        durationMs: 950,
        executionMode: 'dom',
        adapterMode: 'chat-structured',
        visualProvider: {
          id: 'alpha',
          name: 'Alpha',
          score: 101,
          reasons: [],
          adapterMode: 'chat-structured',
        },
        metrics: {
          durationMs: 950,
          totalTurns: 1,
          actionBatches: 1,
          recoveryAttempts: 0,
          verificationFailures: 0,
          approvalInterruptions: 0,
        },
        evaluation: {
          passed: true,
          summary: 'ok',
          checks: [],
        },
      },
      {
        id: 'run-3',
        benchmarkTaskId: 'benchmark-a',
        benchmarkTaskName: 'Benchmark A',
        runId: 'task-3',
        status: 'completed',
        startedAt: 300,
        durationMs: 980,
        executionMode: 'dom',
        adapterMode: 'chat-structured',
        visualProvider: {
          id: 'alpha',
          name: 'Alpha',
          score: 101,
          reasons: [],
          adapterMode: 'chat-structured',
        },
        metrics: {
          durationMs: 980,
          totalTurns: 1,
          actionBatches: 1,
          recoveryAttempts: 0,
          verificationFailures: 0,
          approvalInterruptions: 0,
        },
        evaluation: {
          passed: true,
          summary: 'ok',
          checks: [],
        },
      },
    ]);

    const gate = evaluateBenchmarkReleaseGate(report);

    expect(gate.status).toBe('pass');
    expect(gate.summary).toContain('1 stable benchmark(s)');
    expect(gate.checks[0].passed).toBe(true);
    expect(gate.checks[0].detail).toContain('3 consecutive successes');
  });
});
